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
  const filePath = useAppStore((state) => state.filePath)
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
        <h1>准备开始本地文件字幕演示页</h1>
        <p>
          当前时间轴仍是 mock timeline，用来演示 renderer 布局和状态样式；real subtitle event stream
          还没有接入。
        </p>
      </section>
      <Workspace
        filePath={filePath}
        canStart={canStart}
        isRunning={isRunning}
        onPick={() => void pick()}
        onStart={() => void start()}
        onPause={() => void pause()}
        onReset={() => void reset()}
      />
      <StatusBar
        translationModel={config.translation.model}
        asrProvider={config.asr.provider}
        stageLabel={stageLabel}
        lastRevisionSummary={lastRevisionSummary}
      />
      <SubtitleTimeline subtitles={subtitles} timelineMode={timelineMode} />
      <SettingsPanel
        asrProvider={config.asr.provider}
        translationBaseUrl={config.translation.baseUrl}
        translationModel={config.translation.model}
        hasTranslationApiKey={config.translation.apiKey.trim().length > 0}
      />
    </main>
  )
}
