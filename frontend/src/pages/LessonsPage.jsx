import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import '../styles/lessonsGrid.css'

import { UNITS } from '../data/units'
import {
  loadProgress,
  computeLocks,
  isCompleted,
  isFinalChallengeCompleted,
  getUnlocksOverride,
  setUnlocksOverride,
} from '../utils/progress'

import { fetchPracticeStats, fetchRecentSessions } from '../api/practice'

function shortText(text, max = 110) {
  if (!text) return ''
  const s = String(text).replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function formatAccuracy(a) {
  if (a == null) return '—'
  const n = Number(a)
  if (Number.isNaN(n)) return '—'

  const pct = n <= 1 ? n * 100 : n
  return `${pct.toFixed(1)}%`
}

function buildLessonMap() {
  const map = {}

  UNITS.forEach((unit) => {
    unit.lessons.forEach((lesson) => {
      if (lesson.backendLessonId) {
        map[lesson.backendLessonId] = {
          label: lesson.label || `Lesson ${lesson.stepId}`,
          unit: unit.title,
          stepId: lesson.stepId,
          unitId: unit.id,
        }
      }
    })
  })

  return map
}

const LESSON_MAP = buildLessonMap()

export default function LessonsPage() {
  const progress = loadProgress()

  const [locksDisabled, setLocksDisabled] = useState(() => getUnlocksOverride())
  const locks = useMemo(() => computeLocks(UNITS, progress), [progress])

  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadBackendData() {
      try {
        setLoading(true)
        setError(null)

        const [statsRes, sessionsRes] = await Promise.all([
          fetchPracticeStats(200),
          fetchRecentSessions(10),
        ])

        setStats(statsRes || null)
        setSessions(Array.isArray(sessionsRes?.sessions) ? sessionsRes.sessions : [])
      } catch (err) {
        console.error('Failed to load practice data:', err)
        setError('Failed to load practice data.')
        setStats(null)
        setSessions([])
      } finally {
        setLoading(false)
      }
    }

    loadBackendData()
  }, [])

  function toggleLocks() {
    const next = !locksDisabled
    setLocksDisabled(next)
    setUnlocksOverride(next)
  }

  return (
    <>
      <NavBar />

      <div className="lessons-shell">
        <div className="lessons-topline">
          <button onClick={toggleLocks} className="unlock-toggle">
            {locksDisabled ? 'Enable Locks' : 'Disable Locks (Dev)'}
          </button>
        </div>

        <h1 className="lessons-title">Lessons</h1>

        <div className="lessons-metrics" style={{ marginBottom: '1.25rem' }}>
          {loading && <div className="tile-muted">Loading stats…</div>}

          {error && <div style={{ color: 'red' }}>{error}</div>}

          {!loading && !error && stats && (
            <>
              <div className="tile-muted">
                Total Sessions: {stats.total_sessions ?? 0}
              </div>

              <div className="tile-muted">
                Avg WPM: {stats.avg_wpm == null ? '—' : Number(stats.avg_wpm).toFixed(1)}
              </div>

              <div className="tile-muted">
                Best WPM: {stats.best_wpm == null ? '—' : Number(stats.best_wpm).toFixed(1)}
              </div>

              <div className="tile-muted">
                Avg Accuracy: {formatAccuracy(stats.avg_accuracy)}
              </div>

              <div className="tile-muted">
                Best Accuracy: {formatAccuracy(stats.best_accuracy)}
              </div>

              <div className="tile-muted">
                Total Time: {stats.total_time_seconds ?? 0}s
              </div>

              <div className="tile-muted">
                Last 30 Days: {stats.last_30_days_time_seconds ?? 0}s
              </div>

              <div className="tile-muted">
                Most Practiced:{' '}
                {stats.most_practiced_lesson_id
                  ? LESSON_MAP[stats.most_practiced_lesson_id]?.label ?? 'Lesson'
                  : '—'}
              </div>
            </>
          )}

          {!loading && !error && !stats && (
            <div className="tile-muted">No stats yet.</div>
          )}
        </div>

        {UNITS.map((unit) => {
          const finalChallengeLocked =
            !locksDisabled &&
            unit.lessons.some((lesson) => !isCompleted(progress, unit.id, lesson.stepId))

          const finalChallengeCompleted = isFinalChallengeCompleted(progress, unit.id)
          const finalChallengeFocus = shortText(unit.finalChallenge?.prompt || '', 110)

          return (
            <section key={unit.id} style={{ marginBottom: '2rem' }}>
              <h2 style={{ margin: '0 0 0.75rem', fontWeight: 900 }}>
                {unit.title}
              </h2>

              <div className="lessons-grid">
                {unit.lessons.map((lesson) => {
                  const locked = !locksDisabled && locks?.[unit.id]?.[lesson.stepId]
                  const completed = isCompleted(progress, unit.id, lesson.stepId)

                  const label = lesson.label || `Lesson ${lesson.stepId}`
                  const focus = shortText(lesson.learnText || lesson.focus || '')

                  const tileInner = (
                    <div className={`tile ${locked ? 'locked' : ''}`}>
                      <div className="tile-num">{lesson.stepId}</div>
                      <div className="tile-lock">
                        {locked ? '🔒' : completed ? '✓' : ''}
                      </div>

                      <div className="tile-body">
                        <div className="tile-name">{label}</div>
                        <div className="tile-focus">{focus}</div>
                      </div>

                      <div className="tile-footer">
                        {locked ? (
                          <span className="tile-muted">Locked</span>
                        ) : completed ? (
                          <span>Continue</span>
                        ) : (
                          <span>Start</span>
                        )}
                      </div>
                    </div>
                  )

                  if (locked) {
                    return <div key={lesson.stepId}>{tileInner}</div>
                  }

                  return (
                    <Link
                      key={lesson.stepId}
                      className="tile-link"
                      to={`/practice/${unit.id}/${lesson.stepId}`}
                    >
                      {tileInner}
                    </Link>
                  )
                })}

                {unit.finalChallenge &&
                  (() => {
                    const challengeTile = (
                      <div className={`tile ${finalChallengeLocked ? 'locked' : ''}`}>
                        <div className="tile-num">★</div>
                        <div className="tile-lock">
                          {finalChallengeLocked ? '🔒' : finalChallengeCompleted ? '✓' : ''}
                        </div>

                        <div className="tile-body">
                          <div className="tile-name">
                            {unit.finalChallenge.label || 'Final Challenge'}
                          </div>
                          <div className="tile-focus">{finalChallengeFocus}</div>
                        </div>

                        <div className="tile-footer">
                          {finalChallengeLocked ? (
                            <span className="tile-muted">Finish all lessons</span>
                          ) : finalChallengeCompleted ? (
                            <span>Completed</span>
                          ) : (
                            <span>Start Challenge</span>
                          )}
                        </div>
                      </div>
                    )

                    if (finalChallengeLocked) {
                      return <div key={`challenge-${unit.id}`}>{challengeTile}</div>
                    }

                    return (
                      <Link
                        key={`challenge-${unit.id}`}
                        className="tile-link"
                        to={`/challenge/${unit.id}`}
                      >
                        {challengeTile}
                      </Link>
                    )
                  })()}
              </div>
            </section>
          )
        })}

        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ margin: '0 0 0.75rem', fontWeight: 900 }}>
            Recent Sessions
          </h2>

          {!loading && sessions.length === 0 && (
            <div className="tile-muted">No sessions yet.</div>
          )}

          {sessions.slice(0, 10).map((s) => {
            const lesson = LESSON_MAP[s.lesson_id]
            const lessonText = lesson ? `${lesson.unit} — ${lesson.label}` : 'Unknown Lesson'

            return (
              <div
                key={s.id}
                className="tile-muted"
                style={{ marginBottom: '0.4rem' }}
              >
                {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'} ·{' '}
                {lessonText} · WPM: {s.wpm == null ? '—' : Number(s.wpm).toFixed(1)} ·
                {' '}Acc: {formatAccuracy(s.accuracy)} · Time: {s.time_seconds ?? 0}s
              </div>
            )
          })}
        </section>
      </div>
    </>
  )
}