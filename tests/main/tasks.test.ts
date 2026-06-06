import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pipelineTaskChannels } from '../../src/shared/pipeline'

const handlers = new Map<string, (...args: unknown[]) => unknown>()
const browserWindowSendMock = vi.fn()
const browserWindowFromWebContentsMock = vi.fn()

const loadConfigMock = vi.fn()
const pickMediaFileMock = vi.fn()
const runPipelineMock = vi.fn()
const preparePipelineChunksMock = vi.fn()
const createScriptedAsrProviderMock = vi.fn()
const createOpenAiAudioAsrProviderMock = vi.fn()
const createDashScopeRealtimeAsrProviderMock = vi.fn()
const createOpenAiChatTranslationProviderMock = vi.fn()
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

vi.mock('../../src/main/services/pipeline-runner', () => ({
  runPipeline: runPipelineMock
}))

vi.mock('../../src/main/services/pipeline-media-prep', () => ({
  preparePipelineChunks: preparePipelineChunksMock
}))

vi.mock('../../src/main/services/providers/scripted-asr-provider', () => ({
  createScriptedAsrProvider: createScriptedAsrProviderMock
}))

vi.mock('../../src/main/services/providers/openai-audio-asr-provider', () => ({
  createOpenAiAudioAsrProvider: createOpenAiAudioAsrProviderMock
}))

vi.mock('../../src/main/services/providers/dashscope-realtime-asr-provider', () => ({
  createDashScopeRealtimeAsrProvider: createDashScopeRealtimeAsrProviderMock
}))

vi.mock('../../src/main/services/providers/openai-chat-translation-provider', () => ({
  createOpenAiChatTranslationProvider: createOpenAiChatTranslationProviderMock,
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

describe('registerTaskHandlers', () => {
  beforeEach(() => {
    handlers.clear()
    vi.resetModules()
    vi.clearAllMocks()

    loadConfigMock.mockReturnValue({
      inputMode: 'file',
      refiner: {
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'translation-key',
        model: 'deepseek-v4-flash'
      },
      asr: {
        provider: 'openai-audio',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'asr-key',
        model: 'gpt-4o-mini-transcribe'
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
    })
    pickMediaFileMock.mockResolvedValue({ filePath: 'fixtures/input.wav' })
    preparePipelineChunksMock.mockResolvedValue({
      normalizedFilePath: 'fixtures/normalized.wav',
      chunks: [
        {
          index: 0,
          startMs: 0,
          endMs: 5_000,
          filePath: 'fixtures/chunk-0.wav'
        },
        {
          index: 1,
          startMs: 4_000,
          endMs: 9_000,
          filePath: 'fixtures/chunk-1.wav'
        }
      ],
      cleanup: vi.fn().mockResolvedValue(undefined)
    })
    createScriptedAsrProviderMock.mockReturnValue({
      transcribeChunk: vi.fn().mockResolvedValue('scripted transcript')
    })
    createOpenAiAudioAsrProviderMock.mockReturnValue({
      transcribeChunk: vi.fn().mockResolvedValue('hello conference')
    })
    createDashScopeRealtimeAsrProviderMock.mockReturnValue({
      transcribeChunk: vi.fn().mockResolvedValue('hello conference from dashscope')
    })
    createOpenAiChatTranslationProviderMock.mockReturnValue({
      translateBatch: vi.fn().mockResolvedValue([{ id: 'chunk-0', chinese: 'draft translation' }]),
      reviseBatch: vi.fn().mockResolvedValue([{ id: 'chunk-0', chinese: 'revised translation' }])
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

  it('starts the pipeline with prepared chunks, forwards pipeline events to the window, and records the latest revision summary', async () => {
    runPipelineMock.mockImplementation(async ({ emitEvent }) => {
      emitEvent({
        type: 'subtitle-pending',
        chunk: {
          index: 0,
          startMs: 0,
          endMs: 5_000,
          filePath: 'fixtures/chunk-0.wav'
        },
        subtitle: {
          id: 'chunk-0',
          english: '',
          chinese: '',
          status: 'draft',
          revisionCount: 0,
          updatedAt: 0
        }
      })
      emitEvent({
        type: 'subtitle-added',
        chunk: {
          index: 0,
          startMs: 0,
          endMs: 5_000,
          filePath: 'fixtures/chunk-0.wav'
        },
        subtitle: {
          id: 'chunk-0',
          english: 'hello conference',
          chinese: 'draft translation',
          status: 'draft',
          revisionCount: 0,
          updatedAt: 1
        }
      })
      emitEvent({
        type: 'subtitle-revised',
        subtitle: {
          id: 'chunk-0',
          english: 'hello conference',
          chinese: 'revised translation',
          status: 'final',
          revisionCount: 1,
          updatedAt: 2
        }
      })
      emitEvent({
        type: 'pipeline-completed',
        subtitles: [
          {
            id: 'chunk-0',
            english: 'hello conference',
            chinese: 'revised translation',
            status: 'final',
            revisionCount: 1,
            updatedAt: 2
          }
        ]
      })
      return []
    })

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
        canStart: true,
        lastRevisionSummary: 'Latest revision: revised translation'
      })
    })

    expect(createOpenAiAudioAsrProviderMock).toHaveBeenCalledWith({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'asr-key',
      model: 'gpt-4o-mini-transcribe'
    })
    expect(createOpenAiChatTranslationProviderMock).toHaveBeenCalledWith({
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'translation-key',
      model: 'deepseek-v4-flash'
    })
    expect(preparePipelineChunksMock).toHaveBeenCalledWith('fixtures/input.wav', {
      chunkDurationMs: 5000,
      chunkOverlapMs: 1000
    })
    expect(runPipelineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chunks: [
          {
            index: 0,
            startMs: 0,
            endMs: 5_000,
            filePath: 'fixtures/chunk-0.wav'
          },
          {
            index: 1,
            startMs: 4_000,
            endMs: 9_000,
            filePath: 'fixtures/chunk-1.wav'
          }
        ],
        revisionWindowSize: 4,
        signal: expect.any(AbortSignal)
      })
    )
    expect(browserWindowSendMock).toHaveBeenCalledWith(
      pipelineTaskChannels.pipelineEvent,
      expect.objectContaining({ type: 'subtitle-pending' })
    )
    expect(browserWindowSendMock).toHaveBeenCalledWith(
      pipelineTaskChannels.pipelineEvent,
      expect.objectContaining({ type: 'subtitle-added' })
    )
    expect(browserWindowSendMock).toHaveBeenCalledWith(
      pipelineTaskChannels.pipelineEvent,
      expect.objectContaining({ type: 'subtitle-revised' })
    )
  })

  it('selects the DashScope realtime ASR provider when configured', async () => {
    loadConfigMock.mockReturnValue({
      inputMode: 'file',
      refiner: {
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'translation-key',
        model: 'deepseek-v4-flash'
      },
      asr: {
        provider: 'dashscope-realtime',
        baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
        apiKey: 'dashscope-key',
        model: 'qwen3-asr-flash-realtime'
      },
      revisionWindowSize: 4,
      chunkDurationMs: 5000,
      chunkOverlapMs: 1000
    })
    runPipelineMock.mockResolvedValue([])

    const { registerTaskHandlers } = await import('../../src/main/ipc/tasks')
    registerTaskHandlers()

    const startTask = handlers.get(pipelineTaskChannels.startTask)
    await startTask?.({}, 'fixtures/input.wav')

    expect(createDashScopeRealtimeAsrProviderMock).toHaveBeenCalledWith({
      baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
      apiKey: 'dashscope-key',
      model: 'qwen3-asr-flash-realtime'
    })
    expect(createOpenAiAudioAsrProviderMock).not.toHaveBeenCalled()
    expect(createScriptedAsrProviderMock).not.toHaveBeenCalled()
  })

  it('starts a system-audio session and forwards captured chunks to the streaming pipeline', async () => {
    loadConfigMock.mockReturnValue({
      inputMode: 'system-audio',
      refiner: {
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'translation-key',
        model: 'deepseek-v4-flash'
      },
      asr: {
        provider: 'scripted',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'unused-for-system-audio'
      },
      liveTranslate: {
        baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
        apiKey: 'dashscope-key',
        model: 'qwen3.5-livetranslate-flash-realtime',
        sourceLanguage: 'en',
        targetLanguage: 'zh'
      },
      revisionWindowSize: 4,
      blockDurationMs: 2000,
      chunkDurationMs: 5000,
      chunkOverlapMs: 1000
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
      sourceLabel: 'System audio capture',
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
      apiKey: 'dashscope-key',
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
      lastRevisionSummary: 'File selected. Ready to start the task.'
    })
  })

  it('aborts the in-flight pipeline on pause and reset, and does not start twice', async () => {
    let abortSignal: AbortSignal | undefined

    runPipelineMock.mockImplementation(
      ({ signal }: { signal?: AbortSignal }) =>
        new Promise((_, reject) => {
          abortSignal = signal
          signal?.addEventListener('abort', () => {
            reject(createAbortError())
          })
        })
    )

    const { registerTaskHandlers } = await import('../../src/main/ipc/tasks')
    registerTaskHandlers()

    const startTask = handlers.get(pipelineTaskChannels.startTask)
    const pauseTask = handlers.get(pipelineTaskChannels.pauseTask)
    const resetTask = handlers.get(pipelineTaskChannels.resetTask)
    const getTaskStatus = handlers.get(pipelineTaskChannels.getTaskStatus)

    await startTask?.({}, 'fixtures/input.wav')
    const secondStartStatus = await startTask?.({}, 'fixtures/input.wav')

    expect(runPipelineMock).toHaveBeenCalledTimes(1)
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
      lastRevisionSummary: 'Task paused. The current pipeline run was aborted.'
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
      lastRevisionSummary: 'Task reset. No file is selected.'
    })
  })
})
