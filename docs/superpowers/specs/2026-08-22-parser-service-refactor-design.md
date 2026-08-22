# Parser Service Refactor Design

## Purpose

Refactor the private Python parser service so it matches the application's
modular boundaries without changing its authoring-only behavior.

## In scope

- Preserve the existing five HTTP endpoints and their JSON payloads.
- Preserve the private caller path: web or job worker -> parser client ->
  parser service.
- Separate OpenAI client construction, Chroma retrieval, document indexing,
  and authoring-draft use cases into focused modules.
- Keep source indexing, Assistant Q&A drafts, and editable course-draft
  generation as the only active integrations.
- Keep the unused quiz endpoint stable but add no caller or product flow for
  it.
- Remove stale lint residue and repair parser-service documentation links.

## Out of scope

- New generative learner behavior, local models, provider changes, schema
  migrations, queue semantics changes, or a new quiz workflow.
- Moving Python code into an npm workspace or allowing browser access to the
  service.

## Target boundary

`main.py` remains the HTTP adapter. A runtime/provider module owns OpenAI and
Chroma lifecycle. A retrieval module owns collection lookup, caching, source
scoping, and context formatting. Document and drafting use-case modules call
those focused interfaces. `packages/parser-client` remains the sole
TypeScript-facing adapter.

## Compatibility and verification

Routes, status mapping, request/response field names, prompts, model settings,
and source-ID scoping remain unchanged. Do not add test files under the
project's no-new-tests preference. Validate with Python compilation, Ruff,
Mypy, TypeScript typechecking, and manual source/contract comparison. The
OpenAI service is not invoked during verification.
