import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../../src/renderer/src/App'

describe('App', () => {
  it('shows the empty timeline state before any file is selected', () => {
    const html = renderToStaticMarkup(createElement(App))

    expect(html).toContain('AI RealTime Translator')
    expect(html).toContain('live system audio')
    expect(html).toContain('No media file selected yet.')
    expect(html).toContain('empty state')
    expect(html).toContain('Single-box rolling captions')
  })

  it('shows an editable settings panel with live translate and refiner fields', () => {
    const html = renderToStaticMarkup(createElement(App))

    expect(html).toContain('Provider Settings')
    expect(html).toContain('Input Mode')
    expect(html).toContain('system-audio')
    expect(html).toContain('Subtitle Block Duration')
    expect(html).toContain('ASR Provider')
    expect(html).toContain('scripted')
    expect(html).toContain('ASR Base URL')
    expect(html).toContain('ASR Model')
    expect(html).toContain('Live Translate API Key')
    expect(html).toContain('Live Translate Base URL')
    expect(html).toContain('qwen3.5-livetranslate-flash-realtime')
    expect(html).toContain('Refiner API Key')
    expect(html).toContain('Refiner Base URL')
    expect(html).toContain('https://api.deepseek.com')
    expect(html).toContain('Refiner Model')
    expect(html).toContain('deepseek-v4-flash')
    expect(html).toContain('Save Settings')
  })
})
