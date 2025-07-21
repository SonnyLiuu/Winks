import React, { useState } from 'react'
import './AuthPage.css'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

type SignupPageProps = {
  onSwitchToLogin: () => void
  onGoBack: () => void
  onSignupSuccess: () => void
}

export default function SignupPage({
  onSwitchToLogin,
  onGoBack,
  onSignupSuccess
}: SignupPageProps): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { signup } = useAuth()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setMessage('Signing up...')
    try {
      await signup(email, password)
      setMessage('Account created successfully! Logging you in...')
      onSignupSuccess()
      navigate('/dashboard')
    } catch (error) {
      if (error instanceof Error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage('An unknown error occurred during signup.')
      }
      console.error('Signup error:', error)
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

      <h2 className="auth-title">Sign up for a new account</h2>

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

        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? 'Signing Up...' : 'Sign Up'}
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
        Have an account?{' '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            onSwitchToLogin()
          }}
          className="auth-link"
        >
          Sign in here
        </a>
      </p>
    </div>
  )
}
