---
name: greploop
description: >
  Runs the Greptile CLI on the current local branch, fixes what the review finds, and reviews
  again, until the review comes back 5/5 with zero comments. Use when the user says
  "greploop", asks to iterate on Greptile feedback until the review is clean, wants a branch
  polished before pushing or opening a PR, or wants local review findings fixed and re-reviewed
  automatically.
license: MIT
metadata:
  author: greptileai
  minCliCompat: 3.3.0
allowed-tools:
  - 'Bash(greptile *)'
  - 'Bash(git *)'
---

# Greploop

Run a Greptile review on the local branch, fix what it finds, review again. Stop at 5/5 with zero
comments.

This is the local CLI loop. No PR, nothing pushed. Command and output details are in the
`greptile-cli` skill.

## You are the loop

Run the steps below yourself, once per iteration. Do not reach for `watch(1)`:

- It never exits, so it hangs the session. BusyBox `watch` has no exit condition, and GNU's
  `--chgexit` only stops when output changes, not when the score reaches 5/5.
- Nothing edits the code between ticks, so it re-reviews the same commit and returns the same
  findings forever, billing a real review each time without ever converging.
- It is not installed on macOS.

The fix between reviews is the entire point, and only you can make it.

If the user explicitly wants a hands-off shell loop with no agent in it, this is the shape. It still
cannot fix anything, so it only reports:

```bash
for i in $(seq 1 5); do
  greptile review --json > review.json || break
  [ "$(jq '.confidence == 5 and (.comments | length) == 0' < review.json)" = "true" ] && break
  echo "iteration $i: $(jq -r '.confidence')/5, $(jq '.comments | length' < review.json) comments"
done
```

## Loop

Copy this checklist and check items off as you go:

```
Greploop progress:
- [ ] Step 0: Preflight
- [ ] Step 1: Start from a clean worktree
- [ ] Step 2: Review
- [ ] Step 3: Check exit conditions
- [ ] Step 4: Fix findings
- [ ] Step 5: Commit, then back to Step 2
- [ ] Step 6: Report
```

### Step 0: Preflight

```bash
git rev-parse --show-toplevel   # must be a git repo with a remote
command -v greptile             # must be installed
greptile whoami                 # check the OUTPUT, not the exit code
```

If `greptile` is missing, stop and tell the user to install it (`npm install -g greptile`, or
`brew install greptileai/tap/greptile`).

`greptile whoami` **exits `0` even when signed out**, printing `Not signed in. …` to stdout, so
gate on its text:

```bash
greptile whoami | grep -q '^Not signed in' && echo "needs login"
```

If it needs a login, stop and tell the user to run `greptile login`. It is an interactive browser
flow; do not attempt it yourself.

### Step 1: Start from a clean worktree

`greptile review` reviews **committed** changes against the branch base, and this loop commits once
per iteration, so it needs a clean tree to begin with.

```bash
git status --porcelain     # must be empty before you start
```

If anything is listed, **stop and hand it back to the user.** Ask them to commit or stash it, and
say why: once the loop starts, any file it edits gets staged whole, so a change they had in that
file would be swept into a commit labelled as review feedback. You cannot separate their edits from
yours inside a single file, and an agent should not be splitting hunks to try.

Do not commit or stash on their behalf, and do not proceed with a dirty tree because the dirty
files look unrelated. The loop only learns which files it will touch after the first review.

### Step 2: Review

```bash
greptile review --json > review.json
```

Always `--json`, and capture it. The next steps read `review.json`. A review takes on the order of
a minute; do not wrap it in a short timeout, and do not start a second one while one is running.

Pass `-b <branch>` when the user named a base. Otherwise omit it and let the CLI resolve the
repository default.

A zero exit with findings is the normal case. `greptile review` exits `0` whatever it finds. A
**non-zero** exit means the review did not complete: report the stderr message and stop. Several of
those are about the input and will never clear by looping: detached HEAD, more than 500 changed
files, a diff over 3 MB, a base sharing no history with HEAD, or every changed file held back as
sensitive.

### Step 3: Check exit conditions

```bash
jq '{confidence, count: (.comments | length)}' < review.json
```

**Stop the loop when any of these is true:**

- `confidence` is `5` and `comments` is empty. Success, go to Step 6.
- Iteration count reaches 5. Stop and report what remains.
- Two consecutive iterations produce the same findings with no successful fix. You are stuck.

`confidence: 5` with comments still open means keep going: the comments are the work.

### Step 4: Fix findings

Work findings in this order: `securityIssue: true`, then `P0`, then `P1`, then `P2`. Ignore
`category` and `verifiedEvidence`. On the `--json` path they are always `"comment"` and `null`, so
they carry no ranking signal.

For each finding:

1. Read the file at `path` around `startLine` to `endLine`. Do not rely on `hunk.before` alone. The
   working tree has usually moved since the review ran.
2. Decide whether it is actionable. It is **not** when it is factually wrong about the code,
   describes intended behavior, or asks for something the user already rejected this session.
3. If actionable, make the smallest fix that resolves it.
4. If not, note it with a one-line reason for the final report.

Do not apply `suggestion` fields blindly in bulk. Each is a proposal. Read it, confirm it fits the
surrounding code, then apply.

Never disable a rule, add a suppression comment, or weaken a test to make a finding go away. If a
finding can only be cleared that way, treat it as not actionable and report it. A 5/5 bought by
silencing the reviewer is worth nothing.

### Step 5: Commit and re-review

Stage **only the files you edited in Step 4**, by path:

```bash
git add -- src/auth.ts src/db.ts        # the paths you actually changed
git commit -m "address greptile review feedback"
```

Never `git add -A` or `git add .` here. This loop runs unattended across several iterations, and a
catch-all stage sweeps in whatever else appeared in the worktree (scratch files, build output, a
`.env` someone dropped in) and buries it in a commit labelled as review feedback. Keep a list of
the paths you touched as you fix, and stage exactly that list.

Staging by path is only safe if those files still contain exactly what you wrote. Step 1 started
clean, but the loop runs for minutes, and someone editing in their IDE meanwhile would have their
change staged wholesale under your commit message. Before staging, confirm each path still matches
your edit. Re-read it, or diff it against what you intended:

```bash
git diff -- src/auth.ts     # every hunk here should be one you made
```

If a file changed underneath you, **stop the loop** and tell the user which file and why. Do not
stage it, and do not try to separate their hunks from yours.

If `git status --porcelain` shows changes in files you did **not** edit, leave them alone and note
them in the final report. They are not yours to commit.

Return to **Step 2** and increment the iteration counter. Do not push. This loop stays local
unless the user asks otherwise.

### Step 6: Report

```
Greploop complete.
  Iterations:   2
  Confidence:   5/5
  Fixed:        7 findings
  Remaining:    0
```

When the loop stopped without a clean review, say so plainly and list what is left:

```
Greploop stopped after 5 iterations.
  Confidence:   4/5
  Fixed:        12 findings
  Remaining:    2

Remaining:
  - src/auth.ts:45 (P1) "Consider rate limiting this endpoint"
    Not fixed: needs a product decision on limits.
  - src/db.ts:112 (P2) "Missing index on user_id"
    Not actionable: the index exists in migration 0043.
```

Report the state you actually reached. A loop that ran out of iterations at 3/5 is a 3/5 result.
Never describe it as complete.
