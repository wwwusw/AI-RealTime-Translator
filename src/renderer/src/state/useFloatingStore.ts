import { create } from 'zustand'
import type { PipelineTasksBridge, SubtitleBlock } from '../../../shared/pipeline'
import { applyPipelineEventToBlocks } from './subtitle-event-handler'

export type TimelineSubtitleBlock = SubtitleBlock

export type TimelineMode = 'empty' | 'live'

type FloatingStore = {
  subtitleBlocks: TimelineSubtitleBlock[]
  timelineMode: TimelineMode
  lastRevisionSummary: string
  hydrate: () => Promise<void>
}

const getPipelineTasksBridge = (): PipelineTasksBridge | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.pipelineTasks
}

const getFloatingWindowBridge = () => {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.floatingWindow
}

export const useFloatingStore = create<FloatingStore>((set) => ({
  subtitleBlocks: [],
  timelineMode: 'empty',
  lastRevisionSummary: '等待翻译内容…',

  hydrate: async () => {
    // 1. Get initial state from the main process (cached blocks + status)
    const fwBridge = getFloatingWindowBridge()
    if (fwBridge) {
      try {
        const state = await fwBridge.getState()
        set({
          subtitleBlocks: state.subtitleBlocks,
          timelineMode:
            state.subtitleBlocks.length > 0 ? 'live' : 'empty',
          lastRevisionSummary: state.lastRevisionSummary
        })
      } catch {
        // Floating window bridge unavailable — continue with empty state
      }
    }

    // 2. Subscribe to pipeline events for real-time updates
    const pipelineBridge = getPipelineTasksBridge()
    if (pipelineBridge?.onPipelineEvent) {
      pipelineBridge.onPipelineEvent((event) => {
        set((current) => {
          const nextBlocks = applyPipelineEventToBlocks(
            current.subtitleBlocks,
            event
          )

          const timelineMode =
            nextBlocks.length > 0 ? 'live' : ('empty' as TimelineMode)

          return {
            subtitleBlocks: nextBlocks,
            timelineMode
          }
        })
      })
    }
  }
}))
