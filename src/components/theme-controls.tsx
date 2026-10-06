import { Check, Moon, Palette, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { useTheme } from "@/hooks/use-theme"
import { cn } from "@/lib/utils"

/** Swatch colour shown in the picker, derived from the accent's own hue. */
function swatch(a: { h: number; light: { l: number; c: number } }): string {
  return `oklch(${a.light.l} ${a.light.c} ${a.h})`
}

export function ThemeControls() {
  const { mode, toggleMode, accent, setAccent, accents } = useTheme()

  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Change accent colour" title="Accent colour">
            <Palette className="size-4" />
            <span
              aria-hidden
              className="pointer-events-none absolute right-1.5 bottom-1.5 size-2 rounded-full ring-2 ring-background"
              style={{ backgroundColor: swatch(accent) }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <p className="mb-2 text-sm font-medium">Accent colour</p>
          <div className="grid grid-cols-6 gap-2">
            {accents.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-label={a.name}
                title={a.name}
                onClick={() => setAccent(a.id)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg ring-offset-2 ring-offset-background transition-transform hover:scale-105",
                  accent.id === a.id && "ring-2 ring-ring",
                )}
                style={{ backgroundColor: swatch(a) }}
              >
                {accent.id === a.id && <Check className="size-4 text-white drop-shadow" />}
              </button>
            ))}
          </div>
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Appearance</span>
            <Button variant="secondary" size="sm" onClick={toggleMode}>
              {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {mode === "dark" ? "Light" : "Dark"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
