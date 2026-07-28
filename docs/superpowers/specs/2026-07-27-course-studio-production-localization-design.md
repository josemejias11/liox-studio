# Course Studio Production and Localization Design

## Purpose

Course Studio is Lionbridge’s internal e-learning production system for Motorola. It replaces the Articulate master-file workflow for e-learning only.

It is not a learner LMS, a Motorola authoring portal, an agency portal, or an asset-management system for PPTX, print, and other non-e-learning deliverables.

## Current workflow and target workflow

### Current

1. Lionbridge creates an English Articulate Storyline master (`.story`).
2. Lionbridge sends that master to Motorola.
3. Motorola distributes it to third-party localization agencies.
4. Agencies localize the course without redesigning layouts or interaction behavior.
5. Motorola distributes the finished course through Motorola Insiders.

### Target

1. Lionbridge builds an English master course in Course Studio.
2. Lionbridge approves and freezes a master version for localization.
3. Course Studio exports a localization package for Motorola to distribute externally.
4. Agencies return a completed localized package to Motorola/Lionbridge.
5. Lionbridge imports, validates, reviews, and approves the localized course.
6. Course Studio produces the final localized e-learning release for Motorola Insiders.

## Product boundary

Course Studio is a Lionbridge-only production tool.

- Lionbridge authors, project leads, and QA reviewers use it.
- Motorola does not author in it.
- Localization agencies do not receive accounts or edit directly in it.
- Motorola Insiders remains the downstream distribution, incentives, community, and learner platform.
- PPTX, print, PDF, and other supporting assets remain managed by other Lionbridge team members outside Course Studio. Courses may link to approved supporting assets, but Course Studio does not own their production workflow.

### Initial access model

Course Studio lives at `/studio` in the Moto AI application. Lionbridge users
authenticate with the dedicated Course Studio credential; Motorola and agency
accounts remain out of scope. PostgreSQL owns authoring and review state, while
private Cloudflare R2 storage owns media and source-file bytes.

## Structured authoring model

Course Studio is not a free-form slide editor or a Storyline clone. It uses a controlled library of production-ready learning blocks, for example:

- content and product-introduction blocks;
- feature exploration and hotspots;
- video;
- scenarios;
- quizzes and knowledge checks;
- comparison and recap blocks.

Each block has locked visual behavior and interaction logic. Lionbridge authors provide copy, media, and approved product-specific configuration. This allows a single behavior to be designed, validated, and reused across courses and locales.

The existing Moto Tutor lesson types are the start of this reusable block library. Course Studio will treat them as authoring components rather than one-off learner screens.

## Localization package

Course Studio exports an agency-facing localization package rather than a proprietary editable course file. It contains only the information needed to localize a fixed course structure:

- translatable course copy, labels, and quiz content;
- captions, transcripts, and locale metadata;
- a media and asset manifest identifying replaceable locale-specific assets;
- stable content IDs that map returned translations to the correct course block;
- instructions and a change log for the frozen source version.

Agencies may translate content and supply approved locale assets. They do not alter layouts, navigation, scoring, or interaction behavior.

On import, Course Studio validates that the returned package belongs to the expected source version, contains required translations, matches stable IDs, and supplies all required locale assets. Incomplete or mismatched packages cannot advance to Lionbridge review.

## Version and release model

Every master and locale is a tracked release. No localized work is silently overwritten.

```text
Draft
→ English approved
→ localization package exported
→ localized package returned
→ Lionbridge QA
→ approved for Motorola
→ published / archived
```

If the English master changes after a locale was exported, Course Studio marks the locale out of date and identifies the changed content. Lionbridge can export a focused update package rather than recreate the full course.

## Publishing boundary

Course Studio produces a final localized e-learning release. Its publishing layer remains an adapter because Motorola Insiders’ accepted technical format is not yet confirmed.

The adapter must support a future SCORM/xAPI package or a hosted launch package, without changing authoring, localization, or QA records. Motorola’s existing Insiders workflow continues to own downstream distribution.

## AI role

AI remains a core Course Studio capability, with human approval at every release boundary.

### Production AI

Production AI accelerates Lionbridge’s work without becoming the source of truth. It can:

- turn approved source material into a proposed course outline and block draft;
- suggest learning objectives, knowledge checks, and revision copy;
- show changes in the English master since a locale was exported;
- detect missing translations, missing required locale assets, and unusually long translated labels before QA;
- summarize an incomplete or mismatched returned localization package for a Lionbridge reviewer.

AI may propose content but cannot publish, approve localization, or silently modify a frozen release. Lionbridge remains responsible for editorial, product, and localization approval.

### Learner AI

The existing learner tutor remains an optional course capability. When enabled, it answers only from approved course and product content for the learner’s locale. It is never required for completion, cannot invent unapproved product claims, and can be omitted from any course or publishing format that cannot support it.

## Non-goals for the first foundation

- Rebuilding Motorola Insiders.
- Building a free-form Storyline-like slide editor.
- Giving Motorola or agencies Course Studio accounts.
- Managing non-e-learning production assets.
- Assuming an Insiders integration format before its documentation is available.

## Success criteria

- Lionbridge can author an English course from reusable blocks.
- A frozen master can produce an external localization package.
- A returned localized package can be validated and previewed without changing course behavior.
- Lionbridge can see the locale’s release state and source-version differences.
- A final approved locale can be prepared for the eventual Insiders publishing adapter.
