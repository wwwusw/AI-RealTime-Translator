import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SubtitleTimeline } from '../../src/renderer/src/features/subtitles/SubtitleTimeline'
import type { TimelineSubtitleBlock } from '../../src/renderer/src/state/useAppStore'

const demoBlocks: TimelineSubtitleBlock[] = [
  {
    id: 'block-0',
    index: 0,
    startMs: 0,
    endMs: 2_000,
    sourceTranscript: 'Welcome back to the live workspace.',
    liveTranslation: '欢迎回到实时工作台。',
    refinedTranslation: '欢迎回到实时工作区。',
    status: 'refined',
    updatedAt: 0
  },
  {
    id: 'block-1',
    index: 1,
    startMs: 2_000,
    endMs: 4_000,
    sourceTranscript: 'The model is still refining this sentence.',
    liveTranslation: '模型还在润色这句话。',
    refinedTranslation: '',
    status: 'pending_refine',
    updatedAt: 1
  },
  {
    id: 'block-2',
    index: 2,
    startMs: 4_000,
    endMs: 6_000,
    sourceTranscript: 'This block is still growing live.',
    liveTranslation: '这一块字幕还在实时增长。',
    refinedTranslation: '',
    status: 'live',
    updatedAt: 2
  }
]

describe('SubtitleTimeline', () => {
  it('renders a single rolling subtitle surface with live, pending, and refined blocks', () => {
    const html = renderToStaticMarkup(
      createElement(SubtitleTimeline, {
        subtitleBlocks: demoBlocks,
        timelineMode: 'live'
      })
    )

    expect(html).toContain('Single-box rolling captions')
    expect(html).toContain('Recent translation blocks stay in one scrolling subtitle surface.')
    expect(html).toContain('欢迎回到实时工作区。')
    expect(html).toContain('模型还在润色这句话。')
    expect(html).toContain('这一块字幕还在实时增长。')
    expect(html).toContain('Refined')
    expect(html).toContain('Pending')
    expect(html).toContain('Live')
  })

  it('shows an empty-state prompt when no subtitle blocks are available', () => {
    const html = renderToStaticMarkup(
      createElement(SubtitleTimeline, {
        subtitleBlocks: [],
        timelineMode: 'empty'
      })
    )

    expect(html).toContain('empty state')
    expect(html).toContain('Start a file run or system audio capture to begin streaming.')
  })

  it('renders live placeholders when a block has not received text yet', () => {
    const html = renderToStaticMarkup(
      createElement(SubtitleTimeline, {
        subtitleBlocks: [
          {
            id: 'live-empty',
            index: 0,
            startMs: 0,
            endMs: 2_000,
            sourceTranscript: '',
            liveTranslation: '',
            refinedTranslation: '',
            status: 'live',
            updatedAt: 0
          }
        ],
        timelineMode: 'live'
      })
    )

    expect(html).toContain('Waiting for live translation...')
    expect(html).toContain('Listening for the next transcript segment...')
  })
})
