import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('README', () => {
  it('documents the current MVP capabilities, setup, and live subtitle event flow', () => {
    const readme = readFileSync(resolve('README.md'), 'utf8')

    expect(readme).toContain('Electron')
    expect(readme).toContain('React')
    expect(readme).toContain('TypeScript')
    expect(readme).toContain('ffmpeg-static')
    expect(readme).toContain('DeepSeek API')
    expect(readme).toContain('baseUrl')
    expect(readme).toContain('apiKey')
    expect(readme).toContain('model')
    expect(readme).toContain('npm install')
    expect(readme).toContain('npm run dev')
    expect(readme).toContain('subtitle-pending')
    expect(readme).toContain('subtitle-added')
    expect(readme).toContain('subtitle-revised')
    expect(readme).toContain('local file input')
    expect(readme).toContain('System audio capture')
  })
})
