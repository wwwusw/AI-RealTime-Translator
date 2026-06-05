import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('App source', () => {
  it('stores the launch hero copy in source', () => {
    const source = readFileSync(resolve('src/renderer/src/App.tsx'), 'utf8')

    expect(source).toContain('AI RealTime Translator')
    expect(source).toContain('准备开始本地文件同传')
    expect(source).toContain('先把桌面壳层和配置骨架跑通，再进入后续的 Provider 与流水线任务。')
    expect(source).not.toContain('鍑嗗')
  })
})
