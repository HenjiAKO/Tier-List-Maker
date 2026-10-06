import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Dashboard } from "@/components/dashboard/dashboard"
import { Editor } from "@/components/editor/editor"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { useLists } from "@/hooks/use-lists"

export default function App() {
  const api = useLists()
  const [openListId, setOpenListId] = useState<string | null>(null)

  // Keep the open list in view of the latest state rather than snapshotting it.
  // `openList` is derived, so a deleted list falls back to the dashboard with
  // no extra state to clean up.
  const openList = api.lists.find((l) => l.id === openListId) ?? null

  useEffect(() => {
    if (api.error === "write-failed") {
      toast.error("Changes aren't being saved", {
        description:
          "This browser is blocking local storage, or your library outgrew the ~5MB limit.",
        id: "storage-blocked",
      })
    }
  }, [api.error])

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
