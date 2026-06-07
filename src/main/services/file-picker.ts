import type { BrowserWindow } from 'electron'
import { dialog } from 'electron'
import type { ImportedMediaFile } from '../../shared/pipeline'

export const pickMediaFile = async (
  parentWindow?: BrowserWindow | null
): Promise<ImportedMediaFile | null> => {
  const result = await dialog.showOpenDialog(parentWindow ?? undefined, {
    title: '选择媒体文件',
    properties: ['openFile'],
    filters: [
      {
        name: '媒体文件',
        extensions: ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg', 'mp4', 'mov', 'mkv']
      }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return {
    filePath: result.filePaths[0]
  }
}
