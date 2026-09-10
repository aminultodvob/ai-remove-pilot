import { ImageResponse } from "next/og";

import { SITE } from "@/lib/config";

/**
 * The link preview card, generated at build time.
 *
 * Deliberately typographic: no stock imagery, no invented statistics, and the
 * same claim the page itself makes. Uses system fonts so the build needs no
 * network access to produce it.
 */

export const alt = `${SITE.name} — clean image metadata privately`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0d1017",
        color: "#f5f7fa",
        padding: "72px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "#3b82f6",
            display: "flex",
          }}
        />
        <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>{SITE.name}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 78, fontWeight: 700, letterSpacing: -2.5, lineHeight: 1.05 }}>
          Clean Your Images.
        </div>
        <div
          style={{
            fontSize: 78,
            fontWeight: 700,
            letterSpacing: -2.5,
            lineHeight: 1.05,
            color: "#7aa5f7",
          }}
        >
          Keep Your Privacy.
        </div>
        <div style={{ marginTop: 28, fontSize: 30, color: "#9aa4b2", maxWidth: 900 }}>
          Remove embedded image metadata in seconds. Your files aren&apos;t kept after processing.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          fontSize: 22,
          color: "#9aa4b2",
          borderTop: "1px solid #232936",
          paddingTop: 28,
        }}
      >
        <span>JPG · PNG · WebP</span>
        <span style={{ color: "#3a424f" }}>|</span>
        <span>No account</span>
        <span style={{ color: "#3a424f" }}>|</span>
        <span>Nothing stored</span>
      </div>
    </div>,
    size,
  );
}
