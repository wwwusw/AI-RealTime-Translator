import { app, BrowserWindow, desktopCapturer, session } from 'electron'
import { join } from 'node:path'
import { registerConfigHandlers } from './ipc/config'
import { registerTaskHandlers } from './ipc/tasks'
import { registerFloatingWindowHandlers } from './ipc/floating-window'
import { destroyFloatingWindow } from './services/floating-window-manager'
import { registerMediaProtocol } from './services/media-protocol'
import { getPreloadPath } from './paths'

let mainWindow: BrowserWindow | null = null

const registerSystemAudioCapture = () => {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] })
        const primarySource = sources[0]

        if (!primarySource) {
          callback({})
          return
        }

        callback({
          video: primarySource,
          audio: process.platform === 'win32' ? 'loopback' : undefined
        })
      } catch {
        callback({})
      }
    },
    { useSystemPicker: false }
  )
}

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: getPreloadPath(__dirname),
      contextIsolation: true,
      sandbox: false
    }
  })

  mainWindow.on('close', () => {
    // Close floating window when main window closes
    destroyFloatingWindow()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl)
    return
  }

  const rendererPath = join(__dirname, '../renderer/index.html')

  try {
    await mainWindow.loadFile(rendererPath)
  } catch {
    await mainWindow.loadURL('http://localhost:5173/')
  }
}

app.whenReady().then(async () => {
  registerMediaProtocol()
  registerConfigHandlers()
  registerTaskHandlers()
  registerFloatingWindowHandlers(__dirname)
  registerSystemAudioCapture()
  await createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
