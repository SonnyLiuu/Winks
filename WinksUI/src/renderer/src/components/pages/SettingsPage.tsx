import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext'

export default function SettingsPage() {
  const { user, updateUserSettings } = useAuth()
  const [leftSensitivity, setLeftSensitivity] = useState(0.5)
  const [rightSensitivity, setRightSensitivity] = useState(0.5)
  const [yaw, setYaw] = useState(45)
  const [pitch, setPitch] = useState(45)
  const [deadZone, setDeadZone] = useState(6)
  const [tiltAngle, setTiltAngle] = useState(20)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const loadSettings = async () => {
      if (user && user.settings) {
        setLeftSensitivity(user.settings.leftWinkSensitivity || 0.5)
        setRightSensitivity(user.settings.rightWinkSensitivity || 0.5)
        setYaw(user.settings.yaw || 45)
        setPitch(user.settings.pitch || 45)
        setDeadZone(user.settings.deadZone || 6)
        setTiltAngle(user.settings.tiltAngle || 20)
      } else {
        // Fallback to local settings for guests
        const localSettings = await window.api.getSettings()
        if (localSettings) {
          setLeftSensitivity(localSettings.leftWinkSensitivity)
          setRightSensitivity(localSettings.rightWinkSensitivity)
          setYaw(localSettings.yaw)
          setPitch(localSettings.pitch)
          setDeadZone(localSettings.deadZone)
          setTiltAngle(localSettings.tiltAngle)
        }
      }
    };
    loadSettings()
  }, [user]);

  const handleSave = async () => {
    const newSettings = {
      leftWinkSensitivity: leftSensitivity,
      rightWinkSensitivity: rightSensitivity,
      yaw: yaw,
      pitch: pitch,
      deadZone: deadZone,
      tiltAngle: tiltAngle
    }

    setMessage('Saving...')
    try {
      if (user) {
        await updateUserSettings(newSettings);
        setMessage('Settings saved to your account!');
      } else {
        window.api.saveSettings(newSettings)
        setMessage('Settings saved locally!')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setMessage(`Error: ${errorMessage}`)
      console.error('Failed to save settings:', error)
    }
  };

  return (
    <div
      style={{
        padding: '48px',
        maxWidth: '750px',
        margin: '60px auto',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.1)',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      <h1 style={{ fontWeight: '600', fontSize: '32px', marginBottom: '12px', textAlign: 'center' }}>
        Settings
      </h1>

      <p style={{ textAlign: 'center', color: '#777', marginBottom: '40px' }}>
        Fine-tune your blink sensitivity for a personalized experience.
      </p>

      <div style={{ marginBottom: '40px' }}>
        <label style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>
          Left Wink Sensitivity: <span style={{ color: '#0070f3' }}>{leftSensitivity.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={leftSensitivity}
          onChange={(e) => setLeftSensitivity(parseFloat(e.target.value))}
          style={{
            width: '100%',
            appearance: 'none',
            height: '8px',
            borderRadius: '4px',
            background: '#e0e0e0',
            outline: 'none',
            transition: 'background 0.3s ease',
          }}
        />
      </div>

      <div style={{ marginBottom: '40px' }}>
        <label style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>
          Right Wink Sensitivity: <span style={{ color: '#0070f3' }}>{rightSensitivity.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={rightSensitivity}
          onChange={(e) => setRightSensitivity(parseFloat(e.target.value))}
          style={{
            width: '100%',
            appearance: 'none',
            height: '8px',
            borderRadius: '4px',
            background: '#e0e0e0',
            outline: 'none',
            transition: 'background 0.3s ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '24px' }}>
        <button
          onClick={handleSave}
          style={{
            padding: '12px 32px',
            fontSize: '16px',
            backgroundColor: '#5c80ff',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            transition: 'background-color 0.3s ease, transform 0.2s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#3d5ce4')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#5c80ff')}
        >
          Save Settings
        </button>
      </div>
      {message && <p style={{ textAlign: 'center', marginTop: '20px', color: message.startsWith('Error') ? 'red' : 'green' }}>{message}</p>}
    </div>
  );
}
