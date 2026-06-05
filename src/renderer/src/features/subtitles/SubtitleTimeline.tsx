import type { TimelineSubtitle } from '../../state/useAppStore'

type SubtitleTimelineProps = {
  subtitles: TimelineSubtitle[]
}

const formatTimestamp = (timeMs: number): string => {
  const totalSeconds = Math.floor(timeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function SubtitleTimeline({ subtitles }: SubtitleTimelineProps) {
  return (
    <section className="timeline-card" aria-label="Subtitle timeline">
      <div className="timeline-header">
        <div>
          <p className="eyebrow">Subtitle Timeline</p>
          <h2>字幕时间轴</h2>
        </div>
        <p className="timeline-caption">中文主显示，英文保留为辅助参考。</p>
      </div>
      {subtitles.length === 0 ? (
        <p className="timeline-empty">导入本地媒体后，这里会显示实时字幕时间轴。</p>
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
                {isRevised ? (
                  <p className="timeline-revision">已修订 {line.revisionCount} 次</p>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
