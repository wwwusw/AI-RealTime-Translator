import type { SubtitleLine } from './subtitles'

export const pipelineTaskChannels = {
  pickMediaFile: 'pipeline:pick-media-file',
  getTaskStatus: 'pipeline:get-task-status',
  startTask: 'pipeline:start-task',
  startSystemAudioTask: 'pipeline:start-system-audio-task',
  pushSystemAudioChunk: 'pipeline:push-system-audio-chunk',
  completeSystemAudioTask: 'pipeline:complete-system-audio-task',
  pauseTask: 'pipeline:pause-task',
  resetTask: 'pipeline:reset-task',
  pipelineEvent: 'pipeline:event'
} as const

export type ImportedMediaFile = {
  filePath: string
}

export type PipelineTaskStage = 'idle' | 'ready' | 'running' | 'paused' | 'completed'

export type PipelineInputMode = 'file' | 'system-audio'

export type PipelineTaskStatus = {
  filePath: string | null
  inputMode: PipelineInputMode
  sourceLabel: string | null
  stage: PipelineTaskStage
  isRunning: boolean
  canStart: boolean
  lastRevisionSummary: string
}

export type SystemAudioChunkPayload = {
  bytes: Uint8Array
  durationMs: number
  mimeType: string
}

export type PipelineTasksBridge = {
  pickMediaFile: () => Promise<ImportedMediaFile | null>
  getTaskStatus: () => Promise<PipelineTaskStatus>
  startTask: (filePath: string | null) => Promise<PipelineTaskStatus>
  startSystemAudioTask?: () => Promise<PipelineTaskStatus>
  pushSystemAudioChunk?: (chunk: SystemAudioChunkPayload) => Promise<void>
  completeSystemAudioTask?: () => Promise<PipelineTaskStatus>
  pauseTask: () => Promise<PipelineTaskStatus>
  resetTask: () => Promise<PipelineTaskStatus>
  onPipelineEvent?: (listener: (event: PipelineEvent) => void) => () => void
}

export type PlannedChunk = {
  index: number
  startMs: number
  endMs: number
  filePath?: string
}

export type ChunkPlanningInput = {
  totalDurationMs: number
  chunkDurationMs: number
  chunkOverlapMs: number
}

export type PipelineSubtitleAddedEvent = {
  type: 'subtitle-added'
  chunk: PlannedChunk
  subtitle: SubtitleLine
}

export type PipelineSubtitlePendingEvent = {
  type: 'subtitle-pending'
  chunk: PlannedChunk
  subtitle: SubtitleLine
}

export type PipelineSubtitleRevisedEvent = {
  type: 'subtitle-revised'
  subtitle: SubtitleLine
}

export type PipelineCompletedEvent = {
  type: 'pipeline-completed'
  subtitles: SubtitleLine[]
}

export type PipelineEvent =
  | PipelineSubtitlePendingEvent
  | PipelineSubtitleAddedEvent
  | PipelineSubtitleRevisedEvent
  | PipelineCompletedEvent
