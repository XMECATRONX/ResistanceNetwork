# RSTN — Performance Audit Report

> Final frontend performance audit before backend handoff.
> Estado: borrador interno — confidencial, no público.

---

## 1. Bundle Architecture & Code-Splitting

### Lazy-loaded 3D components (Landing page)

All heavy 3D visualization components are lazy-loaded via `React.lazy()` + `Suspense`:

| Component | Loaded When | Chunk |
|-----------|-------------|-------|
| `Tokenomics3D` | Scrolled to tokenomics section | Separate chunk |
| `ArchitectureStack3D` | Scrolled to architecture section | Separate chunk |
| `Globe3D` | Scrolled to global network section | Separate chunk |
| `QuantumTimeline` | Scrolled to security section | Separate chunk |
| `TransactionFlow3D` | Scrolled to flow section | Separate chunk |
| `QuantumRefuge3D` | Scrolled to migration section | Separate chunk |

**Result:** Initial landing page load only includes the hero + critical CSS. 3D chunks load on-demand when scrolled into view, with a spinner fallback.

### Route-level loading

All 4 routes (`/`, `/terminal`, `/dev`, `*`) are **eagerly loaded** (no preloader on navigation). This was a deliberate decision — the preloader was removed because it was disruptive. The terminal's 19 views are also eagerly loaded (instant view switching, no spinner).

### Vendor splitting

Vite automatically splits vendor code. The heaviest dependencies:
- `framer-motion` (~50KB gzipped) — used across landing + terminal
- `@noble/post-quantum` (~120KB gzipped) — Dilithium3/Kyber768, only imported by `rstn-sdk.ts` and `wallet.ts`
- `recharts` (~100KB gzipped) — only used in dashboard charts
- `react-router-dom` + `react-i18next` — core

**Note:** `vite.config.ts` is read-only in this environment, so manual `manualChunks` configuration could not be added. Vite's default chunking is adequate. For further optimization, the dev backend can add a `build.rollupOptions.output.manualChunks` config to split `noble-post-quantum` into its own chunk (it's only needed for wallet operations).

---

## 2. Animation Performance

### HeroVisual (Quantum Lattice Core)
- **Rendering:** Canvas2D (not SVG/DOM) — 60fps with 64 lattice points
- **DPR capped at 2** — prevents retina overdraw
- **Mobile optimization:** grid reduced from 4³ to 3³ (27 vs 64 points), particles 4 vs 8
- **Mouse interaction:** smooth tilt via lerp (0.04 factor), no jank
- **Cleanup:** `cancelAnimationFrame` on unmount, resize listener removed

### NetworkVisualizerView
- **Viewport pausing (NEW):** `IntersectionObserver` pauses `useAnimationFrame` when the view scrolls off-screen — saves CPU when user is in other terminal tabs
- **Throttled recompute:** node positions recompute at 25fps (`Math.floor(time/40)`) not every frame
- **Packet cap:** max 40 concurrent packets, completed packets removed
- **Deterministic layout:** node positions computed once at module load (not per render)

### Landing scroll animations
- All `whileInView` use `viewport={{ once: true }}` — animations fire once, no re-trigger on scroll back
- `prefers-reduced-motion` media query disables all animations (accessibility)

### Reduced motion support
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 3. Data Fetching

### API layer (`src/lib/api.ts`)
- **Mock mode (current):** synchronous reads from `protocol.ts` — zero network latency
- **RPC mode (future):** `autoDetectRpc()` probes `localhost:9944` once on app load with 2s timeout, silent failure
- **Fallback strategy:** `rpcCallWithFallback` auto-disables RPC mode on failure, logs clearly
- **Write operations:** `submitTransaction`, `stake`, `unstake`, `delegate` — **throw on failure** (no silent fallback, user must know)

### Polling intervals
- Network stats: 5s interval (NetworkVisualizerView)
- No other polling — data is mock/static

---

## 4. Image & Asset Optimization

- **No raster images** — entire UI is SVG/CSS, zero image payload
- **OG image:** generated cloud-hosted (referenced in `index.html` meta only, not loaded by app)
- **Favicon:** inline SVG (`/favicon.svg`), 1KB
- **Fonts:** system font stack + Google Fonts (Sora, Manrope, JetBrains Mono) loaded via CSS — no font payload in bundle

---

## 5. Lighthouse Targets (Expected)

Based on the architecture, expected Lighthouse scores on production build:

| Metric | Target | Basis |
|--------|--------|-------|
| Performance | 90-95 | Lazy 3D chunks, Canvas2D, no images |
| Accessibility | 95-100 | Skip links, focus-visible, ARIA, reduced-motion |
| Best Practices | 95-100 | HTTPS, no console errors, proper error boundaries |
| SEO | 95-100 | JSON-LD, meta tags, semantic HTML, sitemap |

**LCP element:** Hero heading (`hero.title`) — renders immediately, no image dependency
**CLS:** ~0 — all dimensions fixed, no layout shift from lazy loads (Suspense fallback reserves space)

---

## 6. Recommendations for Dev Backend (Post-Handoff)

1. **Add `manualChunks` to vite.config.ts:**
   ```js
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           'pq-crypto': ['@noble/post-quantum', '@noble/hashes'],
           'vendor': ['react', 'react-dom', 'react-router-dom'],
         }
       }
     }
   }
   ```
   This isolates the 120KB post-quantum crypto into a chunk loaded only when wallet is used.

2. **Enable Brotli compression** on the static host (nginx/cdn) — 20% smaller than gzip for JS.

3. **When connecting real RPC:** reduce `autoDetectRpc` timeout from 2000ms to 800ms — faster fallback to mock in dev.

4. **Add `Cache-Control: immutable`** for hashed JS chunks in production CDN config.
