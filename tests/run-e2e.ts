// Starts `vite preview`, runs the browser smoke suites against it, then shuts it
// down. Run with: npm run test:e2e
import { spawn, type ChildProcess } from "node:child_process"
import { once } from "node:events"

const PORT = 4173
const BASE = `http://localhost:${PORT}/`

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`preview server did not start on ${BASE}`)
}

async function run(label: string, file: string) {
  const res = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", file], {
    stdio: "inherit",
    env: process.env,
  })
  const [code] = (await once(res, "exit")) as [number | null]
  if (code !== 0) throw new Error(`${label} failed with exit code ${code}`)
}

let server: ChildProcess | null = null
try {
  console.log(`> starting vite preview on :${PORT}`)
  server = spawn("npx", ["vite", "preview", "--port", String(PORT)], {
    stdio: "ignore",
    shell: process.platform === "win32",
  })
  await waitForServer()

  await run("smoke-dashboard", "tests/smoke-dashboard.ts")
  await run("smoke-editor", "tests/smoke-editor.ts")

  console.log("\nE2E suites passed.")
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  if (server) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(server.pid), "/f", "/t"], { stdio: "ignore", shell: true })
    } else {
      server.kill()
    }
  }
}
