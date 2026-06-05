import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SubtitleTimeline } from '../../src/renderer/src/features/subtitles/SubtitleTimeline'
import type { TimelineSubtitle } from '../../src/renderer/src/state/useAppStore'

const demoSubtitles: TimelineSubtitle[] = [
  {
    id: 'line-1',
    startMs: 0,
    endMs: 2800,
    english: 'Welcome back to the live workspace.',
    chinese: '欢迎回到实时工作台。',
    status: 'draft',
    revisionCount: 0
  },
  {
    id: 'line-2',
    startMs: 2800,
    endMs: 5600,
    english: 'The model revised the phrasing for clarity.',
    chinese: '模型已经把这句修订得更清楚。',
    status: 'draft',
    revisionCount: 2
  },
  {
    id: 'line-3',
    startMs: 5600,
    endMs: 8600,
    english: 'This sentence is already stable in the mock timeline.',
    chinese: '这句字幕在演示时间轴中已经稳定。',
    status: 'final',
    revisionCount: 0
  }
]

describe('SubtitleTimeline', () => {
  it('renders chinese-first subtitle rows with chinese draft and final state labels', () => {
    const html = renderToStaticMarkup(
      createElement(SubtitleTimeline, {
        subtitles: demoSubtitles,
        timelineMode: 'mock'
      })
    )

    expect(html).toContain('mock timeline')
    expect(html).toContain('欢迎回到实时工作台。')
    expect(html).toContain('Welcome back to the live workspace.')
    expect(html).toContain('处理中')
    expect(html).toContain('已稳定')
    expect(html).toContain('timeline-item timeline-item-revised')
  })

  it('shows an empty-state prompt when no subtitles are available', () => {
    const html = renderToStaticMarkup(
      createElement(SubtitleTimeline, {
        subtitles: [],
        timelineMode: 'empty'
      })
    )

    expect(html).toContain('empty state')
    expect(html).toContain('No subtitle events have arrived yet.')
  })
})
