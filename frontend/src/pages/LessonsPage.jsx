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
        <div className="lessons-topline">
          <button onClick={toggleLocks} className="unlock-toggle">
            {locksDisabled ? 'Enable Locks' : 'Disable Locks (Dev)'}
          </button>
        </div>

        <h1 className="lessons-title">Lessons</h1>

        <div className="lessons-metrics" style={{ marginBottom: '1.25rem' }}>
          {isLoading && <div className="tile-muted">Loading stats…</div>}

          {!isLoading && showGlobalError && (
            <div style={{ color: 'red' }}>Practice data is temporarily unavailable.</div>
          )}

          {!statsLoading && stats && (
            <>
              <div className="tile-muted">Total Sessions: {stats.total_sessions ?? 0}</div>
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

          {!statsLoading && !stats && !statsError && (
            <div className="tile-muted">No stats yet.</div>
          )}
        </div>

        {sessionsError && !statsError && (
          <div className="tile-muted" style={{ marginBottom: '1rem' }}>
            Recent sessions could not be loaded right now.
          </div>
        )}

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
            ? shortText(nextLesson.learnText || nextLesson.label || unit.title)
            : `All ${unit.title} lessons completed.`

          const finalChallengeLocked = !locksDisabled && !unitComplete
          const finalChallengeCompleted = isFinalChallengeCompleted(progress, unit.id)

          const finalChallengeFocus = shortText(unit.finalChallenge?.prompt || '')

          const categoryTile = (
            <div className={`tile ${unitLocked ? 'locked' : ''}`}>
              <div className="tile-num">{unit.id}</div>

              <div className="tile-body">
                <div className="tile-name">{unit.title}</div>

                <div className="tile-focus">
                  {categoryFocus}

                  <div style={{ marginTop: 10, opacity: 0.8 }}>
                    Progress: {completedCount}/{totalCount} lessons
                  </div>
                </div>
              </div>

              <div className="tile-footer">
                {unitLocked
                  ? 'Locked'
                  : unitComplete
                  ? 'Review / Challenge'
                  : completedCount > 0
                  ? 'Continue'
                  : 'Start'}
              </div>
            </div>
          )

          const challengeTile = (
            <div className={`tile ${finalChallengeLocked ? 'locked' : ''}`}>
              <div className="tile-num">★</div>

              <div className="tile-body">
                <div className="tile-name">
                  {unit.finalChallenge?.label || 'Final Challenge'}
                </div>

                <div className="tile-focus">{finalChallengeFocus}</div>
              </div>

              <div className="tile-footer">
                {finalChallengeLocked
                  ? 'Finish category first'
                  : finalChallengeCompleted
                  ? 'Completed'
                  : 'Start Challenge'}
              </div>
            </div>
          )

          return (
            <section key={unit.id} style={{ marginBottom: '2rem' }}>
              <h2 style={{ margin: '0 0 0.75rem', fontWeight: 900 }}>
                {unit.title}
              </h2>

              <div className="lessons-grid">
                {unitLocked ? (
                  <div>{categoryTile}</div>
                ) : (
                  <Link className="tile-link" to={categoryLink}>
                    {categoryTile}
                  </Link>
                )}

                {unit.finalChallenge &&
                  (finalChallengeLocked ? (
                    <div>{challengeTile}</div>
                  ) : (
                    <Link className="tile-link" to={`/challenge/${unit.id}`}>
                      {challengeTile}
                    </Link>
                  ))}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}