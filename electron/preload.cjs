"use strict"

/**
 * The only bridge between the renderer and the main process.
 *
 * contextIsolation is on and nodeIntegration is off, so the renderer sees
 * exactly the functions listed here and nothing else. Every call is wrapped so
 * a rejection becomes a plain value instead of an unhandled error in the page.
 */

const { contextBridge, ipcRenderer } = require("electron")
const CH = require("./ipc-channels.cjs")

/** Menu channels the renderer is allowed to subscribe to. */
const MENU_CHANNELS = [
  CH.MENU_NEW_LIST,
  CH.MENU_IMPORT,
  CH.MENU_EXPORT_ALL,
  CH.MENU_TOGGLE_THEME,
]

function call(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args)
}

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  platform: process.platform,

  loadState: () => call(CH.LOAD_STATE),
  saveState: (state) => call(CH.SAVE_STATE, state),
  putMedia: (payload) => call(CH.PUT_MEDIA, payload),
  deleteMedia: (ids) => call(CH.DELETE_MEDIA, ids),

  pickImages: () => call(CH.PICK_IMAGES),

  openJson: () => call(CH.OPEN_JSON),
  saveFile: (payload) => call(CH.SAVE_FILE, payload),
  migrateLegacy: (entries) => call(CH.MIGRATE_LEGACY, entries),

  onMenuCommand: (handler) => {
    if (typeof handler !== "function") return () => {}
    const listeners = MENU_CHANNELS.map((channel) => {
      const wrapped = () => handler(channel.replace("desktop:menu-", ""))
      ipcRenderer.on(channel, wrapped)
      return () => ipcRenderer.removeListener(channel, wrapped)
    })
    return () => listeners.forEach((off) => off())
  },
})
