import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface DonutChartProps {
  data: { name: string; value: number; color: string }[];
  size?: number;
  variant?: "flat" | "3d";
}

export const DonutChart = ({
  data,
  size = 180,
  variant = "flat",
}: DonutChartProps) => {
  if (variant === "3d") {
    return <Donut3D data={data} size={size} />;
  }

  return (
    <div style={{ width: size, height: size }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={size * 0.32}
            outerRadius={size * 0.45}
            paddingAngle={2}
            stroke="none"
            startAngle={90}
            endAngle={-270}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "hsl(150 14% 8%)",
              border: "1px solid hsl(150 14% 18%)",
              borderRadius: "0.5rem",
              fontSize: "11px",
              fontFamily: "JetBrains Mono, monospace",
              color: "hsl(150 14% 96%)",
            }}
            formatter={(v: number, n: string) => [`${v}%`, n]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   3D EXTRUDED COIN — Pure CSS + SVG, no recharts for layers
   ─ 16 conic-gradient layers for the extruded side wall
   ─ SVG donut top face with per-segment hover
   ─ Dynamic lighting (top highlight + bottom shadow)
   ─ Floating animation
   ─ Ground shadow
   ═══════════════════════════════════════════════════════════════ */

const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const describeDonutSegment = (
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
) => {
  const startOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, endAngle);
  const startInner = polarToCartesian(cx, cy, innerR, endAngle);
  const endInner = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    "Z",
  ].join(" ");
};

const Donut3D = ({
  data,
  size = 260,
}: {
  data: { name: string; value: number; color: string }[];
  size?: number;
}) => {
  const [hovered, setHovered] = useState<number | null>(null);

  const tilt = 56;
  const depth = 24;
  const layers = 16;
  const innerR = size * 0.34;
  const outerR = size * 0.48;
  const cx = size / 2;
  const cy = size / 2;
  const gap = 1.5;

  // Build segments with cumulative angles
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let cumulative = 0;
  const segments = data.map((d) => {
    const startAngle = (cumulative / total) * 360;
    cumulative += d.value;
    const endAngle = (cumulative / total) * 360;
    return { ...d, startAngle, endAngle };
  });

  // Conic gradient for side walls (no gaps — top face has gaps)
  const conicGradient = `conic-gradient(from 0deg, ${segments
    .map((s) => `${s.color} ${s.startAngle}deg ${s.endAngle}deg`)
    .join(", ")})`;

  // Ring mask — creates donut hole
  const ringMask = `radial-gradient(circle at 50% 50%, transparent ${innerR}px, black ${innerR + 0.5}px)`;

  const hoveredSeg = hovered !== null ? segments[hovered] : null;

  return (
    <div
      style={{
        width: size,
        height: size + 56,
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      {/* ── Ground shadow ── */}
      <div
        style={{
          position: "absolute",
          bottom: 18,
          left: "50%",
          transform: "translateX(-50%)",
          width: size * 0.78,
          height: size * 0.13,
          background:
            "radial-gradient(ellipse, hsl(150 14% 2% / 0.5), transparent 70%)",
          borderRadius: "50%",
          filter: "blur(14px)",
          zIndex: 0,
        }}
      />

      {/* ── Floating wrapper ── */}
      <div style={{ animation: "coinFloat 6s ease-in-out infinite" }}>
        {/* ── 3D Coin ── */}
        <div
          style={{
            position: "relative",
            width: size,
            height: size,
            transformStyle: "preserve-3d",
            transform: `perspective(1200px) rotateX(${tilt}deg)`,
          }}
        >
          {/* Extruded side layers — conic gradient rings */}
          {Array.from({ length: layers }).map((_, i) => {
            const t = i / layers;
            const brightness = 1 - t * 0.6;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: conicGradient,
                  maskImage: ringMask,
                  WebkitMaskImage: ringMask,
                  transform: `translateZ(${-(i + 1) * (depth / layers)}px)`,
                  filter: `brightness(${brightness}) saturate(${brightness * 0.85})`,
                }}
              />
            );
          })}

          {/* Bottom edge shadow ring */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, transparent 47%, hsl(150 14% 2% / 0.4) 48%)",
              maskImage: ringMask,
              WebkitMaskImage: ringMask,
              transform: `translateZ(-${depth + 1}px)`,
              zIndex: 0,
            }}
          />

          {/* Top face — SVG donut with interactive segments */}
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: layers + 1,
              transform: "translateZ(0.5px)",
              overflow: "visible",
            }}
          >
            <defs>
              <radialGradient id="donut-highlight" cx="50%" cy="30%" r="50%">
                <stop
                  offset="0%"
                  stopColor="hsl(0 0% 100%)"
                  stopOpacity="0.15"
                />
                <stop offset="60%" stopColor="hsl(0 0% 100%)" stopOpacity="0" />
              </radialGradient>
              <filter
                id="seg-glow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {segments.map((seg, i) => {
              const path = describeDonutSegment(
                cx,
                cy,
                innerR,
                outerR,
                seg.startAngle + gap / 2,
                seg.endAngle - gap / 2,
              );
              const isHovered = hovered === i;
              const isDimmed = hovered !== null && !isHovered;
              return (
                <path
                  key={seg.name}
                  d={path}
                  fill={seg.color}
                  style={{
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    transformOrigin: `${cx}px ${cy}px`,
                    transform: isHovered ? "scale(1.04)" : "scale(1)",
                    filter: isHovered ? "url(#seg-glow)" : "none",
                    opacity: isDimmed ? 0.4 : 1,
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}

            {/* Inner ring shadow */}
            <circle
              cx={cx}
              cy={cy}
              r={innerR}
              fill="none"
              stroke="hsl(150 14% 3%)"
              strokeWidth="3"
              opacity="0.6"
            />
            {/* Outer ring highlight */}
            <circle
              cx={cx}
              cy={cy}
              r={outerR}
              fill="none"
              stroke="hsl(0 0% 100%)"
              strokeWidth="0.5"
              opacity="0.15"
            />

            {/* Top lighting overlay */}
            <circle
              cx={cx}
              cy={cy}
              r={outerR}
              fill="url(#donut-highlight)"
              style={{ pointerEvents: "none" }}
            />
          </svg>

          {/* Glassy top reflection */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse 55% 25% at 50% 22%, hsl(0 0% 100% / 0.10), transparent 70%)",
              maskImage: ringMask,
              WebkitMaskImage: ringMask,
              zIndex: layers + 2,
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      {/* ── Center label ── */}
      <div
        style={{
          position: "absolute",
          top: size / 2 - 10,
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 100,
          pointerEvents: "none",
          textAlign: "center",
          transition: "all 0.3s ease",
        }}
      >
        {hoveredSeg ? (
          <>
            <p
              style={{
                fontFamily: "Sora, sans-serif",
                fontSize: "20px",
                fontWeight: 700,
                color: hoveredSeg.color,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                textShadow: `0 0 12px ${hoveredSeg.color}40`,
              }}
            >
              {hoveredSeg.value}%
            </p>
            <p
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "8px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "hsl(150 12% 56%)",
                marginTop: "3px",
                maxWidth: "120px",
              }}
            >
              {hoveredSeg.name.length > 22
                ? hoveredSeg.name.slice(0, 20) + "…"
                : hoveredSeg.name}
            </p>
          </>
        ) : (
          <>
            <p
              style={{
                fontFamily: "Sora, sans-serif",
                fontSize: "30px",
                fontWeight: 700,
                color: "hsl(150 14% 96%)",
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              1B
            </p>
            <p
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "9px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "hsl(150 12% 50%)",
                marginTop: "3px",
              }}
            >
              RSTN
            </p>
          </>
        )}
      </div>

      {/* ── Legend ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "14px",
          zIndex: 40,
          maxWidth: size * 1.1,
        }}
      >
        {segments.map((s, i) => (
          <div
            key={s.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              cursor: "pointer",
              opacity: hovered !== null && hovered !== i ? 0.4 : 1,
              transition: "opacity 0.3s ease",
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: s.color,
                boxShadow: `0 0 8px ${s.color}80`,
              }}
            />
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "9px",
                color: "hsl(150 12% 56%)",
              }}
            >
              {s.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
