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
      // repo templates/agents, and Claude Code's `powers:` command namespace.
      // Swap in the real root and the OpenCode `powers/` command namespace —
      // the shared SKILL.md files stay Claude-Code-native.
      content: body
        .split("${CLAUDE_PLUGIN_ROOT}").join(root)
        .split("/powers:approve").join("/powers/approve"),
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

/** Spawn the verify gate in `dir`, feed it cwd JSON, return combined output.
 * A hung verify command is a verification failure, not a harness error — the
 * gate must block (Claude Code's hook runner times out the same way). Race the
 * process against GATE_TIMEOUT, kill it, and return a blocking result. */
const GATE_TIMEOUT_MS = 10 * 60 * 1000

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
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<true>((resolve) => {
    timer = setTimeout(() => {
      proc.kill()
      resolve(true)
    }, GATE_TIMEOUT_MS)
  })
  const hung = await Promise.race([proc.exited.then(() => false), timedOut])
  if (timer) clearTimeout(timer)
  if (hung) {
    return {
      code: 2,
      output: `BLOCKED: verification did not finish within ${GATE_TIMEOUT_MS / 1000}s in ${dir} and was killed. A hung verify command is a failure — fix scripts/verify.sh (a stuck dev server, an interactive prompt, a watch-mode test runner) or the timeout is powers' opencode-plugin/index.ts GATE_TIMEOUT_MS.`,
    }
  }
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise])
  const output = [stdout, stderr].filter(Boolean).join("\n").trim()
  return { code: await proc.exited, output }
}

/** Gate a child session: run verify-gate.sh in the directory it worked in.
 * Returns the BLOCKED message, or null when the session passes. */
async function gateSession(ctx: any, childID: string): Promise<string | null> {
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
    return message.startsWith("BLOCKED") ? message : `BLOCKED: ${message}`
  }
  if (code !== 0) {
    // Harness problem (bad script path, spawn failure, timeout): fail open,
    // but make the failure loud.
    console.error(`[powers] verify-gate.sh exited ${code} (not a block): ${output}`)
  }
  return null
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default Plugin.define({
  id: "powers",

  async setup(ctx) {
    const skills = loadSkills(PLUGIN_ROOT)
    if (skills.length === 0) {
      // The whole plugin is a no-op without skills — that must be loud, not
      // silent. (Wrong root after a packaging change, unreadable dir, etc.)
      console.error(
        `[powers] no skills found under ${SKILLS_DIR} — skills, commands, and the verify gate were NOT registered. Check the plugin install.`,
      )
    }
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
    // /powers/approve, /powers/ship, /powers/setup inject their skill body as
    // the prompt. Any text the user typed with the invocation is appended
    // after the skill body — an invocation with attached changes is NOT
    // approval (approve skill says so).
    //
    // approve deliberately does NOT switch to the plan agent up front: the
    // skill's guard (nothing pending? attached edits? design doc vs spec?)
    // must run first. Instead the approve body instructs the model to call
    // the powers_approve_plan tool when — and only when — it has committed a
    // spec and is about to plan. Design approvals and guard failures never
    // call it, so the session keeps its agent.
    const inject = (body: string, userText: string | undefined) =>
      userText && userText.trim() ? `${body}\n\n${userText.trim()}` : body

    const approve = byId.get("approve")
    const ship = byId.get("ship")
    const setup = byId.get("setup")
    await ctx.tool.transform((editor) => {
      editor.namespace({
        name: "powers",
        description: "powers workflow tools",
      })
      editor.add({
        name: "approve_plan",
        description:
          "Enter plan mode after a spec approval. Call this ONLY after the approve skill's guard passed and the spec is committed; it switches the current session to the plan agent.",
        input: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        options: { namespace: "powers" },
        execute: async (_input, context) => {
          await ctx.session.switchAgent({ sessionID: context.sessionID, agent: "plan" })
          return { content: "Session switched to the plan agent. Continue with planning the implementation against the committed spec." }
        },
      })
    })
    await ctx.command.transform((editor) => {
      if (approve) {
        // The "Spec → enter plan mode" handoff is a tool call, not an eager
        // agent switch: the guard and the commit must happen first.
        const approveBody = `${approve.content}

## OpenCode plan handoff

The skill says a spec approval enters plan mode. In this harness you do that by calling the \`powers_approve_plan\` tool — but ONLY after the guard passed and the spec is committed. Do NOT call it for design approvals (stop instead) or when the guard failed.`
        editor.add({
          name: "powers/approve",
          description: approve.description || undefined,
          execute: async ({ sessionID, prompt, delivery }) => {
            await ctx.session.prompt({
              ...prompt,
              sessionID,
              text: inject(approveBody, prompt.text),
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
              text: inject(ship.content, prompt.text),
              delivery,
            })
          },
        })
      }
      // Claude Code exposes /powers:setup for every repo; OpenCode users need
      // the same entry point (setup is otherwise model-invoked only).
      if (setup) {
        editor.add({
          name: "powers/setup",
          description: setup.description || undefined,
          execute: async ({ sessionID, prompt, delivery }) => {
            await ctx.session.prompt({
              ...prompt,
              sessionID,
              text: inject(setup.content, prompt.text),
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
    // the parent model sees the failure (verified live: it reads the message
    // and can redispatch in the same conversation). Everything else passes.
    //
    // Two cooperating paths, because a child's session.status idle event
    // fires BEFORE its foreground tool call settles:
    //
    //  - idle listener: gates any not-yet-gated idle child of a parent in
    //    this location (works for foreground, background, and promoted
    //    children alike), caching the verdict by session ID. Delivery: a
    //    synthetic message to the parent ONLY for background children —
    //    foreground verdicts are delivered by execute.after's throw.
    //  - execute.after: foreground calls read the cached verdict (or gate
    //    if the cache is somehow empty) and throw on a block, which fails
    //    the parent's tool call.
    //
    // Verdicts are invalidated when a child goes busy again, so a continued
    // child session (same ID, new turn of work) is re-gated per turn.
    const verdicts = new Map<string, string | null>() // childID -> BLOCK message | null (passed)
    const backgroundLaunched = new Set<string>() // children launched/promoted as background

    const gateAndCache = async (childID: string): Promise<string | null> => {
      const block = await gateSession(ctx, childID)
      verdicts.set(childID, block)
      return block
    }

    /** Tell the parent a background child was blocked. Queues if the parent
     * is busy; wakes it if idle. Single source for the message so the two
     * delivery paths can't drift apart. */
    const notifyBlocked = async (parentID: string, childID: string, block: string) =>
      ctx.session.synthetic({
        sessionID: parentID,
        text: `Background subagent ${childID} was BLOCKED by the powers verify gate:\n\n${block}\n\nRedispatch it with instructions to fix the above (test-first per the tdd skill), or relax with VERIFY_LEVEL=build in AGENTS.md/CLAUDE.md.`,
      })

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

        // Background launches settle at launch: the child hasn't worked yet,
        // so there is nothing to gate here. Two shapes: launched with
        // background:true (input flag), or a foreground call promoted to
        // background mid-run (result status "running" — the tool call
        // returns early while the child keeps working). The idle listener
        // gates both when the child actually finishes.
        const input = asObject((event as any).input)
        const resultStatus = result?.output?.status ?? result?.metadata?.status
        if (input?.background === true || resultStatus === "running") {
          backgroundLaunched.add(childID)
          // Race: a very fast child can go idle — and be gated by the idle
          // listener — BEFORE this launch call settles. The listener skips
          // its notification because backgroundLaunched didn't contain the
          // child yet; deliver any already-cached blocking verdict here so
          // the parent still learns. Clear the verdict so a re-fired idle
          // can't double-deliver.
          if (verdicts.has(childID)) {
            const raced = verdicts.get(childID) as string | null
            verdicts.delete(childID)
            if (raced) {
              const child = (await ctx.session.get({ sessionID: childID }).catch(() => undefined)) as any
              if (child?.parentID) await notifyBlocked(child.parentID, childID, raced)
            }
          }
          return
        }

        // Foreground: the idle listener usually gated the child already
        // (idle fires before the tool call settles). Use that verdict.
        block = verdicts.has(childID)
          ? (verdicts.get(childID) as string | null)
          : await gateAndCache(childID)
      } catch (err) {
        // Fail open on gate-harness bugs; real verification failures use
        // exit 2 and are handled above.
        console.error("[powers] verify gate error (allowing):", err)
      }

      if (block) throw new Error(block)
    })

    const controller = new AbortController()
    void (async () => {
      for await (const ev of ctx.event.subscribe({ signal: controller.signal })) {
        try {
          const type = (ev as any).type
          const data = (ev as any).data ?? {}
          const sessionID = data.sessionID
          if (!sessionID) continue

          // A gated child going busy again invalidates its verdict — a
          // continued child session (same ID, new work) must be re-gated.
          if (type === "session.status" && data.status?.type === "busy") {
            verdicts.delete(sessionID)
            continue
          }
          if (type !== "session.status" || data.status?.type !== "idle") continue
          if (verdicts.has(sessionID)) continue // already gated this turn

          // Only gate subagent children of parents in this location —
          // other locations have (or don't have) their own plugin instance,
          // and primary sessions have no parentID.
          const child = (await ctx.session.get({ sessionID }).catch(() => undefined)) as any
          const parentID = child?.parentID
          if (!parentID) continue
          const parent = (await ctx.session.get({ sessionID: parentID }).catch(() => undefined)) as any
          if (parent?.location?.directory !== ctx.location.directory) continue

          const block = await gateAndCache(sessionID)
          // Foreground children: no synthetic here — execute.after delivers
          // the verdict by failing the parent's tool call. Background
          // children have no pending tool call; the parent may already be
          // idle, so wake it with a synthetic message (queues if busy).
          // (When this listener runs BEFORE the launch call's execute.after
          // — fast child — backgroundLaunched can't contain the child yet;
          // execute.after delivers the raced verdict itself.)
          if (block && backgroundLaunched.has(sessionID)) {
            await notifyBlocked(parentID, sessionID, block)
          }
        } catch (err) {
          console.error("[powers] idle gate error (allowing):", err)
        }
      }
    })()

    return () => controller.abort()
  },
})
