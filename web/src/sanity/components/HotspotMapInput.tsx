"use client";
import React, { useEffect, useRef, useState } from "react";
import { set, useFormValue, useClient } from "sanity";
import type { ArrayOfObjectsInputProps, Path } from "sanity";

interface HotspotItem {
  _type: string;
  _key: string;
  label?: string;
  topic?: string;
  photos?: unknown[];
  x?: number;
  y?: number;
}

interface SanityImage {
  asset?: { _ref?: string };
}

// Convert a Sanity image asset reference to a CDN URL
function assetRefToUrl(ref: string, projectId: string, dataset: string): string {
  // Format: "image-{assetId}-{width}x{height}-{ext}"
  const withoutPrefix = ref.replace(/^image-/, "");
  const lastDash = withoutPrefix.lastIndexOf("-");
  const ext  = withoutPrefix.slice(lastDash + 1);
  const base = withoutPrefix.slice(0, lastDash);
  return `https://cdn.sanity.io/images/${projectId}/${dataset}/${base}.${ext}?auto=format&w=800`;
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Visual map sub-component ────────────────────────────────────────────────

interface HotspotMapProps {
  hotspots: HotspotItem[];
  imageUrl: string | null;
  itemTypeName: string;
  onChange: (newHotspots: HotspotItem[]) => void;
}

function HotspotMap({ hotspots, imageUrl, itemTypeName, onChange }: HotspotMapProps) {
  const [selected,  setSelected]  = useState<number | null>(null);
  const [dragging,  setDragging]  = useState<number | null>(null);
  const [dragPos,   setDragPos]   = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOrigin   = useRef<{ mouseX: number; mouseY: number; x: number; y: number } | null>(null);
  const didDrag      = useRef(false);

  // Deselect on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelected(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pos(i: number) {
    return dragging === i && dragPos
      ? dragPos
      : { x: hotspots[i].x ?? 50, y: hotspots[i].y ?? 50 };
  }

  function handleContainerClick(e: React.MouseEvent) {
    if (didDrag.current) { didDrag.current = false; return; }
    if (!imageUrl) return;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, Math.round(((e.clientX - rect.left)  / rect.width)  * 1000) / 10));
    const y = Math.max(2, Math.min(98, Math.round(((e.clientY - rect.top)   / rect.height) * 1000) / 10));

    const newItem: HotspotItem = {
      _type: itemTypeName,
      _key:  shortId(),
      label: `Feature ${hotspots.length + 1}`,
      topic: "",
      photos: [],
      x,
      y,
    };
    onChange([...hotspots, newItem]);
    setSelected(hotspots.length);
  }

  function handleMarkerMouseDown(e: React.MouseEvent, i: number) {
    e.preventDefault();
    e.stopPropagation();
    didDrag.current = false;
    const initialX = hotspots[i].x ?? 50;
    const initialY = hotspots[i].y ?? 50;
    setDragging(i);
    setSelected(i);
    setDragPos({ x: initialX, y: initialY });
    dragOrigin.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      x: initialX,
      y: initialY,
    };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (dragging === null || !containerRef.current || !dragOrigin.current) return;
    didDrag.current = true;
    const rect = containerRef.current.getBoundingClientRect();
    const newX = Math.max(2, Math.min(98, Math.round((dragOrigin.current.x + ((e.clientX - dragOrigin.current.mouseX) / rect.width)  * 100) * 10) / 10));
    const newY = Math.max(2, Math.min(98, Math.round((dragOrigin.current.y + ((e.clientY - dragOrigin.current.mouseY) / rect.height) * 100) * 10) / 10));
    setDragPos({ x: newX, y: newY });
  }

  function handleMouseUp() {
    if (dragging !== null && didDrag.current && dragPos) {
      onChange(hotspots.map((h, i) => i === dragging ? { ...h, x: dragPos.x, y: dragPos.y } : h));
    }
    setDragging(null);
    setDragPos(null);
    dragOrigin.current = null;
  }

  function handleDelete(i: number, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(hotspots.filter((_, idx) => idx !== i));
    setSelected(null);
  }

  function handleMarkerClick(e: React.MouseEvent, i: number) {
    e.stopPropagation();
    if (!didDrag.current) setSelected((s) => (s === i ? null : i));
  }

  return (
    <div>
      {/* ── Image canvas ── */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          position: "relative",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.12)",
          cursor: dragging !== null ? "grabbing" : imageUrl ? "crosshair" : "default",
          background: "#111",
          userSelect: "none",
          minHeight: 140,
        }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Product"
            draggable={false}
            style={{ display: "block", width: "100%", pointerEvents: "none" }}
          />
        ) : (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", lineHeight: 1.5, margin: 0 }}>
              Upload a <strong style={{ color: "rgba(255,255,255,0.5)" }}>Media / Product Image</strong> above,<br />
              then click here to place hotspots.
            </p>
          </div>
        )}

        {/* ── Hotspot pins ── */}
        {hotspots.map((h, i) => {
          const p   = pos(i);
          const sel = selected === i;
          const drg = dragging === i;
          return (
            <div
              key={h._key}
              onMouseDown={(e) => handleMarkerMouseDown(e, i)}
              onClick={(e) => handleMarkerClick(e, i)}
              style={{
                position: "absolute",
                left: `${p.x}%`,
                top:  `${p.y}%`,
                transform: "translate(-50%, -50%)",
                zIndex: drg ? 100 : sel ? 50 : 10,
                cursor: drg ? "grabbing" : "grab",
              }}
            >
              {/* Ring when selected */}
              {sel && (
                <div style={{
                  position: "absolute",
                  inset: -6,
                  borderRadius: "50%",
                  border: "2px solid rgba(56,189,248,0.55)",
                  pointerEvents: "none",
                }} />
              )}

              {/* Pin circle */}
              <div style={{
                width: sel ? 30 : 22,
                height: sel ? 30 : 22,
                borderRadius: "50%",
                background: sel ? "#38bdf8" : "#0ea5e9",
                border: `2px solid ${sel ? "#fff" : "rgba(255,255,255,0.75)"}`,
                boxShadow: sel
                  ? "0 0 0 4px rgba(56,189,248,0.3), 0 4px 12px rgba(0,0,0,0.6)"
                  : "0 2px 8px rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 800,
                color: "#fff",
                transition: "width 0.15s, height 0.15s, background 0.15s, box-shadow 0.15s",
              }}>
                {i + 1}
              </div>

              {/* Label tooltip */}
              <div style={{
                position: "absolute",
                left: "50%",
                bottom: "calc(100% + 8px)",
                transform: "translateX(-50%)",
                background: "rgba(0,0,0,0.88)",
                backdropFilter: "blur(6px)",
                color: "#fff",
                padding: "3px 10px",
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: "nowrap",
                pointerEvents: "none",
                opacity: sel ? 1 : 0,
                transition: "opacity 0.15s",
                boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              }}>
                {h.label || "Unlabeled"}
                {/* Caret */}
                <div style={{
                  position: "absolute",
                  left: "50%",
                  top: "100%",
                  transform: "translateX(-50%)",
                  width: 0,
                  height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: "5px solid rgba(0,0,0,0.88)",
                }} />
              </div>

              {/* Delete badge */}
              {sel && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => handleDelete(i, e)}
                  title="Remove hotspot"
                  style={{
                    position: "absolute",
                    top: -9,
                    right: -9,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#ef4444",
                    border: "1.5px solid #fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#fff",
                    fontWeight: 700,
                    lineHeight: 1,
                    zIndex: 200,
                  }}
                >
                  ×
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Instructions + selected info ── */}
      <div style={{ marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", display: "flex", gap: 12 }}>
          <span>+ Click to add</span>
          <span>⬤ Drag to move</span>
          <span>✕ Select &gt; × to delete</span>
        </span>
        {selected !== null && hotspots[selected] && (
          <span style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "rgba(56,189,248,0.8)",
            fontVariantNumeric: "tabular-nums",
          }}>
            x: {pos(selected).x.toFixed(1)}%&nbsp;&nbsp;y: {pos(selected).y.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main custom input ───────────────────────────────────────────────────────

export function HotspotMapInput(props: ArrayOfObjectsInputProps) {
  const { value, onChange, path, renderDefault, schemaType } = props;
  const hotspots = (value ?? []) as HotspotItem[];
  // Derive the item _type from the schema so this component works for both
  // hotspots (type: "hotspot") and floatingGraphics (type: "graphic").
  const itemTypeName = (schemaType as { of?: Array<{ name?: string }> }).of?.[0]?.name ?? "hotspot";

  const client = useClient({ apiVersion: "2024-01-01" });
  const { projectId = "", dataset = "" } = client.config();

  // Resolve media field from the parent lesson object
  const parentPath = (path as Path).slice(0, -1);
  const media = useFormValue([...parentPath, "media"]) as SanityImage | undefined;
  const imageUrl = media?.asset?._ref
    ? assetRefToUrl(media.asset._ref, projectId, dataset)
    : null;

  function handleChange(newHotspots: HotspotItem[]) {
    onChange(set(newHotspots));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Visual placement map */}
      <HotspotMap
        hotspots={hotspots}
        imageUrl={imageUrl}
        itemTypeName={itemTypeName}
        onChange={handleChange}
      />

      {/* Standard Sanity array editor for field values (label, topic, body, photos) */}
      {renderDefault(props)}
    </div>
  );
}
