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
          <span>输入模式</span>
          <select
            name="input-mode"
            value={draftConfig.inputMode}
            onChange={(event) => {
              const inputMode = event.target.value as AppConfig['inputMode']
              setDraftConfig((currentConfig) => ({ ...currentConfig, inputMode }))
            }}
          >
            <option value="file">本地文件</option>
            <option value="system-audio">系统声音</option>
          </select>
        </label>

        <label className="settings-field">
          <span>字幕块时长</span>
          <select
            name="block-duration-ms"
            value={String(draftConfig.blockDurationMs)}
            onChange={(event) => {
              const blockDurationMs = Number(event.target.value)
              setDraftConfig((currentConfig) => ({ ...currentConfig, blockDurationMs }))
            }}
          >
            <option value="2000">2 秒</option>
            <option value="3000">3 秒</option>
            <option value="4000">4 秒</option>
          </select>
        </label>

        <label className="settings-field">
          <span>源语言</span>
          <input
            name="source-language"
            type="text"
            value={draftConfig.liveTranslate.sourceLanguage}
            onChange={(event) => {
              const sourceLanguage = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                liveTranslate: { ...currentConfig.liveTranslate, sourceLanguage }
              }))
            }}
          />
        </label>

        <label className="settings-field">
          <span>目标语言</span>
          <input
            name="target-language"
            type="text"
            value={draftConfig.liveTranslate.targetLanguage}
            onChange={(event) => {
              const targetLanguage = event.target.value
              setDraftConfig((currentConfig) => ({
                ...currentConfig,
                liveTranslate: { ...currentConfig.liveTranslate, targetLanguage }
              }))
            }}
          />
        </label>

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
