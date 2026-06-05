import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pipelineTaskChannels } from '../../src/shared/pipeline'

const handlers = new Map<string, (...args: unknown[]) => unknown>()

const loadConfigMock = vi.fn()
const pickMediaFileMock = vi.fn()
const runPipelineMock = vi.fn()
const createScriptedAsrProviderMock = vi.fn()
const createOpenAiAudioAsrProviderMock = vi.fn()
const createOpenAiChatTranslationProviderMock = vi.fn()

vi.mock('electron', () => ({
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

vi.mock('../../src/main/services/providers/scripted-asr-provider', () => ({
  createScriptedAsrProvider: createScriptedAsrProviderMock
}))

vi.mock('../../src/main/services/providers/openai-audio-asr-provider', () => ({
  createOpenAiAudioAsrProvider: createOpenAiAudioAsrProviderMock
}))

vi.mock('../../src/main/services/providers/openai-chat-translation-provider', () => ({
  createOpenAiChatTranslationProvider: createOpenAiChatTranslationProviderMock
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
      translation: {
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
      revisionWindowSize: 4,
      chunkDurationMs: 5000,
      chunkOverlapMs: 1000
    })
    pickMediaFileMock.mockResolvedValue({ filePath: 'fixtures/chunk-0.wav' })
    createScriptedAsrProviderMock.mockReturnValue({
      transcribeChunk: vi.fn().mockResolvedValue('scripted')
    })
    createOpenAiAudioAsrProviderMock.mockReturnValue({
      transcribeChunk: vi.fn().mockResolvedValue('hello conference')
    })
    createOpenAiChatTranslationProviderMock.mockReturnValue({
      translateBatch: vi.fn().mockResolvedValue([{ id: 'chunk-0', chinese: '你好，会议' }]),
      reviseBatch: vi.fn().mockResolvedValue([{ id: 'chunk-0', chinese: '你好，会议' }])
    })
  })

  it('starts the pipeline with config-selected providers and records the latest revision summary', async () => {
    runPipelineMock.mockImplementation(async ({ emitEvent }) => {
      emitEvent({
        type: 'subtitle-revised',
        subtitle: {
          id: 'chunk-0',
          english: 'hello conference',
          chinese: '你好，会议',
          status: 'draft',
          revisionCount: 1,
          updatedAt: 1
        }
      })
      emitEvent({
        type: 'pipeline-completed',
        subtitles: [
          {
            id: 'chunk-0',
            english: 'hello conference',
            chinese: '你好，会议',
            status: 'draft',
            revisionCount: 1,
            updatedAt: 1
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

    const startStatus = await startTask?.({}, 'fixtures/chunk-0.wav')
    expect(startStatus).toMatchObject({
      filePath: 'fixtures/chunk-0.wav',
      stage: 'running',
      isRunning: true
    })

    await Promise.resolve()

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
    expect(runPipelineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chunks: [
          {
            index: 0,
            startMs: 0,
            endMs: 0,
            filePath: 'fixtures/chunk-0.wav'
          }
        ],
        revisionWindowSize: 4,
        signal: expect.any(AbortSignal)
      })
    )
    await expect(getTaskStatus?.()).resolves.toMatchObject({
      stage: 'completed',
      isRunning: false,
      canStart: true,
      lastRevisionSummary: 'Latest revision: 你好，会议'
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

    await startTask?.({}, 'fixtures/chunk-0.wav')
    const secondStartStatus = await startTask?.({}, 'fixtures/chunk-0.wav')

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

    await startTask?.({}, 'fixtures/chunk-0.wav')
    const resetStatus = await resetTask?.()
    expect(resetStatus).toMatchObject({
      stage: 'idle',
      filePath: null,
      isRunning: false,
      canStart: false
    })
    await expect(getTaskStatus?.()).resolves.toMatchObject({
      stage: 'idle',
      lastRevisionSummary: 'Task reset. No file is selected.'
    })
  })
})
