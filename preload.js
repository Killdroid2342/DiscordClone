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

function cleanUpdateInfo(info = {}) {
  return {
    version: cleanDiagnosticText(info.version, '', 80),
    releaseName: cleanDiagnosticText(info.releaseName, '', 160),
    releaseDate: cleanDiagnosticText(info.releaseDate, '', 80),
    releaseNotes: cleanDiagnosticText(info.releaseNotes, '', 2000),
  };
}

function cleanUpdateProgress(progress = {}) {
  return {
    percent: Math.max(0, Math.min(100, Number(progress.percent) || 0)),
    bytesPerSecond: Math.max(0, Number(progress.bytesPerSecond) || 0),
    transferred: Math.max(0, Number(progress.transferred) || 0),
    total: Math.max(0, Number(progress.total) || 0),
  };
}

function cleanUpdateStatus(status = {}) {
  return {
    enabled: Boolean(status.enabled),
    phase: cleanDiagnosticText(status.phase, 'disabled', 40),
    channel: cleanDiagnosticText(status.channel, 'latest', 40),
    currentVersion: cleanDiagnosticText(status.currentVersion, '', 80),
    feedConfigured: Boolean(status.feedConfigured),
    message: cleanDiagnosticText(status.message, 'Update status unavailable.', 500),
    checkedAt: cleanDiagnosticText(status.checkedAt, '', 80),
    updateInfo: status.updateInfo ? cleanUpdateInfo(status.updateInfo) : null,
    progress: status.progress ? cleanUpdateProgress(status.progress) : null,
    error: cleanDiagnosticText(status.error, '', 500),
    canCheck: Boolean(status.canCheck),
    canDownload: Boolean(status.canDownload),
    canInstall: Boolean(status.canInstall),
    installStarted: Boolean(status.installStarted),
  };
}

function cleanDiagnosticsStatus(status = {}) {
  const crashReporter = status.crashReporter || {};
  const errorReporting = status.errorReporting || {};
  const lastReport = errorReporting.lastReport || null;
  const lastCrashReport = crashReporter.lastCrashReport || null;

  return {
    crashReporter: {
      started: Boolean(crashReporter.started),
      uploadToServer: Boolean(crashReporter.uploadToServer),
      submitUrlConfigured: Boolean(crashReporter.submitUrlConfigured),
      startError: cleanDiagnosticText(crashReporter.startError, '', 500),
      uploadedCrashReportCount: Math.max(0, Number(crashReporter.uploadedCrashReportCount) || 0),
      lastCrashReport: lastCrashReport
        ? {
            id: cleanDiagnosticText(lastCrashReport.id, '', 120),
            date: cleanDiagnosticText(lastCrashReport.date, '', 80),
          }
        : null,
    },
    errorReporting: {
      remoteConfigured: Boolean(errorReporting.remoteConfigured),
      logFilePath: cleanDiagnosticText(errorReporting.logFilePath, '', 500),
      diagnosticFilePath: cleanDiagnosticText(errorReporting.diagnosticFilePath, '', 500),
      lastReport: lastReport
        ? {
            id: cleanDiagnosticText(lastReport.id, '', 120),
            timestamp: cleanDiagnosticText(lastReport.timestamp, '', 80),
            type: cleanDiagnosticText(lastReport.type, '', 80),
            message: cleanDiagnosticText(lastReport.message, '', 500),
            submitted: Boolean(lastReport.submitted),
            reason: cleanDiagnosticText(lastReport.reason, '', 120),
            uploadError: cleanDiagnosticText(lastReport.uploadError, '', 500),
          }
        : null,
    },
  };
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
  getStatus() {
    return ipcRenderer.invoke('diagnostics:get-status').then(cleanDiagnosticsStatus);
  },
  sendTestReport() {
    return ipcRenderer.invoke('diagnostics:test-error-report');
  },
});

contextBridge.exposeInMainWorld('appUpdates', {
  getStatus() {
    return ipcRenderer.invoke('app-updates:get-status').then(cleanUpdateStatus);
  },
  checkForUpdates() {
    return ipcRenderer.invoke('app-updates:check').then(cleanUpdateStatus);
  },
  downloadUpdate() {
    return ipcRenderer.invoke('app-updates:download').then(cleanUpdateStatus);
  },
  installUpdate() {
    return ipcRenderer.invoke('app-updates:install').then(cleanUpdateStatus);
  },
  onStatus(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (event, status) => {
      callback(cleanUpdateStatus(status));
    };
    ipcRenderer.on('app-updates:status', listener);
    return () => {
      ipcRenderer.removeListener('app-updates:status', listener);
    };
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
