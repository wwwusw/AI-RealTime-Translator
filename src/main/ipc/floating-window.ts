import { ipcMain } from 'electron'
import type { SubtitleBlock } from '../../shared/pipeline'
import { floatingWindowChannels } from '../../shared/events'
import {
  createFloatingWindow,
  destroyFloatingWindow,
  toggleFloatingWindow,
  getFloatingState,
  updateFloatingWindowState,
  initFloatingWindowManager
} from '../services/floating-window-manager'

let cachedBlocks: SubtitleBlock[] = []
let cachedRevisionSummary = ''

export const getCachedBlocks = () => cachedBlocks
export const getLastRevisionSummary = () => cachedRevisionSummary

export const cacheSubtitleBlocks = (
  blocks: SubtitleBlock[],
  revisionSummary: string
) => {
  cachedBlocks = blocks
  cachedRevisionSummary = revisionSummary
  updateFloatingWindowState(blocks, revisionSummary)
}

export const registerFloatingWindowHandlers = (mainDirname: string) => {
  initFloatingWindowManager(mainDirname)

  ipcMain.handle(floatingWindowChannels.open, async () => {
    return createFloatingWindow()
  })

  ipcMain.handle(floatingWindowChannels.close, async () => {
    return destroyFloatingWindow()
  })

  ipcMain.handle(floatingWindowChannels.toggle, async () => {
    return toggleFloatingWindow()
  })

  ipcMain.handle(floatingWindowChannels.getState, async () => {
    return getFloatingState()
  })
}
