import { describe, expect, it } from 'vitest'
import { planChunks } from '../../src/main/services/chunk-planner'

describe('planChunks', () => {
  it('creates indexed overlapped chunks and caps the last chunk at total duration', () => {
    expect(
      planChunks({
        totalDurationMs: 12_000,
        chunkDurationMs: 5_000,
        chunkOverlapMs: 1_000
      })
    ).toEqual([
      { index: 0, startMs: 0, endMs: 5_000 },
      { index: 1, startMs: 4_000, endMs: 9_000 },
      { index: 2, startMs: 8_000, endMs: 12_000 }
    ])
  })

  it('rejects negative overlap', () => {
    expect(() =>
      planChunks({
        totalDurationMs: 12_000,
        chunkDurationMs: 5_000,
        chunkOverlapMs: -1
      })
    ).toThrow('chunkOverlapMs must be finite non-negative numbers')
  })

  it('rejects NaN and Infinity inputs', () => {
    expect(() =>
      planChunks({
        totalDurationMs: Number.NaN,
        chunkDurationMs: 5_000,
        chunkOverlapMs: 1_000
      })
    ).toThrow('totalDurationMs must be finite non-negative numbers')

    expect(() =>
      planChunks({
        totalDurationMs: 12_000,
        chunkDurationMs: Number.POSITIVE_INFINITY,
        chunkOverlapMs: 1_000
      })
    ).toThrow('chunkDurationMs must be finite non-negative numbers')
  })
})
