const { app, BrowserWindow, ipcMain, nativeImage, Notification, crashReporter } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

let mainWindow = null;
let logFilePath = null;
let diagnosticFilePath = null;
let crashReporterStarted = false;
let crashReporterStartError = null;
let lastErrorReport = null;
let updaterInitialized = false;
let updateCheckPromise = null;
let updateDownloadPromise = null;
const unreadOverlayIcons = new Map();
const consoleWriters = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
};
const updateState = {
  enabled: false,
  phase: 'disabled',
  channel: 'latest',
  currentVersion: app.getVersion(),
  feedConfigured: false,
  feedUrl: '',
  message: 'Update checks are not configured.',
  checkedAt: null,
  updateInfo: null,
  progress: null,
  error: null,
};

function getLogFilePath() {
  if (!logFilePath) {
    const logDir = app.getPath('logs');
    fs.mkdirSync(logDir, { recursive: true });
    logFilePath = path.join(logDir, 'main.log');
  }

  return logFilePath;
}

function getDiagnosticFilePath() {
  if (!diagnosticFilePath) {
    const logDir = app.getPath('logs');
    fs.mkdirSync(logDir, { recursive: true });
    diagnosticFilePath = path.join(logDir, 'diagnostics.jsonl');
  }

  return diagnosticFilePath;
}

function formatLogValue(value) {
  if (value instanceof Error) {
    return value.stack || value.message;
  }

  if (typeof value === 'string') {
    return value;
  }

  return util.inspect(value, { depth: 4, breakLength: 120 });
}

function writeLog(level, ...values) {
  const safeLevel = level === 'error' || level === 'warn' ? level : 'info';
  const message = values.map(formatLogValue).join(' ');
  const line = `${new Date().toISOString()} ${safeLevel.toUpperCase()} ${message}\n`;

  try {
    fs.appendFileSync(getLogFilePath(), line, 'utf8');
  } catch (error) {
    consoleWriters.warn('Could not write MyDiscord log file:', error);
  }

  consoleWriters[safeLevel](...values);
}

function cleanLogText(value, fallback, maxLength) {
  return String(value || fallback || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeRendererDiagnostics(payload = {}) {
  return {
    type: cleanLogText(payload.type, 'renderer-error', 80),
    message: cleanLogText(payload.message, 'Unknown renderer error', 500),
    source: cleanLogText(payload.source, '', 500),
    stack: cleanLogText(payload.stack, '', 2000),
    line: Number.isFinite(Number(payload.line)) ? Number(payload.line) : null,
    column: Number.isFinite(Number(payload.column)) ? Number(payload.column) : null,
  };
}

function cleanOptionalUrl(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  try {
    const parsedUrl = new URL(text);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return '';
    }

    return parsedUrl.toString();
  } catch {
    return '';
  }
}

function getCrashReportSubmitUrl() {
  return cleanOptionalUrl(process.env.MYDISCORD_CRASH_REPORT_URL);
}

function getErrorReportSubmitUrl() {
  return cleanOptionalUrl(process.env.MYDISCORD_ERROR_REPORT_URL);
}

function getUpdateFeedUrl() {
  return cleanOptionalUrl(process.env.MYDISCORD_UPDATE_URL);
}

function getUpdateChannel() {
  return cleanLogText(process.env.MYDISCORD_UPDATE_CHANNEL, 'latest', 40).toLowerCase() || 'latest';
}

function sanitizeReportValue(value, depth = 0) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Error) {
    return {
      name: cleanLogText(value.name, 'Error', 80),
      message: cleanLogText(value.message, 'Unknown error', 500),
      stack: cleanLogText(value.stack, '', 4000),
    };
  }

  if (typeof value === 'string') {
    return cleanLogText(value, '', 1200);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (depth >= 3) {
    return cleanLogText(formatLogValue(value), '', 1200);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeReportValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 30)
        .map(([key, entryValue]) => [
          cleanLogText(key, 'field', 80),
          sanitizeReportValue(entryValue, depth + 1),
        ])
    );
  }

  return cleanLogText(String(value), '', 1200);
}

function createDiagnosticReport(payload = {}, context = {}) {
  const error = payload.error instanceof Error ? payload.error : null;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform,
    arch: process.arch,
    process: cleanLogText(context.process || payload.process, 'renderer', 40),
    type: cleanLogText(payload.type || error?.name, 'error', 80),
    message: cleanLogText(payload.message || error?.message, 'Unknown error', 500),
    source: cleanLogText(payload.source || context.source, '', 500),
    url: cleanLogText(payload.url || context.url, '', 500),
    stack: cleanLogText(payload.stack || error?.stack, '', 4000),
    line: Number.isFinite(Number(payload.line)) ? Number(payload.line) : null,
    column: Number.isFinite(Number(payload.column)) ? Number(payload.column) : null,
    details: sanitizeReportValue(payload.details || context.details || {}),
  };
}

function appendDiagnosticReport(report) {
  try {
    fs.appendFileSync(getDiagnosticFilePath(), `${JSON.stringify(report)}\n`, 'utf8');
  } catch (error) {
    writeLog('warn', 'Could not write MyDiscord diagnostics file:', error);
  }
}

async function submitDiagnosticReport(report) {
  const submitUrl = getErrorReportSubmitUrl();
  if (!submitUrl) {
    return { submitted: false, reason: 'not-configured' };
  }

  if (typeof fetch !== 'function') {
    return { submitted: false, reason: 'fetch-unavailable' };
  }

  const response = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-mydiscord-version': app.getVersion(),
    },
    body: JSON.stringify(report),
  });

  if (!response.ok) {
    throw new Error(`Error report upload failed with HTTP ${response.status}`);
  }

  return { submitted: true, status: response.status };
}

async function recordDiagnosticReport(payload = {}, context = {}) {
  const report = createDiagnosticReport(payload, context);
  appendDiagnosticReport(report);
  lastErrorReport = {
    id: report.id,
    timestamp: report.timestamp,
    type: report.type,
    message: report.message,
    submitted: false,
  };

  try {
    const submitResult = await submitDiagnosticReport(report);
    lastErrorReport = {
      ...lastErrorReport,
      ...submitResult,
    };

    return { logged: true, report: lastErrorReport, ...submitResult };
  } catch (error) {
    const uploadError = cleanLogText(error.message, 'Upload failed', 500);
    lastErrorReport = {
      ...lastErrorReport,
      submitted: false,
      uploadError,
    };
    writeLog('warn', 'Could not upload MyDiscord error report:', error);
    return { logged: true, submitted: false, uploadError, report: lastErrorReport };
  }
}

function startCrashReporter() {
  const submitURL = getCrashReportSubmitUrl();
  const options = {
    productName: 'MyDiscord',
    uploadToServer: Boolean(submitURL),
    compress: true,
    globalExtra: {
      appVersion: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      updateChannel: getUpdateChannel(),
    },
  };

  if (submitURL) {
    options.submitURL = submitURL;
  }

  try {
    crashReporter.start(options);
    crashReporterStarted = true;
  } catch (error) {
    crashReporterStartError = cleanLogText(error.message, 'Crash reporter failed to start', 500);
    consoleWriters.warn('Could not start MyDiscord crash reporter:', error);
  }
}

function cleanCrashReport(report) {
  if (!report) {
    return null;
  }

  return {
    id: cleanLogText(report.id, '', 120),
    date: report.date instanceof Date ? report.date.toISOString() : cleanLogText(report.date, '', 80),
  };
}

function getDiagnosticsStatus() {
  let uploadToServer = false;
  let lastCrashReport = null;
  let uploadedCrashReportCount = 0;

  if (crashReporterStarted) {
    try {
      uploadToServer = Boolean(crashReporter.getUploadToServer());
      lastCrashReport = cleanCrashReport(crashReporter.getLastCrashReport());
      uploadedCrashReportCount = crashReporter.getUploadedReports().length;
    } catch (error) {
      writeLog('warn', 'Could not read crash reporter status:', error);
    }
  }

  return {
    crashReporter: {
      started: crashReporterStarted,
      uploadToServer,
      submitUrlConfigured: Boolean(getCrashReportSubmitUrl()),
      startError: crashReporterStartError,
      lastCrashReport,
      uploadedCrashReportCount,
    },
    errorReporting: {
      remoteConfigured: Boolean(getErrorReportSubmitUrl()),
      logFilePath: getLogFilePath(),
      diagnosticFilePath: getDiagnosticFilePath(),
      lastReport: lastErrorReport,
    },
  };
}

function getUpdaterConfigPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath || '', 'app-update.yml');
  }

  return path.join(__dirname, 'dev-app-update.yml');
}

function getUpdaterAvailability() {
  const feedUrl = getUpdateFeedUrl();
  const configPath = getUpdaterConfigPath();
  const hasBundledConfig = Boolean(configPath && fs.existsSync(configPath));
  const forcedDev = process.env.MYDISCORD_FORCE_UPDATE_CHECK === '1';

  if (!app.isPackaged && !forcedDev) {
    return {
      enabled: false,
      feedUrl,
      feedConfigured: Boolean(feedUrl || hasBundledConfig),
      reason: 'Update checks run from packaged builds.',
    };
  }

  if (!feedUrl && !hasBundledConfig) {
    return {
      enabled: false,
      feedUrl,
      feedConfigured: false,
      reason: 'Update feed is not configured.',
    };
  }

  return {
    enabled: true,
    feedUrl,
    feedConfigured: true,
    reason: '',
  };
}

function cleanUpdateInfo(info = {}) {
  return {
    version: cleanLogText(info.version, '', 80),
    releaseName: cleanLogText(info.releaseName, '', 160),
    releaseDate: cleanLogText(info.releaseDate, '', 80),
    releaseNotes: cleanLogText(formatLogValue(info.releaseNotes || ''), '', 2000),
  };
}

function cleanUpdateProgress(progress = {}) {
  return {
    percent: Number.isFinite(Number(progress.percent)) ? Math.max(0, Math.min(100, Number(progress.percent))) : 0,
    bytesPerSecond: Math.max(0, Number(progress.bytesPerSecond) || 0),
    transferred: Math.max(0, Number(progress.transferred) || 0),
    total: Math.max(0, Number(progress.total) || 0),
  };
}

function getUpdateStateMessage(state = updateState) {
  if (state.phase === 'disabled') {
    return state.error || state.message || 'Update checks are disabled.';
  }

  if (state.phase === 'checking') {
    return 'Checking for updates...';
  }

  if (state.phase === 'available') {
    return state.updateInfo?.version
      ? `Version ${state.updateInfo.version} is available.`
      : 'An update is available.';
  }

  if (state.phase === 'downloading') {
    const percent = Math.round(state.progress?.percent || 0);
    return `Downloading update${percent ? ` (${percent}%)` : ''}...`;
  }

  if (state.phase === 'downloaded') {
    return 'Update downloaded and ready to install.';
  }

  if (state.phase === 'up-to-date') {
    return 'MyDiscord is up to date.';
  }

  if (state.phase === 'error') {
    return state.error || 'Update check failed.';
  }

  return 'Ready to check for updates.';
}

function getPublicUpdateStatus() {
  const busy = updateState.phase === 'checking' || updateState.phase === 'downloading';
  return {
    enabled: updateState.enabled,
    phase: updateState.phase,
    channel: updateState.channel,
    currentVersion: app.getVersion(),
    feedConfigured: updateState.feedConfigured,
    message: getUpdateStateMessage(),
    checkedAt: updateState.checkedAt,
    updateInfo: updateState.updateInfo,
    progress: updateState.progress,
    error: updateState.error,
    canCheck: updateState.enabled && !busy,
    canDownload: updateState.enabled && updateState.phase === 'available',
    canInstall: updateState.enabled && updateState.phase === 'downloaded',
  };
}

function broadcastUpdateState() {
  if (!app.isReady()) {
    return;
  }

  const status = getPublicUpdateStatus();
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('app-updates:status', status);
    }
  });
}

function applyUpdateState(patch = {}) {
  Object.assign(updateState, patch, {
    channel: getUpdateChannel(),
    currentVersion: app.getVersion(),
  });
  updateState.message = getUpdateStateMessage();
  broadcastUpdateState();
  return getPublicUpdateStatus();
}

function configureAutoUpdater() {
  if (updaterInitialized) {
    return getPublicUpdateStatus();
  }

  updaterInitialized = true;
  const availability = getUpdaterAvailability();
  updateState.enabled = availability.enabled;
  updateState.feedConfigured = availability.feedConfigured;
  updateState.feedUrl = availability.feedUrl;
  updateState.channel = getUpdateChannel();

  autoUpdater.logger = {
    debug: (...values) => writeLog('info', '[auto-update]', ...values),
    info: (...values) => writeLog('info', '[auto-update]', ...values),
    warn: (...values) => writeLog('warn', '[auto-update]', ...values),
    error: (...values) => writeLog('error', '[auto-update]', ...values),
  };
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  if (process.env.MYDISCORD_FORCE_UPDATE_CHECK === '1') {
    autoUpdater.forceDevUpdateConfig = true;
  }

  if (updateState.channel !== 'latest') {
    autoUpdater.channel = updateState.channel;
  }

  if (availability.feedUrl) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: availability.feedUrl,
      channel: updateState.channel,
    });
  }

  autoUpdater.on('checking-for-update', () => {
    applyUpdateState({
      phase: 'checking',
      checkedAt: new Date().toISOString(),
      progress: null,
      error: null,
    });
  });

  autoUpdater.on('update-available', (info) => {
    applyUpdateState({
      phase: 'available',
      updateInfo: cleanUpdateInfo(info),
      progress: null,
      error: null,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    applyUpdateState({
      phase: 'up-to-date',
      checkedAt: new Date().toISOString(),
      updateInfo: cleanUpdateInfo(info),
      progress: null,
      error: null,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    applyUpdateState({
      phase: 'downloading',
      progress: cleanUpdateProgress(progress),
      error: null,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    applyUpdateState({
      phase: 'downloaded',
      updateInfo: cleanUpdateInfo(info),
      progress: null,
      error: null,
    });
  });

  autoUpdater.on('error', (error) => {
    applyUpdateState({
      phase: 'error',
      progress: null,
      error: cleanLogText(error.message, 'Update check failed', 500),
    });
    recordDiagnosticReport(
      {
        type: 'auto-update-error',
        message: error.message,
        stack: error.stack,
      },
      { process: 'main' }
    ).catch(() => {});
  });

  if (!availability.enabled) {
    return applyUpdateState({
      phase: 'disabled',
      message: availability.reason,
      error: null,
    });
  }

  return applyUpdateState({
    phase: 'idle',
    message: 'Ready to check for updates.',
    error: null,
  });
}

async function checkForUpdates(trigger = 'manual') {
  configureAutoUpdater();

  if (!updateState.enabled) {
    return getPublicUpdateStatus();
  }

  if (updateCheckPromise) {
    return updateCheckPromise;
  }

  writeLog('info', 'Checking for app updates', { trigger, channel: updateState.channel });
  updateCheckPromise = autoUpdater
    .checkForUpdates()
    .then(() => getPublicUpdateStatus())
    .catch((error) => {
      writeLog('warn', 'App update check failed:', error);
      return applyUpdateState({
        phase: 'error',
        error: cleanLogText(error.message, 'Update check failed', 500),
      });
    })
    .finally(() => {
      updateCheckPromise = null;
    });

  return updateCheckPromise;
}

async function downloadAvailableUpdate() {
  configureAutoUpdater();

  if (!updateState.enabled || updateState.phase !== 'available') {
    return getPublicUpdateStatus();
  }

  if (updateDownloadPromise) {
    return updateDownloadPromise;
  }

  writeLog('info', 'Downloading app update');
  updateDownloadPromise = autoUpdater
    .downloadUpdate()
    .then(() => getPublicUpdateStatus())
    .catch((error) => {
      writeLog('warn', 'App update download failed:', error);
      return applyUpdateState({
        phase: 'error',
        progress: null,
        error: cleanLogText(error.message, 'Update download failed', 500),
      });
    })
    .finally(() => {
      updateDownloadPromise = null;
    });

  return updateDownloadPromise;
}

function installDownloadedUpdate() {
  configureAutoUpdater();

  if (!updateState.enabled || updateState.phase !== 'downloaded') {
    return { ...getPublicUpdateStatus(), installStarted: false };
  }

  writeLog('info', 'Installing downloaded app update');
  setTimeout(() => {
    autoUpdater.quitAndInstall(false, true);
  }, 100);

  return { ...getPublicUpdateStatus(), installStarted: true };
}

startCrashReporter();

process.on('uncaughtException', (error) => {
  writeLog('error', 'Uncaught main-process exception', error);
  recordDiagnosticReport(
    {
      type: 'uncaught-exception',
      message: error.message,
      stack: error.stack,
      error,
    },
    { process: 'main' }
  ).catch(() => {});
});

process.on('unhandledRejection', (reason) => {
  writeLog('error', 'Unhandled main-process rejection', reason);
  recordDiagnosticReport(
    {
      type: 'unhandled-rejection',
      message: reason?.message || String(reason || 'Unhandled rejection'),
      stack: reason?.stack,
      details: { reason },
    },
    { process: 'main' }
  ).catch(() => {});
});

function cleanNotificationText(value, fallback, maxLength) {
  const text = String(value || fallback || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function focusWindow(win) {
  if (!win || win.isDestroyed()) {
    return;
  }

  if (win.isMinimized()) {
    win.restore();
  }

  win.show();
  win.focus();
  win.flashFrame(false);
}

function getUnreadOverlayIcon(count) {
  const unreadCount = Math.max(1, Math.min(99, Number(count) || 1));
  const label = unreadCount > 99 ? '99+' : String(unreadCount);
  if (!unreadOverlayIcons.has(label)) {
    const fontSize = label.length > 2 ? 12 : label.length > 1 ? 14 : 16;
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">',
      '<circle cx="16" cy="16" r="15" fill="#ed4245"/>',
      '<circle cx="16" cy="16" r="15" fill="none" stroke="#ffffff" stroke-width="2"/>',
      `<text x="16" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#ffffff">${label}</text>`,
      '</svg>',
    ].join('');
    unreadOverlayIcons.set(
      label,
      nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
    );
  }

  const overlayIcon = unreadOverlayIcons.get(label);
  return overlayIcon && !overlayIcon.isEmpty() ? overlayIcon : null;
}

function setUnreadBadge(win, count) {
  const unreadCount = Math.max(0, Math.min(99, Number(count) || 0));
  app.setBadgeCount(unreadCount);

  if (!win || win.isDestroyed() || process.platform !== 'win32') {
    return;
  }

  if (unreadCount === 0) {
    win.setOverlayIcon(null, '');
    return;
  }

  const overlayIcon = getUnreadOverlayIcon(unreadCount);
  if (overlayIcon) {
    win.setOverlayIcon(
      overlayIcon,
      `${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}`
    );
  }
}

ipcMain.handle('desktop-notifications:show', (event, payload = {}) => {
  if (
    !Notification ||
    (typeof Notification.isSupported === 'function' && !Notification.isSupported())
  ) {
    return { shown: false, reason: 'unsupported' };
  }

  const sourceWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const notification = new Notification({
    title: cleanNotificationText(payload.title, 'MyDiscord', 80),
    body: cleanNotificationText(payload.body, 'New activity', 180),
    icon: path.join(__dirname, 'assets/img/titlePic.png'),
    silent: Boolean(payload.silent),
  });

  notification.on('click', () => {
    focusWindow(sourceWindow);
  });

  notification.show();

  if (payload.flash && sourceWindow && !sourceWindow.isDestroyed()) {
    sourceWindow.flashFrame(true);
  }

  return { shown: true };
});

ipcMain.handle('desktop-notifications:set-unread-count', (event, count) => {
  setUnreadBadge(BrowserWindow.fromWebContents(event.sender) || mainWindow, count);
  return { unreadCount: Math.max(0, Number(count) || 0) };
});

ipcMain.handle('desktop-notifications:stop-flashing', (event) => {
  const sourceWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (sourceWindow && !sourceWindow.isDestroyed()) {
    sourceWindow.flashFrame(false);
  }

  return { stopped: true };
});

ipcMain.handle('diagnostics:renderer-error', async (event, payload = {}) => {
  const normalizedPayload = normalizeRendererDiagnostics(payload);
  writeLog('error', 'Renderer diagnostic', {
    url: event.sender.getURL(),
    ...normalizedPayload,
  });

  return recordDiagnosticReport(normalizedPayload, {
    process: 'renderer',
    url: event.sender.getURL(),
  });
});

ipcMain.handle('diagnostics:get-status', () => getDiagnosticsStatus());

ipcMain.handle('diagnostics:test-error-report', (event) => {
  writeLog('warn', 'Manual diagnostics test report requested');
  return recordDiagnosticReport(
    {
      type: 'manual-test-report',
      message: 'Manual diagnostics test report',
      source: event.sender.getURL(),
    },
    {
      process: 'renderer',
      url: event.sender.getURL(),
    }
  );
});

ipcMain.handle('app-updates:get-status', () => {
  configureAutoUpdater();
  return getPublicUpdateStatus();
});

ipcMain.handle('app-updates:check', () => checkForUpdates('manual'));

ipcMain.handle('app-updates:download', () => downloadAvailableUpdate());

ipcMain.handle('app-updates:install', () => installDownloadedUpdate());

ipcMain.handle('app-updates:refresh-status', () => {
  configureAutoUpdater();
  return applyUpdateState({});
});

function createWindow() {
  const win = new BrowserWindow({
    minWidth: 420,
    minHeight: 560,
    width: 1280,
    height: 800,
    backgroundColor: '#313338',
    icon: path.join(__dirname, 'assets/img/titlePic.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow = win;
  writeLog('info', 'Creating main window');
  win.loadFile('./Pages/LogIn.html');
  win.removeMenu();
  win.on('focus', () => {
    win.flashFrame(false);
  });
  win.on('unresponsive', () => {
    writeLog('warn', 'Main window became unresponsive');
  });
  win.on('responsive', () => {
    writeLog('info', 'Main window became responsive');
  });
  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    writeLog('error', 'Window failed to load', {
      errorCode,
      errorDescription,
      validatedURL,
    });
  });
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('app-updates:status', getPublicUpdateStatus());
  });
  win.webContents.on('render-process-gone', (event, details) => {
    writeLog('error', 'Renderer process exited unexpectedly', details);
    recordDiagnosticReport(
      {
        type: 'render-process-gone',
        message: details.reason || 'Renderer process exited unexpectedly',
        details,
      },
      {
        process: 'renderer',
        url: win.webContents.getURL(),
      }
    ).catch(() => {});
  });
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level < 2) {
      return;
    }

    writeLog(level >= 3 ? 'error' : 'warn', 'Renderer console message', {
      message,
      line,
      sourceId,
    });
  });
}

app.whenReady().then(() => {
  writeLog('info', 'MyDiscord app ready', {
    version: app.getVersion(),
    logFilePath: getLogFilePath(),
  });
  configureAutoUpdater();
  createWindow();

  if (updateState.enabled && process.env.MYDISCORD_AUTO_UPDATE_ON_START !== '0') {
    setTimeout(() => {
      checkForUpdates('startup').catch((error) => {
        writeLog('warn', 'Startup update check failed:', error);
      });
    }, 5000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('child-process-gone', (event, details) => {
  writeLog('error', 'Electron child process exited unexpectedly', details);
  recordDiagnosticReport(
    {
      type: 'child-process-gone',
      message: details.reason || 'Electron child process exited unexpectedly',
      details,
    },
    { process: details.type || 'child' }
  ).catch(() => {});
});

app.on('before-quit', () => {
  writeLog('info', 'MyDiscord app shutting down');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
