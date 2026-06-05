import { create } from 'zustand'
import type { AppConfigBridge } from '../../../shared/app-config-bridge'
import { defaultAppConfig, type AppConfig } from '../../../shared/config'
import type { PipelineTaskStage, PipelineTaskStatus, PipelineTasksBridge } from '../../../shared/pipeline'
import type { SubtitleStatus } from '../../../shared/subtitles'

export type TimelineSubtitle = {
  id: string
  startMs: number
  endMs: number
  english: string
  chinese: string
  status: SubtitleStatus
  revisionCount: number
}

type AppStoreTaskState = {
  filePath: string | null
  stage: PipelineTaskStage
  stageLabel: string
  isRunning: boolean
  canStart: boolean
  lastRevisionSummary: string
  subtitles: TimelineSubtitle[]
}

type AppStore = {
  config: AppConfig
  filePath: string | null
  stage: PipelineTaskStage
  stageLabel: string
  isRunning: boolean
  canStart: boolean
  lastRevisionSummary: string
  subtitles: TimelineSubtitle[]
  hydrateConfig: () => Promise<void>
  saveConfig: (config: AppConfig) => Promise<void>
  pick: () => Promise<void>
  start: () => Promise<void>
  pause: () => Promise<void>
  reset: () => Promise<void>
}

const getAppConfigBridge = (): AppConfigBridge | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.appConfig
}

const getPipelineTasksBridge = (): PipelineTasksBridge | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.pipelineTasks
}

const getStageLabel = (stage: PipelineTaskStage): string => {
  switch (stage) {
    case 'ready':
      return 'Ready'
    case 'running':
      return 'Running'
    case 'paused':
      return 'Paused'
    case 'completed':
      return 'Completed'
    case 'idle':
    default:
      return 'Idle'
  }
}

const createDemoSubtitles = (status?: PipelineTaskStatus): TimelineSubtitle[] => {
  const stage = status?.stage ?? 'idle'

  const firstLineFinal = stage === 'running' || stage === 'paused' || stage === 'completed'
  const allStable = stage === 'completed'

  return [
    {
      id: 'timeline-1',
      startMs: 0,
      endMs: 3200,
      english: 'We loaded the local recording into the workspace.',
      chinese: '本地录音已经载入工作区。',
      status: firstLineFinal ? 'final' : 'draft',
      revisionCount: 0
    },
    {
      id: 'timeline-2',
      startMs: 3200,
      endMs: 6700,
      english: 'The translation pass revised this line for clarity.',
      chinese: '翻译阶段已经把这一句修订得更清楚。',
      status: allStable ? 'final' : 'draft',
      revisionCount: 2
    },
    {
      id: 'timeline-3',
      startMs: 6700,
      endMs: 9800,
      english: allStable
        ? 'This segment is stable and ready to export.'
        : 'This segment is still waiting for the final confirmation.',
      chinese: allStable ? '这一段已经稳定，可以进入导出。' : '这一段还在等待最终确认。',
      status: allStable ? 'final' : 'draft',
      revisionCount: allStable ? 1 : 0
    }
  ]
}

const createTaskState = (status?: PipelineTaskStatus): AppStoreTaskState => ({
  filePath: status?.filePath ?? null,
  stage: status?.stage ?? 'idle',
  stageLabel: getStageLabel(status?.stage ?? 'idle'),
  isRunning: status?.isRunning ?? false,
  canStart: status?.canStart ?? false,
  lastRevisionSummary: status?.lastRevisionSummary ?? 'No task has run yet.',
  subtitles: createDemoSubtitles(status)
})

export const useAppStore = create<AppStore>((set, get) => ({
  config: defaultAppConfig,
  ...createTaskState(),
  hydrateConfig: async () => {
    const appConfigBridge = getAppConfigBridge()
    const pipelineTasksBridge = getPipelineTasksBridge()

    if (!appConfigBridge) {
      return
    }

    const config = await appConfigBridge.load()
    const taskStatus = pipelineTasksBridge
      ? await pipelineTasksBridge.getTaskStatus()
      : undefined
    set({
      config,
      ...createTaskState(taskStatus)
    })
  },
  saveConfig: async (config) => {
    const bridge = getAppConfigBridge()
    if (!bridge) {
      set({ config })
      return
    }

    const next = await bridge.save(config)
    set({ config: next })
  },
  pick: async () => {
    const bridge = getPipelineTasksBridge()
    if (!bridge) {
      return
    }

    const file = await bridge.pickMediaFile()

    if (!file) {
      return
    }

    const status = await bridge.getTaskStatus()
    set({
      ...createTaskState(status)
    })
  },
  start: async () => {
    const bridge = getPipelineTasksBridge()
    if (!bridge) {
      return
    }

    const status = await bridge.startTask(get().filePath)
    set({
      ...createTaskState(status)
    })
  },
  pause: async () => {
    const bridge = getPipelineTasksBridge()
    if (!bridge) {
      return
    }

    const status = await bridge.pauseTask()
    set({
      ...createTaskState(status)
    })
  },
  reset: async () => {
    const bridge = getPipelineTasksBridge()
    if (!bridge) {
      set({
        ...createTaskState()
      })
      return
    }

    const status = await bridge.resetTask()
    set({
      ...createTaskState(status)
    })
  }
}))
