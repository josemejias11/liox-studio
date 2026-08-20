'use client';

import { useState } from 'react';
import {
  createCourseStudioKey,
  createStableCourseStudioKey,
  imageReference,
  jsonObject,
  mergeKnownFields,
  stringField,
  type ImageReference,
  type JsonObject,
} from '@/shared/contracts/course-settings';
import { CourseMediaField } from './CourseMediaField';
import { StringListField, type StringListItem } from './StringListField';

interface SpecificationRowDraft {
  clientKey: string;
  highlight: boolean;
  label: string;
  original?: JsonObject;
  value: string;
}

interface SpecificationGroupDraft {
  clientKey: string;
  groupName: string;
  original?: JsonObject;
  rows: SpecificationRowDraft[];
}

export interface SpecificationDraft {
  clientKey: string;
  footnotes: StringListItem[];
  heroImage?: ImageReference;
  original?: JsonObject;
  groups: SpecificationGroupDraft[];
  subtitle: string;
  title: string;
}

interface SpecificationsFieldProps {
  courseId: string;
  disabled?: boolean;
  errors?: Record<string, string | undefined>;
  onChange: (items: SpecificationDraft[]) => void;
  onUploadStateChange?: (fieldId: string, uploading: boolean) => void;
  value: SpecificationDraft[];
}

const inputClass =
  'studio-glass-control mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';
const actionClass =
  'studio-glass-control inline-flex min-h-11 items-center justify-center rounded-lg border border-input px-3 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function objectArray(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => Object.keys(jsonObject(item)).length > 0)
    : [];
}

function createRow(): SpecificationRowDraft {
  return { clientKey: createCourseStudioKey('spec-row'), label: '', value: '', highlight: false };
}

function createGroup(): SpecificationGroupDraft {
  return { clientKey: createCourseStudioKey('spec-group'), groupName: '', rows: [] };
}

function createSpecification(): SpecificationDraft {
  return {
    clientKey: createCourseStudioKey('specification'),
    title: '',
    subtitle: '',
    groups: [],
    footnotes: [],
  };
}

export function specificationDrafts(value: unknown): SpecificationDraft[] {
  return objectArray(value).map((source, specificationIndex) => ({
    clientKey: createStableCourseStudioKey('specification', specificationIndex),
    original: source,
    title: stringField(source.title),
    subtitle: stringField(source.subtitle),
    heroImage: imageReference(source.heroImage),
    groups: objectArray(source.specGroups).map((group, groupIndex) => ({
      clientKey: createStableCourseStudioKey(`spec-group-${specificationIndex}`, groupIndex),
      original: group,
      groupName: stringField(group.groupName),
      rows: objectArray(group.specs).map((row, rowIndex) => ({
        clientKey: createStableCourseStudioKey(
          `spec-row-${specificationIndex}-${groupIndex}`,
          rowIndex,
        ),
        original: row,
        label: stringField(row.label),
        value: stringField(row.value),
        highlight: row.highlight === true,
      })),
    })),
    footnotes: Array.isArray(source.footnotes)
      ? source.footnotes
          .filter((item): item is string => typeof item === 'string')
          .map((item, footnoteIndex) => ({
            clientKey: createStableCourseStudioKey(`footnote-${specificationIndex}`, footnoteIndex),
            value: item,
          }))
      : [],
  }));
}

export function specificationsPayload(value: SpecificationDraft[]): JsonObject[] {
  return value.map((specification) =>
    mergeKnownFields(
      specification.original,
      {
        title: specification.title,
        subtitle: specification.subtitle || undefined,
        heroImage: specification.heroImage,
        specGroups: specification.groups.map((group) =>
          mergeKnownFields(
            group.original,
            {
              groupName: group.groupName,
              specs: group.rows.map((row) =>
                mergeKnownFields(
                  row.original,
                  {
                    label: row.label,
                    value: row.value,
                    highlight: row.highlight || undefined,
                  },
                  ['label', 'value', 'highlight'],
                ),
              ),
            },
            ['groupName', 'specs'],
          ),
        ),
        footnotes:
          specification.footnotes.length > 0
            ? specification.footnotes.map((item) => item.value)
            : undefined,
      },
      ['title', 'subtitle', 'heroImage', 'specGroups', 'footnotes'],
    ),
  );
}

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = [...items];
  const target = index + direction;
  const [item] = next.splice(index, 1);
  if (item !== undefined) next.splice(target, 0, item);
  return next;
}

export function SpecificationsField({
  courseId,
  disabled = false,
  errors = {},
  onChange,
  onUploadStateChange,
  value,
}: SpecificationsFieldProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  function updateSpecification(
    index: number,
    update: (item: SpecificationDraft) => SpecificationDraft,
  ) {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? update(item) : item)));
  }

  function removeSpecification(index: number) {
    const item = value[index];
    const persisted = item.original && Object.keys(item.original).length > 0;
    if (
      persisted &&
      !window.confirm(`Remove specification “${item.title || 'Untitled specification'}”?`)
    )
      return;
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <fieldset className="studio-glass-control border-border space-y-3 rounded-xl border p-3">
      <legend className="px-1 text-sm font-semibold">Specifications</legend>
      {value.length === 0 && (
        <p className="text-muted-foreground text-xs">No specifications have been added.</p>
      )}
      <div className="space-y-3">
        {value.map((specification, specificationIndex) => {
          const specificationErrorPrefix = `${specification.clientKey}.`;
          const hasNestedError = Object.entries(errors).some(
            ([key, error]) => key.startsWith(specificationErrorPrefix) && Boolean(error),
          );
          const open = hasNestedError || !collapsed.has(specification.clientKey);
          const titleError = errors[`${specification.clientKey}.title`];
          return (
            <section
              className="studio-glass-panel border-border rounded-xl border"
              key={specification.clientKey}
            >
              <div className="flex items-center gap-2 p-3">
                <button
                  aria-controls={`${specification.clientKey}-content`}
                  aria-expanded={open}
                  className="focus-visible:ring-ring min-h-11 min-w-0 flex-1 rounded-lg px-2 text-left text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(specification.clientKey)) next.delete(specification.clientKey);
                      else next.add(specification.clientKey);
                      return next;
                    })
                  }
                  type="button"
                >
                  {specification.title || 'Untitled specification'}
                </button>
                {hasNestedError && (
                  <span className="text-destructive text-xs font-medium">Needs attention</span>
                )}
                <button
                  aria-label={`Move specification ${specificationIndex + 1} up`}
                  className={actionClass}
                  disabled={disabled || specificationIndex === 0}
                  onClick={() => onChange(move(value, specificationIndex, -1))}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label={`Move specification ${specificationIndex + 1} down`}
                  className={actionClass}
                  disabled={disabled || specificationIndex === value.length - 1}
                  onClick={() => onChange(move(value, specificationIndex, 1))}
                  type="button"
                >
                  ↓
                </button>
                <button
                  aria-label={`Remove specification ${specificationIndex + 1}`}
                  className={actionClass}
                  disabled={disabled}
                  onClick={() => removeSpecification(specificationIndex)}
                  type="button"
                >
                  Remove
                </button>
              </div>
              {open && (
                <div
                  className="border-border space-y-4 border-t p-3"
                  id={`${specification.clientKey}-content`}
                >
                  <label
                    className="block text-xs font-medium"
                    htmlFor={`${specification.clientKey}-title`}
                  >
                    Title
                    <input
                      aria-describedby={
                        titleError ? `${specification.clientKey}-title-error` : undefined
                      }
                      aria-invalid={Boolean(titleError)}
                      className={inputClass}
                      disabled={disabled}
                      id={`${specification.clientKey}-title`}
                      onChange={(event) =>
                        updateSpecification(specificationIndex, (item) => ({
                          ...item,
                          title: event.target.value,
                        }))
                      }
                      value={specification.title}
                    />
                  </label>
                  {titleError && (
                    <p
                      className="text-destructive text-xs"
                      id={`${specification.clientKey}-title-error`}
                    >
                      {titleError}
                    </p>
                  )}
                  <label
                    className="block text-xs font-medium"
                    htmlFor={`${specification.clientKey}-subtitle`}
                  >
                    Subtitle
                    <input
                      className={inputClass}
                      disabled={disabled}
                      id={`${specification.clientKey}-subtitle`}
                      onChange={(event) =>
                        updateSpecification(specificationIndex, (item) => ({
                          ...item,
                          subtitle: event.target.value,
                        }))
                      }
                      value={specification.subtitle}
                    />
                  </label>
                  <CourseMediaField
                    courseId={courseId}
                    disabled={disabled}
                    id={`${specification.clientKey}-hero-image`}
                    label="Hero image"
                    onChange={(heroImage) =>
                      updateSpecification(specificationIndex, (item) => ({ ...item, heroImage }))
                    }
                    onUploadStateChange={onUploadStateChange}
                    value={specification.heroImage}
                  />
                  <GroupsEditor
                    disabled={disabled}
                    errors={errors}
                    groups={specification.groups}
                    onChange={(groups) =>
                      updateSpecification(specificationIndex, (item) => ({ ...item, groups }))
                    }
                    specificationKey={specification.clientKey}
                  />
                  <StringListField
                    addLabel="Add footnote"
                    disabled={disabled}
                    emptyMessage="No footnotes have been added."
                    errors={Object.fromEntries(
                      specification.footnotes.map((footnote) => [
                        footnote.clientKey,
                        errors[`${specification.clientKey}.${footnote.clientKey}`],
                      ]),
                    )}
                    itemLabel="Footnote"
                    items={specification.footnotes}
                    legend="Footnotes"
                    onChange={(footnotes) =>
                      updateSpecification(specificationIndex, (item) => ({ ...item, footnotes }))
                    }
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>
      <button
        className={actionClass}
        disabled={disabled}
        onClick={() => onChange([...value, createSpecification()])}
        type="button"
      >
        Add specification
      </button>
    </fieldset>
  );
}

function GroupsEditor({
  disabled,
  errors,
  groups,
  onChange,
  specificationKey,
}: {
  disabled: boolean;
  errors: Record<string, string | undefined>;
  groups: SpecificationGroupDraft[];
  onChange: (value: SpecificationGroupDraft[]) => void;
  specificationKey: string;
}) {
  function updateGroup(
    index: number,
    update: (group: SpecificationGroupDraft) => SpecificationGroupDraft,
  ) {
    onChange(groups.map((group, groupIndex) => (groupIndex === index ? update(group) : group)));
  }
  function removeGroup(index: number) {
    const group = groups[index];
    const populated = Boolean(
      group.groupName.trim() || group.rows.some((row) => row.label.trim() || row.value.trim()),
    );
    if (
      populated &&
      !window.confirm(`Remove specification group “${group.groupName || 'Untitled group'}”?`)
    )
      return;
    onChange(groups.filter((_, groupIndex) => groupIndex !== index));
  }
  return (
    <fieldset className="studio-glass-control border-border space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-xs font-semibold">Specification groups</legend>
      {groups.map((group, groupIndex) => (
        <section
          className="studio-glass-panel border-border space-y-3 rounded-lg border p-3"
          key={group.clientKey}
        >
          {(() => {
            const groupError = errors[`${specificationKey}.${group.clientKey}.groupName`];
            const groupErrorId = `${specificationKey}-${group.clientKey}-name-error`;
            return (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  <label
                    className="min-w-48 flex-1 text-xs font-medium"
                    htmlFor={`${specificationKey}-${group.clientKey}-name`}
                  >
                    Group name
                    <input
                      aria-describedby={groupError ? groupErrorId : undefined}
                      aria-invalid={Boolean(groupError)}
                      className={inputClass}
                      disabled={disabled}
                      id={`${specificationKey}-${group.clientKey}-name`}
                      onChange={(event) =>
                        updateGroup(groupIndex, (item) => ({
                          ...item,
                          groupName: event.target.value,
                        }))
                      }
                      value={group.groupName}
                    />
                  </label>
                  <button
                    aria-label={`Move group ${groupIndex + 1} up`}
                    className={actionClass}
                    disabled={disabled || groupIndex === 0}
                    onClick={() => onChange(move(groups, groupIndex, -1))}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move group ${groupIndex + 1} down`}
                    className={actionClass}
                    disabled={disabled || groupIndex === groups.length - 1}
                    onClick={() => onChange(move(groups, groupIndex, 1))}
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    aria-label={`Remove group ${groupIndex + 1}`}
                    className={actionClass}
                    disabled={disabled}
                    onClick={() => removeGroup(groupIndex)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
                {groupError && (
                  <p className="text-destructive text-xs" id={groupErrorId}>
                    {groupError}
                  </p>
                )}
                <RowsEditor
                  disabled={disabled}
                  errors={errors}
                  group={group}
                  onChange={(nextGroup) => updateGroup(groupIndex, () => nextGroup)}
                  specificationKey={specificationKey}
                />
              </>
            );
          })()}
        </section>
      ))}
      <button
        className={actionClass}
        disabled={disabled}
        onClick={() => onChange([...groups, createGroup()])}
        type="button"
      >
        Add group
      </button>
    </fieldset>
  );
}

function RowsEditor({
  disabled,
  errors,
  group,
  onChange,
  specificationKey,
}: {
  disabled: boolean;
  errors: Record<string, string | undefined>;
  group: SpecificationGroupDraft;
  onChange: (group: SpecificationGroupDraft) => void;
  specificationKey: string;
}) {
  return (
    <fieldset className="studio-glass-control space-y-3 rounded-lg p-3">
      <legend className="px-1 text-xs font-semibold">Rows</legend>
      {group.rows.map((row, rowIndex) => (
        <div
          className="studio-glass-panel border-border grid gap-2 rounded-lg border p-3"
          key={row.clientKey}
        >
          {(() => {
            const labelError =
              errors[`${specificationKey}.${group.clientKey}.${row.clientKey}.label`];
            const valueError =
              errors[`${specificationKey}.${group.clientKey}.${row.clientKey}.value`];
            const labelId = `${specificationKey}-${group.clientKey}-${row.clientKey}-label`;
            const valueId = `${specificationKey}-${group.clientKey}-${row.clientKey}-value`;
            return (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs font-medium" htmlFor={labelId}>
                    Label
                    <input
                      aria-describedby={labelError ? `${labelId}-error` : undefined}
                      aria-invalid={Boolean(labelError)}
                      className={inputClass}
                      disabled={disabled}
                      id={labelId}
                      onChange={(event) =>
                        onChange({
                          ...group,
                          rows: group.rows.map((item) =>
                            item.clientKey === row.clientKey
                              ? { ...item, label: event.target.value }
                              : item,
                          ),
                        })
                      }
                      value={row.label}
                    />
                    {labelError && (
                      <p className="text-destructive mt-1 text-xs" id={`${labelId}-error`}>
                        {labelError}
                      </p>
                    )}
                  </label>
                  <label className="text-xs font-medium" htmlFor={valueId}>
                    Value
                    <input
                      aria-describedby={valueError ? `${valueId}-error` : undefined}
                      aria-invalid={Boolean(valueError)}
                      className={inputClass}
                      disabled={disabled}
                      id={valueId}
                      onChange={(event) =>
                        onChange({
                          ...group,
                          rows: group.rows.map((item) =>
                            item.clientKey === row.clientKey
                              ? { ...item, value: event.target.value }
                              : item,
                          ),
                        })
                      }
                      value={row.value}
                    />
                    {valueError && (
                      <p className="text-destructive mt-1 text-xs" id={`${valueId}-error`}>
                        {valueError}
                      </p>
                    )}
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex min-h-11 items-center gap-2 text-xs font-medium">
                    <input
                      checked={row.highlight}
                      disabled={disabled}
                      onChange={(event) =>
                        onChange({
                          ...group,
                          rows: group.rows.map((item) =>
                            item.clientKey === row.clientKey
                              ? { ...item, highlight: event.target.checked }
                              : item,
                          ),
                        })
                      }
                      type="checkbox"
                    />
                    Highlight
                  </label>
                  <button
                    aria-label={`Move row ${rowIndex + 1} up`}
                    className={actionClass}
                    disabled={disabled || rowIndex === 0}
                    onClick={() => onChange({ ...group, rows: move(group.rows, rowIndex, -1) })}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move row ${rowIndex + 1} down`}
                    className={actionClass}
                    disabled={disabled || rowIndex === group.rows.length - 1}
                    onClick={() => onChange({ ...group, rows: move(group.rows, rowIndex, 1) })}
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    aria-label={`Remove row ${rowIndex + 1}`}
                    className={actionClass}
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...group,
                        rows: group.rows.filter((item) => item.clientKey !== row.clientKey),
                      })
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      ))}
      <button
        className={actionClass}
        disabled={disabled}
        onClick={() => onChange({ ...group, rows: [...group.rows, createRow()] })}
        type="button"
      >
        Add row
      </button>
    </fieldset>
  );
}
