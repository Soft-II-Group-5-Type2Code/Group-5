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

function buildExecutableSource(prompts, promptIndex) {
  return prompts.slice(0, promptIndex + 1).join('\n')
}

function looksRunnable(code) {
  const text = String(code ?? '').trim()
  if (!text) return false

  let braceBalance = 0
  let parenBalance = 0
  let quote = null

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const prev = text[i - 1]

    if (quote) {
      if (ch === quote && prev !== '\\') quote = null
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }

    if (ch === '{') braceBalance += 1
    if (ch === '}') braceBalance -= 1
    if (ch === '(') parenBalance += 1
    if (ch === ')') parenBalance -= 1
  }

  if (quote) return false
  if (braceBalance !== 0) return false
  if (parenBalance !== 0) return false

  const trimmed = text.trim()

  if (trimmed.endsWith('{')) return false
  if (trimmed.endsWith('else')) return false

  return true
}

function friendlyConsoleError(message) {
  const msg = String(message ?? '')

  if (
    msg.includes('Unexpected end of input') ||
    msg.includes('Unexpected token') ||
    msg.includes('missing ) after argument list') ||
    msg.includes('Unexpected identifier')
  ) {
    return 'Code is not complete enough to run yet.'
  }

  if (msg.includes('is not defined')) {
    return 'Waiting for the full code snippet before this can run.'
  }

  return msg || 'Code could not run yet.'
}

function runLessonCode(source) {
  const code = String(source ?? '').trim()

  if (!code) {
    return {
      status: 'idle',
      lines: ['No code to run yet.'],
    }
  }

  if (!looksRunnable(code)) {
    const previewLines = code.split('\n').slice(-6)
    return {
      status: 'building',
      lines: ['Building snippet...', ...previewLines],
    }
  }

  const logs = []

  const consoleProxy = {
    log: (...args) => {
      logs.push(
        args
          .map((arg) => {
            if (typeof arg === 'string') return arg
            try {
              return JSON.stringify(arg)
            } catch {
              return String(arg)
            }
          })
          .join(' ')
      )
    },
  }

  try {
    const runner = new Function(
      'console',
      `
"use strict";
${code}
`
    )

    runner(consoleProxy)

    return {
      status: 'success',
      lines: logs.length > 0
        ? ['Code executed successfully.', ...logs]
        : ['Code executed successfully.', 'No console output.'],
    }
  } catch (err) {
    return {
      status: 'error',
      lines: ['Code could not run yet.', friendlyConsoleError(err?.message)],
    }
  }
}

function explainCode(line) {
  const text = String(line ?? '').trim()
  if (!text) return 'Continue typing the code exactly as shown.'

  const functionMatch = text.match(/^function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\((.*?)\)\s*\{$/)
  if (functionMatch) {
    const [, name, paramsRaw] = functionMatch
    const params = paramsRaw.trim()

    if (!params) {
      return `Starts a function named ${name}. This creates a reusable block of code that can be called later.`
    }

    return `Starts a function named ${name} that takes ${params} as input. The code inside this function can use that input when it runs.`
  }

  if (text === '}') {
    return 'Closes the current code block, such as a function, loop, or if statement.'
  }

  const returnStringMatch = text.match(/^return\s+["'`](.*)["'`];?$/)
  if (returnStringMatch) {
    return `Returns the text "${returnStringMatch[1]}" from the function.`
  }

  const returnNumberMatch = text.match(/^return\s+(\d+);?$/)
  if (returnNumberMatch) {
    return `Returns the number ${returnNumberMatch[1]} from the function.`
  }

  if (text.startsWith('return ')) {
    return 'Returns a value from the function back to the place where the function was called.'
  }

  const constMatch = text.match(/^const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(.+);$/)
  if (constMatch) {
    const [, name, value] = constMatch
    return `Creates a constant named ${name} and gives it the value ${value}. Constants are meant to stay the same.`
  }

  const letMatch = text.match(/^let\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(.+);$/)
  if (letMatch) {
    const [, name, value] = letMatch
    return `Creates a variable named ${name} and stores ${value} in it. This variable can be changed later.`
  }

  const updateMatch = text.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*\1\s*([\+\-])\s*(.+);$/)
  if (updateMatch) {
    const [, name, op, value] = updateMatch
    if (op === '+') {
      return `Updates ${name} by adding ${value} to its current value.`
    }
    return `Updates ${name} by subtracting ${value} from its current value.`
  }

  const assignMatch = text.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(.+);$/)
  if (assignMatch) {
    const [, name, value] = assignMatch
    return `Changes the variable ${name} so it now stores ${value}.`
  }

  const consoleMatch = text.match(/^console\.log\((.*)\);$/)
  if (consoleMatch) {
    return `Prints ${consoleMatch[1]} to the console so the user can see the result.`
  }

  const ifMatch = text.match(/^if\s*\((.*)\)\s*\{$/)
  if (ifMatch) {
    return `Starts an if statement. The code inside will only run if ${ifMatch[1]} is true.`
  }

  const elseMatch = text.match(/^}\s*else\s*{$|^else\s*{$/)
  if (elseMatch) {
    return 'Starts the else block. This code runs when the earlier if condition is false.'
  }

  const forMatch = text.match(/^for\s*\((.*?);(.*?);(.*?)\)\s*\{$/)
  if (forMatch) {
    const [, start, condition, update] = forMatch
    return `Starts a loop. It begins with ${start.trim()}, keeps going while ${condition.trim()} is true, and updates with ${update.trim()} after each repetition.`
  }

  const callMatch = text.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\((.*)\);$/)
  if (callMatch) {
    const [, name, args] = callMatch
    if (args.trim()) {
      return `Calls the function ${name} and passes in ${args}.`
    }
    return `Calls the function ${name} so it can run its code.`
  }

  return 'This line is part of the program you are building. Type it exactly to continue.'
}

function previewExecution(line) {
  const text = String(line ?? '').trim()
  if (!text) return 'Run the code to see what happens.'

  const functionMatch = text.match(/^function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\((.*?)\)\s*\{$/)
  if (functionMatch) {
    const [, name] = functionMatch
    return `Preview: a function named ${name} is being created. It will not do anything until the function is called.`
  }

  const returnStringMatch = text.match(/^return\s+["'`](.*)["'`];?$/)
  if (returnStringMatch) {
    return `Preview: when this function runs, it will send back "${returnStringMatch[1]}".`
  }

  const returnNumberMatch = text.match(/^return\s+(\d+);?$/)
  if (returnNumberMatch) {
    return `Preview: when this function runs, it will send back ${returnNumberMatch[1]}.`
  }

  const letMatch = text.match(/^let\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(.+);$/)
  if (letMatch) {
    const [, name, value] = letMatch
    return `Preview: ${name} is set to ${value}.`
  }

  const constMatch = text.match(/^const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(.+);$/)
  if (constMatch) {
    const [, name, value] = constMatch
    return `Preview: ${name} is fixed at ${value}.`
  }

  const updateMatch = text.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*\1\s*([\+\-])\s*(.+);$/)
  if (updateMatch) {
    const [, name, op, value] = updateMatch
    if (op === '+') return `Preview: ${name} will increase by ${value}.`
    return `Preview: ${name} will decrease by ${value}.`
  }

  const consoleMatch = text.match(/^console\.log\((.*)\);$/)
  if (consoleMatch) {
    return `Preview: the program will print ${consoleMatch[1]} in the console.`
  }

  const ifMatch = text.match(/^if\s*\((.*)\)\s*\{$/)
  if (ifMatch) {
    return `Preview: the next lines only run if ${ifMatch[1]} is true.`
  }

  const elseMatch = text.match(/^}\s*else\s*{$|^else\s*{$/)
  if (elseMatch) {
    return 'Preview: this block runs when the earlier if condition is false.'
  }

  const forMatch = text.match(/^for\s*\((.*?);(.*?);(.*?)\)\s*\{$/)
  if (forMatch) {
    return 'Preview: the code inside this loop will repeat several times.'
  }

  const callMatch = text.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\((.*)\);$/)
  if (callMatch) {
    const [, name] = callMatch
    return `Preview: calling ${name} will run that function’s code.`
  }

  return 'Preview: this line contributes to the program being built.'
}

export default function PracticePage() {
  const { unitId, stepId } = useParams()
  const inputRef = useRef(null)
  const advanceTimeoutRef = useRef(null)
  const consoleDebounceRef = useRef(null)

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
  const [consoleResult, setConsoleResult] = useState({
    status: 'idle',
    lines: ['No code to run yet.'],
  })

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

  const explanation = explainCode(target.trim())
  const preview = previewExecution(target.trim())

  const executableSource = useMemo(() => {
    return buildExecutableSource(prompts, safePromptIndex)
  }, [prompts, safePromptIndex])

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
    setConsoleResult({
      status: 'idle',
      lines: ['No code to run yet.'],
    })

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

    if (consoleDebounceRef.current) {
      clearTimeout(consoleDebounceRef.current)
      consoleDebounceRef.current = null
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
      if (consoleDebounceRef.current) {
        clearTimeout(consoleDebounceRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (consoleDebounceRef.current) {
      clearTimeout(consoleDebounceRef.current)
    }

    consoleDebounceRef.current = setTimeout(() => {
      setConsoleResult(runLessonCode(executableSource))
    }, 200)

    return () => {
      if (consoleDebounceRef.current) {
        clearTimeout(consoleDebounceRef.current)
        consoleDebounceRef.current = null
      }
    }
  }, [executableSource])

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
    if (!target) return

    if (e.key === 'Tab') {
      e.preventDefault()

      const tabText = '  '

      if (typed.length + tabText.length <= target.length) {
        let nextValue = typed
        let nextWrongCount = wrongCount

        for (let i = 0; i < tabText.length; i += 1) {
          const nextChar = tabText[i]
          const expectedChar = target[typed.length + i]

          nextValue += nextChar

          if (expectedChar !== nextChar) {
            nextWrongCount += 1
          }
        }

        if (nextWrongCount !== wrongCount) {
          setWrongCount(nextWrongCount)
        }

        setTyped(nextValue)

        if (!typingStartRef.current) {
          typingStartRef.current = Date.now()
        }
      }

      return
    }

    if (e.key === 'Backspace') {
      e.preventDefault()

      if (typed.length === 0) return

      const removedChar = typed[typed.length - 1]
      const expectedChar = target[typed.length - 1]

      if (removedChar !== expectedChar) {
        setFixedCount((v) => v + 1)
      }

      setTyped(typed.slice(0, -1))
      return
    }

    if (e.key.length === 1) {
      e.preventDefault()

      if (typed.length >= target.length) return

      const expectedChar = target[typed.length]

      if (e.key !== expectedChar) {
        setWrongCount((v) => v + 1)
      }

      setTyped(typed + e.key)

      if (!typingStartRef.current) {
        typingStartRef.current = Date.now()
      }

      return
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
          <div className={`editor-shell ${promptAnimating ? 'prompt-transition' : ''}`}>
            <div className="editor-topbar">
              <div className="editor-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>

              <div className="editor-filename">lesson.js</div>
              <div className="editor-language">JavaScript</div>
            </div>

            <div className="editor-body">
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
                    <div className="start-title">Open lesson.js and start typing</div>
                    <div className="start-sub">
                      Type the code exactly as shown to complete the lesson
                    </div>
                  </div>
                </div>
              )}

              <ChunkGrid target={target} typed={typed} />
            </div>
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

        <div className="practice-insight">
          <div className="insight-card">
            <div className="insight-title">LIVE EXPLANATION</div>
            <div className="insight-text">{explanation}</div>
          </div>

          <div className="insight-card">
            <div className="insight-title">EXECUTION PREVIEW</div>
            <div className="insight-text">{preview}</div>
          </div>

          <div className={`insight-card console-card ${consoleResult.status}`}>
            <div className="insight-title">CONSOLE OUTPUT</div>

            <div className="console-shell">
              <div className="console-header">
                <span className="console-label">lesson-console</span>
                <span className="console-state">
                  {consoleResult.status === 'success'
                    ? 'READY'
                    : consoleResult.status === 'building'
                    ? 'BUILDING'
                    : consoleResult.status === 'error'
                    ? 'WAITING / INCOMPLETE'
                    : 'IDLE'}
                </span>
              </div>

              <div className="console-body">
                {consoleResult.lines.map((line, idx) => (
                  <div key={idx} className="console-line">
                    <span className="console-prompt">&gt;</span>
                    <span className="console-text">{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
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

  function getCurrentLineIndex() {
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (typed.length >= lineStarts[i]) return i
    }
    return 0
  }

  function getTokenClass(line, charIndex) {
    const keywords = ['function', 'return', 'const', 'let', 'if', 'else', 'for', 'console', 'log']
    const punctuationChars = '{}()[];,.+-=*/<>!&|'

    for (const keyword of keywords) {
      const before = charIndex === 0 ? ' ' : line[charIndex - 1]
      const slice = line.slice(charIndex, charIndex + keyword.length)
      const after = line[charIndex + keyword.length] ?? ' '

      const beforeOk = !/[A-Za-z0-9_$]/.test(before)
      const afterOk = !/[A-Za-z0-9_$]/.test(after)

      if (slice === keyword && beforeOk && afterOk) return ' keyword'
    }

    if (/\d/.test(line[charIndex])) return ' number'
    if (punctuationChars.includes(line[charIndex])) return ' punctuation'

    return ''
  }

  function getStringMask(line) {
    const mask = Array(line.length).fill(false)
    let quote = null

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]

      if (!quote && (ch === '"' || ch === "'" || ch === '`')) {
        quote = ch
        mask[i] = true
      } else if (quote) {
        mask[i] = true
        if (ch === quote && line[i - 1] !== '\\') {
          quote = null
        }
      }
    }

    return mask
  }

  const currentLineIndex = getCurrentLineIndex()

  return (
    <div className="type-grid">
      {lines.map((line, lineIdx) => {
        const chars = line.split('')
        const startIndex = lineStarts[lineIdx]
        const isEmptyLine = line.length === 0
        const lineEndIndex = startIndex + line.length
        const cursorOnEmptyLine = isEmptyLine && typed.length === startIndex
        const stringMask = getStringMask(line)

        const lineFinished =
          !isEmptyLine &&
          typed.length >= lineEndIndex &&
          typed.slice(startIndex, lineEndIndex) === line

        const showNextLineIndicator =
          lineIdx === currentLineIndex + 1 &&
          currentLineIndex < lines.length - 1 &&
          typed.length === lineStarts[lineIdx]

        return (
          <div
            key={lineIdx}
            className={`type-line ${showNextLineIndicator ? 'next-line-active' : ''} ${lineFinished ? 'line-finished-row' : ''}`}
          >
            <div
              className={`line-number ${showNextLineIndicator ? 'line-number-next' : ''}`}
            >
              {lineIdx + 1}
            </div>

            <div className="code-line">
              {showNextLineIndicator && (
                <span className="next-line-indicator" aria-hidden="true">
                  ↳
                </span>
              )}

              {isEmptyLine ? (
                <span
                  className={`char empty-line-marker ${cursorOnEmptyLine ? 'cursor' : ''}`}
                >
                  {'\u00A0'}
                </span>
              ) : (
                chars.map((ch, i) => {
                  const idx = startIndex + i
                  const typedChar = typed[idx]

                  let cls = 'char'
                  if (typedChar != null) cls += typedChar === ch ? ' correct' : ' wrong'
                  else if (idx === typed.length) cls += ' cursor'

                  if (stringMask[i]) cls += ' string'
                  else cls += getTokenClass(line, i)

                  if (lineFinished) cls += ' line-complete-flash'

                  return (
                    <span key={i} className={cls}>
                      {ch === ' ' ? '\u00A0' : ch}
                    </span>
                  )
                })
              )}

              {lineFinished && (
                <span className="line-complete-badge" aria-hidden="true">
                  ✔
                </span>
              )}
            </div>
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