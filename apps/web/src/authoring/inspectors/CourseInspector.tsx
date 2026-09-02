'use client';

import type { CourseGraph } from '@moto-ai/contracts/course-studio';
import { COURSE_THEMES, type CourseTheme } from '@moto-ai/contracts/course-themes';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  courseSettingsInputSchema,
  createCourseStudioKey,
  type CourseSettingsInput,
} from '@/shared/contracts/course-settings';
import { CourseMediaField } from './CourseMediaField';
import {
  errorMap,
  formDraft,
  formFingerprint,
  formPayload,
  type CourseFormDraft,
  type CoverDraft,
  type DisclaimerDraft,
} from './course-inspector-draft';
import { SpecificationsField } from './SpecificationsField';
import { StringListField } from './StringListField';

export interface CourseInspectorProps {
  course: CourseGraph;
  disabled?: boolean;
  formId?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveStateChange?: (state: CourseInspectorSaveState) => void;
  onSave: (input: CourseSettingsInput) => Promise<void>;
  sourcePanel?: ReactNode;
}

export interface CourseInspectorSaveState {
  dirty: boolean;
  valid: boolean;
  locked: boolean;
  saving: boolean;
  uploading: boolean;
  saved: boolean;
  error: string | null;
}

const inputClass =
  'studio-glass-control mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';
const actionClass =
  'studio-glass-control inline-flex min-h-11 items-center justify-center rounded-lg border border-input px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function CourseInspector({
  course,
  disabled = false,
  formId = 'course-settings-form',
  onDirtyChange,
  onSaveStateChange,
  onSave,
  sourcePanel,
}: CourseInspectorProps) {
  const initial = useMemo(() => formDraft(course), [course]);
  const [form, setForm] = useState<CourseFormDraft>(initial);
  const [sourceCourse, setSourceCourse] = useState(course);
  const [baseline, setBaseline] = useState(() => formFingerprint(initial));
  const [saving, setSaving] = useState(false);
  const [activeUploadIds, setActiveUploadIds] = useState<Set<string>>(() => new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(true);

  if (course !== sourceCourse) {
    setSourceCourse(course);
    setForm(initial);
    setBaseline(formFingerprint(initial));
    setSaveError(null);
    setSaved(false);
  }

  const dirty = formFingerprint(form) !== baseline;
  const uploading = activeUploadIds.size > 0;
  const locked = disabled || saving || uploading;
  const validation = useMemo(() => courseSettingsInputSchema.safeParse(formPayload(form)), [form]);
  const valid = validation.success;
  const errors = useMemo<Record<string, string>>(
    () => (dirty && !validation.success ? errorMap(validation.error.issues) : {}),
    [dirty, validation],
  );
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    onSaveStateChange?.({
      dirty,
      valid,
      locked,
      saving,
      uploading,
      saved,
      error: saveError,
    });
  }, [dirty, locked, onSaveStateChange, saveError, saved, saving, uploading, valid]);

  const objectiveErrors = useMemo(
    () =>
      Object.fromEntries(
        form.learningObjectives.map((item, index) => [
          item.clientKey,
          errors[`learningObjectives.${index}`],
        ]),
      ),
    [errors, form.learningObjectives],
  );
  const disclaimerErrors = useMemo(
    () =>
      form.disclaimer
        ? Object.fromEntries(
            form.disclaimer.disclaimers.map((item, index) => [
              item.clientKey,
              errors[`disclaimer.disclaimers.${index}`],
            ]),
          )
        : {},
    [errors, form.disclaimer],
  );
  const specificationErrors = useMemo<Record<string, string | undefined>>(() => {
    const mapped: Record<string, string | undefined> = {};
    form.specifications.forEach((specification, specificationIndex) => {
      mapped[`${specification.clientKey}.title`] =
        errors[`specifications.${specificationIndex}.title`];
      specification.footnotes.forEach((footnote, footnoteIndex) => {
        mapped[`${specification.clientKey}.${footnote.clientKey}`] =
          errors[`specifications.${specificationIndex}.footnotes.${footnoteIndex}`];
      });
      specification.groups.forEach((group, groupIndex) => {
        mapped[`${specification.clientKey}.${group.clientKey}.groupName`] =
          errors[`specifications.${specificationIndex}.specGroups.${groupIndex}.groupName`];
        group.rows.forEach((row, rowIndex) => {
          mapped[`${specification.clientKey}.${group.clientKey}.${row.clientKey}.label`] =
            errors[
              `specifications.${specificationIndex}.specGroups.${groupIndex}.specs.${rowIndex}.label`
            ];
          mapped[`${specification.clientKey}.${group.clientKey}.${row.clientKey}.value`] =
            errors[
              `specifications.${specificationIndex}.specGroups.${groupIndex}.specs.${rowIndex}.value`
            ];
        });
      });
    });
    return mapped;
  }, [errors, form.specifications]);

  function update(updateForm: (current: CourseFormDraft) => CourseFormDraft) {
    setSaved(false);
    setSaveError(null);
    setForm(updateForm);
  }

  const onUploadStateChange = useCallback((fieldId: string, active: boolean) => {
    setActiveUploadIds((current) => {
      const next = new Set(current);
      if (active) next.add(fieldId);
      else next.delete(fieldId);
      return next;
    });
  }, []);

  function fieldError(name: string) {
    return errors[name];
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    setSaved(false);
    setSaveError(null);
    if (!validation.success) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    setSaving(true);
    try {
      await onSave(validation.data);
      setBaseline(formFingerprint(form));
      setSaved(true);
    } catch (caught) {
      setSaveError(
        caught instanceof Error ? caught.message : 'Course settings could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  }

  const disclaimer = form.disclaimer;
  return (
    <form
      className="studio-glass-panel flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain"
      id={formId}
      noValidate
      onSubmit={submit}
    >
      <header className="studio-glass border-border sticky top-0 z-10 border-x-0 border-t-0 border-b px-5 py-4">
        <p className="text-primary text-[11px] font-semibold tracking-[0.16em] uppercase">
          Course settings
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Edit the learner-facing course experience with guided controls.
        </p>
      </header>
      <div className="space-y-5 px-5 py-5">
        <fieldset className="studio-glass-control border-border space-y-4 rounded-xl border p-3">
          <legend className="px-1 text-sm font-semibold">General</legend>
          <label className="block text-xs font-medium" htmlFor="course-title">
            Title
            <input
              aria-describedby={fieldError('title') ? 'course-title-error' : undefined}
              aria-invalid={Boolean(fieldError('title'))}
              className={inputClass}
              disabled={locked}
              id="course-title"
              maxLength={120}
              onChange={(event) => update((current) => ({ ...current, title: event.target.value }))}
              value={form.title}
            />
          </label>
          {fieldError('title') && (
            <p className="text-destructive text-xs" id="course-title-error">
              {fieldError('title')}
            </p>
          )}
          <label className="block text-xs font-medium" htmlFor="course-slug">
            Slug
            <input
              aria-describedby={
                fieldError('slug') ? 'course-slug-help course-slug-error' : 'course-slug-help'
              }
              aria-invalid={Boolean(fieldError('slug'))}
              className={inputClass}
              disabled={locked}
              id="course-slug"
              maxLength={100}
              onChange={(event) => update((current) => ({ ...current, slug: event.target.value }))}
              value={form.slug}
            />
          </label>
          <p className="text-muted-foreground text-xs" id="course-slug-help">
            The saved URL may be normalized.
          </p>
          {fieldError('slug') && (
            <p className="text-destructive text-xs" id="course-slug-error">
              {fieldError('slug')}
            </p>
          )}
          <label className="block text-xs font-medium" htmlFor="course-description">
            Description
            <textarea
              className={`${inputClass} min-h-24`}
              disabled={locked}
              id="course-description"
              maxLength={2000}
              onChange={(event) =>
                update((current) => ({ ...current, description: event.target.value }))
              }
              value={form.description}
            />
          </label>
        </fieldset>

        <StringListField
          addLabel="Add objective"
          disabled={locked}
          emptyMessage="No objectives have been added."
          errors={objectiveErrors}
          itemLabel="Objective"
          items={form.learningObjectives}
          legend="Learning objectives"
          onChange={(learningObjectives) =>
            update((current) => ({ ...current, learningObjectives }))
          }
        />

        <fieldset className="studio-glass-control border-border space-y-4 rounded-xl border p-3">
          <legend className="px-1 text-sm font-semibold">Theme</legend>
          <label className="block text-xs font-medium" htmlFor="course-theme">
            Client theme
            <select
              className={inputClass}
              disabled={locked}
              id="course-theme"
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  theme: event.target.value as CourseTheme,
                }))
              }
              value={form.theme}
            >
              {Object.entries(COURSE_THEMES).map(([id, tokens]) => (
                <option key={id} value={id}>
                  {tokens.label}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <fieldset className="studio-glass-control border-border space-y-4 rounded-xl border p-3">
          <legend className="px-1 text-sm font-semibold">Course cover</legend>
          <label className="block text-xs font-medium" htmlFor="cover-headline">
            Cover headline
            <input
              className={inputClass}
              disabled={locked}
              id="cover-headline"
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  cover: { ...current.cover, present: true, coverHeadline: event.target.value },
                }))
              }
              value={form.cover.coverHeadline}
            />
          </label>
          <label className="block text-xs font-medium" htmlFor="cover-button-text">
            Start button label
            <input
              className={inputClass}
              disabled={locked}
              id="cover-button-text"
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  cover: { ...current.cover, present: true, coverButtonText: event.target.value },
                }))
              }
              value={form.cover.coverButtonText}
            />
          </label>
          <label className="block text-xs font-medium" htmlFor="cover-button-color">
            Start button colour
            <select
              className={inputClass}
              disabled={locked}
              id="cover-button-color"
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  cover: {
                    ...current.cover,
                    present: true,
                    coverButtonColor: event.target.value as CoverDraft['coverButtonColor'],
                  },
                }))
              }
              value={form.cover.coverButtonColor}
            >
              <option value="">Default</option>
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="tertiary">Tertiary</option>
            </select>
            <span className="mt-2 flex gap-2" aria-hidden="true">
              {(['primary', 'secondary', 'tertiary'] as const).map((slot) => (
                <span
                  key={slot}
                  className={`h-5 w-5 rounded-full border border-white/20 ${COURSE_THEMES[form.theme].buttonColors[slot]}`}
                  title={slot}
                />
              ))}
            </span>
          </label>
          <CourseMediaField
            courseId={course.id}
            disabled={locked}
            id="cover-image"
            label="Cover image"
            onChange={(coverImage) =>
              update((current) => ({
                ...current,
                cover: { ...current.cover, present: true, coverImage },
              }))
            }
            onUploadStateChange={onUploadStateChange}
            value={form.cover.coverImage}
          />
          <CourseMediaField
            courseId={course.id}
            disabled={locked}
            id="course-thumbnail"
            label="Library thumbnail"
            onChange={(thumbnail) =>
              update((current) => ({
                ...current,
                cover: { ...current.cover, present: true, thumbnail },
              }))
            }
            onUploadStateChange={onUploadStateChange}
            value={form.cover.thumbnail}
          />
        </fieldset>

        <SpecificationsField
          courseId={course.id}
          disabled={locked}
          errors={specificationErrors}
          onChange={(specifications) => update((current) => ({ ...current, specifications }))}
          onUploadStateChange={onUploadStateChange}
          value={form.specifications}
        />

        <section className="studio-glass-control border-border rounded-xl border">
          <div className="flex items-center justify-between gap-3 p-3">
            <button
              aria-controls="disclaimer-content"
              aria-expanded={disclaimerOpen}
              className="focus-visible:ring-ring min-h-11 flex-1 rounded-lg px-2 text-left text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => setDisclaimerOpen((current) => !current)}
              type="button"
            >
              Disclaimer
            </button>
            {disclaimer && (
              <button
                className={actionClass}
                disabled={locked}
                onClick={() => update((current) => ({ ...current, disclaimer: null }))}
                type="button"
              >
                Remove disclaimer
              </button>
            )}
          </div>
          {disclaimerOpen && (
            <div className="border-border space-y-4 border-t p-3" id="disclaimer-content">
              {!disclaimer ? (
                <>
                  <p className="text-muted-foreground text-xs">No disclaimer has been added.</p>
                  <button
                    className={actionClass}
                    disabled={locked}
                    onClick={() =>
                      update((current) => ({
                        ...current,
                        disclaimer: {
                          clientKey: createCourseStudioKey('disclaimer'),
                          title: '',
                          category: 'general',
                          body: '',
                          disclaimers: [],
                          acknowledgementRequired: false,
                          acknowledgementLabel: '',
                        },
                      }))
                    }
                    type="button"
                  >
                    Add disclaimer
                  </button>
                </>
              ) : (
                <>
                  <label className="block text-xs font-medium" htmlFor="disclaimer-title">
                    Title
                    <input
                      className={inputClass}
                      disabled={locked}
                      id="disclaimer-title"
                      onChange={(event) =>
                        update((current) => ({
                          ...current,
                          disclaimer: current.disclaimer
                            ? { ...current.disclaimer, title: event.target.value }
                            : null,
                        }))
                      }
                      value={disclaimer.title}
                    />
                  </label>
                  <label className="block text-xs font-medium" htmlFor="disclaimer-category">
                    Category
                    <select
                      className={inputClass}
                      disabled={locked}
                      id="disclaimer-category"
                      onChange={(event) =>
                        update((current) => ({
                          ...current,
                          disclaimer: current.disclaimer
                            ? {
                                ...current.disclaimer,
                                category: event.target.value as DisclaimerDraft['category'],
                              }
                            : null,
                        }))
                      }
                      value={disclaimer.category}
                    >
                      <option value="general">General</option>
                      <option value="legal">Legal</option>
                      <option value="safety">Safety</option>
                      <option value="regulatory">Regulatory</option>
                      <option value="warranty">Warranty</option>
                    </select>
                  </label>
                  <label className="block text-xs font-medium" htmlFor="disclaimer-body">
                    Body
                    <textarea
                      aria-describedby={
                        fieldError('disclaimer.body') ? 'disclaimer-body-error' : undefined
                      }
                      aria-invalid={Boolean(fieldError('disclaimer.body'))}
                      className={`${inputClass} min-h-24`}
                      disabled={locked}
                      id="disclaimer-body"
                      onChange={(event) =>
                        update((current) => ({
                          ...current,
                          disclaimer: current.disclaimer
                            ? { ...current.disclaimer, body: event.target.value }
                            : null,
                        }))
                      }
                      value={disclaimer.body}
                    />
                  </label>
                  {fieldError('disclaimer.body') && (
                    <p className="text-destructive text-xs" id="disclaimer-body-error">
                      {fieldError('disclaimer.body')}
                    </p>
                  )}
                  <StringListField
                    addLabel="Add disclaimer item"
                    disabled={locked}
                    emptyMessage="No disclaimer items have been added."
                    errors={disclaimerErrors}
                    itemLabel="Disclaimer item"
                    items={disclaimer.disclaimers}
                    legend="Disclaimer items"
                    onChange={(disclaimers) =>
                      update((current) => ({
                        ...current,
                        disclaimer: current.disclaimer
                          ? { ...current.disclaimer, disclaimers }
                          : null,
                      }))
                    }
                  />
                  <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
                    <input
                      checked={disclaimer.acknowledgementRequired}
                      disabled={locked}
                      onChange={(event) =>
                        update((current) => ({
                          ...current,
                          disclaimer: current.disclaimer
                            ? {
                                ...current.disclaimer,
                                acknowledgementRequired: event.target.checked,
                              }
                            : null,
                        }))
                      }
                      type="checkbox"
                    />
                    Require acknowledgement
                  </label>
                  {disclaimer.acknowledgementRequired && (
                    <label className="block text-xs font-medium" htmlFor="acknowledgement-label">
                      Acknowledgement label
                      <input
                        className={inputClass}
                        disabled={locked}
                        id="acknowledgement-label"
                        onChange={(event) =>
                          update((current) => ({
                            ...current,
                            disclaimer: current.disclaimer
                              ? { ...current.disclaimer, acknowledgementLabel: event.target.value }
                              : null,
                          }))
                        }
                        value={disclaimer.acknowledgementLabel}
                      />
                    </label>
                  )}
                </>
              )}
            </div>
          )}
        </section>
        {sourcePanel}
      </div>
    </form>
  );
}
