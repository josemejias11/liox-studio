# Task 3 Report: Desktop Editor Shell Glass Treatment

## Changed files

- `apps/web/src/course-studio/CourseStudioWorkspace.tsx`
- `apps/web/src/course-studio/StudioToolbar.tsx`
- `apps/web/src/course-studio/CourseOutline.tsx`

## Implementation

- Applied the scoped workspace, toolbar, outline, control, and panel glass utilities to the desktop editor shell.
- Added a layered canvas backdrop and retained visible, keyboard-focusable resize separators.
- Preserved the existing inspector boundary, responsive fallback, resizing behavior, navigation and save flows, and all `AuthoringPreview` and learner content.

## Verification

`npm run lint` observed output:

```text
> moto-ai@0.1.0 lint
> eslint apps packages scripts
```

Exit code: 0.

`git diff --check` produced no output and exited 0.

Automated tests were not run because this task explicitly prohibits them.
