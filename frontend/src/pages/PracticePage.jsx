import { useMemo, useRef, useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import '../styles/practice.css'

import { UNITS } from '../data/units'
import {
  loadProgress,
  saveProgress,
  markCompleted,
  saveLastPracticeRoute,
} from '../utils/progress'
import { startPractice, submitPractice } from '../api/practice'

function getPerRow() {
  const w = window.innerWidth
  if (w < 600) return 3
  if (w < 900) return 4
  if (w < 1200) return 5
  return 6
}

function buildGrid(chunk, repeats, perRow) {
  const items = Array.from({ length: repeats }, () => chunk)
  const rows = []
  for (let i = 0; i < items.length; i += perRow) {
    rows.push(items.slice(i, i + perRow).join('  '))
  }
  return rows.join('\n')
}

function normalizePromptText(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

function isExactRenderedMatch(a, b) {
  const left = normalizePromptText(a)
  const right = normalizePromptText(b)

  if (left.length !== right.length) return false

  for (let i = 0; i < right.length; i += 1) {
    if (left[i] !== right[i]) return false
  }

  return true
}

function flattenLessonTargets(lesson, perRow) {
  if (
    lesson?.targetsByTier &&
    typeof lesson.targetsByTier === 'object' &&
    !Array.isArray(lesson.targetsByTier)
  ) {
    const sortedTierKeys = Object.keys(lesson.targetsByTier).sort(
      (a, b) => Number(a) - Number(b)
    )

    const flattened = sortedTierKeys.flatMap((tierKey) => {
      const tierTargets = Array.isArray(lesson.targetsByTier[tierKey])
        ? lesson.targetsByTier[tierKey]
        : []

      return tierTargets
        .map((entry) => {
          if (typeof entry === 'string') return normalizePromptText(entry)
          if (entry && typeof entry.text === 'string') {
            return normalizePromptText(entry.text)
          }
          return ''
        })
        .filter(Boolean)
    })

    if (flattened.length > 0) return flattened
  }

  if (Array.isArray(lesson?.targets) && lesson.targets.length > 0) {
    return lesson.targets
      .map((entry) => {
        if (typeof entry === 'string') return normalizePromptText(entry)
        if (entry && typeof entry.text === 'string') {
          return normalizePromptText(entry.text)
        }
        return ''
      })
      .filter(Boolean)
  }

  if (lesson?.chunk && lesson?.repeats) {
    return [normalizePromptText(buildGrid(lesson.chunk, lesson.repeats, perRow))]
  }

  return ['']
}

export default function PracticePage() {
  const { unitId, stepId } = useParams()
  const inputRef = useRef(null)
  const advanceTimeoutRef = useRef(null)

  const unit = useMemo(
    () => UNITS.find((u) => u.id === Number(unitId)) || UNITS[0],
    [unitId]
  )

  const lesson = useMemo(
    () =>
      unit.lessons.find((l) => l.stepId === Number(stepId)) || unit.lessons[0],
    [unit, stepId]
  )

  const [typed, setTyped] = useState('')
  const [wrongCount, setWrongCount] = useState(0)
  const [fixedCount, setFixedCount] = useState(0)
  const [perRow, setPerRow] = useState(getPerRow())

  const [hasStarted, setHasStarted] = useState(false)
  const [overlayDismissed, setOverlayDismissed] = useState(false)
  const [promptIndex, setPromptIndex] = useState(0)
  const [hasCompletedFirstCycle, setHasCompletedFirstCycle] = useState(false)

  const [liveElapsedMs, setLiveElapsedMs] = useState(0)
  const [promptAnimating, setPromptAnimating] = useState(false)

  const autoAdvanceLockRef = useRef(false)

  const sessionIdRef = useRef(null)
  const sessionStartRef = useRef(null)

  const cycleWrongRef = useRef(0)
  const cycleFixedRef = useRef(0)
  const cycleTargetCharsRef = useRef(0)

  const typingStartRef = useRef(null)

  function focusInput() {
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const prompts = useMemo(() => {
    return flattenLessonTargets(lesson, perRow)
  }, [lesson, perRow])

  const safePromptIndex =
    prompts.length > 0 ? Math.min(promptIndex, prompts.length - 1) : 0

  const target = normalizePromptText(prompts[safePromptIndex] ?? '')
  const doneExact = isExactRenderedMatch(typed, target)
  const expectedChar = typed.length < target.length ? target[typed.length] : null

  const progressPercent =
    target.length > 0
      ? Math.min(100, Math.round((typed.length / target.length) * 100))
      : 0

  const liveWpm = useMemo(() => {
    if (!hasStarted || !typingStartRef.current || typed.length === 0) return 0

    const minutes = liveElapsedMs / 60000
    if (minutes <= 0) return 0

    return Math.max(0, Math.round((typed.length / 5) / minutes))
  }, [typed.length, liveElapsedMs, hasStarted])

  useEffect(() => {
    const onResize = () => setPerRow(getPerRow())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    saveLastPracticeRoute(unitId, stepId)
  }, [unitId, stepId])

  useEffect(() => {
    setTyped('')
    setWrongCount(0)
    setFixedCount(0)
    setHasStarted(false)
    setOverlayDismissed(false)
    setPromptIndex(0)
    setHasCompletedFirstCycle(false)
    setLiveElapsedMs(0)
    setPromptAnimating(false)

    autoAdvanceLockRef.current = false

    sessionIdRef.current = null
    sessionStartRef.current = null
    cycleWrongRef.current = 0
    cycleFixedRef.current = 0
    cycleTargetCharsRef.current = 0
    typingStartRef.current = null

    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current)
      advanceTimeoutRef.current = null
    }

    focusInput()
  }, [unitId, stepId])

  useEffect(() => {
    if (!hasStarted || !typingStartRef.current) return

    const timer = setInterval(() => {
      setLiveElapsedMs(Date.now() - typingStartRef.current)
    }, 200)

    return () => clearInterval(timer)
  }, [hasStarted, promptIndex])

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!target) return
    if (!doneExact) return
    if (autoAdvanceLockRef.current) return

    autoAdvanceLockRef.current = true

    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current)
    }

    advanceTimeoutRef.current = setTimeout(() => {
      advancePrompt({
        promptIndex: safePromptIndex,
        targetLength: target.length,
        wrongCount,
        fixedCount,
      })
    }, 250)

    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current)
        advanceTimeoutRef.current = null
      }
    }
  }, [doneExact, safePromptIndex, target, wrongCount, fixedCount])

  async function ensureBackendSessionStarted() {
    if (sessionIdRef.current) return

    const backendLessonId = lesson.backendLessonId
    if (!backendLessonId) {
      console.warn(
        'No lesson.backendLessonId set in UNITS for this lesson; backend tracking disabled for this step.'
      )
      return
    }

    try {
      const data = await startPractice(backendLessonId, 'practice')
      const sid = data?.session_id ?? data?.id ?? null

      if (!sid) {
        console.warn('Backend /api/practice/start returned no session_id:', data)
        return
      }

      sessionIdRef.current = sid
      sessionStartRef.current = Date.now()
    } catch (e) {
      console.error('Failed to start backend practice session:', e)
    }
  }

  async function submitBackendCycleIfPossible() {
    const sessionId = sessionIdRef.current
    const startMs = sessionStartRef.current

    if (!sessionId || !startMs) return

    const timeSeconds = Math.max(1, (Date.now() - startMs) / 1000)
    const durationSeconds = Math.max(1, Math.round(timeSeconds))

    const chars = Math.max(1, cycleTargetCharsRef.current)
    const minutes = timeSeconds / 60
    const wpm = (chars / 5) / Math.max(minutes, 0.0001)

    const totalErrors = cycleWrongRef.current + cycleFixedRef.current
    const accuracy = chars / Math.max(chars + totalErrors, 1)

    try {
      await submitPractice({
        session_id: sessionId,
        wpm,
        accuracy,
        error_count: totalErrors,
        time_seconds: timeSeconds,
        duration_seconds: durationSeconds,
        tier: null,
        details: {
          unit_id: Number(unitId),
          step_id: Number(stepId),
          cycle_completed: true,
          prompt_count: prompts.length,
        },
      })
    } catch (e) {
      console.error('Failed to submit backend practice results:', e)
    }
  }

  function triggerPromptTransition() {
    setPromptAnimating(true)
    setTimeout(() => {
      setPromptAnimating(false)
    }, 180)
  }

  function resetTypingForNextPrompt() {
    setTyped('')
    setWrongCount(0)
    setFixedCount(0)
    setLiveElapsedMs(0)
    typingStartRef.current = hasStarted ? Date.now() : null
    autoAdvanceLockRef.current = false
    triggerPromptTransition()
    focusInput()
  }

  function markLessonCompletedOnce() {
    if (hasCompletedFirstCycle) return

    const current = loadProgress()
    const nextProgress = markCompleted(current, Number(unitId), Number(stepId))
    saveProgress(nextProgress)
    setHasCompletedFirstCycle(true)
  }

  async function startNextBackendCycle() {
    sessionIdRef.current = null
    sessionStartRef.current = null
    cycleWrongRef.current = 0
    cycleFixedRef.current = 0
    cycleTargetCharsRef.current = 0

    if (hasStarted) {
      await ensureBackendSessionStarted()
    }
  }

  async function advancePrompt(snapshot) {
    cycleWrongRef.current += snapshot.wrongCount
    cycleFixedRef.current += snapshot.fixedCount
    cycleTargetCharsRef.current += snapshot.targetLength

    const isLastPrompt = snapshot.promptIndex >= prompts.length - 1

    if (!isLastPrompt) {
      setPromptIndex((prev) => {
        const nextIndex = Math.min(prev + 1, prompts.length - 1)
        return nextIndex
      })
      resetTypingForNextPrompt()
      return
    }

    await submitBackendCycleIfPossible()
    markLessonCompletedOnce()

    setPromptIndex(0)
    resetTypingForNextPrompt()
    await startNextBackendCycle()
  }

  function beginSessionIfNeeded() {
    if (!hasStarted) setHasStarted(true)
    if (!overlayDismissed) setOverlayDismissed(true)
    if (!typingStartRef.current) typingStartRef.current = Date.now()
    ensureBackendSessionStarted()
    focusInput()
  }

  function onKeyDown(e) {
    if (
      !hasStarted &&
      (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace')
    ) {
      beginSessionIfNeeded()
    }

    if (doneExact) {
      e.preventDefault()
      return
    }

    if (typed.length >= target.length && e.key !== 'Backspace') {
      e.preventDefault()
      return
    }

    if (e.key === 'Backspace') {
      if (typed.length > 0) {
        setTyped((prev) => prev.slice(0, -1))
        setFixedCount((n) => n + 1)
      }
      autoAdvanceLockRef.current = false
      e.preventDefault()
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      return
    }

    let nextValue = typed
    let nextWrongCount = wrongCount

    if (e.key === 'Enter') {
      nextValue = typed + '\n'
      if (expectedChar !== '\n') {
        nextWrongCount = wrongCount + 1
        setWrongCount(nextWrongCount)
      }
      setTyped(nextValue)
      e.preventDefault()
    } else if (e.key.length === 1) {
      nextValue = typed + e.key
      if (expectedChar !== e.key) {
        nextWrongCount = wrongCount + 1
        setWrongCount(nextWrongCount)
      }
      setTyped(nextValue)
      e.preventDefault()
    } else {
      return
    }

    if (!typingStartRef.current) {
      typingStartRef.current = Date.now()
    }
  }

  return (
    <div className="app-shell">
      <NavBar />

      <main
        className="practice-shell"
        onMouseDown={focusInput}
        onClick={focusInput}
        onPointerDown={focusInput}
      >
        <div className="practice-top">
          <div>
            <h1 className="practice-h1">{unit.title}</h1>

            <div className="practice-sub">
              Mini-lesson: <b>{lesson.label ?? lesson.chunk}</b>{' '}
              <span style={{ opacity: 0.7 }}>
                (Prompt {safePromptIndex + 1}/{prompts.length})
              </span>
              <span style={{ opacity: 0.7 }}> — Continuous Practice</span>
            </div>

            <div className="practice-rules">
              Click the box and type <b>exactly</b> what you see (spaces count). Use{' '}
              <b>Backspace</b> to fix.
            </div>

            {lesson.learnText && (
              <div className="practice-learn">{lesson.learnText}</div>
            )}
          </div>

          <div className="practice-nav">
            <Link to="/lessons" className="practice-back">
              ← Back
            </Link>
          </div>
        </div>

        <div className="practice-livebar">
          <div className="practice-metric">
            WPM: <b>{liveWpm}</b>
          </div>
          <div className="practice-metric">
            Progress: <b>{progressPercent}%</b>
          </div>
          <div className="practice-progress">
            <div
              className="practice-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="type-area">
          <div className={`type-box ${promptAnimating ? 'prompt-transition' : ''}`}>
            {!overlayDismissed && typed.length === 0 && (
              <div
                className="start-overlay"
                onMouseDown={() => {
                  beginSessionIfNeeded()
                }}
                onClick={() => {
                  beginSessionIfNeeded()
                }}
                role="presentation"
                aria-hidden="true"
              >
                <div className="start-overlay-card">
                  <div className="start-title">Click here to start typing</div>
                  <div className="start-sub">
                    Then type the <b>highlighted</b> character (spaces count)
                  </div>
                </div>
              </div>
            )}

            <ChunkGrid target={target} typed={typed} />
          </div>

          <input
            ref={inputRef}
            className="hidden-capture"
            value=""
            onChange={() => {}}
            onKeyDown={onKeyDown}
            autoFocus
          />
        </div>

        <div className="practice-hud">
          <span>
            Wrong: <b>{wrongCount}</b>
          </span>
          <span>
            Fixed: <b className="fixed">{fixedCount}</b>
          </span>

          {doneExact && <span className="done-hint">Nice — continuing…</span>}

          {hasCompletedFirstCycle && (
            <span className="done-hint">First full cycle complete</span>
          )}
        </div>

        {unit.showKeyboard && (
          <div className="keyboard-wrap">
            <Keyboard expected={expectedChar} />
          </div>
        )}
      </main>
    </div>
  )
}

function ChunkGrid({ target, typed }) {
  const lines = target.split('\n')
  const lineStarts = lines.reduce((acc, line, i) => {
    if (i === 0) acc.push(0)
    else acc.push(acc[i - 1] + lines[i - 1].length + 1)
    return acc
  }, [])

  return (
    <div className="type-grid">
      {lines.map((line, lineIdx) => {
        const chars = line.split('')
        const startIndex = lineStarts[lineIdx]

        return (
          <div key={lineIdx} className="type-line">
            {chars.map((ch, i) => {
              const idx = startIndex + i
              const typedChar = typed[idx]
              let cls = 'char'

              if (typedChar != null) cls += typedChar === ch ? ' correct' : ' wrong'
              else if (idx === typed.length) cls += ' cursor'

              return (
                <span key={i} className={cls}>
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

const KEY_ROWS = [
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
  ['Tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
  ['Caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'Enter'],
  ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'Shift'],
  ['Space'],
]

function Keyboard({ expected }) {
  const keyToHighlight =
    expected === ' ' ? 'Space' : expected === '\n' ? 'Enter' : expected

  return (
    <div className="keyboard">
      {KEY_ROWS.map((row, idx) => (
        <div className="key-row" key={idx}>
          {row.map((k, i) => {
            const isBig = ['Backspace', 'Tab', 'Caps', 'Enter', 'Shift'].includes(k)
            const isSpace = k === 'Space'
            const active =
              keyToHighlight &&
              (k.toLowerCase() === String(keyToHighlight).toLowerCase() ||
                (k === 'Space' && keyToHighlight === 'Space'))

            return (
              <div
                key={`${k}-${idx}-${i}`}
                className={`key ${isBig ? 'big' : ''} ${isSpace ? 'space' : ''} ${active ? 'active' : ''}`}
              >
                {k}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}