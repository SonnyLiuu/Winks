import React, { useState, useEffect } from 'react'
import './AuthPage.css'
import { useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()

  useEffect(() => {
    const cleanup = window.electron.on('signup-response', (response: any) => {
      if (response.success) {
        setMessage('Account created successfully! Please log in.')
        setEmail('')
        setPassword('')
        onSignupSuccess()
        navigate('/dashboard')
      } else {
        setMessage(`Error: ${response.message}`)
      }
    })
    return () => {
      if (cleanup) cleanup()
    }
  }, [navigate, onSignupSuccess])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    console.log('Signup form submitted:', { email, password })
    setMessage('Signing up...')
    window.electron.send('signup-user', { email, password })
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

        <button type="submit" className="auth-button">
          Sign Up
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
        <a href="#" onClick={onSwitchToLogin} className="auth-link">
          Sign in here
        </a>
      </p>
    </div>
  )
}
