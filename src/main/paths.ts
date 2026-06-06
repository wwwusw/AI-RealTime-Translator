import { join } from 'node:path'

export const getPreloadPath = (mainDirname: string) =>
  join(mainDirname, '../preload/index.mjs')
