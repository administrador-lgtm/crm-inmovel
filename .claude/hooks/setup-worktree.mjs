#!/usr/bin/env node
// SubagentStart hook — creates the git worktree + links node_modules.
// Triggered for developer and simple-developer agents.
//
// Identity logic (from the SubagentStart stdin JSON, no injected env needed):
//   agent_type contains TASK-XXX  → COMPLEX developer
//   agent_type == simple-developer → SIMPLE (no explicit name)
//
// COMPLEX (developer-TASK-XXX):
//   worktreePath = <worktreeBase>/<TASK_ID>     (worktreeBase = /tmp/<repo>/<session>)
//   branchName   = <sessionShort>/<TASK_ID>
//
// SIMPLE (simple-developer):
//   worktreePath = <worktreeBase>/simple
//   branchName   = <sessionShort>/simple
//
// Recovery:
//   1. Already registered in git   → skip (restart scenario)
//   2. Orphan dir, not registered  → rm -rf, then retry
//   3. Orphan branch, no worktree  → force-delete branch so -b works

import { existsSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { readStdin, crmIdentity, baseBranch, git } from "./lib/common.mjs";

// Canonicalize for comparisons: on macOS /tmp symlinks to /private/tmp, so git
// reports worktree paths as /private/tmp/... while our derived paths say
// /tmp/.... Raw string comparison never matches, which made Recovery 1 miss
// live worktrees and the destructive recoveries (rm dir, delete branch) fire
// against ACTIVE developer worktrees.
function canon(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

const ctx = crmIdentity(readStdin());

// Classify the agent FIRST and bail out for anything that isn't a worktree-owning
// developer. This MUST happen before we create the session branch / _session
// worktree, otherwise every SubagentStart (Explore, reviewers, etc.) would create
// session infrastructure in the repo.
const agentType = ctx.agentType || "";
const taskMatch = agentType.match(/TASK-[0-9]+/);

let worktreePath;
let branchName;
if (taskMatch) {
  worktreePath = join(ctx.worktreeBase, taskMatch[0]);
  branchName = `${ctx.sessionShort}/${taskMatch[0]}`;
} else if (agentType === "simple-developer") {
  worktreePath = join(ctx.worktreeBase, "simple");
  branchName = `${ctx.sessionShort}/simple`;
} else {
  // Not a worktree-owning developer — do nothing (no log dir, no branch, no worktree).
  process.exit(0);
}

mkdirSync(ctx.sessionDir, { recursive: true });

const base = baseBranch();
const sessionBranch = `session/${ctx.sessionShort}`;

// Create the per-session integration branch, its fixed fork anchor, and the
// integration worktree. The anchor ref never moves and is the stable diff
// baseline for migrations (later phase). Branch and worktree creation are
// guarded independently so a partial failure retries on the next invocation.
const sessionWt = join(ctx.worktreeBase, "_session");
if (git(["show-ref", "--verify", "--quiet", `refs/heads/${sessionBranch}`]).status !== 0) {
  git(["branch", sessionBranch, base]);
  git(["branch", `session-base/${ctx.sessionShort}`, base]);
}

// A live git worktree owns a `.git` file pointing at its gitdir. Test that, not
// mere dir presence: on a session restart the cleanup can wipe the directory
// while git still holds the registration, and `git worktree add` then refuses
// with "missing but already registered worktree". Prune drops stale
// registrations so the add can recreate it.
if (!existsSync(join(sessionWt, ".git"))) {
  rmSync(sessionWt, { recursive: true, force: true }); // clear orphan dir (no .git)
  mkdirSync(dirname(sessionWt), { recursive: true });
  git(["worktree", "prune"]);
  const add = git(["worktree", "add", sessionWt, sessionBranch]);
  if (add.status === 0) {
    ctx.linkNodeModules(sessionWt);
    ctx.log(`setup-worktree SESSION-BRANCH created ${sessionBranch} from ${base}`);
  } else {
    ctx.log(`setup-worktree SESSION-BRANCH FAILED _session worktree ${sessionBranch} err=${add.stderr.replace(/\n/g, " ")}`);
  }
}

ctx.log(`setup-worktree START agent=${agentType} path=${worktreePath} branch=${branchName}`);

// Recovery 1: already registered AND live on disk → restart, use as-is.
const registeredPaths = git(["worktree", "list", "--porcelain"])
  .stdout.split("\n")
  .filter((l) => l.startsWith("worktree "))
  .map((l) => canon(l.slice("worktree ".length)));
if (registeredPaths.includes(canon(worktreePath)) && existsSync(join(worktreePath, ".git"))) {
  ctx.log(`setup-worktree SKIP already registered (${worktreePath})`);
  process.exit(0);
}

// Drop stale registrations (dir wiped while git still held the entry) so the
// add below doesn't fail with "missing but already registered worktree".
git(["worktree", "prune"]);

// Recovery 2: orphan dir (present but not a live worktree) → clean slate.
// (Never targets _session — different path.)
if (existsSync(worktreePath) && !existsSync(join(worktreePath, ".git"))) {
  rmSync(worktreePath, { recursive: true, force: true });
  ctx.log(`setup-worktree REMOVED orphan dir ${worktreePath}`);
}

mkdirSync(dirname(worktreePath), { recursive: true });

// Recovery 3: leftover branch. If it carries commits ahead of the session
// branch (developer work), NEVER delete it — re-attach the worktree to it.
// Only a commit-less branch is safe to recreate from scratch.
let add;
const branchExists = git(["branch", "--list", branchName]).stdout.trim();
const ahead = branchExists
  ? git(["log", "--oneline", `${sessionBranch}..${branchName}`]).stdout.trim()
  : "";
if (branchExists && ahead) {
  add = git(["worktree", "add", worktreePath, branchName]);
  ctx.log(`setup-worktree REUSED branch with commits ${branchName}`);
} else {
  if (branchExists) {
    git(["branch", "-D", branchName]);
    ctx.log(`setup-worktree DELETED orphan branch ${branchName}`);
  }
  add = git(["worktree", "add", worktreePath, "-b", branchName, sessionBranch]);
}
if (add.status === 0) {
  ctx.log(`setup-worktree CREATED branch=${branchName} path=${worktreePath}`);
} else {
  ctx.log(`setup-worktree EXIT=2 path=${worktreePath} err=${add.stderr}`);
  process.stderr.write(`[setup-worktree] Cannot create worktree at ${worktreePath} (branch=${branchName}): ${add.stderr}\n`);
  process.exit(2);
}

// Link node_modules (hard-link when same filesystem, symlink across devices).
ctx.linkNodeModules(worktreePath);
ctx.log(`setup-worktree OK wt=${worktreePath}`);
process.exit(0);
