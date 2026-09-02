# Lionbridge Course Studio rebrand

Status: Draft
Date: 2026-09-02

## Background

This repository, its npm workspace scope, its Python service package, and its
internal component names are all currently branded `moto-ai`/`Moto`/`MotoAI`,
because the platform was originally built exclusively for Motorola content.

With the [course theme system](2026-09-02-course-theme-system-design.md)
shipped, the platform is now structurally ready to serve multiple Lionbridge
accounts (Motorola, Yamaha, Lenovo). That work deliberately scoped out one
thing: the tool's own identity still says "Moto AI" everywhere, which reads
as "Motorola's tool" to any other account team — exactly the
not-invented-here friction a shared platform needs to avoid.

This spec renames the tool's own identity to **Lionbridge Course Studio**
(repo slug `lionbridge-course-studio`, npm scope `@lb-studio`) — decided
earlier in conversation with the repo owner, favoring an explicit
company-branded name over an invented standalone brand, specifically to
signal "this is a shared company platform" to teams outside Motorola's.

## Goals

- Every occurrence of `moto-ai`/`@moto-ai`/`Moto AI`/`MotoAI` that refers to
  **the tool itself** (not a client) is renamed to the Lionbridge Course
  Studio identity, across: the npm workspace scope, the Python parser
  service's package name, the `MotoViewer` component, CI configuration,
  committed env templates, and prose documentation.
- The GitHub repository is renamed (`josemejias11/moto-ai` →
  `josemejias11/lionbridge-course-studio`) and the local git remote is
  updated to match.
- The rename is a single pass across all of the above — not phased into a
  later "internal renames" follow-up — since the client-color enum (the one
  piece that genuinely needed separate design work) is already handled by
  the theme system.

## Non-goals (explicitly out of scope)

- **Any genuine Motorola client-brand data**: `MotoSans` (Motorola's real
  font asset), the `moto-theme` id and its `moto-indigo`/`moto-frost`/
  `moto-pearl` color tokens (see the theme system spec), the
  `moto-indigo-black` `Hotspot` variant, and the `--color-moto-indigo`
  design token. These name an actual client's brand, not the tool — renaming
  them would be actively wrong, not just out of scope.
- **The user's local, gitignored `.env`/`.env.local`, their local Postgres
  database name (`moto_ai_dev`), and the on-disk repository folder name.**
  These are personal-machine artifacts with zero bearing on what anyone
  else sees of the project. Renaming them risks breaking the owner's active
  local dev setup (including the folder this very session runs in) for no
  benefit. Only the *committed templates* (`.env.example`,
  `.env.local.example`) and CI's own ephemeral Postgres identifiers are
  renamed — new setups get the new naming; the existing local one is left
  alone unless the owner does it themselves.
- **Any further multi-tenant theming work.** Already delivered separately.

## Design

### 1. npm workspace scope: `@moto-ai/*` → `@lb-studio/*`

Every workspace package's `package.json` "name" field, every
`"@moto-ai/<pkg>": "0.1.0"` dependency declaration, and every
`@moto-ai/<pkg>` import statement across `.ts`/`.tsx` files renames its
scope segment only — subpath names already introduced by the theme system
(e.g. `@moto-ai/contracts/course-themes`) keep their subpath, only the
scope changes, becoming `@lb-studio/contracts/course-themes`.

Root `package.json`'s `"name": "moto-ai"` becomes
`"name": "lionbridge-course-studio"` (matching the repo slug — this one
root-level name is the project's own identity, distinct from the internal
`@lb-studio/*` package scope used purely as an import prefix).
`package-lock.json` regenerates from this (`npm install`), it is never
hand-edited.

This is mechanical: a literal-string rename of `@moto-ai/` → `@lb-studio/`
wherever it appears in `package.json` files and `.ts`/`.tsx` source, plus
the one root-level product name change. `npm run typecheck` and
`npm run lint` are the correctness gate — a missed import breaks the build
immediately, there is no silent-failure mode here.

### 2. Python parser service package: `moto_parser` → `lb_studio_parser`

`services/parser-service/src/moto_parser/` is a real Python package
directory, not just a string. The rename is:

- Directory rename: `src/moto_parser/` → `src/lb_studio_parser/`.
- `pyproject.toml`: `name = "moto-parser"` → `name = "lb-studio-parser"`,
  the `moto-parser = "moto_parser.main:run"` script entry becomes
  `lb-studio-parser = "lb_studio_parser.main:run"`, and
  `known-first-party = ["moto_parser"]` (the ruff import-grouping config)
  becomes `["lb_studio_parser"]`.
- Every `from moto_parser import ...` / `import moto_parser` inside the
  package's own source and its `tests/` directory.
- `main.py`'s `uvicorn.run("moto_parser.main:app", ...)` string reference.
- `__main__.py`'s docstring (`"""Module entrypoint for` `` python -m
  moto_parser` ``"""`).
- The documented dev command `python -m moto_parser` in root `CLAUDE.md`,
  `README.md`, and `GUIDE.md` becomes `python -m lb_studio_parser`.

After the directory move, the service's venv must be reinstalled
(`pip install -e '.[dev]'`) for the renamed package to be importable — this
is a real environment step, not just a file edit, and belongs in the
implementation plan's verification steps (run `python -m unittest discover
-s tests`, `ruff check .`, `mypy src` after reinstalling).

`PARSER_SERVICE_TOKEN` and the service's own env vars are untouched — they
name a security mechanism, not the package.

### 3. `MotoViewer` → `CoursePlayer`

`apps/web/src/learning/player/MotoViewer.tsx` → `CoursePlayer.tsx`, the
`MotoViewer` component and its default export renamed to `CoursePlayer`,
and its one import site (`PlayerViewport.tsx`) updated. CLAUDE.md's
description of "the shared Moto Player" becomes "the shared Course Player"
to match.

### 4. CI (`.github/workflows/validate.yml`)

The ephemeral CI-only Postgres service credentials
(`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB: moto_ai`/`moto_ai_ci`)
and the resulting `DATABASE_URL`/`DIRECT_URL` rename to match the new
project identity (e.g. `lb_studio`/`lb_studio_ci`) — these values exist only
inside a single CI job run and carry no external meaning. The
`npm run build --workspace=@moto-ai/scorm-export` step updates to the new
scope from item 1.

### 5. Committed env templates

`.env.example` and `.env.local.example`'s example `DATABASE_URL`/
`DIRECT_URL` values (`moto_ai_dev`) update to match the new naming, so a
fresh clone's setup instructions are internally consistent with the new
project name. As stated in Non-goals, the owner's actual `.env`/`.env.local`
are not touched.

### 6. Documentation

README.md, GUIDE.md, and both CLAUDE.md files (root and `apps/web/`)
currently read "Moto AI" / "Moto AI Course Studio" / "Moto Player" as the
product's own name in prose. Each occurrence is read in context and
rewritten:

- "Moto AI" / "Moto AI Course Studio" (the product) → "Lionbridge Course
  Studio".
- "Moto Player" (the product's internal renderer, matching the Task 3
  rename) → "Course Player".
- Any mention of "Motorola" or "moto g87"-style client content references
  (there is one such example string in README.md/GUIDE.md illustrating a
  lesson with "no moto g87 or other [client] content") is left as-is — it's
  describing example client content, not the tool's brand.

### 7. GitHub repository rename

`gh repo rename lionbridge-course-studio` (renames
`josemejias11/moto-ai` → `josemejias11/lionbridge-course-studio`; GitHub
auto-redirects the old URL for both git and web access, so nothing that
still points at the old URL breaks). The local repository's `origin` remote
is then updated explicitly (`git remote set-url origin
<new-url>`) rather than relying on the redirect long-term. No committed
file hardcodes the repository's GitHub URL (verified: no
`github.com/josemejias11/moto-ai` string exists in any doc), so this step
touches only the GitHub-side resource and the local git config — nothing
else in the plan depends on ordering this before or after the code changes.

## Migration / rollout notes

- This is a pure rename with no data migration — nothing is persisted under
  the old package names at runtime (unlike the theme system's `Course.cover`
  JSON, there's no stored data shaped by `@moto-ai/*` or `moto_parser`).
- `PARSER_SERVICE_TOKEN` must still match between the root app's env and the
  parser service's env after the rename — this is an existing constraint
  (see CLAUDE.md), unaffected by the package rename itself, but worth
  re-confirming during verification since the service's dev command changes.
- After merge, anyone with a local clone (in practice, just the repo owner)
  needs to run `npm install` (regenerates `package-lock.json` under the new
  root name) and reinstall the parser service's venv.

## Testing

- TypeScript/JS: `npm run typecheck` and `npm run lint` (this repo's only
  configured checks, per CLAUDE.md) must pass with zero remaining
  `@moto-ai/` references anywhere in `.ts`/`.tsx`/`package.json` files
  (grep for `@moto-ai` as the final verification, expecting zero hits
  outside `node_modules`/`.git`).
- Python: `python -m unittest discover -s tests`, `ruff check .`, and
  `mypy src` inside the reinstalled venv, run from
  `services/parser-service`.
- Manual: `npm run dev` starts cleanly; Course Studio loads and an existing
  course's preview renders (confirms `CoursePlayer` rename didn't break the
  import chain); `python -m lb_studio_parser` starts the parser service's
  dev server successfully.
- A final repo-wide grep for `moto-ai`/`moto_parser`/`MotoViewer` (excluding
  `node_modules`, `.git`, and the explicitly-out-of-scope client-brand
  strings listed in Non-goals) should return zero hits.

## Open questions

None — the two decisions that were genuinely open (GitHub repo rename:
yes; phasing: one pass) were confirmed by the repo owner during
brainstorming.
