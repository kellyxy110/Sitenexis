# Claude Code — Prompts Pack
> Copy-ready prompts for every major Claude Code workflow.
> Replace all `[BRACKETED]` placeholders before sending.
> Organised by feature surface. Jump to any section.

---

## Contents

1. [Session Startup & CLAUDE.md](#1-session-startup--claudemd)
2. [Codebase Exploration](#2-codebase-exploration)
3. [Feature Development](#3-feature-development)
4. [Debugging & Diagnosis](#4-debugging--diagnosis)
5. [Refactoring](#5-refactoring)
6. [Testing](#6-testing)
7. [Hooks](#7-hooks)
8. [Skills & Slash Commands](#8-skills--slash-commands)
9. [MCP Integrations](#9-mcp-integrations)
10. [Subagents & Parallel Work](#10-subagents--parallel-work)
11. [Git & PR Workflow](#11-git--pr-workflow)
12. [Context & Cost Management](#12-context--cost-management)
13. [CI/CD & Automation](#13-cicd--automation)
14. [Security & Permissions](#14-security--permissions)
15. [CLAUDE.md Templates](#15-claudemd-templates)

---

## 1. Session Startup & CLAUDE.md

### Cold start — orient to any codebase
```
Read CLAUDE.md if it exists, then explore the project structure.

Give me:
1. What this project does (one paragraph, no fluff)
2. The tech stack — languages, frameworks, key libraries
3. How to run it locally — exact commands
4. How to run the test suite
5. The three areas of the codebase most relevant to [DESCRIBE YOUR TASK]

Don't write any code yet. Just orient me.
```

---

### Generate a CLAUDE.md for a new project
```
Explore this codebase — read the directory structure, package files, 
config files, and a sample of the source code.

Then generate a CLAUDE.md that includes:
- Project overview (2–3 sentences)
- Tech stack and key dependencies
- Project structure with directory explanations
- Build, dev, and test commands
- Coding conventions (naming, formatting, file organisation)
- Architecture decisions I should know before touching anything
- Common mistakes to avoid in this codebase
- Any environment setup requirements

Write it to CLAUDE.md in the project root.
```

---

### Update CLAUDE.md after a session
```
Review what we built or changed in this session.

Update CLAUDE.md to capture:
- Any new architectural decisions made
- New commands or scripts added
- Conventions we established or changed
- Things that tripped us up (so future sessions avoid them)
- Any new dependencies added and why

Keep the file concise. Don't duplicate existing content — only add or update.
```

---

### Load path-scoped rules
```
Read CLAUDE.md, then check for any rules files under .claude/rules/ 
that apply to the area we're working in: [DIRECTORY OR FILE PATH].

Summarise which rules are active for this task before we start.
```

---

## 2. Codebase Exploration

### Understand a module or file
```
Read [FILE OR DIRECTORY PATH] in full.

Explain:
1. What this module does and why it exists
2. Its public interface — what it exports and what callers expect
3. Its key dependencies — what it relies on
4. Known edge cases or fragile areas in the code
5. How it fits into the broader architecture

Don't change anything. Exploration only.
```

---

### Trace a request or data flow
```
Trace the complete flow for [DESCRIBE THE OPERATION — e.g. "a user submitting 
a login form", "a background job processing a payment"].

Start from [ENTRY POINT] and follow every meaningful step:
- Which files and functions are called, in order
- Where data is transformed
- Where it touches external services, databases, or queues
- Where errors are caught (or not)
- Where the operation ends

Show file paths and function names at each step. Don't skip layers.
```

---

### Find all usages of a pattern
```
Search the codebase for all places where [PATTERN — e.g. "raw process.env 
is accessed", "fetch() is called in a useEffect", "console.log appears in 
production code"].

For each occurrence:
- File path and line number
- The surrounding context (what the code is doing)
- Whether it looks like a bug, a technical debt item, or intentional

Give me the full list before suggesting any fixes.
```

---

### Map dependencies for a feature
```
I'm about to change [FILE OR FUNCTION].

Before I touch anything, map the dependency blast radius:
1. What does this file/function depend on?
2. What depends on this file/function?
3. Which tests cover it?
4. What would break if I changed [SPECIFIC BEHAVIOUR]?

Show file paths. Don't make any changes yet.
```

---

## 3. Feature Development

### Implement a well-scoped feature
```
Read CLAUDE.md before starting.

Implement: [DESCRIBE THE FEATURE IN DETAIL]

Requirements:
- [REQUIREMENT 1]
- [REQUIREMENT 2]
- [REQUIREMENT 3]

Before writing any code:
1. Describe your implementation plan — which files you'll create or change
2. Flag any ambiguities or decisions I need to make
3. Confirm the approach matches the project conventions in CLAUDE.md

Wait for my approval before writing code.
```

---

### Scaffold a new component / module / route
```
Read CLAUDE.md before starting.

Scaffold a new [COMPONENT TYPE — e.g. React component, API route, 
service class, database model] for: [PURPOSE]

Follow existing project conventions for:
- File naming and location
- Export style (default vs named)
- TypeScript types and interfaces
- Error handling patterns
- Any relevant patterns from CLAUDE.md

Create the file with a working skeleton — not just stubs. 
Include inline comments where the implementation is non-obvious.
```

---

### Implement from a spec or ticket
```
Read CLAUDE.md before starting.

Here is the spec / ticket:

[PASTE SPEC OR TICKET CONTENT]

Before implementing:
1. Summarise what needs to be built in your own words
2. List all files you plan to create or modify
3. Identify any spec gaps or contradictions I need to resolve
4. Estimate the risk level of each change (low / medium / high)

Wait for my sign-off before writing code.
```

---

### Add an API endpoint
```
Read CLAUDE.md before starting.

Add a new API endpoint: [METHOD] [PATH]

Purpose: [WHAT IT DOES]
Request shape: [DESCRIBE INPUT — body, query params, headers]
Response shape: [DESCRIBE OUTPUT]
Auth required: [YES / NO / DESCRIBE]
Rate limited: [YES / NO]

Requirements:
- Validate all input (Zod / [YOUR VALIDATION LIBRARY])
- Return correct HTTP status codes — not just 200 and 500
- Never expose stack traces or internal error messages to clients
- Log errors server-side with structured logging
- Write at least one happy-path and one error-path test
```

---

## 4. Debugging & Diagnosis

### Diagnose an error
```
Here is an error I'm seeing:

```
[PASTE FULL ERROR MESSAGE AND STACK TRACE]
```

Relevant context:
- What I was doing when it happened: [DESCRIBE]
- Environment: [local / staging / production]
- Recent changes: [DESCRIBE OR "none"]

Diagnose the root cause. Don't jump to fixes yet — I want to understand 
the problem first. If you need to read specific files to diagnose, do so.
```

---

### Debug a failing test
```
This test is failing:

[PASTE TEST NAME AND FILE PATH]

Error output:
```
[PASTE TEST OUTPUT]
```

Read the test file and the code it covers.

1. Explain why the test is failing — root cause, not symptoms
2. Is the test wrong, or is the implementation wrong?
3. What is the correct fix?

Don't modify anything until I confirm the diagnosis.
```

---

### Investigate unexpected behaviour
```
Something is behaving unexpectedly:

Expected: [WHAT SHOULD HAPPEN]
Actual: [WHAT IS HAPPENING]
Steps to reproduce: [LIST STEPS]

Investigate by reading the relevant code. Form a hypothesis about the cause.
Then verify it by reading further. Only suggest a fix once you've confirmed 
the root cause — not just the first plausible-sounding explanation.
```

---

### Performance diagnosis
```
This operation is too slow: [DESCRIBE THE OPERATION]

Measured time: [X ms / s]
Target time: [X ms / s]
Environment: [local / production / load test]

Read the relevant code and identify:
1. The most likely bottleneck (database query, network call, computation, etc.)
2. Any N+1 query patterns
3. Missing indexes or caching opportunities
4. Anything that blocks the event loop unnecessarily

Rank your findings by expected impact. Don't optimise speculatively.
```

---

## 5. Refactoring

### Refactor for clarity
```
Read CLAUDE.md before starting.

Refactor [FILE OR FUNCTION] to improve readability and maintainability.

Goals:
- Reduce cognitive complexity — shorten long functions, flatten deep nesting
- Make the intent of each section obvious without comments
- Remove duplication
- Improve naming where it's unclear

Constraints:
- Do NOT change external behaviour
- Do NOT change the public interface
- All existing tests must still pass after the refactor
- Make atomic commits — one logical change per commit

Show me the plan before touching any code.
```

---

### Extract a shared utility
```
Read CLAUDE.md before starting.

I've noticed [DESCRIBE THE DUPLICATION — e.g. "the same date formatting 
logic appears in 4 different files"].

Extract this into a shared utility:
1. Find all occurrences across the codebase
2. Write the shared function/module in [TARGET LOCATION]
3. Replace all call sites with the shared version
4. Verify nothing broke by running the relevant tests

Follow the project's utility file conventions from CLAUDE.md.
```

---

### Modernise legacy code
```
Read CLAUDE.md before starting.

Modernise [FILE OR MODULE]. It was written for [OLD PATTERN — e.g. callbacks, 
CommonJS, class components] and needs to be updated to [NEW PATTERN — e.g. 
async/await, ESM, functional components].

Rules:
- Migrate incrementally — one pattern at a time
- Keep the external API identical unless I explicitly say otherwise
- Run tests after each meaningful change to catch regressions early
- Flag anything that can't be safely migrated automatically

Start with a migration plan. Don't write code until I approve it.
```

---

## 6. Testing

### Write tests for existing code
```
Read CLAUDE.md before starting.

Write tests for [FILE OR FUNCTION].

Requirements:
- Minimum 3 cases per function: happy path, error path, edge case
- Mock all external dependencies (databases, APIs, queues) — no real calls in tests
- Tests must be deterministic — no time-dependent or random behaviour
- Name tests descriptively: describe what behaviour is being verified
- Follow the testing framework and patterns already used in this project

Read the existing test files first so your tests are consistent with the 
established style.
```

---

### Write tests for a new feature
```
Read CLAUDE.md before starting.

I've just implemented [FEATURE]. Now write the tests.

Cover:
1. The happy path — correct input produces correct output
2. All validation error cases — what happens with bad input
3. Edge cases specific to this feature: [LIST ANY YOU KNOW OF]
4. Integration behaviour — how it interacts with [RELATED SYSTEM]

Mock: [LIST WHAT NEEDS MOCKING]
Don't mock: [LIST REAL DEPENDENCIES TO KEEP]
```

---

### Fix a flaky test
```
This test passes sometimes and fails sometimes:

[FILE PATH AND TEST NAME]

Failure output when it fails:
```
[PASTE OUTPUT]
```

Investigate. Flaky tests are usually caused by:
- Time-dependent logic (Date.now, setTimeout, new Date())
- Race conditions in async code
- Shared mutable state between tests
- Non-deterministic ordering (Object.keys, Math.random)
- Real network or filesystem calls

Find the cause, fix it, and explain the fix.
```

---

### Generate test data / fixtures
```
Generate realistic test fixtures for [DESCRIBE THE DATA SHAPE].

Requirements:
- Cover the main variation axes: [LIST — e.g. empty state, minimum valid, 
  maximum valid, special characters, foreign currency amounts]
- Use realistic values — not "foo", "bar", "test123"
- Format as [JSON / TypeScript object / factory function]
- Include a comment explaining what each fixture is testing

Don't invent fields that don't exist in the actual schema.
```

---

## 7. Hooks

### Set up the three core hooks
```
Set up the three most valuable Claude Code hooks in .claude/settings.json:

1. PostToolUse — auto-run ESLint --fix after every file write/edit
2. PreToolUse — run the test suite before any git commit command executes
3. PostToolUse — format with Prettier after every file write/edit

For each hook:
- Show the exact JSON configuration
- Set a sensible timeout to prevent session deadlocks
- Explain what it does and when it fires

Stack: [DESCRIBE YOUR STACK — e.g. Node/TypeScript, Python, Go]
Package manager: [npm / pnpm / yarn / pip / etc.]
Lint command: [YOUR LINT COMMAND]
Format command: [YOUR FORMAT COMMAND]
Test command: [YOUR TEST COMMAND]
```

---

### Add a custom hook
```
Add a new Claude Code hook to .claude/settings.json.

Hook purpose: [DESCRIBE WHAT IT SHOULD DO — e.g. "run database migrations 
after any change to schema files", "notify Slack when a file in /deploy/ 
is modified"]

Hook type: [PreToolUse / PostToolUse / SessionStart / SessionEnd / Stop]
Trigger condition: [WHAT SHOULD TRIGGER IT — specific tool, file pattern, etc.]
Command to run: [THE SHELL COMMAND]
Timeout: [HOW LONG BEFORE IT'S KILLED]
On failure: [block / warn / continue]

Show the complete settings.json entry and explain the hook lifecycle.
```

---

### Debug a misfiring hook
```
A Claude Code hook is not behaving as expected.

Hook configuration:
```json
[PASTE YOUR HOOK CONFIG]
```

What should happen: [DESCRIBE]
What is actually happening: [DESCRIBE]

Check:
1. Is the hook type correct for when I want it to fire?
2. Is the trigger condition (tool name / file pattern) matching correctly?
3. Is the shell command syntactically valid and executable?
4. Is the timeout long enough?
5. Does the exit code handling match my intent?

Diagnose and fix.
```

---

## 8. Skills & Slash Commands

### Create a skill for a repeatable workflow
```
Create a Claude Code skill for the following repeatable workflow:

Workflow name: [NAME — e.g. review-pr, new-feature, deploy-staging]
What it does: [DESCRIBE THE STEPS]
When it should auto-activate: [DESCRIBE THE CONTEXT — or "manual only"]

Create:
1. .claude/skills/[name]/SKILL.md with a clear description field 
   (Claude uses this to decide when to load the skill automatically)
2. The full skill instructions — be explicit about every step
3. Any supporting files the skill needs

The skill should be self-contained. A new team member running it should 
get the right outcome without extra explanation.
```

---

### Create a slash command
```
Create a custom slash command for Claude Code.

Command: /[NAME]
Purpose: [WHAT IT DOES]
Inputs: [ANY ARGUMENTS OR PLACEHOLDERS — e.g. $ARGUMENTS]

Create the file at .claude/commands/[name].md with:
- A clear one-line description at the top
- Step-by-step instructions Claude should follow
- Any constraints or rules to enforce
- The expected output or artefact it produces

Test it after creating by running /[name] with a sample input.
```

---

### Convert a repeated prompt into a skill
```
I keep using this prompt repeatedly:

---
[PASTE YOUR REPEATED PROMPT]
---

Convert this into a reusable Claude Code skill:
1. Extract the reusable pattern — what stays the same each time
2. Identify the variables — what changes each time (these become $ARGUMENTS 
   or prompts in the skill)
3. Write the skill file at .claude/skills/[suggested-name]/SKILL.md
4. Write the description field so Claude auto-invokes it when relevant

Show me the skill file, then demonstrate it with a sample invocation.
```

---

## 9. MCP Integrations

### Connect and verify an MCP server
```
I want to connect a new MCP server to Claude Code.

Server: [SERVER NAME OR PACKAGE — e.g. @anthropic-ai/mcp-server-postgres]
Purpose: [WHAT I WANT TO DO WITH IT]

Help me:
1. Install the MCP server package
2. Add the correct entry to .claude/settings.json (or .mcp.json)
3. Pass credentials via environment variables — NOT CLI args
4. Verify the connection is working
5. Show me a sample prompt that uses a tool from this server

Add the MCP config to .gitignore if it contains any credentials or 
environment-specific paths.
```

---

### Query via MCP (database)
```
Using the connected [DATABASE MCP SERVER NAME] MCP server:

[DESCRIBE WHAT YOU WANT TO QUERY OR DO — e.g. "find all users who signed 
up in the last 7 days and haven't verified their email", "check which 
migrations have not been run yet"]

Requirements:
- Read-only queries only unless I explicitly say otherwise
- Show me the query before executing it
- Limit results to [N] rows if this could return a large set
- Format the output as a table
```

---

### Use MCP for GitHub / project management
```
Using the connected [GITHUB / JIRA / LINEAR / etc.] MCP server:

[DESCRIBE THE TASK — e.g. "find all open PRs that have been waiting 
for review more than 3 days", "create a ticket for the bug we just 
diagnosed", "list all issues labelled 'performance'"]

Before taking any write actions (creating, updating, closing), show 
me what you're about to do and wait for confirmation.
```

---

## 10. Subagents & Parallel Work

### Delegate a multi-part task to subagents
```
This task has multiple independent parts that can run in parallel.
Use subagents to work on them simultaneously.

Parts:
1. [TASK 1 — describe scope clearly]
2. [TASK 2 — describe scope clearly]
3. [TASK 3 — describe scope clearly]

Each subagent should:
- Work only within its defined scope
- Not modify files owned by other subagents
- Return a summary of what it did and what it created/changed

Coordinate the results before presenting them to me.
```

---

### Spawn a specialised reviewer subagent
```
Spawn a subagent to review the code I've just written.

Files changed: [LIST FILE PATHS]

The reviewer should check for:
- Correctness — does it do what was asked?
- Security — any obvious vulnerabilities?
- Performance — any obvious inefficiencies?
- Conventions — does it match the patterns in CLAUDE.md?
- Test coverage — are the critical paths tested?

The reviewer should not make changes — only report findings, 
ranked by severity.
```

---

### Run a large codebase analysis in parallel
```
I need a comprehensive analysis of this codebase. Use multiple subagents 
working in parallel to cover these areas simultaneously:

- Subagent 1: Security — hardcoded secrets, injection vulnerabilities, 
  unsafe dependencies
- Subagent 2: Performance — N+1 queries, missing indexes, blocking operations
- Subagent 3: Test coverage — untested files, missing error path tests
- Subagent 4: Dead code — unused exports, unreachable code, stale dependencies

Each subagent produces a ranked findings list.
Merge all findings into a single prioritised report when complete.
```

---

## 11. Git & PR Workflow

### Create a commit with a good message
```
Review the changes we've made in this session.

Create a commit (or series of commits if the changes are logically distinct) 
with messages following Conventional Commits format:
- feat: for new features
- fix: for bug fixes
- refactor: for refactoring without behaviour change
- test: for test additions or changes
- chore: for maintenance, deps, config
- docs: for documentation only

Each commit message should:
- Have a short imperative subject line (max 72 chars)
- Include a body explaining WHY, not just WHAT, if non-obvious
- Reference the ticket/issue number if relevant: [TICKET PREFIX — e.g. "Closes #123"]
```

---

### Prepare a PR description
```
Review the diff for the branch we've been working on.

Write a pull request description that includes:
- Summary: what this PR does in 2–3 sentences
- Motivation: why this change is needed
- Changes: a bulleted list of the key changes made
- Testing: how this was tested and how reviewers can verify it
- Screenshots or output: [INCLUDE IF APPLICABLE, or "N/A"]
- Breaking changes: [DESCRIBE OR "None"]

Write it in Markdown, ready to paste into [GitHub / GitLab / Bitbucket].
```

---

### Pre-commit review
```
Before we commit, review everything we've changed in this session.

Check for:
- Any debugging code left in (console.log, print statements, breakpoints)
- Any TODO comments that should be resolved before merging
- Any hardcoded values that should be environment variables
- Any secrets or credentials that should not be committed
- Any files that shouldn't be in the commit (.env, build artefacts, etc.)
- TypeScript / lint errors

Report findings. If everything is clean, say so and we'll commit.
```

---

## 12. Context & Cost Management

### Compact and continue
```
/compact

After compacting: we were working on [BRIEF DESCRIPTION OF CURRENT TASK].
The key decisions made so far:
- [DECISION 1]
- [DECISION 2]

Next step: [WHAT WE SHOULD DO NEXT]

Continue from here.
```

---

### Start a fresh session with preserved context
```
Read CLAUDE.md before starting.

Context from the previous session:
- Task: [WHAT WE WERE BUILDING]
- Progress: [WHAT WAS COMPLETED]
- In-progress: [WHAT WAS STARTED BUT NOT FINISHED]
- Decisions made: [KEY DECISIONS]
- Next step: [EXACTLY WHAT TO DO NEXT]

Pick up from where we left off. Read the relevant files before starting.
```

---

### Scope a session to reduce token usage
```
Read CLAUDE.md before starting.

For this session, we are ONLY working on: [TIGHTLY SCOPED TASK]

Do not read files outside of:
- [DIRECTORY OR FILE 1]
- [DIRECTORY OR FILE 2]

Do not make changes outside these files unless I explicitly ask.
If you need context outside this scope, ask me rather than exploring freely.

This keeps the context window focused and costs down.
```

---

### Choose the right model for the task
```
I need help with [TASK TYPE].

Use the appropriate model for this task:
- Complex architecture decisions, multi-file refactors, or novel problems → Opus
- Standard feature work, debugging, tests, documentation → Sonnet  
- Fast exploration, simple lookups, quick formatting → Haiku

Switch models as appropriate during the session using /model [name].
Tell me which model you're using for each major step and why.
```

---

## 13. CI/CD & Automation

### Add Claude Code to a CI pipeline
```
I want to run Claude Code in a CI/CD pipeline for the following purpose:

Purpose: [e.g. auto-review PRs, generate changelogs, run security scans]
CI platform: [GitHub Actions / GitLab CI / CircleCI / Jenkins]
Trigger: [on PR open / on push to main / on schedule]

Generate:
1. The CI workflow file with the correct Claude Code CLI invocation
2. The environment variable setup for ANTHROPIC_API_KEY
3. The print mode command (-p) for non-interactive execution
4. Output handling — where results should go (PR comment, artifact, log)
5. Failure handling — exit codes and what should block the pipeline

Follow the principle of least privilege — only grant the permissions 
Claude Code needs for this specific task.
```

---

### Automate a repetitive dev task
```
Read CLAUDE.md before starting.

I have a repetitive task I want to automate with Claude Code:

Task: [DESCRIBE THE TASK — e.g. "generate TypeScript types from our 
OpenAPI spec every time it changes", "update the changelog from git 
log when we cut a release"]

Automate this using:
- A Claude Code skill if it's run manually on demand
- A hook if it should run automatically based on a Claude Code action
- A CI step if it should run on a schedule or git event

Recommend the right approach, then implement it.
```

---

## 14. Security & Permissions

### Audit permissions before a session
```
Before we start this session, review and confirm the permission setup.

I want Claude Code to be able to:
- [PERMISSION 1 — e.g. read all files in /src]
- [PERMISSION 2 — e.g. run npm test]
- [PERMISSION 3 — e.g. write to /src and /tests only]

I do NOT want Claude Code to be able to:
- [RESTRICTION 1 — e.g. run git push without confirmation]
- [RESTRICTION 2 — e.g. access /config/secrets]
- [RESTRICTION 3 — e.g. make network requests]

Review .claude/settings.json and confirm it matches these constraints.
If it doesn't, show me what to change.
```

---

### Security review of generated code
```
Review the code we just wrote for security issues.

Check for:
- Hardcoded credentials, API keys, or secrets (should be env vars)
- SQL or command injection vulnerabilities
- Unvalidated user input reaching sensitive operations
- Overly broad file or network access
- Dependency versions with known CVEs
- Any place where user input is rendered without sanitisation (XSS)
- Insecure defaults (e.g. CORS *, debug mode on in production)

For each finding: describe the vulnerability, its severity, and the fix.
Don't fix anything until I've reviewed the full list.
```

---

### Review an MCP server before connecting
```
I want to connect this MCP server: [SERVER NAME OR PACKAGE]

Before I connect it, review it for safety:
1. What tools does it expose? (read the package README or source)
2. What filesystem paths can it access?
3. Can it make outbound network requests?
4. Are credentials passed safely (env vars vs plaintext)?
5. Are there known CVEs or security advisories for this package?
6. Does the path validation in tool calls look sound?

Give me a risk assessment before I add it to my config.
```

---

## 15. CLAUDE.md Templates

### General project CLAUDE.md
```markdown
# [PROJECT NAME]

## What This Is
[2–3 sentence description of the project and its purpose]

## Tech Stack
- Language: [e.g. TypeScript 5.x]
- Framework: [e.g. Next.js 15 App Router]
- Database: [e.g. PostgreSQL via Prisma]
- Testing: [e.g. Vitest + Playwright]
- Package manager: [e.g. pnpm]

## Commands
```bash
# Install
pnpm install

# Dev server
pnpm dev

# Tests
pnpm test           # unit tests
pnpm test:e2e       # end-to-end tests
pnpm test:coverage  # coverage report

# Quality
pnpm typecheck
pnpm lint
pnpm format

# Build
pnpm build
```

## Project Structure
```
src/
├── app/          # [what lives here]
├── components/   # [what lives here]
├── lib/          # [what lives here]
└── types/        # [what lives here]
```

## Coding Conventions
- [CONVENTION 1 — e.g. "All components are Server Components by default"]
- [CONVENTION 2 — e.g. "No any types — use unknown and narrow"]
- [CONVENTION 3 — e.g. "Zod for all external input validation"]
- [CONVENTION 4 — e.g. "Errors returned as { error: string }, never thrown to client"]

## Architecture Decisions
- [DECISION 1 — e.g. "We use TanStack Query for all client data fetching"]
- [DECISION 2 — e.g. "DB access only through /lib/db query helpers, never raw Prisma"]

## What NOT To Do
- [ANTI-PATTERN 1]
- [ANTI-PATTERN 2]
- [ANTI-PATTERN 3]

## Environment Setup
Copy `.env.example` to `.env.local` and fill in the required values.
Never commit `.env` or `.env.local`.
```

---

### Monorepo CLAUDE.md addition
```markdown
## Monorepo Rules
- Package manager: [pnpm / yarn] workspaces
- Add dependencies with `--filter`: `pnpm add [pkg] --filter [workspace]`
- Check if a dependency exists in shared packages before adding it again
- Never import across package boundaries except via the public package index
- Build order is managed by Turbo — do not run package builds manually

## Packages
| Package | Import as | Owns |
|---|---|---|
| `packages/shared` | `@repo/shared` | [what lives here] |
| `packages/db` | `@repo/db` | [what lives here] |
| `packages/ui` | `@repo/ui` | [what lives here] |
```

---

### Verification protocol addition
```markdown
## Verification Protocol
After every meaningful change, before committing:
1. Run `[BUILD OR TYPE CHECK COMMAND]` — must pass with 0 errors
2. Run `[LINT COMMAND]` — must pass with 0 warnings
3. Run `[TEST COMMAND]` — all tests must pass
4. If touching [CRITICAL PATH — e.g. auth, payments]: manually verify 
   the flow in the dev environment
5. Check for leftover debug code: `console.log`, `TODO`, hardcoded values
```

---

*Last updated: May 2026*
*For Claude Code documentation: https://code.claude.com/docs*
