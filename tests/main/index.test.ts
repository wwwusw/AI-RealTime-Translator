import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getPreloadPath } from '../../src/main/paths'

describe('getPreloadPath', () => {
  it('points to the built preload output for the main bundle directory', () => {
    expect(getPreloadPath('D:/app/out/main').replaceAll('\\', '/')).toBe(
      'D:/app/out/preload/index.mjs'
    )
  })

  it('disables renderer sandboxing so the ESM preload bridge can load', () => {
    const source = readFileSync(resolve('src/main/index.ts'), 'utf8')

    expect(source).toContain('sandbox: false')
    expect(source).toContain('contextIsolation: true')
  })

  it('declares ws as a runtime dependency for main-process realtime ASR', () => {
    const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }

    expect(packageJson.dependencies?.ws).toBeDefined()
  })
})
