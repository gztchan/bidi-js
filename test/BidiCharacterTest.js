import { getEmbeddingLevels, getReorderedIndices } from '../src/index.js'
import { getBidiCharType, TYPES_TO_NAMES } from '../src/charTypes.js'
import { readFileSync } from 'fs'
import { performance } from 'perf_hooks'

export function runBidiCharacterTest () {
  const text = readFileSync(new URL('./BidiCharacterTest.txt', import.meta.url), 'utf-8')
  const lines = text.split('\n')

  const BAIL_COUNT = 10

  let testFilter = null
  // testFilter = (lineNum, dir) => lineNum === 65 && dir === 'auto'

  let testCount = 0
  let passCount = 0
  let failCount = 0
  let totalTime = 0

  lines.forEach((line, lineIdx) => {
    if (line && !line.startsWith('#')) {
      let [input, paraDir, , expectedLevels, expectedOrder] = line.split(';')

      const inputOrig = input
      input = input.split(' ').map(d => String.fromCodePoint(parseInt(d, 16))).join('')
      paraDir = paraDir === '0' ? 'ltr' : paraDir === '1' ? 'rtl' : 'auto'

      if (testFilter && testFilter(lineIdx + 1, paraDir) === false) return

      expectedLevels = expectedLevels.split(' ').map(s => s === 'x' ? s : parseInt(s, 10))
      expectedOrder = expectedOrder.split(' ').map(s => parseInt(s, 10))

      const start = performance.now()
      const { levels, paragraphs } = getEmbeddingLevels(input, paraDir)
      let reordered = getReorderedIndices(input, levels, paragraphs[0].start, paragraphs[0].end, paragraphs[0].level)
      totalTime += performance.now() - start

      reordered = reordered.filter(i => expectedLevels[i] !== 'x') //those with indeterminate level are ommitted

      let ok = expectedLevels.length === levels.length && paragraphs.length === 1
      if (ok) {
        for (let i = 0; i < expectedLevels.length; i++) {
          if (expectedLevels[i] !== 'x' && expectedLevels[i] !== levels[i]) {
            ok = false
            break
          }
        }
      }
      if (ok) {
        for (let i = 0; i < reordered.length; i++) {
          if (reordered[i] !== expectedOrder[i]) {
            ok = false
            break
          }
        }
      }

      testCount++
      if (ok) {
        passCount++
      } else {
        if (++failCount <= BAIL_COUNT) {
          const types = input.split('').map(ch => TYPES_TO_NAMES[getBidiCharType(ch)])
          console.error(`Test on line ${lineIdx + 1}, direction "${paraDir}":
  Input codes:     ${inputOrig}
  Input Types:     ${mapToColumns(types, 5)}
  Expected levels: ${mapToColumns(expectedLevels, 5)}
  Received levels: ${mapToColumns(levels, 5)}
  Expected order:  ${mapToColumns(expectedOrder, 4)}
  Received order:  ${mapToColumns(reordered, 4)}`)
          //  Chars:    ${mapToColumns(input.split(''), 5)}
        }
      }

    }
  })

  let message = `Bidi Character Tests: ${testCount} total, ${passCount} passed, ${failCount} failed`
  if (failCount >= BAIL_COUNT) {
    message += ` (only first ${BAIL_COUNT} failures shown)`
  }
  message += `\n    ${totalTime.toFixed(4)}ms total, ${(totalTime / testCount).toFixed(4)}ms average`

  console.log(message)

  return failCount ? 1 : 0
}

function mapToColumns (values, colSize) {
  return [...values].map(v => `${v}`.padEnd(colSize)).join('')
}
