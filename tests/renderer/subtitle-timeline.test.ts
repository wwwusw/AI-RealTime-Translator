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
    english: 'This sentence is stable now.',
    chinese: '这句字幕已经稳定。',
    status: 'final',
    revisionCount: 1
  }
]

describe('SubtitleTimeline', () => {
  it('renders chinese-first subtitle rows with processing and stable states', () => {
    const html = renderToStaticMarkup(
      createElement(SubtitleTimeline, {
        subtitles: demoSubtitles
      })
    )

    expect(html).toContain('字幕时间轴')
    expect(html).toContain('欢迎回到实时工作台。')
    expect(html).toContain('Welcome back to the live workspace.')
    expect(html).toContain('处理中')
    expect(html).toContain('已稳定')
    expect(html).toContain('timeline-item timeline-item-revised')
  })

  it('shows an empty-state prompt when no subtitles are available', () => {
    const html = renderToStaticMarkup(
      createElement(SubtitleTimeline, {
        subtitles: []
      })
    )

    expect(html).toContain('导入本地媒体后，这里会显示实时字幕时间轴。')
  })
})
