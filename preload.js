const { contextBridge, ipcRenderer } = require('electron');

function cleanNotificationPayload(payload = {}) {
  return {
    title: String(payload.title || 'MyDiscord').slice(0, 120),
    body: String(payload.body || 'New activity').slice(0, 240),
    silent: Boolean(payload.silent),
    flash: Boolean(payload.flash),
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

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type]);
  }
});
