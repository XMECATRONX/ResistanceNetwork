import { useEffect, useRef, useState } from "react";

/**
 * RESISTANCE NETWORK — Quantum Lattice Core (unified 3D)
 *
 * The animated symbol is the EXACT isotype (</> Quantum Break):
 *  - Two deep, narrow angle brackets (< >)
 *  - A radiant core (filled circle) = the shortest vector
 *
 * Minimalist: no fracture line, no ring. It is rendered IN the lattice's
 * 3D space and projected through the same transform, so it rotates WITH
 * the cube as one structure.
 *
 * Animation is "less is more": the core gently pulses. Nothing else moves.
 *
 * Lattice-based cryptography (Dilithium3 / ML-DSA-65, Kyber768 /
 * ML-KEM-768) derives its security from the hardness of the Shortest
 * Vector Problem (SVP) on high-dimensional lattices.
 *
 * Color separation:
 *  - LATTICE (background structure): dim cyan — the math, quiet.
 *  - </> QUANTUM BREAK (focal point): vibrant matrix green — the resistance.
 */

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 480);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
};

interface Pt {
  x: number;
  y: number;
  z: number;
}

export const HeroVisual = () => {
  const isMobile = useIsMobile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resizeCanvas = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();

    // Lattice — frames the focal symbol
    const grid = isMobile ? 3 : 4;
    const spacing = isMobile ? 58 : 72;
    const persp = 620;
    const depthOffset = 160;
    const offset = (grid - 1) / 2;

    const points: Pt[] = [];
    const edges: [number, number][] = [];
    const idx = (x: number, y: number, z: number) =>
      x * grid * grid + y * grid + z;

    for (let x = 0; x < grid; x++) {
      for (let y = 0; y < grid; y++) {
        for (let z = 0; z < grid; z++) {
          points.push({
            x: (x - offset) * spacing,
            y: (y - offset) * spacing,
            z: (z - offset) * spacing,
          });
        }
      }
    }
    for (let x = 0; x < grid; x++) {
      for (let y = 0; y < grid; y++) {
        for (let z = 0; z < grid; z++) {
          if (x < grid - 1) edges.push([idx(x, y, z), idx(x + 1, y, z)]);
          if (y < grid - 1) edges.push([idx(x, y, z), idx(x, y + 1, z)]);
          if (z < grid - 1) edges.push([idx(x, y, z), idx(x, y, z + 1)]);
        }
      }
    }

    // Symbol — </> Quantum Break in 3D, EXACT isotype proportions.
    // Isotype (viewBox 0..100, center x=50):
    //   left bracket:  top(42,25) mid(24,50) bot(42,75)
    //   right bracket: top(58,25) mid(76,50) bot(58,75)
    //   half-width (mid→center) = 26, inner x = 8, half-height = 25
    //   => inner/halfWidth = 0.31, halfHeight/halfWidth = 0.96
    const symHalfW = isMobile ? 42 : 56; // mid → center (fits inside lattice)
    const symInner = symHalfW * 0.31; // top/bot x offset from center
    const symTop = symHalfW * 0.96; // bracket half-height

    const symVerts: Pt[] = [
      { x: -symInner, y: -symTop, z: 0 }, // 0 left top
      { x: -symHalfW, y: 0, z: 0 }, // 1 left mid
      { x: -symInner, y: symTop, z: 0 }, // 2 left bot
      { x: symInner, y: -symTop, z: 0 }, // 3 right top
      { x: symHalfW, y: 0, z: 0 }, // 4 right mid
      { x: symInner, y: symTop, z: 0 }, // 5 right bot
    ];
    const symEdges: [number, number][] = [
      [0, 1],
      [1, 2],
      [3, 4],
      [4, 5],
    ];
    const corePt: Pt = { x: 0, y: 0, z: 0 };

    let rotY = 0;
    let rotX = -0.34;
    let lastTime = 0;
    let raf = 0;

    const project = (p: Pt) => {
      const cosY = Math.cos(rotY),
        sinY = Math.sin(rotY);
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;
      const cosX = Math.cos(rotX),
        sinX = Math.sin(rotX);
      const y1 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;
      const scale = persp / (persp + z2 + depthOffset);
      return { x: x1 * scale, y: y1 * scale, z: z2, scale };
    };

    const draw = (time: number) => {
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016;
      lastTime = time;

      // Slow breathing rotation + gentle mouse parallax — symbol rides along
      rotY += dt * 0.085;
      const targetX = -0.34 + mouseRef.current.y * 0.16;
      rotX += (targetX - rotX) * 0.04;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2, height / 2);

      // --- Lattice edges — dim cyan (background structure) ---
      const proj = points.map(project);
      const edgeData = edges.map(([a, b]) => ({
        pa: proj[a],
        pb: proj[b],
        avgZ: (proj[a].z + proj[b].z) / 2,
      }));
      edgeData.sort((a, b) => a.avgZ - b.avgZ);
      edgeData.forEach(({ pa, pb, avgZ }) => {
        const opacity = Math.max(0.02, Math.min(0.13, (avgZ + 280) / 1200));
        ctx.strokeStyle = `rgba(90, 200, 255, ${opacity})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      });
      // Lattice nodes — sparse, dim cyan
      const pointData = proj.map((p) => ({ p }));
      pointData.sort((a, b) => a.p.z - b.p.z);
      pointData.forEach(({ p }) => {
        const opacity = Math.max(0.08, Math.min(0.32, (p.z + 280) / 800));
        ctx.fillStyle = `rgba(110, 210, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, 1 + p.scale * 1.0), 0, Math.PI * 2);
        ctx.fill();
      });

      // --- Symbol </> — vibrant matrix green, 3D, rotates WITH the lattice ---
      const sProj = symVerts.map(project);
      const cProj = project(corePt);

      // Core gentle pulse — "less is more". No fracture, no halo.
      const pulsePhase = (time / 5200) % 1; // 0..1 loop (slow)
      const pulse = 0.5 - 0.5 * Math.cos(pulsePhase * Math.PI * 2);
      const coreOp = 0.6 + 0.32 * pulse;

      ctx.shadowColor = "rgba(0, 255, 136, 0.4)";
      ctx.shadowBlur = 10;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Brackets — soft wide pass (glow) + sharp pass (matches isotype stroke)
      symEdges.forEach(([a, b]) => {
        ctx.strokeStyle = "rgba(0, 255, 136, 0.14)";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(sProj[a].x, sProj[a].y);
        ctx.lineTo(sProj[b].x, sProj[b].y);
        ctx.stroke();
      });
      symEdges.forEach(([a, b]) => {
        ctx.strokeStyle = "rgba(0, 255, 136, 0.92)";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(sProj[a].x, sProj[a].y);
        ctx.lineTo(sProj[b].x, sProj[b].y);
        ctx.stroke();
      });
      // Cap dots at the 6 bracket vertices
      sProj.forEach((p) => {
        ctx.fillStyle = "rgba(0, 255, 136, 0.92)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.1, 0, Math.PI * 2);
        ctx.fill();
      });

      // Core — the shortest vector. Gentle pulse, no expanding halo.
      const coreR = Math.max(2.5, (3.8 + 0.8 * pulse) * cProj.scale);
      ctx.fillStyle = `rgba(0, 255, 136, ${coreOp})`;
      ctx.beginPath();
      ctx.arc(cProj.x, cProj.y, coreR, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resizeCanvas);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [isMobile]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseRef.current = {
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5,
    };
  };
  const handleMouseLeave = () => {
    mouseRef.current = { x: 0, y: 0 };
  };

  return (
    <div
      className="relative mx-auto flex h-[320px] sm:h-[380px] lg:h-[440px] w-full items-center justify-center overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Ambient green glow — marks the focal core */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60"
        style={{
          width: 340,
          height: 340,
          background:
            "radial-gradient(circle, hsl(150 100% 50% / 0.22) 0%, transparent 70%)",
          filter: "blur(48px)",
        }}
      />
      {/* Unified 3D scene: lattice + </> rotating together */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
};
