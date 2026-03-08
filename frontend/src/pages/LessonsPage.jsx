import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import '../styles/lessonsGrid.css'

import { UNITS } from '../data/units'
import {
  loadProgress,
  isCompleted,
  isFinalChallengeCompleted,
  getUnlocksOverride,
  setUnlocksOverride,
  getNextIncompleteLesson,
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

function isUnitCompleted(unit, progress) {
  return unit.lessons.every((lesson) =>
    isCompleted(progress, unit.id, lesson.stepId)
  )
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function retryOnce(fn, label, fallbackValue) {
  try {
    return await fn()
  } catch (err) {
    console.warn(`${label} failed, retrying once...`, err)
    await wait(400)

    try {
      return await fn()
    } catch (err2) {
      console.error(`${label} failed again:`, err2)
      return fallbackValue
    }
  }
}

export default function LessonsPage() {
  const progress = loadProgress()

  const [locksDisabled, setLocksDisabled] = useState(() =>
    getUnlocksOverride()
  )

  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])

  const [statsLoading, setStatsLoading] = useState(true)
  const [sessionsLoading, setSessionsLoading] = useState(true)

  const [statsError, setStatsError] = useState('')
  const [sessionsError, setSessionsError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadBackendData() {
      setStatsLoading(true)
      setSessionsLoading(true)
      setStatsError('')
      setSessionsError('')

      const [statsData, sessionsData] = await Promise.all([
        retryOnce(() => fetchPracticeStats(200), 'stats', null),
        retryOnce(() => fetchRecentSessions(10), 'recent sessions', { sessions: [] }),
      ])

      if (cancelled) return

      if (statsData == null) {
        setStats(null)
        setStatsError('Failed to load stats.')
      } else {
        setStats(statsData)
      }

      const normalizedSessions = Array.isArray(sessionsData?.sessions)
        ? sessionsData.sessions
        : Array.isArray(sessionsData)
        ? sessionsData
        : []

      if (sessionsData == null) {
        setSessions([])
        setSessionsError('Failed to load recent sessions.')
      } else {
        setSessions(normalizedSessions)
      }

      setStatsLoading(false)
      setSessionsLoading(false)
    }

    loadBackendData()

    return () => {
      cancelled = true
    }
  }, [])

  function toggleLocks() {
    const next = !locksDisabled
    setLocksDisabled(next)
    setUnlocksOverride(next)
  }

  const showGlobalError = statsError && sessionsError
  const isLoading = statsLoading || sessionsLoading

  return (
    <>
      <NavBar />

      <div className="lessons-shell">
        <div className="lessons-topbar">
          <div>
            <div className="lessons-kicker">TYPE2CODE // LEARNING DASHBOARD</div>
            <h1 className="lessons-title">Lessons</h1>
            <p className="lessons-subtitle">
              Pick up where you left off, review a category, or jump into a final challenge.
            </p>
          </div>

          <button onClick={toggleLocks} className="unlock-toggle">
            {locksDisabled ? 'Enable Locks' : 'Disable Locks (Dev)'}
          </button>
        </div>

        <div className="lessons-layout">
          <section className="lessons-main">
            <div className="category-row">
              {UNITS.map((unit, unitIndex) => {
                const prevUnit = UNITS[unitIndex - 1]

                const unitLocked =
                  !locksDisabled &&
                  unitIndex > 0 &&
                  prevUnit &&
                  !isUnitCompleted(prevUnit, progress)

                const nextLesson = getNextIncompleteLesson(unit, progress)

                const completedCount = unit.lessons.filter((lesson) =>
                  isCompleted(progress, unit.id, lesson.stepId)
                ).length

                const totalCount = unit.lessons.length
                const unitComplete = isUnitCompleted(unit, progress)

                const categoryLink = unitLocked
                  ? null
                  : nextLesson
                  ? `/practice/${unit.id}/${nextLesson.stepId}`
                  : `/challenge/${unit.id}`

                const categoryFocus = nextLesson
                  ? shortText(nextLesson.learnText || nextLesson.label || unit.title, 120)
                  : `All ${unit.title} lessons completed.`

                const categoryTile = (
                  <div className={`lesson-card tall ${unitLocked ? 'locked' : ''}`}>
                    <div className="lesson-card-top">
                      <div className="lesson-badge">{unit.id}</div>
                      <div className="lesson-status">
                        {unitLocked
                          ? 'Locked'
                          : unitComplete
                          ? 'Completed'
                          : completedCount > 0
                          ? 'In Progress'
                          : 'Start'}
                      </div>
                    </div>

                    <div className="lesson-card-body">
                      <h2 className="lesson-card-title">{unit.title}</h2>
                      <p className="lesson-card-text">{categoryFocus}</p>
                    </div>

                    <div className="lesson-card-footer">
                      <div className="lesson-progress-text">
                        {completedCount}/{totalCount} lessons complete
                      </div>
                      <div className="lesson-progress-bar">
                        <div
                          className="lesson-progress-fill"
                          style={{
                            width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <div className="lesson-action">
                        {unitLocked
                          ? 'Locked'
                          : unitComplete
                          ? 'Review / Challenge'
                          : completedCount > 0
                          ? 'Continue'
                          : 'Start'}
                      </div>
                    </div>
                  </div>
                )

                return unitLocked ? (
                  <div key={unit.id}>{categoryTile}</div>
                ) : (
                  <Link key={unit.id} className="tile-link" to={categoryLink}>
                    {categoryTile}
                  </Link>
                )
              })}
            </div>

            <section className="challenge-section">
              <div className="challenge-header">
                <h2 className="challenge-title">Final Challenges</h2>
                <p className="challenge-subtitle">
                  Finish a category, then test yourself with a full mini-project.
                </p>
              </div>

              <div className="challenge-row">
                {UNITS.map((unit, unitIndex) => {
                  const prevUnit = UNITS[unitIndex - 1]

                  const unitLocked =
                    !locksDisabled &&
                    unitIndex > 0 &&
                    prevUnit &&
                    !isUnitCompleted(prevUnit, progress)

                  const unitComplete = isUnitCompleted(unit, progress)
                  const finalChallengeLocked = unitLocked || (!locksDisabled && !unitComplete)
                  const finalChallengeCompleted = isFinalChallengeCompleted(progress, unit.id)

                  if (!unit.finalChallenge) return null

                  const finalChallengeFocus = shortText(
                    unit.finalChallenge?.prompt || '',
                    95
                  )

                  const challengeTile = (
                    <div
                      className={`lesson-card challenge ${finalChallengeLocked ? 'locked' : ''}`}
                    >
                      <div className="lesson-card-top">
                        <div className="lesson-badge star">★</div>
                        <div className="lesson-status">
                          {finalChallengeLocked
                            ? 'Locked'
                            : finalChallengeCompleted
                            ? 'Completed'
                            : 'Ready'}
                        </div>
                      </div>

                      <div className="lesson-card-body">
                        <h3 className="lesson-card-title">
                          {unit.finalChallenge?.label || 'Final Challenge'}
                        </h3>
                        <div className="lesson-card-unit">{unit.title}</div>
                        <p className="lesson-card-text">{finalChallengeFocus}</p>
                      </div>

                      <div className="lesson-card-footer">
                        <div className="lesson-action">
                          {finalChallengeLocked
                            ? 'Finish category first'
                            : finalChallengeCompleted
                            ? 'Open Again'
                            : 'Start Challenge'}
                        </div>
                      </div>
                    </div>
                  )

                  return finalChallengeLocked ? (
                    <div key={`challenge-${unit.id}`}>{challengeTile}</div>
                  ) : (
                    <Link
                      key={`challenge-${unit.id}`}
                      className="tile-link"
                      to={`/challenge/${unit.id}`}
                    >
                      {challengeTile}
                    </Link>
                  )
                })}
              </div>
            </section>
          </section>

          <aside className="stats-panel">
            <div className="stats-card">
              <h2 className="stats-title">Practice Stats</h2>

              {isLoading && <div className="tile-muted">Loading stats…</div>}

              {!isLoading && showGlobalError && (
                <div className="stats-error">Practice data is temporarily unavailable.</div>
              )}

              {!statsLoading && stats && (
                <div className="stats-list">
                  <div className="stat-row">
                    <span>Total Sessions</span>
                    <strong>{stats.total_sessions ?? 0}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Avg WPM</span>
                    <strong>
                      {stats.avg_wpm == null ? '—' : Number(stats.avg_wpm).toFixed(1)}
                    </strong>
                  </div>
                  <div className="stat-row">
                    <span>Best WPM</span>
                    <strong>
                      {stats.best_wpm == null ? '—' : Number(stats.best_wpm).toFixed(1)}
                    </strong>
                  </div>
                  <div className="stat-row">
                    <span>Avg Accuracy</span>
                    <strong>{formatAccuracy(stats.avg_accuracy)}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Best Accuracy</span>
                    <strong>{formatAccuracy(stats.best_accuracy)}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Total Time</span>
                    <strong>{stats.total_time_seconds ?? 0}s</strong>
                  </div>
                  <div className="stat-row">
                    <span>Last 30 Days</span>
                    <strong>{stats.last_30_days_time_seconds ?? 0}s</strong>
                  </div>
                  <div className="stat-row stat-row-stack">
                    <span>Most Practiced</span>
                    <strong>
                      {stats.most_practiced_lesson_id
                        ? LESSON_MAP[stats.most_practiced_lesson_id]?.label ?? 'Lesson'
                        : '—'}
                    </strong>
                  </div>
                </div>
              )}

              {!statsLoading && !stats && !statsError && (
                <div className="tile-muted">No stats yet.</div>
              )}
            </div>

            <div className="stats-card">
              <h3 className="stats-title small">Recent Activity</h3>

              {sessionsLoading && <div className="tile-muted">Loading recent sessions…</div>}

              {!sessionsLoading && sessionsError && (
                <div className="tile-muted">Recent sessions could not be loaded.</div>
              )}

              {!sessionsLoading && !sessionsError && sessions.length === 0 && (
                <div className="tile-muted">No recent sessions yet.</div>
              )}

              {!sessionsLoading && !sessionsError && sessions.length > 0 && (
                <div className="recent-list">
                  {sessions.slice(0, 5).map((session, idx) => {
                    const lessonMeta = session.lesson_id
                      ? LESSON_MAP[session.lesson_id]
                      : null

                    return (
                      <div className="recent-item" key={session.id || idx}>
                        <div className="recent-top">
                          <strong>{lessonMeta?.label || 'Practice Session'}</strong>
                          <span>{lessonMeta?.unit || 'Lesson'}</span>
                        </div>

                        <div className="recent-meta">
                          <span>
                            WPM:{' '}
                            {session.wpm == null ? '—' : Number(session.wpm).toFixed(1)}
                          </span>
                          <span>Accuracy: {formatAccuracy(session.accuracy)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}