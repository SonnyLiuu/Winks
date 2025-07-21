import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  loginUser as apiLogin,
  registerUser as apiSignup,
  updateUserSettings as apiUpdateSettings
} from '../../../services/api'
import { User, Settings } from '../../../types'

interface AuthContextType {
  user: User | null
  isLoggedIn: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => void
  updateUserSettings: (settings: Settings) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
        setIsLoggedIn(true)
      } catch (error) {
        console.error('Failed to parse user from localStorage', error)
        localStorage.removeItem('user')
      }
    }
  }, [])

  const handleLoginSuccess = (userData: User): void => {
    setUser(userData)
    setIsLoggedIn(true)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const login = async (email, password): Promise<void> => {
    const response = await apiLogin(email, password)
    if (response.success && response.user) {
      handleLoginSuccess(response.user)
    } else {
      throw new Error(response.message || 'Login failed')
    }
  }

  const signup = async (email, password): Promise<void> => {
    const response = await apiSignup(email, password)
    if (response.success && response.user) {
      handleLoginSuccess(response.user)
    } else {
      throw new Error(response.message || 'Signup failed')
    }
  }

  const logout = (): void => {
    setUser(null)
    setIsLoggedIn(false)
    localStorage.removeItem('user')
  }

  const updateUserSettings = async (settings: Settings): Promise<void> => {
    if (!user?.id) {
      throw new Error('You must be logged in to update settings.')
    }
    const response = await apiUpdateSettings(user.id, settings)
    if (response.success) {
      // Update local user state
      const updatedUser = { ...user, settings: { ...user.settings, ...settings } }
      setUser(updatedUser)
      localStorage.setItem('user', JSON.stringify(updatedUser))
    } else {
      throw new Error(response.message || 'Failed to update settings')
    }
  }

  const value = {
    user,
    isLoggedIn,
    login,
    signup,
    logout,
    updateUserSettings
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
