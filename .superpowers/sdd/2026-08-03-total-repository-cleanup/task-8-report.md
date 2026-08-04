# Task 8: orphan source and comment cleanup

## Contract decision

Retain a source file only when an import, Next.js convention entrypoint, package
export, or configuration/runtime entrypoint owns it. This task made no route,
URL, lesson-ID, progress-key, frozen-review, authoring-control, learning
interaction, or grounded-AI contract changes.

## Candidate and ownership evidence

| Candidate or surface | Ownership check | Result |
| --- | --- | --- |
| `apps/web/src/components/FullWidthCarousel.tsx` | Repository-wide exact-name scan found only its declaration; it is not a Next.js route/entrypoint, package export, or config/runtime reference. | Deleted as a genuine orphan. |
| `apps/web/src/learning/player/lesson-types/registry.ts` loaders, registry, and render-input type | The loader constants, registry, and input type are consumed only inside the registry; only `LessonCompletionMode`, `getLessonCompletionMode`, and `renderLesson` have feature callers. | Made internal-only; retained the public feature API. |
| Database review/trash return types, generation-status alias, and revision alias | Repository-wide import scan found no consumer of the named barrel exports. `createCourseRevision` only aliased `freezeCourseRevision`, while the authoring command was its sole caller. Repository functions still own their internal return types; `CourseTrashItem` remains imported by authoring commands. | Removed unowned named barrel exports, made internal-only types private, and standardized the authoring command on `freezeCourseRevision`. |
| Web routes, pages, layouts, route handlers, package roots, Prisma schema, parser modules, and script runner | Next route inventory, package `exports`, root/workspace scripts, Next config, `pyproject.toml` (`moto-parser = moto_parser.main:run`), and Python import/entrypoint scans each showed an active owner. | Retained. |

The empty-directory scan reported only `services/parser-service/venv/include`,
which is ignored local virtual-environment state rather than a tracked source
directory; it was intentionally left untouched.

## Comment review

Removed narration, restatements, stale `PulseHotspot` history, JSX layout
labels, and compatibility/future-endpoint explanations across the runtime
TypeScript/TSX surfaces, including analytics, learner player, authoring, shared
contracts, parser client, and quiz contracts. The remaining runtime comments
are limited to required ESLint directives.

- The retained Next CSP comment describes a platform constraint and deliberate
  nonce tradeoff; generated declarations and required lint/tooling directives
  remain untouched.

## Changed paths

- Deleted `apps/web/src/components/FullWidthCarousel.tsx`.
- Updated the learner registry and database barrel/repository visibility to
  remove internal-only exports and the `createCourseRevision` compatibility
  alias; authoring now calls the canonical `freezeCourseRevision` operation.
- Removed narration/restatement comments repository-wide from runtime
  TypeScript/TSX sources.
- Created this report.

## Verification

| Command | Observed result |
| --- | --- |
| tracked-file, export, import, Next route/entrypoint, package-export, config/runtime-reflection, and parser-entrypoint scans | Confirmed the ownership decisions above; only `FullWidthCarousel.tsx` met every deletion condition. |
| `find apps packages services scripts -type d -empty | sort` | Only ignored local `services/parser-service/venv/include` appeared. |
| stale-term scan for `sanity`, `courseMode`, `pulsehotspot`, `legacy-payload`, and `legacy payload` | No runtime-source matches. |
| `npm run typecheck` | Passed: all six workspaces completed `tsc --noEmit`. |
| `npm run lint` | Passed: ESLint completed for `apps`, `packages`, and `scripts`. |
| `git diff --check` | Passed with no whitespace errors. |

### Fix round 1 verification

- `rg -n "createCourseRevision|future endpoint|Compatibility" apps packages services scripts --glob '*.{ts,tsx,js,mjs,py}'` returned no matches.
- Re-ran `npm run typecheck` and `npm run lint`; both passed after removing the
  alias and comment narration.

## Scope boundary and residual risk

Task 9 was not started: no database migration, build, server, worker, parser,
browser, authenticated persistence, learner-progress, or review-flow work was
performed. No automated test files were created and no automated tests were
run, as required. Static checks do not provide runtime or browser-flow proof;
that remains Task 9 work.
