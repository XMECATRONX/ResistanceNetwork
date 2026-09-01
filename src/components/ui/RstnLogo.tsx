import React from "react";

interface RstnLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  glow?: boolean;
}

/**
 * RSTN — </> Quantum Break
 *
 * The universal symbol of code. Two clean angle brackets (< >) with a
 * single radiant core at the center — the shortest vector (SVP) of our
 * lattice cryptography. Minimalist: no fracture line, no ring. Pure Matrix.
 *
 * Colors aligned to the design system: --primary #00E673 (150 100 45),
 * --primary-dim #12A55C (150 80 36).
 */
export const RstnLogo: React.FC<RstnLogoProps> = ({
  size = "md",
  className = "",
  glow = false,
}) => {
  const sizeMap = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
    xl: "h-12 w-12",
  };

  return (
    <div
      className={`relative flex items-center justify-center ${sizeMap[size]} ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        style={
          glow
            ? { filter: "drop-shadow(0 0 8px rgba(0, 230, 115, 0.45))" }
            : undefined
        }
      >
        <defs>
          <linearGradient id="qb-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00E673" />
            <stop offset="100%" stopColor="#12A55C" />
          </linearGradient>
        </defs>
        {/* Left bracket < */}
        <path
          d="M 42 25 L 24 50 L 42 75"
          stroke="url(#qb-grad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Right bracket > */}
        <path
          d="M 58 25 L 76 50 L 58 75"
          stroke="url(#qb-grad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Radiant quantum core — the shortest vector */}
        <circle cx="50" cy="50" r="6.5" fill="#00E673" />
      </svg>
    </div>
  );
};
