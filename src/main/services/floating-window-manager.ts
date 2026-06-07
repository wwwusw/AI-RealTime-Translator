import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { getPreloadPath } from '../paths'
import type { FloatingWindowState, SubtitleBlock } from '../../shared/pipeline'
import { floatingWindowChannels } from '../../shared/events'

export type { FloatingWindowState }

let floatingWindow: BrowserWindow | null = null
let latestSubtitleBlocks: SubtitleBlock[] = []
let latestRevisionSummary = ''

// Set by init() — the __dirname from src/main/index.ts, so path resolution
// is correct regardless of which file calls createFloatingWindow().
let mainProcessDirname = ''

export const initFloatingWindowManager = (mainDirname: string) => {
  mainProcessDirname = mainDirname
}

export const updateFloatingWindowState = (
  blocks: SubtitleBlock[],
  revisionSummary: string
) => {
  latestSubtitleBlocks = blocks
  latestRevisionSummary = revisionSummary
}

const buildFloatingState = (): FloatingWindowState => ({
  isOpen: floatingWindow !== null && !floatingWindow.isDestroyed(),
  subtitleBlocks: latestSubtitleBlocks,
  lastRevisionSummary: latestRevisionSummary
})

const getFloatingWindowPosition = () => {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  const winWidth = 480
  const winHeight = 280
  return {
    x: Math.round((width - winWidth) / 2),
    y: height - winHeight - 40,
    width: winWidth,
    height: winHeight
  }
}

export const createFloatingWindow = async () => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.focus()
    return buildFloatingState()
  }

  const devServerUrl =
    process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL

  const position = getFloatingWindowPosition()

  floatingWindow = new BrowserWindow({
    ...position,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: getPreloadPath(mainProcessDirname),
      contextIsolation: true,
      sandbox: false
    }
  })

  if (devServerUrl) {
    await floatingWindow.loadURL(`${devServerUrl}?mode=floating`)
  } else {
    const rendererPath = join(mainProcessDirname, '../renderer/index.html')
    await floatingWindow.loadFile(rendererPath, { query: { mode: 'floating' } })
  }

  floatingWindow.on('closed', () => {
    floatingWindow = null
    notifyStateChanged()
  })

  notifyStateChanged()
  return buildFloatingState()
}

export const destroyFloatingWindow = () => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.close()
    floatingWindow = null
  }

  // Focus the main window when floating window closes
  const allWindows = BrowserWindow.getAllWindows()
  for (const win of allWindows) {
    if (!win.isDestroyed()) {
      win.focus()
      break
    }
  }

  notifyStateChanged()
  return buildFloatingState()
}

export const toggleFloatingWindow = async () => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    return destroyFloatingWindow()
  }
  return createFloatingWindow()
}

export const getFloatingState = (): FloatingWindowState => {
  return buildFloatingState()
}

const notifyStateChanged = () => {
  const state = buildFloatingState()
  const allWindows = BrowserWindow.getAllWindows()
  for (const win of allWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send(floatingWindowChannels.stateChanged, state)
    }
  }
}
