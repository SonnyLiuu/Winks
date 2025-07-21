import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import HomePage from './components/pages/Homepage'
import CalibrationPage from './components/pages/callibrationPage' // <-- make sure this exists
import MainLayout from './components/Layout/MainLayout'
import QuickLinks from './components/pages/QuickLinks'
import AddProgram from './components/pages/AddProgram/AddProgram'

function App(): React.JSX.Element {
  const { isLoggedIn, logout, user } = useAuth()

  const handleLoginSuccess = (): void => {
    // This function is now primarily handled by AuthContext.
    // We can keep this for any additional logic if needed, or remove it.
    console.log('Login successful for user:', user?.email)
  }

  const handleLogout = (): void => {
    logout()
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
        <Route path="/add-program" element={<AddProgram />} />
      </Routes>
    </Router>
  )
}

export default App
