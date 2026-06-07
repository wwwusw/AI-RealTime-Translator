import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import App from '../../src/renderer/src/App'

describe('App', () => {
  it('renders the file workspace and primary interface in Chinese', () => {
    const html = renderToStaticMarkup(createElement(App))
    const document = readFileSync(resolve('src/renderer/index.html'), 'utf8')
    const captureSource = readFileSync(
      resolve('src/renderer/src/system-audio-capture.ts'),
      'utf8'
    )

    expect(html).toContain('AI 实时翻译')
    expect(html).toContain('本地文件与系统声音的实时字幕翻译')
    expect(html).toContain('尚未选择媒体文件')
    expect(html).toContain('选择文件')
    expect(html).toContain('开始处理')
    expect(html).toContain('实时翻译字幕')
    expect(document).toContain('<title>AI 实时翻译</title>')
    expect(captureSource).toContain('当前环境不支持系统声音采集')
    expect(captureSource).toContain('没有获取到系统音频轨道')
    expect(captureSource).not.toContain('System audio capture is unavailable')
    expect(html).not.toContain('Task Controls')
    expect(html).not.toContain('No media file selected yet.')
  })

  it('shows only the approved runtime settings with Chinese labels', () => {
    const html = renderToStaticMarkup(createElement(App))

    expect(html).toContain('运行配置')
    expect(html).toContain('输入模式')
    expect(html).toContain('本地文件')
    expect(html).toContain('系统声音')
    expect(html).toContain('字幕块时长')
    expect(html).toContain('源语言')
    expect(html).toContain('目标语言')
    expect(html).toContain('通义密钥')
    expect(html).toContain('DeepSeek 密钥')
    expect(html).toContain('保存配置')
    expect(html).not.toContain('ASR Provider')
    expect(html).not.toContain('ASR Base URL')
    expect(html).not.toContain('ASR Model')
    expect(html).not.toContain('Live Translate Base URL')
    expect(html).not.toContain('Live Translate Model')
    expect(html).not.toContain('Refiner Base URL')
    expect(html).not.toContain('Refiner Model')
  })

  it('uses a fixed caption surface without a scrolling block feed', () => {
    const styles = readFileSync(resolve('src/renderer/src/styles.css'), 'utf8')

    expect(styles).toContain('.live-caption-surface')
    expect(styles).toContain('height: 132px')
    expect(styles).toContain('overflow: hidden')
    expect(styles).not.toContain('.subtitle-window-feed')
    expect(styles).not.toContain('.subtitle-window-block')
  })
})
