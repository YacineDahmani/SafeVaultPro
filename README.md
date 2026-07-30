# SafeVaultPro

SafeVaultPro is a native desktop credentials manager with browser extension integration, built for local security and low power consumption.

## Features

- Local Security: Password generation, encrypted vault storage, and Argon2id key derivation performed entirely offline.
- TOTP Authenticator: Real-time 6-digit TOTP code generation with countdown timer.
- Browser Extension Bridge: Native HTTP bridge on port 48920 for Chrome, Edge, Brave, and Firefox field detection and autofill.
- Power Efficiency: Automatic low-power idle state when minimized to minimize CPU and RAM usage.

## Development Commands

```bash
# Install dependencies
npm install

# Start development mode
npm run dev

# Build release executable package
npm run package:release
```

## Production Release

Running `npm run package:release` generates:
- Release Folder: `release/SafeVaultPro-v1.0.0-win-x64/`
- Desktop Executable: `release/SafeVaultPro-v1.0.0-win-x64/SafeVaultPro.exe`
- Distribution Zip: `release/SafeVaultPro-v1.0.0-win-x64.zip`
