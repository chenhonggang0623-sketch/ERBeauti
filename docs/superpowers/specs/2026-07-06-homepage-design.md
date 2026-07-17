# Homepage — Premium Interactive Landing Page

## Summary

Add a standalone homepage (landing page) with dark, high-tech visual style using ER-diagram-inspired particle animations, before the existing editor. Uses `react-router-dom` for page routing.

## Architecture

- **Router**: `react-router-dom` with two routes — `/` (homepage) and `/editor` (existing App)
- **App.tsx**: becomes a router shell
- **New files**: `src/pages/HomePage.tsx`, `src/pages/EditorPage.tsx`, `src/components/home/` (all homepage sub-components)
- **Particle canvas**: lightweight `useDataParticles` hook using `<canvas>` (no WebGL dependency required)

## Routing Setup

```
/           → HomePage
/editor     → EditorPage (current App content, unchanged)
```

`react-router-dom` added as a dependency. `BrowserRouter` wraps the root in `main.tsx`. The existing `App` content moves to `EditorPage.tsx`.

## Sections (top → bottom)

### 1. Hero — Full-screen Particle Background

- **Particle system**: ~80 floating nodes connected by glowing lines, simulating ER diagram aesthetics
  - Nodes drift slowly on x/y axes with sine-wave velocity
  - Lines connect nodes within a distance threshold
  - Colors: indigo `#6366f1`, violet `#a855f7`, cyan `#06b6d4`
  - Mouse interaction: nearby nodes glow brighter and shift slightly toward cursor
- **Center text stack**:
  - H1: "从 SQL 到美图，3 秒" (text-6xl, font-bold, tracking-tight)
  - Typewriter subtitle cycling through: "粘贴 SQL · 导入 DBML · 连接数据库 → 一键美化"
  - CTA button: "开始美化" → links to `/editor`
    - Gradient bg (indigo→violet), large, hover glow pulse
- **Bottom-right**: floating screenshot of actual ER diagram output (subtle levitation animation, ~3s cycle)

### 2. Features — 3 Cards

Three feature cards in a row, staggered fade-in on scroll:

| Card | Icon | Heading | Description |
|------|------|---------|-------------|
| Multi-format Import | `FileCode2` | SQL · DBML · Prisma | 粘贴或导入任意格式，智能解析 |
| One-click Beautify | `Wand2` | AI 布局 + 多风格 | 一键自动排列，支持表和 Chen 式 |
| Multi-format Export | `Download` | SVG · PNG · SQL | 高清导出，嵌入文档或演示 |

- Hover: card lifts slightly, icon rotates, subtle glow behind
- Background: semi-transparent dark glass (`bg-white/5 backdrop-blur-xl border border-white/10`)

### 3. How It Works — 3 Steps

Three steps connected by a glowing dotted line with animated light dot flow:

1. **输入** — Paste SQL / Import file / Connect DB → icon: `Terminal`
2. **美化** — Auto layout, then drag to fine-tune → icon: `Sparkles`
3. **分享** — Export SVG/PNG, embed anywhere → icon: `Share2`

- Light dot animation on the connecting line flows from step 1 → 3 continuously
- Hover on a step accelerates the flow

### 4. Showcase — Before/After + Gallery

- **Left**: Before/After comparison slider
  - Before: raw SQL code block (dark code theme)
  - After: rendered ER diagram screenshot
  - Slider handle with arrow icon
- **Right**: 2 smaller ER diagram screenshots stacked vertically, inside Mac-window-style frames
- Cards have slight tilt-parallax on mouse move

### 5. CTA

- Gradient background (indigo → violet, matching hero)
- "准备好美化你的数据了吗？"
- "免费开始使用" button with pulse glow animation
- Subtext: "无需注册，粘贴即用"

### 6. Footer

- Logo + "ERBeauti"
- GitHub link
- Copyright line

## Scroll Animations

All sections use `motion` (framer-motion) for:
- Fade-in + slide-up on scroll entry (`useInView`)
- Hero particle canvas: persistent, full-viewport
- Staggered children in features and steps

## File Changes

| File | Action |
|------|--------|
| `package.json` | Add `react-router-dom` dep |
| `src/main.tsx` | Add `BrowserRouter` wrapper |
| `src/App.tsx` | Convert to router shell with Routes |
| `src/pages/HomePage.tsx` | New — entire homepage |
| `src/pages/EditorPage.tsx` | New — existing App content moved here |
| `src/components/home/HeroParticles.tsx` | New — canvas particle system |
| `src/components/home/HeroSection.tsx` | New — hero content overlay |
| `src/components/home/FeatureCards.tsx` | New — 3 feature cards |
| `src/components/home/HowItWorks.tsx` | New — 3 steps with connecting line |
| `src/components/home/Showcase.tsx` | New — before/after + gallery |
| `src/components/home/CTASection.tsx` | New — call to action |
| `src/components/home/Footer.tsx` | New — footer |
| `src/components/home/TypewriterText.tsx` | New — typewriter animation |
| `src/hooks/useDataParticles.ts` | New — canvas particle logic |

## Visual Design Tokens (Dark Theme)

- Background: `#0a0a0b` (near-black)
- Card bg: `rgba(255,255,255,0.03)` with `backdrop-blur-xl`
- Accent gradient: `#6366f1 → #a855f7` (indigo → violet)
- Secondary accent: `#06b6d4` (cyan)
- Text primary: `#fafafa`
- Text secondary: `#a1a1aa`
- Border: `rgba(255,255,255,0.08)`
- Glow: `box-shadow: 0 0 40px rgba(99,102,241,0.15)`

## Performance

- Particle canvas uses `requestAnimationFrame`, auto-pauses when not in viewport
- Screenshots are pre-loaded, lazy-loaded below fold
- No external WebGL library; pure 2D canvas keeps bundle small
