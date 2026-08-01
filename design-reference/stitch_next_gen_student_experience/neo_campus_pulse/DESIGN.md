---
name: Neo-Campus Pulse
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#ccc3d8'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#958da1'
  outline-variant: '#4a4455'
  surface-tint: '#d2bbff'
  primary: '#d2bbff'
  on-primary: '#3f008e'
  primary-container: '#7c3aed'
  on-primary-container: '#ede0ff'
  inverse-primary: '#732ee4'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#007650'
  on-tertiary-container: '#76ffc2'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#eaddff'
  primary-fixed-dim: '#d2bbff'
  on-primary-fixed: '#25005a'
  on-primary-fixed-variant: '#5a00c6'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  title-md:
    fontFamily: Sora
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  stats-number:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '800'
    lineHeight: 32px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 20px
  lg: 32px
  xl: 48px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

This design system is built to transform the traditional, often stagnant ERP experience into a high-octane, tech-forward digital environment. The aesthetic merges **Glassmorphism** with **High-Contrast/Bold** elements to create a UI that feels like a premium gaming dashboard rather than a utility tool. 

The target audience—students—expects speed, responsiveness, and visual stimulation. By utilizing deep charcoal bases with neon accents, the interface achieves a "dark mode first" philosophy that reduces eye strain while highlighting critical academic data through vibrant color signals. The mood is energetic, futuristic, and professional, aiming to gamify the educational journey through "glowing" progress indicators and tactile, translucent surfaces.

## Colors

The palette is anchored by a deep navy-charcoal base to ensure maximum pop for the neon accents. 

- **Primary (Electric Violet):** Used for primary actions, active states, and progress milestones. It represents the "core" of the student’s identity.
- **Secondary (Cyber Cyan):** Used for informational elements, secondary buttons, and data visualization. 
- **Tertiary (Neon Green):** Reserved for success states, completed tasks, and "on-track" attendance markers.
- **Surface Strategy:** The background uses `#0F172A`, while cards and containers use a semi-transparent `#1E293B` to facilitate glassmorphism.
- **Gradients:** Use linear gradients (45 degrees) moving from Primary to Secondary for high-impact areas like hero banners or grade summaries.

## Typography

The typography system utilizes **Sora** for headlines to provide a distinct, geometric, and futuristic character. **Inter** is used for body text and functional labels to maintain high legibility amidst the vibrant color palette.

- **Headlines:** Use heavy weights (700-800) for "Display" and "Headline" levels to command attention. 
- **Stats:** Numeric data (Grades, Attendance %) should use the `stats-number` token to emphasize achievement.
- **Labels:** Use uppercase with slight letter spacing for category headers and navigation labels to create a structured, "tech" look.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a heavy emphasis on containerized content to facilitate the glassmorphic style.

- **Desktop:** 12-column grid with 24px gutters. Use wide margins (40px+) to allow the dark background to provide breathing room.
- **Mobile:** 4-column grid with 16px margins.
- **Spacing Rhythm:** An 8px base unit drives all padding and margins. Use `lg` (32px) for spacing between major sections (e.g., Attendance Summary vs. Class Schedule).
- **Density:** Maintain a "Comfortable" density. The goal is to avoid the cluttered feel of traditional ERPs by using generous white (or "dark") space.

## Elevation & Depth

Hierarchy is achieved through **Tonal Layers** and **Glassmorphism** rather than traditional heavy shadows.

- **Base Layer:** `#0F172A` (Solid).
- **Middle Layer (Cards):** Background `#1E293B` at 60-80% opacity with a `20px` backdrop-blur. 
- **Borders:** Instead of shadows, use 1px solid borders at 10% white opacity. For "Active" or "Featured" cards, use a thin gradient border (Primary to Secondary) to create a subtle outer glow effect.
- **Floating Elements:** Modals and tooltips use a higher background opacity (90%) and a soft, diffused `48px` shadow with a slight Primary color tint (`rgba(124, 58, 237, 0.15)`).

## Shapes

The design system uses a **Rounded** (level 2) language to balance the "tech" aesthetic with approachability.

- **Standard Components:** Buttons and Input fields use `0.5rem` (8px) corner radius.
- **Containers:** Large cards and glass panels use `rounded-xl` (1.5rem / 24px) to create a friendly, modern "app-like" feel.
- **Feedback Elements:** Success/Error chips should use pill-shaping (3) to differentiate them from functional buttons.

## Components

### Buttons
- **Primary:** Solid Electric Violet with white text. High-energy hover state with a subtle outer glow.
- **Secondary:** Outlined Cyber Cyan with 10% background fill.
- **Ghost:** No background, Cyber Cyan text, used for less critical navigation.

### Cards
- **Glass Panel:** The signature component. Semi-transparent dark background, 20px blur, and a thin grey-white border.
- **Featured Card:** Same as Glass Panel but includes a 2px Neon Green or Cyber Cyan top-border or gradient-stroke to signify importance.

### Inputs & Forms
- **Fields:** Darker than the card background (`#020617`), 1px border. On focus, the border glows with the Primary color.
- **Placeholders:** Muted blue-grey (`#64748B`).

### Progress & Gamification
- **Progress Bars:** Use thick tracks (8px) with a glowing gradient fill.
- **Badges:** Small, pill-shaped chips with high-saturation backgrounds and high-contrast text for status (e.g., "LIVE", "DUE", "DONE").

### Navigation
- **Bottom Bar (Mobile):** Glassmorphic blur over the page content, with active icons glowing in Cyber Cyan.
- **Sidebar (Desktop):** Slim, dark, with vertical indicator bars in Electric Violet for the active state.