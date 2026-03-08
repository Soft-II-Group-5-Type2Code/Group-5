import { NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import '../styles/navbar.css'

import { UNITS } from '../data/units'
import { loadProgress, getResumePracticeRoute } from '../utils/progress'

export default function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const progress = loadProgress()
  const practiceRoute = getResumePracticeRoute(UNITS, progress)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <NavLink to="/lessons" className="navbar-brand">
          Type2Code
        </NavLink>

        {user && (
          <div className="navbar-links">
            <NavLink
              to={practiceRoute}
              className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
            >
              Practice
            </NavLink>

            <NavLink
              to="/game"
              className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
            >
              Games
            </NavLink>
          </div>
        )}
      </div>

      {user && (
        <div className="navbar-user">
          <Link to="/settings" className="navbar-settings">
            ⚙️
          </Link>
          <span className="navbar-username">{user.username}</span>
          <button className="btn-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}
    </nav>
  )
}