# Remove Avatar and Card UI Components

## Goal

Remove the unused avatar feature and the generic avatar/card component files from `src/components/ui` without changing the appearance or behavior of the course grid.

## Scope

- Remove the avatar displayed in the home-page header.
- Replace the home-page `Card`, `CardHeader`, and `CardContent` wrappers with semantic `div` elements carrying the required layout and visual classes.
- Delete `src/components/ui/avatar.tsx` and `src/components/ui/card.tsx`.
- Remove `@base-ui/react`, which is used only by the avatar component, from the application dependencies and lockfile.
- Preserve unrelated existing `package-lock.json` changes.

## Design

The home page remains the sole owner of its course-tile presentation. Each course link will contain a plain root `div` with the card background, foreground, border/ring, rounding, flex layout, overflow, hover, and transition classes previously supplied by the generic Card component. The title/description section and chapter-count section will remain plain nested `div` elements with their current page-specific classes.

The header will retain the Analytics link and theme toggle. The avatar and its remote GitHub image will be removed entirely, with no replacement placeholder.

Deleting the two component files leaves `src/components/ui` empty, so the directory will disappear naturally. Shared card color tokens in `src/app/globals.css` remain because the application still uses card-themed styles. `components.json` also remains because it configures the existing shadcn-compatible tooling and aliases independently of these two files.

## Data Flow and Error Handling

Course fetching, Sanity contract validation, routing, image rendering, and empty-state behavior remain unchanged. This cleanup adds no new data flow or error states.

## Dependency Handling

`@base-ui/react` will be removed through the package manager so `package.json` and `package-lock.json` stay consistent. Because `package-lock.json` already contains unrelated user changes, the resulting diff will be checked to confirm those changes remain intact.

## Verification

- Search the repository for imports or usages of the deleted avatar/card components.
- Confirm `@base-ui/react` is absent from the dependency manifest and lockfile unless retained transitively for another package.
- Run the TypeScript typecheck.
- Run lint.
- Run relevant project tests or a production build if the standard checks reveal integration risk.

## Out of Scope

- Redesigning the course tiles or header.
- Removing card-related theme tokens.
- Removing shadcn tooling or `components.json`.
- Refactoring unrelated UI or Sanity components that use their own card concepts.
