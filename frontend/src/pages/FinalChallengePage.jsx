import { useState, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import NavBar from '../components/NavBar'
import '../styles/challenge.css'

import { UNITS } from '../data/units'
import { runCode } from '../api/execute'
import {
  loadProgress,
  saveProgress,
  isFinalChallengeCompleted,
  markFinalChallengeCompleted,
} from '../utils/progress'

export default function FinalChallengePage() {
  const { unitId } = useParams()
  const navigate = useNavigate()

  const unit = useMemo(
    () => UNITS.find((u) => u.id === Number(unitId)) || UNITS[0],
    [unitId]
  )
  const challenge = unit.finalChallenge

  const progress = loadProgress()
  const alreadyDone = isFinalChallengeCompleted(progress, unit.id)

  const [code, setCode] = useState(challenge.starterCode)
  const [output, setOutput] = useState(null)
  const [errorText, setErrorText] = useState(null)
  const [running, setRunning] = useState(false)
  const [passed, setPassed] = useState(false)
  const [wrong, setWrong] = useState(false)

  const handleRun = useCallback(() => {
    setRunning(true)
    setOutput(null)
    setErrorText(null)
    setPassed(false)
    setWrong(false)

    try {
      const result = runCode(code)

      const stdout = result.stdout || ''
      const stderr = result.stderr || ''

      if (stderr) {
        setErrorText(stderr)
        setOutput(stdout || null)
      } else {
        setOutput(stdout)
      }

      if (!stderr) {
        const actual = stdout.trim().toLowerCase()
        const expected = challenge.expectedOutput.trim().toLowerCase()
        if (actual === expected) {
          setPassed(true)
        } else {
          setWrong(true)
        }
      }
    } catch (err) {
      setErrorText(err?.message || 'An unexpected error occurred.')
    } finally {
      setRunning(false)
    }
  }, [code, challenge])

  function handleComplete() {
    const current = loadProgress()
    const next = markFinalChallengeCompleted(current, unit.id)
    saveProgress(next)
    navigate('/lessons')
  }

  return (
    <div className="app-shell">
      <NavBar />

      <main className="challenge-shell">
        <div className="challenge-top">
          <div>
            <h1 className="challenge-h1">{unit.title}</h1>
            <div className="challenge-sub">Final Challenge</div>
          </div>
          <Link to="/lessons" className="challenge-back">
            ← Back to Lessons
          </Link>
        </div>

        {alreadyDone && (
          <div className="challenge-already-done">
            You already completed this challenge.
          </div>
        )}

        <div className="challenge-prompt">{challenge.prompt}</div>

        <CodeMirror
          value={code}
          onChange={(val) => setCode(val)}
          extensions={[javascript()]}
          theme="dark"
          className="challenge-editor-cm"
          basicSetup={{
            lineNumbers: true,
            bracketMatching: true,
            autocompletion: false,
            foldGutter: false,
          }}
        />

        <div className="challenge-run-row">
          <button className="btn-run" onClick={handleRun} disabled={running}>
            {running ? 'Running…' : 'Run Code'}
          </button>
        </div>

        {(output !== null || errorText) && (
          <>
            <div className="challenge-output-label">Output</div>
            <div className="challenge-output">
              {output && <span>{output}</span>}
              {errorText && (
                <span className="challenge-error">{errorText}</span>
              )}
            </div>
          </>
        )}

        {wrong && (
          <div className="challenge-wrong">
            <span className="challenge-wrong-msg">Incorrect output</span>
            <span className="challenge-wrong-expected">
              Expected: <code>{challenge.expectedOutput}</code>
            </span>
          </div>
        )}

        {passed && !alreadyDone && (
          <div className="challenge-passed">
            <span className="challenge-passed-msg">Passed!</span>
            <button className="btn-complete" onClick={handleComplete}>
              Mark Complete
            </button>
          </div>
        )}

        {passed && alreadyDone && (
          <div className="challenge-passed">
            <span className="challenge-passed-msg">Correct output!</span>
            <Link to="/lessons" className="btn-complete" style={{ textDecoration: 'none', display: 'inline-block' }}>
              Back to Lessons
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
