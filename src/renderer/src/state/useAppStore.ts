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
import {
  startSystemAudioCapture,
  type SystemAudioCaptureHandle,
  type SystemAudioStopMode
} from '../system-audio-capture'

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
  sourceLabel: string | null
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
  sourceLabel: string | null
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
let activeSystemAudioCapture: SystemAudioCaptureHandle | null = null
let pendingCaptureSummary: string | null = null
const bridgeUnavailableSummary = 'Desktop bridge unavailable. Start the app through Electron.'

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

const summarizeError = (error: unknown): string =>
  error instanceof Error ? error.message : 'unknown error'

const createTaskState = (status?: PipelineTaskStatus): AppStoreTaskState => ({
  filePath: status?.filePath ?? null,
  sourceLabel: status?.sourceLabel ?? status?.filePath ?? null,
  stage: status?.stage ?? 'idle',
  stageLabel: getStageLabel(status?.stage ?? 'idle'),
  isRunning: status?.isRunning ?? false,
  canStart: status?.canStart ?? false,
  lastRevisionSummary: status?.lastRevisionSummary ?? 'No task has run yet.',
  timelineMode: status?.sourceLabel || status?.filePath ? 'live' : 'empty'
})

const upsertSubtitle = (
  subtitles: TimelineSubtitle[],
  nextSubtitle: TimelineSubtitle
): TimelineSubtitle[] => {
  const existingIndex = subtitles.findIndex((subtitle) => subtitle.id === nextSubtitle.id)

  if (existingIndex === -1) {
    return [...subtitles, nextSubtitle]
  }

  return subtitles.map((subtitle, index) => (index === existingIndex ? nextSubtitle : subtitle))
}

const applyPipelineEventToSubtitles = (
  subtitles: TimelineSubtitle[],
  event: PipelineEvent
): TimelineSubtitle[] => {
  switch (event.type) {
    case 'subtitle-pending':
    case 'subtitle-added':
      return upsertSubtitle(subtitles, {
        id: event.subtitle.id,
        startMs: event.chunk.startMs,
        endMs: event.chunk.endMs,
        english: event.subtitle.english,
        chinese: event.subtitle.chinese,
        status: event.subtitle.status,
        revisionCount: event.subtitle.revisionCount
      })
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

const getRequiredPipelineBridge = (): PipelineTasksBridge => {
  const bridge = getPipelineTasksBridge()

  if (!bridge) {
    throw new Error(bridgeUnavailableSummary)
  }

  return bridge
}

const stopSystemAudioCapture = async (mode: SystemAudioStopMode) => {
  const capture = activeSystemAudioCapture
  activeSystemAudioCapture = null

  if (!capture) {
    return
  }

  await capture.stop(mode)
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
      subtitles: taskStatus?.sourceLabel || taskStatus?.filePath ? [] : get().subtitles
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
      set({ lastRevisionSummary: bridgeUnavailableSummary })
      return
    }

    try {
      const file = await bridge.pickMediaFile()

      if (!file) {
        set({ lastRevisionSummary: 'File selection was cancelled.' })
        return
      }

      const status = await bridge.getTaskStatus()
      set({
        ...createTaskState(status),
        subtitles: []
      })
    } catch (error) {
      set({
        lastRevisionSummary: `File selection failed: ${summarizeError(error)}`
      })
    }
  },
  start: async () => {
    try {
      const bridge = getRequiredPipelineBridge()

      if (get().config.inputMode === 'system-audio') {
        if (!bridge.startSystemAudioTask || !bridge.pushSystemAudioChunk || !bridge.completeSystemAudioTask) {
          set({ lastRevisionSummary: bridgeUnavailableSummary })
          return
        }

        const status = await bridge.startSystemAudioTask()
        set({
          ...createTaskState(status),
          subtitles: []
        })

        try {
          activeSystemAudioCapture = await startSystemAudioCapture({
            chunkDurationMs: get().config.chunkDurationMs,
            onChunk: async (chunk) => {
              await bridge.pushSystemAudioChunk?.(chunk)
            },
            onStop: async (mode) => {
              activeSystemAudioCapture = null
              const nextStatus =
                mode === 'complete'
                  ? await bridge.completeSystemAudioTask?.()
                  : mode === 'reset'
                    ? await bridge.resetTask()
                    : await bridge.pauseTask()

              if (!nextStatus) {
                return
              }

              set((state) => ({
                ...createTaskState(nextStatus),
                subtitles: mode === 'reset' ? [] : state.subtitles,
                lastRevisionSummary: pendingCaptureSummary ?? nextStatus.lastRevisionSummary
              }))
              pendingCaptureSummary = null
            },
            onError: async (error) => {
              pendingCaptureSummary = `System audio capture failed: ${summarizeError(error)}`
            }
          })
        } catch (error) {
          const resetStatus = await bridge.resetTask()
          set({
            ...createTaskState(resetStatus),
            subtitles: [],
            lastRevisionSummary: `System audio capture failed: ${summarizeError(error)}`
          })
        }

        return
      }

      const status = await bridge.startTask(get().filePath)
      set({
        ...createTaskState(status),
        subtitles: []
      })
    } catch (error) {
      set({
        lastRevisionSummary: `Task start failed: ${summarizeError(error)}`
      })
    }
  },
  pause: async () => {
    try {
      if (activeSystemAudioCapture) {
        await stopSystemAudioCapture('pause')
        return
      }

      const bridge = getRequiredPipelineBridge()
      const status = await bridge.pauseTask()
      set((state) => ({
        ...createTaskState(status),
        subtitles: state.subtitles
      }))
    } catch (error) {
      set({
        lastRevisionSummary: `Task pause failed: ${summarizeError(error)}`
      })
    }
  },
  reset: async () => {
    if (activeSystemAudioCapture) {
      try {
        await stopSystemAudioCapture('reset')
      } catch (error) {
        set({
          lastRevisionSummary: `Task reset failed: ${summarizeError(error)}`
        })
      }
      return
    }

    const bridge = getPipelineTasksBridge()
    if (!bridge) {
      set({
        ...createTaskState(),
        subtitles: [],
        lastRevisionSummary: bridgeUnavailableSummary
      })
      return
    }

    try {
      const status = await bridge.resetTask()
      set({
        ...createTaskState(status),
        subtitles: []
      })
    } catch (error) {
      set({
        lastRevisionSummary: `Task reset failed: ${summarizeError(error)}`
      })
    }
  }
}))
