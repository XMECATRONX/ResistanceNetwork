import { useRef, type ReactNode } from "react";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  glare?: boolean;
}

/**
 * Interactive 3D tilt card — tracks mouse position and applies
 * perspective rotation with a shine sweep overlay.
 */
export const TiltCard = ({
  children,
  className = "",
  maxTilt = 8,
  glare = true,
}: TiltCardProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const tiltX = (y - 0.5) * -2 * maxTilt;
    const tiltY = (x - 0.5) * 2 * maxTilt;
    el.style.transform = `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-2px)`;
    el.style.setProperty("--shine-x", `${x * 100}%`);
    el.style.setProperty("--shine-y", `${y * 100}%`);
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform =
      "perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`tilt-card ${className}`}
      style={{
        transformStyle: "preserve-3d",
        transition: "transform 0.15s cubic-bezier(0.23,1,0.32,1)",
      }}
    >
      {glare && <div className="tilt-card-shine" />}
      <div className="tilt-card-glow" />
      <div className="tilt-card-inner">{children}</div>
    </div>
  );
};
