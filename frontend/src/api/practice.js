import axios from 'axios'

// Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  withCredentials: true,
})

/**
 * Start a new practice session
 */
export async function startPractice(lessonId, mode = 'practice') {
  const { data } = await api.post('/api/practice/start', {
    lesson_id: lessonId,
    mode,
    metadata: {},
  })
  return data
}

/**
 * Submit practice results
 */
export async function submitPractice(payload) {
  const { data } = await api.post('/api/practice/submit', payload)
  return data
}

/**
 * Fetch aggregated practice stats
 */
export async function fetchPracticeStats(window = 200) {
  const { data } = await api.get('/api/practice/stats', {
    params: { window },
  })
  return data
}

/**
 * Fetch recent submitted sessions for dashboard/lessons page
 */
export async function fetchRecentSessions(limit = 10) {
  const { data } = await api.get('/api/practice/sessions/recent', {
    params: { limit },
  })
  return data
}

/**
 * Fetch session history with pagination
 */
export async function fetchPracticeSessions(limit = 20, offset = 0) {
  const { data } = await api.get('/api/practice/sessions', {
    params: { limit, offset },
  })
  return data
}

/**
 * Fetch per-lesson aggregated stats
 */
export async function fetchLessonStats(window = 500) {
  const { data } = await api.get('/api/practice/stats/by-lesson', {
    params: { window },
  })
  return data
}

/**
 * Fetch WPM / accuracy trend data
 */
export async function fetchPracticeTrends(window = 100) {
  const { data } = await api.get('/api/practice/stats/trends', {
    params: { window },
  })
  return data
}