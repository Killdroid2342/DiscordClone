# MyDiscord Client

The MyDiscord client is an Electron desktop app for the MyDiscord chat platform. It uses plain HTML, CSS, and JavaScript for the renderer, Webpack for the main home-screen bundle, SignalR for realtime chat, and REST calls to the ASP.NET Core API.

## Requirements

- Node.js 20 or newer.
- npm, included with Node.js.
- The MyDiscord server running locally or deployed to a reachable API URL.
- Windows when building the default NSIS installer target.

## Project Layout

| Path | Purpose |
| --- | --- |
| `Pages/` | Login, registration, and main application HTML screens. |
| `JS/` | Renderer-side application logic and API configuration. |
| `CSS/` | Shared theme and page-specific styles. |
| `assets/` | Images, fonts, and notification audio used by the app. |
| `index.js` | Electron main process, window creation, diagnostics, notifications, and updater wiring. |
| `preload.js` | Safe bridge between the renderer and Electron main process APIs. |
| `webpack.config.js` | Bundles `JS/Home.js` to `dist/main.js`. |
| `release/` | Generated package and installer output. This folder is created by packaging commands. |

## Local Setup

1. Install dependencies:

   ```powershell
   cd DiscordClone
   npm ci
   ```

2. Start the API from `DiscordCloneServer`. The default client configuration expects it at `http://localhost:5018`.

3. Confirm `JS/AppConfig.js` points at the API you want to use:

   ```js
   window.MYDISCORD_CONFIG = {
     apiBase: 'http://localhost:5018',
     cdnBase: '',
   };
   ```

4. Start the Electron app:

   ```powershell
   npm start
   ```

The app opens at `Pages/LogIn.html`. Register an account against the running API, then sign in and create or join servers from the client.

## Browser Smoke Testing

Electron is the supported client runtime, but the pages can also be served for quick browser smoke checks.

```powershell
cd DiscordClone
npx http-server -p 8080
```

Open `http://localhost:8080/Pages/LogIn.html`. Keep the API on `http://localhost:5018`; using a different frontend port avoids colliding with the backend.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Runs Electron through Nodemon for local development. |
| `npm run configure -- --api-base <url>` | Writes `JS/AppConfig.js` for a local or production API URL. |
| `npm run build` | Bundles the home-screen JavaScript into `dist/main.js`. |
| `npm run build:dev` | Bundles the home-screen JavaScript in development mode. |
| `npm test` | Runs the same build as the current client test gate. |
| `npm run package` | Builds the bundle and creates an unpacked Electron app in `release/`. |
| `npm run dist` | Builds the bundle and creates a Windows installer in `release/`. |

## Runtime Configuration

Renderer configuration lives in `JS/AppConfig.js`.

- `apiBase`: Base URL for the ASP.NET Core API, for example `http://localhost:5018` locally or `https://your-app.azurewebsites.net` in production.
- `cdnBase`: Optional CDN/static asset base URL. Leave empty to use API-hosted/static URLs.

Generate that file without hand-editing it:

```powershell
npm run configure -- --api-base https://your-app.azurewebsites.net
```

Electron main-process options are configured with environment variables:

| Variable | Purpose |
| --- | --- |
| `MYDISCORD_API_BASE` | Runtime override for the API URL when launching Electron. |
| `MYDISCORD_CDN_BASE` | Runtime override for the CDN/static asset base URL. |
| `MYDISCORD_UPDATE_URL` | Use a generic HTTP(S) update feed instead of the packaged GitHub release feed. |
| `MYDISCORD_UPDATE_CHANNEL` | Update channel name. Defaults to `latest`. |
| `MYDISCORD_AUTO_UPDATE_ON_START=0` | Disable the startup update check. |
| `MYDISCORD_FORCE_UPDATE_CHECK=1` | Allow updater UI testing from a development build with `dev-app-update.yml`. |
| `MYDISCORD_CRASH_REPORT_URL` | Enable native Crashpad minidump uploads. |
| `MYDISCORD_ERROR_REPORT_URL` | Enable JSON renderer/main-process diagnostic uploads. Without this, diagnostics are saved locally. |

## Packaging And Deployment

Before packaging for users, point `JS/AppConfig.js` at the production API. Then build the installer:

```powershell
cd DiscordClone
npm ci
npm run configure -- --api-base https://your-app.azurewebsites.net
npm run dist
```

Installer output is written to `DiscordClone/release`. The packaged app is configured for `electron-updater` with the GitHub release feed for `Killdroid2342/DiscordClone`; publish the generated installer and update metadata from CI or with electron-builder's publish flow.

The current Windows packaging config disables executable signing:

```json
"win": {
  "target": "nsis",
  "signAndEditExecutable": false
}
```

Enable signing before distributing to production users if you have a code-signing certificate.

## QA Checklist

Run these checks before handing off a client build:

```powershell
cd DiscordClone
npm ci
npm run build
npm test
npm run package
```

Manual smoke checks:

- Start the server and sign in with a real test account.
- Register a new account and confirm login still works after app restart.
- Create a server, send a channel message, react, and confirm realtime updates.
- Add a friend and send a private message.
- Check desktop notification, unread badge, settings, diagnostics, and update status UI.
- Run a browser smoke test when changing shared page or renderer code.
- Prefer the GitHub Actions `Build Desktop Client` workflow for release installers so the production API URL is captured in the build logs.

## Troubleshooting

- If login fails immediately, verify the API is running and `apiBase` points to the correct URL.
- If browser testing is blocked by CORS, serve the frontend from `localhost` or `127.0.0.1`; the API allows loopback origins in development.
- If updates show as disabled in development, set `MYDISCORD_FORCE_UPDATE_CHECK=1` and provide a valid `dev-app-update.yml` or `MYDISCORD_UPDATE_URL`.
- Renderer and main-process diagnostics are written under Electron's app logs directory as `main.log` and `diagnostics.jsonl`.

For full deployment infrastructure, Azure provisioning, backups, health checks, and load testing, see `../DEPLOYMENT.md`.
