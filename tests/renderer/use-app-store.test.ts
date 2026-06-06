import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAppConfig } from '../../src/shared/config'
import type { PipelineEvent, PipelineTaskStatus } from '../../src/shared/pipeline'

const startSystemAudioCaptureMock = vi.fn()

vi.mock('../../src/renderer/src/system-audio-capture', () => ({
  startSystemAudioCapture: startSystemAudioCaptureMock
}))

const createStatus = (overrides: Partial<PipelineTaskStatus> = {}): PipelineTaskStatus => ({
  filePath: null,
  inputMode: 'file',
  sourceLabel: null,
  stage: 'idle',
  isRunning: false,
  canStart: false,
  lastRevisionSummary: 'No task has run yet.',
  ...overrides
})

describe('useAppStore task controls', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('hydrates an empty real timeline and applies subtitle events from the bridge', async () => {
    const eventListeners: Array<(event: PipelineEvent) => void> = []

    window.appConfig = {
      load: vi.fn().mockResolvedValue(defaultAppConfig),
      save: vi.fn().mockResolvedValue(defaultAppConfig)
    }
    window.pipelineTasks = {
      pickMediaFile: vi.fn().mockResolvedValue(null),
      getTaskStatus: vi.fn().mockResolvedValue(
        createStatus({
          filePath: 'fixtures/demo.wav',
          stage: 'ready',
          isRunning: false,
          canStart: true,
          lastRevisionSummary: 'File selected. Waiting for the real pipeline to start.'
        })
      ),
      startTask: vi.fn().mockResolvedValue(
        createStatus({
          filePath: 'fixtures/demo.wav',
          stage: 'running',
          isRunning: true,
          canStart: false,
          lastRevisionSummary: 'Task started. Waiting for pipeline events.'
        })
      ),
      pauseTask: vi.fn().mockResolvedValue(createStatus()),
      resetTask: vi.fn().mockResolvedValue(createStatus()),
      onPipelineEvent: vi.fn((listener: (event: PipelineEvent) => void) => {
        eventListeners.push(listener)
        return () => {}
      })
    }

    const { useAppStore } = await import('../../src/renderer/src/state/useAppStore')

    await useAppStore.getState().hydrateConfig()
    expect(useAppStore.getState().timelineMode).toBe('live')
    expect(useAppStore.getState().subtitles).toEqual([])

    await useAppStore.getState().start()

    eventListeners[0]?.({
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

    expect(useAppStore.getState().subtitles).toEqual([
      {
        id: 'chunk-0',
        startMs: 0,
        endMs: 5_000,
        english: '',
        chinese: '',
        status: 'draft',
        revisionCount: 0
      }
    ])

    eventListeners[0]?.({
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

    expect(useAppStore.getState().subtitles).toEqual([
      {
        id: 'chunk-0',
        startMs: 0,
        endMs: 5_000,
        english: 'hello conference',
        chinese: 'draft translation',
        status: 'draft',
        revisionCount: 0
      }
    ])

    eventListeners[0]?.({
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

    expect(useAppStore.getState().subtitles).toEqual([
      {
        id: 'chunk-0',
        startMs: 0,
        endMs: 5_000,
        english: 'hello conference',
        chinese: 'revised translation',
        status: 'final',
        revisionCount: 1
      }
    ])
  })

  it('tracks pick, start, pause, and reset through the task bridge', async () => {
    const pickMediaFile = vi.fn().mockResolvedValue({ filePath: 'fixtures/chunk-0.wav' })
    const getTaskStatus = vi
      .fn()
      .mockResolvedValueOnce(
        createStatus({
          filePath: 'fixtures/chunk-0.wav',
          stage: 'ready',
          isRunning: false,
          canStart: true,
          lastRevisionSummary: 'Main process says the task is ready.'
        })
      )
      .mockResolvedValue(createStatus())
    const startTask = vi.fn().mockResolvedValue(
      createStatus({
        filePath: 'fixtures/chunk-0.wav',
        stage: 'running',
        isRunning: true,
        canStart: false,
        lastRevisionSummary: 'Task controls wired. Pipeline execution is still minimal.'
      })
    )
    const pauseTask = vi.fn().mockResolvedValue(
      createStatus({
        filePath: 'fixtures/chunk-0.wav',
        stage: 'paused',
        isRunning: false,
        canStart: true,
        lastRevisionSummary: 'Task paused before end-to-end execution completed.'
      })
    )
    const resetTask = vi.fn().mockResolvedValue(createStatus())

    window.appConfig = {
      load: vi.fn().mockResolvedValue(defaultAppConfig),
      save: vi.fn().mockResolvedValue(defaultAppConfig)
    }
    window.pipelineTasks = {
      pickMediaFile,
      getTaskStatus,
      startTask,
      pauseTask,
      resetTask
    }

    const { useAppStore } = await import('../../src/renderer/src/state/useAppStore')

    await useAppStore.getState().pick()
    expect(useAppStore.getState().filePath).toBe('fixtures/chunk-0.wav')
    expect(useAppStore.getState().canStart).toBe(true)
    expect(useAppStore.getState().lastRevisionSummary).toBe('Main process says the task is ready.')
    expect(getTaskStatus).toHaveBeenCalledTimes(1)

    await useAppStore.getState().start()
    expect(useAppStore.getState().isRunning).toBe(true)
    expect(useAppStore.getState().canStart).toBe(false)
    expect(useAppStore.getState().stageLabel).toBe('Running')

    await useAppStore.getState().pause()
    expect(useAppStore.getState().isRunning).toBe(false)
    expect(useAppStore.getState().canStart).toBe(true)
    expect(useAppStore.getState().stageLabel).toBe('Paused')

    await useAppStore.getState().reset()
    expect(useAppStore.getState().filePath).toBe(null)
    expect(useAppStore.getState().stageLabel).toBe('Idle')
    expect(useAppStore.getState().canStart).toBe(false)
  })

  it('starts and stops the renderer-side system audio capture flow', async () => {
    const stop = vi.fn().mockResolvedValue(undefined)
    startSystemAudioCaptureMock.mockResolvedValue({ stop })

    window.appConfig = {
      load: vi.fn().mockResolvedValue({
        ...defaultAppConfig,
        inputMode: 'system-audio' as const
      }),
      save: vi.fn().mockResolvedValue(defaultAppConfig)
    }
    window.pipelineTasks = {
      pickMediaFile: vi.fn().mockResolvedValue(null),
      getTaskStatus: vi.fn().mockResolvedValue(
        createStatus({
          inputMode: 'system-audio',
          stage: 'idle',
          canStart: true
        })
      ),
      startTask: vi.fn().mockResolvedValue(createStatus()),
      startSystemAudioTask: vi.fn().mockResolvedValue(
        createStatus({
          inputMode: 'system-audio',
          sourceLabel: 'System audio capture',
          stage: 'running',
          isRunning: true,
          canStart: false
        })
      ),
      pushSystemAudioChunk: vi.fn().mockResolvedValue(undefined),
      completeSystemAudioTask: vi.fn().mockResolvedValue(
        createStatus({
          inputMode: 'system-audio',
          sourceLabel: 'System audio capture',
          stage: 'completed',
          isRunning: false,
          canStart: true
        })
      ),
      pauseTask: vi.fn().mockResolvedValue(
        createStatus({
          inputMode: 'system-audio',
          sourceLabel: 'System audio capture',
          stage: 'paused',
          isRunning: false,
          canStart: true
        })
      ),
      resetTask: vi.fn().mockResolvedValue(
        createStatus({
          inputMode: 'system-audio'
        })
      )
    }

    const { useAppStore } = await import('../../src/renderer/src/state/useAppStore')

    await useAppStore.getState().hydrateConfig()
    await useAppStore.getState().start()

    expect(window.pipelineTasks.startSystemAudioTask).toHaveBeenCalledOnce()
    expect(startSystemAudioCaptureMock).toHaveBeenCalledOnce()
    expect(useAppStore.getState().isRunning).toBe(true)
    expect(useAppStore.getState().sourceLabel).toBe('System audio capture')

    await useAppStore.getState().pause()
    expect(stop).toHaveBeenCalledWith('pause')
  })

  it('keeps subtitles empty while idle or after a reset', async () => {
    window.appConfig = {
      load: vi.fn().mockResolvedValue(defaultAppConfig),
      save: vi.fn().mockResolvedValue(defaultAppConfig)
    }
    window.pipelineTasks = {
      pickMediaFile: vi.fn().mockResolvedValue(null),
      getTaskStatus: vi.fn().mockResolvedValue(createStatus()),
      startTask: vi.fn().mockResolvedValue(createStatus()),
      pauseTask: vi.fn().mockResolvedValue(createStatus()),
      resetTask: vi.fn().mockResolvedValue(createStatus())
    }

    const { useAppStore } = await import('../../src/renderer/src/state/useAppStore')

    await useAppStore.getState().hydrateConfig()
    expect(useAppStore.getState().subtitles).toEqual([])

    await useAppStore.getState().reset()
    expect(useAppStore.getState().subtitles).toEqual([])
  })

  it('keeps the real timeline empty before subtitle events arrive even when a file is present', async () => {
    window.appConfig = {
      load: vi.fn().mockResolvedValue(defaultAppConfig),
      save: vi.fn().mockResolvedValue(defaultAppConfig)
    }
    window.pipelineTasks = {
      pickMediaFile: vi.fn().mockResolvedValue(null),
      getTaskStatus: vi.fn().mockResolvedValue(
        createStatus({
          filePath: 'fixtures/demo.wav',
          stage: 'ready',
          isRunning: false,
          canStart: true,
          lastRevisionSummary: 'Real subtitle events have not arrived yet.'
        })
      ),
      startTask: vi.fn().mockResolvedValue(createStatus()),
      pauseTask: vi.fn().mockResolvedValue(createStatus()),
      resetTask: vi.fn().mockResolvedValue(createStatus())
    }

    const { useAppStore } = await import('../../src/renderer/src/state/useAppStore')

    await useAppStore.getState().hydrateConfig()
    expect(useAppStore.getState().timelineMode).toBe('live')
    expect(useAppStore.getState().subtitles).toEqual([])
  })

  it('persists provider configuration changes through the config bridge', async () => {
    const save = vi.fn().mockImplementation(async (config) => config)

    window.appConfig = {
      load: vi.fn().mockResolvedValue(defaultAppConfig),
      save
    }
    window.pipelineTasks = {
      pickMediaFile: vi.fn().mockResolvedValue(null),
      getTaskStatus: vi.fn().mockResolvedValue(createStatus()),
      startTask: vi.fn().mockResolvedValue(createStatus()),
      pauseTask: vi.fn().mockResolvedValue(createStatus()),
      resetTask: vi.fn().mockResolvedValue(createStatus())
    }

    const { useAppStore } = await import('../../src/renderer/src/state/useAppStore')

    const nextConfig = {
      ...defaultAppConfig,
      asr: {
        provider: 'dashscope-realtime' as const,
        baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
        apiKey: 'dashscope-key',
        model: 'qwen3-asr-flash-realtime'
      }
    }

    await useAppStore.getState().saveConfig(nextConfig)

    expect(save).toHaveBeenCalledWith(nextConfig)
    expect(useAppStore.getState().config.asr.provider).toBe('dashscope-realtime')
  })

  it('surfaces a bridge error instead of silently doing nothing when file picking fails', async () => {
    window.appConfig = {
      load: vi.fn().mockResolvedValue(defaultAppConfig),
      save: vi.fn().mockResolvedValue(defaultAppConfig)
    }
    window.pipelineTasks = {
      pickMediaFile: vi.fn().mockRejectedValue(new Error('dialog failed')),
      getTaskStatus: vi.fn().mockResolvedValue(createStatus()),
      startTask: vi.fn().mockResolvedValue(createStatus()),
      pauseTask: vi.fn().mockResolvedValue(createStatus()),
      resetTask: vi.fn().mockResolvedValue(createStatus())
    }

    const { useAppStore } = await import('../../src/renderer/src/state/useAppStore')

    await useAppStore.getState().pick()
    expect(useAppStore.getState().lastRevisionSummary).toBe('File selection failed: dialog failed')
  })

  it('marks the desktop bridge as unavailable instead of silently no-oping outside Electron', async () => {
    window.appConfig = undefined
    window.pipelineTasks = undefined

    const { useAppStore } = await import('../../src/renderer/src/state/useAppStore')

    await useAppStore.getState().pick()
    expect(useAppStore.getState().lastRevisionSummary).toBe(
      'Desktop bridge unavailable. Start the app through Electron.'
    )
  })
})
