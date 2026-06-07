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
    expect(useAppStore.getState().subtitleBlocks).toEqual([])

    await useAppStore.getState().start()

    eventListeners[0]?.({
      type: 'subtitle-blocks-updated',
      blocks: [
        {
          id: 'block-0',
          index: 0,
          startMs: 0,
          endMs: 2_000,
          sourceTranscript: 'hello conference',
          liveTranslation: '实时翻译 0',
          refinedTranslation: '',
          status: 'live',
          updatedAt: 0
        }
      ]
    })

    expect(useAppStore.getState().subtitleBlocks).toEqual([
      {
        id: 'block-0',
        index: 0,
        startMs: 0,
        endMs: 2_000,
        sourceTranscript: 'hello conference',
        liveTranslation: '实时翻译 0',
        refinedTranslation: '',
        status: 'live',
        updatedAt: 0
      }
    ])

    eventListeners[0]?.({
      type: 'subtitle-blocks-updated',
      blocks: [
        {
          id: 'block-0',
          index: 0,
          startMs: 0,
          endMs: 2_000,
          sourceTranscript: 'hello conference',
          liveTranslation: '实时翻译 0',
          refinedTranslation: '精翻 0',
          status: 'refined',
          updatedAt: 1
        },
        {
          id: 'block-1',
          index: 1,
          startMs: 2_000,
          endMs: 4_000,
          sourceTranscript: 'next sentence',
          liveTranslation: '实时翻译 1',
          refinedTranslation: '',
          status: 'pending_refine',
          updatedAt: 1
        }
      ]
    })

    expect(useAppStore.getState().subtitleBlocks).toEqual([
      {
        id: 'block-0',
        index: 0,
        startMs: 0,
        endMs: 2_000,
        sourceTranscript: 'hello conference',
        liveTranslation: '实时翻译 0',
        refinedTranslation: '精翻 0',
        status: 'refined',
        updatedAt: 1
      },
      {
        id: 'block-1',
        index: 1,
        startMs: 2_000,
        endMs: 4_000,
        sourceTranscript: 'next sentence',
        liveTranslation: '实时翻译 1',
        refinedTranslation: '',
        status: 'pending_refine',
        updatedAt: 1
      }
    ])
  })

  it('retains older short blocks until the caption reaches its character limit', async () => {
    const eventListeners: Array<(event: PipelineEvent) => void> = []

    window.appConfig = {
      load: vi.fn().mockResolvedValue(defaultAppConfig),
      save: vi.fn().mockResolvedValue(defaultAppConfig)
    }
    window.pipelineTasks = {
      pickMediaFile: vi.fn().mockResolvedValue(null),
      getTaskStatus: vi.fn().mockResolvedValue(
        createStatus({
          inputMode: 'system-audio',
          sourceLabel: 'System audio capture',
          stage: 'running',
          isRunning: true
        })
      ),
      startTask: vi.fn().mockResolvedValue(createStatus()),
      pauseTask: vi.fn().mockResolvedValue(createStatus()),
      resetTask: vi.fn().mockResolvedValue(createStatus()),
      onPipelineEvent: vi.fn((listener: (event: PipelineEvent) => void) => {
        eventListeners.push(listener)
        return () => {}
      })
    }

    const createLiveBlock = (index: number) => ({
      id: `block-${index}`,
      index,
      startMs: index * 2000,
      endMs: (index + 1) * 2000,
      sourceTranscript: `source ${index}`,
      liveTranslation: String(index).repeat(5),
      refinedTranslation: '',
      status: 'live' as const,
      updatedAt: index
    })

    const { useAppStore } = await import('../../src/renderer/src/state/useAppStore')
    await useAppStore.getState().hydrateConfig()

    eventListeners[0]?.({
      type: 'subtitle-blocks-updated',
      blocks: Array.from({ length: 6 }, (_, index) => createLiveBlock(index))
    })
    eventListeners[0]?.({
      type: 'subtitle-blocks-updated',
      blocks: Array.from({ length: 6 }, (_, index) => createLiveBlock(index + 1))
    })

    expect(useAppStore.getState().subtitleBlocks.map((block) => block.id)).toEqual([
      'block-0',
      'block-1',
      'block-2',
      'block-3',
      'block-4',
      'block-5',
      'block-6'
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

    const fileModeConfig = { ...defaultAppConfig, inputMode: 'file' as const }

    window.appConfig = {
      load: vi.fn().mockResolvedValue(fileModeConfig),
      save: vi.fn().mockResolvedValue(fileModeConfig)
    }
    window.pipelineTasks = {
      pickMediaFile,
      getTaskStatus,
      startTask,
      pauseTask,
      resetTask
    }

    const { useAppStore } = await import('../../src/renderer/src/state/useAppStore')

    // Override the default config to file mode for this file-mode test
    useAppStore.setState({ config: fileModeConfig })

    await useAppStore.getState().pick()
    expect(useAppStore.getState().filePath).toBe('fixtures/chunk-0.wav')
    expect(useAppStore.getState().canStart).toBe(true)
    expect(useAppStore.getState().lastRevisionSummary).toBe('Main process says the task is ready.')
    expect(getTaskStatus).toHaveBeenCalledTimes(1)

    await useAppStore.getState().start()
    expect(useAppStore.getState().isRunning).toBe(true)
    expect(useAppStore.getState().canStart).toBe(false)
    expect(useAppStore.getState().stageLabel).toBe('运行中')

    await useAppStore.getState().pause()
    expect(useAppStore.getState().isRunning).toBe(false)
    expect(useAppStore.getState().canStart).toBe(true)
    expect(useAppStore.getState().stageLabel).toBe('已暂停')

    await useAppStore.getState().reset()
    expect(useAppStore.getState().filePath).toBe(null)
    expect(useAppStore.getState().stageLabel).toBe('空闲')
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
    expect(startSystemAudioCaptureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        blockDurationMs: defaultAppConfig.blockDurationMs
      })
    )
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
    expect(useAppStore.getState().subtitleBlocks).toEqual([])

    await useAppStore.getState().reset()
    expect(useAppStore.getState().subtitleBlocks).toEqual([])
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
    expect(useAppStore.getState().subtitleBlocks).toEqual([])
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

  it('resets stale system-audio state when switching back to file mode', async () => {
    const nextConfig = {
      ...defaultAppConfig,
      inputMode: 'file' as const
    }
    const save = vi.fn().mockResolvedValue(nextConfig)
    const resetTask = vi.fn().mockResolvedValue(
      createStatus({
        inputMode: 'file',
        lastRevisionSummary: '任务已重置，请选择文件。'
      })
    )

    window.appConfig = {
      load: vi.fn().mockResolvedValue({
        ...defaultAppConfig,
        inputMode: 'system-audio' as const
      }),
      save
    }
    window.pipelineTasks = {
      pickMediaFile: vi.fn().mockResolvedValue(null),
      getTaskStatus: vi.fn().mockResolvedValue(
        createStatus({
          inputMode: 'system-audio',
          sourceLabel: '系统声音采集',
          stage: 'paused',
          canStart: true
        })
      ),
      startTask: vi.fn().mockResolvedValue(createStatus()),
      pauseTask: vi.fn().mockResolvedValue(createStatus()),
      resetTask
    }

    const { useAppStore } = await import('../../src/renderer/src/state/useAppStore')
    await useAppStore.getState().hydrateConfig()
    useAppStore.setState({
      subtitleBlocks: [
        {
          id: 'stale-block',
          index: 0,
          startMs: 0,
          endMs: 2000,
          sourceTranscript: 'stale',
          liveTranslation: '旧字幕',
          refinedTranslation: '',
          status: 'live',
          updatedAt: 0
        }
      ]
    })

    await useAppStore.getState().saveConfig(nextConfig)

    expect(save).toHaveBeenCalledWith(nextConfig)
    expect(resetTask).toHaveBeenCalledOnce()
    expect(useAppStore.getState().config.inputMode).toBe('file')
    expect(useAppStore.getState().filePath).toBe(null)
    expect(useAppStore.getState().sourceLabel).toBe(null)
    expect(useAppStore.getState().canStart).toBe(false)
    expect(useAppStore.getState().subtitleBlocks).toEqual([])
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
    expect(useAppStore.getState().lastRevisionSummary).toBe('选择文件失败：dialog failed')
  })

  it('marks the desktop bridge as unavailable instead of silently no-oping outside Electron', async () => {
    window.appConfig = undefined
    window.pipelineTasks = undefined

    const { useAppStore } = await import('../../src/renderer/src/state/useAppStore')

    await useAppStore.getState().pick()
    expect(useAppStore.getState().lastRevisionSummary).toBe(
      '桌面桥接不可用，请通过 Electron 启动应用。'
    )
  })
})
