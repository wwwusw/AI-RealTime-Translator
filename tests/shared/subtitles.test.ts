import { describe, expect, it } from 'vitest'
import {
  applySubtitleRevision,
  createSubtitle,
  freezeExpiredDrafts
} from '../../src/shared/subtitles'

describe('subtitle revision window', () => {
  it('applySubtitleRevision only updates matching recent subtitles and leaves unmatched older subtitles unchanged', () => {
    const first = createSubtitle({ id: '1', english: 'hello world', chinese: 'hello world zh' })
    const second = createSubtitle({ id: '2', english: 'deep learning', chinese: 'deep learning zh' })

    const revised = applySubtitleRevision([first, second], [{ id: '2', chinese: 'deep learning model' }])

    expect(revised[0]).toEqual(first)
    expect(revised[1].chinese).toBe('deep learning model')
    expect(revised[1].revisionCount).toBe(1)
  })

  it('applySubtitleRevision only updates matching subtitles that are still draft', () => {
    const finalized = {
      ...createSubtitle({ id: '1', english: 'older line', chinese: 'older line zh' }),
      status: 'final' as const
    }
    const draft = createSubtitle({ id: '2', english: 'recent line', chinese: 'recent line zh' })

    const revised = applySubtitleRevision([finalized, draft], [
      { id: '1', chinese: 'should stay frozen' },
      { id: '2', chinese: 'updated recent line' }
    ])

    expect(revised[0].chinese).toBe('older line zh')
    expect(revised[0].revisionCount).toBe(0)
    expect(revised[1].chinese).toBe('updated recent line')
    expect(revised[1].revisionCount).toBe(1)
  })

  it('freezeExpiredDrafts marks the first subtitle as final when the window size is 4 and keeps the last subtitle as draft', () => {
    const subtitles = Array.from({ length: 5 }, (_, index) =>
      createSubtitle({
        id: String(index + 1),
        english: `line ${index + 1}`,
        chinese: `line ${index + 1} zh`
      })
    )

    const frozen = freezeExpiredDrafts(subtitles, 4)

    expect(frozen[0].status).toBe('final')
    expect(frozen[4].status).toBe('draft')
  })
})
