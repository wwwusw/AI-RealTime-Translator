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
  it('renders translated blocks as one continuous caption string', () => {
    const html = renderToStaticMarkup(
      createElement(SubtitleTimeline, {
        subtitleBlocks: demoBlocks,
        timelineMode: 'live'
      })
    )

    expect(html).toContain('欢迎回来。模型正在润色这句话。字幕仍在实时增长。')
    expect(html).toContain('aria-label="实时翻译字幕"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('aria-atomic="true"')
    expect(html).toContain('class="live-caption-text"')
    expect(html).not.toContain('<ol')
    expect(html).not.toContain('<li')
    expect(html).not.toContain('Refined')
    expect(html).not.toContain('Pending')
    expect(html).not.toContain('Welcome back.')
    expect(html).not.toContain('00:00')
  })

  it('renders an empty caption surface without waiting text', () => {
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

    expect(html).toContain('class="live-caption-text"')
    expect(html).not.toContain('Waiting')
    expect(html).not.toContain('Listening')
  })

  it('silently displays refined text in place of live text', () => {
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
})
