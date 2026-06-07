import { useEffect, useState } from 'react'
import type { AppConfig } from '../../../../shared/config'

type SettingsPanelProps = {
  config: AppConfig
  onSave: (config: AppConfig) => Promise<void> | void
}

export function SettingsPanel({ config, onSave }: SettingsPanelProps) {
  const [draftConfig, setDraftConfig] = useState(config)

  useEffect(() => {
    setDraftConfig(config)
  }, [config])

  return (
    <section className="settings-panel" aria-label="运行配置">
      <p className="eyebrow">设置</p>
      <h2>运行配置</h2>
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault()
          void onSave(draftConfig)
        }}
      >
        <label className="settings-field">
          <span>通义密钥</span>
          <input
            name="dashscope-api-key"
            type="password"
            value={draftConfig.liveTranslate.apiKey}
            onChange={(event) => {
              const apiKey = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                asr: { ...currentConfig.asr, apiKey },
                liveTranslate: { ...currentConfig.liveTranslate, apiKey }
              }))
            }}
          />
        </label>

        <label className="settings-field">
          <span>DeepSeek 密钥</span>
          <input
            name="deepseek-api-key"
            type="password"
            value={draftConfig.refiner.apiKey}
            onChange={(event) => {
              const apiKey = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                refiner: { ...currentConfig.refiner, apiKey }
              }))
            }}
          />
        </label>

        <button className="settings-save-button" type="submit">
          保存配置
        </button>
      </form>
    </section>
  )
}
