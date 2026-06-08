import { useCallback, useEffect, useState } from "react";
import { set, useClient } from "sanity";
import type { ArrayOfObjectsInputProps } from "sanity";

interface LessonRef {
  _key: string;
  _ref: string;
  _type: "reference";
}

export function OrderableLessonsInput(props: ArrayOfObjectsInputProps) {
  const { value = [], onChange, renderDefault } = props;
  const client = useClient({ apiVersion: "2024-01-01" });
  const [titles, setTitles] = useState<Record<string, string>>({});

  const refs = (value as unknown as LessonRef[]).map((v) => v._ref).filter(Boolean);
  const refKey = refs.join(",");

  useEffect(() => {
    if (!refs.length) return;
    const draftIds = refs.map((id) => `drafts.${id}`);
    client
      .fetch<{ _id: string; headline: string }[]>(
        `*[_id in $ids || _id in $draftIds]{_id,headline}`,
        { ids: refs, draftIds }
      )
      .then((docs) => {
        const map: Record<string, string> = {};
        for (const doc of docs) {
          map[doc._id.replace(/^drafts\./, "")] = doc.headline;
        }
        setTitles(map);
      });
  // refKey is a stable string derived from refs array — avoids deep-compare on the array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKey, client]);

  const moveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const next = [...(value as unknown as LessonRef[])];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      onChange(set(next));
    },
    [value, onChange]
  );

  const moveDown = useCallback(
    (index: number) => {
      if (index >= value.length - 1) return;
      const next = [...(value as unknown as LessonRef[])];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      onChange(set(next));
    },
    [value, onChange]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {value.length > 1 && (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: 0.45,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Lesson Order
          </div>
          {(value as unknown as LessonRef[]).map((item, index) => (
            <div
              key={item._key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 12px",
                borderBottom:
                  index < value.length - 1
                    ? "1px solid rgba(255,255,255,0.05)"
                    : "none",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.35,
                  minWidth: 18,
                  textAlign: "right",
                }}
              >
                {index + 1}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  opacity: 0.85,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {titles[item._ref] ?? "…"}
              </span>
              <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  title="Move up"
                  style={{
                    cursor: index === 0 ? "default" : "pointer",
                    opacity: index === 0 ? 0.25 : 0.7,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 4,
                    color: "inherit",
                    fontSize: 13,
                    lineHeight: 1,
                    padding: "3px 7px",
                    fontFamily: "inherit",
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(index)}
                  disabled={index >= value.length - 1}
                  title="Move down"
                  style={{
                    cursor: index >= value.length - 1 ? "default" : "pointer",
                    opacity: index >= value.length - 1 ? 0.25 : 0.7,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 4,
                    color: "inherit",
                    fontSize: 13,
                    lineHeight: 1,
                    padding: "3px 7px",
                    fontFamily: "inherit",
                  }}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {renderDefault(props)}
    </div>
  );
}
