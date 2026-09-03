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
      if (width === 0 || height === 0) return;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();

    // The container's real size can settle AFTER mount (grid layout,
    // font loading, etc). A plain window "resize" listener misses that,
    // leaving the canvas's internal resolution smaller than its CSS box —
    // the drawing then gets stretched/shifted toward a corner. Watch the
    // element itself instead so the canvas always matches its true size.
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(canvas);

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

    // Subtle node-to-node messages traveling along lattice edges
    const messages: { ei: number; t: number; speed: number }[] = [];
    let nextMsgAt = 1800;

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

      // Core gentle pulse — "less is more". No fracture, no halo.
      const pulsePhase = (time / 5200) % 1; // 0..1 loop (slow)
      const pulse = 0.5 - 0.5 * Math.cos(pulsePhase * Math.PI * 2);
      const coreOp = 0.6 + 0.32 * pulse;

      // --- Sacred energy ray — a faint vertical beam from the core ---
      // The lattice cradles something sacred: a barely-there pulse of light.
      {
        const cScr = project(corePt);
        const beamH = 190 * cScr.scale;
        const beamW = 12 * cScr.scale;
        const beamOp = 0.035 + 0.02 * pulse;
        const grad = ctx.createLinearGradient(
          cScr.x,
          cScr.y - beamH,
          cScr.x,
          cScr.y + beamH,
        );
        grad.addColorStop(0, "rgba(0, 255, 136, 0)");
        grad.addColorStop(0.5, `rgba(0, 255, 136, ${beamOp})`);
        grad.addColorStop(1, "rgba(0, 255, 136, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cScr.x, cScr.y, beamW, beamH, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Subtle node-to-node messages along lattice edges ---
      // Occasionally a tiny pulse travels an edge — nodes whispering.
      if (time > nextMsgAt && messages.length < 4) {
        messages.push({
          ei: Math.floor(Math.random() * edges.length),
          t: 0,
          speed: 0.35 + Math.random() * 0.3,
        });
        nextMsgAt = time + 900 + Math.random() * 1800;
      }
      // Track recently-activated nodes for a brief flash on receipt
      const flashNodes = new Set<number>();
      for (let mi = messages.length - 1; mi >= 0; mi--) {
        const m = messages[mi];
        m.t += dt * m.speed;
        if (m.t >= 1) {
          const [a, b] = edges[m.ei];
          flashNodes.add(b);
          messages.splice(mi, 1);
          continue;
        }
        const [a, b] = edges[m.ei];
        const pa = proj[a];
        const pb = proj[b];
        const mx = pa.x + (pb.x - pa.x) * m.t;
        const my = pa.y + (pb.y - pa.y) * m.t;
        const fade =
          m.t < 0.15 ? m.t / 0.15 : m.t > 0.85 ? (1 - m.t) / 0.15 : 1;
        // Glowing trail behind the pulse
        const trailLen = 0.12;
        const ts = Math.max(0, m.t - trailLen);
        const tx = pa.x + (pb.x - pa.x) * ts;
        const ty = pa.y + (pb.y - pa.y) * ts;
        const tgrad = ctx.createLinearGradient(tx, ty, mx, my);
        tgrad.addColorStop(0, "rgba(0, 255, 136, 0)");
        tgrad.addColorStop(1, `rgba(0, 255, 136, ${0.5 * fade})`);
        ctx.strokeStyle = tgrad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(mx, my);
        ctx.stroke();
        // Bright pulse head with soft glow
        ctx.shadowColor = "rgba(0, 255, 136, 0.8)";
        ctx.shadowBlur = 6;
        ctx.fillStyle = `rgba(0, 255, 136, ${0.85 * fade})`;
        ctx.beginPath();
        ctx.arc(mx, my, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // Flash receiving nodes briefly
      flashNodes.forEach((ni) => {
        const p = proj[ni];
        ctx.shadowColor = "rgba(0, 255, 136, 0.7)";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "rgba(0, 255, 136, 0.7)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // --- Symbol </> — vibrant matrix green, 3D, rotates WITH the lattice ---
      const sProj = symVerts.map(project);
      const cProj = project(corePt);

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
      resizeObserver.disconnect();
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
      className="relative mx-auto flex h-[320px] sm:h-[380px] lg:h-[440px] w-full items-center justify-center"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Unified 3D scene: lattice + </> rotating together */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
};
