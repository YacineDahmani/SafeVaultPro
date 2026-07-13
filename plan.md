# Implementation Plan: SafeVaultPro

This document outlines the structured implementation plan for the **SafeVaultPro** desktop application. All implementation phases must strictly follow the architectural specifications, user experience requirements, and coding guidelines defined across the project documentation.

---

## 1. Project Structure

The codebase is organized as follows:

```text
SafeVaultPro/
├── plan.md                 # Project implementation plan (this file)
├── reference/              # Project references and requirements
│   ├── DESIGN.md           # UI design quality guidelines and aesthetic standards
│   ├── Logic.md            # Behavioral guidelines to prevent LLM mistakes
│   ├── SafeVaultDesign.md  # SafeVault-specific colors, typography, layout, and components
│   └── SafeVaultOverview.md # Feature overview, technology stack, and user experience
└── src/                    # Application source code
    ├── bun/                # Backend / main process (running in Bun)
    │   ├── crypto/         # Cryptography utils (Argon2id, AES-GCM)
    │   ├── db/             # Local database connector (SQLCipher)
    │   ├── ocr/            # Native screen-scanning and QR OCR
    │   ├── services/       # Clipboard clear, global hotkeys
    │   ├── totp/           # Local TOTP generation logic
    │   └── index.ts        # Main process entry point
    └── mainview/           # Frontend UI (React + Vite)
        ├── components/     # Reusable UI widgets (glowing inputs, progress rings)
        ├── hooks/          # Shared custom React hooks
        ├── styles/         # Global colors and Tailwind definitions
        ├── views/          # Main application screens (Unlock, Dashboard, Settings)
        ├── App.tsx         # Root layout component
        └── main.tsx        # View mount point
```

---

## 2. Reference Foundation

To ensure consistency, security, and exceptional user experience, developers must strictly adhere to the following referenced source documents:

### Functional & Technical Architecture
*   **[SafeVaultOverview.md](file:///d:/repos/SafeVaultPro/reference/SafeVaultOverview.md)**: Defines the core runtime shell (Electrobun), local database (SQLCipher), encryption standards (AES-256-GCM & Argon2id), 2FA TOTP engine, and OCR/QR code parsing logic.

### UI & Styling System
*   **[SafeVaultDesign.md](file:///d:/repos/SafeVaultPro/reference/SafeVaultDesign.md)**: The technical design system specification detailing the "Deep Obsidian" color palette, typography scales, rigid three-column spatial layout, and custom component behaviors (Entropy Gauges, 2FA Rings, and Master Unlock glow effects).
*   **[DESIGN.md](file:///d:/repos/SafeVaultPro/reference/DESIGN.md)**: The UI design quality manifesto. Avoid generic "AI-slop" aesthetics. Commit to bold, intentional, and high-performance design patterns, including custom fonts, subtle grain/noise textures, CSS animations, and precise layout compositions.

### Coding & Engineering Guidelines
*   **[Logic.md](file:///d:/repos/SafeVaultPro/reference/Logic.md)**: The programmatic behavioral guidelines. Bias toward caution, simplicity, surgical changes, and goal-driven execution with verifiable criteria.

---

## 3. Technical Stack & Architecture

*   **Runtime Shell:** Electrobun (Bun + Zig wrapper) for lightweight, low-memory native desktop operations.
*   **Frontend UI:** React with Tailwind CSS for utility-based styling, paired with custom CSS variables representing the Deep Obsidian palette.
*   **Storage Layer:** Local SQLite database encrypted at rest via SQLCipher.
*   **Cryptographic Operations:** On-device AES-256-GCM encryption and Argon2id key derivation.
*   **Authenticating Engine:** Local, clock-synced TOTP verification.
*   **OCR Module:** Local screen-capture OCR parsing for `otpauth://` QR codes.

---

## 4. Implementation Phases

### Phase 1: Local Database & Cryptographic Infrastructure (Core Logic)
> [!IMPORTANT]
> All cryptographic operations must run strictly locally. Follow the guidelines in **[Logic.md](file:///d:/repos/SafeVaultPro/reference/Logic.md)**: keep implementations simple and testable.

*   **Task 1.1:** Setup SQLCipher local database file and integration with Electrobun runtime.
*   **Task 1.2:** Implement Argon2id key derivation function for the master password.
*   **Task 1.3:** Build AES-256-GCM encryption/decryption utilities for securing vault entry payloads.
*   **Task 1.4:** Build local TOTP generation engine.
*   **Verification:** Write automated unit tests verifying encryption/decryption roundtrips, key derivation speed vs. safety, and TOTP output matching standard reference vectors.

### Phase 2: Shell Integration & Background Services
*   **Task 2.1:** Implement clipboard auto-clearing mechanism (clears copied secrets after exactly 30 seconds).
*   **Task 2.2:** Setup native Bun-based background timers and system tray integration.
*   **Task 2.3:** Build global hotkey register (e.g., `Ctrl + Alt + V`) for quick vault access.
*   **Verification:** Verify tray minimizations and ensure clipboard cleanup functions as expected.

### Phase 3: Shell & UI Integration (Aesthetic & Interface Setup)
> [!IMPORTANT]
> Follow **[DESIGN.md](file:///d:/repos/SafeVaultPro/reference/DESIGN.md)** to establish a premium, developer-centric interface. Avoid generic layouts. Implement the exact theme specs from **[SafeVaultDesign.md](file:///d:/repos/SafeVaultPro/reference/SafeVaultDesign.md)**.

*   **Task 3.1:** Embed custom fonts: **Geist Sans** (primary typeface) and **JetBrains Mono** (for hashes, recovery keys, and secret values).
*   **Task 3.2:** Configure Tailwind CSS with the Deep Obsidian theme color tokens (e.g., `#09090b` base, Electric Emerald `#10b981`, and hair-line border definitions).
*   **Task 3.3:** Build the rigid 3-Column main workspace layout (Sidebar, Item List, Details Pane).

### Phase 4: Frontend Views & Animations
*   **Task 4.1: Master Unlock Screen**
    *   Implement centered password input.
    *   Add glowing aura animations (Slate -> Blue -> Emerald).
    *   Add physical shake animation on failed attempt and brute-force cool-down lock.
*   **Task 4.2: Vault Entries & Details Pane**
    *   Render dual-pane workspace.
    *   Create masked fields using JetBrains Mono with toggle-to-reveal eye icons and one-click copy tooltips.
    *   Integrate Entropy Gauges (4 segments: Red/Orange/Emerald) and the audit sub-panel.
*   **Task 4.3: 2FA Authenticator ("The Keymaster")**
    *   Implement circular or horizontal progress indicators tracking the 30-second window.
    *   Build manual import forms and integrate screen-scanning OCR capabilities.
*   **Task 4.4: Password Generator Pane**
    *   Create slide-over panel with length/character set controls recalculating entropy ratings in real time.

---

## 5. Design Guidelines Checklist (UI/UX)
- [ ] Use **Geist Sans** and **JetBrains Mono** instead of default system fonts.
- [ ] Ensure all countdown timers and numeric secrets use `tnum` (tabular figures) to avoid layout shifts.
- [ ] Implement subtle `slate-800/50` hairline borders (`1px`) for card and layer separation.
- [ ] Apply the `0px 0px 15px rgba(16, 185, 129, 0.2)` outer glow strictly to active or unlocked interactive components.
- [ ] Mask all credentials by default; never expose values unless requested by user interaction.

---

## 6. Coding Guidelines Checklist (Logic)
- [ ] Explicitly state technical tradeoffs; do not silently decide design/architectural ambiguities.
- [ ] Keep implementations as minimal as possible—no speculative or unused features.
- [ ] Perform surgical edits. Only touch necessary files and match the existing surrounding code style.
- [ ] Write reproducible tests for every new feature or bug fix.
