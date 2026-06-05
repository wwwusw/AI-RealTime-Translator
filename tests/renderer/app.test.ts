import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../../src/renderer/src/App'

describe('App', () => {
  it('shows the demo workspace, status summary, and subtitle timeline', () => {
    const html = renderToStaticMarkup(createElement(App))

    expect(html).toContain('AI RealTime Translator')
    expect(html).toContain('先把本地文件翻译流程跑通，再逐步接入系统音频实时采集。')
    expect(html).toContain('Task Controls')
    expect(html).toContain('Provider Settings')
    expect(html).toContain('字幕时间轴')
    expect(html).toContain('处理中')
  })

  it('shows a settings summary panel with translation defaults', () => {
    const html = renderToStaticMarkup(createElement(App))

    expect(html).toContain('Provider Settings')
    expect(html).toContain('ASR Provider')
    expect(html).toContain('scripted')
    expect(html).toContain('Translation Base URL')
    expect(html).toContain('https://api.deepseek.com')
    expect(html).toContain('Translation Model')
    expect(html).toContain('deepseek-v4-flash')
    expect(html).toContain('Translation API Key')
    expect(html).toContain('Not set')
  })
})
