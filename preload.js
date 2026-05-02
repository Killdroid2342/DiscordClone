const { contextBridge, ipcRenderer } = require('electron');

function cleanDiagnosticText(value, fallback, maxLength) {
  return String(value || fallback || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanNotificationPayload(payload = {}) {
  return {
    title: String(payload.title || 'MyDiscord').slice(0, 120),
    body: String(payload.body || 'New activity').slice(0, 240),
    silent: Boolean(payload.silent),
    flash: Boolean(payload.flash),
  };
}

function reportRendererDiagnostic(payload = {}) {
  return ipcRenderer.invoke('diagnostics:renderer-error', {
    type: cleanDiagnosticText(payload.type, 'renderer-error', 80),
    message: cleanDiagnosticText(payload.message, 'Unknown renderer error', 500),
    source: cleanDiagnosticText(payload.source, window.location.href, 500),
    stack: cleanDiagnosticText(payload.stack, '', 2000),
    line: Number.isFinite(Number(payload.line)) ? Number(payload.line) : null,
    column: Number.isFinite(Number(payload.column)) ? Number(payload.column) : null,
  });
}

contextBridge.exposeInMainWorld('desktopNotifications', {
  notify(payload) {
    return ipcRenderer.invoke(
      'desktop-notifications:show',
      cleanNotificationPayload(payload)
    );
  },
  setUnreadCount(count) {
    const unreadCount = Math.max(0, Math.min(99, Number(count) || 0));
    return ipcRenderer.invoke('desktop-notifications:set-unread-count', unreadCount);
  },
  stopFlashing() {
    return ipcRenderer.invoke('desktop-notifications:stop-flashing');
  },
});

contextBridge.exposeInMainWorld('appDiagnostics', {
  reportError(payload) {
    return reportRendererDiagnostic(payload);
  },
});

window.addEventListener('error', (event) => {
  reportRendererDiagnostic({
    type: 'window-error',
    message: event.message,
    source: event.filename,
    line: event.lineno,
    column: event.colno,
    stack: event.error?.stack,
  }).catch(() => {});
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  reportRendererDiagnostic({
    type: 'unhandled-rejection',
    message: reason?.message || String(reason || 'Unhandled rejection'),
    stack: reason?.stack,
  }).catch(() => {});
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type]);
  }
});
