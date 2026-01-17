import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

import HomePage from './components/pages/Homepage'
import CalibrationPage from './components/pages/CalibrationPage'
import MainLayout from './components/Layout/MainLayout'
import QuickLinks from './components/pages/QuickLinks'
import AddProgram from './components/pages/AddProgram/AddProgram'


function App(): React.JSX.Element {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setIsLoggedIn(localStorage.getItem('winks:isLoggedIn') === '1')
  }, [])

  const login = () => {
    setIsLoggedIn(true)
    localStorage.setItem('winks:isLoggedIn', '1')
  }

  const logout = () => {
    setIsLoggedIn(false)
    localStorage.removeItem('winks:isLoggedIn')
  }

  const protect = (el: React.ReactElement) => (isLoggedIn ? el : <Navigate to="/" replace />)

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/calibration" element={<CalibrationPage />} />
        <Route
          path="/dashboard"
          element={<MainLayout isLoggedIn={isLoggedIn} onLogout={logout} onLoginSuccess={login} />}
        />
        <Route path="/quick-links" element={protect(<QuickLinks />)} />
        <Route path="/add-program" element={protect(<AddProgram />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
