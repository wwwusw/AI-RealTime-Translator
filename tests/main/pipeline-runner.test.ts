import { describe, expect, it } from 'vitest'
import { runPipeline } from '../../src/main/services/pipeline-runner'
import { createScriptedAsrProvider } from '../../src/main/services/providers/scripted-asr-provider'
import type { PipelineEvent } from '../../src/shared/pipeline'

describe('runPipeline', () => {
  it('emits draft and revised subtitle events before completing', async () => {
    const events: PipelineEvent[] = []
    const chunks = [
      { index: 0, startMs: 0, endMs: 5_000, filePath: 'chunk-0.wav' },
      { index: 1, startMs: 4_000, endMs: 9_000, filePath: 'chunk-1.wav' }
    ]

    const asrProvider = createScriptedAsrProvider({
      getEnglishByChunkIndex: async (chunkIndex) => `english line ${chunkIndex + 1}`
    })

    const translationProvider = {
      translateBatch: async (englishLines: string[]) =>
        englishLines.map((english) => `中文 ${english}`),
      reviseBatch: async (englishLines: string[]) =>
        englishLines.map((english) => `修订 ${english}`)
    }

    await runPipeline({
      chunks,
      asrProvider,
      translationProvider,
      emitEvent: (event) => {
        events.push(event)
      }
    })

    expect(events.some((event) => event.type === 'subtitle-added')).toBe(true)
    expect(events.some((event) => event.type === 'subtitle-revised')).toBe(true)
    expect(events.at(-1)?.type).toBe('pipeline-completed')
  })
})
