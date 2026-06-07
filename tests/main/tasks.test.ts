import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pipelineTaskChannels } from '../../src/shared/pipeline'

const handlers = new Map<string, (...args: unknown[]) => unknown>()
const browserWindowSendMock = vi.fn()
const browserWindowFromWebContentsMock = vi.fn()

const loadConfigMock = vi.fn()
const pickMediaFileMock = vi.fn()
const prepareNormalizedAudioMock = vi.fn()
const createFilePipelineSessionMock = vi.fn()
const createOpenAiChatRefinementProviderMock = vi.fn()
const createQwenLiveTranslateRealtimeProviderMock = vi.fn()
const createSystemAudioPipelineSessionMock = vi.fn()

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: browserWindowFromWebContentsMock,
    getAllWindows: vi.fn(() => [
      {
        webContents: {
          send: browserWindowSendMock
        }
      }
    ])
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    })
  }
}))

vi.mock('../../src/main/services/config-store', () => ({
  loadConfig: loadConfigMock
}))

vi.mock('../../src/main/services/file-picker', () => ({
  pickMediaFile: pickMediaFileMock
}))

vi.mock('../../src/main/services/pipeline-media-prep', () => ({
  prepareNormalizedAudio: prepareNormalizedAudioMock
}))

vi.mock('../../src/main/services/file-pipeline-session', () => ({
  createFilePipelineSession: createFilePipelineSessionMock
}))

vi.mock('../../src/main/services/providers/openai-chat-translation-provider', () => ({
  createOpenAiChatRefinementProvider: createOpenAiChatRefinementProviderMock
}))

vi.mock('../../src/main/services/providers/qwen-live-translate-realtime-provider', () => ({
  createQwenLiveTranslateRealtimeProvider: createQwenLiveTranslateRealtimeProviderMock
}))

vi.mock('../../src/main/services/system-audio-session', () => ({
  createSystemAudioPipelineSession: createSystemAudioPipelineSessionMock
}))

const createAbortError = (): Error => {
  const error = new Error('Aborted')
  error.name = 'AbortError'
  return error
}

const baseConfig = {
  refiner: {
    baseUrl: 'https://api.deepseek.com',
    apiKey: 'translation-key',
    model: 'deepseek-v4-flash'
  },
  asr: {
    provider: 'scripted' as const,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'unused'
  },
  liveTranslate: {
    baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
    apiKey: 'live-translate-key',
    model: 'qwen3.5-livetranslate-flash-realtime',
    sourceLanguage: 'en',
    targetLanguage: 'zh'
  },
  revisionWindowSize: 4,
  blockDurationMs: 2000,
  chunkDurationMs: 5000,
  chunkOverlapMs: 1000
}

describe('registerTaskHandlers', () => {
  beforeEach(() => {
    handlers.clear()
    vi.resetModules()
    vi.clearAllMocks()

    loadConfigMock.mockReturnValue({
      inputMode: 'file',
      ...baseConfig
    })
    pickMediaFileMock.mockResolvedValue({ filePath: 'fixtures/input.wav' })
    prepareNormalizedAudioMock.mockResolvedValue({
      normalizedFilePath: 'fixtures/normalized.wav',
      cleanup: vi.fn().mockResolvedValue(undefined)
    })

    createFilePipelineSessionMock.mockImplementation(async ({ emitEvent }) => {
      return {
        run: vi.fn().mockImplementation(async () => {
          emitEvent({
            type: 'subtitle-blocks-updated',
            blocks: [
              {
                id: 'block-0',
                index: 0,
                startMs: 0,
                endMs: 2000,
                sourceTranscript: 'hello conference',
                liveTranslation: '你好会议',
                refinedTranslation: '',
                status: 'live',
                updatedAt: 1
              }
            ]
          })
          emitEvent({
            type: 'subtitle-blocks-updated',
            blocks: [
              {
                id: 'block-0',
                index: 0,
                startMs: 0,
                endMs: 2000,
                sourceTranscript: 'hello conference',
                liveTranslation: '你好会议',
                refinedTranslation: '你好，欢迎参加本次会议。',
                status: 'refined',
                updatedAt: 2
              }
            ]
          })
        }),
        getSession: vi.fn()
      }
    })

    createOpenAiChatRefinementProviderMock.mockReturnValue({
      refineBlocks: vi.fn().mockResolvedValue([])
    })
    createQwenLiveTranslateRealtimeProviderMock.mockReturnValue({
      startSession: vi.fn()
    })
    createSystemAudioPipelineSessionMock.mockResolvedValue({
      appendChunk: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined)
    })
  })

  it('starts the file pipeline with normalized audio, forwards live translate events to the window, and reports realtime status', async () => {
    const { registerTaskHandlers } = await import('../../src/main/ipc/tasks')
    registerTaskHandlers()

    const startTask = handlers.get(pipelineTaskChannels.startTask)
    const getTaskStatus = handlers.get(pipelineTaskChannels.getTaskStatus)

    expect(startTask).toBeDefined()
    expect(getTaskStatus).toBeDefined()

    const startStatus = await startTask?.({}, 'fixtures/input.wav')
    expect(startStatus).toMatchObject({
      filePath: 'fixtures/input.wav',
      inputMode: 'file',
      sourceLabel: 'fixtures/input.wav',
      stage: 'running',
      isRunning: true
    })

    await vi.waitFor(async () => {
      await expect(getTaskStatus?.()).resolves.toMatchObject({
        stage: 'completed',
        isRunning: false,
        canStart: true
      })
    })

    expect(createQwenLiveTranslateRealtimeProviderMock).toHaveBeenCalledWith({
      baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
      apiKey: 'live-translate-key',
      model: 'qwen3.5-livetranslate-flash-realtime',
      sourceLanguage: 'en',
      targetLanguage: 'zh'
    })
    expect(createOpenAiChatRefinementProviderMock).toHaveBeenCalledWith({
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'translation-key',
      model: 'deepseek-v4-flash'
    })
    expect(prepareNormalizedAudioMock).toHaveBeenCalledWith('fixtures/input.wav')
    expect(createFilePipelineSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        wavFilePath: 'fixtures/normalized.wav',
        blockDurationMs: 2000,
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        signal: expect.any(AbortSignal)
      })
    )
    expect(browserWindowSendMock).toHaveBeenCalledWith(
      pipelineTaskChannels.pipelineEvent,
      expect.objectContaining({ type: 'subtitle-blocks-updated' })
    )
  })

  it('starts a system-audio session and forwards captured chunks to the streaming pipeline', async () => {
    loadConfigMock.mockReturnValue({
      inputMode: 'system-audio',
      ...baseConfig
    })
    const appendChunk = vi.fn().mockResolvedValue(undefined)
    const complete = vi.fn().mockResolvedValue(undefined)
    createSystemAudioPipelineSessionMock.mockResolvedValue({
      appendChunk,
      complete,
      abort: vi.fn().mockResolvedValue(undefined)
    })

    const { registerTaskHandlers } = await import('../../src/main/ipc/tasks')
    registerTaskHandlers()

    const startSystemAudioTask = handlers.get(pipelineTaskChannels.startSystemAudioTask)
    const pushSystemAudioChunk = handlers.get(pipelineTaskChannels.pushSystemAudioChunk)
    const completeSystemAudioTask = handlers.get(pipelineTaskChannels.completeSystemAudioTask)

    const startStatus = await startSystemAudioTask?.()
    expect(startStatus).toMatchObject({
      inputMode: 'system-audio',
      sourceLabel: '系统声音采集',
      stage: 'running',
      isRunning: true
    })

    await pushSystemAudioChunk?.({}, {
      bytes: new Uint8Array([1, 2, 3]),
      durationMs: 3000,
      mimeType: 'audio/wav'
    })
    const completedStatus = await completeSystemAudioTask?.()

    expect(completedStatus).toMatchObject({
      inputMode: 'system-audio',
      stage: 'completed',
      isRunning: false,
      canStart: true
    })
    expect(createQwenLiveTranslateRealtimeProviderMock).toHaveBeenCalledWith({
      baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
      apiKey: 'live-translate-key',
      model: 'qwen3.5-livetranslate-flash-realtime',
      sourceLanguage: 'en',
      targetLanguage: 'zh'
    })
    expect(createOpenAiChatRefinementProviderMock).toHaveBeenCalledWith({
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'translation-key',
      model: 'deepseek-v4-flash'
    })
    expect(createSystemAudioPipelineSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        blockDurationMs: 2000,
        signal: expect.any(AbortSignal)
      })
    )
    expect(appendChunk).toHaveBeenCalledWith({
      bytes: new Uint8Array([1, 2, 3]),
      durationMs: 3000,
      mimeType: 'audio/wav'
    })
    expect(complete).toHaveBeenCalledOnce()
  })

  it('opens the file picker for the sender window and stores the selected file as ready', async () => {
    const senderWindow = { id: 1 }
    browserWindowFromWebContentsMock.mockReturnValue(senderWindow)

    const { registerTaskHandlers } = await import('../../src/main/ipc/tasks')
    registerTaskHandlers()

    const pickTask = handlers.get(pipelineTaskChannels.pickMediaFile)
    const getTaskStatus = handlers.get(pipelineTaskChannels.getTaskStatus)

    const file = await pickTask?.({ sender: { id: 'web-contents' } })

    expect(browserWindowFromWebContentsMock).toHaveBeenCalledWith({ id: 'web-contents' })
    expect(pickMediaFileMock).toHaveBeenCalledWith(senderWindow)
    expect(file).toEqual({ filePath: 'fixtures/input.wav' })
    await expect(getTaskStatus?.()).resolves.toMatchObject({
      filePath: 'fixtures/input.wav',
      inputMode: 'file',
      sourceLabel: 'fixtures/input.wav',
      stage: 'ready',
      canStart: true,
      lastRevisionSummary: '文件已选择，可以开始处理。'
    })
  })

  it('aborts the in-flight file pipeline on pause and reset, and does not start twice', async () => {
    let abortSignal: AbortSignal | undefined

    createFilePipelineSessionMock.mockImplementation(
      async ({ signal }: { signal?: AbortSignal }) => {
        abortSignal = signal
        return {
          run: () =>
            new Promise((_, reject) => {
              signal?.addEventListener('abort', () => {
                reject(createAbortError())
              })
            }),
          getSession: vi.fn()
        }
      }
    )

    const { registerTaskHandlers } = await import('../../src/main/ipc/tasks')
    registerTaskHandlers()

    const startTask = handlers.get(pipelineTaskChannels.startTask)
    const pauseTask = handlers.get(pipelineTaskChannels.pauseTask)
    const resetTask = handlers.get(pipelineTaskChannels.resetTask)
    const getTaskStatus = handlers.get(pipelineTaskChannels.getTaskStatus)

    await startTask?.({}, 'fixtures/input.wav')
    const secondStartStatus = await startTask?.({}, 'fixtures/input.wav')

    expect(createFilePipelineSessionMock).toHaveBeenCalledTimes(1)
    expect(secondStartStatus).toMatchObject({
      stage: 'running',
      isRunning: true
    })

    const pausedStatus = await pauseTask?.()
    expect(abortSignal?.aborted).toBe(true)
    expect(pausedStatus).toMatchObject({
      stage: 'paused',
      isRunning: false,
      canStart: true
    })
    await expect(getTaskStatus?.()).resolves.toMatchObject({
      stage: 'paused',
      lastRevisionSummary: '任务已暂停，当前处理流程已终止。'
    })

    const pausedAgainStatus = await pauseTask?.()
    expect(pausedAgainStatus).toMatchObject({
      stage: 'paused'
    })

    await startTask?.({}, 'fixtures/input.wav')
    const resetStatus = await resetTask?.()
    expect(resetStatus).toMatchObject({
      stage: 'idle',
      filePath: null,
      inputMode: 'file',
      isRunning: false,
      canStart: false
    })
    await expect(getTaskStatus?.()).resolves.toMatchObject({
      stage: 'idle',
      lastRevisionSummary: '任务已重置，请选择文件。'
    })
  })
})
