/**
 * powers — OpenCode V2 plugin.
 *
 * Ports the Claude Code powers plugin (skills, slash commands, verify gate) to
 * OpenCode without changing the underlying SKILL.md prose or the verify-gate
 * script. Everything here is derived from the shared repo files:
 *
 *   - `<repo>/skills/<name>/SKILL.md`      → OpenCode skills (a)
 *   - `<repo>/skills/approve|ship`         → /powers/approve, /powers/ship (b)
 *   - `<repo>/scripts/verify-gate.sh`      → subagent completion gate (c)
 *
 * Kept in one file on purpose: it is the whole OpenCode surface.
 */

import { Plugin } from "@opencode/plugin"
import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

// The plugin module lives at <pluginRoot>/opencode-plugin/index.ts; the repo
// (package) root — where skills/, scripts/, templates/ live — is its parent.
const PLUGIN_ROOT = join((import.meta as unknown as { dir: string }).dir, "..")
const SKILLS_DIR = join(PLUGIN_ROOT, "skills")
const VERIFY_GATE = join(PLUGIN_ROOT, "scripts", "verify-gate.sh")

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

interface Frontmatter {
  [key: string]: string
}

/**
 * Minimal YAML frontmatter reader for SKILL.md files. Handles the subset the
 * powers skills actually use: `key: value` scalars and folded/literal block
 * scalars (`>-`, `>`, `|-`, `|`). No yaml dependency.
 */
function parseFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const text = raw.replace(/\r\n/g, "\n")
  const lines = text.split("\n")
  if (lines[0]?.trim() !== "---") return { data: {}, body: raw }

  let close = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      close = i
      break
    }
  }
  if (close === -1) return { data: {}, body: raw }

  const fmLines = lines.slice(1, close)
  const body = lines.slice(close + 1).join("\n").replace(/^\n/, "")

  const data: Frontmatter = {}
  let i = 0
  while (i < fmLines.length) {
    const line = fmLines[i]
    if (!line.trim() || line.trimStart().startsWith("#")) {
      i++
      continue
    }
    const match = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/)
    if (!match) {
      i++
      continue
    }
    const key = match[1]
    const value = match[2].trim()

    // Block scalar: `>-` / `>` fold to spaces; `|-` / `|` keep newlines.
    if (value === ">-" || value === ">" || value === "|-" || value === "|") {
      const literal = value.startsWith("|")
      const block: string[] = []
      i++
      while (i < fmLines.length) {
        const bl = fmLines[i]
        // A non-indented, non-blank line ends the block.
        if (bl.trim() !== "" && !/^\s/.test(bl)) break
        block.push(bl.replace(/^\s+/, ""))
        i++
      }
      const joined = literal ? block.join("\n") : block.join(" ")
      data[key] = (literal ? joined : joined.replace(/\s+/g, " ")).trim()
      continue
    }

    data[key] = value
    i++
  }

  return { data, body }
}

// ---------------------------------------------------------------------------
// Skill loading
// ---------------------------------------------------------------------------

interface LoadedSkill {
  /** Directory name — the plain, unprefixed skill ID. */
  id: string
  name: string
  description: string
  /** false when the frontmatter sets `disable-model-invocation: true`. */
  autoinvoke: boolean
  /** Absolute path of the SKILL.md. */
  path: string
  /** SKILL.md body, frontmatter stripped, `${CLAUDE_PLUGIN_ROOT}` expanded. */
  content: string
}

function loadSkills(root: string): LoadedSkill[] {
  const dir = join(root, "skills")
  if (!existsSync(dir)) return []

  const skills: LoadedSkill[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillPath = join(dir, entry.name, "SKILL.md")
    if (!existsSync(skillPath)) continue

    const raw = readFileSync(skillPath, "utf8")
    const { data, body } = parseFrontmatter(raw)
    skills.push({
      id: entry.name,
      name: data.name || entry.name,
      description: data.description || "",
      autoinvoke: data["disable-model-invocation"] !== "true",
      path: skillPath,
      // The skills' prose uses Claude Code's plugin-root variable to point at
      // repo templates/agents; swap in the real root for OpenCode.
      content: body.split("${CLAUDE_PLUGIN_ROOT}").join(root),
    })
  }
  return skills.sort((a, b) => a.id.localeCompare(b.id))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Coerce a hook result (object or JSON string) into a plain object. */
function asObject(value: unknown): Record<string, any> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return {}
    }
  }
  try {
    return JSON.parse(JSON.stringify(value ?? {}))
  } catch {
    return {}
  }
}

/** Spawn the verify gate in `dir`, feed it cwd JSON, return combined output. */
async function runVerifyGate(dir: string): Promise<{ code: number; output: string }> {
  const proc = Bun.spawn(["bash", VERIFY_GATE], {
    cwd: dir,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })
  proc.stdin.write(JSON.stringify({ cwd: dir }))
  proc.stdin.end()

  const stdoutPromise = new Response(proc.stdout).text()
  const stderrPromise = new Response(proc.stderr).text()
  const code = await proc.exited
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise])
  const output = [stdout, stderr].filter(Boolean).join("\n").trim()
  return { code, output }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default Plugin.define({
  id: "powers",

  async setup(ctx) {
    const skills = loadSkills(PLUGIN_ROOT)
    const byId = new Map(skills.map((s) => [s.id, s]))

    // --- (a) Skills -------------------------------------------------------
    // Register every SKILL.md as an OpenCode skill. Model-visible unless the
    // frontmatter opts out (approve/ship); commands (b) reuse the same content.
    await ctx.skill.transform((editor) => {
      for (const skill of skills) {
        editor.add({
          id: skill.id,
          name: skill.name,
          description: skill.description || undefined,
          autoinvoke: skill.autoinvoke,
          path: skill.path,
          content: skill.content,
        } as any)
      }
    })

    // --- (b) Commands -----------------------------------------------------
    // /powers/approve switches to the plan agent, then injects the approve
    // skill body. /powers/ship just injects the ship skill body.
    const approve = byId.get("approve")
    const ship = byId.get("ship")
    await ctx.command.transform((editor) => {
      if (approve) {
        editor.add({
          name: "powers/approve",
          description: approve.description || undefined,
          execute: async ({ sessionID, prompt, delivery }) => {
            await ctx.session.switchAgent({ sessionID, agent: "plan" })
            await ctx.session.prompt({
              ...prompt,
              sessionID,
              text: approve.content,
              delivery,
            })
          },
        })
      }
      if (ship) {
        editor.add({
          name: "powers/ship",
          description: ship.description || undefined,
          execute: async ({ sessionID, prompt, delivery }) => {
            await ctx.session.prompt({
              ...prompt,
              sessionID,
              text: ship.content,
              delivery,
            })
          },
        })
      }
    })

    // --- (c) Verify gate --------------------------------------------------
    // On a completed subagent, run scripts/verify-gate.sh against the
    // directory the child session worked in (its worktree, if it moved).
    // Exit 2 fails the parent's subagent call with the script's message —
    // the parent model sees it and can redispatch. Everything else passes.
    await ctx.tool.hook("execute.after", async (event) => {
      if (event.tool !== "subagent") return
      // Errored subagents surface their real error; don't mask it.
      if (event.status !== "completed") return

      let block: string | null = null
      try {
        const result = asObject((event as any).result)
        const childID: string | undefined =
          result?.output?.sessionID ?? result?.metadata?.sessionID
        if (!childID) return

        // The child's working directory: its (possibly moved) session location.
        let dir: string = ctx.location.directory
        try {
          const child = (await ctx.session.get({ sessionID: childID })) as any
          const childDir = child?.location?.directory ?? child?.directory
          if (childDir) dir = childDir
        } catch (err) {
          console.error(`[powers] session.get(${childID}) failed; gating fallback dir:`, err)
        }

        const { code, output } = await runVerifyGate(dir)
        if (code === 2) {
          const message = output || "verification failed"
          block = message.startsWith("BLOCKED") ? message : `BLOCKED: ${message}`
        } else if (code !== 0) {
          // Harness problem (bad script path, spawn failure, unexpected exit):
          // fail open, but make the failure loud.
          console.error(`[powers] verify-gate.sh exited ${code} (not a block): ${output}`)
        }
      } catch (err) {
        // Fail open on gate-harness bugs; real verification failures use
        // exit 2 and are handled above.
        console.error("[powers] verify gate error (allowing):", err)
      }

      if (block) throw new Error(block)
    })
  },
})
