import type { TimelineMode, TimelineSubtitleBlock } from '../../state/useAppStore'
import { composeCaptionText } from './compose-caption-text'

type SubtitleTimelineProps = {
  subtitleBlocks: TimelineSubtitleBlock[]
  timelineMode: TimelineMode
}

export function SubtitleTimeline({ subtitleBlocks }: SubtitleTimelineProps) {
  const captionText = composeCaptionText(subtitleBlocks)

  return (
    <section className="timeline-card live-caption-card" aria-label="Live translated captions">
      <div className="live-caption-surface">
        <p className="live-caption-text" aria-live="polite" aria-atomic="true">
          {captionText}
        </p>
      </div>
    </section>
  )
}
