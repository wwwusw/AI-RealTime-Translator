import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('App source', () => {
  it('stores disclosure copy for the real subtitle event stream in source', () => {
    const source = readFileSync(resolve('src/renderer/src/App.tsx'), 'utf8')

    expect(source).toContain('AI RealTime Translator')
    expect(source).toContain('live system audio')
    expect(source).toContain('SubtitleTimeline')
  })
})
