import { describe, expect, it, vi } from 'vitest'
import type { PipelineEvent } from '../../src/shared/pipeline'
import type {
  LiveTranslateSession,
  LiveTranslateStreamEvent
} from '../../src/shared/providers'
import { createSystemAudioPipelineSession } from '../../src/main/services/system-audio-session'

const emitItem = (
  onEvent: ((event: LiveTranslateStreamEvent) => void) | undefined,
  itemId: string,
  sourceText: string,
  translationText: string
) => {
  onEvent?.({
    type: 'source-final',
    itemId,
    fullText: sourceText,
    deltaText: sourceText
  })
  onEvent?.({
    type: 'translation-final',
    itemId,
    fullText: translationText,
    deltaText: translationText
  })
}

describe('createSystemAudioPipelineSession', () => {
  it('keeps a six-block live window and refines two pending blocks at a time', async () => {
    const emittedEvents: PipelineEvent[] = []
    let onLiveTranslateEvent: ((event: LiveTranslateStreamEvent) => void) | undefined

    const liveTranslateSession: LiveTranslateSession = {
      appendAudioChunk: vi.fn().mockResolvedValue(undefined),
      finish: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined)
    }

    const refinementProvider = {
      refineBlocks: vi.fn().mockResolvedValue([
        { id: 'block-0', translatedText: '精翻 0' },
        { id: 'block-1', translatedText: '精翻 1' }
      ])
    }

    const session = await createSystemAudioPipelineSession({
      liveTranslateProvider: {
        startSession: vi.fn().mockImplementation(async ({ onEvent }) => {
          onLiveTranslateEvent = onEvent
          return liveTranslateSession
        })
      },
      refinementProvider,
      blockDurationMs: 2000,
      targetLanguage: 'zh',
      emitEvent: (event) => {
        emittedEvents.push(event)
      }
    })

    await session.appendChunk({
      bytes: new Uint8Array([1, 2]),
      durationMs: 2000,
      mimeType: 'audio/pcm'
    })
    emitItem(onLiveTranslateEvent, 'item-0', 'source 0', 'live 0')

    await session.appendChunk({
      bytes: new Uint8Array([3, 4]),
      durationMs: 2000,
      mimeType: 'audio/pcm'
    })
    emitItem(onLiveTranslateEvent, 'item-1', 'source 1', 'live 1')

    await session.appendChunk({
      bytes: new Uint8Array([5, 6]),
      durationMs: 2000,
      mimeType: 'audio/pcm'
    })
    emitItem(onLiveTranslateEvent, 'item-2', 'source 2', 'live 2')

    await session.appendChunk({
      bytes: new Uint8Array([7, 8]),
      durationMs: 2000,
      mimeType: 'audio/pcm'
    })
    emitItem(onLiveTranslateEvent, 'item-3', 'source 3', 'live 3')

    expect(refinementProvider.refineBlocks).toHaveBeenCalledWith(
      {
        refinedContextBlocks: [],
        pendingBlocks: [
          {
            id: 'block-0',
            sourceTranscript: 'source 0',
            liveTranslation: 'live 0',
            refinedTranslation: ''
          },
          {
            id: 'block-1',
            sourceTranscript: 'source 1',
            liveTranslation: 'live 1',
            refinedTranslation: ''
          }
        ]
      },
      undefined
    )

    const latestBlocksEvent = emittedEvents.at(-1)
    expect(latestBlocksEvent).toMatchObject({
      type: 'subtitle-blocks-updated'
    })

    if (!latestBlocksEvent || latestBlocksEvent.type !== 'subtitle-blocks-updated') {
      throw new Error('expected subtitle-blocks-updated event')
    }

    expect(latestBlocksEvent.blocks).toEqual([
      expect.objectContaining({
        id: 'block-0',
        sourceTranscript: 'source 0',
        liveTranslation: 'live 0',
        refinedTranslation: '精翻 0',
        status: 'refined'
      }),
      expect.objectContaining({
        id: 'block-1',
        sourceTranscript: 'source 1',
        liveTranslation: 'live 1',
        refinedTranslation: '精翻 1',
        status: 'refined'
      }),
      expect.objectContaining({
        id: 'block-2',
        sourceTranscript: 'source 2',
        liveTranslation: 'live 2',
        status: 'live'
      }),
      expect.objectContaining({
        id: 'block-3',
        sourceTranscript: 'source 3',
        liveTranslation: 'live 3',
        status: 'live'
      })
    ])
  })

  it('keeps accepting later audio chunks while refinement is still in flight', async () => {
    let onLiveTranslateEvent: ((event: LiveTranslateStreamEvent) => void) | undefined
    let releaseRefinement: (() => void) | null = null

    const liveTranslateSession: LiveTranslateSession = {
      appendAudioChunk: vi.fn().mockResolvedValue(undefined),
      finish: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined)
    }

    const refinementProvider = {
      refineBlocks: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            releaseRefinement = () => {
              resolve([
                { id: 'block-0', translatedText: '精翻 0' },
                { id: 'block-1', translatedText: '精翻 1' }
              ])
            }
          })
      )
    }

    const session = await createSystemAudioPipelineSession({
      liveTranslateProvider: {
        startSession: vi.fn().mockImplementation(async ({ onEvent }) => {
          onLiveTranslateEvent = onEvent
          return liveTranslateSession
        })
      },
      refinementProvider,
      blockDurationMs: 2000,
      targetLanguage: 'zh',
      emitEvent: vi.fn()
    })

    await session.appendChunk({
      bytes: new Uint8Array([1]),
      durationMs: 2000,
      mimeType: 'audio/pcm'
    })
    emitItem(onLiveTranslateEvent, 'item-0', 'source 0', 'live 0')

    await session.appendChunk({
      bytes: new Uint8Array([2]),
      durationMs: 2000,
      mimeType: 'audio/pcm'
    })
    emitItem(onLiveTranslateEvent, 'item-1', 'source 1', 'live 1')

    await session.appendChunk({
      bytes: new Uint8Array([3]),
      durationMs: 2000,
      mimeType: 'audio/pcm'
    })
    emitItem(onLiveTranslateEvent, 'item-2', 'source 2', 'live 2')

    const fourthChunkPromise = session.appendChunk({
      bytes: new Uint8Array([4]),
      durationMs: 2000,
      mimeType: 'audio/pcm'
    })

    await fourthChunkPromise
    emitItem(onLiveTranslateEvent, 'item-3', 'source 3', 'live 3')

    await session.appendChunk({
      bytes: new Uint8Array([5]),
      durationMs: 2000,
      mimeType: 'audio/pcm'
    })

    expect(liveTranslateSession.appendAudioChunk).toHaveBeenCalledTimes(5)
    expect(refinementProvider.refineBlocks).toHaveBeenCalledTimes(1)

    releaseRefinement?.()
  })
})
