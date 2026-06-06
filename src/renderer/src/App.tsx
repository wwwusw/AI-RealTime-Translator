import { useEffect } from 'react'
import { SettingsPanel } from './features/settings/SettingsPanel'
import { StatusBar } from './features/status/StatusBar'
import { SubtitleTimeline } from './features/subtitles/SubtitleTimeline'
import { Workspace } from './features/workspace/Workspace'
import { useAppStore } from './state/useAppStore'
import './styles.css'

export default function App() {
  const config = useAppStore((state) => state.config)
  const hydrateConfig = useAppStore((state) => state.hydrateConfig)
  const saveConfig = useAppStore((state) => state.saveConfig)
  const filePath = useAppStore((state) => state.filePath)
  const sourceLabel = useAppStore((state) => state.sourceLabel)
  const canStart = useAppStore((state) => state.canStart)
  const isRunning = useAppStore((state) => state.isRunning)
  const stageLabel = useAppStore((state) => state.stageLabel)
  const lastRevisionSummary = useAppStore((state) => state.lastRevisionSummary)
  const subtitles = useAppStore((state) => state.subtitles)
  const timelineMode = useAppStore((state) => state.timelineMode)
  const pick = useAppStore((state) => state.pick)
  const start = useAppStore((state) => state.start)
  const pause = useAppStore((state) => state.pause)
  const reset = useAppStore((state) => state.reset)

  useEffect(() => {
    void hydrateConfig()
  }, [hydrateConfig])

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">AI RealTime Translator</p>
        <h1>Desktop subtitles for files and live system audio</h1>
        <p>
          The renderer now keeps the subtitle timeline live for both imported media files and
          Windows system audio capture while the main process continues to stream revision events.
        </p>
      </section>
      <Workspace
        inputMode={config.inputMode}
        sourceLabel={sourceLabel ?? filePath}
        canStart={canStart}
        isRunning={isRunning}
        onPick={() => void pick()}
        onStart={() => void start()}
        onPause={() => void pause()}
        onReset={() => void reset()}
      />
      <StatusBar
        inputMode={config.inputMode}
        translationModel={config.translation.model}
        asrProvider={config.asr.provider}
        stageLabel={stageLabel}
        lastRevisionSummary={lastRevisionSummary}
      />
      <SubtitleTimeline subtitles={subtitles} timelineMode={timelineMode} />
      <SettingsPanel config={config} onSave={saveConfig} />
    </main>
  )
}
