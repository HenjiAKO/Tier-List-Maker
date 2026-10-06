"use strict"

/** Channel names shared by the main process and the preload bridge. */
module.exports = {
  LOAD_STATE: "desktop:load-state",
  SAVE_STATE: "desktop:save-state",
  PUT_MEDIA: "desktop:put-media",
  DELETE_MEDIA: "desktop:delete-media",

  // Renderer -> main, invoke style.
  PICK_IMAGES: "desktop:pick-images",
  OPEN_JSON: "desktop:open-json",
  SAVE_FILE: "desktop:save-file",
  MIGRATE_LEGACY: "desktop:migrate-legacy",

  // Main -> renderer, menu commands.
  MENU_NEW_LIST: "desktop:menu-new-list",
  MENU_IMPORT: "desktop:menu-import",
  MENU_EXPORT_ALL: "desktop:menu-export-all",
  MENU_TOGGLE_THEME: "desktop:menu-toggle-theme",

  READY: "desktop:ready",
}
