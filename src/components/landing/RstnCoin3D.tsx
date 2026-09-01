import { motion } from "framer-motion";

/**
 * RstnCoin3D — the RSTN token coin, rotating to show both faces.
 *
 * Front = "</>" Quantum Break (the protocol symbol, matches RstnLogo)
 * Back = "1B" (the hard cap — scarcity)
 * Rim = reeded edge facets (real coin thickness)
 *
 * Rotates slowly (14s) = the token is stable, not volatile.
 */
export const RstnCoin3D = () => {
  return (
    <div className="relative mx-auto flex flex-col items-center">
      {/* Coin visual container — fixed aspect ratio */}
      <div
        className="rstn-coin-wrapper relative flex h-[260px] w-[220px] items-center justify-center sm:h-[320px] sm:w-[280px]"
        style={{ perspective: "1600px" }}
      >
        {/* Ambient glow — quantum field, pulses with coin rotation */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 260,
            height: 260,
            background:
              "radial-gradient(circle, rgba(0,230,115,0.06) 0%, transparent 55%)",
            filter: "blur(30px)",
          }}
          animate={{ opacity: [0.4, 0.7, 0.4], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Coin assembly — float + wobble + dynamic tilt */}
        <motion.div
          animate={{ y: [0, -14, 0], rotateZ: [0, 2, 0, -2, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
          style={{ width: 220, height: 220, transformStyle: "preserve-3d" }}
        >
          <motion.div
            animate={{ rotateY: [0, 360], rotateX: [10, -5, 10] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* ═══ FRONT FACE — dark tungsten + embossed </> Quantum Break ═══ */}
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center"
              style={{
                transform: "translateZ(11px)",
                transformStyle: "preserve-3d",
                background: `
                  radial-gradient(circle at 32% 22%,
                    #52565a 0%,
                    #2e3236 12%,
                    #1c2024 32%,
                    #101418 58%,
                    #080a0c 100%
                  )
                `,
                boxShadow: `
                  inset 0 4px 10px rgba(255,255,255,0.14),
                  inset 0 -10px 22px rgba(0,0,0,0.65),
                  0 0 0 3px #1c2024,
                  0 0 0 5px #080a0c
                `,
              }}
            >
              {/* Inner rim — triple ring like real proof coins */}
              <div
                className="absolute rounded-full"
                style={{
                  inset: "6px",
                  border: "1.5px solid rgba(255,255,255,0.08)",
                  boxShadow: "inset 0 1px 4px rgba(0,0,0,0.5)",
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  inset: "10px",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  inset: "14px",
                  border: "0.5px solid rgba(0,230,115,0.08)",
                }}
              />

              {/* THE </> QUANTUM BREAK — identical to the protocol logo, enlarged */}
              <svg viewBox="0 0 100 100" className="w-[72%] h-[72%]">
                <defs>
                  <linearGradient
                    id="coinQBFront"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#00E673" />
                    <stop offset="100%" stopColor="#12A55C" />
                  </linearGradient>
                </defs>
                {/* Left bracket < */}
                <path
                  d="M 42 25 L 24 50 L 42 75"
                  stroke="url(#coinQBFront)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                {/* Right bracket > */}
                <path
                  d="M 58 25 L 76 50 L 58 75"
                  stroke="url(#coinQBFront)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                {/* Radiant quantum core */}
                <circle cx="50" cy="50" r="6.5" fill="#00E673" />
              </svg>

              {/* Moving specular highlight — simulates light reflecting off rotating coin */}
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{ inset: "2px" }}
                animate={{
                  background: [
                    "radial-gradient(ellipse 40% 30% at 25% 18%, rgba(255,255,255,0.12), transparent 55%)",
                    "radial-gradient(ellipse 40% 30% at 75% 82%, rgba(255,255,255,0.12), transparent 55%)",
                    "radial-gradient(ellipse 40% 30% at 25% 18%, rgba(255,255,255,0.12), transparent 55%)",
                  ],
                }}
                transition={{
                  duration: 14,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>

            {/* ═══ BACK FACE — "1B" with rim text ═══ */}
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center"
              style={{
                transform: "rotateY(180deg) translateZ(11px)",
                transformStyle: "preserve-3d",
                background: `
                  radial-gradient(circle at 32% 22%,
                    #52565a 0%,
                    #2e3236 12%,
                    #1c2024 32%,
                    #101418 58%,
                    #080a0c 100%
                  )
                `,
                boxShadow: `
                  inset 0 4px 10px rgba(255,255,255,0.14),
                  inset 0 -10px 22px rgba(0,0,0,0.65),
                  0 0 0 3px #1c2024,
                  0 0 0 5px #080a0c
                `,
              }}
            >
              {/* Inner rim */}
              <div
                className="absolute rounded-full"
                style={{
                  inset: "6px",
                  border: "1.5px solid rgba(255,255,255,0.08)",
                  boxShadow: "inset 0 1px 4px rgba(0,0,0,0.5)",
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  inset: "10px",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  inset: "14px",
                  border: "0.5px solid rgba(0,230,115,0.08)",
                }}
              />

              {/* Rim text — curved around the coin */}
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                <defs>
                  <path
                    id="rimArcTop"
                    d="M 50 50 m -36 0 a 36 36 0 1 1 72 0"
                    fill="none"
                  />
                  <path
                    id="rimArcBottom"
                    d="M 50 50 m -36 0 a 36 36 0 1 0 72 0"
                    fill="none"
                  />
                </defs>
                <text
                  className="font-mono"
                  fill="#00E673"
                  opacity="0.4"
                  fontSize="5"
                  letterSpacing="1.8"
                >
                  <textPath
                    href="#rimArcTop"
                    startOffset="50%"
                    textAnchor="middle"
                  >
                    POST-QUANTUM
                  </textPath>
                </text>
                <text
                  className="font-mono"
                  fill="#00E673"
                  opacity="0.3"
                  fontSize="4"
                  letterSpacing="1.5"
                >
                  <textPath
                    href="#rimArcBottom"
                    startOffset="50%"
                    textAnchor="middle"
                  >
                    FAIR LAUNCH · 2026
                  </textPath>
                </text>
              </svg>

              {/* 1B — big, embossed */}
              <div className="flex flex-col items-center justify-center relative z-10">
                <span
                  className="font-display font-black tracking-tight leading-none"
                  style={{
                    fontSize: "52px",
                    color: "#00E673",
                  }}
                >
                  1B
                </span>
                <span
                  className="font-mono mt-2"
                  style={{
                    fontSize: "6px",
                    color: "#00E673",
                    opacity: 0.45,
                    letterSpacing: "0.35em",
                  }}
                >
                  HARD CAP
                </span>
              </div>

              {/* Moving specular highlight on back */}
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{ inset: "2px" }}
                animate={{
                  background: [
                    "radial-gradient(ellipse 40% 30% at 75% 18%, rgba(255,255,255,0.12), transparent 55%)",
                    "radial-gradient(ellipse 40% 30% at 25% 82%, rgba(255,255,255,0.12), transparent 55%)",
                    "radial-gradient(ellipse 40% 30% at 75% 18%, rgba(255,255,255,0.12), transparent 55%)",
                  ],
                }}
                transition={{
                  duration: 14,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>

            {/* ═══ REEDED EDGE — cylinder wall facets connecting front (Z=+11) to back (Z=-11) ═══ */}
            {/* 48 facets × 20px width = 960px > circumference 691px → overlap, no gaps */}
            {/* Height 24px > Z-span 22px → covers full thickness with slight overlap into faces */}
            {Array.from({ length: 48 }).map((_, idx) => {
              const angle = (idx / 48) * 360;
              const isEven = idx % 2 === 0;
              return (
                <div
                  key={`edge-${idx}`}
                  className="absolute top-1/2 left-1/2"
                  style={{
                    width: "24px",
                    height: "24px",
                    marginLeft: "-12px",
                    marginTop: "-12px",
                    transform: `rotateZ(${angle}deg) translateX(110px) rotateY(90deg)`,
                    transformStyle: "preserve-3d",
                    background: isEven
                      ? "linear-gradient(270deg, #5a5e62 0%, #3e4246 20%, #2a2e32 45%, #1c2024 70%, #0d1013 100%)"
                      : "linear-gradient(270deg, #4a4e52 0%, #34383c 20%, #22262a 45%, #14181c 70%, #080a0c 100%)",
                    borderTop: "1px solid rgba(255,255,255,0.12)",
                    borderBottom: "1px solid rgba(0,0,0,0.6)",
                    boxShadow:
                      "inset 0 1px 3px rgba(255,255,255,0.1), inset 0 -1px 3px rgba(0,0,0,0.5)",
                  }}
                />
              );
            })}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};
