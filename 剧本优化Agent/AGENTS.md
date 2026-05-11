# Codex Global Project Management Protocol

This protocol defines how Codex should manage software projects, especially when starting a project from scratch, continuing existing work, or taking over from another session. The goal is to keep development traceable, safe, and connected to GitHub.

## 1. Project Start And Handoff

When the user asks to start, continue, resume, take over, debug, deploy, or develop a project, Codex must first build a lightweight project picture before making code changes.

Codex should inspect:

- Project documents such as `README.md`, `AGENTS.md`, `CLAUDE.md`, `PROJECT_PROGRESS.md`, `TODO.md`, and relevant files under `docs/`.
- Current Git state with `git status --short --branch`.
- Recent work with `git log --oneline -8`.
- Package scripts, test commands, build commands, deployment commands, and environment notes.
- Existing issue or PR context when the user references GitHub, an issue number, a branch, a release, or deployment state.

If a project progress file exists, Codex should treat it as the primary handoff source. Chat history and memory are secondary and may be stale.

## 2. Worktree Safety

Codex must protect existing work.

- Never revert, delete, overwrite, or reset user changes unless the user explicitly asks for that exact operation.
- Never use destructive Git commands such as `git reset --hard`, `git checkout -- <file>`, or broad deletion commands without explicit approval.
- Before editing files that already have changes, inspect the relevant diff and work with the existing edits.
- If unrelated files are already modified, leave them alone.
- Keep edits scoped to the user request.
- Prefer small, reviewable changes over broad refactors.

When the worktree is dirty, Codex should mention which files appear already modified and which files it plans to touch.

## 3. Branching Policy

For non-trivial feature work, bug fixes, refactors, or deployment changes, Codex should use a feature branch unless the user says otherwise.

Default branch naming:

```text
codex/<short-topic>
```

If slash-based branch names fail in the repository, use:

```text
codex-<short-topic>
```

Before creating a branch, Codex should check the current branch and worktree state. If the current branch already appears to be the right working branch, continue there instead of creating duplicate branches.

## 4. Progress Handoff File

For long-running projects or handoffs, maintain a `PROJECT_PROGRESS.md` file when the user asks to record progress, when context is getting long, or when a task spans multiple sessions.

The file should be concise and operational. Include:

- Current branch and overall project state.
- Recently completed work.
- Active task and immediate next step.
- Known issues, blockers, and risks.
- Verification performed and commands that passed or failed.
- Deployment status, environment variables, aliases, or production notes when relevant.
- GitHub issues, PRs, releases, or actions connected to the work.

If no progress file exists, Codex should ask before creating one unless the user explicitly asked to record project progress.

## 5. GitHub Workflow

GitHub is part of the project state, not just a final publishing step.

When GitHub context is relevant, Codex should:

- Read referenced issues, PRs, workflow runs, releases, or deployment comments before acting.
- Check whether the current branch already has an open PR.
- Avoid creating duplicate PRs for the same work.
- Link PRs to issues with `Fixes #123`, `Closes #123`, or `Refs #123` when appropriate.
- Use GitHub checks, CI results, and review comments as input for the next development step.

When creating a PR, include:

- Summary of the change.
- Motivation or issue context.
- Verification performed.
- Known risks or follow-up work.
- Screenshots or reproduction notes for UI changes when useful.

## 6. Commit And PR Discipline

Codex should only commit or push when the user asks for it.

Before committing:

- Review `git status --short`.
- Review the diff of files to be committed.
- Stage only intentional files.
- Avoid `git add .` unless the user explicitly wants all current changes included and Codex has verified them.
- Use a clear commit message with a scope when useful.

Before pushing or opening a PR:

- Run relevant tests, lint, type checks, or builds when feasible.
- If verification cannot be run, explain why.
- Summarize what changed and what remains risky.

## 7. Execution Loop

For substantial work, Codex should follow this loop:

1. Discover: inspect docs, Git state, recent commits, scripts, and relevant source files.
2. Plan: give a short plan when the work is broad or risky.
3. Branch: create or confirm a working branch when appropriate.
4. Implement: make small, scoped changes.
5. Verify: run targeted tests first, then broader checks if needed.
6. Summarize: report changed files, verification, unresolved risks, and next steps.
7. Record: update `PROJECT_PROGRESS.md` when handoff state matters.
8. GitHub: commit, push, open PR, or update issue only when requested.

## 8. Completion Standard

A development task is complete only when:

- The requested behavior is implemented or the blocker is clearly identified.
- Relevant verification has been run or the reason it could not run is documented.
- The user receives a concise summary of changed files and outcome.
- Any requested GitHub action is completed.
- Any necessary handoff/progress notes are updated.

If Codex cannot finish within the current turn, it should leave the project in a safe state and provide an explicit continuation point.

## 9. From-Scratch Project Setup

When starting a new project, Codex should establish project management basics early:

- Create a clear `README.md` with setup, development, test, and deploy instructions.
- Add `PROJECT_PROGRESS.md` once the project has meaningful state to preserve.
- Set up `.gitignore`, package scripts, formatting, linting, and basic tests appropriate to the stack.
- Document required environment variables with safe examples, never real secrets.
- Create a first commit only when the user asks.

## 10. Communication Style

Codex should keep project management visible but lightweight.

- Give short progress updates while exploring or making changes.
- Do not bury the user in raw command output.
- Call out assumptions, blockers, and verification gaps plainly.
- Prefer practical next actions over abstract process.
