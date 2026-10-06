"use strict"

/**
 * Electron main process.
 *
 * Plain CommonJS on purpose: electron-builder runs this file directly from
 * source during packaging, so there is no compile step to keep in sync.
 *
 * Everything that touches the filesystem lives here. The renderer has no Node
 * access at all (contextIsolation on, nodeIntegration off) and reaches disk
 * only through the channels in ipc-channels.cjs.
 */

const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  nativeTheme,
  protocol,
  Menu,
  screen,
} = require("electron")

const fsp = require("node:fs/promises")
const path = require("node:path")

const CH = require("./ipc-channels.cjs")
const { DiskStore } = require("./disk-store.cjs")

const isDev = !app.isPackaged
const DEV_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173"

/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {DiskStore | null} */
let store = null

/* --------------------------------- windows -------------------------------- */

/**
 * @param {{ width: number, height: number, x?: number, y?: number } | null} state
 * @returns {BrowserWindow}
 */
function createWindow(state) {
  const win = new BrowserWindow({
    width: state?.width ?? 1280,
    height: state?.height ?? 860,
    x: state?.x,
    y: state?.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0b0d10" : "#ffffff",
    title: "Tier List Maker",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  // Avoid the white flash: paint only once the renderer has something to show.
  win.once("ready-to-show", () => win.show())

  if (isDev) {
    win.loadURL(DEV_URL)
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"))
  }

  // External links belong in the user's browser, never inside an app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  return win
}

/**
 * Saved bounds can outlive the monitor they were captured on, so a position is
 * only reused when it still overlaps a real display.
 *
 * @param {{ width: number, height: number, x?: number, y?: number } | null} state
 */
function usableBounds(state) {
  if (!state) return null

  const width = Math.max(900, Math.round(state.width) || 1280)
  const height = Math.max(600, Math.round(state.height) || 860)
  if (typeof state.x !== "number" || typeof state.y !== "number") {
    return { width, height }
  }

  const area = screen.getDisplayMatching({ x: state.x, y: state.y, width, height }).workArea
  const overlaps =
    state.x < area.x + area.width - 80 &&
    state.x + width > area.x + 80 &&
    state.y < area.y + area.height - 80 &&
    state.y + height > area.y + 80

  return overlaps ? { width, height, x: Math.round(state.x), y: Math.round(state.y) } : { width, height }
}

function persistWindowState() {
  if (!mainWindow || mainWindow.isDestroyed() || !store) return
  if (mainWindow.isMinimized() || mainWindow.isFullScreen()) return
  // Best effort: a failed write must never block quitting.
  store.saveWindowState(mainWindow.getNormalBounds()).catch(() => {})
}

/** Sends a menu command to the renderer. */
function send(command) {
  mainWindow?.webContents.send(command)
}

function buildMenu() {
  /** @type {import("electron").MenuItemConstructorOptions[]} */
  const template = [
    {
      label: "File",
      submenu: [
        { label: "New Tier List", accelerator: "CmdOrCtrl+N", click: () => send(CH.MENU_NEW_LIST) },
        { label: "Import List…", accelerator: "CmdOrCtrl+O", click: () => send(CH.MENU_IMPORT) },
        { type: "separator" },
        {
          label: "Export All as JSON",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => send(CH.MENU_EXPORT_ALL),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Theme",
          accelerator: "CmdOrCtrl+Shift+L",
          click: () => send(CH.MENU_TOGGLE_THEME),
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "toggleDevTools" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "Show Data Folder", click: () => shell.openPath(store.dataDir) },
        { label: `About ${app.getName()}`, role: "about" },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/* ----------------------------------- ipc ---------------------------------- */

function registerProtocols() {
  // A custom protocol keeps `<img src="media/...">` resolvable with a relative
  // URL, which a file:// page cannot do on its own.
  protocol.handle("media", (request) => store.serveMedia(request.url))

  protocol.handle("app-file", (request) => store.serveDataFile(request.url))
}

function registerIpc() {
  ipcMain.handle(CH.LOAD_STATE, async () => {
    try {
      return { ok: true, state: await store.load() }
    } catch (err) {
      return { ok: false, error: describe(err) }
    }
  })

  ipcMain.handle(CH.SAVE_STATE, async (_event, state) => {
    try {
      await store.saveState(state)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: describe(err) }
    }
  })

  // Images arrive base64-encoded from the renderer's canvas, which keeps the
  // downscale logic identical to the browser build.
  ipcMain.handle(CH.PUT_MEDIA, async (_event, payload) => {
    try {
      const image = await store.putMedia(payload?.id, payload?.extension, payload?.dataUrl)
      return { ok: true, image }
    } catch (err) {
      return { ok: false, error: describe(err) }
    }
  })

  ipcMain.handle(CH.DELETE_MEDIA, async (_event, ids) => {
    try {
      await store.deleteMedia(ids)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: describe(err) }
    }
  })

  // Returns file contents as data URLs rather than paths: the renderer has no
  // filesystem access, and a File built from a data URL runs through the exact
  // same downscale pipeline as a browser file input.
  ipcMain.handle(CH.PICK_IMAGES, async () => {
    const parent = mainWindow ?? undefined
    const result = await dialog.showOpenDialog(parent, {
      title: "Add images",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: true, files: [] }

    const files = []
    for (const filePath of result.filePaths) {
      try {
        files.push({
          name: path.basename(filePath),
          dataUrl: await toDataUrl(filePath),
        })
      } catch {
        // Skip anything unreadable; the renderer reports the rest.
      }
    }
    return { ok: true, files }
  })

  ipcMain.handle(CH.OPEN_JSON, async () => {
    const parent = mainWindow ?? undefined
    const result = await dialog.showOpenDialog(parent, {
      title: "Import tier list",
      properties: ["openFile"],
      filters: [{ name: "Tier list JSON", extensions: ["json"] }],
    })
    if (result.canceled) return { ok: true, canceled: true }

    try {
      const text = await fsp.readFile(result.filePaths[0], "utf8")
      return { ok: true, canceled: false, text }
    } catch (err) {
      return { ok: false, error: describe(err) }
    }
  })

  ipcMain.handle(CH.SAVE_FILE, async (_event, payload) => {
    const parent = mainWindow ?? undefined
    const result = await dialog.showSaveDialog(parent, {
      title: payload?.title ?? "Save file",
      defaultPath: payload?.suggestedName ?? "tier-list.json",
      filters: payload?.filters ?? [{ name: "JSON", extensions: ["json"] }],
    })
    if (result.canceled || !result.filePath) return { ok: true, canceled: true }

    try {
      await fsp.writeFile(result.filePath, payload.data)
      return { ok: true, canceled: false, path: result.filePath }
    } catch (err) {
      return { ok: false, error: describe(err) }
    }
  })

  ipcMain.handle(CH.MIGRATE_LEGACY, async (_event, entries) => {
    try {
      const migrated = await store.migrateLegacy(entries)
      return { ok: true, migrated }
    } catch (err) {
      return { ok: false, error: describe(err) }
    }
  })
}

/* --------------------------------- lifecycle ------------------------------- */

// Privileged schemes must be declared before the app is ready.
protocol.registerSchemesAsPrivileged([
  { scheme: "media", privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: "app-file", privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// A second instance should focus the existing window instead of opening another.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    store = new DiskStore(app.getPath("userData"))
    await store.init()

    registerProtocols()
    registerIpc()
    buildMenu()

    mainWindow = createWindow(usableBounds(await store.loadWindowState()))
    mainWindow.on("close", persistWindowState)
    mainWindow.on("closed", () => {
      mainWindow = null
    })

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow(null)
      }
    })
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })

  app.on("before-quit", persistWindowState)
}

function describe(err) {
  return err instanceof Error ? err.message : String(err)
}

const MIME_BY_EXTENSION = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" }

/**
 * Reads an image off disk as a data URL so the renderer can hand it to the same
 * canvas downscale path a browser File would take.
 *
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function toDataUrl(filePath) {
  const mime = MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()]
  const body = await fsp.readFile(filePath)
  return `data:${mime ?? "application/octet-stream"};base64,${body.toString("base64")}`
}
