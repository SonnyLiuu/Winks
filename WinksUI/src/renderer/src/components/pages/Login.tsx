import React, { useState, useEffect } from 'react'
import './AuthPage.css'
import {useNavigate} from "react-router-dom";

export default function LoginPage({
  onSwitchToSignup,
  onGoBack,
  onSwitchToForgotPassword
}: {
  onSwitchToSignup: () => void
  onGoBack: () => void
  onSwitchToForgotPassword: () => void
}): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const cleanup = window.electron.on('login-response', (response: any) => {
      if (response.success) {
        setMessage('Login successful!')
        // Ideally, store user session/token here
        setTimeout(() => navigate('/dashboard'), 1000)
      } else {
        setMessage(`Error: ${response.message}`)
      }
    })
    return () => {
      if (cleanup) cleanup()
    }
  }, [navigate])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    setMessage('Logging in...')
    window.electron.send('login-user', { email, password })
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
          <a href="#" onClick={onSwitchToForgotPassword} className="auth-link">
            Forgot Password?
          </a>
        </div>

        <button type="submit" className="auth-button">
          Sign In
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
        <a href="#" onClick={onSwitchToSignup} className="auth-link">
          Sign Up
        </a>
      </p>
    </div>
  )
}
