import { dialog } from 'electron'
import type { ImportedMediaFile } from '../../shared/pipeline'

export const pickMediaFile = async (): Promise<ImportedMediaFile | null> => {
  const result = await dialog.showOpenDialog({
    title: 'Select media file',
    properties: ['openFile'],
    filters: [
      {
        name: 'Media files',
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
