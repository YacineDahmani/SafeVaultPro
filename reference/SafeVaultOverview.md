<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

## UX Overview

SafeVault is a privacy-first desktop experience for managing passwords, payment details, secure notes, and two-factor authentication codes without relying on a cloud account. Its UX prioritizes speed, discretion, and confidence: sensitive information is hidden by default, common actions such as copying or revealing a value are immediate, and security state is communicated through clear visual feedback rather than intrusive prompts. Masked credentials, reveal controls, visible focus states, and accessible keyboard interactions support secure handling without making routine tasks cumbersome.[^1]

## Tech Stack

SafeVault is built as a lightweight desktop application rather than a traditional Electron app, favoring a leaner runtime for speed and lower memory usage.

- **Runtime shell:** Electrobun, combining Bun and Zig for a fast, low-footprint native desktop wrapper.
- **UI layer:** React for component-driven interface logic and state management.
- **Styling:** Tailwind CSS for consistent, utility-based design tokens and rapid theming.
- **Local database:** SQLCipher for an encrypted-at-rest SQLite database.
- **Encryption:** AES-256-GCM for data encryption, paired with Argon2id for computationally expensive key derivation from the master password.
- **2FA engine:** Local TOTP calculation performed entirely on-device, with no external verification calls.
- **OCR/QR parsing:** A localized OCR module used to read otpauth:// URIs directly from on-screen QR codes.
- **Typography:** Geist Sans or Inter, chosen for geometric legibility, especially for numeric codes and hashes.
- **Background services:** Native Bun-based timers handling tasks like clipboard auto-clearing and system-tray behavior.


## Design Tokens \& Visual Theme

- **Base background:** Deep Obsidian Black (\#09090b) for seamless blending with dark-mode OS window chrome.
- **Surfaces/cards:** Muted Slate Gray (\#141417 / \#18181b) with ultra-thin, semi-transparent borders (border-slate-800/50) for subtle layer separation.
- **Primary text:** High-contrast white (\#fafafa).
- **Accent color:** Electric Emerald Green (\#10b981) for secure states, countdown timers, and confirmations.
- **Fonts:** Geist Sans or Inter, tuned for numeric passcodes and cryptographic strings.


## Core User Experience

The product is organized around four frequent user goals: unlock the vault securely, retrieve or manage stored secrets, generate strong passwords, and access time-based 2FA codes quickly. A dark, low-distraction interface helps minimize visual exposure in shared or public environments, while high-contrast typography makes codes and credentials easy to read at a glance.

Security-related actions use consistent feedback: emerald indicates success or a secure active state, blue indicates processing, and slate represents an idle or neutral state. Error states are direct and localized, helping users understand what happened without exposing sensitive information.

## Master Unlock Screen

The unlock screen is intentionally minimal and reveals no vault identity, account names, or branding that could leak information to someone nearby.

- A centered master-password field is the only primary control, with no visible username or logo.
- A subtle glowing aura communicates state: Slate (idle), Blue pulsing (processing), Emerald flash (success).
- Incorrect passwords trigger a physical shake animation on the input box.
- After three failed attempts, the input freezes with an exponential cooldown timer to deter brute-force attempts.
- Biometric unlock (hardware-accelerated) is available as a fast secondary path.


## 2FA Authenticator Screen ("The Keymaster")

This screen replaces the need for a separate mobile authenticator app, prioritizing frequently used MFA profiles in a dynamic dashboard.

- **Grid list:** Cards show provider name, account email, a large split six-digit code (e.g., 482 901), and an inline clipboard icon.
- **Progress tracker:** A circular stroke wheel or horizontal micro-bar shrinks uniformly from 30 seconds to 0, synced to the local clock.
- **Add Account toolbar:** A primary button opens options to "Scan QR Code from Screen" (native screenshot plus localized OCR to parse the otpauth:// URI) or "Enter Secret Key Manually."
- Clicking anywhere on a code card flashes it green and copies the code instantly.
- A native Bun timer clears the clipboard cache exactly 30 seconds after copying.


## Vault Entry Screen (Passwords \& Cards)

A dual-pane layout lets users browse entries in a middle pane while viewing full details in a right-hand workspace.

- **Contextual data cards:** Masked fields (- - - - - - - - - - - - ) for usernames, passwords, credit card numbers, and CVVs.
- **Action toggles:** Inline eye icons to reveal/hide field values, plus click-to-copy shortcuts on every field.
- **Audit sub-panel:** A bottom-anchored, read-only panel showing password length, entropy rating in bits, locally conducted breach-history checks, and a version history link for reverting past edits.


## Password Generator Panel

The generator slides in from the right side when creating or editing an entry, overlaying the workspace without pulling the user out of context.

- A large, randomized password preview line.
- Horizontal sliders to adjust character length smoothly between 6 and 64.
- Toggle switches for uppercase, lowercase, numbers, and special characters (@, \#, \$, etc.).
- Dragging the length slider recalculates entropy in real time, shifting a strength gauge from Red (weak) to Orange (moderate) to Emerald Green (strong).


## Advanced Settings \& Cryptographic Configuration

Settings are organized into three sub-tabs for clarity.

- **Security Parameters:** Auto-lock triggers (immediate on focus loss, after 1/5/15 minutes idle, or on system sleep), plus adjustable Argon2id sliders to trade off memory allocation against unlock speed.
- **Backup \& Data Portability:** Export buttons for heavily encrypted JSON backups using separate keys, and scheduler toggles for automated backups to custom local folders.
- **System Integration:** Toggle for background system-tray behavior, custom global unlock shortcuts (e.g., Ctrl + Alt + V), and on-demand memory clearing.


## Interaction Principles

- **Private by default:** Codes, passwords, card numbers, and account identifiers stay concealed until deliberately accessed.
- **Fast for repeated tasks:** Copy, search, reveal, generate, and lock require minimal steps.
- **Clear feedback:** Every sensitive action has an immediate, non-revealing confirmation.
- **Low interruption:** Security measures protect the vault while avoiding unnecessary confirmation dialogs for routine actions.
- **Accessible controls:** Keyboard navigation, visible focus indicators, readable contrast, and non-color-only status messaging throughout.[^1]
- **Predictable behavior:** Similar controls behave the same way across passwords, cards, notes, and 2FA entries.

<div align="center">⁂</div>

[^1]: https://uxpatterns.dev/patterns/forms/password

