# Lionbridge Course Studio Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename this tool's own identity — npm workspace scope, Python parser service package, one internal component, CI config, env templates, and documentation — from `moto-ai`/`Moto` to Lionbridge Course Studio (`@lb-studio`), without touching any genuine Motorola client-brand data.

**Architecture:** A sequence of mechanical, low-design-risk renames across five independent areas (npm scope, one component, the Python service, CI/env config, docs), each independently verifiable. No new abstractions, no data migration — this is identifier renaming only.

**Tech Stack:** TypeScript/npm workspaces, Python (parser service), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-02-lionbridge-rebrand-design.md`

## Global Constraints

- New npm scope: `@lb-studio` (e.g. `@lb-studio/contracts`). Root package name: `lionbridge-course-studio`.
- New Python package name: `lb_studio_parser` (directory and import name), `lb-studio-parser` (PyPI-style dashed name in `pyproject.toml`'s `name`/`[project.scripts]` fields only).
- `MotoViewer` → `CoursePlayer`. "Moto Player" (prose) → "Course Player". "Moto AI" / "Moto AI Course Studio" (prose) → "Lionbridge Course Studio".
- Never touch: `MotoSans` (real Motorola font asset), `moto-theme`/`moto-indigo`/`moto-frost`/`moto-pearl` (real Motorola client-brand data, already handled by the course theme system), the `moto-indigo-black` `Hotspot` variant, the `--color-moto-indigo` design token, any "moto g87"/"moto/g87" example-content mentions in docs (describes example client content, not the tool).
- Never touch: the user's actual local `.env`/`.env.local`, their local Postgres database name (`moto_ai_dev`), or the on-disk repository folder name. Only committed templates (`.env.example`) and CI's own ephemeral config get renamed.
- Never touch: `docs/superpowers/specs/**` or `docs/superpowers/plans/**` — these are historical planning records describing the state of the world at the time they were written (including code identifiers that were literally named `@moto-ai` then); rewriting them would misrepresent history.
- No JS/TS test runner exists in this repo — verification is `npm run typecheck` and `npm run lint`. The Python side has real tooling: `python -m unittest discover -s tests`, `ruff check .`, `ruff format --check .`, `mypy src`.
- The GitHub repository rename itself (`josemejias11/moto-ai` → `josemejias11/lionbridge-course-studio`) is **not** one of this plan's tasks — it's an external, account-level action the controlling session performs directly after this plan's branch is merged, not something a task-scoped implementer subagent should do.

---

## File Structure

| Area | Files |
|---|---|
| npm scope | Every `package.json` under `apps/*`, `packages/*`, plus root `package.json`; every `.ts`/`.tsx` file under `apps/`, `packages/` that imports `@moto-ai/*`; `package-lock.json` (regenerated, not hand-edited) |
| Component rename | `apps/web/src/learning/player/MotoViewer.tsx` → `CoursePlayer.tsx`; `apps/web/src/learning/PlayerViewport.tsx` |
| Python service | `services/parser-service/pyproject.toml`, `services/parser-service/src/moto_parser/` → `src/lb_studio_parser/` (directory rename), `services/parser-service/tests/test_retrieval.py`, `services/parser-service/tests/test_settings.py`, `services/parser-service/README.md` |
| CI + env templates | `.github/workflows/validate.yml`, `.env.example` |
| Docs | `README.md`, `GUIDE.md`, `CLAUDE.md` (root) |

---

### Task 1: npm workspace scope rename (`@moto-ai` → `@lb-studio`)

**Files:**
- Modify: `package.json` (root) — `"name"` field and 3 script strings
- Modify: every `apps/*/package.json` and `packages/*/package.json` — `"name"` field and any `"@moto-ai/*"` dependency declarations
- Modify: every `.ts`/`.tsx` file under `apps/` and `packages/` containing `@moto-ai/` imports
- Modify: `package-lock.json` (regenerated via `npm install`, never hand-edited)

**Interfaces:**
- Produces: every workspace package now resolves under the `@lb-studio/*` scope (e.g. `@lb-studio/contracts`, `@lb-studio/database`). Every later task in this plan that imports a workspace package uses `@lb-studio/*`.

- [ ] **Step 1: Count current references (baseline)**

Run: `grep -rl '@moto-ai/' --include='*.ts' --include='*.tsx' --include='package.json' apps packages . --exclude-dir=node_modules 2>/dev/null | wc -l`
Expected: a nonzero count (roughly 25 files, based on the 132 import sites plus 8 package.json files plus root package.json found during spec research).

- [ ] **Step 2: Replace the root package name**

In `package.json` (repo root), change:

```json
  "name": "moto-ai",
```

to:

```json
  "name": "lionbridge-course-studio",
```

- [ ] **Step 3: Mechanically replace every `@moto-ai/` scope reference**

This is a literal string substitution — `@moto-ai/` → `@lb-studio/` — applied to every `package.json`, `.ts`, and `.tsx` file under `apps/` and `packages/`, plus the root `package.json` (which also contains 3 script strings: `@moto-ai/web` × 3 sites in the `dev`/`build`/`start` scripts and job-worker's `dev` script). `perl -pi -e` is used instead of `sed -i` because its in-place-edit syntax is identical on macOS and Linux (no `-i ''` vs `-i` mismatch to worry about):

```bash
find apps packages -type f \( -name '*.ts' -o -name '*.tsx' -o -name 'package.json' \) -print0 \
  | xargs -0 perl -pi -e 's/\@moto-ai\//\@lb-studio\//g'

perl -pi -e 's/\@moto-ai\//\@lb-studio\//g' package.json
```

- [ ] **Step 4: Verify zero `@moto-ai` references remain in source**

Run: `grep -rn '@moto-ai' apps packages package.json --include='*.ts' --include='*.tsx' --include='package.json' 2>/dev/null`
Expected: no output (zero matches).

- [ ] **Step 5: Regenerate the lockfile**

Run: `npm install`
Expected: completes without error; `git diff --stat package-lock.json` shows changes (every `@moto-ai/*` entry becomes `@lb-studio/*`, and the root `"name"` fields update). Do not hand-edit `package-lock.json` — if `npm install` reports an unrelated error, stop and report it rather than editing the lockfile directly.

- [ ] **Step 6: Regenerate the Prisma client and verify the build**

Run: `npm run db:generate`
Expected: completes without error (this step exists only because `postinstall` may not have fired identically after the rename; it's cheap and confirms `@prisma/client` is still wired correctly under the renamed root package).

Run: `npm run typecheck`
Expected: every workspace passes with no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: rename npm workspace scope from @moto-ai to @lb-studio"
```

---

### Task 2: `MotoViewer` → `CoursePlayer`

**Files:**
- Modify: `apps/web/src/learning/player/MotoViewer.tsx` → renamed to `apps/web/src/learning/player/CoursePlayer.tsx`
- Modify: `apps/web/src/learning/PlayerViewport.tsx:4,84`

**Interfaces:**
- Consumes: nothing from Task 1 directly (this file doesn't import any `@lb-studio/*` package by name in a way that changes here — if it does, Task 1 already handled it).
- Produces: the component `CoursePlayer` (default export), importable from `@/learning/player/CoursePlayer`. No later task in this plan depends on this rename.

- [ ] **Step 1: Rename the file and its exported function**

```bash
git mv apps/web/src/learning/player/MotoViewer.tsx apps/web/src/learning/player/CoursePlayer.tsx
```

In the newly renamed `CoursePlayer.tsx`, change:

```tsx
export default function MotoViewer({
```

to:

```tsx
export default function CoursePlayer({
```

- [ ] **Step 2: Update the one import site**

In `apps/web/src/learning/PlayerViewport.tsx`, change line 4:

```tsx
import MotoViewer from '@/learning/player/MotoViewer';
```

to:

```tsx
import CoursePlayer from '@/learning/player/CoursePlayer';
```

And change line 84 (the JSX usage):

```tsx
          <MotoViewer
```

to:

```tsx
          <CoursePlayer
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck --workspace=@lb-studio/web`
Expected: passes clean.

Run: `npm run lint`
Expected: no errors.

Run: `grep -rn "MotoViewer" apps/web/src`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/learning/player/CoursePlayer.tsx apps/web/src/learning/PlayerViewport.tsx
git commit -m "refactor: rename MotoViewer component to CoursePlayer"
```

---

### Task 3: Python parser service package rename (`moto_parser` → `lb_studio_parser`)

**Files:**
- Modify: `services/parser-service/pyproject.toml`
- Rename: `services/parser-service/src/moto_parser/` → `services/parser-service/src/lb_studio_parser/` (directory, 9 tracked `.py` files inside it — `generation.py`, `documents.py`, `__init__.py`, `runtime.py`, `rag.py`, `retrieval.py`, `contracts.py`, `settings.py`, `main.py`, `__main__.py`)
- Modify: `services/parser-service/src/lb_studio_parser/main.py:220`
- Modify: `services/parser-service/src/lb_studio_parser/__main__.py:1,3`
- Modify: `services/parser-service/tests/test_retrieval.py:11`
- Modify: `services/parser-service/tests/test_settings.py:18,19`
- Modify: `services/parser-service/README.md`

**Interfaces:**
- Produces: the importable Python package `lb_studio_parser`, dev command `python -m lb_studio_parser`. Task 5 (docs) references this exact command and this exact package name — use them verbatim.

Every internal module in this package uses relative imports (`from .settings import ...`) — confirmed during spec research — so the directory rename itself requires **no internal import changes**; only the 6 absolute/string references below need edits.

- [ ] **Step 1: Rename the package directory**

```bash
cd services/parser-service
git mv src/moto_parser src/lb_studio_parser
```

- [ ] **Step 2: Update `pyproject.toml`**

Change:

```toml
name = "moto-parser"
version = "1.2.0"
description = "Moto AI internal document parsing, retrieval, chat, and quiz service"
```

to:

```toml
name = "lb-studio-parser"
version = "1.2.0"
description = "Lionbridge Course Studio internal document parsing, retrieval, chat, and quiz service"
```

Change:

```toml
[project.scripts]
moto-parser = "moto_parser.main:run"
```

to:

```toml
[project.scripts]
lb-studio-parser = "lb_studio_parser.main:run"
```

Change:

```toml
[tool.ruff.lint.isort]
known-first-party = ["moto_parser"]
```

to:

```toml
[tool.ruff.lint.isort]
known-first-party = ["lb_studio_parser"]
```

- [ ] **Step 3: Update the two absolute-reference source lines**

In `services/parser-service/src/lb_studio_parser/main.py`, change line 220:

```python
    uvicorn.run("moto_parser.main:app", host="127.0.0.1", port=_port, reload=True)
```

to:

```python
    uvicorn.run("lb_studio_parser.main:app", host="127.0.0.1", port=_port, reload=True)
```

In `services/parser-service/src/lb_studio_parser/__main__.py`, change:

```python
"""Module entrypoint for ``python -m moto_parser``."""

from moto_parser.main import run
```

to:

```python
"""Module entrypoint for ``python -m lb_studio_parser``."""

from lb_studio_parser.main import run
```

- [ ] **Step 4: Update the test files**

In `services/parser-service/tests/test_retrieval.py`, change line 11:

```python
from moto_parser import retrieval  # noqa: E402
```

to:

```python
from lb_studio_parser import retrieval  # noqa: E402
```

In `services/parser-service/tests/test_settings.py`, change lines 18-19:

```python
            sys.modules.pop("moto_parser.settings", None)
            settings = importlib.import_module("moto_parser.settings")
```

to:

```python
            sys.modules.pop("lb_studio_parser.settings", None)
            settings = importlib.import_module("lb_studio_parser.settings")
```

- [ ] **Step 5: Update `services/parser-service/README.md`**

Change line 1:

```markdown
# Moto AI Parser Service
```

to:

```markdown
# Lionbridge Course Studio Parser Service
```

Change line 3:

```markdown
The parser service is Moto AI's internal FastAPI service for source parsing,
```

to:

```markdown
The parser service is Lionbridge Course Studio's internal FastAPI service for source parsing,
```

Change line 22 (inside the quick-start code block):

```
moto-parser
```

to:

```
lb-studio-parser
```

Change line 29:

```markdown
`python -m moto_parser` starts the same reload-enabled development server.
```

to:

```markdown
`python -m lb_studio_parser` starts the same reload-enabled development server.
```

Change line 44:

```markdown
Pydantic models in `src/moto_parser/contracts.py` own the parser service's HTTP
```

to:

```markdown
Pydantic models in `src/lb_studio_parser/contracts.py` own the parser service's HTTP
```

- [ ] **Step 6: Reinstall the venv and verify**

```bash
cd services/parser-service
source venv/bin/activate
pip install -e '.[dev]'
```

Expected: installs successfully, now exposing the `lb-studio-parser` console script instead of `moto-parser`.

Run: `ruff check .`
Expected: no errors.

Run: `ruff format --check .`
Expected: no errors.

Run: `mypy src`
Expected: no errors.

Run: `python -m unittest discover -s tests`
Expected: all tests pass (same count as before the rename — this is a pure rename, no behavior change).

Run: `grep -rn "moto_parser\|moto-parser" .`
Expected: no output (run from `services/parser-service`).

- [ ] **Step 7: Commit**

```bash
cd services/parser-service
git add -A
git commit -m "chore: rename parser service package from moto_parser to lb_studio_parser"
```

(Run this `git add -A` from `services/parser-service` or use `git add services/parser-service` from the repo root — either way, confirm with `git status` that only files under `services/parser-service/` are staged before committing.)

---

### Task 4: CI and committed env template rename

**Files:**
- Modify: `.github/workflows/validate.yml:15-17,26-27,38`
- Modify: `.env.example:8-9`

**Interfaces:**
- Consumes: the `@lb-studio/scorm-export` workspace name from Task 1 — this task must run after Task 1 lands (or at least after Task 1's rename is known) so this file's workspace reference matches the real package name.

- [ ] **Step 1: Update CI's ephemeral Postgres identifiers and workspace reference**

In `.github/workflows/validate.yml`, change:

```yaml
        env:
          POSTGRES_USER: moto_ai
          POSTGRES_PASSWORD: moto_ai
          POSTGRES_DB: moto_ai_ci
```

to:

```yaml
        env:
          POSTGRES_USER: lb_studio
          POSTGRES_PASSWORD: lb_studio
          POSTGRES_DB: lb_studio_ci
```

Change:

```yaml
    env:
      DATABASE_URL: postgresql://moto_ai:moto_ai@localhost:5432/moto_ai_ci
      DIRECT_URL: postgresql://moto_ai:moto_ai@localhost:5432/moto_ai_ci
```

to:

```yaml
    env:
      DATABASE_URL: postgresql://lb_studio:lb_studio@localhost:5432/lb_studio_ci
      DIRECT_URL: postgresql://lb_studio:lb_studio@localhost:5432/lb_studio_ci
```

Change:

```yaml
      - run: npm run build --workspace=@moto-ai/scorm-export
```

to:

```yaml
      - run: npm run build --workspace=@lb-studio/scorm-export
```

- [ ] **Step 2: Update the committed env template**

In `.env.example`, change:

```
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/moto_ai_dev"
DIRECT_URL="postgresql://<user>:<password>@localhost:5432/moto_ai_dev"
```

to:

```
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/lb_studio_dev"
DIRECT_URL="postgresql://<user>:<password>@localhost:5432/lb_studio_dev"
```

Do not modify the real `.env`/`.env.local` files — they are gitignored and untouched by this task (see Global Constraints).

- [ ] **Step 3: Verify**

Run: `grep -n "moto" .github/workflows/validate.yml .env.example`
Expected: no output.

There is no way to execute this GitHub Actions workflow locally as part of this task — the CI run that happens automatically when this branch is pushed is the real verification. Note this in your report rather than attempting to simulate it.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/validate.yml .env.example
git commit -m "chore: rename CI and env-template identifiers to match the Lionbridge rebrand"
```

---

### Task 5: Documentation rewrite (README.md, GUIDE.md, CLAUDE.md)

**Files:**
- Modify: `README.md` (11 locations)
- Modify: `GUIDE.md` (3 locations; one line explicitly left unchanged, see Step 2)
- Modify: `CLAUDE.md` (4 locations)

**Interfaces:**
- Consumes: `CoursePlayer` (Task 2), `lb_studio_parser`/`lb-studio-parser` (Task 3), `@lb-studio/*` (Task 1) — this task's replacement text uses these exact names, so it should run after Tasks 1-3 land.

This task is prose editing, not mechanical find/replace — each occurrence below is a distinct, deliberate change. Do not run a global search/replace across these three files; apply exactly the changes listed.

- [ ] **Step 1: `README.md`**

Change line 1:
```markdown
# Moto AI Course Studio
```
to:
```markdown
# Lionbridge Course Studio
```

Change lines 3-4:
```markdown
Moto AI is an app-owned e-learning authoring platform. Course Studio is where
authors create the English learning master; the shared Moto Player renders that
```
to:
```markdown
Lionbridge Course Studio is an app-owned e-learning authoring platform. Course Studio is where
authors create the English learning master; the shared Course Player renders that
```

Change (in the capabilities table, "Author preview" row):
```markdown
Uses the same Moto Player components as review and SCORM delivery
```
to:
```markdown
Uses the same Course Player components as review and SCORM delivery
```

Change line 41:
```markdown
Moto AI separates authoring assistance from learner delivery.
```
to:
```markdown
Lionbridge Course Studio separates authoring assistance from learner delivery.
```

Change line 91:
```markdown
### Moto Player
```
to:
```markdown
### Course Player
```

**Leave line 127 unchanged** — the phrase "no moto g87 or other product-specific names" describes example client content the neutral course template must avoid, not the tool's own brand.

Change line 197:
```markdown
local filesystem storage, builds a standalone Moto Player, writes the SCORM 1.2
```
to:
```markdown
local filesystem storage, builds a standalone Course Player, writes the SCORM 1.2
```

Change line 217:
```markdown
apps/web — Next.js Course Studio, Moto Player, review, analytics, HTTP APIs
```
to:
```markdown
apps/web — Next.js Course Studio, Course Player, review, analytics, HTTP APIs
```

Change line 252:
```
│   ├── web/                    Next.js application and shared Moto Player
```
to:
```
│   ├── web/                    Next.js application and shared Course Player
```

Change line 298:
```markdown
Moto AI is not one process. Local development and production require
```
to:
```markdown
Lionbridge Course Studio is not one process. Local development and production require
```

Change (in the runtime-processes table, "Parser service" row):
```markdown
| Parser service           | `python -m moto_parser`                  | Document indexing and optional OpenAI-backed authoring operations                   |
```
to:
```markdown
| Parser service           | `python -m lb_studio_parser`             | Document indexing and optional OpenAI-backed authoring operations                   |
```

Change each of the three occurrences of:
```bash
npm run build --workspace=@moto-ai/scorm-export
```
to:
```bash
npm run build --workspace=@lb-studio/scorm-export
```
(lines 378 and 598 are standalone code blocks; the third occurrence is inside the commands table, described next)

Change (in the commands table):
```markdown
| `npm run build --workspace=@moto-ai/scorm-export` | Build the standalone SCORM player bundle                              |
```
to:
```markdown
| `npm run build --workspace=@lb-studio/scorm-export` | Build the standalone SCORM player bundle                              |
```

Change line 635:
```markdown
- Build `@moto-ai/scorm-export` during the worker image or build phase.
```
to:
```markdown
- Build `@lb-studio/scorm-export` during the worker image or build phase.
```

- [ ] **Step 2: `GUIDE.md`**

Change line 1:
```markdown
# Moto AI Course Studio — User Guide
```
to:
```markdown
# Lionbridge Course Studio — User Guide
```

Change line 36:
```bash
python -m moto_parser
```
to:
```bash
python -m lb_studio_parser
```

**Leave the "no moto/g87 content" line (around line 68) unchanged** — same reasoning as README.md line 127.

Change line 298:
```bash
npm run build --workspace=@moto-ai/scorm-export
```
to:
```bash
npm run build --workspace=@lb-studio/scorm-export
```

**Leave line 305 unchanged:**
```
SCORM_PLAYER_BUNDLE_PATH=/Users/josemejias/Workbench-QA/moto-ai/packages/scorm-export
```
This documents the actual absolute path on this checkout's disk. Per this plan's Global Constraints, the on-disk folder name is not being renamed, so this line remains accurate as written — do not change it.

Change line 338:
```markdown
The ZIP includes the standalone Moto Player, frozen course content, media,
```
to:
```markdown
The ZIP includes the standalone Course Player, frozen course content, media,
```

Change line 359:
```markdown
`@moto-ai/scorm-export` and confirm `SCORM_PLAYER_BUNDLE_PATH` points to the
```
to:
```markdown
`@lb-studio/scorm-export` and confirm `SCORM_PLAYER_BUNDLE_PATH` points to the
```

- [ ] **Step 3: `CLAUDE.md` (root)**

Change lines 7-8:
```markdown
Moto AI Course Studio is an app-owned e-learning authoring platform. Authors
create an English learning master in Course Studio; the shared Moto Player
```
to:
```markdown
Lionbridge Course Studio is an app-owned e-learning authoring platform. Authors
create an English learning master in Course Studio; the shared Course Player
```

Change line 51:
```markdown
- `learning/` — the Moto Player itself: `player/` holds the renderer and
```
to:
```markdown
- `learning/` — the Course Player itself: `player/` holds the renderer and
```

Change line 127:
```bash
python -m moto_parser        # dev server w/ reload, http://127.0.0.1:8000
```
to:
```bash
python -m lb_studio_parser   # dev server w/ reload, http://127.0.0.1:8000
```

Change line 133:
```markdown
  `E`/`F`/`I`/`UP`/`B` rules, first-party import group is `moto_parser`).
```
to:
```markdown
  `E`/`F`/`I`/`UP`/`B` rules, first-party import group is `lb_studio_parser`).
```

Change line 163:
```markdown
  `apps/web` and `apps/job-worker` (e.g. `@moto-ai/contracts/jobs`); add new
```
to:
```markdown
  `apps/web` and `apps/job-worker` (e.g. `@lb-studio/contracts/jobs`); add new
```

- [ ] **Step 4: Verify**

Run: `grep -n -i "moto" README.md GUIDE.md CLAUDE.md`
Expected: only the two deliberately-unchanged lines remain (README.md's "no moto g87" line and GUIDE.md's "no moto/g87 content" line and its `SCORM_PLAYER_BUNDLE_PATH` absolute-path line) — every other line is gone.

- [ ] **Step 5: Commit**

```bash
git add README.md GUIDE.md CLAUDE.md
git commit -m "docs: rebrand product documentation to Lionbridge Course Studio"
```

---

## Self-Review Notes

- **Spec coverage:** npm scope (Task 1), MotoViewer (Task 2), Python parser service (Task 3), CI + env templates (Task 4), docs (Task 5) all covered. The GitHub repo rename (spec section 7) is deliberately excluded from the task loop per the Global Constraints — it's a controller-executed step after this plan's branch merges, not a task.
- **Non-goals respected:** no task touches `MotoSans`, the theme system's `moto-*` client-brand strings, or the user's real local `.env`/`.env.local`/local DB/on-disk folder name — each is called out explicitly where a naive global replace might otherwise have caught it (Task 4 Step 2, Task 5 Steps 1-2).
- **Type/name consistency:** `@lb-studio`, `lionbridge-course-studio`, `lb_studio_parser`/`lb-studio-parser`, and `CoursePlayer` are used identically across every task that references them.
- **Ordering:** Tasks 1-3 are independent of each other and could run in any order; Task 4 depends on Task 1's scope name; Task 5 depends on Tasks 1-3's final names. The task numbers above reflect a safe sequential order, not a hard requirement to run 1 before 2 before 3.
