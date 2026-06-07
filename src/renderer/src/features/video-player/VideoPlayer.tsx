import { useEffect, useRef } from 'react'

/*
 * Convert a local file path to a URL served by the Electron custom protocol
 * registered in src/main/services/media-protocol.ts.
 *
 * Uses the pattern `local-media://_/<encoded-absolute-path>` to avoid
 * hostname-parsing issues with Windows drive letters.
 */
export const toMediaPlayerUrl = (filePath: string): string => {
  const normalised = filePath.replace(/\\/g, '/')
  return `local-media://_/${encodeURIComponent(normalised)}`
}

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.webm', '.flv', '.m4v', '.mpg', '.mpeg', '.ts'
])

const isVideoFile = (filePath: string): boolean => {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return VIDEO_EXTENSIONS.has(ext)
}

type MediaPlayerProps = {
  filePath: string | null
  playing: boolean
  inputMode: 'file' | 'system-audio'
  onEnded?: () => void
}

export function VideoPlayer({
  filePath,
  playing,
  inputMode,
  onEnded
}: MediaPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null)

  // Control playback based on `playing` prop
  useEffect(() => {
    const media = mediaRef.current
    if (!media) return

    if (playing) {
      media.play().catch(() => {
        // Autoplay may be blocked; user can click to start
      })
    } else {
      media.pause()
    }
  }, [playing])

  // Reset playback position when file changes
  useEffect(() => {
    const media = mediaRef.current
    if (!media) return
    media.currentTime = 0
  }, [filePath])

  if (inputMode !== 'file' || !filePath) {
    return null
  }

  const src = toMediaPlayerUrl(filePath)
  const isVideo = isVideoFile(filePath)
  const label = isVideo ? '视频播放器' : '音频播放器'

  return (
    <section className={`media-player-card ${isVideo ? 'media-player-video' : 'media-player-audio'}`} aria-label={label}>
      {isVideo ? (
        <video
          ref={mediaRef}
          className="media-player"
          src={src}
          controls
          onEnded={onEnded}
        />
      ) : (
        <div className="audio-player-wrapper">
          <div className="audio-player-icon">🎵</div>
          <audio
            ref={mediaRef}
            className="media-player audio-player"
            src={src}
            controls
            onEnded={onEnded}
          />
        </div>
      )}
    </section>
  )
}
