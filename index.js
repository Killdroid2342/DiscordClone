const { app, BrowserWindow, ipcMain, nativeImage, Notification } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

let mainWindow = null;
let logFilePath = null;
const unreadOverlayIcons = new Map();
const consoleWriters = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
};

function getLogFilePath() {
  if (!logFilePath) {
    const logDir = app.getPath('logs');
    fs.mkdirSync(logDir, { recursive: true });
    logFilePath = path.join(logDir, 'main.log');
  }

  return logFilePath;
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

process.on('uncaughtException', (error) => {
  writeLog('error', 'Uncaught main-process exception', error);
});

process.on('unhandledRejection', (reason) => {
  writeLog('error', 'Unhandled main-process rejection', reason);
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

ipcMain.handle('diagnostics:renderer-error', (event, payload = {}) => {
  writeLog('error', 'Renderer diagnostic', {
    url: event.sender.getURL(),
    ...normalizeRendererDiagnostics(payload),
  });

  return { logged: true };
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
  win.webContents.on('render-process-gone', (event, details) => {
    writeLog('error', 'Renderer process exited unexpectedly', details);
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
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  writeLog('info', 'MyDiscord app shutting down');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
