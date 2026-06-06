import { create } from 'zustand'
import type { AppConfigBridge } from '../../../shared/app-config-bridge'
import { defaultAppConfig, type AppConfig } from '../../../shared/config'
import type {
  PipelineEvent,
  SubtitleBlock,
  PipelineTaskStage,
  PipelineTaskStatus,
  PipelineTasksBridge
} from '../../../shared/pipeline'
import {
  startSystemAudioCapture,
  type SystemAudioCaptureHandle,
  type SystemAudioStopMode
} from '../system-audio-capture'

export type TimelineSubtitleBlock = SubtitleBlock

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
  subtitleBlocks: TimelineSubtitleBlock[]
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

const trimBlockWindow = (blocks: TimelineSubtitleBlock[]): TimelineSubtitleBlock[] =>
  blocks.slice(-6)

const upsertBlock = (
  blocks: TimelineSubtitleBlock[],
  nextBlock: TimelineSubtitleBlock
): TimelineSubtitleBlock[] => {
  const existingIndex = blocks.findIndex((block) => block.id === nextBlock.id)

  if (existingIndex === -1) {
    return trimBlockWindow([...blocks, nextBlock])
  }

  return trimBlockWindow(blocks.map((block, index) => (index === existingIndex ? nextBlock : block)))
}

const applyPipelineEventToBlocks = (
  blocks: TimelineSubtitleBlock[],
  event: PipelineEvent
): TimelineSubtitleBlock[] => {
  switch (event.type) {
    case 'subtitle-blocks-updated':
      return trimBlockWindow(event.blocks)
    case 'subtitle-pending':
    case 'subtitle-added':
      return upsertBlock(blocks, {
        id: event.subtitle.id,
        index: event.chunk.index,
        startMs: event.chunk.startMs,
        endMs: event.chunk.endMs,
        sourceTranscript: event.subtitle.english,
        liveTranslation: event.subtitle.chinese,
        refinedTranslation: event.subtitle.status === 'final' ? event.subtitle.chinese : '',
        status: event.subtitle.status === 'final' ? 'refined' : 'pending_refine',
        updatedAt: event.subtitle.updatedAt
      })
    case 'subtitle-revised':
      return trimBlockWindow(
        blocks.map((block) =>
          block.id === event.subtitle.id
          ? {
              ...block,
              sourceTranscript: event.subtitle.english,
              liveTranslation: event.subtitle.chinese,
              refinedTranslation: event.subtitle.chinese,
              status: 'refined',
              updatedAt: event.subtitle.updatedAt
            }
          : block
        )
      )
    case 'pipeline-completed':
    default:
      return blocks
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
  subtitleBlocks: [],
  hydrateConfig: async () => {
    const appConfigBridge = getAppConfigBridge()
    const pipelineTasksBridge = getPipelineTasksBridge()

    if (!appConfigBridge) {
      return
    }

    ensurePipelineSubscription(pipelineTasksBridge, (event) => {
      set((state) => ({
        subtitleBlocks: applyPipelineEventToBlocks(state.subtitleBlocks, event)
      }))
    })

    const config = await appConfigBridge.load()
    const taskStatus = pipelineTasksBridge
      ? await pipelineTasksBridge.getTaskStatus()
      : undefined

    set({
      config,
      ...createTaskState(taskStatus),
      subtitleBlocks: taskStatus?.sourceLabel || taskStatus?.filePath ? [] : get().subtitleBlocks
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
        subtitleBlocks: []
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
          subtitleBlocks: []
        })

        try {
          activeSystemAudioCapture = await startSystemAudioCapture({
            blockDurationMs: get().config.blockDurationMs,
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
                subtitleBlocks: mode === 'reset' ? [] : state.subtitleBlocks,
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
            subtitleBlocks: [],
            lastRevisionSummary: `System audio capture failed: ${summarizeError(error)}`
          })
        }

        return
      }

      const status = await bridge.startTask(get().filePath)
      set({
        ...createTaskState(status),
        subtitleBlocks: []
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
        subtitleBlocks: state.subtitleBlocks
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
        subtitleBlocks: [],
        lastRevisionSummary: bridgeUnavailableSummary
      })
      return
    }

    try {
      const status = await bridge.resetTask()
      set({
        ...createTaskState(status),
        subtitleBlocks: []
      })
    } catch (error) {
      set({
        lastRevisionSummary: `Task reset failed: ${summarizeError(error)}`
      })
    }
  }
}))
