import type { ChunkPlanningInput, PlannedChunk } from '../../shared/pipeline'

const validateNonNegativeFiniteNumber = (value: number, fieldName: string) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be finite non-negative numbers`)
  }
}

export const planChunks = ({
  totalDurationMs,
  chunkDurationMs,
  chunkOverlapMs
}: ChunkPlanningInput): PlannedChunk[] => {
  validateNonNegativeFiniteNumber(totalDurationMs, 'totalDurationMs')
  validateNonNegativeFiniteNumber(chunkDurationMs, 'chunkDurationMs')
  validateNonNegativeFiniteNumber(chunkOverlapMs, 'chunkOverlapMs')

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
      index: chunks.length,
      startMs,
      endMs: Math.min(startMs + chunkDurationMs, totalDurationMs)
    })
  }

  return chunks
}
