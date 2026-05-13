# Discord Clone

## Desktop Release Operations

The Electron client uses `electron-updater` with the GitHub release feed configured for `Killdroid2342/DiscordClone`. Build release installers with `npm run dist`; publish release assets from CI or with electron-builder's publish flow so the generated update metadata is available to packaged clients.

Runtime overrides:

- `MYDISCORD_UPDATE_URL`: use a generic HTTP(S) update feed instead of the packaged GitHub feed.
- `MYDISCORD_UPDATE_CHANNEL`: update channel name, defaulting to `latest`.
- `MYDISCORD_AUTO_UPDATE_ON_START=0`: disable the startup update check.
- `MYDISCORD_FORCE_UPDATE_CHECK=1`: allow updater UI testing from a development build with `dev-app-update.yml`.
- `MYDISCORD_CRASH_REPORT_URL`: enable native Crashpad minidump uploads.
- `MYDISCORD_ERROR_REPORT_URL`: enable JSON error report uploads. Without it, reports are saved to the app logs directory.
