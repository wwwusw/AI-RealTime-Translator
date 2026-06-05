import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../../src/renderer/src/App'

describe('App', () => {
  it('shows the expected launch hero copy', () => {
    const html = renderToStaticMarkup(createElement(App))

    expect(html).toContain('AI RealTime Translator')
    expect(html).toContain('准备开始本地文件同传')
    expect(html).toContain('先把桌面壳层和配置骨架跑通，再进入后续的 Provider 与流水线任务。')
    expect(html).not.toContain('鍑嗗')
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
