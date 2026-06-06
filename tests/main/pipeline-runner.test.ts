import { describe, expect, it, vi } from 'vitest'
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
      getEnglishByChunk: async ({ chunkIndex, filePath }) =>
        `english line ${chunkIndex + 1} from ${filePath}`
    })

    const translationProvider = {
      translateBatch: async (
        subtitles: Array<{ id: string; english: string; chinese: string }>
      ) => subtitles.map((subtitle) => ({ id: subtitle.id, chinese: `中文 ${subtitle.english}` })),
      reviseBatch: async (
        subtitles: Array<{ id: string; english: string; chinese: string }>
      ) => subtitles.map((subtitle) => ({ id: subtitle.id, chinese: `修订 ${subtitle.english}` }))
    }

    await runPipeline({
      chunks,
      asrProvider,
      translationProvider,
      emitEvent: (event) => {
        events.push(event)
      }
    })

    const pendingEvent = events.find((event) => event.type === 'subtitle-pending')
    const addedEvent = events.find((event) => event.type === 'subtitle-added')
    const revisedEvent = events.find((event) => event.type === 'subtitle-revised')

    expect(pendingEvent).toBeDefined()
    expect(addedEvent).toBeDefined()
    expect(revisedEvent).toBeDefined()
    expect(revisedEvent).not.toHaveProperty('chunk')
    expect(events.at(-1)?.type).toBe('pipeline-completed')
  })

  it('throws when translateBatch returns results with missing ids', async () => {
    const chunks = [{ index: 0, startMs: 0, endMs: 5_000, filePath: 'chunk-0.wav' }]

    const asrProvider = createScriptedAsrProvider({
      getEnglishByChunk: async ({ chunkIndex }) => `english line ${chunkIndex + 1}`
    })

    const translationProvider = {
      translateBatch: async () => [],
      reviseBatch: async (
        subtitles: Array<{ id: string; english: string; chinese: string }>
      ) => subtitles.map((subtitle) => ({ id: subtitle.id, chinese: `修订 ${subtitle.english}` }))
    }

    await expect(
      runPipeline({
        chunks,
        asrProvider,
        translationProvider,
        emitEvent: () => {}
      })
    ).rejects.toThrow('translateBatch returned mismatched subtitle ids')
  })

  it('forwards an abort signal to ASR and translation provider calls', async () => {
    const signal = new AbortController().signal
    const chunks = [{ index: 0, startMs: 0, endMs: 5_000, filePath: 'chunk-0.wav' }]
    const transcribeChunk = vi.fn().mockResolvedValue('hello world')
    const translateBatch = vi.fn().mockResolvedValue([{ id: 'chunk-0', chinese: '你好，世界' }])
    const reviseBatch = vi.fn().mockResolvedValue([{ id: 'chunk-0', chinese: '你好，世界' }])

    await runPipeline({
      chunks,
      asrProvider: {
        transcribeChunk
      },
      translationProvider: {
        translateBatch,
        reviseBatch
      },
      emitEvent: () => {},
      signal
    })

    expect(transcribeChunk).toHaveBeenCalledWith(
      {
        chunkIndex: 0,
        filePath: 'chunk-0.wav'
      },
      signal
    )
    expect(translateBatch).toHaveBeenCalledWith(
      [{ id: 'chunk-0', english: 'hello world', chinese: '' }],
      signal
    )
    expect(reviseBatch).toHaveBeenCalledWith(
      [{ id: 'chunk-0', english: 'hello world', chinese: '你好，世界' }],
      signal
    )
  })

  it('skips subtitle creation when realtime asr returns an empty transcript', async () => {
    const events: PipelineEvent[] = []
    const translateBatch = vi.fn()
    const reviseBatch = vi.fn()

    const subtitles = await runPipeline({
      chunks: [{ index: 0, startMs: 0, endMs: 5_000, filePath: 'chunk-0.wav' }],
      asrProvider: {
        transcribeChunk: vi.fn().mockResolvedValue('')
      },
      translationProvider: {
        translateBatch,
        reviseBatch
      },
      emitEvent: (event) => {
        events.push(event)
      }
    })

    expect(events.map((event) => event.type)).toEqual(['subtitle-pending', 'pipeline-completed'])
    expect(translateBatch).not.toHaveBeenCalled()
    expect(reviseBatch).not.toHaveBeenCalled()
    expect(subtitles).toEqual([])
  })
})
