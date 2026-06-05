import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../../src/renderer/src/App'

describe('App', () => {
  it('shows the expected Chinese launch heading', () => {
    const html = renderToStaticMarkup(App())

    expect(html).toContain('准备开始本地文件同传')
  })
})
