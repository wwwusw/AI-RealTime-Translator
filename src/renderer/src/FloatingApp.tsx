import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { composeCaptionLines } from './features/subtitles/compose-caption-text'
import { useFloatingStore } from './state/useFloatingStore'
import './FloatingApp.css'

export default function FloatingApp() {
  const subtitleBlocks = useFloatingStore((s) => s.subtitleBlocks)
  const timelineMode = useFloatingStore((s) => s.timelineMode)
  const hydrate = useFloatingStore((s) => s.hydrate)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const prevLineCountRef = useRef(0)
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lines = composeCaptionLines(subtitleBlocks)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // Auto-scroll to bottom when new lines arrive
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

  // User scroll detection
  const handleScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight

    if (distanceFromBottom < 24) {
      setUserScrolledUp(false)
      return
    }

    setUserScrolledUp(true)

    if (userScrollTimerRef.current) {
      clearTimeout(userScrollTimerRef.current)
    }
    userScrollTimerRef.current = setTimeout(() => {
      setUserScrolledUp(false)
    }, 3_000)
  }, [])

  useEffect(() => {
    return () => {
      if (userScrollTimerRef.current) {
        clearTimeout(userScrollTimerRef.current)
      }
    }
  }, [])

  const handleClose = () => {
    window.floatingWindow?.close()
  }

  const hasContent = subtitleBlocks.length > 0 && lines.length > 0

  return (
    <div className="floating-window">
      <div className="floating-drag-bar">
        <span className="floating-title">AI 实时翻译</span>
        <button
          className="floating-close-btn"
          onClick={handleClose}
          aria-label="关闭悬浮窗"
          title="返回主窗口"
        >
          ✕
        </button>
      </div>
      <div className="floating-subtitle-area">
        {hasContent ? (
          <div
            className="floating-subtitle-scroll"
            ref={scrollRef}
            onScroll={handleScroll}
          >
            <div className="floating-subtitle-lines">
              {lines.map((line) =>
                line.isPause ? (
                  <div
                    key={line.id}
                    className="floating-pause-break"
                    aria-hidden="true"
                  />
                ) : (
                  <p key={line.id} className="floating-subtitle-line">
                    {line.text}
                  </p>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="floating-subtitle-placeholder">
            <p className="floating-placeholder-text">等待翻译内容…</p>
          </div>
        )}
      </div>
    </div>
  )
}
