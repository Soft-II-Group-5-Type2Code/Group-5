const KEY = 'type2code_progress_v1'

// --- Tester setting: unlock override (local only) ---
export const UNLOCKS_KEY = 'type2code_unlocks_override_v1'
// value "off" => locks disabled

const LAST_PRACTICE_KEY = 'type2code_last_practice_route_v1'

export function getUnlocksOverride() {
  return localStorage.getItem(UNLOCKS_KEY) === 'off'
}

export function setUnlocksOverride(disableLocks) {
  localStorage.setItem(UNLOCKS_KEY, disableLocks ? 'off' : 'on')
}

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { completed: {} }
  } catch {
    return { completed: {} }
  }
}

export function saveProgress(progress) {
  localStorage.setItem(KEY, JSON.stringify(progress))
}

export function isCompleted(progress, unitId, stepId) {
  return (progress.completed?.[unitId] || []).includes(stepId)
}

export function markCompleted(progress, unitId, stepId) {
  const next = {
    ...progress,
    completed: { ...(progress.completed || {}) },
  }

  const arr = next.completed[unitId]
    ? [...next.completed[unitId]]
    : []

  if (!arr.includes(stepId)) arr.push(stepId)
  arr.sort((a, b) => a - b)

  next.completed[unitId] = arr
  return next
}

export function isFinalChallengeCompleted(progress, unitId) {
  return !!(progress.finalChallenges?.[unitId])
}

export function markFinalChallengeCompleted(progress, unitId) {
  return {
    ...progress,
    finalChallenges: { ...(progress.finalChallenges || {}), [unitId]: true },
  }
}

export function computeLocks(units, progress) {
  // tester override: everything unlocked
  if (getUnlocksOverride()) {
    const unlocked = {}
    for (const u of units) {
      unlocked[u.id] = {}
      for (const s of u.lessons) unlocked[u.id][s.stepId] = false
    }
    return unlocked
  }

  const locks = {}

  for (let u = 0; u < units.length; u++) {
    const unit = units[u]
    locks[unit.id] = {}

    const prevUnit = units[u - 1]
    const unitLocked =
      u > 0 &&
      prevUnit.lessons.some(
        (s) => !isCompleted(progress, prevUnit.id, s.stepId)
      )

    for (let i = 0; i < unit.lessons.length; i++) {
      const step = unit.lessons[i]

      if (unitLocked) {
        locks[unit.id][step.stepId] = true
        continue
      }

      if (i === 0) {
        locks[unit.id][step.stepId] = false
        continue
      }

      const prev = unit.lessons[i - 1]
      locks[unit.id][step.stepId] = !isCompleted(
        progress,
        unit.id,
        prev.stepId
      )
    }
  }

  return locks
}

export function getNextIncompleteLesson(unit, progress) {
  return (
    unit.lessons.find((lesson) => !isCompleted(progress, unit.id, lesson.stepId)) ||
    unit.lessons[0] ||
    null
  )
}

export function getFirstAvailablePracticeRoute(units, progress) {
  for (const unit of units) {
    const lesson = getNextIncompleteLesson(unit, progress)
    if (lesson) {
      return `/practice/${unit.id}/${lesson.stepId}`
    }
  }

  return '/lessons'
}

export function saveLastPracticeRoute(unitId, stepId) {
  localStorage.setItem(
    LAST_PRACTICE_KEY,
    JSON.stringify({
      unitId: Number(unitId),
      stepId: Number(stepId),
    })
  )
}

export function loadLastPracticeRoute() {
  try {
    const raw = JSON.parse(localStorage.getItem(LAST_PRACTICE_KEY))
    if (!raw) return null

    const unitId = Number(raw.unitId)
    const stepId = Number(raw.stepId)

    if (!Number.isFinite(unitId) || !Number.isFinite(stepId)) return null

    return { unitId, stepId }
  } catch {
    return null
  }
}

export function getResumePracticeRoute(units, progress) {
  const last = loadLastPracticeRoute()

  if (last) {
    const unit = units.find((u) => u.id === last.unitId)
    const lesson = unit?.lessons.find((l) => l.stepId === last.stepId)

    if (unit && lesson && !isCompleted(progress, unit.id, lesson.stepId)) {
      return `/practice/${unit.id}/${lesson.stepId}`
    }
  }

  return getFirstAvailablePracticeRoute(units, progress)
}