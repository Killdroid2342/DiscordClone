const { app, BrowserWindow, ipcMain, nativeImage, Notification } = require('electron');
const path = require('node:path');

let mainWindow = null;
const unreadOverlayIcons = new Map();

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
  win.loadFile('./Pages/LogIn.html');
  win.removeMenu();
  win.on('focus', () => {
    win.flashFrame(false);
  });
  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
