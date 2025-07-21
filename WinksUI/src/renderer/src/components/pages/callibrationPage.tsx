import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Settings } from '../../../../types'
import './Homepage.css';

export default function CalibrationPage() {
  const { user, isLoggedIn, updateUserSettings } = useAuth()
  const [yaw, setYaw] = useState(45)
  const [pitch, setPitch] = useState(45)
  const [deadZone, setDeadZone] = useState(6)
  const [tiltAngle, setTiltAngle] = useState(20)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchSettings = async () => {
      if (isLoggedIn && user?.settings) {
        console.log('Loading settings from authenticated user')
        setYaw(user.settings.yaw)
        setPitch(user.settings.pitch)
        setDeadZone(user.settings.deadZone)
        setTiltAngle(user.settings.tiltAngle)
      } else {
        console.log('Loading settings from local storage')
        const settings = await window.api.getSettings()
        if (settings) {
          setYaw(settings.yaw)
          setPitch(settings.pitch)
          setDeadZone(settings.deadZone)
          setTiltAngle(settings.tiltAngle)
        }
      }
    }
    fetchSettings()
  }, [isLoggedIn, user])

  const handleSave = async () => {
    const settings: Partial<Settings> = { yaw, pitch, deadZone, tiltAngle }

    try {
      if (isLoggedIn) {
        console.log('Saving settings for authenticated user')
        await updateUserSettings(settings as Settings)
      } else {
        console.log('Saving settings locally for guest user')
        window.api.saveSettings(settings)
      }

      window.api.updateCalibration(settings)
      console.log('Saving settings:', settings)
      alert('Settings saved!')
    } catch (error) {
      console.error('Failed to save settings:', error)
      if (error instanceof Error) {
        alert(`Error saving settings: ${error.message}`)
      } else {
        alert('An unknown error occurred while saving settings.')
      }
    }
  }

  const handleProceed = (): void => {
    navigate('/dashboard')
  }

  const descriptions: { [key: string]: string } = {
    'Sensitivity Yaw (°)': 'Controls horizontal sensitivity of head movement.',
    'Sensitivity Pitch (°)': 'Controls vertical sensitivity of head movement.',
    'Dead Zone (°)': 'Ignores small movements below this threshold.',
    'Max Tilt Angle (°)': 'The maximum angle for joystick tilt detection.'
  };

  return (
    <div className="home-container">
      <h1 className="home-heading">Calibration Settings</h1>
      <p className="home-subtext">Fine-tune your head tracking for a smooth and personalized experience.</p>

      <div style={{ width: '70%', maxWidth: '500px', background: '#ffffffcc', padding: '10px', borderRadius: '16px', boxShadow: '0 6px 18px rgba(0,0,0,0.1)', marginTop: '10px' }}>
        {[
          { label: 'Sensitivity Yaw (°)', value: yaw, setter: setYaw, min: 10, max: 90 },
          { label: 'Sensitivity Pitch (°)', value: pitch, setter: setPitch, min: 10, max: 90 },
          { label: 'Dead Zone (°)', value: deadZone, setter: setDeadZone, min: 0, max: 20 },
          { label: 'Max Tilt Angle (°)', value: tiltAngle, setter: setTiltAngle, min: 10, max: 45 },
        ].map((setting, index) => (
          <div key={index} style={{ marginBottom: '10px', position: 'relative' }}>
            <label
              style={{
                fontWeight: '600',
                display: 'block',
                marginBottom: '8px',
                position: 'relative',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                const tooltip = document.createElement('div');
                tooltip.textContent = descriptions[setting.label];
                tooltip.className = 'tooltip';
                e.currentTarget.appendChild(tooltip);
              }}
              onMouseLeave={(e) => {
                const tooltip = e.currentTarget.querySelector('.tooltip');
                if (tooltip) tooltip.remove();
              }}
            >
              {setting.label}: <span style={{ color: '#005bb5' }}>{setting.value}°</span>
            </label>
            <input
              type="range"
              min={setting.min}
              max={setting.max}
              value={setting.value}
              onChange={(e) => setting.setter(Number(e.target.value))}
              style={{
                width: '100%',
                accentColor: '#5c80ff',
                cursor: 'pointer',
              }}
            />
          </div>
        ))}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '0px' }}>
          <button
            onClick={handleSave}
            style={{
              padding: '12px 32px',
              background: '#0070f3',
              color: 'white',
              fontWeight: '600',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              width: '200px',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(0, 112, 243, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Save Settings
          </button>

          <button
            onClick={handleProceed}
            style={{
              padding: '12px 32px',
              background: '#5c80ff',
              color: 'white',
              fontWeight: '600',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              width: '200px',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(8, 72, 131, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Proceed
          </button>
        </div>
      </div>

      <p className="signup-prompt" style={{ marginTop: '24px' }}>
        Your preferences will enhance control accuracy and comfort.
      </p>

      {/* Tooltip CSS */}
      <style>{`
        .tooltip {
          position: absolute;
          top: -35px;
          left: 0;
          background: rgba(0,0,0,0.85);
          color: white;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 14px;
          white-space: nowrap;
          z-index: 10;
          animation: fadeIn 0.2s ease-in-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
