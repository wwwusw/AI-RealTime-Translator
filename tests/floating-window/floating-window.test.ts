import { describe, expect, it } from 'vitest'
import type {
  FloatingWindowState,
  SubtitleBlock,
  PipelineEvent
} from '../../src/shared/pipeline'
import { floatingWindowChannels } from '../../src/shared/events'
import { applyPipelineEventToBlocks } from '../../src/renderer/src/state/subtitle-event-handler'

describe('floatingWindowChannels', () => {
  it('defines all expected channel names', () => {
    expect(floatingWindowChannels.open).toBe('floating-window:open')
    expect(floatingWindowChannels.close).toBe('floating-window:close')
    expect(floatingWindowChannels.toggle).toBe('floating-window:toggle')
    expect(floatingWindowChannels.getState).toBe('floating-window:get-state')
    expect(floatingWindowChannels.stateChanged).toBe('floating-window:state-changed')
  })

  it('has unique channel values', () => {
    const values = Object.values(floatingWindowChannels)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe('FloatingWindowState', () => {
  it('shapes the state correctly', () => {
    const state: FloatingWindowState = {
      isOpen: false,
      subtitleBlocks: [],
      lastRevisionSummary: '等待翻译内容…'
    }

    expect(state.isOpen).toBe(false)
    expect(state.subtitleBlocks).toEqual([])
    expect(state.lastRevisionSummary).toBe('等待翻译内容…')
  })

  it('holds subtitle blocks', () => {
    const blocks: SubtitleBlock[] = [
      {
        id: 'block-1',
        index: 0,
        startMs: 0,
        endMs: 2000,
        sourceTranscript: 'Hello world',
        liveTranslation: '你好世界',
        refinedTranslation: '你好世界',
        status: 'refined',
        updatedAt: Date.now()
      }
    ]

    const state: FloatingWindowState = {
      isOpen: true,
      subtitleBlocks: blocks,
      lastRevisionSummary: '正在实时翻译…'
    }

    expect(state.subtitleBlocks).toHaveLength(1)
    expect(state.subtitleBlocks[0].sourceTranscript).toBe('Hello world')
  })
})

describe('applyPipelineEventToBlocks', () => {
  const makeBlock = (id: string, overrides?: Partial<SubtitleBlock>): SubtitleBlock => ({
    id,
    index: 0,
    startMs: 0,
    endMs: 2000,
    sourceTranscript: 'test',
    liveTranslation: '测试',
    refinedTranslation: '',
    status: 'live',
    updatedAt: Date.now(),
    ...overrides
  })

  it('adds new blocks from subtitle-blocks-updated event', () => {
    const existing: SubtitleBlock[] = []
    const incoming: SubtitleBlock[] = [makeBlock('a'), makeBlock('b')]

    const event: PipelineEvent = {
      type: 'subtitle-blocks-updated',
      blocks: incoming
    }

    const result = applyPipelineEventToBlocks(existing, event)
    expect(result).toHaveLength(2)
  })

  it('merges blocks by ID for subtitle-blocks-updated', () => {
    const existing: SubtitleBlock[] = [makeBlock('a', { liveTranslation: '旧' })]
    const incoming: SubtitleBlock[] = [makeBlock('a', { liveTranslation: '新' })]

    const event: PipelineEvent = {
      type: 'subtitle-blocks-updated',
      blocks: incoming
    }

    const result = applyPipelineEventToBlocks(existing, event)
    expect(result).toHaveLength(1)
    expect(result[0].liveTranslation).toBe('新')
  })

  it('keeps existing blocks not present in incoming', () => {
    const existing: SubtitleBlock[] = [makeBlock('a'), makeBlock('b')]
    const incoming: SubtitleBlock[] = [makeBlock('a', { liveTranslation: 'updated' })]

    const event: PipelineEvent = {
      type: 'subtitle-blocks-updated',
      blocks: incoming
    }

    const result = applyPipelineEventToBlocks(existing, event)
    // mergeCaptionBlocksKeepAll upserts by ID and sorts by index
    expect(result).toHaveLength(2)
  })

  it('handles subtitle-added event (legacy pipeline)', () => {
    const existing: SubtitleBlock[] = []

    const event: PipelineEvent = {
      type: 'subtitle-added',
      chunk: { index: 0, startMs: 0, endMs: 2000, filePath: '/test.wav' },
      subtitle: {
        id: 'sub-1',
        english: 'Hello',
        chinese: '你好',
        status: 'draft',
        revisionCount: 0,
        updatedAt: Date.now()
      }
    }

    const result = applyPipelineEventToBlocks(existing, event)
    expect(result).toHaveLength(1)
    expect(result[0].sourceTranscript).toBe('Hello')
    expect(result[0].status).toBe('pending_refine')
  })

  it('handles subtitle-revised event (legacy pipeline)', () => {
    const existing: SubtitleBlock[] = [
      makeBlock('sub-1', {
        sourceTranscript: 'old',
        liveTranslation: '旧',
        status: 'pending_refine'
      })
    ]

    const event: PipelineEvent = {
      type: 'subtitle-revised',
      subtitle: {
        id: 'sub-1',
        english: 'revised',
        chinese: '修订',
        status: 'final',
        revisionCount: 1,
        updatedAt: Date.now()
      }
    }

    const result = applyPipelineEventToBlocks(existing, event)
    expect(result).toHaveLength(1)
    expect(result[0].sourceTranscript).toBe('revised')
    expect(result[0].status).toBe('refined')
  })

  it('returns unchanged blocks for pipeline-completed', () => {
    const existing: SubtitleBlock[] = [makeBlock('a')]

    const event: PipelineEvent = {
      type: 'pipeline-completed',
      subtitles: []
    }

    const result = applyPipelineEventToBlocks(existing, event)
    expect(result).toBe(existing)
  })

  it('merges large block sets without data loss via subtitle-blocks-updated', () => {
    // subtitle-blocks-updated uses mergeCaptionBlocksKeepAll which upserts
    // without a hard trim — the server is responsible for limiting blocks.
    const existing: SubtitleBlock[] = Array.from({ length: 50 }, (_, i) =>
      makeBlock(`block-${i}`)
    )

    const incoming: SubtitleBlock[] = [makeBlock('new-block')]

    const event: PipelineEvent = {
      type: 'subtitle-blocks-updated',
      blocks: incoming
    }

    const result = applyPipelineEventToBlocks(existing, event)
    // New block is added, existing blocks are kept
    expect(result).toHaveLength(51)
    expect(result.some((b) => b.id === 'new-block')).toBe(true)
  })
})
