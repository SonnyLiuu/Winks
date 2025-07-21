import { ApiResponse } from '../types'

const API_BASE_URL = 'https://winks-cloudflare.winksapi.workers.dev/api'

export async function registerUser(email: string, passwordPlain: string): Promise<ApiResponse> {
  return await window.electron.ipcRenderer.invoke('signup-user', { email, password: passwordPlain })
}

export async function loginUser(email: string, passwordPlain: string): Promise<ApiResponse> {
  return await window.electron.ipcRenderer.invoke('login-user', { email, password: passwordPlain })
}

export async function updateUserSettings(userId: string, settings: object): Promise<ApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ settings })
    });

    if (!response.ok) {
      const errorMessage = `Error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        return { success: false, message: errorData.message || errorMessage };
      } catch {
        return { success: false, message: errorMessage };
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Network error:', error);
    return { success: false, message: 'Network error or server unreachable.' };
  }
}
