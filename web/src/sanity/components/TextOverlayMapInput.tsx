import { useEffect, useRef, useState, useCallback } from "react";
import { set, setIfMissing, useFormValue, useClient, ObjectInputProps, Path } from "sanity";

interface SanityImage {
  asset?: { _ref?: string };
}

function assetRefToUrl(ref: string, projectId: string, dataset: string): string {
  const withoutPrefix = ref.replace(/^image-/, "");
  const lastDash = withoutPrefix.lastIndexOf("-");
  const ext  = withoutPrefix.slice(lastDash + 1);
  const base = withoutPrefix.slice(0, lastDash);
  return `https://cdn.sanity.io/images/${projectId}/${dataset}/${base}.${ext}`;
}

export function TextOverlayMapInput(props: ObjectInputProps) {
  const { value, onChange, path, renderDefault } = props;
  const overlayConfig = (value || {}) as { x?: number; y?: number };
  const x = overlayConfig.x ?? 6;
  const y = overlayConfig.y ?? 15;

  const client = useClient({ apiVersion: "2024-01-01" });
  const { projectId = "", dataset = "" } = client.config();

  const parentPath = (path as Path).slice(0, -1);
  const media = useFormValue([...parentPath, "media"]) as SanityImage | undefined;
  const photos = useFormValue([...parentPath, "photos"]) as SanityImage[] | undefined;
  
  const mediaUrl = media?.asset?._ref ? assetRefToUrl(media.asset._ref, projectId, dataset) : null;
  const photoUrl = photos?.[0]?.asset?._ref ? assetRefToUrl(photos[0].asset._ref, projectId, dataset) : null;
  const imageUrl = mediaUrl || photoUrl;

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  
  const updatePosition = useCallback((newX: number, newY: number) => {
    onChange([
      setIfMissing({ _type: "object" }),
      set(newX, ["x"]),
      set(newY, ["y"]),
    ]);
  }, [onChange]);

  function handleContainerMouseDown(e: React.MouseEvent) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const ny = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    updatePosition(Number(nx.toFixed(1)), Number(ny.toFixed(1)));
    setDragging(true);
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const nx = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const ny = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      updatePosition(Number(nx.toFixed(1)), Number(ny.toFixed(1)));
    }
    function onMouseUp() {
      setDragging(false);
    }
    if (dragging) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, updatePosition]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {imageUrl ? (
        <div
          ref={containerRef}
          onMouseDown={handleContainerMouseDown}
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16/9",
            backgroundColor: "#111",
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            borderRadius: 8,
            overflow: "hidden",
            cursor: dragging ? "grabbing" : "crosshair",
            userSelect: "none",
          }}
        >
          {/* Mock Text Card */}
          <div
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: "30%", // approx proportional preview
              minHeight: "20%",
              backgroundColor: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 6,
              pointerEvents: "none",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "flex-start",
              padding: "12px",
              boxSizing: "border-box",
              color: "white",
              fontSize: 11,
              fontWeight: "600",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ opacity: 0.9 }}>
              Text Content Preview
              <div style={{ height: 4, width: "60%", backgroundColor: "rgba(255,255,255,0.2)", marginTop: 8, borderRadius: 2 }} />
              <div style={{ height: 4, width: "80%", backgroundColor: "rgba(255,255,255,0.2)", marginTop: 4, borderRadius: 2 }} />
              <div style={{ height: 4, width: "40%", backgroundColor: "rgba(255,255,255,0.2)", marginTop: 4, borderRadius: 2 }} />
            </div>
          </div>
          
          <div style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            backgroundColor: "rgba(0,0,0,0.7)",
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 11,
            color: "rgba(255,255,255,0.6)",
            pointerEvents: "none",
          }}>
            Click or drag to position
          </div>
        </div>
      ) : (
        <div style={{ padding: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 8, fontSize: 13, color: "#888" }}>
          Upload a media image to preview and position the text overlay visually.
        </div>
      )}

      {/* Standard fields (x, y, width) */}
      {renderDefault(props)}
    </div>
  );
}
