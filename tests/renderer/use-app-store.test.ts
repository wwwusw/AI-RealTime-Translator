import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAppConfig } from '../../src/shared/config'
import type { PipelineTaskStatus } from '../../src/shared/pipeline'

const createStatus = (overrides: Partial<PipelineTaskStatus> = {}): PipelineTaskStatus => ({
  filePath: null,
  stage: 'idle',
  isRunning: false,
  canStart: false,
  lastRevisionSummary: 'No task has run yet.',
  ...overrides
})

describe('useAppStore task controls', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('tracks pick, start, pause, and reset through the task bridge', async () => {
    const pickMediaFile = vi.fn().mockResolvedValue({ filePath: 'fixtures/chunk-0.wav' })
    const getTaskStatus = vi.fn().mockResolvedValue(createStatus())
    const startTask = vi
      .fn()
      .mockResolvedValue(
        createStatus({
          filePath: 'fixtures/chunk-0.wav',
          stage: 'running',
          isRunning: true,
          canStart: false,
          lastRevisionSummary: 'Task controls wired. Pipeline execution is still minimal.'
        })
      )
    const pauseTask = vi
      .fn()
      .mockResolvedValue(
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
})
