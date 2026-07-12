#!/usr/bin/env bash
# verify-gate.sh — SubagentStop hook. Blocks a subagent from finishing if it
# changed code without verification, or (VERIFY_LEVEL=tdd) changed production
# source with no test changes. Exit 0 = allow; exit 2 = block, stderr is fed
# back to the subagent. Fail-closed on real failures, silent when idle.
set -uo pipefail

# Run where the subagent worked: hook stdin JSON carries "cwd", which points
# into the worktree for isolation:worktree agents. Fall back to project root.
input=$(cat 2>/dev/null || true)
cwd=$(printf '%s' "$input" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
cd "${cwd:-${CLAUDE_PROJECT_DIR:-$PWD}}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0   # nothing to gate

# Changed files = uncommitted work (incl. untracked — a brand-new test file
# must count) + commits since diverging from the default branch (first
# resolvable ref wins). Empty set => read-only agent, free pass.
base=""
for ref in origin/HEAD origin/main origin/master main master; do
  base=$(git merge-base HEAD "$ref" 2>/dev/null) && break
done
changed=$( { git diff --name-only HEAD 2>/dev/null
             git ls-files --others --exclude-standard 2>/dev/null
             [ -n "$base" ] && [ "$base" != "$(git rev-parse HEAD 2>/dev/null)" ] \
               && git diff --name-only "$base" HEAD 2>/dev/null
           } | sort -u )
[ -z "$changed" ] && exit 0

# Convention: VERIFY_LEVEL is declared as a `VERIFY_LEVEL=tdd|build` line in
# the repo's CLAUDE.md. Missing declaration means the strict default: tdd.
level=$(grep -hoE 'VERIFY_LEVEL=(tdd|build)' CLAUDE.md 2>/dev/null | head -1 | cut -d= -f2)
level=${level:-tdd}

# tdd mode: touching production source demands touching a test file too.
# rationale: path-pattern heuristic for "test file"; refine per-repo via VERIFY_LEVEL=build + a stricter verify.sh if it misclassifies.
tpat='(^|/)(tests?|__tests__|spec)(/|$)|[._-](test|spec)s?\.|(^|/)test_'
if [ "$level" = tdd ]; then
  tests=$(grep -iE "$tpat" <<<"$changed")
  src=$(grep -ivE "$tpat" <<<"$changed" \
        | grep -E '\.(m?[jt]sx?|py|rs|go|java|kt|rb|c|h|cpp|hpp|cs|swift|php|exs?)$')
  if [ -n "$src" ] && [ -z "$tests" ]; then
    # Rust keeps unit tests inline in src files, invisible to the path check.
    # Fallback: pass if the changed .rs diffs ADD test code — only + lines
    # count; test code already sitting in the file is not new test work.
    rs=$(grep '\.rs$' <<<"$src") && tests=$( { git diff HEAD -- $rs 2>/dev/null
        [ -n "$base" ] && git diff "$base" HEAD -- $rs 2>/dev/null
      } | grep -E '^\+[^+]' | grep -E '#\[test\]|#\[cfg\(test\)\]|mod tests' )
    if [ -z "$tests" ]; then
      { echo "BLOCKED (VERIFY_LEVEL=tdd): production source changed but no test files did:"
        sed 's/^/  - /' <<<"$src"
        echo "Write a failing test first (tdd skill), or declare VERIFY_LEVEL=build in CLAUDE.md."
      } >&2
      exit 2
    fi
  fi
fi

# Verify contract: the repo's scripts/verify.sh wins; else best-effort detection.
if [ -f scripts/verify.sh ]; then cmd="bash scripts/verify.sh"
elif [ -f package.json ] && grep -q '"test"[[:space:]]*:' package.json; then cmd="npm test --silent"
elif [ -f Cargo.toml ]; then cmd="cargo test --quiet"
elif [ -f gradlew ]; then cmd="./gradlew build"
else
  echo "verify-gate WARNING: no scripts/verify.sh and no recognized build system — NOTHING was verified. Add scripts/verify.sh (see powers/templates/verify.sh.template)." >&2
  exit 0
fi

if ! out=$($cmd 2>&1); then
  { echo "BLOCKED: verification failed ($cmd). Last lines:"
    tail -20 <<<"$out"
    echo "Fix the failures — or fix scripts/verify.sh if the command itself is wrong."
  } >&2
  exit 2
fi
exit 0
