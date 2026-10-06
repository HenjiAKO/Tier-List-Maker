import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Dashboard } from "@/components/dashboard/dashboard"
import { Editor } from "@/components/editor/editor"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { useLists } from "@/hooks/use-lists"
import { useTheme } from "@/hooks/use-theme"
import { isDesktop } from "@/lib/desktop"

export default function App() {
  const api = useLists()
  const { toggleMode } = useTheme()
  const [openListId, setOpenListId] = useState<string | null>(null)

  // Keep the open list in view of the latest state rather than snapshotting it.
  // `openList` is derived, so a deleted list falls back to the dashboard with
  // no extra state to clean up.
  const openList = api.lists.find((l) => l.id === openListId) ?? null

  useEffect(() => {
    if (api.error === "write-failed") {
      toast.error("Changes aren't being saved", {
        description: isDesktop()
          ? "The library file could not be written. Check that the app has permission to its data folder."
          : "This browser is blocking local storage.",
        id: "storage-blocked",
      })
    }
  }, [api.error])

  // The native menu owns the theme shortcut on desktop.
  useEffect(() => {
    if (!isDesktop()) return
    return window.desktop!.onMenuCommand((command) => {
      if (command === "toggle-theme") toggleMode()
    })
  }, [toggleMode])

  if (!api.ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading your tier lists…</p>
        <Toaster position="bottom-right" richColors closeButton />
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      {openList ? (
        <Editor list={openList} api={api} onBack={() => setOpenListId(null)} />
      ) : (
        <Dashboard api={api} onOpenList={setOpenListId} />
      )}
      <Toaster position="bottom-right" richColors closeButton />
    </TooltipProvider>
  )
}
