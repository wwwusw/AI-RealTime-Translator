import { useEffect, useRef } from 'react'
import type { TimelineMode, TimelineSubtitleBlock } from '../../state/useAppStore'

type SubtitleTimelineProps = {
  subtitleBlocks: TimelineSubtitleBlock[]
  timelineMode: TimelineMode
}

const formatTimestamp = (timeMs: number): string => {
  const totalSeconds = Math.floor(timeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const getDisplayTranslation = (block: TimelineSubtitleBlock): string =>
  block.refinedTranslation || block.liveTranslation || 'Waiting for live translation...'

const getDisplayTranscript = (block: TimelineSubtitleBlock): string =>
  block.sourceTranscript || 'Listening for the next transcript segment...'

const getStateLabel = (status: TimelineSubtitleBlock['status']): string => {
  switch (status) {
    case 'refined':
      return 'Refined'
    case 'pending_refine':
      return 'Pending'
    case 'live':
    default:
      return 'Live'
  }
}

export function SubtitleTimeline({ subtitleBlocks, timelineMode }: SubtitleTimelineProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const scroller = scrollerRef.current

    if (!scroller) {
      return
    }

    scroller.scrollTop = scroller.scrollHeight
  }, [subtitleBlocks])

  return (
    <section className="timeline-card subtitle-window-card" aria-label="Subtitle timeline">
      <div className="timeline-header">
        <div>
          <p className="eyebrow">Realtime Subtitle Window</p>
          <h2>Single-box rolling captions</h2>
        </div>
        <p className="timeline-caption">
          Recent translation blocks stay in one scrolling subtitle surface.
          {timelineMode === 'live' ? ' The newest block keeps growing in place.' : ''}
        </p>
      </div>
      {subtitleBlocks.length === 0 ? (
        <p className="timeline-empty">
          Subtitle window empty state. Start a file run or system audio capture to begin streaming.
        </p>
      ) : (
        <div ref={scrollerRef} className="subtitle-window-scroller">
          <ol className="subtitle-window-feed">
            {subtitleBlocks.map((block) => (
              <li key={block.id} className={`subtitle-window-block subtitle-window-block-${block.status}`}>
                <div className="subtitle-window-meta">
                  <span className="timeline-time">
                    {formatTimestamp(block.startMs)} - {formatTimestamp(block.endMs)}
                  </span>
                  <span className={`timeline-state timeline-state-${block.status}`}>
                    {getStateLabel(block.status)}
                  </span>
                </div>
                <p className="subtitle-window-translation">{getDisplayTranslation(block)}</p>
                <p className="subtitle-window-transcript">{getDisplayTranscript(block)}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
