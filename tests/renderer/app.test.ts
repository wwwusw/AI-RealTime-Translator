import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../../src/renderer/src/App'

describe('App', () => {
  it('shows the expected launch hero copy', () => {
    const html = renderToStaticMarkup(createElement(App))

    expect(html).toContain('AI RealTime Translator')
  })

  it('shows a settings summary panel with translation defaults', () => {
    const html = renderToStaticMarkup(createElement(App))

    expect(html).toContain('Translation Base URL')
    expect(html).toContain('https://api.deepseek.com')
    expect(html).toContain('Translation Model')
    expect(html).toContain('deepseek-v4-flash')
    expect(html).toContain('Translation API Key')
    expect(html).toContain('Not set')
  })
})
