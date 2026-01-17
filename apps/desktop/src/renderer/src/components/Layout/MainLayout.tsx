import { useEffect, useState } from 'react'
import Navbar from './Navbar'
import Header from './Header'
import './MainLayout.css'
import AccountPage from '../pages/AccountPage'
import SettingsPage from '../pages/SettingsPage'
//import HomePage from '../pages/Homepage';

type Props = {
  onLogout: () => void
  isLoggedIn: boolean
  onLoginSuccess: () => void
}

export default function MainLayout({ onLogout, isLoggedIn, onLoginSuccess }: Props) {
  const [page, setPage] = useState<'account' | 'settings'>(isLoggedIn ? 'settings' : 'account')

  useEffect(() => {
    setPage(isLoggedIn ? 'settings' : 'account')
  }, [isLoggedIn])

  return (
    <div className="layout">
      <Navbar onSelect={setPage} onLogout={onLogout} isLoggedIn={isLoggedIn} />
      <div className="main-content">
        <Header />
        <div className="page-content">
          {page === 'account' && (
            <AccountPage onLoginSuccess={onLoginSuccess} onSignupSuccess={onLoginSuccess} />
          )}
          {page === 'settings' && <SettingsPage />}
        </div>
      </div>
    </div>
  )
}
