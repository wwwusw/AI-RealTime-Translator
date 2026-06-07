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
    sourceTranscript: 'Welcome back.',
    liveTranslation: '欢迎回来。',
    refinedTranslation: '欢迎回来。',
    status: 'refined',
    updatedAt: 0
  },
  {
    id: 'block-1',
    index: 1,
    startMs: 2_000,
    endMs: 4_000,
    sourceTranscript: 'The model is refining this.',
    liveTranslation: '模型正在润色这句话。',
    refinedTranslation: '',
    status: 'pending_refine',
    updatedAt: 1
  },
  {
    id: 'block-2',
    index: 2,
    startMs: 4_000,
    endMs: 6_000,
    sourceTranscript: 'This block is growing.',
    liveTranslation: '字幕仍在实时增长。',
    refinedTranslation: '',
    status: 'live',
    updatedAt: 2
  }
]

describe('SubtitleTimeline', () => {
  it('renders each translated block as a separate line in a scrollable surface', () => {
    const html = renderToStaticMarkup(
      createElement(SubtitleTimeline, {
        subtitleBlocks: demoBlocks,
        timelineMode: 'live'
      })
    )

    // Each block renders as its own <p> line
    expect(html).toContain('欢迎回来。')
    expect(html).toContain('模型正在润色这句话。')
    expect(html).toContain('字幕仍在实时增长。')
    expect(html).toContain('aria-label="实时翻译字幕"')
    expect(html).toContain('live-caption-line')
    // Scrollable surface class
    expect(html).toContain('live-caption-surface--scrollable')
    // No ordered-list markup
    expect(html).not.toContain('<ol')
    expect(html).not.toContain('<li')
    // English source is never shown
    expect(html).not.toContain('Welcome back.')
  })

  it('renders an empty placeholder when no blocks have translatable content', () => {
    const html = renderToStaticMarkup(
      createElement(SubtitleTimeline, {
        subtitleBlocks: [],
        timelineMode: 'live'
      })
    )

    expect(html).toContain('等待翻译内容')
    expect(html).toContain('live-caption-surface--empty')
    // With zero blocks we show the placeholder, not the scrollable surface
    expect(html).not.toContain('live-caption-surface--scrollable')
  })

  it('prefers refinedTranslation over liveTranslation for each line', () => {
    const html = renderToStaticMarkup(
      createElement(SubtitleTimeline, {
        subtitleBlocks: [
          {
            ...demoBlocks[0],
            liveTranslation: '实时草稿',
            refinedTranslation: '静默精翻'
          }
        ],
        timelineMode: 'live'
      })
    )

    expect(html).toContain('静默精翻')
    expect(html).not.toContain('实时草稿')
  })

  it('renders the empty placeholder when all blocks have empty translations', () => {
    const html = renderToStaticMarkup(
      createElement(SubtitleTimeline, {
        subtitleBlocks: [
          {
            id: 'empty',
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

    // composeCaptionLines filters out empty blocks → 0 lines → empty state
    expect(html).toContain('等待翻译内容')
    expect(html).toContain('live-caption-surface--empty')
  })
})
