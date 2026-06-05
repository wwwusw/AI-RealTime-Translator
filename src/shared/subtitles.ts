export type SubtitleStatus = 'draft' | 'final'

export type SubtitleLine = {
  id: string
  english: string
  chinese: string
  status: SubtitleStatus
  revisionCount: number
  updatedAt: number
}

export const createSubtitle = ({
  id,
  english,
  chinese
}: Pick<SubtitleLine, 'id' | 'english' | 'chinese'>): SubtitleLine => ({
  id,
  english,
  chinese,
  status: 'draft',
  revisionCount: 0,
  updatedAt: Date.now()
})

export const applySubtitleRevision = (
  subtitles: SubtitleLine[],
  revisions: Array<{ id: string; chinese: string }>
): SubtitleLine[] =>
  subtitles.map((line) => {
    const revision = revisions.find((item) => item.id === line.id)
    if (!revision) {
      return line
    }

    return {
      ...line,
      chinese: revision.chinese,
      revisionCount: line.revisionCount + 1,
      updatedAt: Date.now()
    }
  })

export const freezeExpiredDrafts = (
  subtitles: SubtitleLine[],
  windowSize: number
): SubtitleLine[] =>
  subtitles.map((line, index) => ({
    ...line,
    status: index < subtitles.length - windowSize ? 'final' : line.status
  }))
