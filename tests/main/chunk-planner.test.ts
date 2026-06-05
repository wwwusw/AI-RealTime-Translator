import { describe, expect, it } from 'vitest'
import { planChunks } from '../../src/main/services/chunk-planner'

describe('planChunks', () => {
  it('creates overlapped chunks and caps the last chunk at total duration', () => {
    expect(
      planChunks({
        totalDurationMs: 12_000,
        chunkDurationMs: 5_000,
        chunkOverlapMs: 1_000
      })
    ).toEqual([
      { startMs: 0, endMs: 5_000 },
      { startMs: 4_000, endMs: 9_000 },
      { startMs: 8_000, endMs: 12_000 }
    ])
  })
})
