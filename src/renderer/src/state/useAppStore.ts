import { create } from 'zustand'
import type { AppConfigBridge } from '../../../shared/app-config-bridge'
import { defaultAppConfig, type AppConfig } from '../../../shared/config'
import type {
  PipelineEvent,
  PipelineTaskStage,
  PipelineTaskStatus,
  PipelineTasksBridge
} from '../../../shared/pipeline'
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

export type TimelineMode = 'empty' | 'live'

type AppStoreTaskState = {
  filePath: string | null
  stage: PipelineTaskStage
  stageLabel: string
  isRunning: boolean
  canStart: boolean
  lastRevisionSummary: string
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

let unsubscribeFromPipelineEvents: (() => void) | null = null

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

const createTaskState = (status?: PipelineTaskStatus): AppStoreTaskState => ({
  filePath: status?.filePath ?? null,
  stage: status?.stage ?? 'idle',
  stageLabel: getStageLabel(status?.stage ?? 'idle'),
  isRunning: status?.isRunning ?? false,
  canStart: status?.canStart ?? false,
  lastRevisionSummary: status?.lastRevisionSummary ?? 'No task has run yet.',
  timelineMode: status?.filePath ? 'live' : 'empty'
})

const applyPipelineEventToSubtitles = (
  subtitles: TimelineSubtitle[],
  event: PipelineEvent
): TimelineSubtitle[] => {
  switch (event.type) {
    case 'subtitle-added':
      return [
        ...subtitles,
        {
          id: event.subtitle.id,
          startMs: event.chunk.startMs,
          endMs: event.chunk.endMs,
          english: event.subtitle.english,
          chinese: event.subtitle.chinese,
          status: event.subtitle.status,
          revisionCount: event.subtitle.revisionCount
        }
      ]
    case 'subtitle-revised':
      return subtitles.map((subtitle) =>
        subtitle.id === event.subtitle.id
          ? {
              ...subtitle,
              english: event.subtitle.english,
              chinese: event.subtitle.chinese,
              status: event.subtitle.status,
              revisionCount: event.subtitle.revisionCount
            }
          : subtitle
      )
    case 'pipeline-completed':
    default:
      return subtitles
  }
}

const ensurePipelineSubscription = (
  bridge: PipelineTasksBridge | undefined,
  onEvent: (event: PipelineEvent) => void
) => {
  if (!bridge?.onPipelineEvent || unsubscribeFromPipelineEvents) {
    return
  }

  unsubscribeFromPipelineEvents = bridge.onPipelineEvent(onEvent)
}

export const useAppStore = create<AppStore>((set, get) => ({
  config: defaultAppConfig,
  ...createTaskState(),
  subtitles: [],
  hydrateConfig: async () => {
    const appConfigBridge = getAppConfigBridge()
    const pipelineTasksBridge = getPipelineTasksBridge()

    if (!appConfigBridge) {
      return
    }

    ensurePipelineSubscription(pipelineTasksBridge, (event) => {
      set((state) => ({
        subtitles: applyPipelineEventToSubtitles(state.subtitles, event)
      }))
    })

    const config = await appConfigBridge.load()
    const taskStatus = pipelineTasksBridge
      ? await pipelineTasksBridge.getTaskStatus()
      : undefined

    set({
      config,
      ...createTaskState(taskStatus),
      subtitles: taskStatus?.filePath ? [] : get().subtitles
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
      ...createTaskState(status),
      subtitles: []
    })
  },
  start: async () => {
    const bridge = getPipelineTasksBridge()
    if (!bridge) {
      return
    }

    const status = await bridge.startTask(get().filePath)
    set({
      ...createTaskState(status),
      subtitles: []
    })
  },
  pause: async () => {
    const bridge = getPipelineTasksBridge()
    if (!bridge) {
      return
    }

    const status = await bridge.pauseTask()
    set((state) => ({
      ...createTaskState(status),
      subtitles: state.subtitles
    }))
  },
  reset: async () => {
    const bridge = getPipelineTasksBridge()
    if (!bridge) {
      set({
        ...createTaskState(),
        subtitles: []
      })
      return
    }

    const status = await bridge.resetTask()
    set({
      ...createTaskState(status),
      subtitles: []
    })
  }
}))
