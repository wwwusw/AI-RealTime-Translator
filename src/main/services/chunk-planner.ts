import type { ChunkPlanningInput, PlannedChunk } from '../../shared/pipeline'

export const planChunks = ({
  totalDurationMs,
  chunkDurationMs,
  chunkOverlapMs
}: ChunkPlanningInput): PlannedChunk[] => {
  if (totalDurationMs <= 0) {
    return []
  }

  const stepMs = chunkDurationMs - chunkOverlapMs

  if (chunkDurationMs <= 0 || stepMs <= 0) {
    throw new Error('chunkDurationMs must be greater than chunkOverlapMs')
  }

  const chunks: PlannedChunk[] = []

  for (let startMs = 0; startMs < totalDurationMs; startMs += stepMs) {
    chunks.push({
      startMs,
      endMs: Math.min(startMs + chunkDurationMs, totalDurationMs)
    })
  }

  return chunks
}
