import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TimelineMode, TimelineSubtitleBlock } from '../../state/useAppStore'
import { composeCaptionLines } from './compose-caption-text'

type SubtitleTimelineProps = {
  subtitleBlocks: TimelineSubtitleBlock[]
  timelineMode: TimelineMode
}

export function SubtitleTimeline({ subtitleBlocks }: SubtitleTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const prevLineCountRef = useRef(0)
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lines = composeCaptionLines(subtitleBlocks)

  // ── Auto-scroll to bottom ───────────────────────────────────────────
  //
  // Outer container (`scrollRef`) is a plain block layout — no flex, no
  // ::before spacer — so scrollHeight reliably reflects the true content
  // height.  `useLayoutEffect` guarantees layout is complete before we
  // touch scrollTop.
  //
  // Scrolling only happens when the line count *increases* (new content
  // arrived) AND the user hasn't manually scrolled up to read history.
  useLayoutEffect(() => {
    const newCount = lines.length
    const prevCount = prevLineCountRef.current
    prevLineCountRef.current = newCount

    if (newCount <= prevCount || userScrolledUp) return

    const container = scrollRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [lines.length, userScrolledUp])

  // ── User scroll detection ───────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight

    // User dragged scrollbar back to the bottom → resume auto-follow.
    if (distanceFromBottom < 24) {
      setUserScrolledUp(false)
      return
    }

    // User scrolled away from the bottom → pause auto-follow.
    setUserScrolledUp(true)

    // After 3 s of inactivity, pull the user back to the latest content.
    if (userScrollTimerRef.current) {
      clearTimeout(userScrollTimerRef.current)
    }
    userScrollTimerRef.current = setTimeout(() => {
      setUserScrolledUp(false)
    }, 3_000)
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (userScrollTimerRef.current) {
        clearTimeout(userScrollTimerRef.current)
      }
    }
  }, [])

  // ── Empty state ─────────────────────────────────────────────────────
  if (subtitleBlocks.length === 0 || lines.length === 0) {
    return (
      <section className="timeline-card live-caption-card" aria-label="实时翻译字幕">
        <div className="live-caption-surface live-caption-surface--empty">
          <p className="live-caption-text live-caption-text--placeholder">
            等待翻译内容…
          </p>
        </div>
      </section>
    )
  }

  // ── Live caption surface ────────────────────────────────────────────
  return (
    <section className="timeline-card live-caption-card" aria-label="实时翻译字幕">
      {/*
        * Two-layer structure:
        *   Outer (scrollRef) — plain block layout, fixed height, overflow:auto.
        *     → scrollHeight is always the true content height, no flex interference.
        *   Inner (live-caption-lines) — flex column that sticks short content
        *     to the bottom via justify-content:flex-end + min-height:100%.
        */}
      <div
        className="live-caption-surface live-caption-surface--scrollable"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        <div className="live-caption-lines">
          {lines.map((line) =>
            line.isPause ? (
              <div
                key={line.id}
                className="caption-pause-break"
                aria-hidden="true"
              />
            ) : (
              <p key={line.id} className="live-caption-text live-caption-line">
                {line.text}
              </p>
            )
          )}
        </div>
      </div>
    </section>
  )
}
