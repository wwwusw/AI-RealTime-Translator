import { describe, expect, it } from 'vitest'
import { getPreloadPath } from '../../src/main/paths'

describe('getPreloadPath', () => {
  it('points to the built preload output for the main bundle directory', () => {
    expect(getPreloadPath('D:/app/out/main').replaceAll('\\', '/')).toBe(
      'D:/app/out/preload/index.mjs'
    )
  })
})
