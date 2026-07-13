---
name: Deep Obsidian
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1c1b1d'
  surface-container: '#201f22'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#313032'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#adc6ff'
  on-tertiary: '#002e6a'
  tertiary-container: '#71a1ff'
  on-tertiary-container: '#00367a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
typography:
  headline-lg:
    fontFamily: Geist Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Geist Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Geist Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar-width: 260px
  filter-pane-width: 320px
  gutter: 16px
  margin-page: 24px
  stack-xs: 4px
  stack-sm: 8px
  stack-md: 16px
---

## Brand & Style
The design system is engineered for **SafeVault**, a cryptographically hardened secrets manager. The brand personality is clinical, impenetrable, and high-performance. It evokes an emotional response of absolute security and digital "heaviness," suggesting that data is anchored in a physical-like vault.

The design style is **Minimalist-Technic**. It leverages an ultra-dark "Deep Obsidian" palette to reduce ocular strain and emphasize focused work. The aesthetic is characterized by:
- **Low Visual Noise:** Non-essential decorative elements are stripped away.
- **Precision Engineering:** Monospaced elements and tabular data alignment.
- **Controlled Glow:** Using light as a functional indicator of activity and security status rather than mere decoration.
- **Native Desktop Feel:** Mimicking high-end developer tools with compact density and high information per square inch.

## Colors
The palette is centered on the **Deep Obsidian Black (#09090b)** foundation. This creates a true-black environment where content floats on distinct layers of slate.

- **Primary (Electric Emerald):** Used strictly for "Safe" states, successful cryptographic confirmations, and active security timers.
- **Secondary (High-Contrast White):** Reserved for primary labels and high-priority content to ensure maximum legibility against the dark background.
- **Neutral (Muted Slates):** #141417 and #18181b provide the structural hierarchy for cards and sidebars.
- **Functional Accents:**
    - **Entropy Red (#ef4444):** Weak passwords.
    - **Entropy Orange (#f59e0b):** Moderate security.
    - **Interactive Blue (#3b82f6):** Focus states and primary action highlights.

## Typography
The system uses **Geist** as the primary typeface for its mathematical precision and neutral, developer-centric tone. **JetBrains Mono** is employed for all cryptographic hashes, recovery keys, and masked fields to ensure characters like '0' and 'O' are never confused.

- **Legibility:** All numeric displays must use **tabular figures** (tnum) to prevent shifting during real-time countdowns.
- **Hierarchy:** Use semantic labels (label-sm) in muted slate for metadata, reserving high-contrast white for the actual secret data.
- **Scale:** On mobile, `headline-lg` should scale down to 24px to maintain the compact, "pro-tool" density.

## Layout & Spacing
The layout follows a **Rigid Three-Column Grid** characteristic of desktop password managers:
1.  **Navigation Sidebar (Left):** Categories, Tags, and Settings.
2.  **Item List (Center):** Search results and filtered secrets.
3.  **Detail View (Right):** Expanded secret data, history, and edit controls.

**Spacing Rhythm:**
- A base 4px unit is used for all internal component padding.
- **Fluidity:** The center and right columns expand to fill the screen, while the sidebar remains at a fixed 260px width.
- **Breakpoints:** On tablet, the sidebar collapses into a drawer. On mobile, the interface moves to a stack navigation model (List -> Detail).

## Elevation & Depth
In this design system, depth is conveyed through **Tonal Layering** and **Subtle Outlines** rather than traditional shadows.

- **Base Layer:** #09090b (Full background).
- **Secondary Layer:** #141417 (Sidebar and List Pane).
- **Tertiary Layer:** #18181b (Detail View cards and Modals).
- **Borders:** All surfaces use a `1px` solid border of `slate-800/50`. This "hairline" aesthetic mimics the precision of high-end hardware.
- **Glow Effects:** The Master Unlock field and active 2FA rings utilize a `0px 0px 15px rgba(16, 185, 129, 0.2)` outer glow to signify a "Live" or "Unlocked" state.

## Shapes
The system uses **Soft (0.25rem)** roundedness to maintain a crisp, industrial feel while avoiding the harshness of sharp corners.

- **Small elements:** Checkboxes and small buttons use the base 4px radius.
- **Large elements:** Cards and the detail view pane use `rounded-lg` (8px) to create a subtle container distinction.
- **Inputs:** Use the base 4px radius to match the technical aesthetic of terminal windows.

## Components

### Master Unlock Input
The centerpiece of the application. It features a centered, large-scale input with a pulse animation. When focused, the Emerald Green glow intensifies.

### Masked Data Fields
Input fields for passwords and keys. They include:
- **Toggle Visibility:** An "eye" icon button on the right.
- **Quick Copy:** A clipboard icon that provides a brief "Copied!" tooltip in Emerald Green.
- **Font:** Always JetBrains Mono for the value.

### Entropy Gauges
Horizontal segmented bars (4 segments). 
- 1 segment: Red (#ef4444)
- 2-3 segments: Orange (#f59e0b)
- 4 segments: Emerald (#10b981)

### 2FA Progress Rings
Small circular SVG indicators that deplete clockwise as the 30-second window closes. The ring turns from Emerald to Red in the final 5 seconds.

### Navigation Sidebar
Transparent background with active states indicated by a 2px vertical Emerald strip on the left edge of the menu item and a subtle white text shift.

### Buttons
- **Primary:** Solid Electric Emerald with Black text.
- **Secondary:** Ghost style with `slate-800/50` border and White text.
- **Destructive:** Deep Red text with no background until hovered.