import React, { useState } from 'react'
import './AuthPage.css'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

type LoginPageProps = {
  onSwitchToSignup: () => void
  onGoBack: () => void
  onSwitchToForgotPassword: () => void
  onLoginSuccess: () => void
}

export default function LoginPage({
  onSwitchToSignup,
  onGoBack,
  onSwitchToForgotPassword,
  onLoginSuccess
}: LoginPageProps): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setMessage('Logging in...')
    try {
      await login(email, password)
      setMessage('Login successful!')
      onLoginSuccess()
      navigate('/dashboard')
    } catch (error) {
      if (error instanceof Error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage('An unknown error occurred during login.')
      }
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-button-container">
        <button className="auth-back-button" onClick={onGoBack}>
          &larr; Back
        </button>
      </div>

      <h2 className="auth-title">Sign in to your account</h2>

      <form onSubmit={handleSubmit}>
        <div className="auth-form-group">
          <input
            type="email"
            placeholder="Enter your email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
          />
        </div>

        <div className="auth-form-group">
          <input
            type="password"
            placeholder="Enter password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
          />
        </div>

        <div style={{ textAlign: 'right', marginBottom: '20px' }}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              onSwitchToForgotPassword()
            }}
            className="auth-link"
          >
            Forgot Password?
          </a>
        </div>

        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? 'Logging In...' : 'Sign In'}
        </button>
      </form>

      {message && (
        <p
          className="auth-text-center"
          style={{ color: message.startsWith('Error') ? 'red' : 'green', marginTop: '15px' }}
        >
          {message}
        </p>
      )}

      <p className="auth-text-center">
        Don&#39;t have an account?{' '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            onSwitchToSignup()
          }}
          className="auth-link"
        >
          Sign Up
        </a>
      </p>
    </div>
  )
}
