import { useRef, useState, useEffect } from "react";
import { useAnimationFrame } from "framer-motion";
import { useTranslation } from "react-i18next";

/**
 * Photorealistic 3D Globe — Orthographic Projection
 *
 * Real rotating sphere with orthographic projection. All elements
 * rotate in sync. Improved: animated arc pulses, pulsing nodes,
 * richer continent fills, cleaner atmosphere — no external shadows.
 */

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
};

// ─── Validator nodes (lat/lng of real cities) ───
const VALIDATORS = [
  { lat: 40, lng: -74, region: "Nueva York", color: "#00E673" },
  { lat: 37, lng: -122, region: "San Francisco", color: "#00E673" },
  { lat: 51, lng: 0, region: "Londres", color: "#00C8FF" },
  { lat: 52, lng: 13, region: "Berlín", color: "#00C8FF" },
  { lat: 59, lng: 18, region: "Estocolmo", color: "#00C8FF" },
  { lat: -23, lng: -46, region: "São Paulo", color: "#12A55C" },
  { lat: 1, lng: 103, region: "Singapur", color: "#00E673" },
  { lat: 35, lng: 139, region: "Tokio", color: "#00E673" },
  { lat: 28, lng: 77, region: "Delhi", color: "#00E673" },
  { lat: -33, lng: 151, region: "Sídney", color: "#00C8FF" },
  { lat: 26, lng: 50, region: "Dubái", color: "#12A55C" },
  { lat: -1, lng: 36, region: "Nairobi", color: "#12A55C" },
];

// ─── Block propagation arcs (gossip protocol) ───
const ARCS = [
  { from: 0, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 6 },
  { from: 6, to: 7 },
  { from: 7, to: 9 },
  { from: 0, to: 1 },
  { from: 5, to: 10 },
  { from: 10, to: 8 },
  { from: 4, to: 11 },
  { from: 1, to: 5 },
];

// ─── Simplified continent outlines (lat/lng polygons) ───
const CONTINENTS: number[][][] = [
  // North America
  [
    [72, -168],
    [68, -141],
    [60, -141],
    [49, -125],
    [32, -117],
    [23, -110],
    [18, -92],
    [25, -80],
    [30, -81],
    [44, -67],
    [47, -53],
    [60, -65],
    [72, -78],
    [72, -168],
  ],
  // South America
  [
    [12, -72],
    [10, -62],
    [5, -52],
    [-2, -44],
    [-8, -35],
    [-23, -42],
    [-34, -58],
    [-52, -69],
    [-50, -75],
    [-35, -73],
    [-18, -71],
    [-2, -79],
    [5, -78],
    [12, -72],
  ],
  // Europe
  [
    [71, 28],
    [68, 40],
    [60, 30],
    [50, 40],
    [45, 38],
    [40, 28],
    [37, 15],
    [40, 5],
    [43, -2],
    [44, -9],
    [52, -5],
    [58, -4],
    [62, 5],
    [68, 13],
    [71, 28],
  ],
  // Africa
  [
    [37, -6],
    [33, 11],
    [31, 25],
    [22, 37],
    [12, 43],
    [11, 51],
    [-5, 40],
    [-15, 40],
    [-25, 35],
    [-34, 20],
    [-34, 18],
    [-30, 17],
    [-18, 12],
    [-5, 9],
    [5, -3],
    [15, -17],
    [28, -16],
    [37, -6],
  ],
  // Asia
  [
    [77, 70],
    [78, 100],
    [73, 130],
    [65, 140],
    [55, 140],
    [45, 140],
    [40, 130],
    [35, 120],
    [25, 115],
    [20, 110],
    [10, 100],
    [8, 98],
    [15, 80],
    [25, 68],
    [30, 55],
    [40, 48],
    [50, 50],
    [60, 55],
    [70, 60],
    [77, 70],
  ],
  // Australia
  [
    [-12, 130],
    [-15, 145],
    [-20, 150],
    [-35, 150],
    [-38, 142],
    [-35, 135],
    [-32, 115],
    [-22, 113],
    [-15, 125],
    [-12, 130],
  ],
  // Antarctica (simplified band)
  [
    [-70, -180],
    [-70, -120],
    [-72, -60],
    [-70, 0],
    [-72, 60],
    [-70, 120],
    [-72, 180],
    [-70, 180],
  ],
];

// ─── Orthographic projection ───
const project = (
  lat: number,
  lng: number,
  rotLng: number,
  rotLat: number,
  R: number,
) => {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = ((lng + rotLng) * Math.PI) / 180;
  const rotLatRad = (rotLat * Math.PI) / 180;

  const x = Math.cos(latRad) * Math.sin(lngRad);
  const y =
    Math.cos(rotLatRad) * Math.sin(latRad) -
    Math.sin(rotLatRad) * Math.cos(latRad) * Math.cos(lngRad);
  const z =
    Math.sin(rotLatRad) * Math.sin(latRad) +
    Math.cos(rotLatRad) * Math.cos(latRad) * Math.cos(lngRad);

  return {
    x: x * R,
    y: -y * R,
    z: z * R,
  };
};

// Interpolate along a great circle between two points
const slerp = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  t: number,
) => {
  const toVec = (lat: number, lng: number) => {
    const la = (lat * Math.PI) / 180;
    const lo = (lng * Math.PI) / 180;
    return [
      Math.cos(la) * Math.cos(lo),
      Math.cos(la) * Math.sin(lo),
      Math.sin(la),
    ];
  };
  const v1 = toVec(lat1, lng1);
  const v2 = toVec(lat2, lng2);
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const omega = Math.acos(Math.max(-1, Math.min(1, dot)));
  if (omega < 0.0001) return { lat: lat1, lng: lng1 };
  const sinO = Math.sin(omega);
  const a = Math.sin((1 - t) * omega) / sinO;
  const b = Math.sin(t * omega) / sinO;
  const x = a * v1[0] + b * v2[0];
  const y = a * v1[1] + b * v2[1];
  const z = a * v1[2] + b * v2[2];
  const lat = (Math.asin(z) * 180) / Math.PI;
  const lng = (Math.atan2(y, x) * 180) / Math.PI;
  return { lat, lng };
};

export const Globe3D = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const R = isMobile ? 110 : 145;
  const rotRef = useRef(0);
  const timeRef = useRef(0);
  const visibleRef = useRef(true);
  const lastRenderRef = useRef(0);
  const [, force] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pause animation when off-screen — saves CPU on a 100+ element SVG re-render
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.05 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const tiltLat = -15;

  useAnimationFrame((_t, delta) => {
    if (!visibleRef.current) return;
    rotRef.current += delta * 0.006;
    timeRef.current += delta;
    // Throttle React re-renders to ~30fps (SVG reconciliation is expensive)
    if (_t - lastRenderRef.current < 33) return;
    lastRenderRef.current = _t;
    force((n) => (n + 1) % 1000);
  });

  const rot = rotRef.current;
  const time = timeRef.current;

  // Project all validator nodes
  const projectedNodes = VALIDATORS.map((v) => {
    const p = project(v.lat, v.lng, rot, tiltLat, R);
    return { ...v, ...p };
  });

  // Project continent paths
  const projectedContinents = CONTINENTS.map((poly) => {
    const pts = poly.map(([lat, lng]) => project(lat, lng, rot, tiltLat, R));
    const anyFront = pts.some((p) => p.z > -R * 0.05);
    return { pts, anyFront };
  });

  // Project grid lines
  const latLines = [-60, -30, 0, 30, 60].map((lat) => {
    const pts: { x: number; y: number; z: number }[] = [];
    for (let lng = -180; lng <= 180; lng += 5) {
      pts.push(project(lat, lng, rot, tiltLat, R));
    }
    return { lat, pts };
  });

  const lngLines = [-120, -60, 0, 60, 120].map((lng) => {
    const pts: { x: number; y: number; z: number }[] = [];
    for (let lat = -85; lat <= 85; lat += 5) {
      pts.push(project(lat, lng, rot, tiltLat, R));
    }
    return { lng, pts };
  });

  // Build arc paths with great-circle interpolation + animated pulse position
  const arcPaths = ARCS.map((arc, i) => {
    const from = VALIDATORS[arc.from];
    const to = VALIDATORS[arc.to];
    const pts: { x: number; y: number; z: number }[] = [];
    const steps = 30;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const { lat, lng } = slerp(from.lat, from.lng, to.lat, to.lng, t);
      pts.push(project(lat, lng, rot, tiltLat, R * 1.03));
    }
    const anyFront = pts.some((p) => p.z > 0);

    // Animated pulse — travels along the arc
    const pulseT = (time * 0.35 + i * 0.15) % 1;
    const pulseStep = Math.floor(pulseT * steps);
    const pulsePt = pts[Math.min(pulseStep, steps)] || pts[0];
    const pulseVisible = pulsePt && pulsePt.z > 0;

    return {
      pts,
      anyFront,
      color: from.color,
      index: i,
      pulsePt,
      pulseVisible,
    };
  });

  const svgSize = R * 2 + 60;

  const buildPath = (pts: { x: number; y: number; z: number }[]) => {
    let d = "";
    let started = false;
    for (const p of pts) {
      if (p.z > -R * 0.02) {
        if (!started) {
          d += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
          started = true;
        } else {
          d += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        }
      } else {
        started = false;
      }
    }
    return d;
  };

  return (
    <div className="flex w-full flex-col items-center gap-4 sm:gap-12">
      <span className="font-mono text-[9px] sm:text-[10px] text-muted-foreground tracking-widest uppercase text-center">
        {t("animations.globe.propagation")}
      </span>
      <div
        ref={containerRef}
        className="relative mx-auto flex w-full max-w-[600px] items-center justify-center overflow-hidden"
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`${-svgSize / 2} ${-svgSize / 2} ${svgSize} ${svgSize}`}
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Sphere surface — deep ocean with subtle green tint */}
            <radialGradient id="globe-surface" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#0a1a14" />
              <stop offset="35%" stopColor="#08160e" />
              <stop offset="70%" stopColor="#040f08" />
              <stop offset="100%" stopColor="#020a06" />
            </radialGradient>

            {/* Inner depth — subtle edge darkening only, no external projection */}
            <radialGradient id="globe-depth" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="82%" stopColor="transparent" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
            </radialGradient>

            {/* Specular highlight */}
            <radialGradient id="globe-specular" cx="30%" cy="25%" r="28%">
              <stop offset="0%" stopColor="#1a4a3a" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#1a4a3a" stopOpacity="0" />
            </radialGradient>

            {/* Atmospheric rim glow — subtle, no shadow */}
            <radialGradient id="globe-atmosphere" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="88%" stopColor="transparent" />
              <stop offset="94%" stopColor="#00E673" stopOpacity="0.12" />
              <stop offset="98%" stopColor="#00E673" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#00E673" stopOpacity="0" />
            </radialGradient>

            {/* Continent fill gradient */}
            <radialGradient id="continent-fill" cx="35%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#00E673" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#00E673" stopOpacity="0.04" />
            </radialGradient>

            <clipPath id="globe-clip">
              <circle cx="0" cy="0" r={R} />
            </clipPath>

            {/* Glow filter for nodes */}
            <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ── Sphere body ── */}
          <circle cx="0" cy="0" r={R} fill="url(#globe-surface)" />

          {/* ── Grid lines + continents (clipped to sphere) ── */}
          <g clipPath="url(#globe-clip)">
            {/* Latitude lines */}
            {latLines.map((line, i) => {
              const d = buildPath(line.pts);
              if (!d) return null;
              const isEquator = line.lat === 0;
              return (
                <path
                  key={`lat-${i}`}
                  d={d}
                  fill="none"
                  stroke={isEquator ? "#00E673" : "#1a3a2a"}
                  strokeWidth={isEquator ? 1 : 0.5}
                  strokeOpacity={isEquator ? 0.35 : 0.18}
                />
              );
            })}

            {/* Longitude lines */}
            {lngLines.map((line, i) => {
              const d = buildPath(line.pts);
              if (!d) return null;
              return (
                <path
                  key={`lng-${i}`}
                  d={d}
                  fill="none"
                  stroke="#1a3a2a"
                  strokeWidth={0.5}
                  strokeOpacity={0.18}
                />
              );
            })}

            {/* Continents — richer fill + brighter stroke */}
            {projectedContinents.map((continent, i) => {
              const d = buildPath(continent.pts);
              if (!d) return null;
              return (
                <path
                  key={`continent-${i}`}
                  d={d}
                  fill="url(#continent-fill)"
                  stroke="#00E673"
                  strokeWidth={0.9}
                  strokeOpacity={0.35}
                  strokeLinejoin="round"
                />
              );
            })}
          </g>

          {/* ── Inner depth (edge darkening for 3D feel, no external shadow) ── */}
          <circle cx="0" cy="0" r={R} fill="url(#globe-depth)" />

          {/* ── Specular highlight ── */}
          <circle cx="0" cy="0" r={R} fill="url(#globe-specular)" />

          {/* ── Atmospheric rim ── */}
          <circle cx="0" cy="0" r={R + 5} fill="url(#globe-atmosphere)" />

          {/* ── Block propagation arcs ── */}
          {arcPaths.map((arc) => {
            if (!arc.anyFront) return null;
            const d = buildPath(arc.pts);
            if (!d) return null;
            return (
              <g key={`arc-${arc.index}`}>
                {/* Arc line */}
                <path
                  d={d}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={1}
                  strokeOpacity={0.35}
                  strokeDasharray="2 4"
                />
                {/* Animated pulse traveling along the arc */}
                {arc.pulseVisible && arc.pulsePt && (
                  <circle
                    cx={arc.pulsePt.x}
                    cy={arc.pulsePt.y}
                    r={2.5}
                    fill={arc.color}
                    filter="url(#node-glow)"
                    opacity={0.9}
                  />
                )}
              </g>
            );
          })}

          {/* ── Validator nodes ── */}
          {projectedNodes.map((node, i) => {
            const isFront = node.z > -R * 0.05;
            const depth = (node.z + R) / (R * 2);
            const r = isFront ? 3.5 + depth * 2 : 2;
            const glowR = isFront ? 10 + depth * 6 : 5;
            const opacity = isFront ? 0.5 + depth * 0.5 : 0.1;

            // Pulse effect — each node pulses at its own rhythm
            const pulsePhase = (time * 1.2 + i * 0.5) % (Math.PI * 2);
            const pulseScale = isFront ? 1 + Math.sin(pulsePhase) * 0.2 : 1;

            return (
              <g key={`node-${i}`}>
                {/* Glow halo */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={glowR * pulseScale}
                  fill={node.color}
                  opacity={isFront ? 0.12 + depth * 0.18 : 0.03}
                  style={{ filter: "blur(3px)" }}
                />
                {/* Core dot */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r * pulseScale}
                  fill={node.color}
                  opacity={opacity}
                  filter="url(#node-glow)"
                  stroke={isFront ? "#ffffff" : "none"}
                  strokeWidth={isFront ? 0.5 : 0}
                  strokeOpacity={0.6}
                />
                {/* Bright center */}
                {isFront && depth > 0.4 && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={1}
                    fill="#ffffff"
                    opacity={0.85}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Stats — in normal flow, well separated from globe */}
      <div className="flex items-center justify-center gap-4 sm:gap-8 md:gap-16">
        <div className="text-center">
          <p className="font-mono text-sm sm:text-xl md:text-2xl font-bold text-foreground">
            4
          </p>
          <p className="mt-1 label-muted text-[7px] sm:text-[10px] uppercase tracking-wider">
            {t("animations.globe.validators")}
          </p>
        </div>
        <div className="h-8 w-px bg-border sm:h-10" />
        <div className="text-center">
          <p
            className="font-mono text-sm sm:text-xl md:text-2xl font-bold"
            style={{ color: "#00E673" }}
          >
            6
          </p>
          <p className="mt-1 label-muted text-[7px] sm:text-[10px] uppercase tracking-wider">
            {t("animations.globe.continents")}
          </p>
        </div>
        <div className="h-8 w-px bg-border sm:h-10" />
        <div className="text-center">
          <p
            className="font-mono text-sm sm:text-xl md:text-2xl font-bold"
            style={{ color: "#00C8FF" }}
          >
            0.4s
          </p>
          <p className="mt-1 label-muted text-[7px] sm:text-[10px] uppercase tracking-wider">
            {t("animations.globe.finality")}
          </p>
        </div>
      </div>
    </div>
  );
};
