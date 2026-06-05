import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('App source', () => {
  it('stores the launch heading as readable Chinese text', () => {
    const source = readFileSync(resolve('src/renderer/src/App.tsx'), 'utf8')

    expect(source).toContain('准备开始本地文件同传')
  })
})
