---
description: Build a course in Course Studio from a folder of local source/media files, using the course-studio-content-engineer agent.
argument-hint: <folder-path> [brief]
---

## Task

Dispatch the `course-studio-content-engineer` subagent to build a course
end-to-end from a local folder of files.

Arguments: `$ARGUMENTS`

The first argument is a folder path on this machine. Everything after it
(if present) is the author brief — audience, learning goals, tone. If no
brief is given, ask the user for one before dispatching (per the agent's
own "confirm scope with the user before building" rule) rather than
inventing one.

Dispatch the `course-studio-content-engineer` subagent (not
`general-purpose`) with a task that includes:

- The folder path, with instructions to inventory it per the agent's
  "Authoring operating procedure" step 1 — classify each file as an
  AI/citation source (PDF/PPTX/DOCX/XLSX, ≤50MB), lesson media
  (images/video), or irrelevant.
- The author brief.
- A reminder that AI drafting is expected to be unavailable right now (no
  embedding budget — sources will reach `EXTRACTED`, not `INDEXED`) and
  hand-authoring from the extracted source text is the normal path, not a
  fallback.
