import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../../src/renderer/src/App'

describe('App', () => {
  it('shows the empty timeline state before any file is selected', () => {
    const html = renderToStaticMarkup(createElement(App))

    expect(html).toContain('AI RealTime Translator')
    expect(html).toContain('subtitle event stream')
    expect(html).toContain('No media file selected yet.')
    expect(html).toContain('empty state')
    expect(html).not.toContain('Revision count:')
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
