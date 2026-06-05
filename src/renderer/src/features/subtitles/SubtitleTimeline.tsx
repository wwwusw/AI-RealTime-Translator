import type { TimelineMode, TimelineSubtitle } from '../../state/useAppStore'

type SubtitleTimelineProps = {
  subtitles: TimelineSubtitle[]
  timelineMode: TimelineMode
}

const formatTimestamp = (timeMs: number): string => {
  const totalSeconds = Math.floor(timeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function SubtitleTimeline({ subtitles, timelineMode }: SubtitleTimelineProps) {
  const isMock = timelineMode === 'mock'

  return (
    <section className="timeline-card" aria-label="Subtitle timeline">
      <div className="timeline-header">
        <div>
          <p className="eyebrow">Subtitle Timeline</p>
          <h2>字幕时间轴</h2>
        </div>
        <p className="timeline-caption">
          中文主显示，英文保留为辅助参考。
          {isMock ? ' Current view is a mock timeline until the real subtitle event stream is wired.' : ''}
        </p>
      </div>
      {subtitles.length === 0 ? (
        <p className="timeline-empty">Timeline empty state. No subtitle events have arrived yet.</p>
      ) : (
        <ol className="timeline-list">
          {subtitles.map((line) => {
            const stateLabel = line.status === 'final' ? '已稳定' : '处理中'
            const isRevised = line.revisionCount > 0

            return (
              <li
                key={line.id}
                className={`timeline-item${isRevised ? ' timeline-item-revised' : ''}`}
              >
                <div className="timeline-meta">
                  <span className="timeline-time">
                    {formatTimestamp(line.startMs)} - {formatTimestamp(line.endMs)}
                  </span>
                  <span className={`timeline-state timeline-state-${line.status}`}>{stateLabel}</span>
                </div>
                <p className="timeline-chinese">{line.chinese}</p>
                <p className="timeline-english">{line.english}</p>
                {isMock ? <p className="timeline-revision">mock timeline</p> : null}
                {isRevised ? <p className="timeline-revision">Revision count: {line.revisionCount}</p> : null}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
