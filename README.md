# SafeVaultPro

SafeVaultPro is a highly secure, offline-first local credentials manager designed to run as a native desktop application. It follows a strict security model where all cryptographic operations and data storage occur exclusively on the local machine.

---

## Key Features

*   **Offline-First & Local Cryptography:** Argon2id key derivation for master password validation and AES-256-GCM for encrypting item schemas locally.
*   **SQLCipher Local Database:** Secure, fully encrypted-at-rest SQLite data storage.
*   **Keymaster (TOTP Engine):** Built-in clock-synced 2FA verification code generation and countdown visualizer.
*   **Intelligent Browser Integration:**
    *   **IPC Bridge:** Local loopback HTTP server (`localhost:48920`) to serve secure queries, TOTP codes, and credentials.
    *   **Manifest V3 Extension:** Dynamic field detection, custom badge injectors, and autofill mechanisms.
*   **Screen-Capture OCR QR Scan:** Native screen area capture with local parsing of `otpauth://` QR codes.
*   **System Integrity Services:** Clipboard auto-clearing (30-second timeout), global hotkey listeners, and system tray integration.
*   **Deep Obsidian UI:** A custom-themed dark interface with glowing states, clean animations, and structured three-column navigation.


## Development & Build Commands

Before running, ensure you have [Bun](https://bun.sh) installed.

### 1. Install Dependencies
```bash
npm install
```

### 2. Development Mode
Run the application in watch mode:
```bash
npm run dev
```

For hot module replacement (HMR) during frontend view development:
```bash
npm run dev:hmr
```

### 3. Browser Extension Setup
The extension is available in `./src/extension`. To load it:
1. Open your browser's Extension Management page (`chrome://extensions` or equivalent).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `src/extension` directory.

### 4. Build and Package
To build the frontend assets:
```bash
npm run build
```

To compile and package the app for local execution:
```bash
npm run build:exe
```

##  Security Design Principles

1.  **Zero-Network Core:** Zero internet-facing analytics or storage syncing in the core application.
2.  **Encrypted-at-Rest Storage:** Data cannot be decrypted or read without the Argon2id-derived key from your master password.
3.  **Local Loopback IPC:** Communication between the browser extension and the desktop app is isolated to localhost with origin checks and request validation.
