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

export type TimelineMode = 'empty' | 'mock'

type AppStoreTaskState = {
  filePath: string | null
  stage: PipelineTaskStage
  stageLabel: string
  isRunning: boolean
  canStart: boolean
  lastRevisionSummary: string
  subtitles: TimelineSubtitle[]
  timelineMode: TimelineMode
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
  timelineMode: TimelineMode
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

const createMockSubtitles = (): TimelineSubtitle[] => [
  {
    id: 'timeline-1',
    startMs: 0,
    endMs: 2800,
    english: 'Mock line: the local file is ready for timeline preview.',
    chinese: '演示字幕：本地文件已准备好预览时间轴。',
    status: 'draft',
    revisionCount: 0
  },
  {
    id: 'timeline-2',
    startMs: 2800,
    endMs: 6100,
    english: 'Mock line: this row shows how a revised draft would look.',
    chinese: '演示字幕：这一行用于展示修订中的草稿样式。',
    status: 'draft',
    revisionCount: 1
  },
  {
    id: 'timeline-3',
    startMs: 6100,
    endMs: 8800,
    english: 'Mock line: this row stays stable to preview the final subtitle state.',
    chinese: '演示字幕：这一行保持稳定，用于展示最终字幕状态。',
    status: 'final',
    revisionCount: 0
  }
]

const createTaskState = (status?: PipelineTaskStatus): AppStoreTaskState => {
  const hasFile = Boolean(status?.filePath)
  const subtitles = hasFile ? createMockSubtitles() : []

  return {
    filePath: status?.filePath ?? null,
    stage: status?.stage ?? 'idle',
    stageLabel: getStageLabel(status?.stage ?? 'idle'),
    isRunning: status?.isRunning ?? false,
    canStart: status?.canStart ?? false,
    lastRevisionSummary: status?.lastRevisionSummary ?? 'No task has run yet.',
    subtitles,
    timelineMode: hasFile ? 'mock' : 'empty'
  }
}

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
