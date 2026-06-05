import { useEffect } from 'react'
import { SettingsPanel } from './features/settings/SettingsPanel'
import { useAppStore } from './state/useAppStore'
import './styles.css'

export default function App() {
  const config = useAppStore((state) => state.config)
  const hydrateConfig = useAppStore((state) => state.hydrateConfig)

  useEffect(() => {
    void hydrateConfig()
  }, [hydrateConfig])

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">AI RealTime Translator</p>
        <h1>准备开始本地文件同传</h1>
        <p>先把桌面壳层和配置骨架跑通，再进入后续的 Provider 与流水线任务。</p>
      </section>
      <SettingsPanel
        translationBaseUrl={config.translation.baseUrl}
        translationModel={config.translation.model}
        hasTranslationApiKey={config.translation.apiKey.trim().length > 0}
      />
    </main>
  )
}
