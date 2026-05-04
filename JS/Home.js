'use strict';

const homeAppPaths = window.APP_PATHS || {
  assetUrl: (path) => `../${String(path || '').replace(/^\/+/, '')}`,
  pageUrl: (pageName) => `./${pageName}`,
};
const homeDefaultAvatarUrl = homeAppPaths.assetUrl('assets/img/titlePic.png');
const homeDefaultAvatarBackground = `url("${homeDefaultAvatarUrl}")`;
const homeRingtoneUrl = homeAppPaths.assetUrl('assets/audio/ringtone.mp3');
const homeLoginPageUrl = homeAppPaths.pageUrl('LogIn.html');
const homeApiBase = homeAppPaths.apiBase || 'http://localhost:5018';
const homeWsBase = homeApiBase.replace(/^http/i, 'ws');

const displayStateClasses = ['is-hidden', 'is-block', 'is-flex', 'is-grid', 'is-inline-flex'];
const voiceLevelClasses = Array.from({ length: 11 }, (_, index) => `voice-level-${index}`);
const messageFontSizeClasses = Array.from({ length: 13 }, (_, index) => `message-font-size-${index + 12}`);
const homeRuntimeCssRules = new Map();
let homeRuntimeCssElement = null;

function getElement(target) {
  if (!target) return null;
  return typeof target === 'string' ? document.querySelector(target) : target;
}

function clearDisplayState(element) {
  element?.classList.remove(...displayStateClasses);
}

function showElement(target, displayMode = null) {
  const element = getElement(target);
  if (!element) return;
  clearDisplayState(element);
  if (displayMode) {
    element.classList.add(`is-${displayMode}`);
  }
}

function hideElement(target) {
  const element = getElement(target);
  if (!element) return;
  clearDisplayState(element);
  element.classList.add('is-hidden');
}

function setElementVisible(target, isVisible, displayMode = null) {
  if (isVisible) {
    showElement(target, displayMode);
  } else {
    hideElement(target);
  }
}

function hideAllElements(selector) {
  document.querySelectorAll(selector).forEach((element) => hideElement(element));
}

function isElementVisible(target) {
  const element = getElement(target);
  return Boolean(
    element &&
    !element.classList.contains('is-hidden') &&
    window.getComputedStyle(element).display !== 'none'
  );
}

function getHomeRuntimeCssElement() {
  if (!homeRuntimeCssElement) {
    homeRuntimeCssElement = document.getElementById('homeRuntimeCss');
  }
  if (!homeRuntimeCssElement) {
    homeRuntimeCssElement = document.createElement('style');
    homeRuntimeCssElement.id = 'homeRuntimeCss';
    document.head.appendChild(homeRuntimeCssElement);
  }
  return homeRuntimeCssElement;
}

function setHomeRuntimeCss(key, cssRule = '') {
  if (cssRule) {
    homeRuntimeCssRules.set(key, cssRule);
  } else {
    homeRuntimeCssRules.delete(key);
  }
  getHomeRuntimeCssElement().textContent = Array.from(homeRuntimeCssRules.values()).join('\n');
}

function cssString(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ');
}

function setAvatarFallback(element) {
  element?.classList.add('default-avatar-bg');
}

function applyDynamicProfileBanner(color, imageUrl = '') {
  const nextColor = normalizeHexColor(color, '#0c0c0c');
  const backgroundImage = imageUrl ? `url("${cssString(imageUrl)}")` : 'none';

  document
    .querySelectorAll('.banner-color, .preview-banner, .profile-popout-header')
    .forEach((element) => element.classList.add('profile-dynamic-banner'));

  setHomeRuntimeCss(
    'profile-banner',
    `.profile-dynamic-banner { background-color: ${nextColor}; background-image: ${backgroundImage}; }`
  );

  const colorHex = document.querySelector('.color-hex');
  if (colorHex) {
    colorHex.textContent = nextColor;
  }

  return nextColor;
}

let inServerUsername = document.getElementById('inServerUsername');
let selectedServerID;
let selectedChannelID;
let currentServerName;
let currentServerRole = 'user';
let currentServerRoles = [];
let currentServerChannels = [];
let currentServerCategories = [];
let currentServerVerificationLevel = 'none';
let currentServerRequireVerifiedEmail = false;
let currentServerMinimumAccountAgeMinutes = 0;
let currentServerMinimumMembershipMinutes = 0;
let currentServerRequireTwoFactorForModerators = false;
let currentServerIsPublic = false;
let currentServerDescription = '';
let currentServerDiscoveryCategory = '';
let currentServerDiscoveryTags = [];
let currentServerWelcomeEnabled = true;
let currentServerWelcomeMessage = '';
let currentServerWelcomeChecklist = [];
let currentServerOnboardingCompletedAt = null;
let currentFriend;
let chatMessages = document.querySelector('.chatMessages');
let userJoined = document.querySelector('.UserJoined');
let mainFriendsDiv = document.querySelector('.MainFriendsDiv');
let directMessageUser = document.querySelector('.messageUser');
const serverDetailsPanel = document.getElementById('serverDetails');
hideElement(serverDetailsPanel);
const messageModalContent = document.querySelector('.ContentMessage');
const messageOuterModal = document.querySelector('.outerModalMessage');
const username = document.getElementById('username');
let socket;
let chatSocketMode = null;
let chatSocketGeneration = 0;
let chatReconnectTimer = null;
let chatReconnectAttempts = 0;
let voiceReconnectTimer = null;
let voiceReconnectAttempts = 0;

let chatConnection = null;
let signalRConnection = null;

let currentChatHistory = [];
let currentGroupId = null;
let currentGroupName = '';

function GetCookieToken(name) {
  let value = '; ' + document.cookie;
  let parts = value.split('; ' + name + '=');
  if (parts.length == 2) return parts.pop().split(';').shift();
}

let cookieVal = GetCookieToken('token');

if (typeof axios !== 'undefined') {
  axios.defaults.withCredentials = true;
  if (cookieVal) {
    axios.defaults.headers.common.Authorization = `Bearer ${cookieVal}`;
  }
}

const apiClient = typeof axios !== 'undefined' ? axios : null;
let appOffline = !navigator.onLine;

function getConnectionStatusBanner() {
  let banner = document.getElementById('connectionStatusBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'connectionStatusBanner';
    banner.className = 'connection-status-banner';
    banner.setAttribute('role', 'status');
    banner.textContent = 'Offline. Reconnecting...';
    document.body.appendChild(banner);
  }
  return banner;
}

function setAppOfflineState(isOffline, reason = '') {
  appOffline = Boolean(isOffline);
  document.body?.classList.toggle('app-offline', appOffline);
  const banner = getConnectionStatusBanner();
  banner.textContent = reason || (appOffline ? 'Offline. Reconnecting...' : 'Back online.');
  banner.classList.toggle('visible', appOffline || reason === 'Back online.');

  if (!appOffline && reason === 'Back online.') {
    window.setTimeout(() => {
      banner.classList.remove('visible');
    }, 1800);
  }
}

if (apiClient) {
  apiClient.interceptors.request.use((request) => {
    request.withCredentials = true;
    request.headers = request.headers || {};
    if (cookieVal && !request.headers.Authorization) {
      request.headers.Authorization = `Bearer ${cookieVal}`;
    }
    return request;
  });

  apiClient.interceptors.response.use(
    (response) => {
      if (appOffline) {
        setAppOfflineState(false, 'Back online.');
      }
      return response;
    },
    (error) => {
      if (!error.response) {
        setAppOfflineState(true, 'Connection lost. Changes will retry when possible.');
      }
      return Promise.reject(error);
    }
  );
}

window.addEventListener('online', () => {
  setAppOfflineState(false, 'Back online.');
  if (chatSocketMode && shouldKeepChatSocket(chatSocketMode)) {
    connectChatSocket(chatSocketMode, { force: true });
  }
  if (shouldReconnectVoiceConnection()) {
    voiceReconnectAttempts = 0;
    scheduleVoiceReconnect();
  }
});
window.addEventListener('offline', () => setAppOfflineState(true));
window.apiClient = apiClient;

function getAuthHeaders(extraHeaders = {}) {
  return {
    ...extraHeaders,
    ...(cookieVal ? { Authorization: `Bearer ${cookieVal}` } : {}),
  };
}

function withAccessToken(url) {
  if (!cookieVal) return url;
  return `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(cookieVal)}`;
}

function getReconnectDelay(attempt, baseMs = 1000, maxMs = 30000) {
  const exponentialDelay = Math.min(maxMs, baseMs * (2 ** Math.min(attempt, 6)));
  const jitter = Math.floor(exponentialDelay * (0.2 + Math.random() * 0.3));
  return Math.min(maxMs, exponentialDelay + jitter);
}

function clearTimer(timerId) {
  if (timerId) {
    window.clearTimeout(timerId);
  }
}

function isSocketOpen(targetSocket) {
  return Boolean(targetSocket && targetSocket.readyState === WebSocket.OPEN);
}

function isPrivateCallActive() {
  const activeCallUI = document.getElementById('activeCallUI');
  return Boolean(currentFriend && isElementVisible(activeCallUI));
}

function shouldReconnectVoiceConnection() {
  return Boolean(sessionStorage.getItem('UserJoined') || isPrivateCallActive());
}

function scheduleVoiceReconnect() {
  clearTimer(voiceReconnectTimer);
  voiceReconnectTimer = null;

  if (!shouldReconnectVoiceConnection()) {
    return;
  }

  if (!navigator.onLine) {
    setAppOfflineState(true, 'Offline. Voice will reconnect when the network returns.');
    return;
  }

  const delay = getReconnectDelay(voiceReconnectAttempts, 1000, 20000);
  voiceReconnectAttempts += 1;
  console.log(`Attempting to reconnect voice in ${Math.round(delay / 1000)} seconds...`);

  voiceReconnectTimer = window.setTimeout(() => {
    voiceReconnectTimer = null;
    if (!shouldReconnectVoiceConnection()) {
      return;
    }

    initializeVoiceConnection().catch((err) => {
      console.error('Voice reconnect failed:', err);
      scheduleVoiceReconnect();
    });
  }, delay);
}

function decodeJWT(token) {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));
    return {
      header,
      payload,
    };
  } catch (error) {
    console.error('Failed to decode JWT', error);
    return null;
  }
}
const decodedJWT = decodeJWT(cookieVal);
let JWTusername = decodedJWT?.payload?.username || '';

if (!JWTusername) {
  window.location.replace(homeLoginPageUrl);
}

if (username) {
  username.textContent = JWTusername || 'Guest';
}
let ringtoneAudio = null;

function getApiErrorMessage(error, fallback = 'Something went wrong.') {
  const data = error?.response?.data;
  if (typeof data === 'string') return data;
  return data?.message || data?.error || error?.message || fallback;
}

function showAppMessage(message, variant = 'info', duration = 2600) {
  if (!messageModalContent || !messageOuterModal) {
    if (variant === 'error') {
      console.error(message);
    } else {
      console.log(message);
    }
    return;
  }

  messageModalContent.textContent = message;
  messageOuterModal.dataset.variant = variant;
  showElement(messageOuterModal, 'flex');

  window.clearTimeout(showAppMessage.timeoutId);
  showAppMessage.timeoutId = window.setTimeout(() => {
    hideElement(messageOuterModal);
  }, duration);
}

let desktopUnreadCount = 0;
const messageNotificationSeenIds = new Map();
const messageNotificationPrimedKeys = new Set();
const unreadBadgeState = {
  server: new Map(),
  dm: new Map(),
  group: new Map(),
};
let unreadBadgeRefreshPromise = null;

function getDesktopNotificationBridge() {
  return window.desktopNotifications || null;
}

function isToggleSettingEnabled(settingKey, fallback = true) {
  const state = readSettingsState();
  if (hasStoredSettingValue(state.toggles || {}, settingKey)) {
    return Boolean(state.toggles[settingKey]);
  }

  const toggle = document.querySelector(
    `[data-setting-key="${settingKey}"] .toggle-switch`
  );
  if (toggle) {
    return toggle.classList.contains('active');
  }

  return fallback;
}

function areDesktopNotificationsEnabled() {
  return isToggleSettingEnabled('desktopNotifications', true);
}

function shouldShowUnreadBadge() {
  return isToggleSettingEnabled('unreadBadge', true);
}

function shouldShowMentionNotifications() {
  return isToggleSettingEnabled('mentionNotifications', true);
}

function shouldFlashTaskbar() {
  return isToggleSettingEnabled('taskbarFlash', true);
}

function isAppWindowFocused() {
  return !document.hidden && document.hasFocus();
}

function cleanNotificationBody(text, fallback = 'New activity') {
  const normalized = String(text || fallback)
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length <= 140) {
    return normalized;
  }

  return `${normalized.slice(0, 139).trim()}...`;
}

function getMessageSender(message = {}) {
  return (
    message.messagesUserSender ||
    message.MessagesUserSender ||
    message.sender ||
    message.Sender ||
    'Unknown'
  );
}

function getMessageId(message = {}) {
  return (
    message.messageID ||
    message.MessageID ||
    message.privateMessageID ||
    message.PrivateMessageID ||
    message.id ||
    message.Id ||
    ''
  );
}

function getMessageText(message = {}) {
  return (
    message.userText ||
    message.friendMessagesData ||
    message.content ||
    message.Content ||
    ''
  );
}

const REPORT_REASON_OPTIONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate', label: 'Hate or abuse' },
  { value: 'explicit', label: 'Explicit content' },
  { value: 'threat', label: 'Threat or harm' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Other' },
];

function normalizeMentionName(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

function extractMentionNames(text = '') {
  return Array.from(
    String(text || '').matchAll(/@([A-Za-z0-9_.-]{3,32})/g),
    (match) => match[1]
  );
}

function getMessageMentionNames(message = {}) {
  const explicitMentions =
    message.mentions ||
    message.Mentions ||
    message.mentionNames ||
    message.MentionNames;

  if (Array.isArray(explicitMentions)) {
    return explicitMentions;
  }

  return extractMentionNames(getMessageText(message));
}

function messageMentionsCurrentUser(message = {}) {
  const currentUser = normalizeMentionName(JWTusername);
  if (!currentUser) {
    return false;
  }

  return getMessageMentionNames(message)
    .map(normalizeMentionName)
    .some((mention) => mention === currentUser || mention === 'everyone' || mention === 'here');
}

function getMessageNotificationId(message = {}, scope = 'message') {
  return String(
    message.messageID ||
    message.messageId ||
    message.privateMessageID ||
    message.PrivateMessageID ||
    message.id ||
    message.Id ||
    `${scope}:${getMessageSender(message)}:${message.date || message.Date || ''}:${getMessageText(message)}`
  );
}

function getSelectedChannelNotificationName() {
  const channel = currentServerChannels.find((item) => item.id === selectedChannelID);
  return channel?.name || document.querySelector('.chatHeader')?.textContent?.trim() || 'channel';
}

function isCurrentNotificationContextVisible(scope, conversationId) {
  if (scope === 'server') {
    return (
      selectedChannelID === conversationId &&
      isElementVisible('#serverDetails')
    );
  }

  if (scope === 'group') {
    return (
      currentGroupId === conversationId &&
      isElementVisible('.privateMessage')
    );
  }

  if (scope === 'dm') {
    return (
      currentFriend === conversationId &&
      !currentGroupId &&
      isElementVisible('.privateMessage')
    );
  }

  return false;
}

function shouldNotifyIncomingMessage({ sender, scope, conversationId }) {
  if (!areDesktopNotificationsEnabled()) {
    return false;
  }

  if (sender && JWTusername && sender.toLowerCase() === JWTusername.toLowerCase()) {
    return false;
  }

  return !(
    isAppWindowFocused() &&
    isCurrentNotificationContextVisible(scope, conversationId)
  );
}

function shouldCountIncomingUnreadMessage({ sender, scope, conversationId }) {
  if (sender && JWTusername && sender.toLowerCase() === JWTusername.toLowerCase()) {
    return false;
  }

  return !(
    isAppWindowFocused() &&
    isCurrentNotificationContextVisible(scope, conversationId)
  );
}

function trackIncomingUnreadMessage(message, { scope, conversationId } = {}) {
  const sender = getMessageSender(message);
  if (!scope || !conversationId || !shouldCountIncomingUnreadMessage({ sender, scope, conversationId })) {
    return false;
  }

  const mentionIncrement = messageMentionsCurrentUser(message) ? 1 : 0;
  incrementUnreadBadgeEntry(scope, conversationId, mentionIncrement);
  return true;
}

function updateDesktopUnreadBadge(count) {
  const bridge = getDesktopNotificationBridge();
  bridge?.setUnreadCount?.(count)?.catch?.((error) => {
    console.warn('Could not update unread badge:', error);
  });
}

function formatUnreadBadgeLabel(count) {
  const unread = Math.max(0, Number(count) || 0);
  return unread > 99 ? '99+' : String(unread);
}

function getStoredUnreadEntry(scope, conversationId) {
  return unreadBadgeState[scope]?.get(String(conversationId || '')) || {
    unread: 0,
    mentionCount: 0,
  };
}

function setUnreadBadgeEntry(scope, conversationId, unread = 0, mentionCount = 0) {
  const store = unreadBadgeState[scope];
  const key = String(conversationId || '');
  if (!store || !key) {
    return;
  }

  const normalizedUnread = Math.max(0, Number(unread) || 0);
  const normalizedMentions = Math.max(0, Number(mentionCount) || 0);

  if (normalizedUnread === 0 && normalizedMentions === 0) {
    store.delete(key);
  } else {
    store.set(key, {
      unread: normalizedUnread,
      mentionCount: normalizedMentions,
    });
  }

  syncDesktopUnreadBadgeFromState();
}

function incrementUnreadBadgeEntry(scope, conversationId, mentionIncrement = 0) {
  const current = getStoredUnreadEntry(scope, conversationId);
  setUnreadBadgeEntry(
    scope,
    conversationId,
    current.unread + 1,
    current.mentionCount + Math.max(0, Number(mentionIncrement) || 0)
  );
}

function getTotalUnreadBadgeCount() {
  return Object.values(unreadBadgeState).reduce((total, store) => {
    for (const entry of store.values()) {
      total += entry.unread || 0;
    }
    return total;
  }, 0);
}

function syncDesktopUnreadBadgeFromState() {
  if (!shouldShowUnreadBadge()) {
    updateDesktopUnreadBadge(0);
    return;
  }

  desktopUnreadCount = Math.min(99, getTotalUnreadBadgeCount());
  updateDesktopUnreadBadge(desktopUnreadCount);
}

function stopDesktopAttentionState() {
  getDesktopNotificationBridge()?.stopFlashing?.()?.catch?.((error) => {
    console.warn('Could not stop taskbar flashing:', error);
  });
  syncDesktopUnreadBadgeFromState();
}

function clearDesktopNotificationState() {
  Object.values(unreadBadgeState).forEach((store) => store.clear());
  desktopUnreadCount = 0;
  updateDesktopUnreadBadge(0);
  stopDesktopAttentionState();
}

function incrementDesktopUnreadCount(scope, conversationId, mentionIncrement = 0) {
  if (!shouldShowUnreadBadge()) {
    updateDesktopUnreadBadge(0);
    return;
  }

  if (scope && conversationId) {
    incrementUnreadBadgeEntry(scope, conversationId, mentionIncrement);
    return;
  }

  desktopUnreadCount = Math.min(99, desktopUnreadCount + 1);
  updateDesktopUnreadBadge(desktopUnreadCount);
}

function showWebNotificationFallback({ title, body }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    new Notification(title, {
      body,
      icon: homeDefaultAvatarUrl,
    });
  } catch (error) {
    console.warn('Could not show web notification:', error);
  }
}

function showDesktopNotification({
  title = 'MyDiscord',
  body = 'New activity',
  countUnread = true,
  badgeScope = null,
  conversationId = null,
  mentionIncrement = 0,
  flash = shouldFlashTaskbar(),
} = {}) {
  if (!areDesktopNotificationsEnabled()) {
    return;
  }

  const payload = {
    title: cleanNotificationBody(title, 'MyDiscord'),
    body: cleanNotificationBody(body, 'New activity'),
    flash: Boolean(flash),
  };

  if (countUnread) {
    incrementDesktopUnreadCount(badgeScope, conversationId, mentionIncrement);
  }

  const bridge = getDesktopNotificationBridge();
  if (bridge?.notify) {
    bridge.notify(payload).catch((error) => {
      console.warn('Could not show desktop notification:', error);
    });
    return;
  }

  showWebNotificationFallback(payload);
}

function notifyIncomingChatMessage(message, { scope, conversationId, conversationName } = {}) {
  const sender = getMessageSender(message);
  trackIncomingUnreadMessage(message, { scope, conversationId });
  if (!shouldNotifyIncomingMessage({ sender, scope, conversationId })) {
    return;
  }

  const isMention = messageMentionsCurrentUser(message);
  const useMentionNotification = isMention && shouldShowMentionNotifications();

  const title =
    useMentionNotification
      ? scope === 'server'
        ? `Mention from ${sender} in #${conversationName || 'channel'}`
        : scope === 'group'
          ? `Mention from ${sender} in ${conversationName || 'Group'}`
          : `Mention from ${sender}`
      : scope === 'server'
        ? `${sender} in #${conversationName || 'channel'}`
        : scope === 'group'
          ? `${sender} in ${conversationName || 'Group'}`
          : sender;

  showDesktopNotification({
    title,
    body: getMessageText(message) || 'Sent an attachment.',
    badgeScope: scope,
    conversationId,
    mentionIncrement: isMention ? 1 : 0,
    countUnread: false,
  });
}

function collectNewMessagesForNotifications(messages = [], { scope, conversationId }) {
  const key = `${scope}:${conversationId || 'unknown'}`;
  let seenIds = messageNotificationSeenIds.get(key);
  if (!seenIds) {
    seenIds = new Set();
    messageNotificationSeenIds.set(key, seenIds);
  }

  const isPrimed = messageNotificationPrimedKeys.has(key);
  const nextMessages = [];

  messages.forEach((message) => {
    const messageId = getMessageNotificationId(message, scope);
    if (seenIds.has(messageId)) {
      return;
    }

    seenIds.add(messageId);
    if (isPrimed) {
      nextMessages.push(message);
    }
  });

  if (!isPrimed) {
    messageNotificationPrimedKeys.add(key);
    return [];
  }

  return nextMessages;
}

function notifyPolledMessages(messages, options) {
  collectNewMessagesForNotifications(messages, options).forEach((message) => {
    notifyIncomingChatMessage(message, options);
  });
}

function notifyIncomingCall(sender, callLabel = 'call') {
  if (!areDesktopNotificationsEnabled() || isAppWindowFocused()) {
    return;
  }

  showDesktopNotification({
    title: 'Incoming call',
    body: `${sender} is starting a ${callLabel}.`,
    countUnread: false,
  });
}

window.addEventListener('focus', () => {
  stopDesktopAttentionState();
  markActiveConversationRead();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    stopDesktopAttentionState();
    markActiveConversationRead();
  }
});

function setBusyState(element, isBusy, label) {
  if (!element) return;
  if (isBusy) {
    element.dataset.originalText = element.textContent;
    element.disabled = true;
    element.textContent = label || 'Working...';
    return;
  }

  element.disabled = false;
  if (element.dataset.originalText) {
    element.textContent = element.dataset.originalText;
    delete element.dataset.originalText;
  }
}


function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      console.log(e)
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function startRingtone() {
  if (ringtoneAudio) return;
  console.log("Starting Ringtone");

  try {
    ringtoneAudio = new Audio(homeRingtoneUrl);
    ringtoneAudio.loop = true;
    ringtoneAudio.volume = 0.5;


    const playPromise = ringtoneAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        console.warn("Autoplay blocked. Waiting for interaction...", e);
        const banner = document.getElementById('audioPermBanner');
        if (banner) showElement(banner, 'block');

        const resumeAudio = () => {
          if (ringtoneAudio) ringtoneAudio.play().catch(err => console.error("Retry failed", err));
          if (banner) hideElement(banner);
          document.removeEventListener('click', resumeAudio);
          document.removeEventListener('keydown', resumeAudio);
        };
        document.addEventListener('click', resumeAudio);
        document.addEventListener('keydown', resumeAudio);
      });
    }
  } catch (e) {
    console.error("Failed to load ringtone:", e);
  }
}

const playBeep = () => {
  try {
    const osc = globalAudioContext.createOscillator();
    const gain = globalAudioContext.createGain();
    osc.connect(gain);
    gain.connect(globalAudioContext.destination);


    osc.frequency.setValueAtTime(800, globalAudioContext.currentTime);
    osc.frequency.setValueAtTime(600, globalAudioContext.currentTime + 0.4);

    gain.gain.setValueAtTime(0.2, globalAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 1.5);

    osc.start();
    osc.stop(globalAudioContext.currentTime + 1.5);
  } catch (e) { console.error("Ringtone error:", e); }
};



function stopRingtone() {
  if (ringtoneAudio) {
    console.log("Stopping Ringtone");
    ringtoneAudio.pause();
    ringtoneAudio.currentTime = 0;
    ringtoneAudio = null;
  }
}

if (inServerUsername) {
  inServerUsername.textContent = JWTusername || 'Guest';
}

function openModal() {
  showElement('.outerModal', 'flex');
}
function closeModal() {
  hideElement('.outerModal');
}

function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    showElement(modal, 'flex');
    refreshSettingsModal();
  }
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) hideElement(modal);
  const searchInput = document.getElementById('settingsSearchInput');
  if (searchInput) {
    searchInput.value = '';
    filterSettingsSidebarItems('');
  }
}

function openSecondModal() {
  closeModal();
  showElement('.outerSecondModal', 'flex');
}
function closeSecondModal() {
  hideElement('.outerSecondModal');
}
function BackToFirstModal() {
  closeSecondModal();
  openModal();
}
function OpenCreationModal() {
  closeSecondModal();
  showElement('.outerCreationModal', 'flex');
}
function CloseCreationModal() {
  hideElement('.outerCreationModal');
}
function BackLastModal() {
  CloseCreationModal();
  openSecondModal();
}

function buildServerRoleBadge(role = 'user') {
  const normalizedRole = normalizeRoleName(role);
  const roleBadge = document.createElement('span');
  roleBadge.classList.add('role-badge');
  roleBadge.dataset.role = normalizedRole;
  roleBadge.textContent = normalizedRole.slice(0, 1).toUpperCase();
  roleBadge.title = formatRoleName(normalizedRole);
  return roleBadge;
}

async function openServer(server, fallbackRole = 'user') {
  const role = server.role || fallbackRole || 'user';

  selectedServerID = server.serverID;
  currentServerName = server.serverName;
  currentServerRole = role;
  currentServerRoles = [];
  applyServerRuleState(server);
  applyServerListingState(server);
  applyServerWelcomeState(server);

  hideElement('.secondColumn');
  hideElement('.lastSection');
  showElement('#serverDetails', 'flex');

  const serverTitle = document.querySelector('.currentServerName');
  if (serverTitle) {
    serverTitle.textContent = `${server.serverName} (${role})`;
  }

  chatMessages.innerHTML = '';

  watchVoiceServer(server.serverID).catch((err) => {
    console.error('Voice roster watch failed:', err);
  });
  startVoiceRosterRefresh();

  await fetchServerDetails();

  if (signalRConnection && signalRConnection.state === 'Connected') {
    try {
      await signalRConnection.invoke('JoinServer', server.serverID, JWTusername);
    } catch (err) {
      console.error('SignalR Join failed', err);
    }
  } else {
    console.log('SignalR not connected yet, skipping join group...');
  }

  startServerMessagePolling();

  const joinedServer = sessionStorage.getItem('UserJoined');
  if (joinedServer && joinedServer === selectedServerID) {
    console.log('Auto-rejoining voice for', selectedServerID);
    JoinVoiceCalls(sessionStorage.getItem('UserJoinedChannel'));
  }
}

function createServerListItem(server, fallbackRole = 'user') {
  const newServerElement = document.createElement('div');
  newServerElement.classList.add('servers');
  newServerElement.dataset.serverId = server.serverID;
  newServerElement.title = `${server.serverName} (${server.role || fallbackRole || 'user'})`;
  newServerElement.setAttribute('aria-label', newServerElement.title);

  const serverNameSpan = document.createElement('span');
  serverNameSpan.classList.add('server-name');
  serverNameSpan.textContent = String(server.serverName || '?').trim().slice(0, 1).toUpperCase();

  newServerElement.appendChild(serverNameSpan);
  newServerElement.appendChild(
    buildServerRoleBadge(server.role || fallbackRole || 'user')
  );

  newServerElement.addEventListener('click', async function () {
    await openServer(server, fallbackRole);
  });

  return newServerElement;
}

function upsertServerListItem(server, fallbackRole = 'user') {
  const allServersDiv = document.querySelector('.allservers');
  const serverId = server.serverID;

  if (!allServersDiv || !serverId) {
    return null;
  }

  const existingServerElement = allServersDiv.querySelector(
    `[data-server-id="${serverId}"]`
  );
  const nextServerElement = createServerListItem(server, fallbackRole);

  if (existingServerElement) {
    existingServerElement.replaceWith(nextServerElement);
  } else {
    allServersDiv.appendChild(nextServerElement);
  }

  return nextServerElement;
}

async function CreateServer(event) {
  event.preventDefault();
  let inputElement = document.getElementById('serverNameInput');
  let ServerName = inputElement.value.trim();
  let ServerOwner = decodedJWT.payload.username;
  let ServerID = generateUUID();
  let formData = {
    ServerID: ServerID,
    ServerName: ServerName,
    ServerOwner: ServerOwner,
  };
  try {
    const response = await axios.post(
      `${homeApiBase}/api/Server/CreateServer`,
      formData
    );
    const createdServer = response.data;
    const newServerElement = upsertServerListItem(
      { ...createdServer, role: createdServer.role || 'owner' },
      'owner'
    );
    inputElement.value = '';
    CloseCreationModal();
    if (newServerElement) {
      newServerElement.click();
    }
  } catch (err) {
    console.error('couldnt make server:', err);
    showAppMessage(getApiErrorMessage(err, 'Could not create that server.'), 'error');
  }
}

async function GetServer() {
  try {
    const response = await axios.get(
      `${homeApiBase}/api/Server/GetServer`
    );
    let serverData = response.data;
    let allServersDiv = document.querySelector('.allservers');
    if (!Array.isArray(serverData)) {
      console.log('server response:', serverData.message || serverData);
      return;
    }

    allServersDiv.querySelectorAll('[data-server-id]').forEach((serverEl) => {
      serverEl.remove();
    });

    const joinedServer = sessionStorage.getItem('UserJoined');
    let serverToSelect = null;

    serverData.forEach((server) => {
      const newServerElement = upsertServerListItem(server);

      if (joinedServer && server.serverID === joinedServer && newServerElement) {
        serverToSelect = newServerElement;
      }
    });

    if (serverToSelect) {
      serverToSelect.click();
    }

    document
      .getElementById('home')
      .addEventListener('click', async function () {
        showElement('.secondColumn', 'flex');
        showElement('.lastSection', 'flex');
        hideElement('#serverDetails');

        stopServerMessagePolling();
      });
  } catch (e) {
    console.error('couldnt load servers:', e);
    showAppMessage(getApiErrorMessage(e, 'Could not load your servers.'), 'error');
  }
}
GetServer();
function buildMessageAttachmentNode(attachmentUrl, contentType = '') {
  if (!attachmentUrl) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'message-attachment';

  const normalizedType = String(contentType || '').toLowerCase();
  const isImage =
    normalizedType.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp)$/i.test(attachmentUrl);

  if (isImage) {
    const image = document.createElement('img');
    image.src = attachmentUrl.startsWith('/uploads/')
      ? `${homeApiBase}${attachmentUrl}`
      : attachmentUrl;
    image.alt = 'Attachment preview';
    image.loading = 'lazy';
    wrapper.appendChild(image);
    return wrapper;
  }

  const link = document.createElement('a');
  link.href = attachmentUrl.startsWith('/uploads/')
    ? `${homeApiBase}${attachmentUrl}`
    : attachmentUrl;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = 'Open attachment';
  wrapper.appendChild(link);
  return wrapper;
}

const linkPreviewCache = new Map();
const linkUrlRegex = /(https?:\/\/[^\s<>"']+)/gi;

function normalizeUrlForPreview(url) {
  return String(url || '').replace(/[),.;!?]+$/, '');
}

function extractMessageUrls(text = '') {
  return Array.from(new Set(
    (String(text).match(linkUrlRegex) || [])
      .map(normalizeUrlForPreview)
      .filter(Boolean)
  )).slice(0, 3);
}

function areLinkPreviewsEnabled() {
  try {
    const state = readSettingsState();
    return state.toggles?.linkPreviews !== false;
  } catch {
    return true;
  }
}

function appendPlainMessageTextWithMentions(container, text = '') {
  const value = String(text || '');
  let cursor = 0;

  value.replace(/@([A-Za-z0-9_.-]{3,32})/g, (match, mentionName, offset) => {
    if (offset > cursor) {
      container.appendChild(document.createTextNode(value.slice(cursor, offset)));
    }

    const mention = document.createElement('span');
    mention.className = 'message-mention';
    if (
      normalizeMentionName(mentionName) === normalizeMentionName(JWTusername) ||
      ['everyone', 'here'].includes(normalizeMentionName(mentionName))
    ) {
      mention.classList.add('is-current-user');
    }
    mention.textContent = match;
    container.appendChild(mention);
    cursor = offset + match.length;
    return match;
  });

  if (cursor < value.length) {
    container.appendChild(document.createTextNode(value.slice(cursor)));
  }
}

function appendMessageTextWithLinks(container, text = '') {
  const value = String(text || '');
  let cursor = 0;

  value.replace(linkUrlRegex, (match, offset) => {
    const url = normalizeUrlForPreview(match);
    const end = offset + match.length;
    if (offset > cursor) {
      appendPlainMessageTextWithMentions(container, value.slice(cursor, offset));
    }

    const link = document.createElement('a');
    link.className = 'message-link';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = url;
    container.appendChild(link);
    cursor = end;
    return match;
  });

  if (cursor < value.length) {
    appendPlainMessageTextWithMentions(container, value.slice(cursor));
  }
}

async function getLinkPreview(url) {
  if (!linkPreviewCache.has(url)) {
    linkPreviewCache.set(
      url,
      apiClient
        .get(`${homeApiBase}/api/LinkPreview/Get?url=${encodeURIComponent(url)}`)
        .then((res) => res.data)
        .catch((error) => {
          console.warn('Could not load link preview:', error);
          return null;
        })
    );
  }

  return linkPreviewCache.get(url);
}

function buildLinkPreviewNode(preview) {
  if (!preview || !preview.url) {
    return null;
  }

  const card = document.createElement('a');
  card.className = 'link-preview-card';
  card.href = preview.url;
  card.target = '_blank';
  card.rel = 'noreferrer';

  const content = document.createElement('div');
  content.className = 'link-preview-content';

  const site = document.createElement('div');
  site.className = 'link-preview-site';
  try {
    site.textContent = preview.siteName || new URL(preview.url).hostname;
  } catch {
    site.textContent = preview.siteName || preview.url;
  }
  content.appendChild(site);

  const title = document.createElement('div');
  title.className = 'link-preview-title';
  title.textContent = preview.title || preview.url;
  content.appendChild(title);

  if (preview.description) {
    const description = document.createElement('div');
    description.className = 'link-preview-description';
    description.textContent = preview.description;
    content.appendChild(description);
  }

  card.appendChild(content);

  if (preview.image) {
    const image = document.createElement('img');
    image.className = 'link-preview-image';
    image.src = preview.image;
    image.alt = '';
    image.loading = 'lazy';
    card.appendChild(image);
  }

  return card;
}

function hydrateLinkPreviews(messageEl, text = '') {
  if (!areLinkPreviewsEnabled()) {
    return;
  }

  extractMessageUrls(text).forEach(async (url) => {
    const preview = await getLinkPreview(url);
    const previewNode = buildLinkPreviewNode(preview);
    if (previewNode && messageEl.isConnected) {
      messageEl.appendChild(previewNode);
    }
  });
}

function renderCompactMessage(message, scope = 'server') {
  const messageEl = document.createElement('div');
  messageEl.className = 'compact-message';
  messageEl.dataset.messageId = getMessageId(message);

  const header = document.createElement('div');
  header.className = 'compact-message-header';
  const sender = getMessageSender(message);
  const headerText = document.createElement('span');
  headerText.textContent = `${sender} · ${formatMessageDate(message.date)}`;
  header.appendChild(headerText);
  if (sender && sender !== JWTusername && messageEl.dataset.messageId) {
    const reportButton = document.createElement('button');
    reportButton.type = 'button';
    reportButton.className = 'compact-message-report-btn';
    reportButton.textContent = 'Report';
    reportButton.addEventListener('click', (event) => {
      event.stopPropagation();
      openReportDialog({
        targetType: 'message',
        scopeType: scope,
        message,
        targetUsername: sender,
      });
    });
    header.appendChild(reportButton);
  }
  messageEl.appendChild(header);

  if (message.replyToMessageId) {
    const reply = document.createElement('div');
    reply.className = 'compact-message-reply';
    reply.textContent = `Replying to ${message.replyToMessageId}`;
    messageEl.appendChild(reply);
  }

  const body = document.createElement('div');
  body.className = 'compact-message-body';
  const messageText = getMessageText(message);
  appendMessageTextWithLinks(body, messageText);
  if (message.editedAt) {
    const edited = document.createElement('span');
    edited.className = 'compact-message-edited';
    edited.textContent = ' edited';
    body.appendChild(edited);
  }
  messageEl.appendChild(body);

  const attachment = buildMessageAttachmentNode(
    message.attachmentUrl,
    message.attachmentContentType
  );
  if (attachment) {
    messageEl.appendChild(attachment);
  }

  if (Array.isArray(message.reactions) && message.reactions.length > 0) {
    const reactions = document.createElement('div');
    reactions.className = 'message-reactions';
    message.reactions.forEach((reaction) => {
      const reactionEl = document.createElement('span');
      reactionEl.className = 'message-reaction';
      reactionEl.textContent = `${reaction.emoji} ${reaction.count}`;
      reactions.appendChild(reactionEl);
    });
    messageEl.appendChild(reactions);
  }

  hydrateLinkPreviews(messageEl, messageText);
  return messageEl;
}

function formatMessageDate(rawDate) {
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return rawDate || '';
  return parsed.toLocaleString();
}

async function markSelectedChannelRead(messages = []) {
  if (!selectedChannelID || !messages.length) return;
  if (!isAppWindowFocused() || !isCurrentNotificationContextVisible('server', selectedChannelID)) {
    await refreshUnreadIndicators();
    return;
  }

  const lastMessage = messages[messages.length - 1];
  try {
    await axios.post(`${homeApiBase}/api/ServerMessages/MarkChannelRead`, {
      scopeId: selectedChannelID,
      lastReadMessageId: lastMessage.messageID || lastMessage.messageId,
      lastReadAt: new Date().toISOString(),
    });
    setUnreadBadgeEntry('server', selectedChannelID, 0, 0);
    await refreshUnreadIndicators();
  } catch (error) {
    console.warn('Could not mark channel read:', error);
  }
}

async function refreshUnreadIndicators() {
  if (!selectedServerID) return;

  try {
    const res = await axios.get(
      `${homeApiBase}/api/ServerMessages/GetUnreadState?serverId=${encodeURIComponent(selectedServerID)}`
    );
    const unreadByChannel = new Map();
    (Array.isArray(res.data) ? res.data : []).forEach((item) => {
      const channelId = item.channelId || item.ChannelId;
      if (!channelId) {
        return;
      }
      unreadByChannel.set(channelId, {
        unread: Number(item.unread ?? item.Unread ?? 0),
        mentionCount: Number(item.mentionCount ?? item.MentionCount ?? item.mentionUnread ?? 0),
      });
    });

    document.querySelectorAll('[data-channel-id]').forEach((channelEl) => {
      const unreadState = unreadByChannel.get(channelEl.dataset.channelId) || {
        unread: 0,
        mentionCount: 0,
      };
      const unread = unreadState.unread;
      const mentionCount = unreadState.mentionCount;
      channelEl.classList.toggle('has-unread', unread > 0);
      channelEl.classList.toggle('has-mention', mentionCount > 0);
      channelEl.dataset.unread = unread > 0 ? formatUnreadBadgeLabel(unread) : '';
      channelEl.dataset.unreadLabel =
        mentionCount > 0 ? `@${formatUnreadBadgeLabel(mentionCount)}` : formatUnreadBadgeLabel(unread);
      channelEl.dataset.mentionCount = mentionCount > 0 ? formatUnreadBadgeLabel(mentionCount) : '';
      setUnreadBadgeEntry('server', channelEl.dataset.channelId, unread, mentionCount);
    });
  } catch (error) {
    console.warn('Could not refresh unread indicators:', error);
  }
}

function applyConversationUnreadBadge(element, unread = 0, mentionCount = 0) {
  if (!element) return;

  const normalizedUnread = Math.max(0, Number(unread) || 0);
  const normalizedMentions = Math.max(0, Number(mentionCount) || 0);
  const badge = element.querySelector('.conversation-badge');

  element.classList.toggle('has-unread', normalizedUnread > 0);
  element.classList.toggle('has-mention', normalizedMentions > 0);

  if (!badge) {
    return;
  }

  if (normalizedMentions > 0) {
    badge.textContent = `@${formatUnreadBadgeLabel(normalizedMentions)}`;
    badge.title = `${normalizedMentions} unread mention${normalizedMentions === 1 ? '' : 's'}`;
    badge.classList.remove('is-hidden');
    return;
  }

  if (normalizedUnread > 0) {
    badge.textContent = formatUnreadBadgeLabel(normalizedUnread);
    badge.title = `${normalizedUnread} unread message${normalizedUnread === 1 ? '' : 's'}`;
    badge.classList.remove('is-hidden');
    return;
  }

  badge.textContent = '';
  badge.title = '';
  badge.classList.add('is-hidden');
}

function getUnreadValue(item = {}, key = 'unread') {
  return Number(item[key] ?? item[key.charAt(0).toUpperCase() + key.slice(1)] ?? 0);
}

function escapeCssIdentifier(value) {
  if (window.CSS?.escape) {
    return CSS.escape(String(value));
  }

  return String(value).replace(/["\\]/g, '\\$&');
}

async function refreshDmUnreadBadges() {
  try {
    const response = await axios.get(`${homeApiBase}/api/PrivateMessageFriend/GetUnreadBadges`);
    const badges = Array.isArray(response.data) ? response.data : [];
    const seen = new Set();

    badges.forEach((item) => {
      const targetUsername = item.targetUsername || item.TargetUsername;
      if (!targetUsername) {
        return;
      }
      seen.add(targetUsername.toLowerCase());

      const unread = getUnreadValue(item);
      const mentionCount = getUnreadValue(item, 'mentionCount');
      setUnreadBadgeEntry('dm', targetUsername, unread, mentionCount);
      applyConversationUnreadBadge(
        document.querySelector(`[data-dm-username="${escapeCssIdentifier(targetUsername)}"]`),
        unread,
        mentionCount
      );
    });

    document.querySelectorAll('[data-dm-username]').forEach((item) => {
      const username = item.dataset.dmUsername || '';
      if (!seen.has(username.toLowerCase())) {
        setUnreadBadgeEntry('dm', username, 0, 0);
        applyConversationUnreadBadge(item, 0, 0);
      }
    });
  } catch (error) {
    console.warn('Could not refresh DM unread badges:', error);
  }
}

async function refreshGroupUnreadBadges() {
  try {
    const response = await axios.get(`${homeApiBase}/api/GroupChat/GetUnreadBadges`);
    const badges = Array.isArray(response.data) ? response.data : [];
    const seen = new Set();

    badges.forEach((item) => {
      const groupId = String(item.groupId || item.GroupId || '');
      if (!groupId) {
        return;
      }
      seen.add(groupId.toLowerCase());

      const unread = getUnreadValue(item);
      const mentionCount = getUnreadValue(item, 'mentionCount');
      setUnreadBadgeEntry('group', groupId, unread, mentionCount);
      applyConversationUnreadBadge(
        document.querySelector(`[data-group-id="${escapeCssIdentifier(groupId)}"]`),
        unread,
        mentionCount
      );
    });

    document.querySelectorAll('[data-group-id]').forEach((item) => {
      const groupId = item.dataset.groupId || '';
      if (!seen.has(groupId.toLowerCase())) {
        setUnreadBadgeEntry('group', groupId, 0, 0);
        applyConversationUnreadBadge(item, 0, 0);
      }
    });
  } catch (error) {
    console.warn('Could not refresh group unread badges:', error);
  }
}

function refreshAllUnreadBadges() {
  if (unreadBadgeRefreshPromise) {
    return unreadBadgeRefreshPromise;
  }

  unreadBadgeRefreshPromise = Promise.allSettled([
    refreshUnreadIndicators(),
    refreshDmUnreadBadges(),
    refreshGroupUnreadBadges(),
  ]).finally(() => {
    unreadBadgeRefreshPromise = null;
    syncDesktopUnreadBadgeFromState();
  });

  return unreadBadgeRefreshPromise;
}

function markActiveConversationRead() {
  if (!JWTusername || !isAppWindowFocused()) {
    return;
  }

  if (currentGroupId && isCurrentNotificationContextVisible('group', currentGroupId)) {
    GetGroupMessages(currentGroupId);
    return;
  }

  if (currentFriend && isCurrentNotificationContextVisible('dm', currentFriend)) {
    GetPrivateMessage();
    return;
  }

  if (selectedChannelID && isCurrentNotificationContextVisible('server', selectedChannelID)) {
    fetchServerMessages();
    return;
  }

  refreshAllUnreadBadges();
}

async function fetchServerMessages() {
  try {
    const messageRes = await axios.get(
      `${homeApiBase}/api/ServerMessages/GetServerMessages?channelId=${encodeURIComponent(selectedChannelID)}`
    );
    const messages = Array.isArray(messageRes.data) ? messageRes.data : [];
    notifyPolledMessages(messages, {
      scope: 'server',
      conversationId: selectedChannelID,
      conversationName: getSelectedChannelNotificationName(),
    });
    chatMessages.innerHTML = '';
    messages.forEach((message) => {
      chatMessages.appendChild(renderCompactMessage(message, 'server'));
    });
    await markSelectedChannelRead(messages);
  } catch (e) {
    console.error('couldnt fetch channel messages:', e);
  }
}

let serverMessageInterval = null;
function startServerMessagePolling() {
  stopServerMessagePolling();
  fetchServerMessages();
  serverMessageInterval = setInterval(fetchServerMessages, 2000);
}
function stopServerMessagePolling() {
  if (serverMessageInterval) clearInterval(serverMessageInterval);
  serverMessageInterval = null;
}
function LogOut() {
  axios.post(`${homeApiBase}/api/Account/Logout`).catch((err) => {
    console.warn('Server logout failed:', err);
  }).finally(() => {
    localStorage.removeItem('refreshToken');
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = homeLoginPageUrl;
  });
}
async function ServerChat(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(event.target);
  const messageText = formData.get('userText');

  if (!messageText.trim()) return;

  const messageId = generateUUID();
  const formDataObject = {
    MessageID: messageId,
    ChannelId: selectedChannelID,
    ServerName: currentServerName,
    MessagesUserSender: JWTusername,
    Date: new Date().toLocaleString().toString(),
    userText: messageText,
  };

  const pendingMessage = renderCompactMessage({
    ...formDataObject,
    messagesUserSender: JWTusername,
    userText: messageText,
    date: formDataObject.Date,
  });
  pendingMessage.classList.add('message-pending');
  chatMessages.appendChild(pendingMessage);
  form.querySelector('.chatInput').value = '';

  try {
    await axios.post(
      `${homeApiBase}/api/ServerMessages/ServerMessages`,
      formDataObject
    );

    pendingMessage.classList.remove('message-pending');
    pendingMessage.classList.add('message-delivered');
    await fetchServerMessages();
  } catch (e) {
    console.error('msg send failed:', e);
    pendingMessage.classList.remove('message-pending');
    pendingMessage.classList.add('message-failed');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'message-retry-btn';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => {
      form.querySelector('.chatInput').value = messageText;
      pendingMessage.remove();
      ServerChat({ preventDefault() {}, target: form });
    });
    pendingMessage.appendChild(retry);
    showAppMessage(getApiErrorMessage(e, 'Message failed to send.'), 'error');
  }
}

async function runOptimisticMessageSend({
  container,
  draft,
  send,
  rollbackInput,
  refresh,
  failureMessage = 'Message failed to send.',
}) {
  const pendingMessage = renderCompactMessage(draft);
  pendingMessage.classList.add('message-pending');
  container.appendChild(pendingMessage);
  container.scrollTop = container.scrollHeight;

  try {
    const result = await send();
    pendingMessage.classList.remove('message-pending');
    pendingMessage.classList.add('message-delivered');
    if (typeof refresh === 'function') {
      await refresh(result);
    }
    return result;
  } catch (error) {
    pendingMessage.classList.remove('message-pending');
    pendingMessage.classList.add('message-failed');
    if (typeof rollbackInput === 'function') {
      rollbackInput();
    }
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'message-retry-btn';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => {
      pendingMessage.remove();
      rollbackInput?.();
    });
    pendingMessage.appendChild(retry);
    showAppMessage(getApiErrorMessage(error, failureMessage), 'error');
    throw error;
  }
}
function showAddFriends() {
  clearContent();
  const addDiv = document.querySelector('.addFriendsDiv');
  if (addDiv) showElement(addDiv, 'block');
}

function clearContent() {
  const sections = [
    '.addFriendsDiv',
    '.removeFriendsDiv',
    '.pendingRequestsDiv',
    '.privateMessage',
    '.friendsMainView',
    '#serverDetails'
  ];

  sections.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      hideElement(el);
    });
  });

  // dont need this anymore remove at end
  // const accountElement = document.querySelector('.account');

}

const friendsDiv = document.querySelector('.friendsDiv');
if (friendsDiv) {
  friendsDiv.addEventListener('click', () => {
    showElement('.secondColumn', 'flex');
    showElement('.lastSection', 'flex');
    hideElement('#serverDetails');

    showElement('.nav', 'flex');
    const privateMsg = document.querySelector('.privateMessage');
    if (privateMsg) hideElement(privateMsg);

    ShowFriendsMainView();
  });
}
function showPendingRequests() {
  clearContent();
  const pendingDiv = document.querySelector('.pendingRequestsDiv');
  if (pendingDiv) {
    showElement(pendingDiv, 'block');
    fetchPendingRequests();
  }
}
async function fetchPendingRequests() {
  const pendingList = document.querySelector('.pendingList');
  pendingList.innerHTML = 'Loading...';
  try {
    const res = await axios.get(`${homeApiBase}/api/Account/GetFriendRequests`);
    pendingList.innerHTML = '';

    if (!Array.isArray(res.data) || res.data.length === 0) {
      pendingList.innerHTML = '<p class="no-requests">No pending requests.</p>';
      return;
    }

    res.data.forEach(reqUser => {
      const item = document.createElement('div');
      item.className = 'friend-item';
      item.classList.add('is-static');

      const left = document.createElement('div');
      left.className = 'friend-item-left';

      const avatar = document.createElement('div');
      avatar.className = 'friend-item-avatar';
      setAvatarFallback(avatar);
      avatar.onclick = (e) => openProfilePopout(reqUser, e.pageX, e.pageY);

      const info = document.createElement('div');
      info.className = 'friend-item-info';

      const name = document.createElement('span');
      name.className = 'friend-item-name';
      name.textContent = reqUser;
      name.onclick = (e) => openProfilePopout(reqUser, e.pageX, e.pageY);

      const status = document.createElement('span');
      status.className = 'friend-item-status';
      status.textContent = 'Incoming Friend Request';

      info.appendChild(name);
      info.appendChild(status);
      left.appendChild(avatar);
      left.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'friend-item-actions';

      const acceptBtn = document.createElement('button');
      acceptBtn.className = 'friend-request-btn accept';
      acceptBtn.title = 'Accept';
      acceptBtn.innerHTML = '✓';
      acceptBtn.onclick = () => acceptRequest(reqUser);

      const declineBtn = document.createElement('button');
      declineBtn.className = 'friend-request-btn decline';
      declineBtn.title = 'Decline';
      declineBtn.innerHTML = '✕';
      declineBtn.onclick = () => declineRequest(reqUser);

      actions.appendChild(acceptBtn);
      actions.appendChild(declineBtn);

      item.appendChild(left);
      item.appendChild(actions);
      pendingList.appendChild(item);
    });
  } catch (err) {
    console.error('Error fetching requests:', err);
    pendingList.innerHTML = '<p class="error-state">Error loading requests.</p>';
  }
}
async function acceptRequest(friendUsername) {
  try {
    const res = await axios.post(`${homeApiBase}/api/Account/AcceptFriendRequest?friendUsername=${encodeURIComponent(friendUsername)}`);
    showAppMessage(res.data.message || 'Friend request accepted.', 'success');
    fetchPendingRequests();
    GetFriends();
  } catch (err) {
    console.error(err);
    showAppMessage(getApiErrorMessage(err, 'Failed to accept request.'), 'error');
  }
}
async function declineRequest(friendUsername) {
  try {
    const res = await axios.post(`${homeApiBase}/api/Account/DeclineFriendRequest?friendUsername=${encodeURIComponent(friendUsername)}`);
    showAppMessage(res.data.message || 'Friend request declined.', 'success');
    fetchPendingRequests();
  } catch (err) {
    console.error(err);
    showAppMessage(getApiErrorMessage(err, 'Failed to decline request.'), 'error');
  }
}
async function SearchFriends(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const formDataObject = {};
  formData.forEach((value, key) => {
    formDataObject[key] = value;
  });
  let friendUsername = formDataObject.friendUsername;
  try {
    const res = await axios.post(
      `${homeApiBase}/api/Account/AddFriend?friendUsername=${encodeURIComponent(friendUsername)}`,
      formDataObject
    );
    if (res.data.message) {
      showAppMessage(res.data.message, 'success');
    }
    await GetFriends();
  } catch (e) {
    console.error('friend request failed:', e);
    showAppMessage(getApiErrorMessage(e, 'Could not send friend request.'), 'error');
  }
}

function showDeleteFriend() {
  clearContent();
  const pendingDiv = document.querySelector('.pendingRequestsDiv');
  if (pendingDiv) hideElement(pendingDiv);
  showElement('.removeFriendsDiv', 'block');

}
async function RemoveFriends(event) {
  event.preventDefault();
  try {
    const formData = new FormData(event.target);
    const formDataObject = {};
    formData.forEach((value, key) => {
      formDataObject[key] = value;
    });
    let friendUsername = formDataObject.friendUsername;
    let res = await axios.post(
      `${homeApiBase}/api/Account/RemoveFriend?friendUsername=${encodeURIComponent(friendUsername)}`
    );
    if (res.data.message) {
      showAppMessage(res.data.message, 'success');
    }
    await GetFriends();
  } catch (e) {
    console.error('couldnt remove friend:', e);
    showAppMessage(getApiErrorMessage(e, 'Could not remove friend.'), 'error');
  }
}
async function GetFriends() {
  mainFriendsDiv.innerHTML = '';
  try {
    let res = await axios.get(
      `${homeApiBase}/api/Account/GetFriends`
    );
    if (res.data === 'No Friends Added!' || (Array.isArray(res.data) && res.data.length === 0)) {
      let noFriendsTag = document.createElement('p');
      noFriendsTag.textContent = 'No Friends Added!';
      mainFriendsDiv.appendChild(noFriendsTag);
    } else {
      let friends = res.data;
      console.log('GetFriends response:', friends);
      if (Array.isArray(friends)) {
        friends.forEach((friend) => {
          const friendsTag = document.createElement('button');
          friendsTag.type = 'button';
          friendsTag.className = 'testaddeduser conversation-list-item';
          friendsTag.dataset.dmUsername = friend;

          const label = document.createElement('span');
          label.className = 'conversation-label';
          label.textContent = friend;

          const badge = document.createElement('span');
          badge.className = 'conversation-badge is-hidden';
          badge.setAttribute('aria-hidden', 'true');

          friendsTag.appendChild(label);
          friendsTag.appendChild(badge);
          friendsTag.addEventListener('click', async () => {
            console.log("Friend clicked:", friend);
            clearContent();


            hideAllElements('.pendingRequestsDiv');
            console.log("Pending requests forced hidden");

            currentFriend = friend;
            currentGroupId = null;
            currentGroupName = '';
            setUnreadBadgeEntry('dm', friend, 0, 0);
            applyConversationUnreadBadge(friendsTag, 0, 0);
            InitWebSocket();
            await GetPrivateMessage();
            hideElement('.nav');

            const privateMsg = document.querySelector('.privateMessage');
            if (privateMsg) showElement(privateMsg, 'flex');
            directMessageUser.innerText = currentFriend;
          });
          mainFriendsDiv.appendChild(friendsTag);
        });
      }

      await GetGroups();
      await refreshDmUnreadBadges();
    }
  } catch (e) {
    console.log('private msg handling broke:', e);
  }
}
const socketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

function createMessageElement(sender, text, date) {
  const container = document.createElement('div');
  container.className = 'message-group';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.onclick = (e) => openProfilePopout(sender, e.pageX, e.pageY);
  const content = document.createElement('div');
  content.className = 'message-content';

  const header = document.createElement('div');
  header.className = 'message-header';

  const username = document.createElement('span');
  username.className = 'message-username';
  username.textContent = sender;
  username.onclick = (e) => openProfilePopout(sender, e.pageX, e.pageY);
  const timestamp = document.createElement('span');
  timestamp.className = 'message-timestamp';
  timestamp.textContent = date;

  header.appendChild(username);
  header.appendChild(timestamp);

  const messageText = document.createElement('div');
  messageText.className = 'message-text';

  const imageMatch = text.match(/^\[Image\]\((.*)\)$/);

  if (imageMatch && imageMatch[1]) {
    const img = document.createElement('img');
    img.src = imageMatch[1];
    img.className = 'message-inline-image';
    img.onclick = () => window.open(img.src, '_blank');
    messageText.appendChild(img);
  } else {
    appendMessageTextWithLinks(messageText, text);
  }

  content.appendChild(header);
  content.appendChild(messageText);

  container.appendChild(avatar);
  container.appendChild(content);

  hydrateLinkPreviews(container, text);
  return container;
}

function getChatSocketUrl(mode) {
  const path =
    mode === 'group'
      ? '/api/GroupChat/HandleGroupWebsocket'
      : '/api/PrivateMessageFriend/HandlePrivateWebsocket';
  return withAccessToken(`${homeWsBase}${path}`);
}

function shouldKeepChatSocket(mode) {
  if (!cookieVal) {
    return false;
  }

  if (mode === 'group') {
    return Boolean(currentGroupId);
  }

  return Boolean(currentFriend && !currentGroupId);
}

function closeChatSocket() {
  clearTimer(chatReconnectTimer);
  chatReconnectTimer = null;
  chatSocketGeneration += 1;

  if (socket && socket.readyState !== WebSocket.CLOSED) {
    try {
      socket.close(1000, 'Switching conversation');
    } catch (error) {
      console.warn('Could not close previous chat socket:', error);
    }
  }

  socket = null;
}

function scheduleChatSocketReconnect(mode, reason = 'closed') {
  clearTimer(chatReconnectTimer);
  chatReconnectTimer = null;

  if (!shouldKeepChatSocket(mode)) {
    return;
  }

  if (!navigator.onLine) {
    setAppOfflineState(true, 'Offline. Chat will reconnect when the network returns.');
    return;
  }

  const delay = getReconnectDelay(chatReconnectAttempts, 800, 15000);
  chatReconnectAttempts += 1;
  setAppOfflineState(true, `Chat connection lost. Reconnecting in ${Math.max(1, Math.round(delay / 1000))}s...`);
  console.warn(`Chat socket ${mode} ${reason}; reconnecting in ${delay}ms`);

  chatReconnectTimer = window.setTimeout(() => {
    chatReconnectTimer = null;
    connectChatSocket(mode, { force: true });
  }, delay);
}

async function refreshAfterChatReconnect(mode) {
  try {
    if (mode === 'group') {
      await refreshGroupUnreadBadges();
      if (currentGroupId && isCurrentNotificationContextVisible('group', currentGroupId)) {
        await GetGroupMessages(currentGroupId);
      }

      if (currentGroupId && localGroupStream) {
        sendChatSocketPayload({
          Type: 'user-joined-call',
          GroupId: currentGroupId,
          Sender: JWTusername,
        }, { retry: false });
      }
      return;
    }

    await refreshDmUnreadBadges();
    if (currentFriend && isCurrentNotificationContextVisible('dm', currentFriend)) {
      await GetPrivateMessage();
    }
  } catch (error) {
    console.warn('Could not refresh conversation after socket reconnect:', error);
  }
}

function handleDirectSocketMessage(event) {
  const message = JSON.parse(event.data);
  const sender = getMessageSender(message);
  notifyIncomingChatMessage(message, {
    scope: 'dm',
    conversationId: sender,
    conversationName: sender,
  });

  if (currentGroupId || currentFriend !== sender) {
    refreshDmUnreadBadges();
    return;
  }

  const messagesDisplay = document.querySelector('.messagesDisplay');
  const messageElement = createMessageElement(sender, getMessageText(message), message.date || message.Date);
  messagesDisplay.appendChild(messageElement);
  messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
  currentChatHistory.push({
    privateMessageID: message.PrivateMessageID || message.privateMessageID,
    messagesUserSender: sender,
    friendMessagesData: getMessageText(message),
    date: message.date || message.Date,
  });

  if (isAppWindowFocused() && isCurrentNotificationContextVisible('dm', sender)) {
    markDmRead(sender, message.PrivateMessageID || message.privateMessageID);
  }
}

async function handleGroupSocketMessage(event) {
  const message = JSON.parse(event.data);

  if (message.Type && message.Type !== 'chat') {
    await handleGroupSignaling(message);
    return;
  }

  if (message.GroupId === currentGroupId) {
    const messagesDisplay = document.querySelector('.messagesDisplay');
    notifyIncomingChatMessage(message, {
      scope: 'group',
      conversationId: message.GroupId,
      conversationName: currentGroupName,
    });
    const messageElement = createMessageElement(message.Sender, message.Content, message.Date);
    messagesDisplay.appendChild(messageElement);
    messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
    currentChatHistory.push({
      id: message.Id || message.id,
      messagesUserSender: message.Sender,
      friendMessagesData: message.Content,
      date: message.Date,
    });
    if (isAppWindowFocused() && isCurrentNotificationContextVisible('group', message.GroupId)) {
      markGroupRead(message.GroupId, message.Id || message.id);
    }
  }
}

function connectChatSocket(mode, { force = false } = {}) {
  chatSocketMode = mode;

  if (!shouldKeepChatSocket(mode)) {
    closeChatSocket();
    return null;
  }

  if (!force && socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return socket;
  }

  closeChatSocket();
  const generation = ++chatSocketGeneration;
  const nextSocket = new WebSocket(getChatSocketUrl(mode));
  socket = nextSocket;

  nextSocket.onopen = () => {
    if (generation !== chatSocketGeneration) {
      nextSocket.close();
      return;
    }

    chatReconnectAttempts = 0;
    setAppOfflineState(false, appOffline ? 'Back online.' : '');
    console.log(mode === 'group' ? 'connected to GROUP chat' : 'connected to chat');
    refreshAfterChatReconnect(mode);
  };

  nextSocket.onmessage = (event) => {
    if (generation !== chatSocketGeneration) {
      return;
    }

    Promise.resolve(mode === 'group' ? handleGroupSocketMessage(event) : handleDirectSocketMessage(event))
      .catch((error) => console.error('Could not process chat socket message:', error));
  };

  nextSocket.onerror = (error) => {
    if (generation === chatSocketGeneration) {
      console.warn(`${mode} chat socket error:`, error);
    }
  };

  nextSocket.onclose = (event) => {
    if (generation !== chatSocketGeneration) {
      return;
    }

    socket = null;
    scheduleChatSocketReconnect(mode, `closed (${event.code || 'unknown'})`);
  };

  return nextSocket;
}

function sendChatSocketPayload(payload, { retry = true } = {}) {
  if (isSocketOpen(socket)) {
    try {
      socket.send(JSON.stringify(payload));
      return true;
    } catch (error) {
      console.warn('Chat socket send failed:', error);
    }
  }

  if (retry && chatSocketMode) {
    scheduleChatSocketReconnect(chatSocketMode, 'send attempted while disconnected');
  }

  return false;
}

function InitWebSocket() {
  connectChatSocket('dm', { force: true });
}
async function PrivateMessage(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const input = event.target.querySelector('.chatInput');
  const content = String(formData.get('friendMessagesData') || '').trim();
  if (!content) {
    return;
  }
  const messagesDisplay = document.querySelector('.messagesDisplay');

  if (currentGroupId) {
    if (input) input.value = '';
    await runOptimisticMessageSend({
      container: messagesDisplay,
      draft: {
        sender: JWTusername,
        content,
        date: new Date().toISOString(),
      },
      send: () => apiClient.post(`${homeApiBase}/api/GroupChat/SendGroupMessage`, {
        groupId: currentGroupId,
        content,
      }),
      rollbackInput: () => {
        if (input) input.value = content;
      },
      refresh: () => GetGroupMessages(currentGroupId),
      failureMessage: 'Group message failed to send.',
    }).catch(() => {});
  } else {
    if (!currentFriend) {
      return;
    }
    if (input) input.value = '';
    const messageId = generateUUID();
    const messageObject = {
      PrivateMessageID: messageId,
      MessagesUserSender: JWTusername,
      MessageUserReciver: currentFriend,
      friendMessagesData: content,
      date: new Date().toISOString(),
    };

    await runOptimisticMessageSend({
      container: messagesDisplay,
      draft: {
        privateMessageID: messageId,
        messagesUserSender: JWTusername,
        friendMessagesData: content,
        date: messageObject.date,
      },
      send: async () => {
        return apiClient.post(`${homeApiBase}/api/PrivateMessageFriend/SendPrivateMessage`, messageObject);
      },
      rollbackInput: () => {
        if (input) input.value = content;
      },
      refresh: async (response) => {
        currentChatHistory.push(response?.data || {
          messagesUserSender: JWTusername,
          friendMessagesData: content,
          date: messageObject.date,
        });
        await GetPrivateMessage();
      },
      failureMessage: 'Direct message failed to send.',
    }).catch(() => {});
  }
}

async function markDmRead(targetUsername, lastReadMessageId = null) {
  if (!targetUsername) {
    return;
  }

  await axios.post(`${homeApiBase}/api/PrivateMessageFriend/MarkDmRead`, {
    targetUsername,
    lastReadMessageId,
    lastReadAt: new Date().toISOString(),
  }).catch((error) => console.warn('Could not mark DM read:', error));

  setUnreadBadgeEntry('dm', targetUsername, 0, 0);
  applyConversationUnreadBadge(
    document.querySelector(`[data-dm-username="${escapeCssIdentifier(targetUsername)}"]`),
    0,
    0
  );
}

async function GetPrivateMessage() {
  try {
    const res = await axios.get(
      `${homeApiBase}/api/PrivateMessageFriend/GetPrivateMessage?targetUsername=${encodeURIComponent(currentFriend)}`
    );
    const messagesDisplay = document.querySelector('.messagesDisplay');
    messagesDisplay.innerHTML = '';
    currentChatHistory = res.data;
    res.data.forEach((message) => {
      messagesDisplay.appendChild(renderCompactMessage(message, 'dm'));
    });
    messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
    if (
      res.data.length > 0 &&
      isAppWindowFocused() &&
      isCurrentNotificationContextVisible('dm', currentFriend)
    ) {
      const lastMessage = res.data[res.data.length - 1];
      await markDmRead(currentFriend, lastMessage.privateMessageID || lastMessage.PrivateMessageID);
    } else {
      await refreshDmUnreadBadges();
    }


    const searchInput = document.getElementById('dmSearchInput');
    if (searchInput) {
      searchInput.removeEventListener('input', handleSearchInput);
      searchInput.addEventListener('input', handleSearchInput);
    }

    document.getElementById('home').addEventListener('click', function () {
      showElement('.secondColumn', 'flex');
      showElement('.lastSection', 'flex');
      hideElement('#serverDetails');
      hideElement('.privateMessage');
      showElement('.nav', 'flex');
    });
  } catch (e) {
    console.error('ugh something went wrong with private msgs:', e);
    showAppMessage(getApiErrorMessage(e, 'Could not load this conversation.'), 'error');
  }
}


function handleSearchInput(e) {
  const query = e.target.value.toLowerCase();
  const sidebar = document.getElementById('searchResultsSidebar');
  const resultsList = document.getElementById('searchResultsList');
  const countSpan = document.getElementById('searchResultCount');

  if (!query) {
    hideElement(sidebar);
    return;
  }

  showElement(sidebar, 'flex');
  resultsList.innerHTML = '';

  const results = currentChatHistory.filter(msg =>
    (msg.friendMessagesData && msg.friendMessagesData.toLowerCase().includes(query)) ||
    (msg.messagesUserSender && msg.messagesUserSender.toLowerCase().includes(query))
  );

  countSpan.textContent = `${results.length} RESULTS`;

  if (results.length === 0) {
    const noRes = document.createElement('div');
    noRes.className = 'search-empty-state';
    noRes.textContent = 'No results found.';
    resultsList.appendChild(noRes);
  } else {
    results.forEach(msg => {
      const el = document.createElement('div');
      el.className = 'search-result-item';

      const header = document.createElement('div');
      header.className = 'search-result-item-header';

      const name = document.createElement('span');
      name.className = 'search-result-item-name';
      name.textContent = msg.messagesUserSender;

      const date = document.createElement('span');
      date.className = 'search-result-item-date';
      date.textContent = msg.date;

      header.appendChild(name);
      header.appendChild(date);

      const content = document.createElement('div');
      content.className = 'search-result-item-content';
      content.textContent = msg.friendMessagesData;

      el.appendChild(header);
      el.appendChild(content);



      resultsList.appendChild(el);
    });
  }
}

function closeSearchResults() {
  hideElement('#searchResultsSidebar');
  document.getElementById('dmSearchInput').value = '';
}
GetFriends();
refreshAllUnreadBadges();
setInterval(refreshAllUnreadBadges, 10000);

if (JWTusername) {
  setTimeout(() => {
    initializeVoiceConnection().catch((err) => {
      console.error('Voice bootstrap failed:', err);
    });
  }, 500);
}



function openJoinModal() {
  showElement('.outerJoinModal', 'flex');
  fetchPublicServerListings();
}
function closeJoinModal() {
  hideElement('.outerJoinModal');
}

async function getInviteLink(serverId) {
  try {
    let res = await fetch(
      `${homeApiBase}/api/Server/GetInviteLink?serverId=${encodeURIComponent(serverId)}`,
      {
        headers: getAuthHeaders(),
      }
    );
    if (res.ok) {
      let data = await res.json();
      navigator.clipboard.writeText(data.inviteLink);
      showAppMessage('Invite link copied.', 'success');
    } else {
      showAppMessage('Failed to copy invite link.', 'error');
    }
  } catch (err) {
    console.error('couldnt get invite link:', err);
    showAppMessage(getApiErrorMessage(err, 'Unable to get invite link.'), 'error');
  }
}


async function JoinServer(event) {
  event.preventDefault();
  let serverLink = document.getElementById('serverLinkInput').value.trim();
  try {
    let res = await fetch(`${homeApiBase}/api/Server/JoinServer`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        Username: JWTusername,
        InviteLink: serverLink,
      }),
    });
    if (res.ok) {
      const joinedServerResponse = await res.json();
      closeJoinModal();
      closeModal();

      const existingServerElement = upsertServerListItem(
        joinedServerResponse,
        joinedServerResponse.role || 'user'
      );
      if (existingServerElement) {
        existingServerElement.click();
      }
      return;
    } else {
      const err = await res.json();
      showAppMessage('Unable to join server: ' + (err.message || res.statusText), 'error');
      return;
    }
  } catch (err) {
    console.error('couldnt join server:', err);
    showAppMessage(getApiErrorMessage(err, 'Could not join server.'), 'error');
  }
}

function getServerField(server, camelKey, pascalKey = '') {
  return server?.[camelKey] ?? server?.[pascalKey || (camelKey.charAt(0).toUpperCase() + camelKey.slice(1))];
}

function getServerListingId(server) {
  return getServerField(server, 'serverID', 'ServerID') || getServerField(server, 'serverId', 'ServerId');
}

function normalizeDiscoveryTagValue(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (
    !normalized ||
    normalized.length > 32 ||
    !/^[a-z0-9_.-]+$/.test(normalized)
  ) {
    return '';
  }
  return normalized;
}

function normalizeDiscoveryTags(value) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return [...new Set(rawValues
    .flatMap((item) => String(item || '').split(','))
    .map(normalizeDiscoveryTagValue)
    .filter(Boolean))]
    .sort()
    .slice(0, 8);
}

function formatDiscoveryTagLabel(tag) {
  return normalizeDiscoveryTagValue(tag)
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPublicServerMeta(server) {
  const category = getServerField(server, 'discoveryCategory') || 'community';
  const memberCount = Number(getServerField(server, 'memberCount')) || 0;
  const channelCount = Number(getServerField(server, 'channelCount')) || 0;
  return `${formatRoleName(category)} | ${memberCount} members | ${channelCount} channels`;
}

function renderPublicServerListings(servers = []) {
  const list = document.getElementById('publicServerListings');
  if (!list) return;

  list.innerHTML = '';
  if (!servers.length) {
    const empty = document.createElement('div');
    empty.className = 'publicServerEmpty';
    empty.textContent = 'No public servers found.';
    list.appendChild(empty);
    return;
  }

  servers.forEach((server) => {
    const serverId = getServerListingId(server);
    const row = document.createElement('div');
    row.className = 'publicServerListing';

    const icon = document.createElement('div');
    icon.className = 'publicServerIcon';
    icon.textContent = String(getServerField(server, 'serverName') || '?').trim().slice(0, 1).toUpperCase();

    const details = document.createElement('div');
    details.className = 'publicServerDetails';
    const name = document.createElement('strong');
    name.textContent = getServerField(server, 'serverName') || 'Unnamed server';
    const meta = document.createElement('span');
    meta.textContent = formatPublicServerMeta(server);
    const description = document.createElement('p');
    description.textContent = getServerField(server, 'description') || 'No description yet.';
    details.appendChild(name);
    details.appendChild(meta);
    details.appendChild(description);

    const tags = normalizeDiscoveryTags(getServerField(server, 'discoveryTags') || []);
    if (tags.length) {
      const tagsRow = document.createElement('div');
      tagsRow.className = 'publicServerTags';
      tags.forEach((tag) => {
        const tagChip = document.createElement('span');
        tagChip.className = 'publicServerTag';
        tagChip.textContent = formatDiscoveryTagLabel(tag);
        tagsRow.appendChild(tagChip);
      });
      details.appendChild(tagsRow);
    }

    const joinButton = document.createElement('button');
    joinButton.type = 'button';
    joinButton.className = 'joinButton publicJoinButton';
    const alreadyMember = Boolean(getServerField(server, 'alreadyMember'));
    joinButton.textContent = alreadyMember ? 'Open' : 'Join';
    joinButton.disabled = !serverId;
    joinButton.addEventListener('click', () => joinPublicServerFromListing(serverId, joinButton));

    row.appendChild(icon);
    row.appendChild(details);
    row.appendChild(joinButton);
    list.appendChild(row);
  });
}

async function fetchPublicServerListings() {
  const list = document.getElementById('publicServerListings');
  if (!list) return;

  const searchInput = document.getElementById('serverDiscoverySearch');
  const categorySelect = document.getElementById('serverDiscoveryCategory');
  const tagInput = document.getElementById('serverDiscoveryTag');
  const params = new URLSearchParams({ take: '24' });
  const query = searchInput?.value?.trim();
  const category = categorySelect?.value?.trim();
  const tag = normalizeDiscoveryTagValue(tagInput?.value || '');
  if (query) params.set('query', query);
  if (category) params.set('category', category);
  if (tag) params.set('tag', tag);

  list.innerHTML = '<div class="publicServerEmpty">Loading public servers...</div>';
  try {
    const res = await fetch(`${homeApiBase}/api/Server/DiscoverServers?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(res.statusText || 'Could not load public servers.');
    }

    const data = await res.json();
    renderPublicServerListings(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('couldnt load public servers:', error);
    list.innerHTML = '';
    const failed = document.createElement('div');
    failed.className = 'publicServerEmpty';
    failed.textContent = getApiErrorMessage(error, 'Could not load public servers.');
    list.appendChild(failed);
  }
}

async function joinPublicServerFromListing(serverId, button) {
  if (!serverId) return;

  try {
    setBusyState(button, true, 'Joining...');
    const res = await fetch(`${homeApiBase}/api/Server/JoinPublicServer`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ serverId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.Message || res.statusText || 'Could not join server.');
    }

    const joinedServerResponse = await res.json();
    closeJoinModal();
    closeModal();

    const existingServerElement = upsertServerListItem(
      joinedServerResponse,
      joinedServerResponse.role || 'user'
    );
    if (existingServerElement) {
      existingServerElement.click();
    }
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not join public server.'), 'error');
  } finally {
    setBusyState(button, false);
  }
}



let localStream = null;
function getLocalPreviewVideo() {
  const privateCallUI = document.getElementById('activeCallUI');
  const isPrivateCallOpen = isElementVisible(privateCallUI);
  return isPrivateCallOpen
    ? document.getElementById('localVideo')
    : document.getElementById('serverLocalVideo') || document.getElementById('localVideo');
}
let localVideo = getLocalPreviewVideo();
let serverPeerConnection = null;
let voiceConnection = null;
let currentVoiceUsers = [];
let currentVoiceServerId = sessionStorage.getItem('UserJoined') || null;
let currentVoiceChannelId = sessionStorage.getItem('UserJoinedChannel') || null;
let watchedVoiceServerId = null;
let voiceRosterPollInterval = null;
let voiceConnectionOpenPromise = null;
const voiceUsersByServer = new Map();
let peerConnections = new Map();
let stageAudienceMode = false;
let voiceProcessingState = null;
const PEER_VOLUME_STORAGE_KEY = 'discordClone_peer_volumes_v1';
const CALL_QUALITY_REFRESH_MS = 3500;
const peerVolumeLevels = new Map();
let callQualityMonitorTimer = null;
const VOICE_ACTIVITY_POLL_MS = 90;
const VOICE_ACTIVITY_THRESHOLD = 0.045;
const voiceActivityMonitors = new Map();

function loadPeerVolumeLevels() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PEER_VOLUME_STORAGE_KEY) || '{}');
    Object.entries(parsed || {}).forEach(([peerName, volume]) => {
      const normalizedVolume = normalizeSettingsNumber(volume, 100, 0, 100);
      peerVolumeLevels.set(peerName, normalizedVolume);
    });
  } catch (error) {
    console.warn('Could not load peer volume settings:', error);
  }
}

loadPeerVolumeLevels();

function getPeerVolumeKey(peerName) {
  return String(peerName || 'unknown');
}

function getPeerVolumeDomId(peerName) {
  return getPeerVolumeKey(peerName).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getPeerDisplayName(peerName) {
  if (peerName === 'server-mixed') return 'Server mix';
  return String(peerName || 'Unknown');
}

function persistPeerVolumeLevels() {
  try {
    localStorage.setItem(
      PEER_VOLUME_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(peerVolumeLevels.entries()))
    );
  } catch (error) {
    console.warn('Could not save peer volume settings:', error);
  }
}

function getGlobalOutputVolume() {
  return normalizeSettingsNumber(readSettingsState().sliders?.outputVolume, 100, 0, 100);
}

function getPeerVolume(peerName) {
  return peerVolumeLevels.get(getPeerVolumeKey(peerName)) ?? 100;
}

function getEffectivePeerVolume(peerName) {
  return (getGlobalOutputVolume() / 100) * (getPeerVolume(peerName) / 100);
}

function getRegisteredRemoteMediaElements(peerName) {
  const key = getPeerVolumeKey(peerName);
  const registered = Array.from(document.querySelectorAll('[data-peer-volume-id]'))
    .filter((element) => element.dataset.peerVolumeId === key);
  const legacyElement = document.getElementById(`remote_${peerName}`);
  if (legacyElement && !registered.includes(legacyElement)) {
    registered.push(legacyElement);
  }
  return registered;
}

function applyPeerVolume(peerName) {
  const effectiveVolume = Math.max(0, Math.min(1, getEffectivePeerVolume(peerName)));
  getRegisteredRemoteMediaElements(peerName).forEach((mediaElement) => {
    mediaElement.volume = effectiveVolume;
  });
}

function applyAllPeerVolumes() {
  document.querySelectorAll('[data-peer-volume-id]').forEach((mediaElement) => {
    applyPeerVolume(mediaElement.dataset.peerName || mediaElement.dataset.peerVolumeId);
  });
}

function setPeerVolume(peerName, volume) {
  const normalizedVolume = normalizeSettingsNumber(volume, 100, 0, 100);
  const key = getPeerVolumeKey(peerName);
  peerVolumeLevels.set(key, normalizedVolume);
  persistPeerVolumeLevels();
  applyPeerVolume(peerName);

  document.querySelectorAll(`[data-peer-volume-control-id="${getPeerVolumeDomId(peerName)}"]`)
    .forEach((control) => {
      const slider = control.querySelector('.peer-volume-slider');
      const value = control.querySelector('.peer-volume-value');
      if (slider) slider.value = String(normalizedVolume);
      if (value) value.textContent = `${Math.round(normalizedVolume)}%`;
    });
}

function registerRemoteMediaElement(peerName, mediaElement, context = inferVolumeControlContext(peerName)) {
  if (!mediaElement || peerName === JWTusername) return;
  mediaElement.dataset.remoteMedia = 'true';
  mediaElement.dataset.peerName = getPeerVolumeKey(peerName);
  mediaElement.dataset.peerVolumeId = getPeerVolumeKey(peerName);
  mediaElement.muted = isDeafened;
  applyPeerVolume(peerName);
  startVoiceActivityMonitor(peerName, mediaElement.srcObject, context);
}

function getVolumeControlContainer(context) {
  if (context === 'private') {
    return document.getElementById('privateVolumeControls');
  }
  return document.getElementById('serverVolumeControls');
}

function inferVolumeControlContext(peerName) {
  if (peerName === currentFriend && isPrivateCallActive()) {
    return 'private';
  }
  return 'server';
}

function ensurePeerVolumeControl(peerName, mediaElement, context = inferVolumeControlContext(peerName)) {
  if (!peerName || peerName === JWTusername) return null;
  const container = getVolumeControlContainer(context);
  if (!container) return null;

  const domId = getPeerVolumeDomId(peerName);
  const controlId = `peerVolume_${context}_${domId}`;
  let control = document.getElementById(controlId);
  const currentVolume = getPeerVolume(peerName);

  if (!control) {
    control = document.createElement('label');
    control.id = controlId;
    control.className = 'peer-volume-control';
    control.dataset.peerVolumeControlId = domId;
    control.dataset.peerName = getPeerVolumeKey(peerName);

    const name = document.createElement('span');
    name.className = 'peer-volume-name';
    name.textContent = getPeerDisplayName(peerName);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.className = 'peer-volume-slider';
    slider.setAttribute('aria-label', `${getPeerDisplayName(peerName)} volume`);
    slider.addEventListener('input', () => {
      setPeerVolume(peerName, slider.value);
    });

    const value = document.createElement('span');
    value.className = 'peer-volume-value';

    control.appendChild(name);
    control.appendChild(slider);
    control.appendChild(value);
    container.appendChild(control);
  }

  const slider = control.querySelector('.peer-volume-slider');
  const value = control.querySelector('.peer-volume-value');
  if (slider) slider.value = String(currentVolume);
  if (value) value.textContent = `${Math.round(currentVolume)}%`;

  registerRemoteMediaElement(peerName, mediaElement, context);
  return control;
}

function removePeerVolumeControls(peerName) {
  const domId = getPeerVolumeDomId(peerName);
  document.querySelectorAll(`[data-peer-volume-control-id="${domId}"]`)
    .forEach((control) => control.remove());
}

function clearCallVolumeControls(context) {
  const container = getVolumeControlContainer(context);
  if (container) container.innerHTML = '';
}

function updateRemoteMediaStatus(peerName, stream) {
  const hasVideo = Boolean(stream?.getVideoTracks?.().length);
  const remoteVideoLabel = document.getElementById('remoteVideoLabel');
  const remoteCallStatus = document.getElementById('remoteCallStatus');
  if (remoteVideoLabel) remoteVideoLabel.textContent = getPeerDisplayName(peerName);
  if (remoteCallStatus) remoteCallStatus.textContent = hasVideo ? 'Video' : 'Audio only';
}

function createRemoteVideoTile(peerName, stream) {
  const container = document.getElementById('remoteVideosContainer') || document.querySelector('.videoBox');
  if (!container) return null;

  const domId = getPeerVolumeDomId(peerName);
  document.getElementById(`remote_tile_${domId}`)?.remove();

  const wrapper = document.createElement('div');
  wrapper.id = `remote_tile_${domId}`;
  wrapper.className = 'remote-video-tile';
  wrapper.dataset.peerUiId = domId;

  const video = document.createElement('video');
  video.id = `remote_${peerName}`;
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = stream;
  video.classList.add('videos');

  const label = document.createElement('div');
  label.className = 'call-video-label';
  const name = document.createElement('span');
  name.textContent = getPeerDisplayName(peerName);
  const status = document.createElement('span');
  status.textContent = 'Video';
  label.appendChild(name);
  label.appendChild(status);

  wrapper.appendChild(video);
  wrapper.appendChild(label);
  container.appendChild(wrapper);
  ensurePeerVolumeControl(peerName, video, 'server');
  return video;
}

function createRemoteAudioElement(peerName, stream, context = inferVolumeControlContext(peerName)) {
  let audio = document.getElementById(`remote_${peerName}`);
  if (!audio || audio.tagName !== 'AUDIO') {
    audio?.remove();
    audio = document.createElement('audio');
    audio.id = `remote_${peerName}`;
    audio.autoplay = true;
    audio.controls = false;
    audio.className = 'remote-audio-node';
    document.body.appendChild(audio);
  }

  audio.srcObject = stream;
  registerRemoteMediaElement(peerName, audio, context);
  ensurePeerVolumeControl(peerName, audio, context);
  audio.play?.().catch?.((error) => {
    console.warn(`Could not autoplay audio for ${peerName}:`, error);
  });
  return audio;
}

function getVoiceActivityMonitorKey(peerName, context) {
  return `${context}:${getPeerVolumeKey(peerName)}`;
}

function getVoiceActivityAudioContext() {
  try {
    if (!globalAudioContext) {
      globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return globalAudioContext;
  } catch (error) {
    console.warn('Could not start voice activity analyzer:', error);
    return null;
  }
}

function getVoiceActivityLevel(stream, analyser, buffer) {
  if (!stream?.getAudioTracks?.().some((track) => track.readyState === 'live')) {
    return null;
  }

  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const centeredSample = (buffer[index] - 128) / 128;
    sum += centeredSample * centeredSample;
  }

  return Math.sqrt(sum / buffer.length);
}

function getNormalizedVoiceLevel(level) {
  return Math.max(0, Math.min(1, (level - VOICE_ACTIVITY_THRESHOLD) / 0.18));
}

function setElementVoiceState(element, isSpeaking, level) {
  if (!element) return;
  element.classList.toggle('is-speaking', isSpeaking);
  const voiceLevel = Math.max(0, Math.min(10, Math.round(level * 10)));
  element.classList.remove(...voiceLevelClasses);
  element.classList.add(`voice-level-${voiceLevel}`);
}

function getIdleLocalVoiceStatus() {
  if (isMuted) return 'Muted';
  return isVideoOn ? 'Video on' : 'Audio only';
}

function setLocalVoiceActivityState(isSpeaking, level) {
  document.querySelectorAll('.local-call-tile').forEach((tile) => {
    setElementVoiceState(tile, isSpeaking, level);
  });

  const nextStatus = isSpeaking && !isMuted ? 'Speaking' : getIdleLocalVoiceStatus();
  const localCallStatus = document.getElementById('localCallStatus');
  const serverLocalCallStatus = document.getElementById('serverLocalCallStatus');
  if (localCallStatus) localCallStatus.textContent = nextStatus;
  if (serverLocalCallStatus) serverLocalCallStatus.textContent = nextStatus;
}

function setRemoteVoiceActivityState(peerName, context, isSpeaking, level) {
  const domId = getPeerVolumeDomId(peerName);
  document.querySelectorAll(`[data-peer-volume-control-id="${domId}"]`).forEach((control) => {
    setElementVoiceState(control, isSpeaking, level);
  });

  const remoteTile = document.getElementById(`remote_tile_${domId}`);
  setElementVoiceState(remoteTile, isSpeaking, level);

  if (context === 'private') {
    setElementVoiceState(document.querySelector('.remote-call-tile'), isSpeaking, level);
    const remoteCallStatus = document.getElementById('remoteCallStatus');
    if (remoteCallStatus) {
      const mediaElement = document.getElementById('remoteVideo') || document.getElementById(`remote_${peerName}`);
      const stream = mediaElement?.srcObject;
      const hasVideo = Boolean(stream?.getVideoTracks?.().length);
      remoteCallStatus.textContent = isSpeaking ? 'Speaking' : hasVideo ? 'Video' : 'Audio only';
    }
  }

  if (remoteTile) {
    const status = remoteTile.querySelector('.call-video-label span:last-child');
    if (status) status.textContent = isSpeaking ? 'Speaking' : 'Video';
  }
}

function setVoiceActivityState(peerName, context, isSpeaking, level) {
  if (context === 'local') {
    setLocalVoiceActivityState(isSpeaking, level);
    return;
  }

  setRemoteVoiceActivityState(peerName, context, isSpeaking, level);
}

function startVoiceActivityMonitor(peerName, stream, context = 'server') {
  if (!stream?.getAudioTracks?.().length) return;

  const key = getVoiceActivityMonitorKey(peerName, context);
  const existingMonitor = voiceActivityMonitors.get(key);
  if (existingMonitor?.stream === stream) {
    return;
  }

  stopVoiceActivityMonitor(peerName, context);

  const audioContext = getVoiceActivityAudioContext();
  if (!audioContext) return;
  if (audioContext.state === 'suspended') {
    audioContext.resume?.().catch?.(() => {});
  }

  try {
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.72;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.fftSize);
    let silenceFrames = 0;
    let isSpeaking = false;

    const tick = () => {
      const level = getVoiceActivityLevel(stream, analyser, buffer);
      if (level == null) {
        stopVoiceActivityMonitor(peerName, context);
        return;
      }

      const overThreshold = audioContext.state !== 'suspended' && level >= VOICE_ACTIVITY_THRESHOLD;
      if (overThreshold) {
        silenceFrames = 0;
        isSpeaking = true;
      } else {
        silenceFrames += 1;
        if (silenceFrames >= 4) {
          isSpeaking = false;
        }
      }

      setVoiceActivityState(peerName, context, isSpeaking, getNormalizedVoiceLevel(level));
    };

    const intervalId = window.setInterval(tick, VOICE_ACTIVITY_POLL_MS);
    stream.getAudioTracks().forEach((track) => {
      track.addEventListener('ended', () => stopVoiceActivityMonitor(peerName, context), { once: true });
    });

    voiceActivityMonitors.set(key, {
      analyser,
      intervalId,
      source,
      stream,
      peerName,
      context,
    });
    tick();
  } catch (error) {
    console.warn('Could not monitor voice activity:', error);
  }
}

function stopVoiceActivityMonitor(peerName, context) {
  const key = getVoiceActivityMonitorKey(peerName, context);
  const monitor = voiceActivityMonitors.get(key);
  if (!monitor) return;

  window.clearInterval(monitor.intervalId);
  try {
    monitor.source.disconnect();
  } catch {
  }
  voiceActivityMonitors.delete(key);
  setVoiceActivityState(peerName, context, false, 0);
}

function stopPeerVoiceActivity(peerName) {
  ['private', 'server'].forEach((context) => stopVoiceActivityMonitor(peerName, context));
}

function stopVoiceActivityContext(context) {
  Array.from(voiceActivityMonitors.values())
    .filter((monitor) => monitor.context === context)
    .forEach((monitor) => stopVoiceActivityMonitor(monitor.peerName, monitor.context));
}

function isTurnIceServer(server) {
  const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
  return urls.some((url) => /^turns?:/i.test(String(url || '').trim()));
}

function buildIceServers() {
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  const configuredServers =
    homeAppPaths.turnServers ||
    parseSettingsJson(localStorage.getItem('discordClone_turnServers'), []);

  if (Array.isArray(configuredServers)) {
    configuredServers.forEach((server) => {
      if (server && server.urls) {
        iceServers.push(server);
      }
    });
  }

  return iceServers;
}

const config = {
  iceServers: buildIceServers(),
};

async function refreshIceServersConfig() {
  try {
    const res = await axios.get(`${homeApiBase}/api/VoiceConfig/GetIceServers`);
    const nextIceServers = res.data?.iceServers;
    if (Array.isArray(nextIceServers) && nextIceServers.length > 0) {
      config.iceServers = nextIceServers;
      homeAppPaths.turnServers = nextIceServers.filter(isTurnIceServer);
    }
  } catch (error) {
    console.warn('Could not load TURN/STUN config:', error);
  }
}

function normalizeVoiceUserList(users) {
  return Array.from(new Set((users || []).filter(Boolean)));
}

function getVoiceUsersForServer(serverId) {
  if (!serverId) {
    return [];
  }

  return [...(voiceUsersByServer.get(serverId) || [])];
}

function setVoiceUsersForServer(serverId, users) {
  if (!serverId) {
    return;
  }

  const normalizedUsers = normalizeVoiceUserList(users);
  if (normalizedUsers.length > 0) {
    voiceUsersByServer.set(serverId, normalizedUsers);
  } else {
    voiceUsersByServer.delete(serverId);
  }

  if (currentVoiceServerId === serverId) {
    currentVoiceUsers = normalizedUsers;
  }

  if (selectedServerID === serverId) {
    renderVoiceUserList(normalizedUsers);
  }
}

function addVoiceUserToServer(serverId, username) {
  if (!serverId || !username) {
    return;
  }

  const users = getVoiceUsersForServer(serverId);
  if (!users.includes(username)) {
    users.push(username);
  }

  setVoiceUsersForServer(serverId, users);
}

function removeVoiceUserFromServer(serverId, username) {
  if (!serverId || !username) {
    return;
  }

  const remainingUsers = getVoiceUsersForServer(serverId).filter(
    (user) => user !== username
  );
  setVoiceUsersForServer(serverId, remainingUsers);
}

function renderSelectedServerVoiceUsers() {
  renderVoiceUserList(getVoiceUsersForServer(selectedServerID));
}

async function fetchActiveVoiceUsers(serverId = selectedServerID) {
  if (!serverId) {
    return;
  }

  try {
    const response = await axios.get(
      `${homeApiBase}/api/Signaling/GetActiveUsers?serverId=${encodeURIComponent(serverId)}`
    );
    setVoiceUsersForServer(serverId, normalizeVoiceUserList(response.data));
  } catch (err) {
    console.error('Failed to fetch active voice users:', err);
  }
}

function sendVoiceSocketMessage(message) {
  if (!voiceConnection || voiceConnection.readyState !== WebSocket.OPEN) {
    return false;
  }

  voiceConnection.send(JSON.stringify(message));
  return true;
}

function sendVoiceRosterWatch(serverId) {
  if (!serverId) {
    return false;
  }

  const didSend = sendVoiceSocketMessage({
    Type: 'watch',
    ServerId: serverId,
    Username: JWTusername,
  });

  if (didSend) {
    watchedVoiceServerId = serverId;
  }

  return didSend;
}

function sendVoiceRosterUnwatch(serverId) {
  if (!serverId) {
    return false;
  }

  const didSend = sendVoiceSocketMessage({
    Type: 'unwatch',
    ServerId: serverId,
    Username: JWTusername,
  });

  if (didSend && watchedVoiceServerId === serverId) {
    watchedVoiceServerId = null;
  }

  return didSend;
}

async function watchVoiceServer(serverId) {
  if (!serverId) {
    return;
  }

  try {
    await initializeVoiceConnection();

    if (watchedVoiceServerId && watchedVoiceServerId !== serverId) {
      sendVoiceRosterUnwatch(watchedVoiceServerId);
    }

    if (!sendVoiceRosterWatch(serverId)) {
      await fetchActiveVoiceUsers(serverId);
    }
  } catch (err) {
    console.error('Failed to watch voice roster:', err);
    await fetchActiveVoiceUsers(serverId);
  }
}

function isServerViewOpen() {
  return Boolean(
    selectedServerID &&
    serverDetailsPanel &&
    isElementVisible(serverDetailsPanel)
  );
}

function startVoiceRosterRefresh() {
  if (voiceRosterPollInterval) {
    return;
  }

  voiceRosterPollInterval = setInterval(() => {
    if (!isServerViewOpen()) {
      return;
    }

    if (watchedVoiceServerId !== selectedServerID) {
      watchVoiceServer(selectedServerID).catch((err) => {
        console.error('Voice roster watch refresh failed:', err);
      });
      return;
    }

    fetchActiveVoiceUsers(selectedServerID);
  }, 2000);
}

console.log("%c HOME.JS RELOADED - VERSION 26", "background: red; color: white; font-size: 20px");



let globalAudioContext = null;


function enableAudioPlayback() {
  if (!globalAudioContext) {
    globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (globalAudioContext.state === 'suspended') {
    globalAudioContext.resume().then(() => {
      console.log('audio ready, voice should work');


      document.querySelectorAll('audio[id^="remote_"]').forEach(audio => {
        if (audio.paused) {
          audio.play().catch(err => console.log('couldnt auto play audio again:', err));
        }
      });
    });
  }
}

async function openCreateDMModal() {
  showElement('#createDMModal', 'flex');
  const list = document.getElementById('dmFriendsList');
  list.innerHTML = 'Loading...';

  try {
    let res = await axios.get(
      `${homeApiBase}/api/Account/GetFriends`
    );
    list.innerHTML = '';

    if (!Array.isArray(res.data) || res.data.length === 0) {
      list.innerHTML = '<p class="search-empty-state">No friends found.</p>';
      return;
    }

    res.data.forEach(friend => {
      const div = document.createElement('div');
      div.className = 'dmFriendItem';
      div.innerHTML = `
              <input type="checkbox" class="dmFriendInput" value="${friend}">
              <div class="server-member-avatar default-avatar-bg"></div>
              <span>${friend}</span>
          `;
      div.onclick = (e) => {
        if (e.target.type !== 'checkbox') {
          const cb = div.querySelector('input');
          cb.checked = !cb.checked;
        }
        div.classList.toggle('selected', div.querySelector('input').checked);
      };
      list.appendChild(div);
    });
  } catch (e) {
    console.error(e);
    list.innerHTML = '<p class="error-state">Failed to load friends.</p>';
  }
}

function closeCreateDMModal() {
  hideElement('#createDMModal');
}


async function CreateDM() {
  const selected = Array.from(document.querySelectorAll('.dmFriendInput:checked')).map(cb => cb.value);
  if (selected.length === 0) return;

  closeCreateDMModal();

  if (selected.length > 1) {

    const groupName = selected.join(', ');

    const allMembers = [...selected, JWTusername];
    const uniqueMembers = [...new Set(allMembers)];

    try {
      const res = await axios.post(`${homeApiBase}/api/GroupChat/CreateGroup`, {
        Name: groupName,
        Owner: JWTusername,
        Members: uniqueMembers
      });
      const group = res.data;

      console.log("Created Group:", group);


      OpenGroupChat(group);

      GetFriends();

    } catch (e) {
      console.error("Failed to create group", e);
      showAppMessage(getApiErrorMessage(e, 'Failed to create group.'), 'error');
    }

  } else {

    const friend = selected[0];
    console.log("Creating DM with", friend);

    clearContent();
    currentFriend = friend;
    currentGroupId = null;
    currentGroupName = '';
    setUnreadBadgeEntry('dm', friend, 0, 0);


    showElement('.secondColumn', 'flex');
    showElement('.lastSection', 'flex');
    hideElement('#serverDetails');
    hideElement('.nav');

    showElement('.privateMessage', 'flex');

    if (directMessageUser) directMessageUser.innerText = currentFriend;

    InitWebSocket();
    await GetPrivateMessage();
  }
}

async function GetGroups() {
  try {
    const res = await axios.get(`${homeApiBase}/api/GroupChat/GetGroups`);
    const groups = res.data;


    document.querySelectorAll('.group-chat-item').forEach(e => e.remove());

    if (Array.isArray(groups)) {
      groups.forEach(group => {
        const p = document.createElement('button');
        p.type = 'button';
        p.className = 'group-chat-item conversation-list-item';
        p.dataset.groupId = group.id;

        const label = document.createElement('span');
        label.className = 'conversation-label';
        label.textContent = `Group: ${group.name}`;

        const badge = document.createElement('span');
        badge.className = 'conversation-badge is-hidden';
        badge.setAttribute('aria-hidden', 'true');

        p.appendChild(label);
        p.appendChild(badge);
        p.addEventListener('click', () => {
          setUnreadBadgeEntry('group', group.id, 0, 0);
          applyConversationUnreadBadge(p, 0, 0);
          OpenGroupChat(group);
        });
        mainFriendsDiv.appendChild(p);
      });
      await refreshGroupUnreadBadges();
    }
  } catch (e) {
    console.error("Failed to load groups", e);
  }
}


setInterval(() => {
  if (isElementVisible('.nav')) {
    GetGroups();
  }
}, 5000);

let groupPeerConnections = new Map();
let localGroupStream = null;

function OpenGroupChat(group) {
  clearContent();


  hideAllElements('.pendingRequestsDiv');

  currentGroupId = group.id;
  currentGroupName = group.name || 'Group';
  currentFriend = null;
  currentServerName = null;

  showElement('.secondColumn', 'flex');
  showElement('.lastSection', 'flex');
  hideElement('#serverDetails');
  hideElement('.nav');

  const privateMsg = document.querySelector('.privateMessage');
  if (privateMsg) showElement(privateMsg, 'flex');


  if (directMessageUser) {
    directMessageUser.innerHTML = '';
    const nameSpan = document.createElement('span');
    nameSpan.innerText = group.name;
    directMessageUser.appendChild(nameSpan);


    const callBtn = document.createElement('button');
    callBtn.className = 'group-call-btn';
    callBtn.innerText = '📞 Start Call';
    callBtn.onclick = () => {
      startGroupCall(group.id);
    };
    directMessageUser.appendChild(callBtn);
    renderGroupManagementButtons(directMessageUser, group.id);
  }

  InitGroupWebSocket();
  GetGroupMessages(group.id);
}

function renderGroupManagementButtons(container, groupId) {
  [
    ['Rename', () => renameCurrentGroup(groupId)],
    ['Avatar', () => updateCurrentGroupAvatar(groupId)],
    ['Add', () => addMembersToCurrentGroup(groupId)],
    ['Leave', () => leaveCurrentGroup(groupId)],
  ].forEach(([label, handler]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'group-header-btn';
    button.textContent = label;
    button.addEventListener('click', handler);
    container.appendChild(button);
  });
}

async function renameCurrentGroup(groupId) {
  const name = await askText('Rename Group', 'Group name');
  if (!name) return;

  try {
    await axios.post(`${homeApiBase}/api/GroupChat/RenameGroup`, {
      groupId,
      name,
    });
    await GetGroups();
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not rename group.'), 'error');
  }
}

async function updateCurrentGroupAvatar(groupId) {
  const avatarUrl = await askText('Group Avatar', 'Avatar URL or uploaded /uploads path');

  try {
    await axios.post(`${homeApiBase}/api/GroupChat/UpdateGroupAvatar`, {
      groupId,
      avatarUrl: avatarUrl || null,
    });
    await GetGroups();
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not update group avatar.'), 'error');
  }
}

async function addMembersToCurrentGroup(groupId) {
  const membersText = await askText('Add Members', 'Usernames to add, comma separated');
  if (!membersText) return;

  const members = membersText
    .split(',')
    .map((member) => member.trim())
    .filter(Boolean);

  try {
    await axios.post(`${homeApiBase}/api/GroupChat/AddGroupMembers`, {
      groupId,
      members,
    });
    await GetGroups();
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not add group members.'), 'error');
  }
}

async function leaveCurrentGroup(groupId) {
  if (!await askConfirm('Leave Group DM', 'Leave this group DM?', { danger: true, confirmText: 'Leave' })) return;

  try {
    await axios.post(`${homeApiBase}/api/GroupChat/LeaveGroup`, { groupId });
    currentGroupId = null;
    currentGroupName = '';
    clearContent();
    ShowFriendsMainView();
    await GetGroups();
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not leave group.'), 'error');
  }
}

function InitGroupWebSocket() {
  connectChatSocket('group', { force: true });
}

async function startGroupCall(groupId) {
  if (!isSocketOpen(socket)) {
    connectChatSocket('group');
    showAppMessage('Reconnecting group chat. Try the call again in a moment.', 'error');
    return;
  }

  try {
    localGroupStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    addLocalVideoToGrid(localGroupStream);
  } catch (e) {
    console.error("Failed to get media", e);
    showAppMessage('Could not access camera or microphone.', 'error');
    return;
  }

  sendChatSocketPayload({
    Type: 'call-init',
    GroupId: groupId,
    Sender: JWTusername
  });


  showGroupCallUI();
}

async function handleGroupSignaling(msg) {
  console.log("Group Signal:", msg.Type, msg);

  switch (msg.Type) {
    case 'call-init':
      if (msg.Sender !== JWTusername) {
        notifyIncomingCall(msg.Sender, 'group call');
        if (await askConfirm('Join Group Call', `${msg.Sender} started a group call. Join?`, { confirmText: 'Join' })) {
          joinGroupCall(msg.GroupId, msg.Sender);
        }
      }
      break;
    case 'user-joined-call':
      if (msg.Sender !== JWTusername) {
        initiatePeerConnection(msg.Sender);
      }
      break;
    case 'offer':
      handleGroupOffer(msg);
      break;
    case 'answer':
      handleGroupAnswer(msg);
      break;
    case 'candidate':
      handleGroupCandidate(msg);
      break;
  }
}

async function joinGroupCall(groupId, initiator) {
  try {
    localGroupStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    addLocalVideoToGrid(localGroupStream);
    showGroupCallUI();

    sendChatSocketPayload({
      Type: 'user-joined-call',
      GroupId: groupId,
      Sender: JWTusername
    });


  } catch (e) {
    console.error(e);
  }
}

function showGroupCallUI() {
  let container = document.getElementById('groupVideoGrid');
  if (!container) {
    container = document.createElement('div');
    container.id = 'groupVideoGrid';
    container.className = 'group-video-grid';
    document.body.appendChild(container);

    const closeBtn = document.createElement('button');
    closeBtn.innerText = "Leave Call";
    closeBtn.className = 'group-video-leave';
    closeBtn.onclick = leaveGroupCall;
    container.appendChild(closeBtn);
  }
  showElement(container, 'grid');
}

function leaveGroupCall() {
  const container = document.getElementById('groupVideoGrid');
  if (container) hideElement(container);

  if (localGroupStream) {
    localGroupStream.getTracks().forEach(t => t.stop());
    localGroupStream = null;
  }


  groupPeerConnections.forEach(pc => pc.close());
  groupPeerConnections.clear();

  document.getElementById('groupVideoGrid').innerHTML = '';
}

function addLocalVideoToGrid(stream) {
  const container = document.getElementById('groupVideoGrid') || document.body;
  const vid = document.createElement('video');
  vid.srcObject = stream;
  vid.muted = true;
  vid.autoplay = true;
  vid.className = 'group-video local';

  const wrapper = document.createElement('div');
  wrapper.className = 'group-video-card';
  wrapper.appendChild(vid);


  const label = document.createElement('span');
  label.innerText = 'Me';
  label.className = 'group-video-label';
  wrapper.appendChild(label);

  container.appendChild(wrapper);
}

function addRemoteVideoToGrid(stream, username) {
  const container = document.getElementById('groupVideoGrid');
  if (!container) return;

  const vid = document.createElement('video');
  vid.srcObject = stream;
  vid.autoplay = true;
  vid.className = 'group-video remote';

  const wrapper = document.createElement('div');
  wrapper.className = 'group-video-card';
  wrapper.id = `wrapper-${username}`;
  wrapper.appendChild(vid);

  const label = document.createElement('span');
  label.innerText = username;
  label.className = 'group-video-label';
  wrapper.appendChild(label);

  container.insertBefore(wrapper, container.lastChild);
}



async function initiatePeerConnection(targetUser) {
  console.log("Initiating connection to", targetUser);
  const pc = createGroupPeerConnection(targetUser);
  groupPeerConnections.set(targetUser, pc);

  localGroupStream.getTracks().forEach(track => pc.addTrack(track, localGroupStream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  sendChatSocketPayload({
    Type: 'offer',
    TargetUser: targetUser,
    Sender: JWTusername,
    Data: JSON.stringify(offer)
  });
}

function createGroupPeerConnection(targetUser) {
  const pc = new RTCPeerConnection(config);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendChatSocketPayload({
        Type: 'candidate',
        TargetUser: targetUser,
        Sender: JWTusername,
        Data: JSON.stringify(event.candidate)
      }, { retry: false });
    }
  };

  pc.ontrack = (event) => {
    console.log("Received remote track from", targetUser);
    addRemoteVideoToGrid(event.streams[0], targetUser);
  };

  return pc;
}

async function handleGroupOffer(msg) {
  const targetUser = msg.Sender;
  console.log("Handling offer from", targetUser);

  const pc = createGroupPeerConnection(targetUser);
  groupPeerConnections.set(targetUser, pc);

  if (localGroupStream) {
    localGroupStream.getTracks().forEach(track => pc.addTrack(track, localGroupStream));
  }

  await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(msg.Data)));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  sendChatSocketPayload({
    Type: 'answer',
    TargetUser: targetUser,
    Sender: JWTusername,
    Data: JSON.stringify(answer)
  });
}

async function handleGroupAnswer(msg) {
  const targetUser = msg.Sender;
  const pc = groupPeerConnections.get(targetUser);
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(msg.Data)));
  }
}

async function handleGroupCandidate(msg) {
  const targetUser = msg.Sender;
  const pc = groupPeerConnections.get(targetUser);
  if (pc) {
    await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(msg.Data)));
  }
}

async function markGroupRead(groupId, lastReadMessageId = null) {
  if (!groupId) {
    return;
  }

  await axios.post(`${homeApiBase}/api/GroupChat/MarkGroupRead`, {
    groupId,
    lastReadMessageId,
    lastReadAt: new Date().toISOString(),
  }).catch((error) => console.warn('Could not mark group read:', error));

  setUnreadBadgeEntry('group', groupId, 0, 0);
  applyConversationUnreadBadge(
    document.querySelector(`[data-group-id="${escapeCssIdentifier(groupId)}"]`),
    0,
    0
  );
}

async function GetGroupMessages(groupId) {
  try {
    const res = await axios.get(`${homeApiBase}/api/GroupChat/GetGroupMessages?groupId=${encodeURIComponent(groupId)}`);
    const messagesDisplay = document.querySelector('.messagesDisplay');
    messagesDisplay.innerHTML = '';
    currentChatHistory = res.data.map(m => ({ messagesUserSender: m.sender, friendMessagesData: m.content, date: m.date }));

    res.data.forEach((message) => {
      messagesDisplay.appendChild(renderCompactMessage(message, 'group'));
    });
    messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
    if (
      res.data.length > 0 &&
      isAppWindowFocused() &&
      isCurrentNotificationContextVisible('group', groupId)
    ) {
      const lastMessage = res.data[res.data.length - 1];
      await markGroupRead(groupId, lastMessage.id || lastMessage.Id);
    } else {
      await refreshGroupUnreadBadges();
    }
  } catch (e) {
    console.error('Failed to load group messages', e);
    showAppMessage(getApiErrorMessage(e, 'Failed to load group messages.'), 'error');
  }
}



document.addEventListener('click', enableAudioPlayback, { once: true });
document.addEventListener('keydown', enableAudioPlayback, { once: true });
document.addEventListener('touchstart', enableAudioPlayback, { once: true });


async function initializeVoiceConnection() {
  try {
    if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
      console.log("Voice connection already active");
      return voiceConnectionOpenPromise || Promise.resolve();
    }

    if (voiceConnection && voiceConnection.readyState === WebSocket.CONNECTING) {
      console.log("Voice connection already connecting");
      return voiceConnectionOpenPromise || Promise.resolve();
    }

    voiceConnection = new WebSocket(withAccessToken(`${homeWsBase}/voice-ws`));
    const pendingVoiceConnection = voiceConnection;

    voiceConnectionOpenPromise = new Promise((resolve, reject) => {
      if (pendingVoiceConnection.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const cleanup = () => {
        pendingVoiceConnection.removeEventListener('open', handleOpen);
        pendingVoiceConnection.removeEventListener('error', handleError);
        pendingVoiceConnection.removeEventListener('close', handleCloseBeforeOpen);
      };

      const handleOpen = () => {
        cleanup();
        resolve();
      };

      const handleError = (error) => {
        cleanup();
        reject(error);
      };

      const handleCloseBeforeOpen = () => {
        cleanup();
        reject(new Error('Voice connection closed before opening'));
      };

      pendingVoiceConnection.addEventListener('open', handleOpen);
      pendingVoiceConnection.addEventListener('error', handleError);
      pendingVoiceConnection.addEventListener('close', handleCloseBeforeOpen);
    });

    voiceConnection.onopen = () => {
      console.log('voice chat connected');
      voiceReconnectAttempts = 0;

      watchedVoiceServerId = null;


      voiceConnection.send(JSON.stringify({
        Type: 'identify',
        Username: JWTusername
      }));

      const joinedServer = sessionStorage.getItem('UserJoined');
      if (joinedServer) {
        const joinedChannel = sessionStorage.getItem('UserJoinedChannel');
        currentVoiceServerId = joinedServer;
        currentVoiceChannelId = joinedChannel;
        applyMicrophoneGate();
        console.log(`Re-joining voice for server ${joinedServer} as ${JWTusername}`);
        voiceConnection.send(JSON.stringify({
          Type: 'join',
          ServerId: joinedServer,
          ChannelId: joinedChannel,
          Username: JWTusername
        }));
      }

      if (selectedServerID) {
        sendVoiceRosterWatch(selectedServerID);
      }

      if (isPrivateCallActive()) {
        applyMicrophoneGate();
        renegotiatePrivateCallAfterReconnect().catch((err) => {
          console.warn('Could not renegotiate private call after reconnect:', err);
        });
      }
    };

    voiceConnection.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.Type) {
          case 'user-joined':
            {
              const serverId =
                message.ServerId || currentVoiceServerId || selectedServerID;
              console.log(`${message.Username} joined voice chat in ${serverId}`);
              addVoiceUserToServer(serverId, message.Username);
            }

            if (JWTusername < message.Username) {
              try {
                const peerConnection = await createPeerConnection(message.Username);
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
                  voiceConnection.send(JSON.stringify({
                    Type: 'peer-offer',
                    Data: JSON.stringify(offer),
                    TargetUser: message.Username
                  }));
                }
              } catch (err) {
                console.error('couldnt connect to new user:', err);
              }
            }
            break;

          case 'user-left':
            {
              const serverId =
                message.ServerId || currentVoiceServerId || selectedServerID;
              console.log(`${message.Username} left the voice channel in ${serverId}`);
              removeVoiceUserFromServer(serverId, message.Username);
            }

            removePeerUI(message.Username);

            const peerConnection = peerConnections.get(message.Username);
            if (peerConnection) {
              peerConnection.close();
              peerConnections.delete(message.Username);
            }
            break;

          case 'existing-users':
            {
              const users = normalizeVoiceUserList(JSON.parse(message.Data));
              const serverId =
                message.ServerId || currentVoiceServerId || selectedServerID;
              console.log(`users already in voice chat for ${serverId}:`, users);
              setVoiceUsersForServer(serverId, users);

              if (!serverPeerConnection && users.length > 0) {
                await establishServerConnection();
              }

              for (const existingUser of users) {
                if (existingUser !== JWTusername && JWTusername < existingUser) {
                  try {
                    const peerConnection = await createPeerConnection(existingUser);
                    const offer = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offer);

                    if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
                      voiceConnection.send(JSON.stringify({
                        Type: 'peer-offer',
                        Data: JSON.stringify(offer),
                        TargetUser: existingUser
                      }));
                    }
                  } catch (err) {
                    console.error(`Failed to connect to ${existingUser}:`, err);
                  }
                }
              }
            }
            break;

          case 'users-updated':
            {
              const updatedUsers = normalizeVoiceUserList(JSON.parse(message.Data));
              const serverId =
                message.ServerId || currentVoiceServerId || selectedServerID;
              console.log(`voice channel updated for ${serverId}:`, updatedUsers);
              setVoiceUsersForServer(serverId, updatedUsers);
            }
            break;
          case 'server-offer':
            await handleServerOffer(message.Data);
            break;

          case 'server-answer':
            await handleServerAnswer(message.Data);
            break;

          case 'server-ice-candidate':
            await handleServerIceCandidate(message.Data);
            break;

          case 'peer-offer':
            await handlePeerOffer(message.Username, message.Data, message.IsPrivate, message.IsVideo);
            break;

          case 'peer-answer':
            await handlePeerAnswer(message.Username, message.Data, message.IsPrivate);
            break;

          case 'peer-ice-candidate':
            await handlePeerIceCandidate(message.Username, message.Data);
            break;

          case 'audio-data':
            await handleIncomingAudio(message.Username, message.Data);
            break;

          case 'call-cancel':

            break;

          case 'call-ended':
            console.log(`Call ended by ${message.Username}`);
            if (isElementVisible(activeCallUI)) {
              endPrivateCall(false);
            }
            break;
        }
      } catch (err) {
        console.error('couldnt process voice msg:', err);
      }
    };

    voiceConnection.onerror = (error) => {
      console.error('voice connection broke:', error);
    };

    voiceConnection.onclose = () => {
      console.log('voice disconnected');
      voiceConnection = null;
      voiceConnectionOpenPromise = null;
      watchedVoiceServerId = null;

      scheduleVoiceReconnect();
    };

    return voiceConnectionOpenPromise;


    async function handleServerOffer(offer) {
      console.log('got connection offer from server');
      if (!serverPeerConnection) {
        await createServerPeerConnection();
      }

      await serverPeerConnection.setRemoteDescription(
        new RTCSessionDescription(JSON.parse(offer))
      );
      const answer = await serverPeerConnection.createAnswer();
      await serverPeerConnection.setLocalDescription(answer);

      if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
        voiceConnection.send(
          JSON.stringify({
            Type: 'server-answer',
            Data: JSON.stringify(answer),
          })
        );
      }
    }

    async function handleServerAnswer(answer) {
      console.log('got connection response from server');
      if (serverPeerConnection) {
        await serverPeerConnection.setRemoteDescription(
          new RTCSessionDescription(JSON.parse(answer))
        );
      }
    }

    async function handleServerIceCandidate(candidate) {
      console.log('got network info from server');
      if (serverPeerConnection) {
        try {
          await serverPeerConnection.addIceCandidate(
            new RTCIceCandidate(JSON.parse(candidate))
          );
        } catch (e) {
          console.warn('couldnt process server network info:', e);
        }
      }
    }

    async function handleIncomingAudio(fromUser, audioData) {

      console.log(`receiving audio from ${fromUser}`);
      try {

        const audioBuffer = atob(audioData);
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = audioContext.createBuffer(1, audioBuffer.length, 48000);
        const channelData = buffer.getChannelData(0);

        for (let i = 0; i < audioBuffer.length; i++) {
          channelData[i] = (audioBuffer.charCodeAt(i) - 128) / 128.0;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
      } catch (err) {
        console.error('couldnt play incoming audio:', err);
      }
    }


    async function handlePeerOffer(fromUser, offer, isPrivateCall, isVideo) {


      const isServerPeer = currentVoiceUsers && currentVoiceUsers.includes(fromUser);

      if (isPrivateCall || !isServerPeer) {
        console.log(`Routing offer from ${fromUser} to Private Call Handler (Private=${isPrivateCall}, Video=${isVideo})`);
        if (window.handlePrivatePeerOffer) {
          await window.handlePrivatePeerOffer(fromUser, offer, isVideo);
        } else {
          console.error("handlePrivatePeerOffer not found!");
        }
        return;
      }



      try {
        let peerConnection = peerConnections.get(fromUser);


        if (peerConnection && peerConnection.signalingState !== 'stable' && peerConnection.signalingState !== 'have-local-offer') {
          console.log(`Connection with ${fromUser} is busy (${peerConnection.signalingState}), possibly ignoring offer collision.`);
          return;
        }

        if (!peerConnection) {
          peerConnection = await createPeerConnection(fromUser);
        }

        const remoteDesc = new RTCSessionDescription(JSON.parse(offer));
        if (peerConnection.signalingState === 'have-local-offer' && JWTusername > fromUser) {
          console.log("Ignoring colliding offer from", fromUser);
          return;
        }

        await peerConnection.setRemoteDescription(remoteDesc);
        console.log(`RX SDP: hasVideo=${offer.includes('m=video')}, State=${peerConnection.signalingState}`);

        if (peerConnection.signalingState === 'have-remote-offer') {
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
            voiceConnection.send(JSON.stringify({
              Type: 'peer-answer',
              Data: JSON.stringify(answer),
              TargetUser: fromUser
            }));
          }
        } else {
          console.warn(`Cannot set local answer, state is ${peerConnection.signalingState} (expected have-remote-offer)`);
        }
      } catch (err) {
        console.error('couldnt handle connection request:', err);
      }
    }

    async function handlePeerAnswer(fromUser, answer, isPrivateCall) {
      console.log(`RX Answer from ${fromUser}`);


      const isServerPeer = currentVoiceUsers && currentVoiceUsers.includes(fromUser);
      if (isPrivateCall || !isServerPeer) {
        if (window.handlePeerAnswer) {
          await window.handlePeerAnswer(fromUser, answer);
        } else {
          console.error("Global handlePeerAnswer not found!");
        }
        return;
      }

      try {
        const peerConnection = peerConnections.get(fromUser);
        if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(answer)));
        } else {
          console.log(`connection with ${fromUser} already established, ignoring response`);
        }
      } catch (err) {
        console.error('couldnt handle connection response:', err);
      }
    }

    async function handlePeerIceCandidate(fromUser, candidate) {
      console.log(`network info from ${fromUser}`);
      try {
        const peerConnection = peerConnections.get(fromUser);
        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)));
        }
      } catch (err) {
        console.error('couldnt process network info:', err);
      }
    }

    async function createPeerConnection(userId) {
      console.log(`connecting to ${userId}`);

      const peerConnection = new RTCPeerConnection(config);


      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
      }


      peerConnection.ontrack = (event) => {
        console.log(`hearing ${userId} now`);
        const remoteStream = event.streams[0];
        createRemoteMediaElement(userId, remoteStream);
      };


      peerConnection.onicecandidate = (event) => {
        if (event.candidate && voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
          voiceConnection.send(JSON.stringify({
            Type: 'peer-ice-candidate',
            Data: JSON.stringify(event.candidate),
            TargetUser: userId
          }));
        }
      };


      peerConnection.onconnectionstatechange = () => {
        console.log(`connection with ${userId}: ${peerConnection.connectionState}`);
        updateCallDiagnosticsPanel();
        updateCallQualityWarnings();
        if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
          peerConnections.delete(userId);
          removePeerUI(userId);
        }
      };

      peerConnections.set(userId, peerConnection);
      return peerConnection;
    }
    window.createPeerConnection = createPeerConnection;

    console.log('voice chat system ready');
  } catch (err) {
    console.error('voice chat connection failed:', err);
    voiceConnectionOpenPromise = null;
    throw err;
  }
}


function createRemoteMediaElement(peerName, stream, context = inferVolumeControlContext(peerName)) {
  let existing = document.getElementById('remote_' + peerName);
  if (existing) existing.remove();
  const hasVideo = stream.getVideoTracks().length > 0;
  const hasAudio = stream.getAudioTracks().length > 0;

  console.log(
    `Creating remote media for ${peerName}: video=${hasVideo}, audio=${hasAudio}`
  );



  stream.getTracks().forEach((track, i) => {
    console.log(`Stream track ${i} for ${peerName}: enabled=${track.enabled}, readyState=${track.readyState}, kind=${track.kind}`);

    track.onmute = () => {
      console.log(`Track ${track.kind} muted`);
      if (track.kind === 'video') {
        const privateRemoteVideo = document.getElementById('remoteVideo');
        if (privateRemoteVideo) privateRemoteVideo.srcObject = null;

        const groupVideo = document.getElementById('remote_' + peerName);
        if (groupVideo && groupVideo.tagName === 'VIDEO') groupVideo.srcObject = null;
      }
    };

    track.onunmute = () => {
      console.log(`Track ${track.kind} unmuted`);
      if (track.kind === 'video') {
        const privateRemoteVideo = document.getElementById('remoteVideo');
        if (privateRemoteVideo) privateRemoteVideo.srcObject = stream;

        const groupVideo = document.getElementById('remote_' + peerName);
        if (groupVideo && groupVideo.tagName === 'VIDEO') groupVideo.srcObject = stream;
      }
    };

    track.onended = () => {
      console.log(`Track ${track.kind} ended`);
      if (track.kind === 'video') {
        const privateRemoteVideo = document.getElementById('remoteVideo');
        if (privateRemoteVideo) privateRemoteVideo.srcObject = null;

        const groupVideo = document.getElementById('remote_' + peerName);
        if (groupVideo && groupVideo.tagName === 'VIDEO') groupVideo.srcObject = null;
      }
    };
  });


  const isOwnStream = peerName === JWTusername;
  if (isOwnStream) {
    console.log(`muting your own voice to prevent echo from ${peerName}`);
    return null;
  }

  const privateCallUI = document.getElementById('activeCallUI');
  const privateRemoteVideo = document.getElementById('remoteVideo');

  if (context === 'private' && isElementVisible(privateCallUI) && privateRemoteVideo) {
    console.log(`Redirecting stream from ${peerName} to Private Call Video UI`);
    privateRemoteVideo.srcObject = stream;
    registerRemoteMediaElement(peerName, privateRemoteVideo, 'private');
    ensurePeerVolumeControl(peerName, privateRemoteVideo, 'private');
    updateRemoteMediaStatus(peerName, stream);
    privateRemoteVideo.play?.().catch?.((error) => {
      console.warn(`Could not autoplay private stream for ${peerName}:`, error);
    });
    return privateRemoteVideo;
  }


  if (hasVideo) {
    return createRemoteVideoTile(peerName, stream);
  } else {
    const a = createRemoteAudioElement(peerName, stream, context);

    if (globalAudioContext && globalAudioContext.state === 'suspended') {
      globalAudioContext.resume().then(() => {
        console.log(`Audio system activated for ${peerName}`);
      });
    } else if (!globalAudioContext) {
      enableAudioPlayback();
    }

    a.addEventListener('loadedmetadata', () => {
      console.log(`Audio ready for ${peerName}`);
    });
    a.addEventListener('canplay', () => {
      console.log(`Audio playback ready for ${peerName}`);

      a.play().then(() => {
        console.log(`can hear ${peerName} now`);
        console.log(`Audio status for ${peerName}: paused=${a.paused}, muted=${a.muted}, volume=${a.volume}`);


        setTimeout(() => {
          console.log(`audio check for ${peerName}: currentTime=${a.currentTime}, duration=${a.duration}`);
          if (a.currentTime === 0) {
            console.warn(`${peerName} audio might not be working, no sound detected`);
          }
        }, 1000);
      }).catch(err => {
        console.error(`cannot hear ${peerName}:`, err);

        document.addEventListener('click', () => {
          a.play().catch(e => console.error(`Still cannot hear ${peerName}:`, e));
        }, { once: true });
      });
    });
    a.addEventListener('error', (e) => {
      console.error(`audio broke for ${peerName}:`, e);
    });

    document.body.appendChild(a);
    console.log(`audio working with ${peerName}`);
    return a;
  }
}
function removePeerUI(peerName) {
  let el = document.getElementById('remote_' + peerName);
  if (el) el.remove();
  document.getElementById(`remote_tile_${getPeerVolumeDomId(peerName)}`)?.remove();
  removePeerVolumeControls(peerName);
  stopPeerVoiceActivity(peerName);
  updateCallQualityWarnings();
}

async function createServerPeerConnection() {
  if (serverPeerConnection) {
    serverPeerConnection.close();
  }

  serverPeerConnection = new RTCPeerConnection(config);


  if (localStream) {
    for (const track of localStream.getTracks()) {
      serverPeerConnection.addTrack(track, localStream);
    }
  }


  serverPeerConnection.ontrack = (event) => {
    const stream = event.streams[0];
    console.log('getting audio from server');
    createRemoteMediaElement('server-mixed', stream, 'server');
  };


  serverPeerConnection.onicecandidate = (event) => {
    if (
      event.candidate &&
      voiceConnection &&
      voiceConnection.readyState === WebSocket.OPEN
    ) {
      voiceConnection.send(
        JSON.stringify({
          Type: 'server-ice-candidate',
          Data: JSON.stringify(event.candidate),
        })
      );
    }
  };


  serverPeerConnection.onconnectionstatechange = () => {
    console.log(
      'Server connection state:',
      serverPeerConnection.connectionState
    );
    updateCallDiagnosticsPanel();
    updateCallQualityWarnings();
    if (
      serverPeerConnection.connectionState === 'failed' ||
      serverPeerConnection.connectionState === 'closed' ||
      serverPeerConnection.connectionState === 'disconnected'
    ) {
      console.log('lost connection to server, trying to reconnect');
      setTimeout(() => establishServerConnection(), 2000);
    }
  };

  return serverPeerConnection;
}

async function establishServerConnection() {
  try {
    console.log('connecting to voice server');
    await createServerPeerConnection();


    const offer = await serverPeerConnection.createOffer();
    await serverPeerConnection.setLocalDescription(offer);

    if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
      voiceConnection.send(
        JSON.stringify({
          Type: 'server-offer',
          Data: JSON.stringify(offer),
        })
      );
    }
  } catch (err) {
    console.error('couldnt connect to voice server:', err);
  }
}

function createDistortionCurve(amount = 0) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const drive = Number(amount) * 4;
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + drive) * x * 20 * (Math.PI / 180)) /
      (Math.PI + drive * Math.abs(x));
  }
  return curve;
}

function getAudioConstraints(wantAudio) {
  if (!wantAudio) return false;
  const state = readSettingsState();
  const deviceId = state.selects?.inputDevice;
  return {
    deviceId: deviceId && deviceId !== 'default' ? { exact: deviceId } : undefined,
    echoCancellation: state.toggles?.echoCancellation !== false,
    noiseSuppression: state.toggles?.noiseSuppression !== false,
    autoGainControl: true,
  };
}

function cleanupVoiceProcessing({ restoreRaw = false } = {}) {
  if (!voiceProcessingState) return;

  const { stream, rawTrack, processedTrack, sourceContext } = voiceProcessingState;
  if (stream && restoreRaw && rawTrack?.readyState === 'live') {
    stream.getAudioTracks().forEach((track) => stream.removeTrack(track));
    stream.addTrack(rawTrack);
  }

  if (processedTrack && processedTrack.readyState === 'live') {
    processedTrack.stop();
  }

  if (!restoreRaw && rawTrack?.readyState === 'live') {
    rawTrack.stop();
  }

  sourceContext?.close?.().catch?.(() => {});
  voiceProcessingState = null;
}

function connectVoiceEffectNodes(audioContext, source, destination, settings) {
  const inputGain = audioContext.createGain();
  inputGain.gain.value = normalizeSettingsNumber(readSettingsState().sliders?.inputVolume, 80, 0, 100) / 100;

  const tone = audioContext.createBiquadFilter();
  const formant = Number(settings.formant || 0);
  tone.type = formant >= 0 ? 'highshelf' : 'lowshelf';
  tone.frequency.value = formant >= 0 ? 1400 : 520;
  tone.gain.value = Math.max(-18, Math.min(18, formant * 1.5));

  const pitch = Number(settings.pitch || 0);
  const pitchFilter = audioContext.createBiquadFilter();
  pitchFilter.type = pitch >= 0 ? 'highpass' : 'lowpass';
  pitchFilter.frequency.value = pitch >= 0
    ? 120 + Math.abs(pitch) * 45
    : 3200 - Math.abs(pitch) * 140;

  const shaper = audioContext.createWaveShaper();
  shaper.curve = createDistortionCurve(Number(settings.distortion || 0) / 100);
  shaper.oversample = '4x';

  source.connect(inputGain);
  inputGain.connect(tone);
  tone.connect(pitchFilter);
  pitchFilter.connect(shaper);

  const echoAmount = normalizeSettingsNumber(settings.echo, 0, 0, 100) / 100;
  if (echoAmount > 0.01) {
    const dry = audioContext.createGain();
    dry.gain.value = 1 - echoAmount * 0.35;
    const delay = audioContext.createDelay(0.7);
    delay.delayTime.value = 0.08 + echoAmount * 0.35;
    const wet = audioContext.createGain();
    wet.gain.value = echoAmount * 0.55;

    shaper.connect(dry);
    dry.connect(destination);
    shaper.connect(delay);
    delay.connect(wet);
    wet.connect(destination);
    return;
  }

  shaper.connect(destination);
}

async function applyConfiguredAudioProcessing(stream) {
  const state = readSettingsState();
  const settings = state.voiceChanger || createDefaultSettingsState().voiceChanger;
  const audioTrack = stream.getAudioTracks()[0];

  cleanupVoiceProcessing({ restoreRaw: true });

  if (!audioTrack || !settings.enabled || !settings.perCallEnabled) {
    return stream;
  }

  const sourceContext = new (window.AudioContext || window.webkitAudioContext)();
  const sourceStream = new MediaStream([audioTrack]);
  const source = sourceContext.createMediaStreamSource(sourceStream);
  const destination = sourceContext.createMediaStreamDestination();

  connectVoiceEffectNodes(sourceContext, source, destination, settings);

  const processedTrack = destination.stream.getAudioTracks()[0];
  processedTrack.enabled = audioTrack.enabled;
  stream.removeTrack(audioTrack);
  stream.addTrack(processedTrack);

  voiceProcessingState = {
    stream,
    rawTrack: audioTrack,
    processedTrack,
    sourceContext,
  };

  return stream;
}

async function refreshLocalAudioProcessing() {
  if (!localStream) return;
  await applyConfiguredAudioProcessing(localStream);
  const nextAudioTrack = localStream.getAudioTracks()[0] || null;
  const peerLists = [...peerConnections.values(), serverPeerConnection].filter(Boolean);

  peerLists.forEach((pc) => {
    const sender = pc.getSenders?.().find((s) => s.track?.kind === 'audio');
    sender?.replaceTrack(nextAudioTrack).catch((error) => {
      console.warn('Could not replace processed audio track:', error);
    });
  });
  applyMicrophoneGate();
  startVoiceActivityMonitor('local', localStream, 'local');
}

async function ensureLocalStream(wantAudio = true, wantVideo = false) {
  const localVideo = getLocalPreviewVideo();

  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: getAudioConstraints(wantAudio),
      video: wantVideo,
    });
    await applyConfiguredAudioProcessing(localStream);
    applyMicrophoneGate();
    startVoiceActivityMonitor('local', localStream, 'local');
    if (localVideo) {
      localVideo.srcObject = localStream;
      localVideo.muted = true;
    }

    if (wantAudio) {
      let localAudio = document.getElementById('localAudio');
      if (!localAudio) {
        localAudio = document.createElement('audio');
        localAudio.id = 'localAudio';
        localAudio.autoplay = true;
        localAudio.volume = 0.3;
        localAudio.srcObject = localStream;
        localAudio.muted = false;

        localAudio.addEventListener('loadedmetadata', () => {
          console.log('your microphone is ready');
        });
        localAudio.addEventListener('canplay', () => {
          console.log('audio system ready');
          localAudio.play().then(() => {
            console.log('your microphone is now active');
          }).catch(err => {
            console.error('couldnt turn on mic:', err);

            document.addEventListener('click', () => {
              localAudio.play().then(() => {
                console.log('mic working now after clicking');
              }).catch(e => console.error('mic still not working:', e));
            }, { once: true });
          });
        });
        localAudio.addEventListener('error', (e) => {
          console.error('microphone error:', e);
        });

        document.body.appendChild(localAudio);
        console.log('microphone monitoring enabled');
      }
    }
    applyMicrophoneGate();
    return;
  }

  if (!wantVideo && localStream.getVideoTracks().length > 0) {
    console.log("Stopping video tracks for voice-only call");
    localStream.getVideoTracks().forEach(track => {
      track.stop();
      localStream.removeTrack(track);
    });

    if (localVideo) localVideo.srcObject = localStream;
  }

  if (wantVideo && localStream.getVideoTracks().length === 0) {
    const vs = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoTrack = vs.getVideoTracks()[0];
    localStream.addTrack(videoTrack);
    if (localVideo) {
      localVideo.srcObject = localStream;
      localVideo.muted = true;
    }
    applyMicrophoneGate();
  }
  if (wantAudio && localStream.getAudioTracks().length) {
    startVoiceActivityMonitor('local', localStream, 'local');
  }
}
async function JoinVoiceCalls(channelId = selectedChannelID) {
  enableAudioPlayback();
  try {
    const targetServerId = selectedServerID;
    if (!targetServerId) {
      console.error('please select a server first before joining voice chat');
      return;
    }

    const targetChannel =
      getChannelById(channelId) ||
      currentServerChannels.find((channel) => isVoiceLikeChannelType(channel.type));
    if (!targetChannel || !isVoiceLikeChannelType(targetChannel.type)) {
      showAppMessage('Select a voice or stage channel first.', 'error');
      return;
    }

    const joinedVoiceServerId =
      currentVoiceServerId || sessionStorage.getItem('UserJoined');
    const joinedVoiceChannelId =
      currentVoiceChannelId || sessionStorage.getItem('UserJoinedChannel');
    if (
      joinedVoiceServerId === targetServerId &&
      joinedVoiceChannelId === targetChannel.id &&
      voiceConnection &&
      voiceConnection.readyState === WebSocket.OPEN
    ) {
      console.log('you are already in this voice channel');
      return;
    }

    if (joinedVoiceServerId && (joinedVoiceServerId !== targetServerId || joinedVoiceChannelId !== targetChannel.id)) {
      await leaveVoiceServer(joinedVoiceServerId);
    }

    console.log('setting up voice connection');
    await initializeVoiceConnection();


    await ensureLocalStream(true, false);


    if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
      currentVoiceServerId = targetServerId;
      currentVoiceChannelId = targetChannel.id;
      selectedChannelID = targetChannel.id;
      stageAudienceMode = targetChannel.type === 'stage' && !canCurrentRoleSpeakInStage(targetChannel);
      if (stageAudienceMode) {
        isMuted = true;
      }
      sessionStorage.setItem('UserJoined', targetServerId);
      sessionStorage.setItem('UserJoinedChannel', targetChannel.id);
      applyMicrophoneGate();
      voiceConnection.send(
        JSON.stringify({
          Type: 'join',
          ServerId: targetServerId,
          ChannelId: targetChannel.id,
          Username: JWTusername,
        })
      );
      console.log(`joined ${targetChannel.type} channel ${targetChannel.name} in server: ${targetServerId}`);
      if (stageAudienceMode) {
        showAppMessage('Joined stage as audience.', 'info');
      }
    } else {
      throw new Error('Voice connection not ready after initialization');
    }


    await establishServerConnection();
    startCallQualityMonitor();
    updateCallControlStates();
  } catch (err) {
    console.error('couldnt join voice chat:', err);
  }
}
async function leaveVoiceServer(serverIdToLeave) {
  try {
    const activeServerId =
      serverIdToLeave || currentVoiceServerId || sessionStorage.getItem('UserJoined');
    if (!activeServerId) {
      console.error('cant leave voice, no server picked');
      return;
    }


    if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
      voiceConnection.send(
        JSON.stringify({
          Type: 'leave',
          ServerId: activeServerId,
          ChannelId: currentVoiceChannelId || sessionStorage.getItem('UserJoinedChannel'),
          Username: JWTusername,
        })
      );
      console.log(`left voice in server: ${activeServerId}`);
    }


    if (serverPeerConnection) {
      try {
        serverPeerConnection.close();
      } catch (err) {
        console.error('problem disconnecting from voice server:', err);
      }
      serverPeerConnection = null;
    }


    for (const [user, pc] of peerConnections.entries()) {
      try {
        pc.close();
      } catch (e) {
        console.warn(`Failed to close peer connection for ${user}`, e);
      }
    }
    peerConnections.clear();
    currentVoiceUsers = [];
    currentVoiceServerId = null;
    currentVoiceChannelId = null;
    stageAudienceMode = false;
    pushToTalkActive = false;
    pressedShortcutKeys.clear();
    setVoiceUsersForServer(activeServerId, []);


    const remotes = Array.from(document.querySelectorAll('[id^="remote_"]'));
    remotes.forEach((el) => el.remove());
    document.querySelectorAll('[id^="remote_tile_"]').forEach((el) => el.remove());
    clearCallVolumeControls('server');
    stopVoiceActivityContext('server');


    if (localStream) {
      cleanupVoiceProcessing({ restoreRaw: false });
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
      stopVoiceActivityMonitor('local', 'local');
    }
    localVideo = getLocalPreviewVideo();
    if (localVideo) localVideo.srcObject = null;

    const localAudio = document.getElementById('localAudio');
    if (localAudio) {
      localAudio.remove();
      console.log('microphone monitoring disabled');
    }


    sessionStorage.removeItem('UserJoined');
    sessionStorage.removeItem('UserJoinedChannel');
    renderSelectedServerVoiceUsers();


    isMuted = false;
    isDeafened = false;
    isVideoOn = false;
    await stopScreenShare({ restoreCamera: false });
    updateScreenShareButtons(false);
    updateCallControlStates();
    refreshCallQualityMonitorState();


  } catch (err) {
    console.error('couldnt leave voice chat:', err);
  }
}
async function LeaveCall() {
  await leaveVoiceServer();
}
async function VideoOn() {
  try {
    isVideoOn = true;
    await ensureLocalStream(true, true);


    const localVideo = getLocalPreviewVideo();
    if (localVideo && localStream) {
      localVideo.srcObject = localStream;
      localVideo.muted = true;
    }

    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    for (const pc of peerConnections.values()) {
      const sender = pc
        .getSenders()
        .find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(videoTrack);
      } else {
        pc.addTrack(videoTrack, localStream);
      }

      const offer = await pc.createOffer();
      console.log(`SDP content: hasVideo=${offer.sdp.includes('m=video')}`);
      await pc.setLocalDescription(offer);

      let targetUser = null;
      for (const [user, conn] of peerConnections.entries()) {
        if (conn === pc) {
          targetUser = user;
          break;
        }
      }

      if (targetUser && voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
        console.log(`VideoOn: Sending offer to ${targetUser}`);
        const isPrivate = isPrivatePeerTarget(targetUser);
        voiceConnection.send(JSON.stringify({
          Type: 'peer-offer',
          Data: JSON.stringify(offer),
          TargetUser: targetUser,
          IsPrivate: isPrivate,
          IsVideo: true
        }));
      }
    }
    updateCallControlStates();
  } catch (err) {
    console.error('couldnt enable video:', err);
  }
}
async function VideoOff() {
  isVideoOn = false;
  if (!localStream) {
    updateCallControlStates();
    return;
  }
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) {
    updateCallControlStates();
    return;
  }
  try {
    videoTrack.stop();
  } catch { }
  try {
    localStream.removeTrack(videoTrack);
  } catch (e) {
    console.log('video toggle error:', e);
  }
  for (const pc of peerConnections.values()) {
    const sender = pc
      .getSenders()
      .find((s) => s.track && s.track.kind === 'video');
    if (sender) {
      try {
        sender.replaceTrack(null);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        let targetUser = null;
        for (const [user, conn] of peerConnections.entries()) {
          if (conn === pc) {
            targetUser = user;
            break;
          }
        }

        if (targetUser && voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
          const isPrivate = isPrivatePeerTarget(targetUser);
          voiceConnection.send(JSON.stringify({
            Type: 'peer-offer',
            Data: JSON.stringify(offer),
            TargetUser: targetUser,
            IsPrivate: isPrivate,
            IsVideo: false
          }));
        }

      } catch (e) {
        console.warn('couldnt disable video track:', e);
      }
    }
  }
  const localVideo = getLocalPreviewVideo();
  if (localVideo) localVideo.srcObject = localStream;
  updateCallControlStates();
}
let pushToTalkActive = false;
const pressedShortcutKeys = new Set();

function hasActiveVoiceOrCall() {
  const privateCallUI = document.getElementById('activeCallUI');
  const groupCallUI = document.getElementById('groupCallUI');
  return Boolean(
    localStream &&
    (
      currentVoiceServerId ||
      isElementVisible(privateCallUI) ||
      isElementVisible(groupCallUI)
    )
  );
}

function isPushToTalkMode() {
  return readSettingsState().inputMode === 'push-to-talk';
}

function normalizeShortcutKey(event) {
  if (event.code?.startsWith('Key')) return event.code.slice(3).toUpperCase();
  if (event.code?.startsWith('Digit')) return event.code.slice(5);
  const key = String(event.key || '').toUpperCase();
  if (key === 'CONTROL') return 'CTRL';
  if (key === ' ') return 'SPACE';
  return key;
}

function getPushToTalkShortcut() {
  const keybinds = readSettingsState().keybinds || getDefaultSettingsKeybinds();
  const binding = keybinds.find((item) =>
    String(item.action || '').toLowerCase().includes('push to talk')
  );
  return (binding?.keys || ['CTRL', 'V']).map((key) => String(key).toUpperCase());
}

function isPushToTalkShortcutPressed() {
  const shortcut = getPushToTalkShortcut();
  return shortcut.every((key) => pressedShortcutKeys.has(key));
}

function applyMicrophoneGate() {
  if (!localStream) return;
  const shouldTransmit =
    !isMuted &&
    !stageAudienceMode &&
    (!isPushToTalkMode() || (hasActiveVoiceOrCall() && pushToTalkActive));

  localStream.getAudioTracks().forEach((track) => {
    track.enabled = shouldTransmit;
  });

  document.body?.classList.toggle('push-to-talk-active', Boolean(pushToTalkActive && isPushToTalkMode()));
  updateCallDiagnosticsPanel();
}

function handlePushToTalkKeyChange(event, isDown) {
  if (!isPushToTalkMode()) {
    return;
  }

  const key = normalizeShortcutKey(event);
  if (!key) return;

  if (isDown) {
    pressedShortcutKeys.add(key);
  } else {
    pressedShortcutKeys.delete(key);
  }

  const nextActive = isPushToTalkShortcutPressed();
  if (nextActive !== pushToTalkActive) {
    pushToTalkActive = nextActive;
    applyMicrophoneGate();
  }
}

document.addEventListener('keydown', (event) => handlePushToTalkKeyChange(event, true));
document.addEventListener('keyup', (event) => handlePushToTalkKeyChange(event, false));

function MuteAudio() {
  if (!localStream) return;
  applyMicrophoneGate();

  const localAudio = document.getElementById('localAudio');
  if (localAudio) {
    localAudio.muted = true;
    console.log('mic is muted now');
  }
}
function UnmuteAudio() {
  if (!localStream) return;
  applyMicrophoneGate();

  const localAudio = document.getElementById('localAudio');
  if (localAudio) {
    localAudio.muted = false;
    console.log('your microphone is now unmuted');
  }
}

function updateCallControlStates() {
  document.querySelectorAll('button[onclick="Mute()"]').forEach((btn) => {
    btn.textContent = stageAudienceMode ? 'Audience' : isMuted ? 'Unmute' : 'Mute';
    btn.classList.toggle('active', isMuted);
  });

  document.querySelectorAll('button[onclick="Deafen()"]').forEach((btn) => {
    btn.textContent = isDeafened ? 'Undeafen' : 'Deafen';
    btn.classList.toggle('active', isDeafened);
  });

  document.querySelectorAll('button[onclick="ToggleVideo()"], button[onclick="VideoOn()"], button[onclick="VideoOff()"]').forEach((btn) => {
    if (btn.getAttribute('onclick') === 'ToggleVideo()') {
      btn.textContent = isVideoOn ? 'Stop Video' : 'Video';
      btn.classList.toggle('active', isVideoOn);
    }
  });

  const localCallStatus = document.getElementById('localCallStatus');
  const serverLocalCallStatus = document.getElementById('serverLocalCallStatus');
  const videoLabel = isVideoOn ? 'Video on' : 'Audio only';
  if (localCallStatus) localCallStatus.textContent = isMuted ? 'Muted' : videoLabel;
  if (serverLocalCallStatus) serverLocalCallStatus.textContent = stageAudienceMode ? 'Audience' : isMuted ? 'Muted' : videoLabel;
}

let isMuted = false;
function Mute() {
  isMuted = !isMuted;
  if (isMuted) {
    MuteAudio();
  } else {
    UnmuteAudio();
  }
  updateCallControlStates();
}

let isDeafened = false;
function Deafen() {
  isDeafened = !isDeafened;
  const remotes = document.querySelectorAll('[data-remote-media="true"], audio[id^="remote_"], video[id^="remote_"], #remoteVideo');
  remotes.forEach(audio => {
    audio.muted = isDeafened;
  });

  if (isDeafened && !isMuted) {
    Mute();
  } else {
    updateCallControlStates();
  }
}

let isVideoOn = false;
function ToggleVideo() {
  isVideoOn = !isVideoOn;

  if (isVideoOn) {
    VideoOn();
  } else {
    VideoOff();
  }
  updateCallControlStates();
}

let screenShareState = null;
const outgoingVideoSenders = new WeakMap();

function getPeerTargetForConnection(peerConnection) {
  for (const [user, connection] of peerConnections.entries()) {
    if (connection === peerConnection) return user;
  }
  return null;
}

function isPrivatePeerTarget(targetUser) {
  return Boolean(targetUser && isPrivateCallActive() && targetUser === currentFriend);
}

async function renegotiatePrivateCallAfterReconnect() {
  if (!isPrivateCallActive() || !currentFriend || !voiceConnection || voiceConnection.readyState !== WebSocket.OPEN) {
    return;
  }

  const peerConnection = peerConnections.get(currentFriend);
  if (!peerConnection || peerConnection.signalingState !== 'stable') {
    return;
  }

  if (JWTusername && currentFriend && JWTusername > currentFriend) {
    return;
  }

  let offer;
  try {
    offer = await peerConnection.createOffer({ iceRestart: true });
  } catch {
    offer = await peerConnection.createOffer();
  }
  await peerConnection.setLocalDescription(offer);

  const hasVideo = Boolean(localStream?.getVideoTracks?.().length);
  voiceConnection.send(JSON.stringify({
    Type: 'peer-offer',
    Data: JSON.stringify({ type: offer.type, sdp: offer.sdp, isVideo: hasVideo }),
    TargetUser: currentFriend,
    IsPrivate: true,
    IsVideo: hasVideo
  }));
}

async function sendVideoRenegotiation(peerConnection) {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  if (!voiceConnection || voiceConnection.readyState !== WebSocket.OPEN) {
    return;
  }

  if (peerConnection === serverPeerConnection) {
    voiceConnection.send(JSON.stringify({
      Type: 'server-offer',
      Data: JSON.stringify(offer),
    }));
    return;
  }

  const targetUser = getPeerTargetForConnection(peerConnection);
  if (targetUser) {
    const isPrivate = isPrivatePeerTarget(targetUser);
    voiceConnection.send(JSON.stringify({
      Type: 'peer-offer',
      Data: JSON.stringify(offer),
      TargetUser: targetUser,
      IsPrivate: isPrivate,
      IsVideo: offer.sdp?.includes('m=video') || false
    }));
  }
}

async function replaceOutgoingVideoTrack(videoTrack) {
  const connections = [...peerConnections.values(), serverPeerConnection].filter(Boolean);
  await Promise.all(connections.map(async (pc) => {
    let sender = outgoingVideoSenders.get(pc);
    if (sender && !pc.getSenders().includes(sender)) {
      sender = null;
      outgoingVideoSenders.delete(pc);
    }

    if (!sender) {
      sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    }

    if (sender) {
      await sender.replaceTrack(videoTrack);
    } else if (videoTrack && localStream) {
      sender = pc.addTrack(videoTrack, localStream);
    }

    if (sender) {
      outgoingVideoSenders.set(pc, sender);
    }
    await sendVideoRenegotiation(pc);
  }));
}

function updateScreenShareButtons(isSharing = Boolean(screenShareState)) {
  document
    .querySelectorAll('[data-action="screen-share"], button[onclick="ShareScreen()"]')
    .forEach((btn) => {
      btn.textContent = isSharing ? 'Stop Sharing' : 'Share Screen';
      btn.classList.toggle('active', isSharing);
      btn.title = isSharing ? 'Stop screen sharing' : 'Share screen';
    });
  document.querySelectorAll('.screen-swap-btn').forEach((btn) => {
    btn.classList.toggle('visible', isSharing);
    btn.disabled = !isSharing;
  });
}

async function stopScreenShare({ restoreCamera = true } = {}) {
  if (!screenShareState) {
    updateScreenShareButtons(false);
    return;
  }

  const { stream, track, cameraWasOn } = screenShareState;
  screenShareState = null;

  try {
    track.onended = null;
    track.stop();
    stream.getTracks().forEach((mediaTrack) => {
      if (mediaTrack !== track) mediaTrack.stop();
    });
  } catch (error) {
    console.warn('Could not stop screen share cleanly:', error);
  }

  if (localStream) {
    localStream.getVideoTracks().forEach((videoTrack) => {
      try {
        localStream.removeTrack(videoTrack);
        videoTrack.stop();
      } catch { }
    });
  }

  let nextVideoTrack = null;
  if (restoreCamera && cameraWasOn) {
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      nextVideoTrack = cameraStream.getVideoTracks()[0] || null;
      if (nextVideoTrack && localStream) {
        localStream.addTrack(nextVideoTrack);
      }
      isVideoOn = Boolean(nextVideoTrack);
    } catch (error) {
      console.warn('Could not restore camera after screen share:', error);
      isVideoOn = false;
    }
  } else {
    isVideoOn = false;
  }

  await replaceOutgoingVideoTrack(nextVideoTrack);
  const previewVideo = getLocalPreviewVideo();
  if (previewVideo && localStream) {
    previewVideo.srcObject = localStream;
    previewVideo.muted = true;
  }
  updateScreenShareButtons(false);
  updateCallDiagnosticsPanel();
}

async function ShareScreen() {
  if (screenShareState) {
    await stopScreenShare({ restoreCamera: true });
    return;
  }

  try {
    await ensureLocalStream(true, false);
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const screenTrack = screenStream.getVideoTracks()[0];
    const cameraWasOn = Boolean(localStream?.getVideoTracks().length || isVideoOn);


    if (localStream) {
      localStream.getVideoTracks().forEach((videoTrack) => {
        videoTrack.stop();
        localStream.removeTrack(videoTrack);
      });
      localStream.addTrack(screenTrack);

      const localVideo = getLocalPreviewVideo();
      if (localVideo) {
        localVideo.srcObject = localStream;
        localVideo.muted = true;
      }
    }

    screenShareState = { stream: screenStream, track: screenTrack, cameraWasOn };
    updateScreenShareButtons(true);
    await replaceOutgoingVideoTrack(screenTrack);
    screenTrack.onended = () => {
      stopScreenShare({ restoreCamera: true }).catch((error) => {
        console.error('Could not stop screen share:', error);
      });
    };
    updateCallDiagnosticsPanel();

  } catch (err) {
    console.error("Error sharing screen:", err);
    showAppMessage(getApiErrorMessage(err, 'Could not share your screen.'), 'error');
  }
}

async function SwapScreenShare() {
  await stopScreenShare({ restoreCamera: false });
  await ShareScreen();
}

window.Mute = Mute;
window.Deafen = Deafen;
window.ShareScreen = ShareScreen;
window.SwapScreenShare = SwapScreenShare;
window.JoinVoiceCalls = JoinVoiceCalls;
window.LeaveCall = LeaveCall;
window.VideoOn = VideoOn;
window.VideoOff = VideoOff;
window.ToggleVideo = ToggleVideo;
window.MuteAudio = MuteAudio;
window.UnmuteAudio = UnmuteAudio;


function logToScreen(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

async function collectPeerStats(peerConnection) {
  if (!peerConnection?.getStats) {
    return {};
  }

  const stats = await peerConnection.getStats();
  const summary = {
    bytesSent: 0,
    bytesReceived: 0,
    packetsReceived: 0,
    packetsLost: 0,
    jitter: null,
    framesDropped: 0,
    framesDecoded: 0,
    availableOutgoingBitrate: null,
    currentRoundTripTime: null,
    candidatePairState: '',
  };

  stats.forEach((report) => {
    if (report.type === 'outbound-rtp') summary.bytesSent += report.bytesSent || 0;
    if (report.type === 'inbound-rtp') {
      summary.bytesReceived += report.bytesReceived || 0;
      summary.packetsReceived += report.packetsReceived || 0;
      summary.packetsLost += report.packetsLost || 0;
      if (typeof report.jitter === 'number') {
        summary.jitter = Math.max(summary.jitter || 0, report.jitter);
      }
      summary.framesDropped += report.framesDropped || 0;
      summary.framesDecoded += report.framesDecoded || 0;
    }
    if (
      report.type === 'candidate-pair' &&
      (report.selected || (report.nominated && report.state === 'succeeded'))
    ) {
      summary.currentRoundTripTime = report.currentRoundTripTime ?? null;
      summary.candidatePairState = report.state || '';
      summary.availableOutgoingBitrate = report.availableOutgoingBitrate ?? null;
    }
  });

  return summary;
}

function getPeerQualityContext(peerName) {
  if (peerName === 'server-mixed' || peerName === 'server mix') {
    return 'server';
  }
  if (peerName === currentFriend && isPrivateCallActive()) {
    return 'private';
  }
  return currentVoiceServerId || sessionStorage.getItem('UserJoined') ? 'server' : 'private';
}

function getSeverityRank(severity) {
  if (severity === 'critical') return 2;
  if (severity === 'warning') return 1;
  return 0;
}

function evaluatePeerQuality(peer) {
  const messages = [];
  let severity = 'good';
  const stats = peer.stats || {};
  const peerLabel = getPeerDisplayName(peer.user === 'server mix' ? 'server-mixed' : peer.user);

  const mark = (nextSeverity, message) => {
    if (getSeverityRank(nextSeverity) > getSeverityRank(severity)) {
      severity = nextSeverity;
    }
    messages.push({ severity: nextSeverity, message });
  };

  if (['failed', 'closed'].includes(peer.connectionState) || ['failed', 'closed'].includes(peer.iceConnectionState)) {
    mark('critical', `${peerLabel} connection failed. Try leaving and rejoining the call.`);
  } else if (['disconnected'].includes(peer.connectionState) || ['disconnected'].includes(peer.iceConnectionState)) {
    mark('critical', `${peerLabel} disconnected. Reconnecting may restore audio.`);
  } else if (['connecting', 'checking'].includes(peer.connectionState) || ['checking'].includes(peer.iceConnectionState)) {
    mark('warning', `${peerLabel} is still connecting.`);
  }

  const rttMs = typeof stats.currentRoundTripTime === 'number'
    ? Math.round(stats.currentRoundTripTime * 1000)
    : null;
  if (rttMs !== null) {
    if (rttMs >= 800) {
      mark('critical', `${peerLabel} latency is very high (${rttMs}ms).`);
    } else if (rttMs >= 400) {
      mark('warning', `${peerLabel} latency is elevated (${rttMs}ms).`);
    }
  }

  const totalPackets = (stats.packetsReceived || 0) + (stats.packetsLost || 0);
  const packetLossPercent = totalPackets > 0
    ? Math.round(((stats.packetsLost || 0) / totalPackets) * 100)
    : 0;
  if (packetLossPercent >= 12) {
    mark('critical', `${peerLabel} is dropping ${packetLossPercent}% of incoming packets.`);
  } else if (packetLossPercent >= 5) {
    mark('warning', `${peerLabel} is dropping ${packetLossPercent}% of incoming packets.`);
  }

  const jitterMs = typeof stats.jitter === 'number' ? Math.round(stats.jitter * 1000) : null;
  if (jitterMs !== null) {
    if (jitterMs >= 80) {
      mark('critical', `${peerLabel} audio jitter is very high (${jitterMs}ms).`);
    } else if (jitterMs >= 40) {
      mark('warning', `${peerLabel} audio jitter is elevated (${jitterMs}ms).`);
    }
  }

  if (
    peer.connectionState === 'connected' &&
    stats.bytesReceived === 0 &&
    stats.packetsReceived === 0
  ) {
    mark('warning', `${peerLabel} is connected but no media has arrived yet.`);
  }

  return {
    ...peer,
    context: getPeerQualityContext(peer.user),
    severity,
    messages,
  };
}

function getWorstQuality(evaluations) {
  return evaluations.reduce(
    (worst, item) => getSeverityRank(item.severity) > getSeverityRank(worst) ? item.severity : worst,
    'good'
  );
}

function renderCallQualitySummary(elementId, evaluations, active) {
  const element = document.getElementById(elementId);
  if (!element) return;

  if (!active) {
    element.dataset.quality = 'idle';
    element.textContent = elementId === 'serverCallQualitySummary' ? 'Not connected' : 'Connecting';
    return;
  }

  if (!evaluations.length) {
    element.dataset.quality = 'warning';
    element.textContent = 'Connecting';
    return;
  }

  const worst = getWorstQuality(evaluations);
  element.dataset.quality = worst;
  element.textContent =
    worst === 'critical'
      ? 'Connection unstable'
      : worst === 'warning'
        ? 'Quality warning'
        : 'Call quality good';
}

function renderCallQualityWarnings(containerId, evaluations) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const messages = evaluations.flatMap((evaluation) => evaluation.messages);
  container.innerHTML = '';
  container.classList.toggle('has-warnings', messages.length > 0);

  messages.slice(0, 4).forEach((item) => {
    const warning = document.createElement('div');
    warning.className = `call-quality-warning ${item.severity === 'critical' ? 'critical' : ''}`.trim();
    warning.textContent = item.message;
    container.appendChild(warning);
  });
}

async function collectCallQualityEvaluations() {
  const peerEntries = [...peerConnections.entries()];
  const peerStats = await Promise.all(peerEntries.map(async ([user, pc]) => ({
    user,
    connectionState: pc.connectionState,
    iceConnectionState: pc.iceConnectionState,
    signalingState: pc.signalingState,
    stats: await collectPeerStats(pc),
  })));

  if (serverPeerConnection) {
    peerStats.push({
      user: 'server-mixed',
      connectionState: serverPeerConnection.connectionState,
      iceConnectionState: serverPeerConnection.iceConnectionState,
      signalingState: serverPeerConnection.signalingState,
      stats: await collectPeerStats(serverPeerConnection),
    });
  }

  return peerStats.map(evaluatePeerQuality);
}

async function updateCallQualityWarnings() {
  try {
    const evaluations = await collectCallQualityEvaluations();
    const privateActive = isPrivateCallActive();
    const serverActive = Boolean(currentVoiceServerId || sessionStorage.getItem('UserJoined') || serverPeerConnection);
    const privateEvaluations = evaluations.filter((item) => item.context === 'private');
    const serverEvaluations = evaluations.filter((item) => item.context === 'server');

    renderCallQualitySummary('privateCallQualitySummary', privateEvaluations, privateActive);
    renderCallQualityWarnings('privateCallQualityWarnings', privateActive ? privateEvaluations : []);
    renderCallQualitySummary('serverCallQualitySummary', serverEvaluations, serverActive);
    renderCallQualityWarnings('serverCallQualityWarnings', serverActive ? serverEvaluations : []);
  } catch (error) {
    console.warn('Could not update call quality warnings:', error);
  }
}

function hasActiveCallQualityTarget() {
  return Boolean(
    isPrivateCallActive() ||
    currentVoiceServerId ||
    sessionStorage.getItem('UserJoined') ||
    peerConnections.size ||
    serverPeerConnection
  );
}

function startCallQualityMonitor() {
  window.clearInterval(callQualityMonitorTimer);
  updateCallQualityWarnings();
  callQualityMonitorTimer = window.setInterval(updateCallQualityWarnings, CALL_QUALITY_REFRESH_MS);
}

function refreshCallQualityMonitorState() {
  if (hasActiveCallQualityTarget()) {
    startCallQualityMonitor();
    return;
  }

  window.clearInterval(callQualityMonitorTimer);
  callQualityMonitorTimer = null;
  renderCallQualitySummary('privateCallQualitySummary', [], false);
  renderCallQualityWarnings('privateCallQualityWarnings', []);
  renderCallQualitySummary('serverCallQualitySummary', [], false);
  renderCallQualityWarnings('serverCallQualityWarnings', []);
}

async function buildCallDiagnostics() {
  const serverDiagnostics = await apiClient
    .get(`${homeApiBase}/api/VoiceConfig/GetDiagnostics`)
    .then((res) => res.data)
    .catch(() => null);
  const peerEntries = [...peerConnections.entries()];
  const peerStats = await Promise.all(peerEntries.map(async ([user, pc]) => ({
    user,
    connectionState: pc.connectionState,
    iceConnectionState: pc.iceConnectionState,
    signalingState: pc.signalingState,
    stats: await collectPeerStats(pc),
  })));

  if (serverPeerConnection) {
    peerStats.push({
      user: 'server mix',
      connectionState: serverPeerConnection.connectionState,
      iceConnectionState: serverPeerConnection.iceConnectionState,
      signalingState: serverPeerConnection.signalingState,
      stats: await collectPeerStats(serverPeerConnection),
    });
  }

  const localAudio = localStream?.getAudioTracks?.()[0] || null;
  const localVideoTrack = localStream?.getVideoTracks?.()[0] || null;

  return {
    generatedAt: new Date().toLocaleTimeString(),
    websocket: voiceConnection ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][voiceConnection.readyState] : 'CLOSED',
    selectedServerID,
    currentVoiceServerId,
    currentVoiceChannelId,
    watchedVoiceServerId,
    users: currentVoiceUsers,
    inputMode: readSettingsState().inputMode,
    pushToTalkActive,
    muted: isMuted,
    deafened: isDeafened,
    screenSharing: Boolean(screenShareState),
    stageAudienceMode,
    localAudio: localAudio ? `${localAudio.readyState} enabled=${localAudio.enabled}` : 'none',
    localVideo: localVideoTrack ? `${localVideoTrack.readyState} enabled=${localVideoTrack.enabled}` : 'none',
    ice: serverDiagnostics,
    peers: peerStats,
  };
}

function renderCallDiagnostics(diagnostics) {
  const panel = document.getElementById('callDiagnosticsPanel');
  if (!panel || !diagnostics) return;

  const rows = [
    ['Updated', diagnostics.generatedAt],
    ['Voice socket', diagnostics.websocket],
    ['Server', diagnostics.currentVoiceServerId || diagnostics.selectedServerID || 'none'],
    ['Voice channel', diagnostics.currentVoiceChannelId || 'none'],
    ['Roster watch', diagnostics.watchedVoiceServerId || 'none'],
    ['Users', diagnostics.users.length ? diagnostics.users.join(', ') : 'none'],
    ['Input mode', diagnostics.inputMode],
    ['PTT', diagnostics.pushToTalkActive ? 'pressed' : 'idle'],
    ['Mute / Deafen', `${diagnostics.muted ? 'muted' : 'unmuted'} / ${diagnostics.deafened ? 'deafened' : 'listening'}`],
    ['Stage mode', diagnostics.stageAudienceMode ? 'audience' : 'speaker/free'],
    ['Screen share', diagnostics.screenSharing ? 'active' : 'off'],
    ['Local audio', diagnostics.localAudio],
    ['Local video', diagnostics.localVideo],
    ['ICE servers', diagnostics.ice ? `${diagnostics.ice.iceServerCount} total, ${diagnostics.ice.turnServerCount} TURN` : 'unavailable'],
    ['TURN ready', diagnostics.ice?.turnCredentialReady ? 'yes' : 'no'],
  ];

  panel.innerHTML = '';
  rows.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'diagnostics-row';
    const key = document.createElement('span');
    key.textContent = label;
    const val = document.createElement('strong');
    val.textContent = value;
    row.appendChild(key);
    row.appendChild(val);
    panel.appendChild(row);
  });

  const peerList = document.createElement('div');
  peerList.className = 'diagnostics-peer-list';
  diagnostics.peers.forEach((peer) => {
    const item = document.createElement('div');
    item.className = 'diagnostics-peer';
    const rtt = peer.stats.currentRoundTripTime == null
      ? 'n/a'
      : `${Math.round(peer.stats.currentRoundTripTime * 1000)}ms`;
    item.textContent = `${peer.user}: ${peer.connectionState}, ICE ${peer.iceConnectionState}, RTT ${rtt}, lost ${peer.stats.packetsLost}`;
    peerList.appendChild(item);
  });
  if (!diagnostics.peers.length) {
    peerList.textContent = 'No peer connections yet.';
  }
  panel.appendChild(peerList);
}

async function updateCallDiagnosticsPanel() {
  const panel = document.getElementById('callDiagnosticsPanel');
  if (!panel) return;
  try {
    renderCallDiagnostics(await buildCallDiagnostics());
  } catch (error) {
    panel.textContent = getApiErrorMessage(error, 'Could not load diagnostics.');
  }
}

function startCallDiagnosticsAutoRefresh() {
  updateCallDiagnosticsPanel();
  window.clearInterval(startCallDiagnosticsAutoRefresh.timer);
  startCallDiagnosticsAutoRefresh.timer = window.setInterval(updateCallDiagnosticsPanel, 3000);
}

const SERVER_VERIFICATION_LEVELS = [
  { value: 'none', label: 'None - unrestricted' },
  { value: 'low', label: 'Low - verified email' },
  { value: 'medium', label: 'Medium - registered 5+ minutes' },
  { value: 'high', label: 'High - member 10+ minutes' },
  { value: 'highest', label: 'Highest - verified phone' },
];
const MAX_SERVER_RULE_MINUTES = 525600;
const MAX_SERVER_WELCOME_ITEMS = 6;
const DEFAULT_SERVER_WELCOME_CHECKLIST = [
  'Read the welcome message',
  'Say hello in the general channel',
  'Join a voice channel when you are ready',
];
const ROLE_PERMISSION_DEFINITIONS = [
  { key: 'canManageServer', label: 'Manage server', group: 'Management' },
  { key: 'canManageChannels', label: 'Manage channels', group: 'Management' },
  { key: 'canManageMembers', label: 'Manage members', group: 'Management' },
  { key: 'canBanMembers', label: 'Ban members', group: 'Management' },
  { key: 'canCreateInvites', label: 'Create invites', group: 'Access' },
  { key: 'canSendMessages', label: 'Send messages', group: 'Access' },
  { key: 'canJoinVoice', label: 'Join voice', group: 'Access' },
];
const DEFAULT_ROLE_SORT_ORDER = {
  owner: 0,
  admin: 1,
  moderator: 2,
  user: 100,
};

function getServerVerificationLabel(level) {
  return SERVER_VERIFICATION_LEVELS.find((item) => item.value === level)?.label || 'None';
}

function normalizeServerRuleMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.min(MAX_SERVER_RULE_MINUTES, Math.floor(minutes)));
}

function parseServerRuleMinutes(value) {
  if (String(value || '').trim() === '') return 0;
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > MAX_SERVER_RULE_MINUTES) {
    return null;
  }
  return Math.floor(minutes);
}

function applyServerRuleState(server = {}) {
  currentServerVerificationLevel = server.verificationLevel || currentServerVerificationLevel || 'none';
  currentServerRequireVerifiedEmail = Boolean(server.requireVerifiedEmail);
  currentServerMinimumAccountAgeMinutes = normalizeServerRuleMinutes(server.minimumAccountAgeMinutes);
  currentServerMinimumMembershipMinutes = normalizeServerRuleMinutes(server.minimumMembershipMinutes);
  currentServerRequireTwoFactorForModerators = Boolean(server.requireTwoFactorForModerators);
}

function applyServerListingState(server = {}) {
  currentServerIsPublic = Boolean(server.isPublic);
  currentServerDescription = server.description || '';
  currentServerDiscoveryCategory = server.discoveryCategory || '';
  currentServerDiscoveryTags = normalizeDiscoveryTags(server.discoveryTags || []);
}

function normalizeServerWelcomeChecklist(value) {
  const rawValues = Array.isArray(value)
    ? value
    : String(value || '').split(/[\n,]+/);

  const checklist = rawValues
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, MAX_SERVER_WELCOME_ITEMS);

  return checklist.length ? checklist : [...DEFAULT_SERVER_WELCOME_CHECKLIST];
}

function applyServerWelcomeState(server = {}) {
  currentServerWelcomeEnabled = server.welcomeEnabled ?? server.WelcomeEnabled ?? true;
  currentServerWelcomeMessage = server.welcomeMessage ?? server.WelcomeMessage ?? '';
  currentServerWelcomeChecklist = normalizeServerWelcomeChecklist(
    server.welcomeChecklist ?? server.WelcomeChecklist ?? []
  );
  currentServerOnboardingCompletedAt =
    server.onboardingCompletedAt ?? server.OnboardingCompletedAt ?? null;
}

function formatServerRulesSummary() {
  const rules = [`Verification: ${getServerVerificationLabel(currentServerVerificationLevel)}`];
  if (currentServerRequireVerifiedEmail) {
    rules.push('Email required');
  }
  if (currentServerMinimumAccountAgeMinutes > 0) {
    rules.push(`Account ${currentServerMinimumAccountAgeMinutes}+ min`);
  }
  if (currentServerMinimumMembershipMinutes > 0) {
    rules.push(`Member ${currentServerMinimumMembershipMinutes}+ min`);
  }
  if (currentServerRequireTwoFactorForModerators) {
    rules.push('Moderator/admin 2FA');
  }
  return rules.join(' | ');
}

function formatServerListingSummary() {
  const visibility = currentServerIsPublic ? 'Public listing' : 'Private listing';
  const category = currentServerDiscoveryCategory
    ? `Category: ${formatRoleName(currentServerDiscoveryCategory)}`
    : 'No category';
  const tags = currentServerDiscoveryTags.length
    ? `Tags: ${currentServerDiscoveryTags.map(formatDiscoveryTagLabel).join(', ')}`
    : 'No tags';
  return `${visibility} | ${category} | ${tags}`;
}

function formatServerWelcomeSummary() {
  const status = currentServerWelcomeEnabled ? 'Welcome on' : 'Welcome off';
  const checklistCount = currentServerWelcomeChecklist.length;
  return `${status} | ${checklistCount} onboarding ${checklistCount === 1 ? 'step' : 'steps'}`;
}

function normalizeRoleName(value) {
  return String(value || 'user').trim().toLowerCase().replace(/\s+/g, '-');
}

function formatRoleName(value) {
  return normalizeRoleName(value)
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'User';
}

function pascalizeRolePermissionKey(key) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function getRoleProperty(role = {}, key, fallback = '') {
  const pascalKey = pascalizeRolePermissionKey(key);
  return role[key] ?? role[pascalKey] ?? fallback;
}

function getServerRoleId(role = {}) {
  return String(getRoleProperty(role, 'id', '') || '');
}

function getServerRoleName(role = {}) {
  return normalizeRoleName(getRoleProperty(role, 'name', 'user'));
}

function getServerRolePosition(role = {}) {
  const position = Number(getRoleProperty(role, 'position', 0));
  return Number.isFinite(position) ? position : 0;
}

function normalizeServerRole(role = {}) {
  const normalizedRole = {
    id: getServerRoleId(role),
    name: getServerRoleName(role),
    position: getServerRolePosition(role),
  };

  ROLE_PERMISSION_DEFINITIONS.forEach(({ key }) => {
    normalizedRole[key] = Boolean(getRoleProperty(role, key, false));
  });

  if (role.isDraft) {
    normalizedRole.isDraft = true;
  }

  return normalizedRole;
}

function sortServerRoles(roles = []) {
  return [...roles].sort((a, b) => {
    const aName = getServerRoleName(a);
    const bName = getServerRoleName(b);
    const aRank = DEFAULT_ROLE_SORT_ORDER[aName] ?? getServerRolePosition(a) + 10;
    const bRank = DEFAULT_ROLE_SORT_ORDER[bName] ?? getServerRolePosition(b) + 10;
    return aRank - bRank || getServerRolePosition(a) - getServerRolePosition(b) || aName.localeCompare(bName);
  });
}

function getRoleSortPosition(roleName = 'user') {
  const normalizedRole = normalizeRoleName(roleName);
  const cachedRole = currentServerRoles.find((role) => getServerRoleName(role) === normalizedRole);
  return DEFAULT_ROLE_SORT_ORDER[normalizedRole] ?? (cachedRole ? cachedRole.position + 10 : 50);
}

function getRoleEnabledPermissionLabels(role = {}) {
  return ROLE_PERMISSION_DEFINITIONS
    .filter(({ key }) => Boolean(role[key]))
    .map(({ label }) => label);
}

function getRolePermissionSummary(role = {}) {
  const labels = getRoleEnabledPermissionLabels(role);
  if (!labels.length) {
    return 'No permissions';
  }

  if (labels.length <= 2) {
    return labels.join(', ');
  }

  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}

function canManageRolesFromRoleList(roles = currentServerRoles) {
  const currentRoleName = getCurrentServerRoleName();
  if (currentRoleName === 'owner') {
    return true;
  }

  const role = roles.find((item) => getServerRoleName(item) === currentRoleName);
  return Boolean(role?.canManageServer);
}

async function fetchServerRoles({ force = false, silent = false } = {}) {
  if (!selectedServerID) {
    currentServerRoles = [];
    return [];
  }

  if (!force && currentServerRoles.length) {
    return currentServerRoles;
  }

  const serverId = selectedServerID;
  try {
    const response = await axios.get(
      `${homeApiBase}/api/Server/GetRoles?serverId=${encodeURIComponent(serverId)}`
    );
    const roles = sortServerRoles((Array.isArray(response.data) ? response.data : []).map(normalizeServerRole));
    if (selectedServerID === serverId) {
      currentServerRoles = roles;
    }
    return roles;
  } catch (error) {
    if (!silent) {
      showAppMessage(getApiErrorMessage(error, 'Could not load roles.'), 'error');
    }
    throw error;
  }
}

function isVoiceLikeChannelType(type) {
  return type === 'voice' || type === 'stage';
}

function getChannelTypeIcon(type) {
  if (type === 'stage') return '[S]';
  if (type === 'voice') return '[V]';
  return '#';
}

function parseRoleNameList(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeRoleName).filter(Boolean);
  }

  if (!value) {
    return [];
  }

  try {
    return (JSON.parse(value) || []).map(normalizeRoleName).filter(Boolean);
  } catch {
    return [];
  }
}

function getChannelById(channelId) {
  return currentServerChannels.find((channel) => channel.id === channelId) || null;
}

function getCurrentServerRoleName() {
  return normalizeRoleName(currentServerRole || 'user');
}

function canCurrentRoleSpeakInStage(channel) {
  if (!channel || channel.type !== 'stage') {
    return true;
  }

  const role = getCurrentServerRoleName();
  if (role === 'owner') {
    return true;
  }

  if (!channel.stageSpeakerRestricted) {
    return true;
  }

  return parseRoleNameList(channel.stageSpeakerRolesJson).includes(role);
}

function renderServerManagementControls(container) {
  if (!container || !selectedServerID) return;

  const summary = document.createElement('div');
  summary.className = 'server-verification-summary';
  summary.textContent = formatServerRulesSummary();
  container.appendChild(summary);

  const listingSummary = document.createElement('div');
  listingSummary.className = 'server-verification-summary';
  listingSummary.textContent = formatServerListingSummary();
  container.appendChild(listingSummary);

  const welcomeSummary = document.createElement('div');
  welcomeSummary.className = 'server-verification-summary';
  welcomeSummary.textContent = formatServerWelcomeSummary();
  container.appendChild(welcomeSummary);

  const tools = document.createElement('div');
  tools.className = 'server-management-tools';

  const actions = [
    ['+ Channel', createChannelFromPrompt],
    ['+ Category', createCategoryFromPrompt],
    ['Roles', openRolesAndPermissionsDialog],
    ['Voice Perms', () => openVoiceChannelPermissionsDialog()],
    ['Invite', createLimitedInviteFromPrompt],
    ['Listing', updatePublicListingFromPrompt],
    ['Welcome', updateServerWelcomeFromPrompt],
    ['Rules', updateServerVerificationFromPrompt],
    ['Reports', openServerReportsDialog],
    ['Audit', openAuditLogsDialog],
    ['Leave', leaveSelectedServer],
  ];

  actions.forEach(([label, handler]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'server-tool-btn';
    button.textContent = label;
    button.addEventListener('click', handler);
    tools.appendChild(button);
  });

  container.appendChild(tools);
}

async function updatePublicListingFromPrompt() {
  const values = await openSimpleFormDialog({
    title: 'Public Listing',
    description: 'Public servers appear in discovery and can be joined without an invite link.',
    fields: [
      {
        name: 'isPublic',
        label: 'Visibility',
        value: currentServerIsPublic ? 'true' : 'false',
        options: [
          { value: 'false', label: 'Private' },
          { value: 'true', label: 'Public' },
        ],
      },
      {
        name: 'discoveryCategory',
        label: 'Category',
        value: currentServerDiscoveryCategory || '',
        options: [
          { value: '', label: 'No category' },
          { value: 'community', label: 'Community' },
          { value: 'gaming', label: 'Gaming' },
          { value: 'education', label: 'Education' },
          { value: 'music', label: 'Music' },
          { value: 'tech', label: 'Tech' },
        ],
      },
      {
        name: 'discoveryTags',
        label: 'Tags (comma separated)',
        maxLength: 180,
        required: false,
        value: currentServerDiscoveryTags.join(', '),
      },
      {
        name: 'description',
        label: 'Listing description',
        type: 'textarea',
        rows: 4,
        maxLength: 240,
        required: false,
        value: currentServerDescription || '',
      },
    ],
    confirmText: 'Save',
  });

  if (!values) return;
  const isPublic = values.isPublic === 'true';
  const description = values.description?.trim() || '';
  if (isPublic && !description) {
    showAppMessage('Add a short description before making the server public.', 'error');
    return;
  }

  try {
    const discoveryTags = normalizeDiscoveryTags(values.discoveryTags || '');
    const res = await axios.post(`${homeApiBase}/api/Server/UpdatePublicListing`, {
      serverId: selectedServerID,
      isPublic,
      description,
      discoveryCategory: values.discoveryCategory || '',
      discoveryTags,
    });
    applyServerListingState(res.data || {
      isPublic,
      description,
      discoveryCategory: values.discoveryCategory || '',
      discoveryTags,
    });
    await fetchServerDetails();
    showAppMessage(isPublic ? 'Server listed publicly.' : 'Server listing is private.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not update public listing.'), 'error');
  }
}

async function updateServerWelcomeFromPrompt() {
  const values = await openSimpleFormDialog({
    title: 'Welcome Screen',
    description: 'Choose what new members see the first time they open this server.',
    fields: [
      {
        name: 'welcomeEnabled',
        label: 'Welcome screen',
        value: currentServerWelcomeEnabled ? 'true' : 'false',
        options: [
          { value: 'true', label: 'On' },
          { value: 'false', label: 'Off' },
        ],
      },
      {
        name: 'welcomeMessage',
        label: 'Welcome message',
        type: 'textarea',
        rows: 4,
        maxLength: 600,
        required: false,
        value: currentServerWelcomeMessage || '',
      },
      {
        name: 'welcomeChecklist',
        label: 'Onboarding steps (one per line)',
        type: 'textarea',
        rows: 6,
        maxLength: 760,
        required: false,
        value: currentServerWelcomeChecklist.join('\n'),
      },
    ],
    confirmText: 'Save',
  });

  if (!values) return;

  const welcomeEnabled = values.welcomeEnabled === 'true';
  const welcomeChecklist = normalizeServerWelcomeChecklist(values.welcomeChecklist || '');

  try {
    const res = await axios.post(`${homeApiBase}/api/Server/UpdateWelcomeScreen`, {
      serverId: selectedServerID,
      welcomeEnabled,
      welcomeMessage: values.welcomeMessage || '',
      welcomeChecklist,
    });
    applyServerWelcomeState(res.data || {
      welcomeEnabled,
      welcomeMessage: values.welcomeMessage || '',
      welcomeChecklist,
    });
    await fetchServerDetails();
    showAppMessage('Welcome screen updated.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not update the welcome screen.'), 'error');
  }
}

function getServerWelcomeStorageKey(serverId = selectedServerID) {
  return `mydiscord.serverWelcome.${JWTusername || 'guest'}.${serverId || 'unknown'}`;
}

function hasLocallyCompletedServerWelcome(serverId = selectedServerID) {
  try {
    return localStorage.getItem(getServerWelcomeStorageKey(serverId)) === 'done';
  } catch {
    return false;
  }
}

function markServerWelcomeCompleteLocally(serverId = selectedServerID) {
  try {
    localStorage.setItem(getServerWelcomeStorageKey(serverId), 'done');
  } catch {
    // Local storage can be unavailable in hardened webviews; server completion still applies.
  }
}

function shouldShowServerWelcomeScreen() {
  return Boolean(
    selectedServerID &&
    currentServerWelcomeEnabled &&
    !currentServerOnboardingCompletedAt &&
    !hasLocallyCompletedServerWelcome(selectedServerID) &&
    !document.querySelector('.server-welcome-overlay')
  );
}

function maybeOpenServerWelcomeScreen() {
  if (shouldShowServerWelcomeScreen()) {
    openServerWelcomeScreen();
  }
}

function getServerWelcomeMessage() {
  return currentServerWelcomeMessage ||
    `Welcome to ${currentServerName || 'this server'}. Start with the suggested steps below and jump into a channel when you are ready.`;
}

function getWelcomeRecommendedChannels() {
  const picks = [];
  const firstText = currentServerChannels.find((channel) => channel.type === 'text');
  const firstVoice = currentServerChannels.find((channel) => channel.type === 'voice');
  const firstStage = currentServerChannels.find((channel) => channel.type === 'stage');
  [firstText, firstVoice, firstStage].forEach((channel) => {
    if (channel && !picks.some((item) => item.id === channel.id)) {
      picks.push(channel);
    }
  });
  return picks;
}

function closeServerWelcomeScreen() {
  document.querySelectorAll('.server-welcome-overlay').forEach((overlay) => overlay.remove());
}

async function completeSelectedServerOnboarding() {
  if (!selectedServerID) return;
  const serverId = selectedServerID;
  currentServerOnboardingCompletedAt = new Date().toISOString();
  markServerWelcomeCompleteLocally(serverId);

  try {
    await axios.post(`${homeApiBase}/api/Server/CompleteOnboarding`, {
      serverId,
    });
  } catch (error) {
    console.warn('Could not sync onboarding completion:', error);
  }
}

function selectWelcomeChannel(channel, preview = false) {
  if (!channel?.id) return;
  if (!preview) {
    completeSelectedServerOnboarding();
  }
  closeServerWelcomeScreen();

  const channelEl = document.querySelector(
    `[data-channel-id="${escapeCssIdentifier(channel.id)}"]`
  );
  if (channelEl) {
    channelEl.click();
  }
}

function renderWelcomeStepPills(container, activeIndex, onSelect = () => {}) {
  ['Welcome', 'Get Started'].forEach((label, index) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'server-welcome-step-pill';
    pill.classList.toggle('active', index === activeIndex);
    pill.textContent = label;
    pill.addEventListener('click', () => onSelect(index));
    container.appendChild(pill);
  });
}

function openServerWelcomeScreen({ preview = false } = {}) {
  closeAccountActionDialog();
  closeServerWelcomeScreen();

  const overlay = document.createElement('div');
  overlay.className = 'account-action-overlay server-welcome-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'server-welcome-dialog';

  const header = document.createElement('div');
  header.className = 'server-welcome-header';

  const icon = document.createElement('div');
  icon.className = 'server-welcome-icon';
  icon.textContent = String(currentServerName || '?').trim().slice(0, 1).toUpperCase();

  const headingWrap = document.createElement('div');
  const eyebrow = document.createElement('div');
  eyebrow.className = 'server-welcome-eyebrow';
  eyebrow.textContent = preview ? 'Preview' : 'Server welcome';
  const heading = document.createElement('h3');
  heading.textContent = currentServerName || 'Welcome';
  headingWrap.appendChild(eyebrow);
  headingWrap.appendChild(heading);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'server-welcome-close';
  closeButton.textContent = 'x';
  closeButton.addEventListener('click', async () => {
    if (!preview) {
      await completeSelectedServerOnboarding();
    }
    closeServerWelcomeScreen();
  });

  header.appendChild(icon);
  header.appendChild(headingWrap);
  header.appendChild(closeButton);

  const tabs = document.createElement('div');
  tabs.className = 'server-welcome-steps';

  const body = document.createElement('div');
  body.className = 'server-welcome-body';

  const footer = document.createElement('div');
  footer.className = 'server-welcome-footer';
  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'account-action-cancel';
  backButton.textContent = 'Back';
  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'account-action-submit';

  let activeScreen = 0;

  const renderScreen = () => {
    tabs.innerHTML = '';
    body.innerHTML = '';
    renderWelcomeStepPills(tabs, activeScreen, (screenIndex) => {
      activeScreen = screenIndex;
      renderScreen();
    });

    if (activeScreen === 0) {
      const message = document.createElement('p');
      message.className = 'server-welcome-message';
      message.textContent = getServerWelcomeMessage();

      const meta = document.createElement('div');
      meta.className = 'server-welcome-meta';
      [
        `${currentServerChannels.filter((channel) => channel.type === 'text').length} text channels`,
        `${currentServerChannels.filter((channel) => isVoiceLikeChannelType(channel.type)).length} voice spaces`,
        `${currentServerWelcomeChecklist.length} onboarding steps`,
      ].forEach((item) => {
        const chip = document.createElement('span');
        chip.textContent = item;
        meta.appendChild(chip);
      });

      body.appendChild(message);
      body.appendChild(meta);
    } else {
      const checklist = document.createElement('div');
      checklist.className = 'server-welcome-checklist';
      currentServerWelcomeChecklist.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'server-welcome-check-item';
        const marker = document.createElement('span');
        marker.textContent = String(index + 1);
        const text = document.createElement('p');
        text.textContent = item;
        row.appendChild(marker);
        row.appendChild(text);
        checklist.appendChild(row);
      });
      body.appendChild(checklist);

      const channelList = document.createElement('div');
      channelList.className = 'server-welcome-channels';
      getWelcomeRecommendedChannels().forEach((channel) => {
        const channelButton = document.createElement('button');
        channelButton.type = 'button';
        channelButton.className = 'server-welcome-channel';
        channelButton.textContent = `${getChannelTypeIcon(channel.type)} ${channel.name}`;
        channelButton.addEventListener('click', () => selectWelcomeChannel(channel, preview));
        channelList.appendChild(channelButton);
      });
      if (channelList.children.length) {
        body.appendChild(channelList);
      }
    }

    backButton.disabled = activeScreen === 0;
    nextButton.textContent = activeScreen === 0 ? 'Next' : preview ? 'Close' : 'Finish';
  };

  backButton.addEventListener('click', () => {
    activeScreen = Math.max(0, activeScreen - 1);
    renderScreen();
  });

  nextButton.addEventListener('click', async () => {
    if (activeScreen === 0) {
      activeScreen = 1;
      renderScreen();
      return;
    }

    if (!preview) {
      await completeSelectedServerOnboarding();
    }
    closeServerWelcomeScreen();
  });

  footer.appendChild(backButton);
  footer.appendChild(nextButton);
  dialog.appendChild(header);
  dialog.appendChild(tabs);
  dialog.appendChild(body);
  dialog.appendChild(footer);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', async (event) => {
    if (event.target === overlay) {
      if (!preview) {
        await completeSelectedServerOnboarding();
      }
      closeServerWelcomeScreen();
    }
  });

  renderScreen();
}

async function updateServerVerificationFromPrompt() {
  await loadAccountSettings();
  const settingsState = readSettingsState();
  const phoneVerificationAvailable = Boolean(settingsState.verification.phoneVerificationAvailable);
  const verificationOptions = SERVER_VERIFICATION_LEVELS.map((level) => {
    if (
      level.value === 'highest' &&
      !phoneVerificationAvailable &&
      currentServerVerificationLevel !== 'highest'
    ) {
      return {
        ...level,
        label: `${level.label} (SMS unavailable)`,
        disabled: true,
      };
    }

    return level;
  });

  const values = await openSimpleFormDialog({
    title: 'Server Rules',
    description: 'Email and account-age rules apply when joining and posting. Member time applies before posting.',
    fields: [
      {
        name: 'verificationLevel',
        label: 'Verification level',
        value: currentServerVerificationLevel || 'none',
        options: verificationOptions,
      },
      {
        name: 'requireVerifiedEmail',
        label: 'Email required for join/post',
        value: currentServerRequireVerifiedEmail ? 'true' : 'false',
        options: [
          { value: 'false', label: 'Off' },
          { value: 'true', label: 'On' },
        ],
      },
      {
        name: 'minimumAccountAgeMinutes',
        label: 'Account age required (minutes)',
        type: 'number',
        min: 0,
        max: MAX_SERVER_RULE_MINUTES,
        step: 1,
        value: String(currentServerMinimumAccountAgeMinutes || 0),
      },
      {
        name: 'minimumMembershipMinutes',
        label: 'Member before posting (minutes)',
        type: 'number',
        min: 0,
        max: MAX_SERVER_RULE_MINUTES,
        step: 1,
        value: String(currentServerMinimumMembershipMinutes || 0),
      },
      {
        name: 'requireTwoFactorForModerators',
        label: '2FA required for moderators/admins',
        value: currentServerRequireTwoFactorForModerators ? 'true' : 'false',
        options: [
          { value: 'false', label: 'Off' },
          { value: 'true', label: 'On' },
        ],
      },
    ],
    confirmText: 'Save',
  });

  const verificationLevel = values?.verificationLevel;
  if (!verificationLevel) return;
  const minimumAccountAgeMinutes = parseServerRuleMinutes(values.minimumAccountAgeMinutes);
  const minimumMembershipMinutes = parseServerRuleMinutes(values.minimumMembershipMinutes);
  if (minimumAccountAgeMinutes == null || minimumMembershipMinutes == null) {
    showAppMessage('Rule minutes must be between 0 and 525600.', 'error');
    return;
  }
  if (
    verificationLevel === 'highest' &&
    !phoneVerificationAvailable &&
    currentServerVerificationLevel !== 'highest'
  ) {
    showAppMessage('Highest verification requires SMS provider configuration.', 'error');
    return;
  }

  try {
    const res = await axios.post(`${homeApiBase}/api/Server/UpdateVerificationLevel`, {
      serverId: selectedServerID,
      verificationLevel,
      requireVerifiedEmail: values.requireVerifiedEmail === 'true',
      minimumAccountAgeMinutes,
      minimumMembershipMinutes,
      requireTwoFactorForModerators: values.requireTwoFactorForModerators === 'true',
    });
    applyServerRuleState(res.data || {
      verificationLevel,
      requireVerifiedEmail: values.requireVerifiedEmail === 'true',
      minimumAccountAgeMinutes,
      minimumMembershipMinutes,
      requireTwoFactorForModerators: values.requireTwoFactorForModerators === 'true',
    });
    await fetchServerDetails();
    showAppMessage('Server rules updated.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not update server rules.'), 'error');
  }
}

async function createChannelFromPrompt() {
  const values = await openSimpleFormDialog({
    title: 'Create Channel',
    fields: [
      { name: 'name', label: 'Channel name' },
      {
        name: 'type',
        label: 'Channel type',
        options: [
          { value: 'text', label: 'Text' },
          { value: 'voice', label: 'Voice' },
          { value: 'stage', label: 'Stage' },
        ],
      },
    ],
    confirmText: 'Create',
  });
  const name = values?.name?.trim();
  if (!name) return;
  const type = ['voice', 'stage'].includes(values?.type) ? values.type : 'text';

  try {
    await axios.post(`${homeApiBase}/api/Server/CreateChannel`, {
      serverId: selectedServerID,
      name,
      type,
    });
    await fetchServerDetails();
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not create channel.'), 'error');
  }
}

async function openVoiceChannelPermissionsDialog(initialChannelId = null) {
  const voiceChannels = currentServerChannels.filter((channel) => isVoiceLikeChannelType(channel.type));
  if (!selectedServerID || voiceChannels.length === 0) {
    showAppMessage('Create a voice or stage channel first.', 'error');
    return;
  }

  closeAccountActionDialog();

  const overlay = document.createElement('div');
  overlay.className = 'account-action-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'account-action-dialog voice-permissions-dialog';

  const heading = document.createElement('h3');
  heading.textContent = 'Voice Channel Permissions';
  dialog.appendChild(heading);

  const copy = document.createElement('p');
  copy.className = 'account-action-copy';
  copy.textContent = 'Choose which roles can connect to voice and stage channels.';
  dialog.appendChild(copy);

  const form = document.createElement('form');
  form.className = 'account-action-form';

  const channelLabel = document.createElement('label');
  channelLabel.textContent = 'Channel';
  const channelSelect = document.createElement('select');
  channelSelect.className = 'account-action-select';
  voiceChannels.forEach((channel) => {
    const option = document.createElement('option');
    option.value = channel.id;
    option.textContent = `${getChannelTypeIcon(channel.type)} ${channel.name}`;
    channelSelect.appendChild(option);
  });
  channelSelect.value =
    voiceChannels.some((channel) => channel.id === initialChannelId)
      ? initialChannelId
      : voiceChannels[0].id;
  channelLabel.appendChild(channelSelect);
  form.appendChild(channelLabel);

  const loading = document.createElement('p');
  loading.className = 'form-desc';
  loading.textContent = 'Loading permissions...';
  form.appendChild(loading);

  const rowsContainer = document.createElement('div');
  rowsContainer.className = 'voice-permission-rows';
  form.appendChild(rowsContainer);

  const actions = document.createElement('div');
  actions.className = 'account-action-buttons';
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'account-action-cancel';
  cancelButton.textContent = 'Cancel';
  const saveButton = document.createElement('button');
  saveButton.type = 'submit';
  saveButton.className = 'account-action-submit';
  saveButton.textContent = 'Save';
  actions.appendChild(cancelButton);
  actions.appendChild(saveButton);
  form.appendChild(actions);

  let activePermissions = null;

  const close = () => overlay.remove();
  cancelButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  const renderPermissions = async () => {
    rowsContainer.innerHTML = '';
    loading.textContent = 'Loading permissions...';
    activePermissions = null;

    try {
      const res = await axios.get(
        `${homeApiBase}/api/Server/GetChannelVoicePermissions?channelId=${encodeURIComponent(channelSelect.value)}`
      );
      activePermissions = res.data;
      loading.textContent = '';

      const isStage = activePermissions.type === 'stage';
      const connectRestricted = document.createElement('label');
      connectRestricted.className = 'voice-permission-toggle';
      const connectToggle = document.createElement('input');
      connectToggle.type = 'checkbox';
      connectToggle.name = 'voiceAccessRestricted';
      connectToggle.checked = Boolean(activePermissions.voiceAccessRestricted);
      connectRestricted.appendChild(connectToggle);
      connectRestricted.appendChild(document.createTextNode(' Restrict who can connect'));
      rowsContainer.appendChild(connectRestricted);

      let speakToggle = null;
      if (isStage) {
        const speakRestricted = document.createElement('label');
        speakRestricted.className = 'voice-permission-toggle';
        speakToggle = document.createElement('input');
        speakToggle.type = 'checkbox';
        speakToggle.name = 'stageSpeakerRestricted';
        speakToggle.checked = Boolean(activePermissions.stageSpeakerRestricted);
        speakRestricted.appendChild(speakToggle);
        speakRestricted.appendChild(document.createTextNode(' Restrict who can speak on stage'));
        rowsContainer.appendChild(speakRestricted);
      }

      const allowedRoles = new Set(parseRoleNameList(activePermissions.voiceAllowedRoleNames));
      const speakerRoles = new Set(parseRoleNameList(activePermissions.stageSpeakerRoleNames));
      const roleRows = document.createElement('div');
      roleRows.className = 'voice-permission-role-list';

      (activePermissions.roles || []).forEach((role) => {
        const roleName = normalizeRoleName(role.name);
        const row = document.createElement('div');
        row.className = 'voice-permission-row';
        row.dataset.role = roleName;

        const name = document.createElement('span');
        name.className = 'voice-permission-role-name';
        name.textContent = roleName;
        row.appendChild(name);

        const connectLabel = document.createElement('label');
        const connectInput = document.createElement('input');
        connectInput.type = 'checkbox';
        connectInput.dataset.permission = 'connect';
        connectInput.checked = !connectToggle.checked || allowedRoles.has(roleName);
        connectInput.disabled = !connectToggle.checked;
        connectLabel.appendChild(connectInput);
        connectLabel.appendChild(document.createTextNode(' Connect'));
        row.appendChild(connectLabel);

        if (isStage) {
          const speakLabel = document.createElement('label');
          const speakInput = document.createElement('input');
          speakInput.type = 'checkbox';
          speakInput.dataset.permission = 'speak';
          speakInput.checked = !speakToggle.checked || speakerRoles.has(roleName);
          speakInput.disabled = !speakToggle.checked;
          speakLabel.appendChild(speakInput);
          speakLabel.appendChild(document.createTextNode(' Speak'));
          row.appendChild(speakLabel);
        }

        roleRows.appendChild(row);
      });

      connectToggle.addEventListener('change', () => {
        roleRows.querySelectorAll('input[data-permission="connect"]').forEach((input) => {
          input.disabled = !connectToggle.checked;
          if (!connectToggle.checked) input.checked = true;
        });
      });

      if (speakToggle) {
        speakToggle.addEventListener('change', () => {
          roleRows.querySelectorAll('input[data-permission="speak"]').forEach((input) => {
            input.disabled = !speakToggle.checked;
            if (!speakToggle.checked) input.checked = true;
          });
        });
      }

      rowsContainer.appendChild(roleRows);
    } catch (error) {
      loading.textContent = getApiErrorMessage(error, 'Could not load channel permissions.');
    }
  };

  channelSelect.addEventListener('change', renderPermissions);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!activePermissions) return;

    const voiceAccessRestricted = Boolean(form.elements.voiceAccessRestricted?.checked);
    const stageSpeakerRestricted = Boolean(form.elements.stageSpeakerRestricted?.checked);
    const roleRows = [...rowsContainer.querySelectorAll('.voice-permission-row')];
    const voiceAllowedRoleNames = roleRows
      .filter((row) => row.querySelector('input[data-permission="connect"]')?.checked)
      .map((row) => row.dataset.role);
    const stageSpeakerRoleNames = roleRows
      .filter((row) => row.querySelector('input[data-permission="speak"]')?.checked)
      .map((row) => row.dataset.role);

    if (voiceAccessRestricted && voiceAllowedRoleNames.length === 0) {
      showAppMessage('Allow at least one role to connect.', 'error');
      return;
    }
    if (activePermissions.type === 'stage' && stageSpeakerRestricted && stageSpeakerRoleNames.length === 0) {
      showAppMessage('Allow at least one role to speak on stage.', 'error');
      return;
    }

    try {
      setBusyState(saveButton, true, 'Saving...');
      await axios.post(`${homeApiBase}/api/Server/UpdateChannelVoicePermissions`, {
        channelId: channelSelect.value,
        voiceAccessRestricted,
        voiceAllowedRoleNames,
        stageSpeakerRestricted: activePermissions.type === 'stage' && stageSpeakerRestricted,
        stageSpeakerRoleNames,
      });
      await fetchServerDetails();
      close();
      showAppMessage('Voice permissions updated.', 'success');
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not save voice permissions.'), 'error');
    } finally {
      setBusyState(saveButton, false);
    }
  });

  dialog.appendChild(form);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  renderPermissions();
}

async function createCategoryFromPrompt() {
  const name = await askText('Create Category', 'Category name');
  if (!name) return;

  try {
    await axios.post(`${homeApiBase}/api/Server/CreateCategory`, {
      serverId: selectedServerID,
      name,
    });
    await fetchServerDetails();
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not create category.'), 'error');
  }
}

async function createLimitedInviteFromPrompt() {
  const values = await openSimpleFormDialog({
    title: 'Create Invite',
    fields: [
      { name: 'maxUses', label: 'Max uses (blank for unlimited)', required: false },
      { name: 'expiresInMinutes', label: 'Expires in minutes (blank for never)', required: false },
    ],
    confirmText: 'Create Invite',
  });
  if (!values) return;

  const payload = {
    serverId: selectedServerID,
    maxUses: values.maxUses ? Number(values.maxUses) : null,
    expiresInMinutes: values.expiresInMinutes ? Number(values.expiresInMinutes) : null,
  };

  try {
    const res = await axios.post(`${homeApiBase}/api/Server/CreateInvite`, payload);
    const inviteLink = res.data?.inviteLink || res.data?.InviteLink;
    if (inviteLink && navigator.clipboard) {
      await navigator.clipboard.writeText(inviteLink);
    }
    showAppMessage(inviteLink ? 'Invite link copied.' : 'Invite created.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not create invite.'), 'error');
  }
}

function createRoleChip(roleName, extraClass = '') {
  const chip = document.createElement('span');
  const normalizedRole = normalizeRoleName(roleName);
  chip.className = `server-member-role-chip ${extraClass}`.trim();
  chip.dataset.role = normalizedRole;
  chip.textContent = formatRoleName(normalizedRole);
  chip.title = normalizedRole;
  return chip;
}

function createDraftRole() {
  return normalizeServerRole({
    id: 'draft',
    name: 'new-role',
    position: currentServerRoles.length + 1,
    canCreateInvites: true,
    canSendMessages: true,
    canJoinVoice: true,
    isDraft: true,
  });
}

function countMembersForRole(members = [], roleName = 'user') {
  const normalizedRole = normalizeRoleName(roleName);
  return members.filter((member) => normalizeRoleName(member.role) === normalizedRole).length;
}

function renderRoleMembersPreview(container, members = [], roleName = 'user') {
  const normalizedRole = normalizeRoleName(roleName);
  const roleMembers = members.filter((member) => normalizeRoleName(member.role) === normalizedRole);

  container.innerHTML = '';
  const label = document.createElement('div');
  label.className = 'role-members-label';
  label.textContent = `Members (${roleMembers.length})`;
  container.appendChild(label);

  const list = document.createElement('div');
  list.className = 'role-members-preview-list';
  if (!roleMembers.length) {
    const empty = document.createElement('span');
    empty.className = 'role-member-pill muted';
    empty.textContent = 'No members';
    list.appendChild(empty);
  } else {
    roleMembers.slice(0, 12).forEach((member) => {
      const pill = document.createElement('span');
      pill.className = 'role-member-pill';
      pill.textContent = member.username;
      list.appendChild(pill);
    });

    if (roleMembers.length > 12) {
      const extra = document.createElement('span');
      extra.className = 'role-member-pill muted';
      extra.textContent = `+${roleMembers.length - 12}`;
      list.appendChild(extra);
    }
  }
  container.appendChild(list);
}

function openRolesAndPermissionsDialog() {
  if (!selectedServerID) {
    return;
  }

  closeAccountActionDialog();

  let roles = [];
  let members = [];
  let selectedRoleId = '';
  let draftRole = null;
  let canManageRoles = false;

  const overlay = document.createElement('div');
  overlay.className = 'account-action-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'account-action-dialog roles-permissions-dialog';

  const header = document.createElement('div');
  header.className = 'role-manager-header';
  const titleBlock = document.createElement('div');
  const heading = document.createElement('h3');
  heading.textContent = 'Roles & Permissions';
  const copy = document.createElement('p');
  copy.className = 'account-action-copy';
  copy.textContent = currentServerName || 'Server roles';
  titleBlock.appendChild(heading);
  titleBlock.appendChild(copy);

  const newRoleButton = document.createElement('button');
  newRoleButton.type = 'button';
  newRoleButton.className = 'account-action-submit role-new-btn';
  newRoleButton.textContent = '+ Role';
  header.appendChild(titleBlock);
  header.appendChild(newRoleButton);

  const status = document.createElement('div');
  status.className = 'role-manager-status';
  status.setAttribute('role', 'status');

  const shell = document.createElement('div');
  shell.className = 'roles-permissions-shell';
  const roleList = document.createElement('div');
  roleList.className = 'role-list';
  const roleDetail = document.createElement('div');
  roleDetail.className = 'role-detail-panel';
  shell.appendChild(roleList);
  shell.appendChild(roleDetail);

  const footer = document.createElement('div');
  footer.className = 'account-action-buttons';
  const doneButton = document.createElement('button');
  doneButton.type = 'button';
  doneButton.className = 'account-action-cancel';
  doneButton.textContent = 'Done';
  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.className = 'account-action-submit';
  refreshButton.textContent = 'Refresh';
  footer.appendChild(doneButton);
  footer.appendChild(refreshButton);

  const close = () => overlay.remove();
  doneButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  const setStatus = (message, variant = '') => {
    status.textContent = message;
    status.dataset.variant = variant;
  };

  const getSelectedRole = () => {
    if (selectedRoleId === 'draft' && draftRole) {
      return draftRole;
    }

    return roles.find((role) => getServerRoleId(role) === selectedRoleId) || roles[0] || null;
  };

  const selectRole = (roleId) => {
    selectedRoleId = roleId;
    renderRoleList();
    renderRoleDetail();
  };

  const renderRoleList = () => {
    roleList.innerHTML = '';
    const listRoles = draftRole ? [draftRole, ...roles] : roles;
    if (!listRoles.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state-card padded';
      empty.textContent = 'No roles found.';
      roleList.appendChild(empty);
      return;
    }

    listRoles.forEach((role) => {
      const roleId = role.isDraft ? 'draft' : getServerRoleId(role);
      const roleName = getServerRoleName(role);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'role-list-item';
      item.dataset.role = roleName;
      item.classList.toggle('active', roleId === selectedRoleId);

      const main = document.createElement('span');
      main.className = 'role-list-main';
      const name = document.createElement('strong');
      name.textContent = role.isDraft ? 'Unsaved role' : formatRoleName(roleName);
      const summary = document.createElement('span');
      summary.textContent = role.isDraft
        ? 'Choose a name and permissions'
        : getRolePermissionSummary(role);
      main.appendChild(name);
      main.appendChild(summary);

      const count = document.createElement('span');
      count.className = 'role-list-count';
      count.textContent = role.isDraft ? 'New' : String(countMembersForRole(members, roleName));

      item.appendChild(main);
      item.appendChild(count);
      item.addEventListener('click', () => selectRole(roleId));
      roleList.appendChild(item);
    });
  };

  const renderRoleDetail = () => {
    roleDetail.innerHTML = '';
    const role = getSelectedRole();
    if (!role) {
      const empty = document.createElement('div');
      empty.className = 'empty-state-card padded';
      empty.textContent = 'Select a role.';
      roleDetail.appendChild(empty);
      return;
    }

    const roleName = getServerRoleName(role);
    const isOwnerRole = roleName === 'owner';
    const isDraft = Boolean(role.isDraft);
    const controlsLocked = !canManageRoles || isOwnerRole;

    const form = document.createElement('form');
    form.className = 'role-detail-form';

    const top = document.createElement('div');
    top.className = 'role-detail-top';
    const title = document.createElement('div');
    title.className = 'role-detail-title';
    title.appendChild(createRoleChip(roleName, 'large'));
    const summary = document.createElement('span');
    summary.textContent = getRolePermissionSummary(role);
    title.appendChild(summary);
    top.appendChild(title);
    form.appendChild(top);

    const nameLabel = document.createElement('label');
    nameLabel.className = 'role-field-label';
    nameLabel.textContent = 'Role name';
    const nameInput = document.createElement('input');
    nameInput.name = 'name';
    nameInput.value = roleName;
    nameInput.maxLength = 40;
    nameInput.pattern = '[A-Za-z0-9._ -]+';
    nameInput.disabled = controlsLocked || !isDraft;
    nameInput.required = true;
    nameLabel.appendChild(nameInput);
    form.appendChild(nameLabel);

    const permissionGroups = document.createElement('div');
    permissionGroups.className = 'role-permission-grid';
    Array.from(new Set(ROLE_PERMISSION_DEFINITIONS.map((permission) => permission.group))).forEach((group) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'role-permission-group';
      const groupTitle = document.createElement('h4');
      groupTitle.textContent = group;
      groupEl.appendChild(groupTitle);

      ROLE_PERMISSION_DEFINITIONS
        .filter((permission) => permission.group === group)
        .forEach(({ key, label }) => {
          const row = document.createElement('label');
          row.className = 'role-permission-toggle';
          const text = document.createElement('span');
          text.textContent = label;
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.name = key;
          input.checked = Boolean(role[key]);
          input.disabled = controlsLocked;
          row.appendChild(text);
          row.appendChild(input);
          groupEl.appendChild(row);
        });

      permissionGroups.appendChild(groupEl);
    });
    form.appendChild(permissionGroups);

    const memberPreview = document.createElement('div');
    memberPreview.className = 'role-members-preview';
    renderRoleMembersPreview(memberPreview, members, roleName);
    form.appendChild(memberPreview);

    const error = document.createElement('div');
    error.className = 'account-action-error';
    form.appendChild(error);

    const actions = document.createElement('div');
    actions.className = 'account-action-buttons role-detail-actions';

    if (!isDraft && !['owner', 'user'].includes(roleName) && canManageRoles) {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'account-action-cancel danger-text';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => deleteSelectedRole(role, deleteButton));
      actions.appendChild(deleteButton);
    }

    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.className = 'account-action-submit';
    saveButton.textContent = isDraft ? 'Create Role' : 'Save Permissions';
    saveButton.disabled = controlsLocked;
    actions.appendChild(saveButton);
    form.appendChild(actions);

    if (!canManageRoles) {
      error.textContent = 'You need Manage server permission to edit roles.';
    } else if (isOwnerRole) {
      error.textContent = 'Owner permissions are managed automatically.';
    } else if (!isDraft) {
      nameInput.title = 'Create a new role to use a different name.';
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (controlsLocked) return;
      error.textContent = '';

      const normalizedName = normalizeRoleName(nameInput.value);
      if (!normalizedName || normalizedName.length > 40) {
        error.textContent = 'Role name must be 1-40 characters.';
        return;
      }
      if (normalizedName === 'owner') {
        error.textContent = 'The owner role is managed automatically.';
        return;
      }

      const payload = {
        roleId: isDraft ? null : getServerRoleId(role),
        serverId: selectedServerID,
        name: normalizedName,
      };
      ROLE_PERMISSION_DEFINITIONS.forEach(({ key }) => {
        payload[key] = Boolean(form.elements[key]?.checked);
      });

      try {
        setBusyState(saveButton, true, isDraft ? 'Creating...' : 'Saving...');
        const response = await axios.post(`${homeApiBase}/api/Server/UpsertRole`, payload);
        const savedRole = normalizeServerRole(response.data || {});
        draftRole = null;
        await loadRolesAndMembers(savedRole.id || selectedRoleId);
        showAppMessage(isDraft ? 'Role created.' : 'Role permissions saved.', 'success');
      } catch (errorResponse) {
        error.textContent = getApiErrorMessage(errorResponse, 'Could not save role.');
      } finally {
        setBusyState(saveButton, false);
      }
    });

    roleDetail.appendChild(form);
  };

  const deleteSelectedRole = async (role, button) => {
    const roleName = getServerRoleName(role);
    const confirmed = await openSimpleFormDialog({
      title: 'Delete Role',
      description: `Move members with ${formatRoleName(roleName)} back to User?`,
      fields: [],
      confirmText: 'Delete',
      danger: true,
      preserveExisting: true,
    });
    if (confirmed === null) {
      return;
    }

    try {
      setBusyState(button, true, 'Deleting...');
      await axios.post(`${homeApiBase}/api/Server/DeleteRole`, {
        serverId: selectedServerID,
        roleId: getServerRoleId(role),
      });
      draftRole = null;
      selectedRoleId = '';
      await loadRolesAndMembers();
      await fetchServerMembers();
      showAppMessage('Role deleted.', 'success');
    } catch (error) {
      setStatus(getApiErrorMessage(error, 'Could not delete role.'), 'error');
    } finally {
      setBusyState(button, false);
    }
  };

  const loadRolesAndMembers = async (nextSelectedRoleId = '') => {
    setStatus('Loading roles...');
    roleList.textContent = 'Loading roles...';
    roleDetail.innerHTML = '';
    try {
      const [loadedRoles, membersResponse] = await Promise.all([
        fetchServerRoles({ force: true }),
        axios.get(`${homeApiBase}/api/Server/GetServerMembers?serverId=${encodeURIComponent(selectedServerID)}`),
      ]);
      roles = loadedRoles;
      members = Array.isArray(membersResponse.data) ? membersResponse.data : [];
      canManageRoles = canManageRolesFromRoleList(roles);
      newRoleButton.disabled = !canManageRoles;
      if (nextSelectedRoleId) {
        selectedRoleId = nextSelectedRoleId;
      } else if (!selectedRoleId || !roles.some((role) => getServerRoleId(role) === selectedRoleId)) {
        selectedRoleId = roles.find((role) => getServerRoleName(role) !== 'owner')?.id || roles[0]?.id || '';
      }
      setStatus(canManageRoles ? `${roles.length} roles` : 'View-only');
      renderRoleList();
      renderRoleDetail();
    } catch (error) {
      setStatus(getApiErrorMessage(error, 'Could not load roles.'), 'error');
      roleList.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'empty-state-card padded';
      empty.textContent = 'Roles unavailable.';
      roleList.appendChild(empty);
    }
  };

  newRoleButton.addEventListener('click', () => {
    if (!canManageRoles) {
      return;
    }
    draftRole = createDraftRole();
    selectRole('draft');
  });
  refreshButton.addEventListener('click', () => {
    draftRole = null;
    loadRolesAndMembers(selectedRoleId);
  });

  dialog.appendChild(header);
  dialog.appendChild(status);
  dialog.appendChild(shell);
  dialog.appendChild(footer);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  loadRolesAndMembers();
}

function formatAuditAction(actionType = '') {
  return String(actionType || 'audit_event')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAuditKey(key = '') {
  return String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAuditValue(value) {
  if (value == null || value === '') {
    return '';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${formatAuditKey(key)}: ${formatAuditValue(item)}`)
      .filter((item) => !item.endsWith(': '))
      .join('; ');
  }

  if (typeof value === 'boolean') {
    return value ? 'On' : 'Off';
  }

  return String(value);
}

function formatAuditDetails(detailsJson) {
  if (!detailsJson) {
    return '';
  }

  try {
    const details = JSON.parse(detailsJson);
    if (!details || typeof details !== 'object') {
      return String(details || '');
    }

    return Object.entries(details)
      .map(([key, value]) => {
        const formattedValue = formatAuditValue(value);
        return formattedValue ? `${formatAuditKey(key)}: ${formattedValue}` : '';
      })
      .filter(Boolean)
      .join(' | ');
  } catch {
    return String(detailsJson);
  }
}

function formatAuditTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return date.toLocaleString();
}

function getAuditTargetLabel(log = {}) {
  if (log.targetUsername) {
    return `@${log.targetUsername}`;
  }

  if (log.targetType && log.targetId) {
    return `${log.targetType}: ${log.targetId}`;
  }

  return log.targetType || 'Server';
}

function renderAuditLogRow(log = {}) {
  const row = document.createElement('div');
  row.className = 'audit-log-row';

  const marker = document.createElement('div');
  marker.className = 'audit-log-marker';
  marker.textContent = String(log.actionType || '?').slice(0, 1).toUpperCase();

  const content = document.createElement('div');
  content.className = 'audit-log-content';

  const title = document.createElement('div');
  title.className = 'audit-log-title';
  title.textContent = formatAuditAction(log.actionType);

  const meta = document.createElement('div');
  meta.className = 'audit-log-meta';
  meta.textContent = `${log.actorUsername || 'Unknown'} -> ${getAuditTargetLabel(log)} - ${formatAuditTimestamp(log.createdAt)}`;

  const details = document.createElement('div');
  details.className = 'audit-log-details';
  details.textContent = formatAuditDetails(log.detailsJson);

  content.appendChild(title);
  content.appendChild(meta);
  if (details.textContent) {
    content.appendChild(details);
  }

  row.appendChild(marker);
  row.appendChild(content);
  return row;
}

function openAuditLogsDialog() {
  if (!selectedServerID) {
    return;
  }

  closeAccountActionDialog();

  const overlay = document.createElement('div');
  overlay.className = 'account-action-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'account-action-dialog audit-log-dialog';

  const heading = document.createElement('h3');
  heading.textContent = 'Audit Logs';
  const copy = document.createElement('p');
  copy.className = 'account-action-copy';
  copy.textContent = currentServerName || 'Server activity';

  const list = document.createElement('div');
  list.className = 'audit-log-list';
  list.textContent = 'Loading audit logs...';

  const actions = document.createElement('div');
  actions.className = 'account-action-buttons';
  const doneButton = document.createElement('button');
  doneButton.type = 'button';
  doneButton.className = 'account-action-cancel';
  doneButton.textContent = 'Done';
  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.className = 'account-action-submit';
  refreshButton.textContent = 'Refresh';
  actions.appendChild(doneButton);
  actions.appendChild(refreshButton);

  const close = () => overlay.remove();
  doneButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  const loadLogs = async () => {
    list.textContent = 'Loading audit logs...';
    try {
      const res = await axios.get(
        `${homeApiBase}/api/Server/GetAuditLogs?serverId=${encodeURIComponent(selectedServerID)}&take=75`
      );
      const logs = Array.isArray(res.data) ? res.data : [];
      list.innerHTML = '';
      if (!logs.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state-card padded';
        empty.textContent = 'No audit entries yet.';
        list.appendChild(empty);
        return;
      }

      logs.forEach((log) => list.appendChild(renderAuditLogRow(log)));
    } catch (error) {
      list.textContent = getApiErrorMessage(error, 'Could not load audit logs.');
    }
  };

  refreshButton.addEventListener('click', loadLogs);

  dialog.appendChild(heading);
  dialog.appendChild(copy);
  dialog.appendChild(list);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  loadLogs();
}

function getActiveReportScope(targetType = 'user') {
  if (currentGroupId && isElementVisible('.privateMessage')) {
    return 'group';
  }

  if (selectedServerID && isElementVisible('#serverDetails')) {
    return 'server';
  }

  if (targetType === 'message' && currentFriend && isElementVisible('.privateMessage')) {
    return 'dm';
  }

  return 'account';
}

function buildReportPayload({ targetType, scopeType, message, targetUsername, reason, description }) {
  const normalizedScope = scopeType || getActiveReportScope(targetType);
  const payload = {
    scopeType: normalizedScope,
    targetType,
    targetUsername,
    reason,
    description,
  };

  if (normalizedScope === 'server' && selectedServerID) {
    payload.serverId = selectedServerID;
  }
  if (normalizedScope === 'server' && selectedChannelID) {
    payload.channelId = selectedChannelID;
  }
  if (normalizedScope === 'group' && currentGroupId) {
    payload.groupId = currentGroupId;
  }
  if (targetType === 'message') {
    payload.messageId = getMessageId(message);
  }

  return payload;
}

async function openReportDialog({ targetType, scopeType = 'account', message = null, targetUsername = '' }) {
  if (!targetType) return;

  const isMessageReport = targetType === 'message';
  const targetLabel = isMessageReport
    ? `message from ${targetUsername || 'this user'}`
    : `user ${targetUsername}`;

  const result = await openSimpleFormDialog({
    title: isMessageReport ? 'Report Message' : 'Report User',
    description: `Send a report for ${targetLabel}.`,
    fields: [
      {
        name: 'reason',
        label: 'Reason',
        options: REPORT_REASON_OPTIONS,
      },
      {
        name: 'description',
        label: 'Details (optional)',
        type: 'textarea',
        maxLength: 1000,
        rows: 4,
        required: false,
      },
    ],
    confirmText: 'Submit Report',
    danger: true,
  });

  if (!result) return;

  const payload = buildReportPayload({
    targetType,
    scopeType,
    message,
    targetUsername,
    reason: result.reason,
    description: result.description?.trim() || null,
  });

  try {
    await axios.post(`${homeApiBase}/api/Reports/SubmitReport`, payload);
    showAppMessage('Report submitted.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not submit report.'), 'error');
  }
}

function formatReportReason(reason = '') {
  const option = REPORT_REASON_OPTIONS.find((item) => item.value === reason);
  return option ? option.label : formatAuditAction(reason || 'report');
}

function formatReportStatus(status = '') {
  return formatAuditAction(status || 'open');
}

function getReportTargetLabel(report = {}) {
  if (report.targetType === 'message') {
    return `Message from @${report.targetUsername || 'unknown'}`;
  }

  return `@${report.targetUsername || 'unknown'}`;
}

function renderReportRow(report = {}, onStatusChange) {
  const row = document.createElement('div');
  row.className = 'audit-log-row report-row';

  const marker = document.createElement('div');
  marker.className = 'audit-log-marker';
  marker.textContent = String(report.status || 'open').slice(0, 1).toUpperCase();

  const content = document.createElement('div');
  content.className = 'audit-log-content';

  const title = document.createElement('div');
  title.className = 'audit-log-title';
  title.textContent = `${getReportTargetLabel(report)} - ${formatReportReason(report.reason)}`;

  const meta = document.createElement('div');
  meta.className = 'audit-log-meta';
  meta.textContent = `${formatReportStatus(report.status)} by ${report.reportedByUsername || 'Unknown'} - ${formatAuditTimestamp(report.createdAt)}`;

  content.appendChild(title);
  content.appendChild(meta);

  if (report.messagePreview) {
    const preview = document.createElement('div');
    preview.className = 'audit-log-details';
    preview.textContent = report.messagePreview;
    content.appendChild(preview);
  }

  if (report.description) {
    const details = document.createElement('div');
    details.className = 'audit-log-details';
    details.textContent = report.description;
    content.appendChild(details);
  }

  const actions = document.createElement('div');
  actions.className = 'report-row-actions';
  [
    ['Review', 'reviewed'],
    ['Resolve', 'resolved'],
    ['Dismiss', 'dismissed'],
  ].forEach(([label, status]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'server-tool-btn';
    button.textContent = label;
    button.disabled = report.status === status;
    button.addEventListener('click', () => onStatusChange(report, status));
    actions.appendChild(button);
  });
  content.appendChild(actions);

  row.appendChild(marker);
  row.appendChild(content);
  return row;
}

function openServerReportsDialog() {
  if (!selectedServerID) {
    return;
  }

  closeAccountActionDialog();

  const overlay = document.createElement('div');
  overlay.className = 'account-action-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'account-action-dialog audit-log-dialog report-dialog';

  const heading = document.createElement('h3');
  heading.textContent = 'Reports';
  const copy = document.createElement('p');
  copy.className = 'account-action-copy';
  copy.textContent = currentServerName || 'Server reports';

  const statusFilter = document.createElement('select');
  statusFilter.className = 'account-action-select report-status-filter';
  [
    ['open', 'Open'],
    ['all', 'All'],
    ['reviewed', 'Reviewed'],
    ['resolved', 'Resolved'],
    ['dismissed', 'Dismissed'],
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    statusFilter.appendChild(option);
  });

  const list = document.createElement('div');
  list.className = 'audit-log-list report-list';
  list.textContent = 'Loading reports...';

  const actions = document.createElement('div');
  actions.className = 'account-action-buttons';
  const doneButton = document.createElement('button');
  doneButton.type = 'button';
  doneButton.className = 'account-action-cancel';
  doneButton.textContent = 'Done';
  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.className = 'account-action-submit';
  refreshButton.textContent = 'Refresh';
  actions.appendChild(doneButton);
  actions.appendChild(refreshButton);

  const close = () => overlay.remove();
  doneButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  const updateStatus = async (report, status) => {
    let note = '';
    if (status !== 'reviewed') {
      const result = await openSimpleFormDialog({
        title: `${formatReportStatus(status)} Report`,
        fields: [
          {
            name: 'note',
            label: 'Resolution note (optional)',
            type: 'textarea',
            maxLength: 1000,
            rows: 3,
            required: false,
          },
        ],
        confirmText: formatReportStatus(status),
        preserveExisting: true,
      });
      if (!result) return;
      note = result.note?.trim() || '';
    }

    try {
      await axios.post(`${homeApiBase}/api/Reports/UpdateReportStatus`, {
        serverId: selectedServerID,
        reportId: report.id,
        status,
        resolutionNote: note || null,
      });
      await loadReports();
      showAppMessage('Report updated.', 'success');
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not update report.'), 'error');
    }
  };

  const loadReports = async () => {
    list.textContent = 'Loading reports...';
    try {
      const res = await axios.get(
        `${homeApiBase}/api/Reports/GetServerReports?serverId=${encodeURIComponent(selectedServerID)}&status=${encodeURIComponent(statusFilter.value)}&take=100`
      );
      const reports = Array.isArray(res.data) ? res.data : [];
      list.innerHTML = '';
      if (!reports.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state-card padded';
        empty.textContent = 'No reports found.';
        list.appendChild(empty);
        return;
      }

      reports.forEach((report) => list.appendChild(renderReportRow(report, updateStatus)));
    } catch (error) {
      list.textContent = getApiErrorMessage(error, 'Could not load reports.');
    }
  };

  statusFilter.addEventListener('change', loadReports);
  refreshButton.addEventListener('click', loadReports);

  dialog.appendChild(heading);
  dialog.appendChild(copy);
  dialog.appendChild(statusFilter);
  dialog.appendChild(list);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  loadReports();
}

async function leaveSelectedServer() {
  if (!selectedServerID || !await askConfirm('Leave Server', 'Leave this server?', { danger: true, confirmText: 'Leave' })) return;

  try {
    await axios.post(`${homeApiBase}/api/Server/LeaveServer`, {
      serverId: selectedServerID,
    });
    selectedServerID = null;
    showElement('.secondColumn', 'flex');
    showElement('.lastSection', 'flex');
    hideElement('#serverDetails');
    await GetServer();
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not leave server.'), 'error');
  }
}

async function fetchServerDetails() {
  try {
    const response = await axios.get(
      `${homeApiBase}/api/Server/GetServerDetails?serverId=${encodeURIComponent(selectedServerID)}`
    );
    const { categories, channels, server } = response.data;
    currentServerCategories = Array.isArray(categories) ? categories : [];
    currentServerChannels = Array.isArray(channels) ? channels : [];
    if (server) {
      applyServerRuleState(server);
      applyServerListingState(server);
      applyServerWelcomeState(server);
      currentServerRole = server.role || currentServerRole || 'user';
    }
    if (server?.serverName) {
      currentServerName = server.serverName;
    }
    const channelsList = document.getElementById('channelsList');
    channelsList.innerHTML = '';
    renderServerManagementControls(channelsList);

    const renderChannel = (channel) => {
      const channelEl = document.createElement('div');
      channelEl.className = 'channel-list-item';
      channelEl.dataset.channelId = channel.id;
      channelEl.dataset.channelType = channel.type;
      const label = document.createElement('span');
      label.className = 'channel-name';
      label.textContent = `${getChannelTypeIcon(channel.type)} ${channel.name}`;
      channelEl.appendChild(label);
      if (channel.type === 'text') {
        channelEl.onclick = () => {
          selectedChannelID = channel.id;
          document.querySelector('.chatHeader').textContent = '# ' + channel.name;
          setUnreadBadgeEntry('server', channel.id, 0, 0);
          channelEl.classList.remove('has-unread', 'has-mention');
          channelEl.dataset.unread = '';
          channelEl.dataset.unreadLabel = '';
          channelEl.dataset.mentionCount = '';
          Array.from(channelsList.querySelectorAll('.channel-list-item')).forEach(d => d.classList.remove('active'));
          channelEl.classList.add('active');
          fetchServerMessages();
        };
      } else if (isVoiceLikeChannelType(channel.type)) {
        const permissionButton = document.createElement('button');
        permissionButton.type = 'button';
        permissionButton.className = 'channel-inline-action';
        permissionButton.textContent = 'Perms';
        permissionButton.title = 'Voice permissions';
        permissionButton.addEventListener('click', (event) => {
          event.stopPropagation();
          openVoiceChannelPermissionsDialog(channel.id);
        });
        channelEl.appendChild(permissionButton);

        channelEl.onclick = () => {
          selectedChannelID = channel.id;
          document.querySelector('.chatHeader').textContent =
            channel.type === 'stage' ? '[S] ' + channel.name : '[V] ' + channel.name;
          Array.from(channelsList.querySelectorAll('.channel-list-item')).forEach(d => d.classList.remove('active'));
          channelEl.classList.add('active');
          JoinVoiceCalls(channel.id);
        };
      }
      return channelEl;
    };

    currentServerCategories.forEach(category => {
      const categoryEl = document.createElement('div');
      categoryEl.className = 'channel-category-label';
      categoryEl.textContent = category.name;
      channelsList.appendChild(categoryEl);

      const categoryChannels = currentServerChannels.filter(c => c.categoryId === category.id);
      categoryChannels.forEach(channel => {
        channelsList.appendChild(renderChannel(channel));
      });
    });

    const uncategorized = currentServerChannels.filter(c => !c.categoryId);
    if (uncategorized.length > 0) {
      uncategorized.forEach(channel => {
        channelsList.appendChild(renderChannel(channel));
      });
    }

    const firstTextChannel = currentServerChannels.find(c => c.type === 'text');
    if (firstTextChannel) {
      selectedChannelID = firstTextChannel.id;
      document.querySelector('.chatHeader').textContent = '# ' + firstTextChannel.name;
      fetchServerMessages();
      const firstChannelEl = channelsList.querySelector(`[data-channel-id="${escapeCssIdentifier(firstTextChannel.id)}"]`);
      firstChannelEl?.classList.add('active');
    }

    await refreshUnreadIndicators();

    await fetchServerRoles({ force: true, silent: true }).catch(() => []);
    await fetchServerMembers();
    watchVoiceServer(selectedServerID).catch((err) => {
      console.error('Voice roster watch failed after loading channels:', err);
    });
    startVoiceRosterRefresh();
    await fetchActiveVoiceUsers(selectedServerID);
    maybeOpenServerWelcomeScreen();

  } catch (err) {
    console.error('Failed to fetch server details:', err);
  }
}



async function fetchServerMembers() {
  try {
    const response = await axios.get(
      `${homeApiBase}/api/Server/GetServerMembers?serverId=${encodeURIComponent(selectedServerID)}`
    );
    const members = response.data;
    const membersList = document.querySelector('.viewServerAccounts');

    membersList.innerHTML = '<p class="serverAccounts">Members</p>';

    members.sort((a, b) => {
      const roleDelta = getRoleSortPosition(a.role) - getRoleSortPosition(b.role);
      return roleDelta || a.username.localeCompare(b.username);
    });

    members.forEach(member => {
      const memberRole = normalizeRoleName(member.role);
      const memberEl = document.createElement('div');
      memberEl.dataset.username = member.username;
      memberEl.dataset.role = memberRole;
      memberEl.classList.add('server-member-row');
      memberEl.classList.toggle('is-owner', memberRole === 'owner');

      const avatar = document.createElement('div');
      avatar.className = 'server-member-avatar default-avatar-bg';
      avatar.onclick = (e) => openProfilePopout(member.username, e.pageX, e.pageY);

      const name = document.createElement('span');
      name.className = 'server-member-name';
      name.textContent = member.username;
      name.onclick = (e) => openProfilePopout(member.username, e.pageX, e.pageY);

      memberEl.appendChild(avatar);
      memberEl.appendChild(name);
      memberEl.appendChild(createRoleChip(memberRole));
      memberEl.appendChild(renderMemberModerationBadges(member));
      memberEl.appendChild(renderMemberModerationActions(member));

      membersList.appendChild(memberEl);
    });


    renderSelectedServerVoiceUsers();

  } catch (err) {
    console.error('Failed to fetch members:', err);
  }
}

function renderVoiceUserList(users) {
  if (!users) return;

  document.querySelectorAll('.voice-user-list').forEach(el => el.remove());


  const allMemberEls = document.querySelectorAll('.viewServerAccounts div[data-username]');
  allMemberEls.forEach(el => {
    const icon = el.querySelector('.voice-status-icon');
    if (icon) icon.remove();
  });

  const activeVoiceChannel =
    (currentVoiceChannelId && document.querySelector(`div[data-channel-id="${currentVoiceChannelId}"]`)) ||
    document.querySelector('div[data-channel-type="voice"], div[data-channel-type="stage"]');

  if (activeVoiceChannel && users.length > 0) {
    const userListContainer = document.createElement('div');
    userListContainer.className = 'voice-user-list';

    users.forEach(username => {
      const userDiv = document.createElement('div');
      userDiv.className = 'voice-user-row';

      const avatar = document.createElement('div');
      avatar.className = 'voice-user-avatar default-avatar-bg';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = username;

      userDiv.appendChild(avatar);
      userDiv.appendChild(nameSpan);
      userListContainer.appendChild(userDiv);

      const memberEl = document.querySelector(`.viewServerAccounts div[data-username="${username}"]`);
      if (memberEl) {
        const icon = document.createElement('span');
        icon.className = 'voice-status-icon';
        icon.textContent = ' 🔊';
        memberEl.appendChild(icon);
      }
    });

    activeVoiceChannel.after(userListContainer);
  }
}

async function startSignalR() {
  try {
    signalRConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${homeApiBase}/chatHub`, {
        accessTokenFactory: () => cookieVal || '',
      })
      .withAutomaticReconnect()
      .build();

    signalRConnection.on("NewMember", (username) => {
      console.log("New member joined:", username);

      fetchServerMembers();
    });

    signalRConnection.on("UserLeft", (username) => {
      console.log("User left:", username);
      fetchServerMembers();
    });

    signalRConnection.on("MemberModerationUpdated", (serverId) => {
      if (serverId === selectedServerID) {
        fetchServerMembers();
      }
    });

    signalRConnection.on("VoiceUsersUpdated", (serverId, users) => {
      setVoiceUsersForServer(serverId, normalizeVoiceUserList(users));
    });

    signalRConnection.onreconnected(async () => {
      if (!selectedServerID) {
        return;
      }

      try {
        await signalRConnection.invoke("JoinServer", selectedServerID, JWTusername);
        await fetchActiveVoiceUsers(selectedServerID);
      } catch (err) {
        console.error("SignalR rejoin failed:", err);
      }
    });

    await signalRConnection.start();
    console.log("SignalR Connected");

    if (selectedServerID) {
      await signalRConnection.invoke("JoinServer", selectedServerID, JWTusername);
      await fetchActiveVoiceUsers(selectedServerID);
    }

  } catch (err) {
    console.error("SignalR Connection Error: ", err);
    setTimeout(startSignalR, 5000);
  }
}


startSignalR();

async function startPrivateCall() {
  const preCallUI = document.getElementById('preCallUI');
  const activeCallUI = document.getElementById('activeCallUI');


  if (preCallUI) hideElement(preCallUI);
  if (activeCallUI) showElement(activeCallUI, 'block');
  clearCallVolumeControls('private');
  isVideoOn = false;
  startCallQualityMonitor();
  updateCallControlStates();

  const activeCallUsername = document.getElementById('activeCallUsername');
  const centerCallUser = document.getElementById('centerCallUser');
  if (activeCallUsername) activeCallUsername.textContent = currentFriend || 'Unknown User';
  if (centerCallUser) centerCallUser.textContent = currentFriend || 'Unknown User';

  console.log('Private call UI started, initiating call...');

  try {
    await initializeVoiceConnection();

    if (!voiceConnection || voiceConnection.readyState !== WebSocket.OPEN) {
      console.error("Voice connection not ready");
      return;
    }


    console.log(`Identifying as ${JWTusername} for call`);
    voiceConnection.send(JSON.stringify({
      Type: 'identify',
      Username: JWTusername
    }));


    await ensureLocalStream(true, false);


    if (!currentFriend) {
      console.error("No friend selected to call");
      return;
    }

    const peerConnection = await createPeerConnection(currentFriend);


    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const offerPayload = {
      type: offer.type,
      sdp: offer.sdp,
      isVideo: false
    };

    voiceConnection.send(JSON.stringify({
      Type: 'peer-offer',
      Data: JSON.stringify(offerPayload),
      TargetUser: currentFriend,
      IsPrivate: true,
      IsVideo: false
    }));

    console.log(`Offer sent to ${currentFriend}`);

  } catch (err) {
    console.error("Failed to start private call:", err);
  }
}

async function createPeerConnection(peerName) {
  if (peerConnections.has(peerName)) {
    return peerConnections.get(peerName);
  }

  const pc = new RTCPeerConnection(config);
  peerConnections.set(peerName, pc);

  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  pc.onicecandidate = (event) => {
    if (event.candidate && voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
      voiceConnection.send(JSON.stringify({
        Type: 'peer-ice-candidate',
        Data: JSON.stringify(event.candidate),
        TargetUser: peerName
      }));
    }
  };

  pc.ontrack = (event) => {
    console.log(`Received track from ${peerName}: Kind=${event.track.kind}, ID=${event.track.id}`);

    if (event.track.kind === 'audio') {
      const remoteAudio = createRemoteAudioElement(peerName, event.streams[0], 'private');
      remoteAudio.srcObject = event.streams[0];
    }


    if (event.track.kind === 'video') {
      console.log("FOUND REMOTE VIDEO TRACK! Attaching to #remoteVideo");
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
        registerRemoteMediaElement(peerName, remoteVideo, 'private');
        ensurePeerVolumeControl(peerName, remoteVideo, 'private');
        updateRemoteMediaStatus(peerName, event.streams[0]);
        remoteVideo.play().catch(e => console.error("Remote video play failed:", e));
        console.log("Attached remote video stream to DOM");
      } else {
        console.error("remoteVideo element MISSING from DOM");
      }
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`Connection state with ${peerName}: ${pc.connectionState}`);
    updateCallQualityWarnings();
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      removePeerUI(peerName);
      pc.close();
      peerConnections.delete(peerName);
    }
  };

  return pc;
}


let pendingPeer = null;
let pendingOffer = null;
let pendingIsVideo = false;

async function handlePrivatePeerOffer(peerName, offerData, _unusedIsVideo) {

  let isVideo = false;
  try {
    const payload = JSON.parse(offerData);
    if (payload.isVideo) isVideo = true;
  } catch (e) { console.warn("Failed to parse offer data for IsVideo flag", e); }

  console.log(`Handling offer from ${peerName} (Video=${isVideo})`);


  if (peerConnections.has(peerName)) {
    console.log(`Renegotiation offer from ${peerName} detected. processing silently.`);
    const pc = peerConnections.get(peerName);


    const offerDesc = typeof offerData === 'string' ? JSON.parse(offerData) : offerData;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
      voiceConnection.send(JSON.stringify({
        Type: 'peer-answer',
        Data: JSON.stringify(answer),
        TargetUser: peerName,
        IsPrivate: true,
        IsVideo: isVideo
      }));
    }
    return;
  }


  pendingPeer = peerName;
  pendingOffer = offerData;
  pendingIsVideo = isVideo;
  notifyIncomingCall(peerName, isVideo ? 'video call' : 'voice call');


  const modal = document.getElementById('incomingCallModal');
  const userText = document.getElementById('incomingCallUser');
  if (modal && userText) {
    userText.textContent = `${peerName} is calling... ` + (isVideo ? '(Video)' : '(Voice)');
    showElement(modal, 'flex');
    startRingtone();
  } else {

    console.warn("Incoming call modal missing");

  }
}

async function AcceptCall() {
  stopRingtone();
  const modal = document.getElementById('incomingCallModal');
  if (modal) hideElement(modal);

  if (!pendingPeer || !pendingOffer) return;

  const peerName = pendingPeer;
  const offerData = pendingOffer;


  pendingPeer = null;
  pendingOffer = null;


  if (globalAudioContext) {
    if (globalAudioContext.state === 'suspended') {
      await globalAudioContext.resume();
      console.log('AudioContext resumed by AcceptCall');
    }
  } else {
    enableAudioPlayback();
  }


  await ensureLocalStream(true, pendingIsVideo);


  const pc = await createPeerConnection(peerName);
  await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(offerData)));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
    voiceConnection.send(JSON.stringify({
      Type: 'peer-answer',
      Data: JSON.stringify(answer),
      TargetUser: peerName,
      IsPrivate: true,
      IsVideo: pendingIsVideo
    }));
  }


  const preCallUI = document.getElementById('preCallUI');
  const activeCallUI = document.getElementById('activeCallUI');

  if (preCallUI) hideElement(preCallUI);
  if (activeCallUI) showElement(activeCallUI, 'block');
  clearCallVolumeControls('private');
  isVideoOn = pendingIsVideo;
  startCallQualityMonitor();
  updateCallControlStates();

  const activeCallUsername = document.getElementById('activeCallUsername');
  const centerCallUser = document.getElementById('centerCallUser');

  if (activeCallUsername) activeCallUsername.textContent = peerName;
  if (centerCallUser) centerCallUser.textContent = `${JWTusername} & ${peerName}`;

  currentFriend = peerName;
  currentGroupId = null;
  currentGroupName = '';


  try {
    clearContent();

    hideAllElements('.pendingRequestsDiv');


    InitWebSocket();
    await GetPrivateMessage();

    const nav = document.querySelector('.nav');
    if (nav) hideElement(nav);

    const privateMsg = document.querySelector('.privateMessage');
    if (privateMsg) showElement(privateMsg, 'flex');

    if (typeof directMessageUser !== 'undefined' && directMessageUser) {
      directMessageUser.innerText = currentFriend;
    }
  } catch (e) {
    console.error("Auto-navigation to DM failed:", e);
  }
}

function DeclineCall() {
  stopRingtone();
  hideElement('#incomingCallModal');

  console.log(`Declined call from ${pendingPeer}`);
  pendingPeer = null;
  pendingOffer = null;


}

async function handlePeerAnswer(peerName, answerData) {
  console.log(`Handling answer from ${peerName}`);
  const pc = peerConnections.get(peerName);
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(answerData)));


    const centerCallUser = document.getElementById('centerCallUser');
    if (centerCallUser) centerCallUser.textContent = `${JWTusername} & ${peerName}`;
    startCallQualityMonitor();
    updateCallControlStates();


    try {
      if (isElementVisible('.nav')) {
        clearContent();
        hideAllElements('.pendingRequestsDiv');

        InitWebSocket();
        await GetPrivateMessage();

        const nav = document.querySelector('.nav');
        if (nav) hideElement(nav);

        const privateMsg = document.querySelector('.privateMessage');
    if (privateMsg) showElement(privateMsg, 'flex');

        if (typeof directMessageUser !== 'undefined' && directMessageUser) {
          directMessageUser.innerText = peerName;
        }
      }
    } catch (e) { console.error("Auto-nav for caller failed", e); }
  }
}

async function handlePeerIceCandidate(peerName, candidateData) {
  console.log(`Handling candidate from ${peerName}`);
  const pc = peerConnections.get(peerName);
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidateData)));
    } catch (e) {
      console.warn(`Error adding ice candidate from ${peerName}:`, e);
    }
  }
}

async function endPrivateCall(notifyPeer = true) {
  const preCallUI = document.getElementById('preCallUI');
  const activeCallUI = document.getElementById('activeCallUI');

  if (notifyPeer && currentFriend && voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
    console.log(`Sending call-ended signal to ${currentFriend}`);
    voiceConnection.send(JSON.stringify({
      Type: 'call-ended',
      TargetUser: currentFriend
    }));
  }

  if (activeCallUI) hideElement(activeCallUI);
  if (preCallUI) showElement(preCallUI, 'flex');

  console.log('Private call UI ended, cleaning up...');

  try {
    await stopScreenShare({ restoreCamera: false });
    pushToTalkActive = false;
    pressedShortcutKeys.clear();
    if (currentFriend && peerConnections.has(currentFriend)) {
      const pc = peerConnections.get(currentFriend);
      pc.close();
      peerConnections.delete(currentFriend);
      removePeerUI(currentFriend);
    }
    clearCallVolumeControls('private');
    stopVoiceActivityContext('private');
    const privateRemoteVideo = document.getElementById('remoteVideo');
    if (privateRemoteVideo) {
      privateRemoteVideo.srcObject = null;
      delete privateRemoteVideo.dataset.remoteMedia;
      delete privateRemoteVideo.dataset.peerName;
      delete privateRemoteVideo.dataset.peerVolumeId;
    }

    if (peerConnections.size === 0 && localStream) {
      cleanupVoiceProcessing({ restoreRaw: false });
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
      stopVoiceActivityMonitor('local', 'local');
      if (localVideo) localVideo.srcObject = null;
    }
    isVideoOn = false;
    updateCallControlStates();
    refreshCallQualityMonitorState();

  } catch (err) {
    console.error("Error ending private call:", err);
  }
}



async function ShowFriendsMainView() {
  clearContent();

  const viewsToHide = [
    '.pendingRequestsDiv',
    '.addFriendsDiv',
    '.removeFriendsDiv',
    '.privateMessage',
    '#serverDetails'
  ];

  viewsToHide.forEach(selector => {
    const el = document.querySelector(selector);
    if (el) hideElement(el);
  });

  hideAllElements('.pendingRequestsDiv');

  const friendsView = document.querySelector('.friendsMainView');
  if (friendsView) {
    showElement(friendsView, 'flex');
    showElement('.nav', 'flex');

    await FetchAndRenderFriendsMain();
  }
}

async function FetchAndRenderFriendsMain() {
  try {
    const countEl = document.getElementById('friendsCount');
    const listEl = document.querySelector('.friendsListMain');

    if (listEl) listEl.innerHTML = '';

    const res = await axios.get(
      `${homeApiBase}/api/Account/GetFriends`
    );

    let friends = [];
    if (Array.isArray(res.data)) {
      friends = res.data;
    }

    if (countEl) countEl.textContent = friends.length;

    if (friends.length === 0) {
      if (listEl) listEl.innerHTML = '<p class="search-empty-state">No friends found.</p>';
      return;
    }

    friends = [...new Set(friends)];

    if (listEl) listEl.innerHTML = '';

    friends.forEach(friendName => {
      const item = document.createElement('div');
      item.className = 'friend-item';
      item.onclick = (e) => {
        OpenDM(friendName);
      };

      const left = document.createElement('div');
      left.className = 'friend-item-left';

      const avatar = document.createElement('div');
      avatar.className = 'friend-item-avatar';
      setAvatarFallback(avatar);
      avatar.onclick = (e) => openProfilePopout(friendName, e.pageX, e.pageY);

      const info = document.createElement('div');
      info.className = 'friend-item-info';

      const name = document.createElement('span');
      name.className = 'friend-item-name';
      name.textContent = friendName;
      name.onclick = (e) => openProfilePopout(friendName, e.pageX, e.pageY);

      const status = document.createElement('span');
      status.className = 'friend-item-status';
      status.textContent = 'Online';

      info.appendChild(name);
      info.appendChild(status);
      left.appendChild(avatar);
      left.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'friend-actions';

      const msgBtn = document.createElement('div');
      msgBtn.className = 'friend-action-btn';
      msgBtn.innerHTML = '';
      msgBtn.title = 'Message';
      msgBtn.onclick = (e) => {
        e.stopPropagation();
        OpenDM(friendName);
      };

      actions.appendChild(msgBtn);

      item.appendChild(left);
      item.appendChild(actions);

      if (listEl) listEl.appendChild(item);
    });

  } catch (err) {
    console.error('Failed to render friends main:', err);
  }
}

function OpenDM(friendName) {
  clearContent();
  hideAllElements('.pendingRequestsDiv');

  const friendsView = document.querySelector('.friendsMainView');
  if (friendsView) hideElement(friendsView);

  currentFriend = friendName;
  currentGroupId = null;
  currentGroupName = '';
  InitWebSocket();
  GetPrivateMessage();
  hideElement('.nav');

  const privateMsg = document.querySelector('.privateMessage');
  if (privateMsg) showElement(privateMsg, 'flex');

  if (typeof directMessageUser !== 'undefined') directMessageUser.innerText = currentFriend;
}

setTimeout(() => {
  const seeFriendsBtn = document.getElementById('seeFriends');
  if (seeFriendsBtn) {
    seeFriendsBtn.onclick = ShowFriendsMainView;
  }
}, 1000);


async function startPrivateVideoCall() {
  const preCallUI = document.getElementById('preCallUI');
  const activeCallUI = document.getElementById('activeCallUI');

  hideElement(preCallUI);
  showElement(activeCallUI, 'block');
  clearCallVolumeControls('private');
  isVideoOn = true;
  startCallQualityMonitor();
  updateCallControlStates();

  const activeCallUsername = document.getElementById('activeCallUsername');
  const centerCallUser = document.getElementById('centerCallUser');
  if (activeCallUsername) activeCallUsername.textContent = currentFriend || 'Unknown User';
  if (centerCallUser) centerCallUser.textContent = currentFriend || 'Unknown User';

  console.log('Private VIDEO call UI started, initiating call...');

  try {
    await initializeVoiceConnection();

    if (!voiceConnection || voiceConnection.readyState !== WebSocket.OPEN) {
      console.error('Voice connection not ready');
      return;
    }

    voiceConnection.send(JSON.stringify({
      Type: 'identify',
      Username: JWTusername
    }));

    await ensureLocalStream(true, true);

    if (!currentFriend) {
      console.error('No friend selected to call');
      return;
    }

    const peerConnection = await createPeerConnection(currentFriend);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const offerPayload = {
      type: offer.type,
      sdp: offer.sdp,
      isVideo: true
    };

    voiceConnection.send(JSON.stringify({
      Type: 'peer-offer',
      Data: JSON.stringify(offerPayload),
      TargetUser: currentFriend,
      IsPrivate: true,
      IsVideo: true
    }));

    console.log('Video Offer sent to ' + currentFriend);

  } catch (err) {
    console.error('Failed to start private video call:', err);
  }
}
window.startPrivateVideoCall = startPrivateVideoCall;


function updateVideoDiagnostics() {
  const debugEl = document.getElementById('videoDebug');
  if (!debugEl || !isElementVisible('#activeCallUI')) return;

  let localStatus = 'Local: Disconnected';
  if (localStream) {
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    localStatus = `Local: Audio=${audioTracks.length} (En=${audioTracks[0]?.enabled}), Video=${videoTracks.length} (En=${videoTracks[0]?.enabled})`;
  }

  let remoteStatus = 'Remote: Disconnected';
  const remoteVideo = document.getElementById('remoteVideo');
  if (remoteVideo && remoteVideo.srcObject) {
    const rStream = remoteVideo.srcObject;
    const rvTracks = rStream.getVideoTracks();
    const raTracks = rStream.getAudioTracks();
    remoteStatus = `Remote: Audio=${raTracks.length}, Video=${rvTracks.length} (Paused=${remoteVideo.paused}, Ready=${remoteVideo.readyState})`;
  } else {
    remoteStatus = 'Remote: No Stream Attached';
  }

  let pcStatus = 'PC: N/A';
  if (currentFriend && peerConnections.has(currentFriend)) {
    const pc = peerConnections.get(currentFriend);
    pcStatus = `PC: ${pc.connectionState}, ICE: ${pc.iceConnectionState}, Sig: ${pc.signalingState}`;
  }

  debugEl.innerHTML = `<h3>Diagnostics</h3>${localStatus}<br>${remoteStatus}<br>${pcStatus}`;
}


async function handleDMFileUpload(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${homeApiBase}/api/Upload/UploadImage`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data && res.data.url) {
        const fileUrl = homeApiBase + res.data.url;
        console.log('File uploaded:', fileUrl);

        const messageText = `[Image](${fileUrl})`;

        const messageObject = {
          PrivateMessageID: generateUUID(),
          MessageUserReciver: currentFriend,
          FriendMessagesData: messageText,
          AttachmentUrl: fileUrl,
          AttachmentContentType: file.type,
        };

        await apiClient.post(`${homeApiBase}/api/PrivateMessageFriend/SendPrivateMessage`, messageObject);
        await GetPrivateMessage();
      }
    } catch (err) {
      console.error('File upload failed:', err);
      showAppMessage(getApiErrorMessage(err, 'Failed to upload image.'), 'error');
    }

    input.value = '';
  }
}



let currentUploadFile = null;

function openUploadModal() {
  const modal = document.getElementById('uploadModal');
  const dropZone = document.getElementById('uploadDropZone');
  const fileInput = document.getElementById('modalFileInput');

  currentUploadFile = null;
  hideElement('#uploadPreview');
  showElement('#uploadDropZone', 'block');
  fileInput.value = '';

  showElement(modal, 'flex');

  dropZone.onclick = () => fileInput.click();

  dropZone.ondragover = (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-active');
  };

  dropZone.ondragleave = () => {
    dropZone.classList.remove('drag-active');
  };

  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-active');

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  fileInput.onchange = (e) => {
    if (fileInput.files && fileInput.files[0]) {
      handleFileSelection(fileInput.files[0]);
    }
  };
}

function closeUploadModal() {
  hideElement('#uploadModal');
}

function handleFileSelection(file) {
  if (!file.type.startsWith('image/')) {
    showAppMessage('Only image files are supported.', 'error');
    return;
  }

  currentUploadFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    hideElement('#uploadDropZone');
    const preview = document.getElementById('uploadPreview');
    showElement(preview, 'block');

    document.getElementById('uploadFileName').textContent = file.name;
    const img = document.getElementById('uploadImagePreview');
    img.src = e.target.result;
    showElement(img, 'block');
  };
  reader.readAsDataURL(file);
}

async function submitUploadModal() {
  if (!currentUploadFile) return;

  const formData = new FormData();
  formData.append('file', currentUploadFile);

  const btn = document.querySelector('#uploadModal .upload-btn');
  const originalText = btn.textContent;
  btn.textContent = 'Uploading...';
  btn.disabled = true;

  try {
    const res = await axios.post(`${homeApiBase}/api/Upload/UploadImage`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    if (res.data && res.data.url) {
      const fileUrl = homeApiBase + res.data.url;
      console.log('File uploaded:', fileUrl);

      const messageText = `[Image](${fileUrl})`;

      if (currentGroupId) {
        await apiClient.post(`${homeApiBase}/api/GroupChat/SendGroupMessage`, {
          groupId: currentGroupId,
          content: messageText,
          attachmentUrl: fileUrl,
          attachmentContentType: currentUploadFile.type,
        });
        await GetGroupMessages(currentGroupId);
      } else if (currentFriend) {
        await apiClient.post(`${homeApiBase}/api/PrivateMessageFriend/SendPrivateMessage`, {
          PrivateMessageID: generateUUID(),
          MessageUserReciver: currentFriend,
          FriendMessagesData: messageText,
          AttachmentUrl: fileUrl,
          AttachmentContentType: currentUploadFile.type,
        });
        await GetPrivateMessage();
      }

      closeUploadModal();
    }
  } catch (err) {
    console.error('File upload failed:', err);
    showAppMessage(getApiErrorMessage(err, 'Failed to upload image.'), 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}




function setupEmojiPicker() {
  const container = document.getElementById('emojiGridContainer');
  const searchInput = document.getElementById('emojiSearchInput');
  const picker = document.getElementById('emojiPicker');
  const tabs = document.querySelectorAll('.emoji-tab');

  if (!container || !picker) return;

  let currentTab = 'emoji';

  const renderContent = (filterText = '') => {
    container.innerHTML = '';
    const safeFilter = filterText.toLowerCase();

    if (currentTab === 'emoji') {
      const title = document.createElement('div');
      title.className = 'emoji-category-title';
      title.textContent = 'All Emojis';
      container.appendChild(title);

      const filtered = emojiList.filter(e => {
        if (!safeFilter) return true;
        return e.names.some(name => name.includes(safeFilter)) || e.char.includes(safeFilter);
      });

      filtered.forEach(item => {
        const span = document.createElement('span');
        span.textContent = item.char;
        span.className = 'emoji-item';

        span.onmouseenter = () => {
          const pEmoji = document.getElementById('previewEmoji');
          const pName = document.getElementById('previewName');
          if (pEmoji) pEmoji.textContent = item.char;
          if (pName) pName.textContent = ':' + item.names[0] + ':';
        };

        span.onclick = () => {
          const input = document.querySelector('.chatInput');
          if (input) {
            input.value += item.char;
            input.focus();
          }
        };
        container.appendChild(span);
      });

      if (filtered.length === 0) {
        const msg = document.createElement('div');
        msg.className = 'emoji-empty-state';
        msg.textContent = 'No emojis found';
        container.appendChild(msg);
      }
    } else if (currentTab === 'gif') {
      const title = document.createElement('div');
      title.className = 'emoji-category-title';
      title.textContent = 'Trending GIFs';
      container.appendChild(title);

      const filteredGifs = gifList.filter(item => {
        if (!safeFilter) return true;
        return item.keywords.some(k => k.includes(safeFilter));
      });

      filteredGifs.forEach(item => {
        const div = document.createElement('div');
        div.className = 'gif-item';
        const img = document.createElement('img');
        img.className = 'gif-item-img';
        img.src = item.url;
        img.alt = item.keywords?.[0] || 'GIF';
        div.appendChild(img);

        div.onclick = () => {
          const input = document.querySelector('.chatInput');
          if (input) {
            input.value += `[Image](${item.url})`;
            input.focus();
          }
        };

        div.onmouseenter = () => {
          const pEmoji = document.getElementById('previewEmoji');
          const pName = document.getElementById('previewName');
          if (pEmoji) pEmoji.textContent = 'GIF';
          if (pName) pName.textContent = 'GIF Image';
        };

        container.appendChild(div);
      });

      if (filteredGifs.length === 0) {
        const msg = document.createElement('div');
        msg.className = 'emoji-empty-state';
        msg.textContent = 'No GIFs found';
        container.appendChild(msg);
      }
    }
  };

  renderContent();

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderContent(e.target.value);
    });
  }

  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      console.log('Switched to tab:', currentTab);

      const sidebar = document.querySelector('.emoji-sidebar');
      if (sidebar) {
        setElementVisible(sidebar, currentTab === 'emoji', 'flex');
      }

      if (searchInput) {
        searchInput.value = '';
        searchInput.placeholder = currentTab === 'emoji' ? 'Find the perfect emoji' : 'Search Tenor';
      }
      renderContent();
    };
  });

  document.addEventListener('click', (e) => {
    const btn = document.querySelector('.chat-icon-btn');
    if (!picker.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      hideElement(picker);
      if (searchInput) searchInput.value = '';
    }
  });
}

function setupMessageSearch() {
  const form = document.querySelector('.search-form');
  const input = document.getElementById('dmSearchInput');

  if (!form || !input) return;

  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  const newInput = document.getElementById('dmSearchInput');

  newForm.onsubmit = (e) => {
    e.preventDefault();
    handleSearchSubmit(newInput.value);
  };
}

function handleSearchSubmit(query) {
  if (!query.trim()) return;

  const sidebar = document.getElementById('searchResultsSidebar');
  const list = document.getElementById('searchResultsList');
  const countSpan = document.getElementById('searchResultCount');

  if (!sidebar || !list) return;

  list.innerHTML = '';
  showElement(sidebar, 'flex');

  const messages = document.querySelectorAll('.messagesDisplay p');
  let matchCount = 0;

  messages.forEach(msg => {

    const content = msg.textContent;
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    if (lowerContent.includes(lowerQuery)) {
      matchCount++;



      let username = "User";
      let messageText = content;
      let date = "";

      const firstColon = content.indexOf(':');
      const lastParenOpen = content.lastIndexOf('(');
      const lastParenClose = content.lastIndexOf(')');

      if (firstColon > -1) {
        username = content.substring(0, firstColon).trim();

        if (lastParenOpen > firstColon && lastParenClose > lastParenOpen) {

          messageText = content.substring(firstColon + 1, lastParenOpen).trim();
          date = content.substring(lastParenOpen + 1, lastParenClose);
        } else {

          messageText = content.substring(firstColon + 1).trim();
        }
      }

      const card = createSearchResultCard(username, messageText, date, query);
      list.appendChild(card);
    }
  });

  if (countSpan) {
    countSpan.textContent = `${matchCount} Results`;
  }
}

function createSearchResultCard(username, text, date, query) {
  const card = document.createElement('div');
  card.className = 'search-result-card';


  const regex = new RegExp(`(${query})`, 'gi');
  const highlightedText = text.replace(regex, '<span class="highlight">$1</span>');


  const avatarLetter = username.charAt(0).toUpperCase();

  card.innerHTML = `
    <div class="card-header">
      <div class="card-avatar">${avatarLetter}</div>
      <div class="card-meta">
        <span class="card-username">${username}</span>
        <span class="card-date">${date}</span>
      </div>
    </div>
    <div class="card-content">${highlightedText}</div>
  `;

  return card;
}

function closeSearchResults() {
  const sidebar = document.getElementById('searchResultsSidebar');
  if (sidebar) hideElement(sidebar);
}

function toggleEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  if (!isElementVisible(picker)) {
    showElement(picker, 'flex');
    const searchInput = document.getElementById('emojiSearchInput');
    if (searchInput) searchInput.focus();
  } else {
    hideElement(picker);
  }
}

const profilePopout = document.getElementById('profilePopout');

function closeProfilePopout() {
  if (profilePopout) {
    hideElement(profilePopout);
  }
}

document.addEventListener('click', (e) => {
  if (isElementVisible(profilePopout)) {
    if (!profilePopout.contains(e.target) && !e.target.closest('.message-avatar') && !e.target.closest('.friend-item-avatar') && !e.target.closest('.message-username') && !e.target.closest('.card-avatar')) {
      closeProfilePopout();
    }
  }
});

window.openProfilePopout = async function (username, x, y) {
  if (!profilePopout) return;

  document.getElementById('popoutUsername').innerText = username;
  document.getElementById('popoutDescription').innerText = "Loading...";
  document.getElementById('popoutAvatar').src = homeDefaultAvatarUrl;
  let reportButton = document.getElementById('profileReportBtn');
  if (!reportButton) {
    reportButton = document.createElement('button');
    reportButton.id = 'profileReportBtn';
    reportButton.type = 'button';
    reportButton.className = 'profile-popout-report-btn';
    document.querySelector('#profilePopout .profile-popout-body')?.appendChild(reportButton);
  }
  reportButton.textContent = 'Report User';
  reportButton.hidden = username === JWTusername;
  reportButton.onclick = () => {
    closeProfilePopout();
    openReportDialog({
      targetType: 'user',
      scopeType: getActiveReportScope('user'),
      targetUsername: username,
    });
  };

  try {
    const res = await axios.get(`${homeApiBase}/api/Account/GetAccountProfile?username=${encodeURIComponent(username)}`);
    const profile = res.data;

    if (profile) {
      if (profile.description) {
        document.getElementById('popoutDescription').innerText = profile.description;
      } else {
        document.getElementById('popoutDescription').innerText = "No description provided.";
      }

      if (profile.profilePictureUrl) {
        document.getElementById('popoutAvatar').src = profile.profilePictureUrl;
      }
    }
  } catch (err) {
    console.error("Failed to load profile for popout", err);
    document.getElementById('popoutDescription').innerText = "Failed to load profile.";
  }

  const startX = Math.max(0, Number(x) || 0);
  const startY = Math.max(0, Number(y) || 0);
  setHomeRuntimeCss(
    'profile-popout-position',
    `#profilePopout { left: ${Math.round(startX)}px; top: ${Math.round(startY)}px; }`
  );
  showElement(profilePopout, 'block');

  const rect = profilePopout.getBoundingClientRect();
  let finalX = startX;
  let finalY = startY;

  if (finalX + rect.width > window.innerWidth) {
    finalX = window.innerWidth - rect.width - 20;
  }
  if (finalY + rect.height > window.innerHeight) {
    finalY = window.innerHeight - rect.height - 20;
  }

  setHomeRuntimeCss(
    'profile-popout-position',
    `#profilePopout { left: ${Math.round(finalX)}px; top: ${Math.round(finalY)}px; }`
  );
}


const SETTINGS_STORAGE_KEY = 'discordClone_settings_v2';
const LIGHT_THEME = {
  background: '#f2f3f5',
  text: '#1e1f22',
};

let settingsInteractivityInitialized = false;
let settingsSystemThemeListenerInitialized = false;
let accountSettingsLoadPromise = null;
let accountSettingsPersistTimer = null;
let accountSettingsServerState = null;
let voicePreviewStream = null;
let voicePreviewAudio = null;
let voicePreviewContext = null;

function createDefaultSettingsState() {
  return {
    selectedTab: 'my-account',
    profileView: 'user-profile',
    themeMode: 'dark',
    messageDisplay: 'cozy',
    inputMode: 'voice-activity',
    fontSize: 16,
    zoomLevel: 100,
    saturation: 100,
    toggles: {},
    checkboxes: {},
    radios: {},
    sliders: {},
    selects: {},
    keybinds: null,
    profileBannerColor: '#0c0c0c',
    profileBannerUrl: '',
    presenceStatus: 'online',
    contact: {
      email: '',
      phoneNumber: '',
      emailVerified: false,
      phoneNumberVerified: false,
    },
    verification: {
      emailVerificationAvailable: true,
      phoneVerificationAvailable: false,
    },
    twoFactor: {
      enabled: false,
      authenticatorConfigured: false,
      backupCodesRemaining: 0,
    },
    privacy: {
      dmPolicy: 'friends',
      allowFriendRequestsEveryone: true,
      allowFriendRequestsFriendsOfFriends: true,
      allowFriendRequestsServerMembers: true,
      showActivity: true,
    },
    voiceChanger: {
      enabled: false,
      preset: 'normal',
      pitch: 0,
      formant: 0,
      distortion: 0,
      echo: 0,
      perCallEnabled: true,
    },
    connectedAccounts: {},
    removedItems: {},
  };
}

function normalizeSettingsNumber(value, fallback, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function readSettingsState() {
  const fallbackState = createDefaultSettingsState();
  let legacyFontSize = null;

  try {
    legacyFontSize = localStorage.getItem('discordClone_fontSize');
    const rawValue = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!rawValue) {
      if (legacyFontSize) {
        fallbackState.fontSize = normalizeSettingsNumber(
          legacyFontSize,
          fallbackState.fontSize,
          12,
          24
        );
      }
      return fallbackState;
    }

    const parsedState = JSON.parse(rawValue);
    if (!parsedState || typeof parsedState !== 'object') {
      return fallbackState;
    }

    return {
      ...fallbackState,
      ...parsedState,
      selectedTab:
        typeof parsedState.selectedTab === 'string'
          ? parsedState.selectedTab
          : fallbackState.selectedTab,
      profileView:
        typeof parsedState.profileView === 'string'
          ? parsedState.profileView
          : fallbackState.profileView,
      themeMode:
        typeof parsedState.themeMode === 'string'
          ? parsedState.themeMode
          : fallbackState.themeMode,
      messageDisplay:
        typeof parsedState.messageDisplay === 'string'
          ? parsedState.messageDisplay
          : fallbackState.messageDisplay,
      inputMode:
        typeof parsedState.inputMode === 'string'
          ? parsedState.inputMode
          : fallbackState.inputMode,
      fontSize: normalizeSettingsNumber(
        parsedState.fontSize ?? legacyFontSize,
        fallbackState.fontSize,
        12,
        24
      ),
      zoomLevel: normalizeSettingsNumber(
        parsedState.zoomLevel,
        fallbackState.zoomLevel,
        50,
        150
      ),
      saturation: normalizeSettingsNumber(
        parsedState.saturation,
        fallbackState.saturation,
        0,
        100
      ),
      toggles:
        parsedState.toggles && typeof parsedState.toggles === 'object'
          ? parsedState.toggles
          : {},
      checkboxes:
        parsedState.checkboxes && typeof parsedState.checkboxes === 'object'
          ? parsedState.checkboxes
          : {},
      radios:
        parsedState.radios && typeof parsedState.radios === 'object'
          ? parsedState.radios
          : {},
      sliders:
        parsedState.sliders && typeof parsedState.sliders === 'object'
          ? parsedState.sliders
          : {},
      selects:
        parsedState.selects && typeof parsedState.selects === 'object'
          ? parsedState.selects
          : {},
      keybinds: Array.isArray(parsedState.keybinds) ? parsedState.keybinds : null,
      profileBannerColor:
        typeof parsedState.profileBannerColor === 'string'
          ? parsedState.profileBannerColor
          : fallbackState.profileBannerColor,
      profileBannerUrl:
        typeof parsedState.profileBannerUrl === 'string'
          ? parsedState.profileBannerUrl
          : fallbackState.profileBannerUrl,
      presenceStatus:
        typeof parsedState.presenceStatus === 'string'
          ? parsedState.presenceStatus
          : fallbackState.presenceStatus,
      contact:
        parsedState.contact && typeof parsedState.contact === 'object'
          ? { ...fallbackState.contact, ...parsedState.contact }
          : fallbackState.contact,
      verification:
        parsedState.verification && typeof parsedState.verification === 'object'
          ? { ...fallbackState.verification, ...parsedState.verification }
          : fallbackState.verification,
      twoFactor:
        parsedState.twoFactor && typeof parsedState.twoFactor === 'object'
          ? { ...fallbackState.twoFactor, ...parsedState.twoFactor }
          : fallbackState.twoFactor,
      privacy:
        parsedState.privacy && typeof parsedState.privacy === 'object'
          ? { ...fallbackState.privacy, ...parsedState.privacy }
          : fallbackState.privacy,
      voiceChanger:
        parsedState.voiceChanger && typeof parsedState.voiceChanger === 'object'
          ? { ...fallbackState.voiceChanger, ...parsedState.voiceChanger }
          : fallbackState.voiceChanger,
      connectedAccounts:
        parsedState.connectedAccounts && typeof parsedState.connectedAccounts === 'object'
          ? parsedState.connectedAccounts
          : {},
      removedItems:
        parsedState.removedItems && typeof parsedState.removedItems === 'object'
          ? parsedState.removedItems
          : {},
    };
  } catch (error) {
    console.warn('Failed to read saved settings state:', error);
    if (legacyFontSize) {
      fallbackState.fontSize = normalizeSettingsNumber(
        legacyFontSize,
        fallbackState.fontSize,
        12,
        24
      );
    }
    return fallbackState;
  }
}

function renderMemberModerationActions(member) {
  const actions = document.createElement('div');
  actions.className = 'member-actions';

  if (member.username === JWTusername || normalizeRoleName(member.role) === 'owner') {
    return actions;
  }

  const actionDefs = [
    ['Kick', () => moderateServerMember('KickMember', member.username)],
    ['Ban', () => moderateServerMember('BanMember', member.username)],
    [
      member.isTimedOut ? 'Clear timeout' : 'Timeout',
      () => member.isTimedOut
        ? clearServerMemberTimeout(member.username)
        : timeoutServerMember(member.username),
    ],
    [
      member.isMuted ? 'Unmute' : 'Mute',
      () => member.isMuted
        ? unmuteServerMember(member.username)
        : muteServerMember(member.username),
    ],
    ['Role', () => changeServerMemberRole(member.username, member.role)],
    ['Owner', () => transferServerOwnership(member.username)],
  ];

  actionDefs.forEach(([label, handler]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'member-action-btn';
    button.textContent = label;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      handler();
    });
    actions.appendChild(button);
  });

  return actions;
}

function renderMemberModerationBadges(member) {
  const badges = document.createElement('div');
  badges.className = 'member-moderation-badges';

  if (member.isTimedOut) {
    badges.appendChild(createMemberModerationBadge(
      'Timeout',
      `Timed out ${formatModerationUntil(member.timedOutUntil)}`
    ));
  }

  if (member.isMuted) {
    badges.appendChild(createMemberModerationBadge(
      'Muted',
      member.mutedUntil ? `Muted ${formatModerationUntil(member.mutedUntil)}` : 'Muted indefinitely'
    ));
  }

  return badges;
}

function createMemberModerationBadge(label, title) {
  const badge = document.createElement('span');
  badge.className = 'member-moderation-badge';
  badge.textContent = label;
  badge.title = title;
  return badge;
}

function formatModerationUntil(value) {
  if (!value) return 'indefinitely';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'until the selected time';
  return `until ${date.toLocaleString()}`;
}

async function moderateServerMember(action, targetUsername) {
  const isBan = action === 'BanMember';
  const reason = isBan ? await askText('Ban Member', 'Ban reason (optional)') : null;
  if (!await askConfirm(
    isBan ? 'Ban Member' : 'Kick Member',
    `${isBan ? 'Ban' : 'Kick'} ${targetUsername}?`,
    { danger: true, confirmText: isBan ? 'Ban' : 'Kick' }
  )) return;

  try {
    await axios.post(`${homeApiBase}/api/Server/${action}`, {
      serverId: selectedServerID,
      targetUsername,
      reason,
    });
    await fetchServerMembers();
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Moderation action failed.'), 'error');
  }
}

async function muteServerMember(targetUsername) {
  const details = await askModerationDetails({
    title: 'Mute Member',
    description: `Mute ${targetUsername} from sending messages. Leave duration blank for an indefinite mute.`,
    allowIndefinite: true,
    defaultDuration: '60',
    confirmText: 'Mute',
  });
  if (!details) return;

  try {
    await axios.post(`${homeApiBase}/api/Server/MuteMember`, {
      serverId: selectedServerID,
      targetUsername,
      ...details,
    });
    await fetchServerMembers();
    showAppMessage('Member muted.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not mute member.'), 'error');
  }
}

async function unmuteServerMember(targetUsername) {
  if (!await askConfirm('Unmute Member', `Unmute ${targetUsername}?`, { confirmText: 'Unmute' })) return;

  try {
    await axios.post(`${homeApiBase}/api/Server/UnmuteMember`, {
      serverId: selectedServerID,
      targetUsername,
    });
    await fetchServerMembers();
    showAppMessage('Member unmuted.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not unmute member.'), 'error');
  }
}

async function timeoutServerMember(targetUsername) {
  const details = await askModerationDetails({
    title: 'Timeout Member',
    description: `Timeout ${targetUsername} from messages, reactions, and voice.`,
    allowIndefinite: false,
    defaultDuration: '10',
    confirmText: 'Timeout',
  });
  if (!details) return;

  try {
    await axios.post(`${homeApiBase}/api/Server/TimeoutMember`, {
      serverId: selectedServerID,
      targetUsername,
      ...details,
    });
    await fetchServerMembers();
    showAppMessage('Member timed out.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not timeout member.'), 'error');
  }
}

async function clearServerMemberTimeout(targetUsername) {
  if (!await askConfirm('Clear Timeout', `Clear timeout for ${targetUsername}?`, { confirmText: 'Clear' })) return;

  try {
    await axios.post(`${homeApiBase}/api/Server/ClearMemberTimeout`, {
      serverId: selectedServerID,
      targetUsername,
    });
    await fetchServerMembers();
    showAppMessage('Timeout cleared.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not clear timeout.'), 'error');
  }
}

async function askModerationDetails({ title, description, allowIndefinite, defaultDuration, confirmText }) {
  const result = await openSimpleFormDialog({
    title,
    description,
    fields: [
      {
        name: 'durationMinutes',
        label: allowIndefinite ? 'Duration minutes (blank for indefinite)' : 'Duration minutes',
        type: 'number',
        min: 1,
        max: 40320,
        step: 1,
        value: defaultDuration,
        required: !allowIndefinite,
      },
      {
        name: 'reason',
        label: 'Reason (optional)',
        required: false,
      },
    ],
    confirmText,
  });

  if (!result) return null;

  const durationText = result.durationMinutes?.trim() || '';
  let durationMinutes = null;
  if (durationText) {
    durationMinutes = Number.parseInt(durationText, 10);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 40320) {
      showAppMessage('Duration must be between 1 minute and 28 days.', 'error');
      return null;
    }
  } else if (!allowIndefinite) {
    showAppMessage('Duration is required.', 'error');
    return null;
  }

  return {
    durationMinutes,
    reason: result.reason?.trim() || null,
  };
}

async function changeServerMemberRole(targetUsername, currentRole = 'user') {
  let roles = [];
  try {
    roles = await fetchServerRoles({ force: true });
  } catch {
    return;
  }

  const roleOptions = roles
    .filter((role) => getServerRoleName(role) !== 'owner')
    .map((role) => ({
      value: getServerRoleName(role),
      label: formatRoleName(role.name),
    }));
  if (!roleOptions.length) {
    showAppMessage('Create a role before assigning one.', 'error');
    return;
  }

  const normalizedCurrentRole = normalizeRoleName(currentRole);
  const result = await openSimpleFormDialog({
    title: 'Change Role',
    description: targetUsername,
    fields: [
      {
        name: 'role',
        label: 'Role',
        value: roleOptions.some((option) => option.value === normalizedCurrentRole)
          ? normalizedCurrentRole
          : 'user',
        options: roleOptions,
      },
    ],
    confirmText: 'Save Role',
  });
  const role = result?.role;
  if (!role || role === normalizedCurrentRole) return;

  try {
    await axios.post(`${homeApiBase}/api/Server/SetMemberRole`, {
      serverId: selectedServerID,
      targetUsername,
      role,
    });
    await fetchServerMembers();
    showAppMessage('Member role updated.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not update role.'), 'error');
  }
}

async function transferServerOwnership(targetUsername) {
  if (!await askConfirm('Transfer Ownership', `Transfer ownership to ${targetUsername}?`, { danger: true, confirmText: 'Transfer' })) return;

  try {
    await axios.post(`${homeApiBase}/api/Server/TransferOwnership`, {
      serverId: selectedServerID,
      targetUsername,
    });
    await fetchServerMembers();
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not transfer ownership.'), 'error');
  }
}

async function uploadImageFile(file) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Only image files are supported.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const res = await axios.post(`${homeApiBase}/api/Upload/UploadImage`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  if (!res.data?.url) {
    throw new Error('Upload did not return a file URL.');
  }

  return homeApiBase + res.data.url;
}

function writeSettingsState(updater) {
  const currentState = readSettingsState();
  const nextState =
    typeof updater === 'function' ? updater(currentState) : { ...currentState, ...updater };

  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextState));
    localStorage.setItem('discordClone_fontSize', String(nextState.fontSize));
    scheduleAccountSettingsPersist(nextState);
  } catch (error) {
    console.warn('Failed to save settings state:', error);
  }

  return nextState;
}

function parseSettingsJson(value, fallback = {}) {
  if (!value || typeof value !== 'string') return fallback;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : fallback;
  } catch (error) {
    console.warn('Failed to parse server settings JSON:', error);
    return fallback;
  }
}

function scheduleAccountSettingsPersist(state = readSettingsState()) {
  window.clearTimeout(accountSettingsPersistTimer);
  accountSettingsPersistTimer = window.setTimeout(() => {
    persistAccountSettings(state).catch((error) => {
      console.warn('Failed to persist settings:', error);
    });
  }, 450);
}

async function persistAccountSettings(state = readSettingsState()) {
  const settingsPayload = { ...state };
  delete settingsPayload.contact;
  delete settingsPayload.verification;
  delete settingsPayload.twoFactor;
  delete settingsPayload.privacy;

  await axios.post(`${homeApiBase}/api/Account/UpdateAccountSettings`, {
    settings: settingsPayload,
    voiceChangerSettings: state.voiceChanger || createDefaultSettingsState().voiceChanger,
  });
}

async function loadAccountSettings({ force = false } = {}) {
  if (accountSettingsLoadPromise && !force) {
    return accountSettingsLoadPromise;
  }

  accountSettingsLoadPromise = axios
    .get(`${homeApiBase}/api/Account/GetAccountSettings`)
    .then((res) => {
      applyAccountSettingsResponse(res.data || {});
      return res.data;
    })
    .catch((error) => {
      console.warn('Could not load account settings:', error);
      return null;
    })
    .finally(() => {
      accountSettingsLoadPromise = null;
    });

  return accountSettingsLoadPromise;
}

function applyAccountSettingsResponse(data) {
  const serverState = parseSettingsJson(data.settingsJson, {});
  const voiceChangerState = parseSettingsJson(data.voiceChangerSettingsJson, {});
  const fallback = createDefaultSettingsState();

  accountSettingsServerState = {
    ...fallback,
    ...serverState,
    contact: {
      email: data.email || '',
      phoneNumber: data.phoneNumber || '',
      emailVerified: Boolean(data.emailVerified),
      phoneNumberVerified: Boolean(data.phoneNumberVerified),
      emailVerifiedAt: data.emailVerifiedAt || null,
      phoneNumberVerifiedAt: data.phoneNumberVerifiedAt || null,
    },
    verification: {
      emailVerificationAvailable: data.emailVerificationAvailable !== false,
      phoneVerificationAvailable: Boolean(data.phoneVerificationAvailable),
    },
    twoFactor: {
      ...fallback.twoFactor,
      ...(data.twoFactor || {}),
    },
    privacy: {
      ...fallback.privacy,
      ...(data.privacy || {}),
    },
    presenceStatus: data.presenceStatus || serverState.presenceStatus || fallback.presenceStatus,
    profileBannerColor:
      data.profileBannerColor || serverState.profileBannerColor || fallback.profileBannerColor,
    profileBannerUrl: data.profileBannerUrl || serverState.profileBannerUrl || '',
    voiceChanger: {
      ...fallback.voiceChanger,
      ...(serverState.voiceChanger || {}),
      ...voiceChangerState,
    },
  };

  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(accountSettingsServerState));
    localStorage.setItem('discordClone_fontSize', String(accountSettingsServerState.fontSize));
  } catch (error) {
    console.warn('Failed to cache server settings:', error);
  }

  applyPersistedSettingsState();
  updateSettingsIdentityFields();
}

function slugifySettingsValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hasStoredSettingValue(store, key) {
  return Object.prototype.hasOwnProperty.call(store, key);
}

function getSettingsViewKey(element) {
  return (
    element
      ?.closest('.settings-view')
      ?.id?.replace(/^view-/, '') || 'global'
  );
}

function getToggleSettingKey(item, index) {
  if (item.dataset.settingKey) {
    return item.dataset.settingKey;
  }

  const labelText =
    item.querySelector('.toggle-label')?.textContent?.trim() || `toggle-${index}`;
  item.dataset.settingKey = `toggle-${getSettingsViewKey(item)}-${slugifySettingsValue(
    labelText
  )}`;
  return item.dataset.settingKey;
}

function getCheckboxSettingKey(item, index) {
  if (item.dataset.settingKey) {
    return item.dataset.settingKey;
  }

  const labelText = item.textContent?.trim() || `checkbox-${index}`;
  item.dataset.settingKey = `checkbox-${getSettingsViewKey(item)}-${slugifySettingsValue(
    labelText
  )}`;
  return item.dataset.settingKey;
}

function getSliderSettingKey(slider, index) {
  if (slider.dataset.settingsSlider) {
    return slider.dataset.settingsSlider;
  }

  if (slider.id) {
    return slider.id;
  }

  if (slider.dataset.settingKey) {
    return slider.dataset.settingKey;
  }

  const labelText =
    slider.closest('.form-group')?.querySelector('.form-label')?.textContent?.trim() ||
    slider.closest('.settings-view')?.querySelector('.settings-section-header')?.textContent?.trim() ||
    `slider-${index}`;
  slider.dataset.settingKey = `slider-${getSettingsViewKey(slider)}-${slugifySettingsValue(
    labelText
  )}`;
  return slider.dataset.settingKey;
}

function getSelectSettingKey(select, index) {
  if (select.dataset.settingsSelect) {
    return select.dataset.settingsSelect;
  }

  if (select.id) {
    return select.id;
  }

  if (select.dataset.settingKey) {
    return select.dataset.settingKey;
  }

  const labelText =
    select.closest('.form-group')?.querySelector('.form-label')?.textContent?.trim() ||
    `select-${index}`;
  select.dataset.settingKey = `select-${getSettingsViewKey(select)}-${slugifySettingsValue(
    labelText
  )}`;
  return select.dataset.settingKey;
}

function getRadioGroupKey(group, index) {
  if (group.dataset.settingsRadio) {
    return group.dataset.settingsRadio;
  }

  if (group.dataset.settingKey) {
    return group.dataset.settingKey;
  }

  const firstLabel =
    group.querySelector('.radio-title')?.textContent?.trim() || `radio-group-${index}`;
  group.dataset.settingKey = `radio-${getSettingsViewKey(group)}-${slugifySettingsValue(
    firstLabel
  )}`;
  return group.dataset.settingKey;
}

function getRadioItemValue(item, index = 0) {
  if (!item) {
    return String(index);
  }

  if (item.dataset.settingValue) {
    return item.dataset.settingValue;
  }

  const titleText = item.querySelector('.radio-title')?.textContent?.trim();
  return slugifySettingsValue(titleText || index);
}

function setRadioGroupSelection(group, desiredValue) {
  if (!group) {
    return { item: null, value: desiredValue };
  }

  const items = Array.from(group.querySelectorAll('.radio-item'));
  if (!items.length) {
    return { item: null, value: desiredValue };
  }

  const selectedItem =
    items.find((item, index) => getRadioItemValue(item, index) === desiredValue) || items[0];

  items.forEach((item) => {
    const isActive = item === selectedItem;
    item.classList.toggle('active', isActive);
    item.querySelector('.radio-circle')?.classList.toggle('selected', isActive);
  });

  return {
    item: selectedItem,
    value: getRadioItemValue(selectedItem, items.indexOf(selectedItem)),
  };
}

function updateSettingsIdentityFields() {
  if (typeof JWTusername === 'undefined' || !JWTusername) {
    return;
  }

  const state = readSettingsState();
  const settingsDisplayName = document.getElementById('settingsDisplayName');
  const settingsDisplayNameValue = document.getElementById('settingsDisplayNameValue');
  const settingsUsernameValue = document.getElementById('settingsUsernameValue');
  const settingsEmailValue = document.getElementById('settingsEmailValue');
  const settingsPhoneValue = document.getElementById('settingsPhoneValue');
  const settingsEmailVerificationStatus = document.getElementById('settingsEmailVerificationStatus');
  const settingsPhoneVerificationStatus = document.getElementById('settingsPhoneVerificationStatus');
  const emailVerificationPrimaryStatus = document.getElementById('emailVerificationPrimaryStatus');
  const twoFactorStatusText = document.getElementById('twoFactorStatusText');
  const phoneVerificationRow = document.getElementById('phoneVerificationRow');
  const requestPhoneVerificationBtn = document.getElementById('requestPhoneVerificationBtn');
  const removePhoneNumberBtn = document.getElementById('removePhoneNumberBtn');
  const enableTwoFactorBtn = document.getElementById('enableTwoFactorBtn');
  const disableTwoFactorBtn = document.getElementById('disableTwoFactorBtn');
  const regenerateBackupCodesBtn = document.getElementById('regenerateBackupCodesBtn');
  const presenceStatusSelect = document.getElementById('presenceStatusSelect');
  const previewName = document.querySelector('.preview-name');
  const previewTag = document.querySelector('.preview-tag');
  const phoneAvailable = Boolean(state.verification.phoneVerificationAvailable);

  if (settingsDisplayName) settingsDisplayName.innerText = JWTusername;
  if (settingsDisplayNameValue) settingsDisplayNameValue.innerText = JWTusername;
  if (settingsUsernameValue) settingsUsernameValue.innerText = JWTusername;
  if (settingsEmailValue) settingsEmailValue.innerText = state.contact.email || 'Not added';
  if (settingsPhoneValue) settingsPhoneValue.innerText = state.contact.phoneNumber || 'Not added';
  setElementVisible(phoneVerificationRow, phoneAvailable);
  if (requestPhoneVerificationBtn) requestPhoneVerificationBtn.disabled = !phoneAvailable;
  setElementVisible(removePhoneNumberBtn, phoneAvailable);
  if (settingsEmailVerificationStatus) {
    settingsEmailVerificationStatus.textContent = state.contact.email
      ? (state.contact.emailVerified ? 'Verified' : 'Unverified')
      : 'No email connected';
    settingsEmailVerificationStatus.classList.toggle('verified', Boolean(state.contact.emailVerified));
  }
  if (emailVerificationPrimaryStatus) {
    emailVerificationPrimaryStatus.textContent = state.contact.email
      ? (state.contact.emailVerified ? 'Verified' : 'Verify to unlock email-gated servers')
      : 'Add an email to verify';
    emailVerificationPrimaryStatus.classList.toggle('verified', Boolean(state.contact.emailVerified));
  }
  if (settingsPhoneVerificationStatus) {
    settingsPhoneVerificationStatus.textContent = state.contact.phoneNumber
      ? (state.contact.phoneNumberVerified ? 'Verified' : 'Unverified')
      : 'No phone connected';
    settingsPhoneVerificationStatus.classList.toggle('verified', Boolean(state.contact.phoneNumberVerified));
  }
  if (twoFactorStatusText) {
    const remaining = Number(state.twoFactor.backupCodesRemaining || 0);
    twoFactorStatusText.textContent = state.twoFactor.enabled
      ? `Enabled - ${remaining} backup code${remaining === 1 ? '' : 's'} left`
      : 'Disabled';
    twoFactorStatusText.classList.toggle('verified', Boolean(state.twoFactor.enabled));
  }
  setElementVisible(enableTwoFactorBtn, !state.twoFactor.enabled);
  setElementVisible(disableTwoFactorBtn, state.twoFactor.enabled);
  if (regenerateBackupCodesBtn) regenerateBackupCodesBtn.disabled = !state.twoFactor.enabled;
  if (presenceStatusSelect) presenceStatusSelect.value = state.presenceStatus || 'online';
  if (previewName) previewName.textContent = JWTusername;
  if (previewTag) {
    previewTag.textContent =
      '#' + Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  }
}

function updateProfileVisuals(profilePictureUrl, description, profileBannerUrl = null, profileBannerColor = '') {
  const nextAvatarUrl = profilePictureUrl || homeDefaultAvatarUrl;
  const nextDescription = description || 'Click to add custom status';
  const settingsState = readSettingsState();
  const nextBannerColor = profileBannerColor || settingsState.profileBannerColor || '#0c0c0c';
  const nextBannerUrl = profileBannerUrl === null ? settingsState.profileBannerUrl || '' : profileBannerUrl;

  document
    .querySelectorAll('.settings-avatar, .preview-avatar img, #popoutAvatar')
    .forEach((img) => {
      if (img.tagName !== 'IMG') {
        return;
      }

      img.onerror = () => {
        img.onerror = null;
        img.src = homeDefaultAvatarUrl;
      };
      img.src = nextAvatarUrl;
    });

  const customStatus = document.querySelector('.preview-custom-status');
  if (customStatus) {
    customStatus.textContent = nextDescription;
  }

  applyDynamicProfileBanner(nextBannerColor, nextBannerUrl);
}

function filterSettingsSidebarItems(query = '') {
  const normalizedQuery = query.trim().toLowerCase();
  let firstMatch = null;

  document.querySelectorAll('.settings-sidebar .settings-section').forEach((section) => {
    const items = Array.from(section.querySelectorAll('.settings-item[data-target]'));
    if (!items.length) {
      setElementVisible(section, !normalizedQuery);
      return;
    }

    let visibleItemCount = 0;
    items.forEach((item) => {
      const matches =
        !normalizedQuery || item.textContent.toLowerCase().includes(normalizedQuery);
      setElementVisible(item, matches);

      if (matches) {
        visibleItemCount += 1;
        if (!firstMatch) {
          firstMatch = item;
        }
      }
    });

    const groupTitle = section.querySelector('.settings-group-title');
    if (groupTitle) {
      setElementVisible(groupTitle, Boolean(visibleItemCount));
    }

    setElementVisible(section, Boolean(visibleItemCount));
  });

  return firstMatch;
}

function applyProfileTab(tabKey) {
  const targetTab = tabKey || 'user-profile';
  const profileTabBar = document.querySelector('[data-settings-tab-bar="profileView"]');
  if (!profileTabBar) {
    return;
  }

  profileTabBar.querySelectorAll('.settings-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === targetTab);
  });

  document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    setElementVisible(panel, panel.dataset.tabPanel === targetTab, 'block');
  });
}

function applyMessageDisplay(mode) {
  const isCompact = mode === 'compact';
  document.documentElement.classList.toggle('message-display-compact', isCompact);
}

function applyMessageFontSize(fontSize) {
  const normalizedFontSize = Math.round(normalizeSettingsNumber(fontSize, 16, 12, 24));
  document.documentElement.classList.remove(...messageFontSizeClasses);
  document.documentElement.classList.add(`message-font-size-${normalizedFontSize}`);
}

function applyZoomLevel(zoomLevel) {
  const normalizedZoom = normalizeSettingsNumber(zoomLevel, 100, 50, 150);
  setHomeRuntimeCss('app-zoom', `body { zoom: ${normalizedZoom}%; }`);
}

function applySaturationLevel(saturation) {
  const normalizedSaturation = normalizeSettingsNumber(saturation, 100, 0, 100);
  setHomeRuntimeCss(
    'app-saturation',
    normalizedSaturation === 100 ? '' : `body { filter: saturate(${normalizedSaturation}%); }`
  );
}

function applyOutputVolume(volume) {
  const normalizedVolume = normalizeSettingsNumber(volume, 100, 0, 100) / 100;
  document.querySelectorAll('audio, video').forEach((mediaElement) => {
    if (mediaElement.dataset.remoteMedia === 'true') {
      const peerName = mediaElement.dataset.peerName || mediaElement.dataset.peerVolumeId;
      mediaElement.volume = Math.max(0, Math.min(1, normalizedVolume * (getPeerVolume(peerName) / 100)));
    } else if (!mediaElement.muted) {
      mediaElement.volume = normalizedVolume;
    }
  });
}

function applyOutputDevice(deviceId) {
  if (!deviceId || deviceId === 'default') return;
  document.querySelectorAll('audio, video').forEach((mediaElement) => {
    if (typeof mediaElement.setSinkId === 'function') {
      mediaElement.setSinkId(deviceId).catch((error) => {
        console.warn('Could not apply output device:', error);
      });
    }
  });
}

function applySliderValue(slider, value, index = 0) {
  if (!slider) {
    return;
  }

  const min = Number(slider.min || 0);
  const max = Number(slider.max || 100);
  const fallback = Number(slider.value || min);
  const nextValue = normalizeSettingsNumber(value, fallback, min, max);
  const settingKey = getSliderSettingKey(slider, index);

  slider.value = String(nextValue);

  if (slider.id === 'fontScalingSlider') {
    applyMessageFontSize(nextValue);
  } else if (slider.id === 'zoomLevelSlider') {
    applyZoomLevel(nextValue);
  } else if (slider.id === 'saturationSlider') {
    applySaturationLevel(nextValue);
  } else if (settingKey === 'outputVolume' || slider.id === 'outputVolumeSlider') {
    applyOutputVolume(nextValue);
  }
}

function applyProfileBannerColor(color) {
  const nextColor = normalizeHexColor(color, '#0c0c0c');
  const bannerUrl = readSettingsState().profileBannerUrl || '';
  applyDynamicProfileBanner(nextColor, bannerUrl);
}

function applyReducedMotion(isEnabled) {
  document.body?.classList.toggle('app-reduced-motion', Boolean(isEnabled));
}

function getSystemThemeColors() {
  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? DEFAULT_THEME : LIGHT_THEME;
}

function syncThemeInputs(backgroundColor, textColor) {
  const bgInput = document.getElementById('customBgColor');
  const textInput = document.getElementById('customTextColor');

  if (bgInput) bgInput.value = backgroundColor;
  if (textInput) textInput.value = textColor;
}

function applyThemeMode(themeMode, options = {}) {
  const { syncInputs = true } = options;
  const presetTheme =
    themeMode === 'light'
      ? LIGHT_THEME
      : themeMode === 'sync-with-computer'
        ? getSystemThemeColors()
        : DEFAULT_THEME;

  if (syncInputs) {
    syncThemeInputs(presetTheme.background, presetTheme.text);
  }

  applyTheme(presetTheme.background, presetTheme.text);
}

function syncThemeModeSelectionFromTheme(backgroundColor, textColor) {
  const themeGroup = document.querySelector('[data-settings-radio="themeMode"]');
  if (!themeGroup) {
    return;
  }

  const normalizedBackground = normalizeHexColor(
    backgroundColor,
    DEFAULT_THEME.background
  );
  const normalizedText = normalizeHexColor(textColor, DEFAULT_THEME.text);
  let nextThemeMode = readSettingsState().themeMode || 'dark';

  if (
    normalizedBackground === normalizeHexColor(DEFAULT_THEME.background) &&
    normalizedText === normalizeHexColor(DEFAULT_THEME.text)
  ) {
    nextThemeMode = 'dark';
  } else if (
    normalizedBackground === normalizeHexColor(LIGHT_THEME.background) &&
    normalizedText === normalizeHexColor(LIGHT_THEME.text)
  ) {
    nextThemeMode = 'light';
  }

  setRadioGroupSelection(themeGroup, nextThemeMode);
}

function handleToggleStateChange(settingKey, isActive) {
  writeSettingsState((state) => ({
    ...state,
    toggles: {
      ...state.toggles,
      [settingKey]: isActive,
    },
  }));

  if (settingKey.endsWith('-reduced-motion')) {
    applyReducedMotion(isActive);
  }

  if (settingKey === 'privacyShowActivity') {
    writeSettingsState((state) => ({
      ...state,
      privacy: {
        ...state.privacy,
        showActivity: isActive,
      },
    }));
    syncPrivacySettingsFromState();
  }

  if (settingKey === 'voiceChangerEnabled' || settingKey === 'voiceChangerPerCallEnabled') {
    updateVoiceChangerStateFromControls();
  }

  if (settingKey === 'desktopNotifications' && !isActive) {
    stopDesktopAttentionState();
  }

  if (settingKey === 'unreadBadge' && !isActive) {
    desktopUnreadCount = 0;
    updateDesktopUnreadBadge(0);
  }

  if (settingKey === 'unreadBadge' && isActive) {
    refreshAllUnreadBadges();
  }

  if (settingKey === 'taskbarFlash' && !isActive) {
    getDesktopNotificationBridge()?.stopFlashing?.()?.catch?.((error) => {
      console.warn('Could not stop taskbar flashing:', error);
    });
  }
}

function handleCheckboxStateChange(settingKey, isChecked) {
  writeSettingsState((state) => ({
    ...state,
    checkboxes: {
      ...state.checkboxes,
      [settingKey]: isChecked,
    },
  }));

  if (settingKey.startsWith('privacyFriendRequests')) {
    writeSettingsState((state) => ({
      ...state,
      privacy: {
        ...state.privacy,
        allowFriendRequestsEveryone:
          settingKey === 'privacyFriendRequestsEveryone'
            ? isChecked
            : state.privacy.allowFriendRequestsEveryone,
        allowFriendRequestsFriendsOfFriends:
          settingKey === 'privacyFriendRequestsFriendsOfFriends'
            ? isChecked
            : state.privacy.allowFriendRequestsFriendsOfFriends,
        allowFriendRequestsServerMembers:
          settingKey === 'privacyFriendRequestsServerMembers'
            ? isChecked
            : state.privacy.allowFriendRequestsServerMembers,
      },
    }));
    syncPrivacySettingsFromState();
  }
}

function handleSliderStateChange(slider, index) {
  const settingKey = getSliderSettingKey(slider, index);
  const value = Number(slider.value);

  applySliderValue(slider, value, index);

  writeSettingsState((state) => {
    const nextState = {
      ...state,
      sliders: {
        ...state.sliders,
        [settingKey]: value,
      },
    };

    if (slider.id === 'fontScalingSlider') {
      nextState.fontSize = value;
    } else if (slider.id === 'zoomLevelSlider') {
      nextState.zoomLevel = value;
    } else if (slider.id === 'saturationSlider') {
      nextState.saturation = value;
    }

    return nextState;
  });

  if (settingKey.startsWith('voice') || settingKey === 'inputVolume') {
    updateVoiceChangerStateFromControls();
  }
}

function handleSelectStateChange(select, index) {
  const settingKey = getSelectSettingKey(select, index);
  writeSettingsState((state) => ({
    ...state,
    selects: {
      ...state.selects,
      [settingKey]: select.value,
    },
  }));

  if (settingKey === 'presenceStatus') {
    writeSettingsState((state) => ({
      ...state,
      presenceStatus: select.value,
    }));
    syncPresenceStatus(select.value);
  }

  if (settingKey === 'voiceChangerPreset') {
    applyVoiceChangerPreset(select.value);
    updateVoiceChangerStateFromControls();
  }

  if (settingKey === 'inputDevice' && localStream) {
    cleanupVoiceProcessing({ restoreRaw: false });
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
    stopVoiceActivityMonitor('local', 'local');
    ensureLocalStream(true, Boolean(getLocalPreviewVideo()?.srcObject?.getVideoTracks?.().length))
      .catch((error) => showAppMessage(getApiErrorMessage(error, 'Could not switch input device.'), 'error'));
  }

  if (settingKey === 'outputDevice') {
    applyOutputDevice(select.value);
  }
}

function handleRadioStateChange(settingKey, value) {
  writeSettingsState((state) => {
    const nextState = {
      ...state,
      radios: {
        ...state.radios,
        [settingKey]: value,
      },
    };

    if (settingKey === 'themeMode') {
      nextState.themeMode = value;
      nextState.customTheme = null;
    }

    if (settingKey === 'messageDisplay') {
      nextState.messageDisplay = value;
    }

    if (settingKey === 'inputMode') {
      nextState.inputMode = value;
    }

    if (settingKey === 'privacyDmPolicy') {
      nextState.privacy = {
        ...nextState.privacy,
        dmPolicy: value,
      };
    }

    return nextState;
  });

  if (settingKey === 'themeMode') {
    applyThemeMode(value);
  }

  if (settingKey === 'messageDisplay') {
    applyMessageDisplay(value);
  }

  if (settingKey === 'inputMode') {
    applyMicrophoneGate();
  }

  if (settingKey === 'privacyDmPolicy') {
    syncPrivacySettingsFromState();
  }
}

function syncPresenceStatus(presenceStatus) {
  axios
    .post(`${homeApiBase}/api/Account/UpdatePresence`, { presenceStatus })
    .catch((error) => {
      showAppMessage(getApiErrorMessage(error, 'Could not update status.'), 'error');
    });
}

function buildPrivacyPayload(state = readSettingsState()) {
  const privacy = state.privacy || createDefaultSettingsState().privacy;
  return {
    dmPolicy: privacy.dmPolicy || 'friends',
    allowFriendRequestsEveryone: Boolean(privacy.allowFriendRequestsEveryone),
    allowFriendRequestsFriendsOfFriends: Boolean(privacy.allowFriendRequestsFriendsOfFriends),
    allowFriendRequestsServerMembers: Boolean(privacy.allowFriendRequestsServerMembers),
    showActivity: Boolean(privacy.showActivity),
  };
}

function syncPrivacySettingsFromState() {
  axios
    .post(`${homeApiBase}/api/Account/UpdatePrivacySettings`, buildPrivacyPayload())
    .catch((error) => {
      showAppMessage(getApiErrorMessage(error, 'Could not update privacy settings.'), 'error');
    });
}

function getVoiceChangerControlsState() {
  return {
    enabled: document.querySelector('[data-setting-key="voiceChangerEnabled"] .toggle-switch')?.classList.contains('active') || false,
    preset: document.getElementById('voiceChangerPresetSelect')?.value || 'normal',
    pitch: Number(document.getElementById('voicePitchSlider')?.value || 0),
    formant: Number(document.getElementById('voiceFormantSlider')?.value || 0),
    distortion: Number(document.getElementById('voiceDistortionSlider')?.value || 0),
    echo: Number(document.getElementById('voiceEchoSlider')?.value || 0),
    perCallEnabled:
      document.querySelector('[data-setting-key="voiceChangerPerCallEnabled"] .toggle-switch')?.classList.contains('active') !== false,
  };
}

function updateVoiceChangerStateFromControls() {
  const voiceChanger = getVoiceChangerControlsState();
  writeSettingsState((state) => ({
    ...state,
    voiceChanger,
  }));
  refreshLocalAudioProcessing().catch((error) => {
    console.warn('Could not refresh voice changer processing:', error);
  });
}

function applyVoiceChangerPreset(preset) {
  const presets = {
    normal: { pitch: 0, formant: 0, distortion: 0, echo: 0 },
    deep: { pitch: -7, formant: -5, distortion: 8, echo: 0 },
    'higher-pitch': { pitch: 7, formant: 4, distortion: 0, echo: 0 },
    robot: { pitch: 0, formant: 0, distortion: 65, echo: 8 },
    radio: { pitch: 0, formant: 6, distortion: 28, echo: 0 },
    echo: { pitch: 0, formant: 0, distortion: 0, echo: 65 },
    whisper: { pitch: 4, formant: 10, distortion: 12, echo: 12 },
  };

  const values = presets[preset] || presets.normal;
  const controlMap = {
    voicePitchSlider: values.pitch,
    voiceFormantSlider: values.formant,
    voiceDistortionSlider: values.distortion,
    voiceEchoSlider: values.echo,
  };

  Object.entries(controlMap).forEach(([id, value]) => {
    const slider = document.getElementById(id);
    if (slider) {
      slider.value = value;
      applySliderValue(slider, value, 0);
    }
  });
}


function applyPersistedSettingsState() {
  const state = readSettingsState();
  const themeMode = state.themeMode || 'dark';
  const messageDisplay = state.messageDisplay || 'cozy';
  const fontSize = normalizeSettingsNumber(state.fontSize, 16, 12, 24);
  const zoomLevel = normalizeSettingsNumber(state.zoomLevel, 100, 50, 150);
  const saturation = normalizeSettingsNumber(state.saturation, 100, 0, 100);

  applyThemeMode(themeMode);
  applyMessageDisplay(messageDisplay);
  applyMessageFontSize(fontSize);
  applyZoomLevel(zoomLevel);
  applySaturationLevel(saturation);
  applyProfileBannerColor(state.profileBannerColor || '#0c0c0c');

  document.querySelectorAll('.settings-slider').forEach((slider, index) => {
    const settingKey = getSliderSettingKey(slider, index);
    const storedValue =
      slider.id === 'fontScalingSlider'
        ? fontSize
        : slider.id === 'zoomLevelSlider'
          ? zoomLevel
          : slider.id === 'saturationSlider'
            ? saturation
            : settingKey === 'voicePitch'
              ? state.voiceChanger.pitch
              : settingKey === 'voiceFormant'
                ? state.voiceChanger.formant
                : settingKey === 'voiceDistortion'
                  ? state.voiceChanger.distortion
                  : settingKey === 'voiceEcho'
                    ? state.voiceChanger.echo
                    : state.sliders[settingKey] ?? slider.value;

    applySliderValue(slider, storedValue, index);
  });

  document.querySelectorAll('.settings-select').forEach((select, index) => {
    const settingKey = getSelectSettingKey(select, index);
    const storedValue =
      settingKey === 'presenceStatus'
        ? state.presenceStatus
        : settingKey === 'voiceChangerPreset'
          ? state.voiceChanger.preset
          : state.selects[settingKey];
    if (typeof storedValue === 'string') {
      const hasOption = Array.from(select.options).some((option) => option.value === storedValue);
      if (hasOption) {
        select.value = storedValue;
        if (settingKey === 'outputDevice') {
          applyOutputDevice(storedValue);
        }
      }
    }
  });

  document.querySelectorAll('.toggle-item').forEach((item, index) => {
    const toggle = item.querySelector('.toggle-switch');
    if (!toggle) {
      return;
    }

    const settingKey = getToggleSettingKey(item, index);
    const forcedToggleValue =
      settingKey === 'privacyShowActivity'
        ? state.privacy.showActivity
        : settingKey === 'voiceChangerEnabled'
          ? state.voiceChanger.enabled
          : settingKey === 'voiceChangerPerCallEnabled'
            ? state.voiceChanger.perCallEnabled
            : undefined;
    const isActive =
      typeof forcedToggleValue === 'boolean'
        ? forcedToggleValue
        : hasStoredSettingValue(state.toggles, settingKey)
          ? Boolean(state.toggles[settingKey])
          : toggle.classList.contains('active');

    toggle.classList.toggle('active', isActive);

    if (settingKey.endsWith('-reduced-motion')) {
      applyReducedMotion(isActive);
    }
  });

  document.querySelectorAll('.checkbox-item').forEach((item, index) => {
    const checkbox = item.querySelector('.checkbox-box');
    if (!checkbox) {
      return;
    }

    const settingKey = getCheckboxSettingKey(item, index);
    const forcedCheckboxValue =
      settingKey === 'privacyFriendRequestsEveryone'
        ? state.privacy.allowFriendRequestsEveryone
        : settingKey === 'privacyFriendRequestsFriendsOfFriends'
          ? state.privacy.allowFriendRequestsFriendsOfFriends
          : settingKey === 'privacyFriendRequestsServerMembers'
            ? state.privacy.allowFriendRequestsServerMembers
            : undefined;
    const isChecked =
      typeof forcedCheckboxValue === 'boolean'
        ? forcedCheckboxValue
        : hasStoredSettingValue(state.checkboxes, settingKey)
          ? Boolean(state.checkboxes[settingKey])
          : checkbox.classList.contains('checked');

    checkbox.classList.toggle('checked', isChecked);
  });

  document.querySelectorAll('.radio-group').forEach((group, index) => {
    const settingKey = getRadioGroupKey(group, index);
    const defaultValue = getRadioItemValue(
      group.querySelector('.radio-item.active') || group.querySelector('.radio-item'),
      0
    );
    const storedValue =
      settingKey === 'themeMode'
        ? themeMode
        : settingKey === 'messageDisplay'
          ? messageDisplay
          : settingKey === 'inputMode'
            ? state.inputMode
          : settingKey === 'privacyDmPolicy'
            ? state.privacy.dmPolicy
            : state.radios[settingKey] || defaultValue;
    const selection = setRadioGroupSelection(group, storedValue);

    if (settingKey === 'themeMode') {
      applyThemeMode(selection.value);
    }

    if (settingKey === 'messageDisplay') {
      applyMessageDisplay(selection.value);
    }

    if (settingKey === 'inputMode') {
      applyMicrophoneGate();
    }
  });

  applyProfileTab(state.profileView || 'user-profile');
}

function getDefaultSettingsKeybinds() {
  return [
    { action: 'Push to Talk (Normal)', keys: ['CTRL', 'V'] },
    { action: 'Toggle Mute', keys: ['CTRL', 'SHIFT', 'M'] },
  ];
}

function saveSettingsKeybinds(keybinds) {
  writeSettingsState((state) => ({
    ...state,
    keybinds,
  }));
}

function createKeybindRow(keybind, keybinds) {
  const row = document.createElement('div');
  row.className = 'keybind-row';

  const action = document.createElement('div');
  action.className = 'keybind-action';
  action.textContent = keybind.action;

  const keys = document.createElement('div');
  keys.className = 'keybind-keys';
  keybind.keys.forEach((key, index) => {
    if (index > 0) {
      keys.appendChild(document.createTextNode(' + '));
    }

    const keyBox = document.createElement('span');
    keyBox.className = 'key-box';
    keyBox.textContent = key;
    keys.appendChild(keyBox);
  });

  const removeButton = document.createElement('button');
  removeButton.className = 'settings-btn-danger settings-btn-compact';
  removeButton.textContent = 'Remove';
  removeButton.addEventListener('click', () => {
    const nextKeybinds = keybinds.filter((item) => item !== keybind);
    saveSettingsKeybinds(nextKeybinds);
    renderSettingsKeybinds(nextKeybinds);
  });

  row.appendChild(action);
  row.appendChild(keys);
  row.appendChild(removeButton);
  return row;
}

function renderSettingsKeybinds(keybinds = null) {
  const list = document.querySelector('.keybind-list');
  if (!list) {
    return;
  }

  const activeKeybinds = Array.isArray(keybinds)
    ? keybinds
    : readSettingsState().keybinds || getDefaultSettingsKeybinds();

  list.innerHTML = '';
  activeKeybinds.forEach((keybind) => {
    list.appendChild(createKeybindRow(keybind, activeKeybinds));
  });

  if (!activeKeybinds.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state-card padded';
    empty.textContent = 'No keybinds added.';
    list.appendChild(empty);
  }
}

async function addSettingsKeybind() {
  const values = await openSimpleFormDialog({
    title: 'Add Keybind',
    fields: [
      { name: 'action', label: 'Action name', value: 'Custom Action' },
      { name: 'keys', label: 'Keys, separated by +', value: 'CTRL + SHIFT + K' },
    ],
    confirmText: 'Add Keybind',
  });
  const action = values?.action?.trim();
  if (!action) {
    return;
  }

  const keyText = values?.keys?.trim();
  if (!keyText) {
    return;
  }

  const keys = keyText
    .split('+')
    .map((key) => key.trim().toUpperCase())
    .filter(Boolean);

  if (!keys.length) {
    return;
  }

  const keybinds = readSettingsState().keybinds || getDefaultSettingsKeybinds();
  const nextKeybinds = [...keybinds, { action, keys }];
  saveSettingsKeybinds(nextKeybinds);
  renderSettingsKeybinds(nextKeybinds);
}

function rememberRemovedSettingsItem(kind, label) {
  if (!kind || !label) {
    return;
  }

  writeSettingsState((state) => {
    const existingItems = Array.isArray(state.removedItems[kind])
      ? state.removedItems[kind]
      : [];

    return {
      ...state,
      removedItems: {
        ...state.removedItems,
        [kind]: Array.from(new Set([...existingItems, label])),
      },
    };
  });
}

function applyRemovedSettingsItems() {
  const removedItems = readSettingsState().removedItems || {};
  const selectors = [
    { kind: 'apps', row: '.app-item', label: '.app-name' },
    { kind: 'devices', row: '.device-card:not(.current)', label: '.device-name' },
    { kind: 'games', row: '.added-game-row', label: '.game-name' },
  ];

  selectors.forEach(({ kind, row, label }) => {
    const removedLabels = Array.isArray(removedItems[kind]) ? removedItems[kind] : [];
    document.querySelectorAll(row).forEach((item) => {
      const itemLabel = item.querySelector(label)?.textContent?.trim();
      if (itemLabel && removedLabels.includes(itemLabel)) {
        item.remove();
      }
    });
  });
}

function openSimpleFormDialog({
  title,
  description = '',
  fields = [],
  confirmText = 'Save',
  danger = false,
  preserveExisting = false,
}) {
  return new Promise((resolve) => {
    if (!preserveExisting) {
      closeAccountActionDialog();
    }

    const overlay = document.createElement('div');
    overlay.className = 'account-action-overlay';
    const dialog = document.createElement('div');
    dialog.className = 'account-action-dialog';

    const heading = document.createElement('h3');
    heading.textContent = title;
    dialog.appendChild(heading);

    if (description) {
      const copy = document.createElement('p');
      copy.className = 'account-action-copy';
      copy.textContent = description;
      dialog.appendChild(copy);
    }

    const form = document.createElement('form');
    form.className = 'account-action-form';
    const fieldMap = {};

    fields.forEach((field) => {
      const label = document.createElement('label');
      label.textContent = field.label;

      const input = field.options
        ? document.createElement('select')
        : field.type === 'textarea'
          ? document.createElement('textarea')
          : document.createElement('input');
      input.name = field.name;
      input.className = field.options ? 'account-action-select' : '';
      if (!field.options && field.type !== 'textarea') {
        input.type = field.type || 'text';
      }
      input.autocomplete = field.autocomplete || 'off';
      if (field.min !== undefined) input.min = field.min;
      if (field.max !== undefined) input.max = field.max;
      if (field.step !== undefined) input.step = field.step;
      if (field.maxLength !== undefined) input.maxLength = field.maxLength;
      if (field.rows !== undefined && input.tagName === 'TEXTAREA') input.rows = field.rows;
      if (field.inputMode) input.inputMode = field.inputMode;
      if (field.autocapitalize) input.autocapitalize = field.autocapitalize;
      if (field.spellcheck !== undefined) input.spellcheck = field.spellcheck;
      input.required = field.required !== false;

      (field.options || []).forEach((option) => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.label;
        optionEl.disabled = Boolean(option.disabled);
        input.appendChild(optionEl);
      });
      input.value = field.value || '';

      fieldMap[field.name] = input;
      label.appendChild(input);
      form.appendChild(label);
    });

    const actions = document.createElement('div');
    actions.className = 'account-action-buttons';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'account-action-cancel';
    cancelButton.textContent = 'Cancel';
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = danger ? 'account-action-submit danger' : 'account-action-submit';
    submitButton.textContent = confirmText;
    actions.appendChild(cancelButton);
    actions.appendChild(submitButton);
    form.appendChild(actions);

    const close = (value) => {
      overlay.remove();
      resolve(value);
    };

    cancelButton.addEventListener('click', () => close(null));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(null);
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      close(Object.fromEntries(Object.entries(fieldMap).map(([key, input]) => [key, input.value.trim()])));
    });

    dialog.appendChild(form);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    form.querySelector('input, select, textarea')?.focus();
  });
}

async function askText(title, label, value = '') {
  const result = await openSimpleFormDialog({
    title,
    fields: [{ name: 'value', label, value }],
  });
  return result?.value?.trim() || '';
}

async function askConfirm(title, description, { danger = false, confirmText = 'Confirm' } = {}) {
  const result = await openSimpleFormDialog({
    title,
    description,
    fields: [],
    danger,
    confirmText,
  });
  return result !== null;
}

function closeAccountActionDialog() {
  document.querySelectorAll('.account-action-overlay').forEach((overlay) => overlay.remove());
}

function openAccountActionDialog({ title, description, fields, confirmText, danger = false, onSubmit }) {
  closeAccountActionDialog();

  const overlay = document.createElement('div');
  overlay.className = 'account-action-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'account-action-dialog';

  const heading = document.createElement('h3');
  heading.textContent = title;

  const copy = document.createElement('p');
  copy.className = 'account-action-copy';
  copy.textContent = description;

  const form = document.createElement('form');
  form.className = 'account-action-form';

  const fieldMap = {};
  fields.forEach((field) => {
    const label = document.createElement('label');
    label.textContent = field.label;

    const input = document.createElement('input');
    input.type = field.type || 'text';
    input.name = field.name;
    input.autocomplete = field.autocomplete || 'off';
    input.placeholder = field.placeholder || '';
    input.value = field.value || '';
    input.required = field.required !== false;
    input.minLength = field.minLength || 0;
    if (field.inputMode) input.inputMode = field.inputMode;
    if (field.autocapitalize) input.autocapitalize = field.autocapitalize;
    if (field.spellcheck !== undefined) input.spellcheck = field.spellcheck;

    fieldMap[field.name] = input;
    label.appendChild(input);
    form.appendChild(label);
  });

  const error = document.createElement('p');
  error.className = 'account-action-error';
  error.setAttribute('role', 'alert');
  form.appendChild(error);

  const actions = document.createElement('div');
  actions.className = 'account-action-buttons';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'account-action-cancel';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', closeAccountActionDialog);

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = danger ? 'account-action-submit danger' : 'account-action-submit';
  submitButton.textContent = confirmText;

  actions.appendChild(cancelButton);
  actions.appendChild(submitButton);
  form.appendChild(actions);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';

    const values = Object.fromEntries(
      Object.entries(fieldMap).map(([key, input]) => [key, input.value.trim()])
    );

    try {
      setBusyState(submitButton, true, 'Saving...');
      await onSubmit(values);
      closeAccountActionDialog();
    } catch (err) {
      console.error(`${title} failed:`, err);
      error.textContent = getApiErrorMessage(err, 'This account action failed.');
    } finally {
      setBusyState(submitButton, false);
    }
  });

  dialog.appendChild(heading);
  dialog.appendChild(copy);
  dialog.appendChild(form);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeAccountActionDialog();
    }
  });

  const firstInput = form.querySelector('input');
  if (firstInput) firstInput.focus();
}

function openChangePasswordDialog() {
  openAccountActionDialog({
    title: 'Change Password',
    description: 'Update your password. You will keep your current session after the change.',
    confirmText: 'Change Password',
    fields: [
      {
        name: 'currentPassword',
        label: 'Current Password',
        type: 'password',
        autocomplete: 'current-password',
        minLength: 6,
      },
      {
        name: 'newPassword',
        label: 'New Password',
        type: 'password',
        autocomplete: 'new-password',
        minLength: 6,
      },
      {
        name: 'confirmPassword',
        label: 'Confirm New Password',
        type: 'password',
        autocomplete: 'new-password',
        minLength: 6,
      },
    ],
    onSubmit: async ({ currentPassword, newPassword, confirmPassword }) => {
      if (newPassword !== confirmPassword) {
        throw new Error('New passwords do not match.');
      }

      const res = await axios.post(`${homeApiBase}/api/Account/ChangePassword`, {
        username: JWTusername,
        currentPassword,
        newPassword,
      });
      showAppMessage(res.data?.message || 'Password changed.', 'success');
    },
  });
}

function openDisableAccountDialog() {
  openAccountActionDialog({
    title: 'Disable Account',
    description: 'Your account will be disabled and you will be signed out. Logging in again with the same password recovers it.',
    confirmText: 'Disable Account',
    danger: true,
    fields: [
      {
        name: 'password',
        label: 'Password',
        type: 'password',
        autocomplete: 'current-password',
        minLength: 6,
      },
    ],
    onSubmit: async ({ password }) => {
      const res = await axios.post(`${homeApiBase}/api/Account/DisableAccount`, {
        username: JWTusername,
        password,
      });
      showAppMessage(res.data?.message || 'Account disabled.', 'success');
      window.setTimeout(LogOut, 900);
    },
  });
}

function openDeleteAccountDialog() {
  openAccountActionDialog({
    title: 'Delete Account',
    description: 'This removes your account and friend relationships. Messages already sent are kept for conversation history.',
    confirmText: 'Delete Account',
    danger: true,
    fields: [
      {
        name: 'username',
        label: `Type ${JWTusername} to confirm`,
        type: 'text',
        autocomplete: 'username',
      },
      {
        name: 'password',
        label: 'Password',
        type: 'password',
        autocomplete: 'current-password',
        minLength: 6,
      },
    ],
    onSubmit: async ({ username, password }) => {
      if (username !== JWTusername) {
        throw new Error('The confirmation username does not match.');
      }

      const res = await axios.post(`${homeApiBase}/api/Account/DeleteAccount`, {
        username: JWTusername,
        password,
      });
      showAppMessage(res.data?.message || 'Account deleted.', 'success');
      window.setTimeout(LogOut, 900);
    },
  });
}

function openContactInfoDialog() {
  const state = readSettingsState();
  const fields = [
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      autocomplete: 'email',
      required: false,
      value: state.contact.email || '',
      placeholder: state.contact.email || 'name@example.com',
    },
  ];

  if (state.verification.phoneVerificationAvailable) {
    fields.push({
      name: 'phoneNumber',
      label: 'Phone Number',
      type: 'tel',
      autocomplete: 'tel',
      required: false,
      value: state.contact.phoneNumber || '',
      placeholder: state.contact.phoneNumber || '+1 555 0100',
    });
  }

  openAccountActionDialog({
    title: 'Contact Info',
    description: state.verification.phoneVerificationAvailable
      ? 'Add or update the email and phone number shown on your account page.'
      : 'Add or update the email used for free verification.',
    confirmText: 'Save Contact Info',
    fields,
    onSubmit: async ({ email, phoneNumber }) => {
      const res = await axios.post(`${homeApiBase}/api/Account/UpdateContactInfo`, {
        email,
        phoneNumber: state.verification.phoneVerificationAvailable
          ? phoneNumber
          : state.contact.phoneNumber || '',
      });
      applyAccountSettingsResponse(res.data || {});
      showAppMessage('Contact info saved.', 'success');
    },
  });
}

async function requestContactVerification(kind) {
  const state = readSettingsState();
  const isEmail = kind === 'email';
  if (!isEmail && !state.verification.phoneVerificationAvailable) {
    showAppMessage('Phone verification is not available yet.', 'error');
    return;
  }

  const target = isEmail ? state.contact.email : state.contact.phoneNumber;
  if (!target) {
    openContactInfoDialog();
    return;
  }

  try {
    const endpoint = isEmail ? 'RequestEmailVerification' : 'RequestPhoneVerification';
    const res = await apiClient.post(`${homeApiBase}/api/Account/${endpoint}`, { target });
    showAppMessage(
      res.data?.deliveryConfigured === false
        ? 'Verification code generated. Configure a provider webhook for production delivery.'
        : 'Verification code sent.',
      res.data?.deliveryConfigured === false ? 'info' : 'success',
      4200
    );
    openVerificationCodeDialog(kind, target);
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not request verification.'), 'error');
  }
}

function openVerificationCodeDialog(kind, target) {
  const isEmail = kind === 'email';
  openAccountActionDialog({
    title: isEmail ? 'Verify Email' : 'Verify Phone',
    description: `Enter the 6-digit code sent to ${target}.`,
    confirmText: 'Verify',
    fields: [
      {
        name: 'code',
        label: 'Verification Code',
        type: 'text',
        autocomplete: 'one-time-code',
        inputMode: 'numeric',
        minLength: 6,
      },
    ],
    onSubmit: async ({ code }) => {
      const endpoint = isEmail ? 'ConfirmEmailVerification' : 'ConfirmPhoneVerification';
      const res = await apiClient.post(`${homeApiBase}/api/Account/${endpoint}`, { code });
      applyAccountSettingsResponse(res.data || {});
      updateSettingsIdentityFields();
      showAppMessage(isEmail ? 'Email verified.' : 'Phone verified.', 'success');
    },
  });
}

function applyTwoFactorStatus(twoFactor) {
  if (!twoFactor) {
    return;
  }

  writeSettingsState((state) => ({
    ...state,
    twoFactor: {
      ...state.twoFactor,
      ...twoFactor,
    },
  }));
  updateSettingsIdentityFields();
}

function showBackupCodesDialog(codes = []) {
  if (!Array.isArray(codes) || !codes.length) {
    return;
  }

  closeAccountActionDialog();

  const overlay = document.createElement('div');
  overlay.className = 'account-action-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'account-action-dialog';

  const heading = document.createElement('h3');
  heading.textContent = 'Backup Codes';
  const copy = document.createElement('p');
  copy.className = 'account-action-copy';
  copy.textContent = 'Each code works once if you lose access to your authenticator app.';

  const grid = document.createElement('div');
  grid.className = 'backup-code-grid';
  codes.forEach((code) => {
    const pill = document.createElement('div');
    pill.className = 'backup-code-pill';
    pill.textContent = code;
    grid.appendChild(pill);
  });

  const actions = document.createElement('div');
  actions.className = 'account-action-buttons';
  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'account-action-submit';
  copyButton.textContent = 'Copy Codes';
  copyButton.addEventListener('click', async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(codes.join('\n'));
      showAppMessage('Backup codes copied.', 'success');
    }
  });

  const doneButton = document.createElement('button');
  doneButton.type = 'button';
  doneButton.className = 'account-action-cancel';
  doneButton.textContent = 'Done';
  doneButton.addEventListener('click', closeAccountActionDialog);

  actions.appendChild(doneButton);
  actions.appendChild(copyButton);
  dialog.appendChild(heading);
  dialog.appendChild(copy);
  dialog.appendChild(grid);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

async function enableAuthenticatorApp() {
  try {
    const setup = await axios.post(`${homeApiBase}/api/Account/BeginAuthenticatorSetup`, {
      label: JWTusername,
    });
    const secret = setup.data?.manualEntryKey || setup.data?.secret;
    const values = await openSimpleFormDialog({
      title: 'Set Up Authenticator',
      description: `Add this manual key to your authenticator app: ${secret}`,
      fields: [
        {
          name: 'code',
          label: '6-digit code',
          type: 'text',
          autocomplete: 'one-time-code',
          inputMode: 'numeric',
        },
      ],
      confirmText: 'Enable',
    });

    if (!values?.code) {
      return;
    }

    const res = await axios.post(`${homeApiBase}/api/Account/EnableAuthenticator`, {
      code: values.code,
    });
    applyTwoFactorStatus(res.data?.twoFactor);
    showAppMessage(res.data?.message || 'Authenticator-app 2FA enabled.', 'success');
    showBackupCodesDialog(res.data?.backupCodes || []);
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not enable authenticator-app 2FA.'), 'error');
  }
}

function disableAuthenticatorApp() {
  openAccountActionDialog({
    title: 'Disable Two-Factor',
    description: 'Confirm with your password and an authenticator or backup code.',
    confirmText: 'Disable',
    danger: true,
    fields: [
      {
        name: 'password',
        label: 'Password',
        type: 'password',
        autocomplete: 'current-password',
      },
      {
        name: 'code',
        label: 'Authenticator or Backup Code',
        type: 'text',
        autocomplete: 'one-time-code',
        inputMode: 'text',
        autocapitalize: 'characters',
        spellcheck: false,
      },
    ],
    onSubmit: async ({ password, code }) => {
      const res = await axios.post(`${homeApiBase}/api/Account/DisableTwoFactor`, {
        password,
        code,
      });
      applyTwoFactorStatus(res.data?.twoFactor);
      showAppMessage(res.data?.message || 'Two-factor authentication disabled.', 'success');
    },
  });
}

function regenerateBackupCodes() {
  openAccountActionDialog({
    title: 'Regenerate Backup Codes',
    description: 'Old backup codes stop working after new ones are created.',
    confirmText: 'Regenerate',
    fields: [
      {
        name: 'password',
        label: 'Password',
        type: 'password',
        autocomplete: 'current-password',
      },
      {
        name: 'code',
        label: 'Authenticator or Backup Code',
        type: 'text',
        autocomplete: 'one-time-code',
        inputMode: 'text',
        autocapitalize: 'characters',
        spellcheck: false,
      },
    ],
    onSubmit: async ({ password, code }) => {
      const res = await axios.post(`${homeApiBase}/api/Account/RegenerateBackupCodes`, {
        password,
        code,
      });
      applyTwoFactorStatus(res.data?.twoFactor);
      showBackupCodesDialog(res.data?.backupCodes || []);
    },
  });
}

async function clearPhoneNumber() {
  const state = readSettingsState();
  try {
    const res = await axios.post(`${homeApiBase}/api/Account/UpdateContactInfo`, {
      email: state.contact.email || '',
      phoneNumber: '',
    });
    applyAccountSettingsResponse(res.data || {});
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not remove phone number.'), 'error');
  }
}

function setupSettingsActionButtons() {
  document.querySelectorAll('.account-detail-row .edit-detail-btn:not(#editContactInfoBtn):not(#editContactInfoBtnSecondary)').forEach((button) => {
    button.addEventListener('click', () => switchSettingsTab('profiles'));
  });

  document.getElementById('editContactInfoBtn')?.addEventListener('click', openContactInfoDialog);
  document.getElementById('editContactInfoBtnSecondary')?.addEventListener('click', openContactInfoDialog);
  document.getElementById('requestEmailVerificationBtn')?.addEventListener('click', () => requestContactVerification('email'));
  document.getElementById('primaryEmailVerificationBtn')?.addEventListener('click', () => requestContactVerification('email'));
  document.getElementById('requestPhoneVerificationBtn')?.addEventListener('click', () => requestContactVerification('phone'));
  document.getElementById('removePhoneNumberBtn')?.addEventListener('click', clearPhoneNumber);
  document.getElementById('enableTwoFactorBtn')?.addEventListener('click', enableAuthenticatorApp);
  document.getElementById('disableTwoFactorBtn')?.addEventListener('click', disableAuthenticatorApp);
  document.getElementById('regenerateBackupCodesBtn')?.addEventListener('click', regenerateBackupCodes);

  document.querySelectorAll('.reveal-link').forEach((link) => {
    link.addEventListener('click', () => {
      const value = link.closest('.detail-value');
      const label = link.closest('.account-detail-row')?.querySelector('label')?.textContent?.toLowerCase() || '';
      if (!value) {
        return;
      }

      value.textContent = label.includes('phone')
        ? 'No phone number connected'
        : 'No email connected';
    });
  });

  document.querySelectorAll('.remove-link:not(#removePhoneNumberBtn)').forEach((link) => {
    link.addEventListener('click', () => {
      const row = link.closest('.account-detail-row');
      const value = row?.querySelector('.detail-value');
      if (value) {
        value.textContent = 'No phone number connected';
      }
    });
  });

  document.querySelector('.change-password-btn')?.addEventListener('click', openChangePasswordDialog);

  document.querySelector('.disable-account-btn')?.addEventListener('click', openDisableAccountDialog);

  document.querySelector('.delete-account-btn')?.addEventListener('click', openDeleteAccountDialog);

  document.getElementById('profileBannerColorBtn')?.addEventListener('click', async () => {
    const currentColor = readSettingsState().profileBannerColor || '#0c0c0c';
    const nextColor = await askText('Banner Color', 'Banner color hex', currentColor);
    if (!nextColor) {
      return;
    }

    const normalizedColor = normalizeHexColor(nextColor, currentColor);
    applyProfileBannerColor(normalizedColor);
    writeSettingsState((state) => ({
      ...state,
      profileBannerColor: normalizedColor,
    }));
  });

  const avatarFileInput = document.getElementById('profileAvatarFileInput');
  const bannerFileInput = document.getElementById('profileBannerFileInput');
  document.getElementById('uploadProfileAvatarBtn')?.addEventListener('click', () => {
    avatarFileInput?.click();
  });
  document.getElementById('uploadProfileBannerBtn')?.addEventListener('click', () => {
    bannerFileInput?.click();
  });
  avatarFileInput?.addEventListener('change', async () => {
    if (!avatarFileInput.files?.[0]) return;
    try {
      const url = await uploadImageFile(avatarFileInput.files[0]);
      const input = document.getElementById('profilePictureUrlInput');
      if (input) input.value = url;
      updateProfileVisuals(url, document.getElementById('profileDescriptionInput')?.value || '');
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not upload avatar.'), 'error');
    } finally {
      avatarFileInput.value = '';
    }
  });
  bannerFileInput?.addEventListener('change', async () => {
    if (!bannerFileInput.files?.[0]) return;
    try {
      const url = await uploadImageFile(bannerFileInput.files[0]);
      const input = document.getElementById('profileBannerUrlInput');
      if (input) input.value = url;
      updateProfileVisuals(
        document.getElementById('profilePictureUrlInput')?.value || '',
        document.getElementById('profileDescriptionInput')?.value || '',
        url,
        readSettingsState().profileBannerColor
      );
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not upload banner.'), 'error');
    } finally {
      bannerFileInput.value = '';
    }
  });

  document.getElementById('addKeybindBtn')?.addEventListener('click', addSettingsKeybind);
  document.getElementById('runCallDiagnosticsBtn')?.addEventListener('click', startCallDiagnosticsAutoRefresh);

  document.querySelectorAll('.app-item .settings-btn-danger').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('.app-item');
      const label = row?.querySelector('.app-name')?.textContent?.trim();
      if (label) {
        rememberRemovedSettingsItem('apps', label);
      }
      row?.remove();
    });
  });

  document.querySelectorAll('.device-remove').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('.device-card');
      const label = row?.querySelector('.device-name')?.textContent?.trim();
      if (label) {
        rememberRemovedSettingsItem('devices', label);
      }
      row?.remove();
    });
  });

  document.querySelectorAll('.connection-icon').forEach((icon) => {
    const label = icon.textContent.trim();
    const isConnected = Boolean(readSettingsState().connectedAccounts[label]);
    icon.classList.toggle('connected', isConnected);
    icon.title = isConnected ? 'Connected' : 'Connect';
    icon.addEventListener('click', () => {
      const nextConnected = !icon.classList.contains('connected');
      icon.classList.toggle('connected', nextConnected);
      icon.title = nextConnected ? 'Connected' : 'Connect';
      writeSettingsState((state) => ({
        ...state,
        connectedAccounts: {
          ...state.connectedAccounts,
          [label]: nextConnected,
        },
      }));
    });
  });

  document.querySelectorAll('.game-overlay-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
    });
  });

  document.querySelectorAll('.remove-game-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('.added-game-row');
      const label = row?.querySelector('.game-name')?.textContent?.trim();
      if (label) {
        rememberRemovedSettingsItem('games', label);
      }
      row?.remove();
    });
  });
}

function formatSessionTime(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

function createSessionCard(session) {
  const card = document.createElement('div');
  card.className = session.isCurrent ? 'device-card current' : 'device-card';

  const icon = document.createElement('div');
  icon.className = 'device-icon';
  icon.textContent = 'PC';

  const info = document.createElement('div');
  info.className = 'device-info';

  const name = document.createElement('div');
  name.className = 'device-name';
  name.textContent = session.userAgent || 'Unknown device';

  const detail = document.createElement('div');
  detail.className = 'device-location';
  detail.textContent = `${session.ipAddress || 'Unknown IP'} - ${
    session.isActive ? 'Active' : 'Revoked'
  } - Seen ${formatSessionTime(session.lastSeenAt)}`;

  info.appendChild(name);
  info.appendChild(detail);
  card.appendChild(icon);
  card.appendChild(info);

  if (!session.isCurrent && session.isActive) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'device-remove';
    remove.textContent = 'x';
    remove.title = 'Log out this device';
    remove.addEventListener('click', async () => {
      try {
        await axios.post(`${homeApiBase}/api/Account/RevokeSession`, {
          sessionId: session.id,
        });
        await loadSessions();
      } catch (error) {
        showAppMessage(getApiErrorMessage(error, 'Could not revoke session.'), 'error');
      }
    });
    card.appendChild(remove);
  }

  return card;
}

async function loadSessions() {
  const currentList = document.getElementById('currentSessionsList');
  const otherList = document.getElementById('otherSessionsList');
  if (!currentList || !otherList) return;

  try {
    const res = await axios.get(`${homeApiBase}/api/Account/GetSessions`);
    const sessions = Array.isArray(res.data) ? res.data : [];
    const current = sessions.filter((session) => session.isCurrent);
    const others = sessions.filter((session) => !session.isCurrent && session.isActive);

    currentList.className = 'session-list';
    otherList.className = 'session-list';
    currentList.innerHTML = '';
    otherList.innerHTML = '';

    (current.length ? current : sessions.slice(0, 1)).forEach((session) => {
      currentList.appendChild(createSessionCard({ ...session, isCurrent: true }));
    });

    if (!others.length) {
      otherList.textContent = 'No other active sessions.';
      return;
    }

    others.forEach((session) => {
      otherList.appendChild(createSessionCard(session));
    });
  } catch (error) {
    currentList.textContent = 'Could not load sessions.';
    otherList.textContent = '';
  }
}

async function toggleVoicePreview() {
  const button = document.getElementById('voicePreviewBtn');
  const status = document.getElementById('voicePreviewStatus');

  if (voicePreviewStream) {
    voicePreviewContext?.close?.().catch?.(() => {});
    voicePreviewContext = null;
    voicePreviewStream.getTracks().forEach((track) => track.stop());
    voicePreviewStream = null;
    if (button) button.textContent = 'Test Voice';
    if (status) status.textContent = '';
    return;
  }

  try {
    updateVoiceChangerStateFromControls();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: getAudioConstraints(true),
      video: false,
    });
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    connectVoiceEffectNodes(
      audioContext,
      source,
      audioContext.destination,
      getVoiceChangerControlsState()
    );
    voicePreviewStream = stream;
    voicePreviewContext = audioContext;
    if (button) button.textContent = 'Stop Test';
    if (status) status.textContent = 'Playing your processed microphone locally.';
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not start voice preview.'), 'error');
  }
}

async function testSettingsMicrophone() {
  const button = document.getElementById('settingsMicTestBtn');
  const status = document.getElementById('settingsMicTestStatus');
  if (!button) {
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Checking...';
  if (status) status.textContent = '';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    if (status) status.textContent = 'Microphone access works.';
    button.textContent = 'Mic Works';
  } catch (err) {
    console.error('Mic test failed:', err);
    if (status) status.textContent = 'Could not access your microphone.';
    button.textContent = 'Try Again';
  } finally {
    setTimeout(() => {
      button.disabled = false;
      if (button.textContent !== 'Try Again') {
        button.textContent = originalText;
      }
    }, 1200);
  }
}

async function populateVoiceDeviceSettings() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const deviceTargets = [
      {
        select: document.getElementById('settingsInputDeviceSelect'),
        kind: 'audioinput',
        fallbackLabel: 'Microphone',
      },
      {
        select: document.getElementById('settingsOutputDeviceSelect'),
        kind: 'audiooutput',
        fallbackLabel: 'Speakers',
      },
    ];

    deviceTargets.forEach(({ select, kind, fallbackLabel }) => {
      if (!select) {
        return;
      }

      const previousValue = select.value;
      const matchingDevices = devices.filter((device) => device.kind === kind);
      select.innerHTML = '<option value="default">Default</option>';

      matchingDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId || `${kind}-${index}`;
        option.textContent = device.label || `${fallbackLabel} ${index + 1}`;
        select.appendChild(option);
      });

      if (Array.from(select.options).some((option) => option.value === previousValue)) {
        select.value = previousValue;
      }
    });
  } catch (err) {
    console.warn('Could not load voice devices:', err);
  }
}

function refreshSettingsModal() {
  loadAccountSettings().then(() => {
    loadSessions();
  });
  updateSettingsIdentityFields();
  populateVoiceDeviceSettings().then(() => {
    applyPersistedSettingsState();
  });
  applyPersistedSettingsState();
  renderSettingsKeybinds();
  applyRemovedSettingsItems();

  const searchInput = document.getElementById('settingsSearchInput');
  if (searchInput) {
    searchInput.value = '';
    filterSettingsSidebarItems('');
  }

  switchSettingsTab(readSettingsState().selectedTab || 'my-account');
  loadUserTheme();
  loadUserProfile();
  loadSessions();
}

document.addEventListener('DOMContentLoaded', () => {
  refreshIceServersConfig();
  setupEmojiPicker();
  setupMessageSearch();
  setupSettingsInteractivity();
  loadAccountSettings();
  applyPersistedSettingsState();
  loadUserTheme();
  loadUserProfile();
});

// ===== Settings Tab Switching =====
function switchSettingsTab(target) {
  document.querySelectorAll('.settings-view').forEach((view) => {
    hideElement(view);
  });

  const targetView = document.getElementById('view-' + target);
  if (targetView) {
    showElement(targetView, 'block');
  }

  document.querySelectorAll('.settings-item').forEach((item) => {
    item.classList.remove('active');
    if (item.dataset.target === target) {
      item.classList.add('active');
    }
  });

  writeSettingsState((state) => ({
    ...state,
    selectedTab: target,
  }));
}
window.switchSettingsTab = switchSettingsTab;

function setupSettingsInteractivity() {
  if (settingsInteractivityInitialized) {
    return;
  }

  settingsInteractivityInitialized = true;

  document.querySelectorAll('.settings-item[data-target]').forEach((item) => {
    item.addEventListener('click', () => {
      switchSettingsTab(item.dataset.target);
    });
  });

  const searchInput = document.getElementById('settingsSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterSettingsSidebarItems(searchInput.value);
    });

    searchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      const firstMatch = filterSettingsSidebarItems(searchInput.value);
      if (firstMatch?.dataset.target) {
        switchSettingsTab(firstMatch.dataset.target);
      }
    });
  }

  const profileTabBar = document.querySelector('[data-settings-tab-bar="profileView"]');
  if (profileTabBar) {
    profileTabBar.querySelectorAll('.settings-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const nextTab = tab.dataset.tab || 'user-profile';
        applyProfileTab(nextTab);
        writeSettingsState((state) => ({
          ...state,
          profileView: nextTab,
        }));
      });
    });
  }

  document.querySelectorAll('.toggle-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      const toggle = item.querySelector('.toggle-switch');
      if (!toggle) {
        return;
      }

      const isActive = !toggle.classList.contains('active');
      toggle.classList.toggle('active', isActive);
      handleToggleStateChange(getToggleSettingKey(item, index), isActive);
    });
  });

  document.querySelectorAll('.radio-group').forEach((group, index) => {
    group.querySelectorAll('.radio-item').forEach((item, itemIndex) => {
      item.addEventListener('click', () => {
        const settingKey = getRadioGroupKey(group, index);
        const value = getRadioItemValue(item, itemIndex);
        setRadioGroupSelection(group, value);
        handleRadioStateChange(settingKey, value);
      });
    });
  });

  document.querySelectorAll('.checkbox-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      const checkbox = item.querySelector('.checkbox-box');
      if (!checkbox) {
        return;
      }

      const isChecked = !checkbox.classList.contains('checked');
      checkbox.classList.toggle('checked', isChecked);
      handleCheckboxStateChange(getCheckboxSettingKey(item, index), isChecked);
    });
  });

  document.querySelectorAll('.settings-select').forEach((select, index) => {
    select.addEventListener('change', () => {
      handleSelectStateChange(select, index);
    });
  });

  document.querySelectorAll('.settings-slider').forEach((slider, index) => {
    slider.addEventListener('input', () => {
      handleSliderStateChange(slider, index);
    });
  });

  setupSettingsActionButtons();
  renderSettingsKeybinds();
  applyRemovedSettingsItems();
  document.getElementById('settingsMicTestBtn')?.addEventListener('click', testSettingsMicrophone);
  document.getElementById('voicePreviewBtn')?.addEventListener('click', toggleVoicePreview);

  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal) {
    settingsModal.addEventListener('click', (event) => {
      if (event.target === settingsModal) {
        closeSettingsModal();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const modal = document.getElementById('settingsModal');
      if (isElementVisible(modal)) {
        closeSettingsModal();
      }
    }
  });

  const saveProfileBtn = document.getElementById('saveProfileSettingsBtn');
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      const profilePicUrl = document.getElementById('profilePictureUrlInput')?.value?.trim() || '';
      const profileBannerUrl = document.getElementById('profileBannerUrlInput')?.value?.trim() || '';
      const profileBannerColor = readSettingsState().profileBannerColor || '#0c0c0c';
      const description =
        document.getElementById('profileDescriptionInput')?.value?.trim() || '';

      try {
        saveProfileBtn.textContent = 'Saving...';
        saveProfileBtn.disabled = true;

        await axios.post(`${homeApiBase}/api/Account/UpdateAccountProfile`, {
          profilePictureUrl: profilePicUrl,
          profileBannerUrl,
          profileBannerColor,
          description: description,
        });

        updateProfileVisuals(profilePicUrl, description, profileBannerUrl, profileBannerColor);
        writeSettingsState((state) => ({
          ...state,
          profileBannerUrl,
          profileBannerColor,
        }));
        saveProfileBtn.textContent = 'Saved!';
        setTimeout(() => {
          saveProfileBtn.textContent = 'Save Profile';
          saveProfileBtn.disabled = false;
        }, 2000);
      } catch (err) {
        console.error('Failed to save profile:', err);
        saveProfileBtn.textContent = 'Try Again';
        showAppMessage(getApiErrorMessage(err, 'Failed to save profile.'), 'error');
        saveProfileBtn.disabled = false;
      }
    });
  }

  const saveThemeBtn = document.getElementById('saveCustomThemeBtn');
  if (saveThemeBtn) {
    saveThemeBtn.addEventListener('click', async () => {
      const bgColor =
        document.getElementById('customBgColor')?.value || DEFAULT_THEME.background;
      const textColor =
        document.getElementById('customTextColor')?.value || DEFAULT_THEME.text;

      try {
        saveThemeBtn.textContent = 'Saving...';
        saveThemeBtn.disabled = true;

        await axios.post(`${homeApiBase}/api/Account/UpdateAccountTheme`, {
          username: JWTusername,
          backgroundColor: bgColor,
          textColor: textColor,
        });

        applyTheme(bgColor, textColor);
        syncThemeModeSelectionFromTheme(bgColor, textColor);
        writeSettingsState((state) => ({
          ...state,
          customTheme: {
            backgroundColor: bgColor,
            textColor,
          },
        }));

        saveThemeBtn.textContent = 'Saved!';
        setTimeout(() => {
          saveThemeBtn.textContent = 'Save Theme';
          saveThemeBtn.disabled = false;
        }, 2000);
      } catch (err) {
        console.error('Failed to save theme:', err);
        saveThemeBtn.textContent = 'Try Again';
        showAppMessage(getApiErrorMessage(err, 'Failed to save theme.'), 'error');
        saveThemeBtn.disabled = false;
      }
    });
  }

  const resetThemeBtn = document.getElementById('resetCustomThemeBtn');
  if (resetThemeBtn) {
    resetThemeBtn.addEventListener('click', async () => {
      try {
        await axios.post(`${homeApiBase}/api/Account/UpdateAccountTheme`, {
          username: JWTusername,
          backgroundColor: DEFAULT_THEME.background,
          textColor: DEFAULT_THEME.text,
        });

        applyTheme(DEFAULT_THEME.background, DEFAULT_THEME.text);
        syncThemeInputs(DEFAULT_THEME.background, DEFAULT_THEME.text);
        setRadioGroupSelection(
          document.querySelector('[data-settings-radio="themeMode"]'),
          'dark'
        );
        writeSettingsState((state) => ({
          ...state,
          themeMode: 'dark',
          customTheme: null,
        }));
      } catch (err) {
        console.error('Failed to reset theme:', err);
        showAppMessage(getApiErrorMessage(err, 'Failed to reset theme.'), 'error');
      }
    });
  }

  const bgInput = document.getElementById('customBgColor');
  const textInput = document.getElementById('customTextColor');
  const previewTheme = () => {
    if (!bgInput || !textInput) return;
    applyTheme(
      bgInput.value || DEFAULT_THEME.background,
      textInput.value || DEFAULT_THEME.text
    );
  };
  if (bgInput) bgInput.addEventListener('input', previewTheme);
  if (textInput) textInput.addEventListener('input', previewTheme);

  const editProfileBtn = document.querySelector('.edit-profile-btn');
  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', () => {
      switchSettingsTab('profiles');
    });
  }

  if (
    typeof window.matchMedia === 'function' &&
    !settingsSystemThemeListenerInitialized
  ) {
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleColorSchemeChange = () => {
      if (readSettingsState().themeMode === 'sync-with-computer') {
        applyThemeMode('sync-with-computer');
      }
    };

    if (typeof colorSchemeQuery.addEventListener === 'function') {
      colorSchemeQuery.addEventListener('change', handleColorSchemeChange);
    } else if (typeof colorSchemeQuery.addListener === 'function') {
      colorSchemeQuery.addListener(handleColorSchemeChange);
    }

    settingsSystemThemeListenerInitialized = true;
  }
}

const DEFAULT_THEME = {
  background: '#313338',
  text: '#dbdee1',
};

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHexColor(color, fallback = DEFAULT_THEME.background) {
  if (typeof color !== 'string') return fallback;

  const trimmed = color.trim();
  const raw = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;

  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .split('')
      .map((char) => char + char)
      .join('')
      .toLowerCase()}`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toLowerCase()}`;
  }

  return fallback;
}

function hexToRgb(color) {
  const normalized = normalizeHexColor(color);
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => clampColorChannel(value).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixColors(startColor, endColor, amount) {
  const start = hexToRgb(startColor);
  const end = hexToRgb(endColor);
  const mixAmount = Math.max(0, Math.min(1, amount));

  return rgbToHex({
    r: start.r + (end.r - start.r) * mixAmount,
    g: start.g + (end.g - start.g) * mixAmount,
    b: start.b + (end.b - start.b) * mixAmount,
  });
}

function getRelativeLuminance(color) {
  const { r, g, b } = hexToRgb(color);
  const channels = [r, g, b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function getContrastRatio(colorA, colorB) {
  const luminanceA = getRelativeLuminance(colorA);
  const luminanceB = getRelativeLuminance(colorB);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

function getReadableTextColor(backgroundColor, preferredTextColor) {
  const background = normalizeHexColor(backgroundColor, DEFAULT_THEME.background);
  const preferred = normalizeHexColor(
    preferredTextColor,
    DEFAULT_THEME.text
  );

  if (getContrastRatio(background, preferred) >= 4.5) {
    return preferred;
  }

  const whiteContrast = getContrastRatio(background, '#ffffff');
  const blackContrast = getContrastRatio(background, '#000000');

  return whiteContrast >= blackContrast ? '#ffffff' : '#000000';
}

function buildThemePalette(backgroundColor, textColor) {
  const background = normalizeHexColor(
    backgroundColor,
    DEFAULT_THEME.background
  );
  const mainText = getReadableTextColor(background, textColor);
  const isDarkTheme = getRelativeLuminance(background) < 0.35;
  const referenceColor = isDarkTheme ? '#ffffff' : '#000000';

  return {
    background,
    secondBackground: mixColors(background, referenceColor, isDarkTheme ? 0.07 : 0.05),
    raisedSurface: mixColors(background, referenceColor, isDarkTheme ? 0.13 : 0.1),
    floatingSurface: mixColors(background, referenceColor, isDarkTheme ? 0.18 : 0.15),
    inputSurface: mixColors(background, referenceColor, isDarkTheme ? 0.15 : 0.11),
    inputStrongSurface: mixColors(background, referenceColor, isDarkTheme ? 0.22 : 0.18),
    borderSubtle: mixColors(background, mainText, 0.16),
    borderStrong: mixColors(background, mainText, 0.26),
    mainText,
    mutedText: mixColors(mainText, background, 0.3),
    softText: mixColors(mainText, background, 0.48),
    inverseText: getReadableTextColor(mainText, background),
    shadowColor: isDarkTheme ? 'rgba(0, 0, 0, 0.38)' : 'rgba(0, 0, 0, 0.18)',
  };
}

function applyTheme(bgColor, textColor) {
  const theme = buildThemePalette(bgColor, textColor);

  setHomeRuntimeCss(
    'theme',
    `:root {
  --main-bg: ${theme.background};
  --second-bg: ${theme.secondBackground};
  --surface-raised: ${theme.raisedSurface};
  --surface-floating: ${theme.floatingSurface};
  --input-bg: ${theme.inputSurface};
  --input-strong: ${theme.inputStrongSurface};
  --border-subtle: ${theme.borderSubtle};
  --border-strong: ${theme.borderStrong};
  --text-main: ${theme.mainText};
  --text-muted: ${theme.mutedText};
  --text-soft: ${theme.softText};
  --text-inverse: ${theme.inverseText};
  --theme-shadow: ${theme.shadowColor};
}`
  );

  return theme;
}

async function loadUserTheme() {
  try {
    if (typeof JWTusername === 'undefined' || !JWTusername) return;
    const res = await axios.get(`${homeApiBase}/api/Account/GetAccountTheme`);
    if (res.data && res.data.backgroundColor) {
      applyTheme(res.data.backgroundColor, res.data.textColor || '#dbdee1');
      
      const bgInput = document.getElementById('customBgColor');
      const textInput = document.getElementById('customTextColor');
      if (bgInput) bgInput.value = res.data.backgroundColor;
      if (textInput && res.data.textColor) textInput.value = res.data.textColor;
      syncThemeModeSelectionFromTheme(
        res.data.backgroundColor,
        res.data.textColor || DEFAULT_THEME.text
      );
    }
  } catch (err) {
    console.log('Could not load theme, using defaults');
  }
}

async function loadUserProfile() {
  try {
    if (typeof JWTusername === 'undefined' || !JWTusername) return;
    const res = await axios.get(`${homeApiBase}/api/Account/GetAccountProfile?username=${encodeURIComponent(JWTusername)}`);
    if (res.data) {
      const picInput = document.getElementById('profilePictureUrlInput');
      const bannerInput = document.getElementById('profileBannerUrlInput');
      const descInput = document.getElementById('profileDescriptionInput');
      const nextAvatarUrl = res.data.profilePictureUrl || homeDefaultAvatarUrl;
      const nextDescription = res.data.description || 'Click to add custom status';
      const nextBannerUrl = res.data.profileBannerUrl || '';
      const nextBannerColor = res.data.profileBannerColor || readSettingsState().profileBannerColor || '#0c0c0c';
      
      if (picInput) picInput.value = res.data.profilePictureUrl || '';
      if (bannerInput) bannerInput.value = nextBannerUrl;
      if (descInput) descInput.value = res.data.description || '';
      updateProfileVisuals(nextAvatarUrl, nextDescription, nextBannerUrl, nextBannerColor);
      writeSettingsState((state) => ({
        ...state,
        profileBannerUrl: nextBannerUrl,
        profileBannerColor: nextBannerColor,
      }));
    }
  } catch (err) {
    console.log('Could not load profile, using defaults');
  }
}
