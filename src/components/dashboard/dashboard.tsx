import { useCallback, useMemo, useRef, useState } from "react"
import { FileDown, FileUp, Gamepad2, Layers, Package, Search, Upload } from "lucide-react"
import { toast } from "sonner"
import { ThemeControls } from "@/components/theme-controls"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { CreateListDialog } from "@/components/dashboard/create-list-dialog"
import { NAV_ITEMS, type NavItem } from "@/components/dashboard/nav-items"
import { SidebarRail } from "@/components/dashboard/sidebar-rail"
import { TierListCard } from "@/components/dashboard/tier-list-card"
import type { ListsApi } from "@/hooks/use-lists"
import { cn } from "@/lib/utils"
import type { ListKind } from "@/types"
import { exportAllJson, exportListJson, parseListJson } from "@/utils/files"

interface DashboardProps {
  api: ListsApi
  onOpenList: (id: string) => void
}

export function Dashboard({ api, onOpenList }: DashboardProps) {
  const [query, setQuery] = useState("")
  const [nav, setNav] = useState<NavItem["id"]>("home")
  const [createOpen, setCreateOpen] = useState(false)
  const [createKind, setCreateKind] = useState<ListKind | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? api.sortedLists.filter((l) => l.title.toLowerCase().includes(q)) : api.sortedLists
    return nav === "all" ? filtered : filtered.slice(0, 12)
  }, [api.sortedLists, query, nav])

  const importFromText = useCallback(
    async (text: string) => {
      try {
        // Images in a JSON file are already data URLs, which is exactly how the
        // library stores them, so they can be used as-is.
        const lists = parseListJson(text)
        api.importLists(lists)
        toast.success(`Imported ${lists.length} tier ${lists.length === 1 ? "list" : "lists"}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not read that file.")
      }
    },
    [api],
  )

  const handleImport = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      await importFromText(await file.text())
    },
    [importFromText],
  )

  const exportEverything = useCallback(() => {
    if (exportAllJson(api.lists)) {
      toast.success(`Exported ${api.lists.length} tier lists`)
    }
  }, [api.lists])

  const handleCreate = (input: Parameters<ListsApi["createList"]>[0]) => {
    const list = api.createList(input)
    onOpenList(list.id)
  }

  // A kind preselects the wizard's first step: the quick-start tiles already
  // answered "what kind", so they skip that question. Passing null keeps it.
  const openCreate = useCallback((kind: ListKind | null = null) => {
    setCreateKind(kind)
    setCreateOpen(true)
  }, [])

  return (
    <div className="flex min-h-svh bg-background">
      <SidebarRail
        active={nav}
        onSelect={setNav}
        onCreate={() => openCreate()}
        listCount={api.lists.length}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-1 lg:hidden">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setNav(item.id)}
                  aria-current={nav === item.id ? "page" : undefined}
                  aria-label={item.label}
                  title={item.label}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg transition-colors",
                    nav === item.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60",
                  )}
                >
                  <Icon className="size-4" />
                </button>
              )
            })}
          </div>
          <Layers className="size-5 text-primary lg:hidden" />
          <span className="font-semibold lg:hidden">Tier List Maker</span>

          <div className="relative ml-auto w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your tier lists"
              className="pl-9"
              aria-label="Search your tier lists"
            />
          </div>

          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void handleImport(e.target.files?.[0])
              e.target.value = ""
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="size-4" />
                <span className="hidden sm:inline">File</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => importRef.current?.click()}>
                <Upload className="size-4" />
                Import JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={api.lists.length === 0}
                onSelect={exportEverything}
              >
                <FileDown className="size-4" />
                Export all as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => openCreate()}>
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New tier list</span>
          </Button>
          <ThemeControls />
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6">
          <section className="mx-auto max-w-6xl">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              What will you rank today?
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Start from a game rarity system or a blank general list.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <QuickStartTile
                icon={Gamepad2}
                title="Game tier list"
                description="Star, grade or gacha rarities"
                onClick={() => openCreate("game")}
              />
              <QuickStartTile
                icon={Package}
                title="General tier list"
                description="Anything, no rarity needed"
                onClick={() => openCreate("general")}
              />
              <QuickStartTile
                icon={FileUp}
                title="Import a list"
                description="Open a saved .json file"
                onClick={() => importRef.current?.click()}
              />
            </div>
          </section>

          <section className="mx-auto mt-10 max-w-6xl">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold tracking-tight">
                {nav === "home" ? "Your tier lists" : "All lists"}
              </h2>
              <span className="text-sm text-muted-foreground">
                {visible.length} of {api.lists.length}
              </span>
            </div>

            {visible.length === 0 ? (
              <EmptyState
                hasLists={api.lists.length > 0}
                onCreate={() => openCreate()}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((list) => (
                  <TierListCard
                    key={list.id}
                    list={list}
                    onOpen={onOpenList}
                    onRename={api.renameList}
                    onDuplicate={(id) => {
                      api.duplicateList(id)
                      toast.success("Duplicated")
                    }}
                    onExport={(id) => {
                      const target = api.lists.find((l) => l.id === id)
                      if (!target) return
                      if (exportListJson(target)) toast.success("Exported JSON")
                    }}
                    onDelete={(id) => {
                      const target = api.lists.find((l) => l.id === id)
                      if (target) setPendingDelete({ id, title: target.title })
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* keying on the entry point remounts the dialog, so a preset kind can never
          leak into a later generic open. */}
      <CreateListDialog
        key={createKind ?? "any"}
        open={createOpen}
        initialKind={createKind}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the list, its tiers and every item image in it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  api.deleteList(pendingDelete.id)
                  toast.success("List deleted")
                }
                setPendingDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function QuickStartTile({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}

function EmptyState({ hasLists, onCreate }: { hasLists: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <Layers className="size-10 text-muted-foreground/50" />
      <p className="mt-4 text-sm font-medium">
        {hasLists ? "No lists match that search" : "No tier lists yet"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasLists
          ? "Try a different title, or clear the search box."
          : "Create your first list — import PNG or JPG images, name them, then drag them into tiers."}
      </p>
      {!hasLists && (
        <Button className="mt-5" onClick={onCreate}>
          Create a tier list
        </Button>
      )}
    </div>
  )
}
