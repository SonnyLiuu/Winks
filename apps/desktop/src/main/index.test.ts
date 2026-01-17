import { describe, it, expect, vi, afterAll, type Mock } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

// tmp userData path for library.json etc.
const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'winks-'))

afterAll(() => {
  try {
    // best-effort recursive remove
    fs.rmSync(tmpUserData, { recursive: true, force: true })
  } catch {}
})

// ---- Spies we need to reference later ----
const appOn = vi.fn()
const appGetPath = vi.fn().mockReturnValue(tmpUserData)
const ipcOn = vi.fn()

// Ensure DEV_PYTHON is honored
process.env.DEV_PYTHON = 'C:\\fake\\venv\\Scripts\\python.exe'

// ---- Mocks ----
vi.mock('electron-squirrel-startup', () => false)

vi.mock('@electron-toolkit/utils', () => ({
  electronApp: { setAppUserModelId: vi.fn() },
  optimizer: { watchWindowShortcuts: vi.fn() },
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    whenReady: vi.fn().mockResolvedValue(undefined),
    on: appOn,
    getPath: appGetPath,
    quit: vi.fn(),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
  })),
  ipcMain: { on: ipcOn, handle: vi.fn() },
  shell: { openExternal: vi.fn(), openPath: vi.fn() },
  session: {
    defaultSession: {
      fetch: vi.fn().mockResolvedValue({
        text: () => Promise.resolve('<html><title>t</title></html>'),
      }),
    },
  },
}))

vi.mock('./windows', () => ({
  createMainWindow: vi.fn(() => ({ on: vi.fn() })),
  createOverlayWindow: vi.fn(() => ({
    on: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
  })),
}))

vi.mock('./overlay', () => ({
  openOnScreenKeyboard: vi.fn(),
  overlayScroll: vi.fn(),
  saveCursorPosition: vi.fn(),
  startOverlayProximityWatcher: vi.fn(),
  stopOverlayProximityWatcher: vi.fn(),
}))

vi.mock('./database', () => ({
  connectToDatabase: vi.fn(),
  createUser: vi.fn(),
  verifyUser: vi.fn(),
}))

// mock spawn to observe exe + args
const spawnMock = vi.fn(() => ({
  stdout: { on: vi.fn() },
  stderr: { on: vi.fn() },
  on: vi.fn(),
  stdin: { writable: true, write: vi.fn() },
  kill: vi.fn(),
}))
vi.mock('child_process', () => ({ spawn: spawnMock }))

function existsSyncStub(p: any): boolean {
  if (typeof p !== 'string') return false

  // 1) Force DEV_PYTHON to exist
  if (p.includes('C:\\fake\\venv\\Scripts\\python.exe')) return true

  // 2) Block real guess paths so they can't win on your machine
  if (/\bvenv[\\/](bin[\\/]python3|Scripts[\\/]python\.exe)\b/i.test(p)) return false
  if (p.includes('python_runtime')) return false

  // 3) Allow these files to "exist" for path resolution
  if (p.endsWith('head_wink_combined.py')) return true
  if (p.endsWith('face_landmarker.task')) return true

  return false
}

// Mock BOTH module IDs and include a `default` export
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const patched = { ...actual, existsSync: vi.fn(existsSyncStub) }
  return { ...patched, default: patched }
})

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const patched = { ...actual, existsSync: vi.fn(existsSyncStub) }
  return { ...patched, default: patched }
})

// ---- Import the module under test (runs app.whenReady branch) ----
await import('./index')

describe('main/index bootstrap', () => {
  it('spawns Python with DEV_PYTHON and correct script/model args', async () => {
    // app.whenReady is mocked resolved; give microtask tick
    await new Promise((r) => setTimeout(r, 0))

    expect(spawnMock).toHaveBeenCalled()
    const [exe, args] = spawnMock.mock.calls[0]! as unknown as [string, string[]]

    expect(exe).toBe(process.env.DEV_PYTHON)
    expect(args[0]!).toMatch(/head_wink_combined\.py$/)
    expect(args[1]!).toMatch(/face_landmarker\.task$/)
  })

  it('calls getPath("userData") when get-library IPC runs', async () => {
    // Find the registered IPC handler and invoke it
    const handler = ipcOn.mock.calls.find(([ch]) => ch === 'get-library')?.[1]
    expect(typeof handler).toBe('function')

    const fakeEvent = { sender: { send: vi.fn() } } as any
    handler!(fakeEvent)

    expect(appGetPath).toHaveBeenCalledWith('userData')
  })
})

// --- helper to grab IPC handlers registered in index.ts
const getIpcHandler = (channel: string) =>
  ipcOn.mock.calls.find(([ch]) => ch === channel)?.[1] as Function | undefined

describe('IPC handlers', () => {
  it('signup-user: calls createUser and replies', async () => {
    const handler = getIpcHandler('signup-user')
    expect(typeof handler).toBe('function')

    const db = await import('./database')
    ;(db.createUser as unknown as Mock).mockResolvedValueOnce({
      success: true,
      message: 'User created successfully',
      userId: 'abc123',
    })

    const fakeEvent = { reply: vi.fn() } as any
    await handler!(fakeEvent, { email: 'a@b.com', password: 'pw' })

    expect(db.createUser).toHaveBeenCalledWith('a@b.com', 'pw')
    expect(fakeEvent.reply).toHaveBeenCalledWith('signup-response', {
      success: true,
      message: 'User created successfully',
      userId: 'abc123',
    })
  })

  it('login-user: calls verifyUser and replies', async () => {
    const handler = getIpcHandler('login-user')
    expect(typeof handler).toBe('function')

    const db = await import('./database')
    ;(db.verifyUser as unknown as Mock).mockResolvedValueOnce({
      success: true,
      message: 'Login successful',
      user: { email: 'a@b.com', id: 'id1' },
    })

    const fakeEvent = { reply: vi.fn() } as any
    await handler!(fakeEvent, { email: 'a@b.com', password: 'pw' })

    expect(db.verifyUser).toHaveBeenCalledWith('a@b.com', 'pw')
    expect(fakeEvent.reply).toHaveBeenCalledWith('login-response', {
      success: true,
      message: 'Login successful',
      user: { email: 'a@b.com', id: 'id1' },
    })
  })

  it('add-programs: merges with existing library and filters duplicates by path', () => {
    const handler = getIpcHandler('add-programs')
    expect(typeof handler).toBe('function')

    const libPath = path.join(tmpUserData, 'library.json')

    // Make existsSync(libPath) return true just for this test
    const existsMock = fs.existsSync as unknown as Mock
    const prevImpl = existsMock.getMockImplementation()
    existsMock.mockImplementation((p: any) =>
      p === libPath ? true : prevImpl ? prevImpl(p) : false
    )

    const readSpy = vi
      .spyOn(fs, 'readFileSync')
      .mockReturnValueOnce(
        JSON.stringify([
          { id: 1, type: 'program', name: 'Existing', path: 'C:/Apps/App1.exe', icon: '' },
        ])
      )
    const writeSpy = vi.spyOn(fs, 'writeFileSync')

    const newPrograms = [
      { id: 2, type: 'program', name: 'Dup', path: 'C:/Apps/App1.exe', icon: '' }, // duplicate
      { id: 3, type: 'program', name: 'NewApp', path: 'C:/Apps/App2.exe', icon: '' },
    ]

    handler!({} as any, newPrograms)

    expect(readSpy).toHaveBeenCalledWith(libPath, 'utf-8')
    expect(writeSpy).toHaveBeenCalledTimes(1)

    const [, data] = writeSpy.mock.calls[0]!
    const saved = JSON.parse(data as string) as Array<{ path: string }>

    expect(saved.map((p) => p.path).sort()).toEqual(['C:/Apps/App1.exe', 'C:/Apps/App2.exe'].sort())

    // restore existsSync
    existsMock.mockImplementation(prevImpl as any)
  })

  it('remove-programs: removes by id and saves', () => {
    const handler = getIpcHandler('remove-programs')
    expect(typeof handler).toBe('function')

    const libPath = path.join(tmpUserData, 'library.json')
    const initial = [
      { id: 10, type: 'program', name: 'A', path: 'C:/A.exe', icon: '' },
      { id: 11, type: 'program', name: 'B', path: 'C:/B.exe', icon: '' },
      { id: 12, type: 'program', name: 'C', path: 'C:/C.exe', icon: '' },
    ]
    fs.writeFileSync(libPath, JSON.stringify(initial))

    // Ensure existsSync(libPath) returns true in this test
    const existsMock = fs.existsSync as unknown as Mock
    const prevImpl = existsMock.getMockImplementation()
    existsMock.mockImplementation((p: any) =>
      p === libPath ? true : prevImpl ? prevImpl(p) : false
    )

    handler!({} as any, [11, 12])

    const saved = JSON.parse(fs.readFileSync(libPath, 'utf-8').toString())
    expect(saved.map((p: any) => p.id)).toEqual([10])

    existsMock.mockImplementation(prevImpl as any)
  })

  it('get-library: sends parsed list via "library-updated"', () => {
    const handler = getIpcHandler('get-library')
    expect(typeof handler).toBe('function')

    const libPath = path.join(tmpUserData, 'library.json')
    const seeded = [{ id: 99, type: 'program', name: 'Z', path: 'C:/Z.exe', icon: '' }]
    fs.writeFileSync(libPath, JSON.stringify(seeded))

    const existsMock = fs.existsSync as unknown as Mock
    const prevImpl = existsMock.getMockImplementation()
    existsMock.mockImplementation((p: any) =>
      p === libPath ? true : prevImpl ? prevImpl(p) : false
    )

    const fakeEvent = { sender: { send: vi.fn() } } as any
    handler!(fakeEvent)

    expect(fakeEvent.sender.send).toHaveBeenCalledWith('library-updated', seeded)

    existsMock.mockImplementation(prevImpl as any)
  })
})
