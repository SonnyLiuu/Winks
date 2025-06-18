import { useState} from 'react'; // Removed 'React' from import

// Assuming window.api is correctly defined in preload.ts
declare global {
  interface Window {
    api: {
      updateSensitivities: (yaw: number, pitch: number) => Promise<{ success: boolean; error?: string }>;
      updateCalibration: (calibrationData: {
        both_closed_ratio?: number;
        l_wink_ratio?: number;
        r_wink_ratio?: number;
        wink_succ_frame?: number;
        wink_cooldown?: number;
      }) => Promise<{ success: boolean; error?: string }>;
      // NEW: Listener for Python ready signal
      onPythonBackendReady: (callback: () => void) => () => void;
    };
  }
}

export default function SettingsPage() {
  // --- State for Head Tracking Sensitivities ---
  const [yawSensitivity, setYawSensitivity] = useState<number>(5.0);
  const [pitchSensitivity, setPitchSensitivity] = useState<number>(5.0);

  // --- State for Wink Calibration Parameters ---
  const [bothClosedRatio, setBothClosedRatio] = useState<number>(0.25);
  const [lWinkRatio, setLWinkRatio] = useState<number>(0.23);
  const [rWinkRatio, setRWinkRatio] = useState<number>(0.24);
  const [winkSuccFrame, setWinkSuccFrame] = useState<number>(2);
  const [winkCooldown, setWinkCooldown] = useState<number>(0.5);

  // --- Handlers for Head Tracking Sensitivities ---
  const handleUpdateSensitivities = async () => {
    try {
      const result = await window.api.updateSensitivities(yawSensitivity, pitchSensitivity);
      if (result.success) {
        console.log('Sensitivities updated successfully!', { yawSensitivity, pitchSensitivity });
        // alert('Sensitivities applied!'); // Removed alert to reduce popups during testing
      } else {
        console.error('Failed to update sensitivities:', result.error);
        alert(`Failed to apply sensitivities: ${result.error}`);
      }
    } catch (error) {
      console.error('Error calling updateSensitivities IPC:', error);
      alert('Error applying sensitivities. See console.');
    }
  };

  // --- Handlers for Wink Calibration ---
  const handleUpdateCalibration = async () => {
    const calibrationData = {
      both_closed_ratio: bothClosedRatio,
      l_wink_ratio: lWinkRatio,
      r_wink_ratio: rWinkRatio,
      wink_succ_frame: winkSuccFrame,
      wink_cooldown: winkCooldown,
    };

    try {
      const result = await window.api.updateCalibration(calibrationData);
      if (result.success) {
        console.log('Calibration updated successfully!', calibrationData);
        // alert('Calibration applied!'); // Removed alert to reduce popups during testing
      } else {
        console.error('Failed to update calibration:', result.error);
        alert(`Failed to apply calibration: ${result.error}`);
      }
    } catch (error) {
      console.error('Error calling updateCalibration IPC:', error);
      alert('Error applying calibration. See console.');
    }
  };

  const buttonStyle = {
    padding: '12px 32px',
    fontSize: '16px',
    backgroundColor: '#cff3ff', // Dim button if not ready
    color: '#000',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer', // Change cursor
    marginTop: '24px',
  };

  const inputRangeStyle = {
    width: '100%',
    marginTop: '8px',
    marginBottom: '8px',
  };

  const inputNumberStyle = {
    padding: '8px',
    fontSize: '14px',
    borderRadius: '5px',
    border: '1px solid #ccc',
    marginLeft: '10px',
    width: '80px',
  };

  const labelStyle = {
    display: 'inline-block',
    marginBottom: '4px',
    fontWeight: 'normal',
  };

  const sectionHeadingStyle = {
    marginTop: '32px',
    marginBottom: '16px',
  };

  return (
    <div style={{ padding: '32px', maxWidth: '700px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontWeight: 'bold' }}>Settings</h1>

      {/* Head Tracking Sensitivities Section */}
      <h3 style={sectionHeadingStyle}>Head Tracking Sensitivities</h3>
      <div style={{ marginBottom: '24px' }}>
        <label style={labelStyle}>Yaw Sensitivity</label>
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={yawSensitivity}
          onChange={(e) => setYawSensitivity(parseFloat(e.target.value))}
          style={inputRangeStyle}
        />
        <span style={{ marginLeft: '10px', display: 'inline-block', width: '50px' }}>{yawSensitivity.toFixed(1)}</span>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <label style={labelStyle}>Pitch Sensitivity</label>
        <input
          type="range"
          id="pitchSensitivity"
          min={1}
          max={100}
          step={1}
          value={pitchSensitivity}
          onChange={(e) => setPitchSensitivity(parseFloat(e.target.value))}
          style={inputRangeStyle}
        />
        <span style={{ marginLeft: '10px', display: 'inline-block', width: '50px' }}>{pitchSensitivity.toFixed(1)}</span>
      </div>

      <button onClick={handleUpdateSensitivities} style={buttonStyle}>
        Apply Sensitivities
      </button>

      {/* Wink Detection Calibration Section */}
      <h3 style={sectionHeadingStyle}>Wink Detection Calibration</h3>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle} htmlFor="bothClosedRatio">Both Eyes Closed Ratio</label>
        <input
          type="number"
          id="bothClosedRatio"
          step={0.01}
          min={0.0}
          max={1.0}
          value={bothClosedRatio}
          onChange={(e) => setBothClosedRatio(parseFloat(e.target.value))}
          style={inputNumberStyle}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle} htmlFor="lWinkRatio">Left Wink Ratio</label>
        <input
          type="number"
          id="lWinkRatio"
          step={0.01}
          min={0.0}
          max={1.0}
          value={lWinkRatio}
          onChange={(e) => setLWinkRatio(parseFloat(e.target.value))}
          style={inputNumberStyle}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle} htmlFor="rWinkRatio">Right Wink Ratio</label>
        <input
          type="number"
          id="rWinkRatio"
          step={0.01}
          min={0.0}
          max={1.0}
          value={rWinkRatio}
          onChange={(e) => setRWinkRatio(parseFloat(e.target.value))}
          style={inputNumberStyle}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle} htmlFor="winkSuccFrame">Successive Frames for Wink</label>
        <input
          type="number"
          id="winkSuccFrame"
          step={1}
          min={1}
          max={10}
          value={winkSuccFrame}
          onChange={(e) => setWinkSuccFrame(parseInt(e.target.value))}
          style={inputNumberStyle}
        />
      </div>

      <div style={{ marginBottom: '32px' }}>
        <label style={labelStyle} htmlFor="winkCooldown">Wink Cooldown (s)</label>
        <input
          type="number"
          id="winkCooldown"
          step={0.1}
          min={0.0}
          max={5.0}
          value={winkCooldown}
          onChange={(e) => setWinkCooldown(parseFloat(e.target.value))}
          style={inputNumberStyle}
        />
      </div>

      <button onClick={handleUpdateCalibration} style={buttonStyle}>
        Apply Calibration
      </button>
    </div>
  );
}
