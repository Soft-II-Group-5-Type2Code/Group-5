import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { Link } from "react-router-dom";
import '../styles/navbar.css'

export default function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

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
              to="/practice/1/1"
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
