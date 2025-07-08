import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import HomePage from './components/pages/Homepage'
import CalibrationPage from './components/pages/callibrationPage' // <-- make sure this exists
import MainLayout from './components/Layout/MainLayout'
import QuickLinks from './components/pages/QuickLinks'

function App(): React.JSX.Element {
  const [isLoggedIn, setIsLoggedIn] = useState(false) // Manage login state

  const handleLoginSuccess = () => {
    setIsLoggedIn(true)
    // Potentially store login status in localStorage/sessionStorage here
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    // Clear any stored login tokens/sessions
    // The navigate is handled by Navbar's Logout button
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/calibration" element={<CalibrationPage />} />
        <Route
          path="/dashboard"
          element={
            <MainLayout
              isLoggedIn={isLoggedIn}
              onLogout={handleLogout}
              onLoginSuccess={handleLoginSuccess}
            />
          }
        />
        <Route path="/quick-links" element={<QuickLinks />} />
      </Routes>
    </Router>
  )
}

export default App
