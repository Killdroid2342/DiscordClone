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
const homeCdnBase = String(homeAppPaths.cdnBase || window.MYDISCORD_CONFIG?.cdnBase || '').replace(/\/+$/, '');
const homeWsBase = homeApiBase.replace(/^http/i, 'ws');

const displayStateClasses = ['is-hidden', 'is-block', 'is-flex', 'is-grid', 'is-inline-flex'];
const voiceLevelClasses = Array.from({ length: 11 }, (_, index) => `voice-level-${index}`);
const messageFontSizeClasses = Array.from({ length: 13 }, (_, index) => `message-font-size-${index + 12}`);
const customStatusMaxLength = 128;
const activityStatusMaxLength = 120;
const defaultCustomStatusText = 'Click to add custom status';
const profileBadgeMaxCount = 6;
const messagePageSize = 50;
const messageVirtualOverscanPx = 640;
const messageVirtualAutoLoadThresholdPx = 96;
const messageVirtualDefaultItemHeight = 92;
const messageVirtualLoaderHeight = 52;
const mediaUrlCacheMaxEntries = 500;
const presenceStatusLabels = {
  online: 'Online',
  idle: 'Idle',
  'do-not-disturb': 'Do Not Disturb',
  invisible: 'Invisible',
  offline: 'Offline',
};
const accountStandingLabels = {
  good: 'Good',
  limited: 'Limited',
  'at-risk': 'At Risk',
  suspended: 'Suspended',
};
const profileBadgeCatalog = [
  { id: 'early-member', label: 'Early Member', text: 'EARLY' },
  { id: 'community-helper', label: 'Community Helper', text: 'HELP' },
  { id: 'server-builder', label: 'Server Builder', text: 'BUILD' },
  { id: 'bug-hunter', label: 'Bug Hunter', text: 'BUG' },
  { id: 'developer', label: 'Developer', text: 'DEV' },
  { id: 'artist', label: 'Artist', text: 'ART' },
  { id: 'gamer', label: 'Gamer', text: 'GAME' },
  { id: 'music-fan', label: 'Music Fan', text: 'MUSIC' },
];
const homeRuntimeCssRules = new Map();
const profileSummaryCache = new Map();
const virtualMessageLists = new WeakMap();
const mediaUrlCache = new Map();
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
  const resolvedImageUrl = resolveMediaUrl(imageUrl);
  const backgroundImage = resolvedImageUrl ? `url("${cssString(resolvedImageUrl)}")` : 'none';

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
let currentServerMembers = [];
let currentServerAutoModRules = [];
let currentServerSlashCommands = [];
let currentServerSlashCommandServerId = null;
let currentServerIconUrl = '';
let currentServerBannerUrl = '';
let selectedServerTemplateId = 'friends';
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
let currentServerThreadId = null;
let currentServerThread = null;
let pinnedMessagesRefreshInFlight = false;
let pendingReplyDraft = null;
let forwardSourceMessage = null;
let forwardSourceScope = null;
let pendingPollComposerContext = null;
const renderedMessageCache = {
  server: new Map(),
  dm: new Map(),
  group: new Map(),
};
const messagePaginationState = {
  server: createEmptyMessagePaginationState(),
  dm: createEmptyMessagePaginationState(),
  group: createEmptyMessagePaginationState(),
};
const stickerMessageContentType = 'application/x-mydiscord-sticker';
const expressionPackCache = new Map();
let activeEmojiPickerInput = null;
let lastEmojiPickerToggle = null;
let expressionDialogMode = 'emoji';
let renderEmojiPickerContent = null;

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
  messageOuterModal.setAttribute('aria-hidden', 'false');
  showElement(messageOuterModal, 'flex');

  window.clearTimeout(showAppMessage.timeoutId);
  showAppMessage.timeoutId = window.setTimeout(() => {
    messageOuterModal.setAttribute('aria-hidden', 'true');
    hideElement(messageOuterModal);
  }, duration);
}

function createEmptyState({
  icon = '',
  title = '',
  description = '',
  actionLabel = '',
  onAction = null,
  compact = false,
  className = '',
  kind = '',
} = {}) {
  const empty = document.createElement('div');
  empty.className = ['empty-state-card', compact ? 'compact' : '', className].filter(Boolean).join(' ');
  empty.dataset.emptyState = 'true';
  if (kind) {
    empty.dataset.emptyStateKind = kind;
  }

  if (icon) {
    const symbol = document.createElement('div');
    symbol.className = 'empty-state-symbol';
    symbol.textContent = icon;
    empty.appendChild(symbol);
  }

  if (title) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    empty.appendChild(heading);
  }

  if (description) {
    const copy = document.createElement('p');
    copy.textContent = description;
    empty.appendChild(copy);
  }

  if (actionLabel && typeof onAction === 'function') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'settings-btn-primary empty-state-action';
    button.textContent = actionLabel;
    button.addEventListener('click', onAction);
    empty.appendChild(button);
  }

  return empty;
}

function setEmptyState(target, options) {
  const container = getElement(target);
  if (!container) return null;
  const empty = createEmptyState(options);
  container.replaceChildren(empty);
  return empty;
}

function removeEmptyStates(container, kind = '') {
  if (!container) return;
  const selector = kind
    ? `[data-empty-state-kind="${kind}"]`
    : '[data-empty-state="true"]';
  container.querySelectorAll(selector).forEach((item) => item.remove());
}

function refreshConversationListEmptyState() {
  if (!mainFriendsDiv) return;
  removeEmptyStates(mainFriendsDiv, 'conversation-list');
  const hasConversations = mainFriendsDiv.querySelector('.conversation-list-item');
  if (hasConversations) {
    applyConversationSearchFilter();
    return;
  }

  mainFriendsDiv.appendChild(createEmptyState({
    icon: 'DM',
    title: 'No conversations yet',
    description: 'Add a friend or create a group DM to start chatting.',
    actionLabel: 'Add Friend',
    onAction: showAddFriends,
    compact: true,
    className: 'conversation-empty-state',
    kind: 'conversation-list',
  }));
  applyConversationSearchFilter();
}

function getMessageEmptyStateCopy(scope) {
  if (scope === 'server') {
    return {
      icon: '#',
      title: 'No messages in this channel',
      description: 'Send the first message and get the channel moving.',
    };
  }

  if (scope === 'group') {
    return {
      icon: 'GC',
      title: 'No group messages yet',
      description: 'Start the group chat with a quick hello.',
    };
  }

  return {
    icon: 'DM',
    title: 'No messages yet',
    description: 'This is the beginning of your direct message history.',
  };
}

function normalizePresenceStatus(status = 'online') {
  const normalized = String(status || 'online').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(presenceStatusLabels, normalized)
    ? normalized
    : 'online';
}

function getPresenceStatusLabel(status = 'online') {
  return presenceStatusLabels[normalizePresenceStatus(status)] || 'Online';
}

function normalizeCustomStatus(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, customStatusMaxLength);
}

function normalizeActivityStatus(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, activityStatusMaxLength);
}

function getProfileUsername(profile = {}) {
  return profile.username || profile.Username || '';
}

function getProfilePictureUrl(profile = {}) {
  return profile.profilePictureUrl || profile.ProfilePictureUrl || '';
}

function getProfilePresenceStatus(profile = {}) {
  return normalizePresenceStatus(profile.presenceStatus || profile.PresenceStatus);
}

function getProfileCustomStatus(profile = {}) {
  return normalizeCustomStatus(profile.customStatus || profile.CustomStatus || '');
}

function getProfileActivityStatus(profile = {}) {
  return normalizeActivityStatus(profile.activityStatus || profile.ActivityStatus || '');
}

function getProfileLastActiveAt(profile = {}) {
  return profile.lastActiveAt || profile.LastActiveAt || null;
}

function getProfileShowActivity(profile = {}) {
  return profile.showActivity ?? profile.ShowActivity ?? true;
}

function getProfileBio(profile = {}) {
  return String(profile.bio ?? profile.Bio ?? profile.description ?? profile.Description ?? '').trim();
}

function normalizeProfileBadges(values = []) {
  const rawBadges = Array.isArray(values) ? values : [];
  const allowedBadgeIds = new Set(profileBadgeCatalog.map((badge) => badge.id));
  const normalizedBadges = [];

  rawBadges.forEach((value) => {
    const badgeId = String(value || '').trim().toLowerCase();
    if (
      allowedBadgeIds.has(badgeId) &&
      !normalizedBadges.includes(badgeId) &&
      normalizedBadges.length < profileBadgeMaxCount
    ) {
      normalizedBadges.push(badgeId);
    }
  });

  return normalizedBadges;
}

function normalizeAccountUsernameList(values = []) {
  const rawValues = Array.isArray(values) ? values : [];
  const normalized = [];

  rawValues.forEach((value) => {
    const username = String(value || '').trim();
    if (username && !normalized.some((item) => item.toLowerCase() === username.toLowerCase())) {
      normalized.push(username);
    }
  });

  return normalized;
}

function getProfileBadges(profile = {}) {
  return normalizeProfileBadges(
    profile.badges ||
    profile.Badges ||
    profile.profileBadges ||
    profile.ProfileBadges ||
    profile.userBadges ||
    profile.UserBadges ||
    []
  );
}

function getProfileBadgeDefinition(badgeId) {
  return profileBadgeCatalog.find((badge) => badge.id === badgeId) || {
    id: badgeId,
    label: badgeId,
    text: String(badgeId || '').slice(0, 5).toUpperCase(),
  };
}

function createUserBadgeElement(badgeId, compact = false) {
  const badgeDefinition = getProfileBadgeDefinition(badgeId);
  const badge = document.createElement('span');
  badge.className = compact ? 'user-badge compact' : 'user-badge';
  badge.dataset.badge = badgeDefinition.id;
  badge.textContent = badgeDefinition.text;
  badge.title = badgeDefinition.label;
  return badge;
}

function renderUserBadges(target, badges = [], { compact = false } = {}) {
  const container = getElement(target);
  if (!container) return;

  const normalizedBadges = normalizeProfileBadges(badges);
  container.textContent = '';
  container.classList.toggle('is-empty', normalizedBadges.length === 0);

  if (!normalizedBadges.length) {
    hideElement(container);
    return;
  }

  normalizedBadges.forEach((badgeId) => {
    container.appendChild(createUserBadgeElement(badgeId, compact));
  });
  showElement(container, 'flex');
}

function cacheProfileSummary(profile = {}) {
  const profileUsername = getProfileUsername(profile);
  if (!profileUsername) return;
  profileSummaryCache.set(profileUsername.toLowerCase(), {
    username: profileUsername,
    profilePictureUrl: getProfilePictureUrl(profile),
    presenceStatus: getProfilePresenceStatus(profile),
    customStatus: getProfileCustomStatus(profile),
    activityStatus: getProfileActivityStatus(profile),
    lastActiveAt: getProfileLastActiveAt(profile),
    showActivity: getProfileShowActivity(profile),
    bio: getProfileBio(profile),
    badges: getProfileBadges(profile),
  });
}

function getCachedProfileSummary(profileUsername) {
  return profileSummaryCache.get(String(profileUsername || '').toLowerCase()) || null;
}

function setPresenceClass(element, status = 'online') {
  if (!element) return;
  element.dataset.status = normalizePresenceStatus(status);
}

function formatLastActiveSummary(value) {
  if (!value) return '';
  const lastActive = new Date(value);
  if (Number.isNaN(lastActive.getTime())) return '';

  const diffMs = Date.now() - lastActive.getTime();
  if (diffMs < 0 || diffMs < 60 * 1000) return 'Active now';

  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 60) return `Last active ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last active ${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Last active ${days}d ago`;

  return `Last active ${lastActive.toLocaleDateString()}`;
}

function getStatusSummary(profile = {}) {
  const presenceStatus = getProfilePresenceStatus(profile);
  if (getProfileShowActivity(profile)) {
    const activityStatus = getProfileActivityStatus(profile);
    if (activityStatus) return activityStatus;
  }

  const customStatus = getProfileCustomStatus(profile);
  if (customStatus) return customStatus;

  if (presenceStatus === 'offline') {
    return formatLastActiveSummary(getProfileLastActiveAt(profile)) || 'Offline';
  }

  return getPresenceStatusLabel(presenceStatus);
}

async function fetchFriendProfileSummaries() {
  try {
    const response = await axios.get(`${homeApiBase}/api/Account/GetFriendProfiles`);
    const profiles = Array.isArray(response.data) ? response.data : [];
    profiles.forEach(cacheProfileSummary);
    return new Map(
      profiles.map((profile) => [
        getProfileUsername(profile).toLowerCase(),
        {
          username: getProfileUsername(profile),
          profilePictureUrl: getProfilePictureUrl(profile),
          presenceStatus: getProfilePresenceStatus(profile),
          customStatus: getProfileCustomStatus(profile),
          activityStatus: getProfileActivityStatus(profile),
          lastActiveAt: getProfileLastActiveAt(profile),
          showActivity: getProfileShowActivity(profile),
          bio: getProfileBio(profile),
          badges: getProfileBadges(profile),
        },
      ])
    );
  } catch (error) {
    console.warn('Could not load friend statuses:', error);
    return new Map();
  }
}

function setCustomStatusInputs(customStatus = '') {
  const normalized = normalizeCustomStatus(customStatus);
  document
    .querySelectorAll('#customStatusInput, #profileCustomStatusInput')
    .forEach((input) => {
      input.value = normalized;
    });
}

function setActivityStatusInputs(activityStatus = '') {
  const normalized = normalizeActivityStatus(activityStatus);
  document
    .querySelectorAll('#activityStatusInput')
    .forEach((input) => {
      input.value = normalized;
    });
}

function normalizeAccountStanding(standing = 'good') {
  const normalized = String(standing || 'good').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(accountStandingLabels, normalized)
    ? normalized
    : 'good';
}

function getAccountStandingLabel(standing = 'good') {
  return accountStandingLabels[normalizeAccountStanding(standing)] || 'Good';
}

function getAccountStanding(state = readSettingsState()) {
  const standing = state.accountStanding || {};
  const normalizedStanding = normalizeAccountStanding(standing.standing || standing.Standing);
  return {
    standing: normalizedStanding,
    label: standing.label || standing.Label || getAccountStandingLabel(normalizedStanding),
    trustScore: Math.max(0, Math.min(100, Number(standing.trustScore ?? standing.TrustScore ?? 60))),
    summary: standing.summary || standing.Summary || 'No restrictions are applied to this account.',
    reason: standing.reason || standing.Reason || '',
    signals: Array.isArray(standing.signals)
      ? standing.signals
      : Array.isArray(standing.Signals)
        ? standing.Signals
        : [],
  };
}

function getSelectedProfileBadges() {
  return normalizeProfileBadges(
    Array.from(document.querySelectorAll('#profileBadgePicker input[type="checkbox"]:checked'))
      .map((input) => input.value)
  );
}

function updateProfileBadgePickerLimit() {
  const selectedBadges = getSelectedProfileBadges();
  const selectedCount = selectedBadges.length;
  document
    .querySelectorAll('#profileBadgePicker input[type="checkbox"]')
    .forEach((input) => {
      input.disabled = !input.checked && selectedCount >= profileBadgeMaxCount;
      input.closest('.profile-badge-choice')?.classList.toggle('is-disabled', input.disabled);
    });

  const count = document.getElementById('profileBadgeCount');
  if (count) {
    count.textContent = `${selectedCount}/${profileBadgeMaxCount}`;
  }

  renderUserBadges('#profilePreviewBadges', selectedBadges);
}

function setProfileBadgePickerSelection(badges = []) {
  const selectedBadges = normalizeProfileBadges(badges);
  const picker = document.getElementById('profileBadgePicker');
  if (!picker) return;

  if (!picker.children.length) {
    renderProfileBadgePicker(selectedBadges);
    return;
  }

  picker.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = selectedBadges.includes(input.value);
  });
  updateProfileBadgePickerLimit();
}

function renderProfileBadgePicker(selectedBadges = []) {
  const picker = document.getElementById('profileBadgePicker');
  if (!picker) return;

  const selectedBadgeIds = normalizeProfileBadges(selectedBadges);
  picker.textContent = '';
  profileBadgeCatalog.forEach((badgeDefinition) => {
    const choice = document.createElement('label');
    choice.className = 'profile-badge-choice';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = badgeDefinition.id;
    input.checked = selectedBadgeIds.includes(badgeDefinition.id);
    input.addEventListener('change', () => {
      if (getSelectedProfileBadges().length > profileBadgeMaxCount) {
        input.checked = false;
        showAppMessage(`Choose up to ${profileBadgeMaxCount} profile badges.`, 'error');
      }

      const nextBadges = getSelectedProfileBadges();
      writeSettingsState((state) => ({
        ...state,
        profileBadges: nextBadges,
      }));
      updateProfileBadgePickerLimit();
    });

    const badge = createUserBadgeElement(badgeDefinition.id);
    const label = document.createElement('span');
    label.className = 'profile-badge-choice-label';
    label.textContent = badgeDefinition.label;

    choice.appendChild(input);
    choice.appendChild(badge);
    choice.appendChild(label);
    picker.appendChild(choice);
  });

  updateProfileBadgePickerLimit();
}

function applyCurrentProfileStatus(customStatus = '', presenceStatus = readSettingsState().presenceStatus) {
  const normalizedStatus = normalizePresenceStatus(presenceStatus);
  const normalizedCustomStatus = normalizeCustomStatus(customStatus);
  const previewCustomStatus = document.querySelector('.preview-custom-status');
  if (previewCustomStatus) {
    previewCustomStatus.textContent = normalizedCustomStatus || defaultCustomStatusText;
  }

  document
    .querySelectorAll('.avatar-status-indicator, .preview-status')
    .forEach((indicator) => setPresenceClass(indicator, normalizedStatus));

  setCustomStatusInputs(normalizedCustomStatus);
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

function getAppUpdateBridge() {
  return window.appUpdates || null;
}

function getAppDiagnosticsBridge() {
  return window.appDiagnostics || null;
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
    message.senderDisplayName ||
    message.SenderDisplayName ||
    message.messagesUserSender ||
    message.MessagesUserSender ||
    message.sender ||
    message.Sender ||
    'Unknown'
  );
}

function getMessageIsBot(message = {}) {
  return Boolean(message.isBot ?? message.IsBot);
}

function getMessageIsWebhook(message = {}) {
  return Boolean(message.isWebhook ?? message.IsWebhook);
}

function createMessageSourceBadge(message = {}) {
  const label = getMessageIsWebhook(message)
    ? 'Webhook'
    : getMessageIsBot(message)
      ? 'Bot'
      : '';
  if (!label) {
    return null;
  }

  const badge = document.createElement('span');
  badge.className = 'message-source-badge';
  badge.dataset.source = label.toLowerCase();
  badge.textContent = label;
  return badge;
}

function getMessageId(message = {}) {
  return (
    message.messageID ||
    message.MessageID ||
    message.threadMessageId ||
    message.ThreadMessageId ||
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

function getMessageReplyId(message = {}) {
  const replyId = message.replyToMessageId ?? message.ReplyToMessageId ?? '';
  return replyId ? String(replyId) : '';
}

function getMessageReplyPreview(message = {}) {
  return message.replyPreview || message.ReplyPreview || null;
}

function getMessageEditedAt(message = {}) {
  return message.editedAt || message.EditedAt || '';
}

function getMessageAttachmentUrl(message = {}) {
  return message.attachmentUrl || message.AttachmentUrl || '';
}

function getMessageAttachmentContentType(message = {}) {
  return message.attachmentContentType || message.AttachmentContentType || '';
}

function getMessageReactions(message = {}) {
  const reactions = message.reactions || message.Reactions || [];
  return Array.isArray(reactions) ? reactions : [];
}

function getMessagePoll(message = {}) {
  return message.poll || message.Poll || null;
}

function getPollId(poll = {}) {
  return poll.id || poll.Id || '';
}

function getPollQuestion(poll = {}) {
  return poll.question || poll.Question || '';
}

function getPollOptions(poll = {}) {
  const options = poll.options || poll.Options || [];
  return Array.isArray(options) ? options : [];
}

function getPollOptionId(option = {}) {
  return option.id || option.Id || '';
}

function getPollOptionText(option = {}) {
  return option.text || option.Text || '';
}

function getPollOptionVoteCount(option = {}) {
  return Number(option.voteCount ?? option.VoteCount ?? 0);
}

function getPollTotalVotes(poll = {}) {
  return Number(poll.totalVotes ?? poll.TotalVotes ?? 0);
}

function getPollSelectedOptionIds(poll = {}) {
  const ids = poll.selectedOptionIds || poll.SelectedOptionIds || [];
  return Array.isArray(ids) ? ids.map(String) : [];
}

function isPollMultipleChoice(poll = {}) {
  return Boolean(poll.allowMultiple ?? poll.AllowMultiple);
}

function isPollClosed(poll = {}) {
  return Boolean(poll.isClosed ?? poll.IsClosed);
}

function getReplyPreviewSender(preview = {}) {
  return (
    preview.sender ||
    preview.Sender ||
    preview.messagesUserSender ||
    preview.MessagesUserSender ||
    'Unknown'
  );
}

function getReplyPreviewText(preview = {}) {
  return (
    preview.text ||
    preview.Text ||
    preview.userText ||
    preview.friendMessagesData ||
    preview.FriendMessagesData ||
    preview.content ||
    preview.Content ||
    ''
  );
}

function getReplyPreviewAttachmentUrl(preview = {}) {
  return preview.attachmentUrl || preview.AttachmentUrl || '';
}

function getMessageSnippet(message = {}, fallback = 'Sent an attachment.') {
  return cleanNotificationBody(getMessageText(message) || fallback, fallback);
}

function getPreviewSnippet(preview = {}, fallback = 'Sent an attachment.') {
  return cleanNotificationBody(
    getReplyPreviewText(preview) || (getReplyPreviewAttachmentUrl(preview) ? fallback : 'Original message unavailable.'),
    fallback
  );
}

function cacheMessagesForScope(scope, messages = []) {
  if (!renderedMessageCache[scope]) {
    return;
  }

  renderedMessageCache[scope].clear();
  messages.forEach((message) => {
    const id = getMessageId(message);
    if (id) {
      renderedMessageCache[scope].set(String(id), message);
    }
  });
}

function cacheMessageForScope(scope, message = {}) {
  const id = getMessageId(message);
  if (renderedMessageCache[scope] && id) {
    renderedMessageCache[scope].set(String(id), message);
  }
}

function getCachedMessage(scope, messageId) {
  return renderedMessageCache[scope]?.get(String(messageId || '')) || null;
}

function createEmptyMessagePaginationState() {
  return {
    conversationId: '',
    messages: [],
    hasMore: false,
    totalCount: 0,
    olderPagesLoaded: false,
    isLoadingOlder: false,
  };
}

function getMessageDateValue(message = {}) {
  return message.date || message.Date || '';
}

function getMessageSortTime(message = {}) {
  const parsed = new Date(getMessageDateValue(message));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function normalizePagedMessageResponse(data) {
  const messages = Array.isArray(data)
    ? data
    : Array.isArray(data?.messages)
      ? data.messages
      : Array.isArray(data?.items)
        ? data.items
        : [];

  return {
    messages,
    hasMore: Boolean(data?.hasMore),
    nextBeforeMessageId: data?.nextBeforeMessageId || getMessageId(messages[0]) || '',
    totalCount: Number(data?.totalCount ?? messages.length),
    returnedCount: Number(data?.returnedCount ?? messages.length),
  };
}

function getMessagePaginationState(scope, conversationId) {
  const state = messagePaginationState[scope] || createEmptyMessagePaginationState();
  const key = String(conversationId || '');
  if (state.conversationId !== key) {
    Object.assign(state, createEmptyMessagePaginationState(), { conversationId: key });
  }
  messagePaginationState[scope] = state;
  return state;
}

function mergeMessagePages(existingMessages = [], incomingMessages = []) {
  const byId = new Map();
  [...existingMessages, ...incomingMessages].forEach((message) => {
    const id = getMessageId(message);
    if (id) {
      byId.set(String(id), message);
    }
  });

  return Array.from(byId.values()).sort((left, right) => {
    const timeDelta = getMessageSortTime(left) - getMessageSortTime(right);
    if (timeDelta !== 0) return timeDelta;
    return String(getMessageId(left)).localeCompare(String(getMessageId(right)));
  });
}

function applyMessagePage(scope, conversationId, pageInfo, mode = 'latest') {
  const state = getMessagePaginationState(scope, conversationId);
  const isOlderPage = mode === 'older';
  const shouldMerge = isOlderPage || state.olderPagesLoaded;

  state.messages = shouldMerge
    ? mergeMessagePages(state.messages, pageInfo.messages)
    : pageInfo.messages;
  state.totalCount = Math.max(pageInfo.totalCount || 0, state.messages.length);

  if (isOlderPage) {
    state.olderPagesLoaded = true;
    state.hasMore = pageInfo.hasMore && state.messages.length < state.totalCount;
  } else if (!state.olderPagesLoaded) {
    state.hasMore = pageInfo.hasMore;
  } else if (state.totalCount > 0 && state.messages.length >= state.totalCount) {
    state.hasMore = false;
  }

  return state;
}

function upsertMessageIntoPaginationState(scope, conversationId, message) {
  const state = getMessagePaginationState(scope, conversationId);
  state.messages = mergeMessagePages(state.messages, [message]);
  state.totalCount = Math.max(state.totalCount || 0, state.messages.length);
  return state;
}

function isScrolledNearBottom(container, threshold = 96) {
  if (!container) return true;
  return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
}

function createLoadOlderMessagesButton({ disabled = false, onClick }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message-pagination-row';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'load-older-messages';
  button.disabled = disabled;
  button.textContent = disabled ? 'Loading older messages...' : 'Load older messages';
  button.addEventListener('click', onClick);

  wrapper.appendChild(button);
  return wrapper;
}

function getMessageVirtualItemKey(scope, item, index) {
  if (item.type === 'loader') {
    return `${scope}:loader`;
  }

  const messageId = getMessageId(item.message);
  return `${scope}:message:${messageId || index}`;
}

function getMessageVirtualItems(scope, state, onLoadOlder) {
  const items = [];
  if (state.hasMore || state.isLoadingOlder) {
    items.push({
      type: 'loader',
      key: `${scope}:loader`,
      disabled: state.isLoadingOlder,
      onClick: onLoadOlder,
    });
  }

  state.messages.forEach((message, index) => {
    const item = { type: 'message', message };
    item.key = getMessageVirtualItemKey(scope, item, index);
    items.push(item);
  });

  return items;
}

function ensureVirtualMessageList(container) {
  let virtual = virtualMessageLists.get(container);
  if (virtual && container.contains(virtual.shell)) {
    return virtual;
  }

  const shell = document.createElement('div');
  shell.className = 'virtual-message-list';

  const topSpacer = document.createElement('div');
  topSpacer.className = 'virtual-message-spacer';

  const windowEl = document.createElement('div');
  windowEl.className = 'virtual-message-window';

  const bottomSpacer = document.createElement('div');
  bottomSpacer.className = 'virtual-message-spacer';

  shell.appendChild(topSpacer);
  shell.appendChild(windowEl);
  shell.appendChild(bottomSpacer);

  container.classList.add('virtual-message-scroll');
  container.replaceChildren(shell);

  virtual = {
    shell,
    topSpacer,
    windowEl,
    bottomSpacer,
    items: [],
    heightCache: new Map(),
    renderFrame: 0,
    measureFrame: 0,
    scope: '',
    state: null,
    onLoadOlder: null,
  };

  container.addEventListener('scroll', () => {
    scheduleVirtualMessageRender(container);
    maybeLoadOlderFromVirtualScroll(container);
  }, { passive: true });

  virtualMessageLists.set(container, virtual);
  return virtual;
}

function resetVirtualMessageList(container) {
  if (!container) return;
  const virtual = virtualMessageLists.get(container);
  if (virtual?.renderFrame) {
    cancelAnimationFrame(virtual.renderFrame);
  }
  if (virtual?.measureFrame) {
    cancelAnimationFrame(virtual.measureFrame);
  }
  virtualMessageLists.delete(container);
  container.classList.remove('virtual-message-scroll');
  container.replaceChildren();
}

function getVirtualItemHeight(virtual, item) {
  return virtual.heightCache.get(item.key) ||
    (item.type === 'loader' ? messageVirtualLoaderHeight : messageVirtualDefaultItemHeight);
}

function getVirtualLayout(items, virtual) {
  let totalHeight = 0;
  const offsets = items.map((item) => {
    const offset = totalHeight;
    totalHeight += getVirtualItemHeight(virtual, item);
    return offset;
  });

  return { offsets, totalHeight };
}

function getVirtualRange(container, virtual, offsets, totalHeight) {
  if (!virtual.items.length) {
    return { startIndex: 0, endIndex: 0, topHeight: 0, bottomHeight: 0 };
  }

  const viewportHeight = container.clientHeight || 800;
  const startBoundary = Math.max(0, container.scrollTop - messageVirtualOverscanPx);
  const endBoundary = container.scrollTop + viewportHeight + messageVirtualOverscanPx;
  let startIndex = 0;

  while (
    startIndex < virtual.items.length &&
    offsets[startIndex] + getVirtualItemHeight(virtual, virtual.items[startIndex]) < startBoundary
  ) {
    startIndex += 1;
  }

  let endIndex = startIndex;
  while (endIndex < virtual.items.length && offsets[endIndex] <= endBoundary) {
    endIndex += 1;
  }

  endIndex = Math.min(virtual.items.length, Math.max(endIndex, startIndex + 1));
  const topHeight = offsets[startIndex] || 0;
  const renderedHeight = virtual.items
    .slice(startIndex, endIndex)
    .reduce((total, item) => total + getVirtualItemHeight(virtual, item), 0);
  const bottomHeight = Math.max(0, totalHeight - topHeight - renderedHeight);

  return { startIndex, endIndex, topHeight, bottomHeight };
}

function renderVirtualMessageItem(item, scope, state) {
  if (item.type === 'loader') {
    return createLoadOlderMessagesButton({
      disabled: item.disabled,
      onClick: item.onClick,
    });
  }

  const element = renderCompactMessage(item.message, scope);
  const deliveryState = item.message?.deliveryState || item.message?.DeliveryState || '';
  if (deliveryState === 'failed' && typeof item.message.retryHandler === 'function') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'message-retry-btn';
    retry.textContent = 'Retry';
    retry.addEventListener('click', item.message.retryHandler);
    element.appendChild(retry);
  }

  if (state?.messages?.includes(item.message)) {
    element.dataset.virtualized = 'true';
  }

  return element;
}

function scheduleVirtualMessageRender(container) {
  const virtual = virtualMessageLists.get(container);
  if (!virtual || virtual.renderFrame) return;

  virtual.renderFrame = requestAnimationFrame(() => {
    virtual.renderFrame = 0;
    renderVirtualMessageWindow(container);
  });
}

function scheduleVirtualMessageMeasurement(container) {
  const virtual = virtualMessageLists.get(container);
  if (!virtual || virtual.measureFrame) return;

  virtual.measureFrame = requestAnimationFrame(() => {
    virtual.measureFrame = 0;
    measureVirtualMessageWindow(container);
  });
}

function getMeasuredElementHeight(element) {
  const style = window.getComputedStyle(element);
  const marginTop = parseFloat(style.marginTop) || 0;
  const marginBottom = parseFloat(style.marginBottom) || 0;
  return element.getBoundingClientRect().height + marginTop + marginBottom;
}

function measureVirtualMessageWindow(container) {
  const virtual = virtualMessageLists.get(container);
  if (!virtual) return;

  let changed = false;
  virtual.windowEl.querySelectorAll('[data-virtual-item-key]').forEach((element) => {
    const key = element.dataset.virtualItemKey;
    const nextHeight = Math.ceil(getMeasuredElementHeight(element));
    if (!key || nextHeight <= 0) return;

    const previousHeight = virtual.heightCache.get(key);
    if (!previousHeight || Math.abs(previousHeight - nextHeight) > 1) {
      virtual.heightCache.set(key, nextHeight);
      changed = true;
    }
  });

  if (changed) {
    scheduleVirtualMessageRender(container);
  }
}

function attachVirtualMediaMeasurementHandlers(container, element) {
  element.querySelectorAll('img, video, audio').forEach((media) => {
    const eventName = media.tagName === 'IMG' ? 'load' : 'loadedmetadata';
    media.addEventListener(eventName, () => scheduleVirtualMessageMeasurement(container), { once: true });
    media.addEventListener('error', () => scheduleVirtualMessageMeasurement(container), { once: true });
  });
}

function renderVirtualMessageWindow(container) {
  const virtual = virtualMessageLists.get(container);
  if (!virtual) return;

  const { offsets, totalHeight } = getVirtualLayout(virtual.items, virtual);
  const { startIndex, endIndex, topHeight, bottomHeight } =
    getVirtualRange(container, virtual, offsets, totalHeight);
  const fragment = document.createDocumentFragment();

  virtual.items.slice(startIndex, endIndex).forEach((item) => {
    const element = renderVirtualMessageItem(item, virtual.scope, virtual.state);
    element.dataset.virtualItemKey = item.key;
    attachVirtualMediaMeasurementHandlers(container, element);
    fragment.appendChild(element);
  });

  virtual.topSpacer.style.height = `${Math.round(topHeight)}px`;
  virtual.bottomSpacer.style.height = `${Math.round(bottomHeight)}px`;
  virtual.windowEl.replaceChildren(fragment);
  scheduleVirtualMessageMeasurement(container);
}

function maybeLoadOlderFromVirtualScroll(container) {
  const virtual = virtualMessageLists.get(container);
  const state = virtual?.state;
  if (!virtual?.onLoadOlder || !state?.hasMore || state.isLoadingOlder || !state.messages.length) {
    return;
  }

  if (container.scrollTop <= messageVirtualAutoLoadThresholdPx) {
    virtual.onLoadOlder();
  }
}

function renderPaginatedMessages(container, scope, state, onLoadOlder) {
  if (!container) return;
  if (!state?.messages?.length && !state?.hasMore && !state?.isLoadingOlder) {
    resetVirtualMessageList(container);
    container.replaceChildren(createEmptyState({
      ...getMessageEmptyStateCopy(scope),
      className: 'message-empty-state',
    }));
    return;
  }

  const virtual = ensureVirtualMessageList(container);
  virtual.scope = scope;
  virtual.state = state;
  virtual.onLoadOlder = onLoadOlder;
  virtual.items = getMessageVirtualItems(scope, state, onLoadOlder);

  const activeKeys = new Set(virtual.items.map((item) => item.key));
  Array.from(virtual.heightCache.keys()).forEach((key) => {
    if (!activeKeys.has(key)) {
      virtual.heightCache.delete(key);
    }
  });

  renderVirtualMessageWindow(container);
}

function scrollMessageListToBottom(container) {
  if (!container) return;

  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
    renderVirtualMessageWindow(container);

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
      renderVirtualMessageWindow(container);
    });
  });
}

function removeMessageFromPaginationState(scope, conversationId, messageId) {
  const state = getMessagePaginationState(scope, conversationId);
  const normalizedMessageId = String(messageId || '');
  state.messages = state.messages.filter((message) => String(getMessageId(message)) !== normalizedMessageId);
  return state;
}

function getMessageContainerForScope(scope) {
  if (scope === 'server') {
    return chatMessages || document.querySelector('.chatMessages');
  }

  if (scope === 'dm' || scope === 'group') {
    return document.querySelector('.messagesDisplay');
  }

  return null;
}

function getLoadOlderHandlerForScope(scope, conversationId) {
  if (scope === 'server') {
    return () => fetchServerMessages({ appendOlder: true });
  }

  if (scope === 'dm') {
    return () => GetPrivateMessage({ appendOlder: true });
  }

  if (scope === 'group') {
    return () => GetGroupMessages(conversationId, { appendOlder: true });
  }

  return null;
}

function renderMessageStateForScope(scope, conversationId, { stickToBottom = false } = {}) {
  const container = getMessageContainerForScope(scope);
  if (!container) return null;

  const state = getMessagePaginationState(scope, conversationId);
  renderPaginatedMessages(container, scope, state, getLoadOlderHandlerForScope(scope, conversationId));
  if (stickToBottom) {
    scrollMessageListToBottom(container);
  }

  return state;
}

function buildReplyPreviewFromMessage(message = {}) {
  return {
    messageId: getMessageId(message),
    sender: getMessageSender(message),
    text: getMessageText(message),
    attachmentUrl: getMessageAttachmentUrl(message),
    attachmentContentType: getMessageAttachmentContentType(message),
    date: message.date || message.Date || '',
  };
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
    settingsModalReturnFocusElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    modal.setAttribute('aria-hidden', 'false');
    showElement(modal, 'flex');
    refreshSettingsModal();
    focusSettingsModal();
  }
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.setAttribute('aria-hidden', 'true');
    hideElement(modal);
  }
  const searchInput = document.getElementById('settingsSearchInput');
  if (searchInput) {
    searchInput.value = '';
    filterSettingsSidebarItems('');
  }
  if (settingsModalReturnFocusElement?.isConnected) {
    settingsModalReturnFocusElement.focus();
  }
  settingsModalReturnFocusElement = null;
}

function getFocusableElements(container) {
  if (!container) return [];
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(container.querySelectorAll(selector)).filter((element) => {
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      element.getClientRects().length > 0
    );
  });
}

function focusSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (!isElementVisible(modal)) return;

  window.requestAnimationFrame(() => {
    const searchInput = document.getElementById('settingsSearchInput');
    const activeNavItem = modal.querySelector('.settings-item.active');
    const closeButton = modal.querySelector('.settings-close-btn');
    const target = searchInput || activeNavItem || closeButton;
    target?.focus?.();
  });
}

function trapSettingsModalFocus(event) {
  const modal = document.getElementById('settingsModal');
  if (event.key !== 'Tab' || !isElementVisible(modal)) return;

  const focusable = getFocusableElements(modal);
  if (!focusable.length) {
    event.preventDefault();
    modal.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openSecondModal() {
  closeModal();
  selectServerTemplate(selectedServerTemplateId || 'friends');
  showElement('.outerSecondModal', 'flex');
}
function closeSecondModal() {
  hideElement('.outerSecondModal');
}
function BackToFirstModal() {
  closeSecondModal();
  openModal();
}
function getSelectedServerTemplateLabel() {
  const selectedTemplateButton = document.querySelector(
    `.server-template-option[data-template-id="${escapeCssIdentifier(selectedServerTemplateId)}"]`
  );
  return selectedTemplateButton?.querySelector('strong')?.textContent?.trim() || 'Friends';
}

function updateSelectedServerTemplateCopy() {
  const copy = document.getElementById('selectedServerTemplateName');
  if (copy) {
    copy.textContent = `${getSelectedServerTemplateLabel()} template`;
  }
}

function selectServerTemplate(templateId = 'friends') {
  selectedServerTemplateId = templateId || 'friends';
  document.querySelectorAll('.server-template-option').forEach((button) => {
    const isSelected = button.dataset.templateId === selectedServerTemplateId;
    button.classList.toggle('active', isSelected);
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });
  updateSelectedServerTemplateCopy();
}

function OpenCreationModal(templateId = selectedServerTemplateId) {
  selectServerTemplate(templateId || 'friends');
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
  applyRoleColorStyle(roleBadge, normalizedRole);
  roleBadge.textContent = normalizedRole.slice(0, 1).toUpperCase();
  roleBadge.title = formatRoleName(normalizedRole);
  return roleBadge;
}

function createServerIconElement(serverName = '', iconUrl = '', className = 'server-icon') {
  const icon = document.createElement('span');
  icon.className = className;
  if (iconUrl) {
    const image = document.createElement('img');
    image.src = resolveMediaUrl(iconUrl);
    image.alt = '';
    image.loading = 'lazy';
    icon.appendChild(image);
  } else {
    icon.textContent = getServerInitials(serverName);
  }
  return icon;
}

function renderCurrentServerHeader(role = currentServerRole) {
  const serverTitle = document.querySelector('.currentServerName');
  if (!serverTitle) return;

  serverTitle.innerHTML = '';
  const banner = document.createElement('span');
  banner.className = 'current-server-banner';
  if (currentServerBannerUrl) {
    banner.style.backgroundImage = `linear-gradient(180deg, rgba(0, 0, 0, 0.1), rgba(43, 45, 49, 0.7)), url("${cssString(resolveMediaUrl(currentServerBannerUrl))}")`;
  }

  const body = document.createElement('span');
  body.className = 'current-server-header-body';
  const icon = createServerIconElement(currentServerName, currentServerIconUrl, 'current-server-icon');
  const copy = document.createElement('span');
  copy.className = 'current-server-copy';
  const name = document.createElement('span');
  name.className = 'current-server-title-text';
  name.textContent = currentServerName || 'Server';
  const roleText = document.createElement('span');
  roleText.className = 'current-server-role-text';
  roleText.textContent = formatRoleName(role);

  copy.appendChild(name);
  copy.appendChild(roleText);
  body.appendChild(icon);
  body.appendChild(copy);
  serverTitle.appendChild(banner);
  serverTitle.appendChild(body);
  serverTitle.title = `${currentServerName || 'Server'} (${formatRoleName(role)})`;
}

async function openServer(server, fallbackRole = 'user') {
  clearReplyDraft();
  const role = server.role || fallbackRole || 'user';

  selectedServerID = server.serverID;
  currentServerName = server.serverName;
  currentServerRole = role;
  currentServerRoles = [];
  currentServerMembers = [];
  applyServerRuleState(server);
  applyServerListingState(server);
  applyServerAppearanceState(server);
  applyServerWelcomeState(server);

  hideElement('.secondColumn');
  hideElement('.lastSection');
  showElement('#serverDetails', 'flex');

  renderCurrentServerHeader(role);

  resetVirtualMessageList(chatMessages);

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

  newServerElement.appendChild(
    createServerIconElement(server.serverName, getServerVisualUrl(server, 'icon'), 'server-name server-list-icon')
  );
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
    TemplateId: selectedServerTemplateId || 'friends',
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

function resolveMediaUrl(url = '') {
  const value = String(url || '').trim();
  if (!value) return '';

  if (/^(data|blob|file):/i.test(value)) {
    return value;
  }

  if (mediaUrlCache.has(value)) {
    return mediaUrlCache.get(value);
  }

  let resolvedUrl = value;
  try {
    const parsed = new URL(value, homeApiBase);
    const isUpload = parsed.pathname.startsWith('/uploads/');
    if (isUpload) {
      const uploadPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      const base = homeCdnBase || parsed.origin || homeApiBase;
      resolvedUrl = `${base}${uploadPath}`;
    }
  } catch {
    if (value.startsWith('/uploads/')) {
      resolvedUrl = `${homeCdnBase || homeApiBase}${value}`;
    }
  }

  mediaUrlCache.set(value, resolvedUrl);
  if (mediaUrlCache.size > mediaUrlCacheMaxEntries) {
    mediaUrlCache.delete(mediaUrlCache.keys().next().value);
  }

  return resolvedUrl;
}

function getUploadUrlFromResponse(data = {}) {
  const rawUrl = data.url || data.Url || data.path || data.Path || data.cdnUrl || data.CdnUrl || '';
  const value = String(rawUrl || '').trim();
  if (!value) return '';

  try {
    const parsed = new URL(value, homeApiBase);
    if (parsed.pathname.startsWith('/uploads/')) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return value;
  }

  return value;
}

function getUploadDisplayUrl(data = {}) {
  const uploadUrl = getUploadUrlFromResponse(data);
  return resolveMediaUrl(uploadUrl || data.cdnUrl || data.CdnUrl || '');
}

function isAllowedExpressionImageUrl(url = '') {
  const value = String(url || '').trim();
  if (value.startsWith('/uploads/')) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isStickerContentType(contentType = '') {
  return String(contentType || '').toLowerCase().includes('sticker');
}

function normalizeExpressionName(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

function createCustomEmojiNode(name, imageUrl) {
  const image = document.createElement('img');
  image.className = 'message-custom-emoji';
  image.src = resolveMediaUrl(imageUrl);
  image.alt = `:${name}:`;
  image.title = `:${name}:`;
  image.loading = 'lazy';
  return image;
}

function createStickerImageNode({ name = 'Sticker', url = '' } = {}, extraClass = '') {
  const wrapper = document.createElement('div');
  wrapper.className = `message-sticker ${extraClass}`.trim();
  const image = document.createElement('img');
  image.src = resolveMediaUrl(url);
  image.alt = name;
  image.title = name;
  image.loading = 'lazy';
  wrapper.appendChild(image);
  return wrapper;
}

function getBuiltInSticker(stickerId = '') {
  const stickers = typeof stickerList !== 'undefined' && Array.isArray(stickerList) ? stickerList : [];
  return stickers.find((item) => item.id === stickerId) || null;
}

function buildMessageAttachmentNode(attachmentUrl, contentType = '') {
  if (!attachmentUrl) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'message-attachment';
  const resolvedUrl = resolveMediaUrl(attachmentUrl);

  const normalizedType = String(contentType || '').toLowerCase();
  if (isStickerContentType(normalizedType)) {
    wrapper.classList.add('message-sticker-attachment');
    wrapper.appendChild(createStickerImageNode({ name: 'Sticker', url: attachmentUrl }, 'large'));
    return wrapper;
  }

  const isImage =
    normalizedType.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp)$/i.test(attachmentUrl);
  const isVideo =
    normalizedType.startsWith('video/') ||
    /\.(mp4|webm|mov)$/i.test(attachmentUrl);
  const isAudio =
    normalizedType.startsWith('audio/') ||
    /\.(mp3|wav|ogg|m4a)$/i.test(attachmentUrl);

  if (isImage) {
    const image = document.createElement('img');
    image.src = resolvedUrl;
    image.alt = 'Attachment preview';
    image.loading = 'lazy';
    wrapper.appendChild(image);
    return wrapper;
  }

  if (isVideo) {
    const video = document.createElement('video');
    video.src = resolvedUrl;
    video.controls = true;
    video.preload = 'metadata';
    wrapper.appendChild(video);
    return wrapper;
  }

  if (isAudio) {
    const audio = document.createElement('audio');
    audio.src = resolvedUrl;
    audio.controls = true;
    audio.preload = 'metadata';
    wrapper.appendChild(audio);
    return wrapper;
  }

  const link = document.createElement('a');
  link.href = resolvedUrl;
  link.target = '_blank';
  link.rel = 'noreferrer';
  const fileName = decodeURIComponent(String(attachmentUrl).split('/').pop()?.split(/[?#]/)[0] || 'attachment');
  link.innerHTML = `<span class="message-attachment-name"></span><span class="message-attachment-meta"></span>`;
  link.querySelector('.message-attachment-name').textContent = fileName;
  link.querySelector('.message-attachment-meta').textContent = normalizedType || 'file';
  wrapper.appendChild(link);
  return wrapper;
}

const linkPreviewCache = new Map();
const linkUrlRegex = /(https?:\/\/[^\s<>"']+)/gi;

function normalizeUrlForPreview(url) {
  return String(url || '').replace(/[),.;!?]+$/, '');
}

function extractMessageUrls(text = '') {
  const scrubbedText = String(text || '')
    .replace(/<:([a-z0-9_]{2,32}):([^>\s]+)>/gi, '')
    .replace(/\[\[sticker:([a-z0-9_-]{1,48})\]\]/gi, '');
  return Array.from(new Set(
    (scrubbedText.match(linkUrlRegex) || [])
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

const richMessageTokenRegex = /<:([a-z0-9_]{2,32}):([^>\s]+)>|\[\[sticker:([a-z0-9_-]{1,48})\]\]|(https?:\/\/[^\s<>"']+)/gi;

function appendMessageTextWithLinks(container, text = '') {
  const value = String(text || '');
  let cursor = 0;

  richMessageTokenRegex.lastIndex = 0;
  value.replace(richMessageTokenRegex, (...args) => {
    const [match, emojiName, emojiUrl, stickerId, matchedUrl] = args;
    const offset = args[args.length - 2];
    const end = offset + match.length;
    if (offset > cursor) {
      appendPlainMessageTextWithMentions(container, value.slice(cursor, offset));
    }

    if (emojiName && emojiUrl && isAllowedExpressionImageUrl(emojiUrl)) {
      container.appendChild(createCustomEmojiNode(emojiName, emojiUrl));
      cursor = end;
      return match;
    }

    if (stickerId) {
      const sticker = getBuiltInSticker(stickerId);
      if (sticker) {
        container.appendChild(createStickerImageNode(sticker, 'inline'));
        cursor = end;
      }
      return match;
    }

    if (matchedUrl) {
      const url = normalizeUrlForPreview(matchedUrl);
      const link = document.createElement('a');
      link.className = 'message-link';
      link.href = url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = url;
      container.appendChild(link);
      cursor = end;
    }
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
  const previewType = preview.type || preview.Type || 'article';
  const mediaUrl = preview.mediaUrl || preview.MediaUrl || '';
  const mediaContentType = preview.mediaContentType || preview.MediaContentType || '';
  const accentColor = preview.accentColor || preview.AccentColor || '';
  const iconUrl = preview.icon || preview.Icon || '';
  card.className = `link-preview-card link-preview-${previewType}`;
  card.href = preview.url;
  card.target = '_blank';
  card.rel = 'noreferrer';
  if (/^#[0-9a-f]{6}$/i.test(accentColor)) {
    card.style.setProperty('--embed-accent', accentColor);
  }

  const content = document.createElement('div');
  content.className = 'link-preview-content';

  const site = document.createElement('div');
  site.className = 'link-preview-site';
  if (iconUrl) {
    const icon = document.createElement('img');
    icon.src = iconUrl;
    icon.alt = '';
    icon.loading = 'lazy';
    site.appendChild(icon);
  }
  const siteText = document.createElement('span');
  try {
    siteText.textContent = preview.siteName || new URL(preview.url).hostname;
  } catch {
    siteText.textContent = preview.siteName || preview.url;
  }
  site.appendChild(siteText);
  content.appendChild(site);

  const typeBadge = document.createElement('span');
  typeBadge.className = 'link-preview-type';
  typeBadge.textContent = previewType;
  site.appendChild(typeBadge);

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

  if (previewType === 'video' && mediaUrl) {
    const video = document.createElement('video');
    video.className = 'link-preview-media';
    video.src = mediaUrl;
    video.controls = true;
    video.preload = 'metadata';
    if (preview.image) video.poster = preview.image;
    video.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    card.appendChild(video);
  } else if (previewType === 'audio' && mediaUrl) {
    const audio = document.createElement('audio');
    audio.className = 'link-preview-audio';
    audio.src = mediaUrl;
    audio.controls = true;
    audio.preload = 'metadata';
    audio.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    content.appendChild(audio);
  } else if (preview.image) {
    const image = document.createElement('img');
    image.className = 'link-preview-image';
    image.src = preview.image;
    image.alt = '';
    image.loading = 'lazy';
    card.appendChild(image);
  } else if (mediaUrl && mediaContentType.startsWith('image/')) {
    const image = document.createElement('img');
    image.className = 'link-preview-image';
    image.src = mediaUrl;
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

function buildMessagePollNode(poll, messageId, scope) {
  if (!poll || !getPollId(poll)) {
    return null;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'message-poll';
  wrapper.dataset.pollId = getPollId(poll);

  const header = document.createElement('div');
  header.className = 'message-poll-header';

  const question = document.createElement('div');
  question.className = 'message-poll-question';
  question.textContent = getPollQuestion(poll);

  const meta = document.createElement('div');
  meta.className = 'message-poll-meta';
  const totalVotes = getPollTotalVotes(poll);
  const isClosed = isPollClosed(poll);
  meta.textContent = `${isPollMultipleChoice(poll) ? 'Multiple choice' : 'Choose one'} · ${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}${isClosed ? ' · Closed' : ''}`;

  header.appendChild(question);
  header.appendChild(meta);
  wrapper.appendChild(header);

  const selectedIds = getPollSelectedOptionIds(poll);
  getPollOptions(poll).forEach((option) => {
    const optionId = String(getPollOptionId(option));
    const voteCount = getPollOptionVoteCount(option);
    const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'message-poll-option';
    button.classList.toggle('selected', selectedIds.includes(optionId));
    button.disabled = isClosed;
    button.addEventListener('click', () => voteOnPoll(poll, optionId, scope));

    const bar = document.createElement('span');
    bar.className = 'message-poll-option-bar';
    bar.style.width = `${percent}%`;

    const label = document.createElement('span');
    label.className = 'message-poll-option-label';
    label.textContent = getPollOptionText(option);

    const count = document.createElement('span');
    count.className = 'message-poll-option-count';
    count.textContent = `${percent}%`;

    button.appendChild(bar);
    button.appendChild(label);
    button.appendChild(count);
    wrapper.appendChild(button);
  });

  return wrapper;
}

async function voteOnPoll(poll, optionId, scope) {
  const pollId = getPollId(poll);
  if (!pollId || !optionId || isPollClosed(poll)) {
    return;
  }

  const selectedIds = getPollSelectedOptionIds(poll);
  let nextOptionIds = [optionId];
  if (isPollMultipleChoice(poll)) {
    nextOptionIds = selectedIds.includes(String(optionId))
      ? selectedIds.filter((id) => id !== String(optionId))
      : [...selectedIds, String(optionId)];
    if (nextOptionIds.length === 0) {
      nextOptionIds = [optionId];
    }
  }

  try {
    await apiClient.post(`${homeApiBase}/api/Polls/Vote`, {
      PollId: pollId,
      OptionIds: nextOptionIds,
    });
    await refreshActiveMessagesForScope(scope);
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not vote in poll.'), 'error');
  }
}

async function refreshActiveMessagesForScope(scope) {
  if (scope === 'server') {
    await fetchServerMessages();
  } else if (scope === 'group' && currentGroupId) {
    await GetGroupMessages(currentGroupId);
  } else if (scope === 'dm' && currentFriend) {
    await GetPrivateMessage();
  }
}

function getMessageThread(message = {}) {
  return message.thread || message.Thread || null;
}

function getThreadId(thread = {}) {
  thread = thread || {};
  return thread.threadId || thread.ThreadId || thread.id || thread.Id || '';
}

function getThreadName(thread = {}) {
  thread = thread || {};
  return thread.name || thread.Name || 'Thread';
}

function getThreadMessageCount(thread = {}, fallback = 0) {
  thread = thread || {};
  return Number(thread.messageCount ?? thread.MessageCount ?? fallback ?? 0);
}

function getMessageThreadCount(message = {}) {
  const thread = getMessageThread(message);
  return Number(
    message.threadMessageCount ??
    message.ThreadMessageCount ??
    (thread ? getThreadMessageCount(thread) : 0)
  );
}

function getMessageIsPinned(message = {}) {
  return Boolean(message.isPinned ?? message.IsPinned);
}

function getParentPreview(thread = {}) {
  thread = thread || {};
  return thread.parentPreview || thread.ParentPreview || null;
}

function getThreadPreviewText(thread = {}) {
  const parent = getParentPreview(thread);
  const text = parent?.userText || parent?.UserText || parent?.content || parent?.Content || '';
  const sender = parent?.messagesUserSender || parent?.MessagesUserSender || '';
  if (!text && !sender) return '';
  return sender ? `${sender}: ${text}` : text;
}

function isSelectedTextChannel() {
  return currentServerChannels.some((channel) => (
    channel.id === selectedChannelID && channel.type === 'text'
  ));
}

function setServerChatHeaderTitle(title) {
  const header = document.querySelector('.chatHeader');
  if (!header) return;

  header.innerHTML = '';

  const titleEl = document.createElement('span');
  titleEl.className = 'chat-header-title';
  titleEl.textContent = title;
  header.appendChild(titleEl);

  if (!isSelectedTextChannel()) {
    return;
  }

  const actions = document.createElement('span');
  actions.className = 'chat-header-actions';

  const threadsButton = document.createElement('button');
  threadsButton.type = 'button';
  threadsButton.className = 'server-header-tool';
  threadsButton.textContent = 'Threads';
  threadsButton.title = 'View channel threads';
  threadsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openChannelThreadsPanel();
  });

  const pinsButton = document.createElement('button');
  pinsButton.type = 'button';
  pinsButton.className = 'server-header-tool';
  pinsButton.textContent = 'Pins';
  pinsButton.title = 'View pinned messages';
  pinsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openPinnedMessagesPanel();
  });

  actions.appendChild(threadsButton);
  actions.appendChild(pinsButton);
  header.appendChild(actions);
}

function ensureServerThreadPanel() {
  let panel = document.getElementById('serverThreadPanel');
  if (panel) {
    return panel;
  }

  panel = document.createElement('aside');
  panel.id = 'serverThreadPanel';
  panel.className = 'server-side-panel server-thread-panel is-hidden';

  const header = document.createElement('div');
  header.className = 'server-side-panel-header';

  const titleBlock = document.createElement('div');
  titleBlock.className = 'server-side-panel-title';
  const title = document.createElement('h3');
  title.id = 'serverThreadTitle';
  title.textContent = 'Thread';
  const meta = document.createElement('p');
  meta.id = 'serverThreadMeta';
  meta.textContent = '';
  titleBlock.appendChild(title);
  titleBlock.appendChild(meta);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'server-side-panel-close';
  closeButton.textContent = 'x';
  closeButton.title = 'Close';
  closeButton.addEventListener('click', closeServerThreadPanel);

  header.appendChild(titleBlock);
  header.appendChild(closeButton);

  const parent = document.createElement('div');
  parent.id = 'serverThreadParent';
  parent.className = 'server-thread-parent is-hidden';

  const messages = document.createElement('div');
  messages.id = 'serverThreadMessages';
  messages.className = 'server-thread-messages';

  const form = document.createElement('form');
  form.id = 'serverThreadForm';
  form.className = 'server-thread-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'threadMessage';
  input.className = 'server-thread-input';
  input.placeholder = 'Reply in thread';
  input.autocomplete = 'off';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'server-thread-send';
  submit.textContent = 'Send';
  form.appendChild(input);
  form.appendChild(submit);
  form.addEventListener('submit', sendServerThreadMessage);

  panel.appendChild(header);
  panel.appendChild(parent);
  panel.appendChild(messages);
  panel.appendChild(form);

  document.querySelector('.chatSection')?.appendChild(panel);
  return panel;
}

function closeServerThreadPanel() {
  currentServerThreadId = null;
  currentServerThread = null;
  hideElement('#serverThreadPanel');
}

function setThreadPanelMode({ title, meta = '', parentText = '', showForm = false } = {}) {
  const panel = ensureServerThreadPanel();
  document.getElementById('serverThreadTitle').textContent = title || 'Thread';
  document.getElementById('serverThreadMeta').textContent = meta;

  const parent = document.getElementById('serverThreadParent');
  parent.textContent = parentText;
  setElementVisible(parent, Boolean(parentText), 'block');
  setElementVisible(document.getElementById('serverThreadForm'), showForm, 'flex');

  showElement(panel, 'flex');
  return panel;
}

async function openChannelThreadsPanel() {
  if (!selectedChannelID || !isSelectedTextChannel()) {
    return;
  }

  currentServerThreadId = null;
  currentServerThread = null;
  setThreadPanelMode({
    title: 'Threads',
    meta: getSelectedChannelNotificationName(),
    showForm: false,
  });

  const list = document.getElementById('serverThreadMessages');
  list.innerHTML = '<div class="server-side-empty">Loading threads...</div>';

  try {
    const response = await axios.get(
      `${homeApiBase}/api/ServerMessages/GetThreadsForChannel?channelId=${encodeURIComponent(selectedChannelID)}`
    );
    const threads = Array.isArray(response.data) ? response.data : [];
    list.innerHTML = '';
    if (threads.length === 0) {
      list.innerHTML = '<div class="server-side-empty">No threads yet.</div>';
      return;
    }

    threads.forEach((thread) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'server-thread-list-item';
      const title = document.createElement('strong');
      title.textContent = getThreadName(thread);
      const count = document.createElement('span');
      count.textContent = `${getThreadMessageCount(thread)} messages`;
      const previewText = getThreadPreviewText(thread);
      if (previewText) {
        const preview = document.createElement('span');
        preview.className = 'server-thread-preview';
        preview.textContent = previewText;
        item.appendChild(preview);
      }
      item.prepend(title, count);
      item.addEventListener('click', () => openServerThread(thread));
      list.appendChild(item);
    });
  } catch (error) {
    list.innerHTML = '<div class="server-side-empty">Could not load threads.</div>';
    showAppMessage(getApiErrorMessage(error, 'Could not load threads.'), 'error');
  }
}

async function openServerThread(threadOrId) {
  let thread = typeof threadOrId === 'string' ? null : threadOrId;
  let threadId = typeof threadOrId === 'string' ? threadOrId : getThreadId(threadOrId);
  if (!threadId) return;

  setThreadPanelMode({
    title: thread ? getThreadName(thread) : 'Thread',
    meta: 'Loading...',
    showForm: true,
  });

  try {
    if (!thread) {
      const response = await axios.get(
        `${homeApiBase}/api/ServerMessages/GetThread?threadId=${encodeURIComponent(threadId)}`
      );
      thread = response.data;
      threadId = getThreadId(thread);
    }

    currentServerThread = thread;
    currentServerThreadId = threadId;
    setThreadPanelMode({
      title: getThreadName(thread),
      meta: `${getThreadMessageCount(thread)} messages`,
      parentText: getThreadPreviewText(thread),
      showForm: true,
    });
    await fetchServerThreadMessages();
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not open thread.'), 'error');
  }
}

async function openThreadFromMessage(message) {
  const existingThread = getMessageThread(message);
  const existingThreadId = getThreadId(existingThread);
  if (existingThreadId) {
    await openServerThread(existingThread);
    return;
  }

  const messageId = getMessageId(message);
  if (!messageId) return;

  const defaultName = (getMessageText(message) || `Thread from ${getMessageSender(message)}`)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const name = await askText('Create Thread', 'Thread name', defaultName || 'New thread');
  if (!name) return;

  try {
    const response = await axios.post(`${homeApiBase}/api/ServerMessages/CreateThread`, {
      parentMessageId: messageId,
      name,
    });
    showAppMessage('Thread created.', 'success');
    await fetchServerMessages();
    await openServerThread(response.data);
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not create thread.'), 'error');
  }
}

async function fetchServerThreadMessages() {
  if (!currentServerThreadId) return;

  const list = document.getElementById('serverThreadMessages');
  list.innerHTML = '<div class="server-side-empty">Loading messages...</div>';

  try {
    const response = await axios.get(
      `${homeApiBase}/api/ServerMessages/GetThreadMessages?threadId=${encodeURIComponent(currentServerThreadId)}`
    );
    const messages = Array.isArray(response.data) ? response.data : [];
    list.innerHTML = '';
    if (messages.length === 0) {
      list.innerHTML = '<div class="server-side-empty">No replies yet.</div>';
      return;
    }

    messages.forEach((message) => {
      list.appendChild(renderCompactMessage(message, 'thread'));
    });
    list.scrollTop = list.scrollHeight;
  } catch (error) {
    list.innerHTML = '<div class="server-side-empty">Could not load replies.</div>';
    showAppMessage(getApiErrorMessage(error, 'Could not load thread replies.'), 'error');
  }
}

async function sendServerThreadMessage(event) {
  event.preventDefault();
  if (!currentServerThreadId) return;

  const form = event.target;
  const input = form.querySelector('.server-thread-input');
  const text = String(input?.value || '').trim();
  if (!text) return;

  if (input) input.value = '';
  const list = document.getElementById('serverThreadMessages');
  const draftId = generateUUID();
  const pending = renderCompactMessage({
    threadMessageId: draftId,
    messagesUserSender: JWTusername,
    userText: text,
    date: new Date().toISOString(),
  }, 'thread');
  pending.classList.add('message-pending');
  list.querySelector('.server-side-empty')?.remove();
  list.appendChild(pending);
  list.scrollTop = list.scrollHeight;

  try {
    await axios.post(`${homeApiBase}/api/ServerMessages/SendThreadMessage`, {
      threadMessageId: draftId,
      threadId: currentServerThreadId,
      userText: text,
    });
    await fetchServerThreadMessages();
    await fetchServerMessages();
  } catch (error) {
    pending.classList.remove('message-pending');
    pending.classList.add('message-failed');
    if (input) input.value = text;
    showAppMessage(getApiErrorMessage(error, 'Thread reply failed to send.'), 'error');
  }
}

function ensurePinnedMessagesPanel() {
  let panel = document.getElementById('serverPinnedMessagesPanel');
  if (panel) {
    return panel;
  }

  panel = document.createElement('aside');
  panel.id = 'serverPinnedMessagesPanel';
  panel.className = 'server-side-panel server-pinned-panel is-hidden';

  const header = document.createElement('div');
  header.className = 'server-side-panel-header';
  const titleBlock = document.createElement('div');
  titleBlock.className = 'server-side-panel-title';
  const title = document.createElement('h3');
  title.textContent = 'Pinned Messages';
  const meta = document.createElement('p');
  meta.id = 'serverPinnedMeta';
  meta.textContent = '';
  titleBlock.appendChild(title);
  titleBlock.appendChild(meta);
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'server-side-panel-close';
  closeButton.textContent = 'x';
  closeButton.title = 'Close';
  closeButton.addEventListener('click', () => hideElement(panel));
  header.appendChild(titleBlock);
  header.appendChild(closeButton);

  const list = document.createElement('div');
  list.id = 'serverPinnedMessagesList';
  list.className = 'server-pinned-list';
  panel.appendChild(header);
  panel.appendChild(list);

  document.querySelector('.chatSection')?.appendChild(panel);
  return panel;
}

async function openPinnedMessagesPanel() {
  if (!selectedChannelID || !isSelectedTextChannel()) {
    return;
  }

  const panel = ensurePinnedMessagesPanel();
  showElement(panel, 'flex');
  await fetchPinnedMessages();
}

async function fetchPinnedMessages() {
  if (!selectedChannelID || pinnedMessagesRefreshInFlight) return;

  const list = document.getElementById('serverPinnedMessagesList');
  const meta = document.getElementById('serverPinnedMeta');
  if (!list) return;

  pinnedMessagesRefreshInFlight = true;
  list.innerHTML = '<div class="server-side-empty">Loading pinned messages...</div>';
  if (meta) meta.textContent = getSelectedChannelNotificationName();

  try {
    const response = await axios.get(
      `${homeApiBase}/api/ServerMessages/GetPinnedMessages?channelId=${encodeURIComponent(selectedChannelID)}`
    );
    const messages = Array.isArray(response.data) ? response.data : [];
    list.innerHTML = '';
    if (meta) meta.textContent = `${messages.length} pinned`;
    if (messages.length === 0) {
      list.innerHTML = '<div class="server-side-empty">No pinned messages.</div>';
      return;
    }

    messages.forEach((message) => {
      list.appendChild(renderCompactMessage(message, 'server'));
    });
  } catch (error) {
    list.innerHTML = '<div class="server-side-empty">Could not load pinned messages.</div>';
    showAppMessage(getApiErrorMessage(error, 'Could not load pinned messages.'), 'error');
  } finally {
    pinnedMessagesRefreshInFlight = false;
  }
}

async function toggleServerMessagePin(messageId, isPinned) {
  if (!messageId) return;

  try {
    await axios.post(`${homeApiBase}/api/ServerMessages/SetPinnedMessage`, {
      messageId,
      isPinned,
    });
    showAppMessage(isPinned ? 'Message pinned.' : 'Message unpinned.', 'success');
    await fetchServerMessages();
    if (isElementVisible('#serverPinnedMessagesPanel')) {
      await fetchPinnedMessages();
    }
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not update pinned message.'), 'error');
  }
}

function renderCompactMessage(message, scope = 'server') {
  const messageEl = document.createElement('div');
  messageEl.className = 'compact-message';
  const messageId = getMessageId(message);
  messageEl.dataset.messageId = messageId;
  messageEl.dataset.messageScope = scope;
  messageEl.classList.toggle('is-pinned', getMessageIsPinned(message));
  const deliveryState = message.deliveryState || message.DeliveryState || '';
  if (deliveryState) {
    messageEl.classList.add(`message-${deliveryState}`);
  }
  cacheMessageForScope(scope, message);

  const header = document.createElement('div');
  header.className = 'compact-message-header';
  const sender = getMessageSender(message);
  const headerText = document.createElement('span');
  if (scope === 'server') {
    applyRoleColorStyle(headerText, getServerMemberRole(sender));
  }
  headerText.textContent = sender;
  const sourceBadge = createMessageSourceBadge(message);
  if (sourceBadge) {
    headerText.appendChild(document.createTextNode(' '));
    headerText.appendChild(sourceBadge);
  }
  headerText.appendChild(document.createTextNode(` · ${formatMessageDate(message.date || message.Date)}`));
  header.appendChild(headerText);
  const headerActions = document.createElement('span');
  headerActions.className = 'compact-message-actions';

  if (messageId && ['server', 'dm', 'group'].includes(scope)) {
    const replyButton = document.createElement('button');
    replyButton.type = 'button';
    replyButton.className = 'compact-message-action-btn';
    replyButton.textContent = 'Reply';
    replyButton.title = 'Reply to message';
    replyButton.addEventListener('click', (event) => {
      event.stopPropagation();
      startReplyToMessage(message, scope);
    });
    headerActions.appendChild(replyButton);

    const forwardButton = document.createElement('button');
    forwardButton.type = 'button';
    forwardButton.className = 'compact-message-action-btn';
    forwardButton.textContent = 'Forward';
    forwardButton.title = 'Forward message';
    forwardButton.addEventListener('click', (event) => {
      event.stopPropagation();
      openForwardDialog(message, scope);
    });
    headerActions.appendChild(forwardButton);
  }

  if (scope === 'server' && messageId) {
    const thread = getMessageThread(message);
    const threadButton = document.createElement('button');
    threadButton.type = 'button';
    threadButton.className = 'compact-message-action-btn';
    const threadCount = getMessageThreadCount(message);
    threadButton.textContent = threadCount > 0 ? `Thread ${threadCount}` : 'Thread';
    threadButton.title = getThreadId(thread) ? 'Open thread' : 'Create thread';
    threadButton.addEventListener('click', (event) => {
      event.stopPropagation();
      openThreadFromMessage(message);
    });
    headerActions.appendChild(threadButton);

    const isPinned = getMessageIsPinned(message);
    const pinButton = document.createElement('button');
    pinButton.type = 'button';
    pinButton.className = 'compact-message-action-btn pin-action';
    pinButton.classList.toggle('active', isPinned);
    pinButton.textContent = isPinned ? 'Unpin' : 'Pin';
    pinButton.title = isPinned ? 'Unpin message' : 'Pin message';
    pinButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleServerMessagePin(messageId, !isPinned);
    });
    headerActions.appendChild(pinButton);
  }

  if (sender && sender !== JWTusername && messageId && ['server', 'dm', 'group'].includes(scope)) {
    const reportButton = document.createElement('button');
    reportButton.type = 'button';
    reportButton.className = 'compact-message-report-btn compact-message-action-btn';
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
    headerActions.appendChild(reportButton);
  }
  if (headerActions.childElementCount > 0) {
    header.appendChild(headerActions);
  }
  messageEl.appendChild(header);

  if (getMessageIsPinned(message)) {
    const pinned = document.createElement('div');
    pinned.className = 'compact-message-pinned';
    pinned.textContent = 'Pinned message';
    messageEl.appendChild(pinned);
  }

  const replyId = getMessageReplyId(message);
  if (replyId) {
    const replyPreview = getMessageReplyPreview(message) || buildReplyPreviewFromMessage(getCachedMessage(scope, replyId) || {});
    const reply = document.createElement('button');
    reply.type = 'button';
    reply.className = 'compact-message-reply';
    reply.dataset.replyTargetId = replyId;
    reply.textContent = `${getReplyPreviewSender(replyPreview)}: ${getPreviewSnippet(replyPreview)}`;
    reply.title = 'Jump to replied message';
    reply.addEventListener('click', (event) => {
      event.stopPropagation();
      jumpToMessage(replyId, scope);
    });
    messageEl.appendChild(reply);
  }

  const body = document.createElement('div');
  body.className = 'compact-message-body';
  const messageText = getMessageText(message);
  appendMessageTextWithLinks(body, messageText);
  if (getMessageEditedAt(message)) {
    const edited = document.createElement('span');
    edited.className = 'compact-message-edited';
    edited.textContent = ' edited';
    body.appendChild(edited);
  }
  messageEl.appendChild(body);

  const attachment = buildMessageAttachmentNode(
    getMessageAttachmentUrl(message),
    getMessageAttachmentContentType(message)
  );
  if (attachment) {
    messageEl.appendChild(attachment);
  }

  const poll = buildMessagePollNode(getMessagePoll(message), messageId, scope);
  if (poll) {
    messageEl.appendChild(poll);
  }

  const reactionsList = getMessageReactions(message);
  if (reactionsList.length > 0) {
    const reactions = document.createElement('div');
    reactions.className = 'message-reactions';
    reactionsList.forEach((reaction) => {
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

function getActiveMessageScope() {
  if (currentGroupId && isElementVisible('.privateMessage')) {
    return 'group';
  }

  if (currentFriend && !currentGroupId && isElementVisible('.privateMessage')) {
    return 'dm';
  }

  if (selectedChannelID && isElementVisible('#serverDetails')) {
    return 'server';
  }

  return null;
}

function getConversationIdForScope(scope) {
  if (scope === 'group') return currentGroupId || '';
  if (scope === 'dm') return currentFriend || '';
  if (scope === 'server') return selectedChannelID || '';
  return '';
}

function getMessageFormForScope(scope) {
  if (scope === 'server') return document.querySelector('.chatForm');
  if (scope === 'dm' || scope === 'group') return document.querySelector('.privateMessageForm');
  return null;
}

function getMessageInputForScope(scope) {
  const form = getMessageFormForScope(scope);
  if (!form) return null;
  return form.querySelector('.chatInput');
}

function removeReplyComposerPreviews() {
  document.querySelectorAll('.reply-composer-preview').forEach((preview) => preview.remove());
  document.querySelectorAll('.has-reply-preview').forEach((form) => form.classList.remove('has-reply-preview'));
}

function renderReplyComposer() {
  removeReplyComposerPreviews();

  const scope = getActiveMessageScope();
  if (!pendingReplyDraft || pendingReplyDraft.scope !== scope) {
    return;
  }

  if (pendingReplyDraft.conversationId !== getConversationIdForScope(scope)) {
    return;
  }

  const form = getMessageFormForScope(scope);
  if (!form) {
    return;
  }

  const preview = document.createElement('div');
  preview.className = 'reply-composer-preview';

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'reply-composer-copy';
  copy.title = 'Jump to replied message';
  copy.addEventListener('click', () => jumpToMessage(pendingReplyDraft.messageId, pendingReplyDraft.scope));

  const label = document.createElement('span');
  label.className = 'reply-composer-label';
  label.textContent = `Replying to ${getReplyPreviewSender(pendingReplyDraft.preview)}`;

  const text = document.createElement('span');
  text.className = 'reply-composer-text';
  text.textContent = getPreviewSnippet(pendingReplyDraft.preview);

  copy.appendChild(label);
  copy.appendChild(text);

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'reply-composer-clear';
  clearButton.textContent = 'x';
  clearButton.title = 'Cancel reply';
  clearButton.addEventListener('click', clearReplyDraft);

  preview.appendChild(copy);
  preview.appendChild(clearButton);
  form.classList.add('has-reply-preview');
  form.insertBefore(preview, form.firstChild);
}

function startReplyToMessage(message, scope) {
  const messageId = getMessageId(message);
  if (!messageId) {
    return;
  }

  pendingReplyDraft = {
    scope,
    conversationId: getConversationIdForScope(scope),
    messageId: String(messageId),
    preview: buildReplyPreviewFromMessage(message),
  };
  renderReplyComposer();
  getMessageInputForScope(scope)?.focus();
}

function getActiveReplyDraft(scope = getActiveMessageScope()) {
  if (!pendingReplyDraft || pendingReplyDraft.scope !== scope) {
    return null;
  }

  return pendingReplyDraft.conversationId === getConversationIdForScope(scope)
    ? pendingReplyDraft
    : null;
}

function clearReplyDraft() {
  pendingReplyDraft = null;
  renderReplyComposer();
}

function jumpToMessage(messageId, scope = getActiveMessageScope()) {
  if (!messageId) return;

  const selector = `.compact-message[data-message-scope="${scope}"][data-message-id="${escapeCssIdentifier(messageId)}"]`;
  const target = document.querySelector(selector);
  if (!target) {
    const container = getMessageContainerForScope(scope);
    const virtual = container ? virtualMessageLists.get(container) : null;
    const virtualIndex = virtual?.items.findIndex((item) =>
      item.type === 'message' && String(getMessageId(item.message)) === String(messageId)
    ) ?? -1;

    if (container && virtual && virtualIndex >= 0) {
      const { offsets } = getVirtualLayout(virtual.items, virtual);
      const item = virtual.items[virtualIndex];
      const itemHeight = getVirtualItemHeight(virtual, item);
      container.scrollTop = Math.max(
        0,
        offsets[virtualIndex] - ((container.clientHeight || 0) / 2) + (itemHeight / 2)
      );
      renderVirtualMessageWindow(container);

      requestAnimationFrame(() => {
        const renderedTarget = document.querySelector(selector);
        if (!renderedTarget) return;
        renderedTarget.scrollIntoView({ block: 'center', behavior: 'smooth' });
        renderedTarget.classList.add('message-jump-highlight');
        window.setTimeout(() => renderedTarget.classList.remove('message-jump-highlight'), 1400);
      });
      return;
    }

    showAppMessage('That message is not loaded in this view.', 'info');
    return;
  }

  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  target.classList.add('message-jump-highlight');
  window.setTimeout(() => target.classList.remove('message-jump-highlight'), 1400);
}

function getForwardSourceLabel(scope = forwardSourceScope) {
  if (scope === 'group') return currentGroupName ? ` in ${currentGroupName}` : '';
  if (scope === 'dm') return currentFriend ? ` in DM with ${currentFriend}` : '';
  if (scope === 'server') return getSelectedChannelNotificationName() ? ` in ${getSelectedChannelNotificationName()}` : '';
  return '';
}

function quoteForwardedText(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return '> Sent an attachment.';

  const clipped = normalized.length > 3400
    ? `${normalized.slice(0, 3400).trim()}...`
    : normalized;
  return clipped
    .split(/\r?\n/)
    .map((line) => `> ${line || ' '}`)
    .join('\n');
}

function buildForwardedMessageText(message, scope) {
  const sender = getMessageSender(message);
  const header = `Forwarded from ${sender}${getForwardSourceLabel(scope)}`;
  const body = quoteForwardedText(getMessageText(message));
  const forwarded = `${header}\n${body}`;
  return forwarded.length > 3900 ? `${forwarded.slice(0, 3897).trim()}...` : forwarded;
}

function getForwardAttachment(message = {}) {
  return {
    attachmentUrl: getMessageAttachmentUrl(message) || null,
    attachmentContentType: getMessageAttachmentContentType(message) || null,
  };
}

function ensureForwardDialog() {
  let overlay = document.getElementById('messageForwardDialog');
  if (overlay) {
    return overlay;
  }

  overlay = document.createElement('div');
  overlay.id = 'messageForwardDialog';
  overlay.className = 'message-forward-overlay is-hidden';

  const dialog = document.createElement('div');
  dialog.className = 'message-forward-dialog';

  const header = document.createElement('div');
  header.className = 'message-forward-header';
  const title = document.createElement('h3');
  title.textContent = 'Forward Message';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'message-forward-close';
  close.textContent = 'x';
  close.title = 'Close';
  close.addEventListener('click', closeForwardDialog);
  header.appendChild(title);
  header.appendChild(close);

  const preview = document.createElement('div');
  preview.className = 'message-forward-source';
  preview.id = 'messageForwardSource';

  const search = document.createElement('input');
  search.type = 'text';
  search.id = 'messageForwardSearch';
  search.className = 'message-forward-search';
  search.placeholder = 'Search conversations';
  search.addEventListener('input', () => renderForwardTargets());

  const list = document.createElement('div');
  list.id = 'messageForwardTargets';
  list.className = 'message-forward-targets';

  dialog.appendChild(header);
  dialog.appendChild(preview);
  dialog.appendChild(search);
  dialog.appendChild(list);
  overlay.appendChild(dialog);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeForwardDialog();
    }
  });

  document.body.appendChild(overlay);
  return overlay;
}

function closeForwardDialog() {
  forwardSourceMessage = null;
  forwardSourceScope = null;
  hideElement('#messageForwardDialog');
}

async function loadForwardTargets() {
  const targets = [];
  const seen = new Set();
  const addTarget = (target) => {
    if (!target?.id || !target?.type) return;
    const key = `${target.type}:${target.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push(target);
  };

  const [friendsResult, groupsResult, serversResult] = await Promise.allSettled([
    axios.get(`${homeApiBase}/api/Account/GetFriends`),
    axios.get(`${homeApiBase}/api/GroupChat/GetGroups`),
    axios.get(`${homeApiBase}/api/Server/GetServer`),
  ]);

  if (friendsResult.status === 'fulfilled' && Array.isArray(friendsResult.value.data)) {
    friendsResult.value.data.forEach((friend) => {
      addTarget({
        type: 'dm',
        id: String(friend),
        label: friend,
        meta: 'Direct Message',
      });
    });
  }

  if (groupsResult.status === 'fulfilled' && Array.isArray(groupsResult.value.data)) {
    groupsResult.value.data.forEach((group) => {
      addTarget({
        type: 'group',
        id: String(group.id || group.Id),
        label: group.name || group.Name || 'Group',
        meta: 'Group DM',
      });
    });
  }

  const servers = serversResult.status === 'fulfilled' && Array.isArray(serversResult.value.data)
    ? serversResult.value.data
    : [];
  const detailResults = await Promise.allSettled(
    servers.map(async (server) => {
      const serverId = server.serverID || server.ServerID;
      if (!serverId) return null;
      if (serverId === selectedServerID && currentServerChannels.length > 0) {
        return { server, channels: currentServerChannels };
      }

      const response = await axios.get(
        `${homeApiBase}/api/Server/GetServerDetails?serverId=${encodeURIComponent(serverId)}`
      );
      return { server: response.data.server || server, channels: response.data.channels || [] };
    })
  );

  detailResults.forEach((result) => {
    if (result.status !== 'fulfilled' || !result.value) return;
    const serverName =
      result.value.server?.serverName ||
      result.value.server?.ServerName ||
      result.value.server?.name ||
      'Server';
    result.value.channels
      .filter((channel) => channel.type === 'text' || channel.Type === 'text')
      .forEach((channel) => {
        addTarget({
          type: 'server',
          id: String(channel.id || channel.Id),
          label: `# ${channel.name || channel.Name || 'text'}`,
          meta: serverName,
        });
      });
  });

  return targets.sort((left, right) =>
    `${left.meta} ${left.label}`.localeCompare(`${right.meta} ${right.label}`)
  );
}

let forwardTargetsCache = [];

function renderForwardTargets() {
  const list = document.getElementById('messageForwardTargets');
  if (!list) return;

  const query = (document.getElementById('messageForwardSearch')?.value || '').trim().toLowerCase();
  const targets = forwardTargetsCache.filter((target) =>
    `${target.label} ${target.meta}`.toLowerCase().includes(query)
  );

  list.innerHTML = '';
  if (targets.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'message-forward-empty';
    empty.textContent = 'No destinations found.';
    list.appendChild(empty);
    return;
  }

  targets.forEach((target) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'message-forward-target';
    button.dataset.targetType = target.type;
    button.dataset.targetId = target.id;

    const label = document.createElement('span');
    label.className = 'message-forward-target-label';
    label.textContent = target.label;

    const meta = document.createElement('span');
    meta.className = 'message-forward-target-meta';
    meta.textContent = target.meta;

    button.appendChild(label);
    button.appendChild(meta);
    button.addEventListener('click', () => sendForwardedMessage(target));
    list.appendChild(button);
  });
}

async function openForwardDialog(message, scope) {
  if (!getMessageId(message)) return;

  forwardSourceMessage = message;
  forwardSourceScope = scope;
  const overlay = ensureForwardDialog();
  const source = document.getElementById('messageForwardSource');
  if (source) {
    source.textContent = `${getMessageSender(message)}: ${getMessageSnippet(message)}`;
  }
  const search = document.getElementById('messageForwardSearch');
  if (search) search.value = '';
  const list = document.getElementById('messageForwardTargets');
  if (list) {
    list.innerHTML = '<div class="message-forward-empty">Loading destinations...</div>';
  }
  showElement(overlay, 'flex');

  try {
    forwardTargetsCache = await loadForwardTargets();
    renderForwardTargets();
    search?.focus();
  } catch (error) {
    if (list) {
      list.innerHTML = '<div class="message-forward-empty">Could not load destinations.</div>';
    }
    showAppMessage(getApiErrorMessage(error, 'Could not load forwarding destinations.'), 'error');
  }
}

async function refreshForwardTargetIfVisible(target) {
  if (target.type === 'dm' && currentFriend === target.id && !currentGroupId && isElementVisible('.privateMessage')) {
    await GetPrivateMessage();
    return;
  }

  if (target.type === 'group' && currentGroupId === target.id && isElementVisible('.privateMessage')) {
    await GetGroupMessages(target.id);
    return;
  }

  if (target.type === 'server' && selectedChannelID === target.id && isElementVisible('#serverDetails')) {
    await fetchServerMessages();
  }
}

async function sendForwardedMessage(target) {
  if (!forwardSourceMessage || !target) return;

  const message = forwardSourceMessage;
  const scope = forwardSourceScope;
  const content = buildForwardedMessageText(message, scope);
  const attachment = getForwardAttachment(message);

  try {
    if (target.type === 'dm') {
      await apiClient.post(`${homeApiBase}/api/PrivateMessageFriend/SendPrivateMessage`, {
        PrivateMessageID: generateUUID(),
        MessageUserReciver: target.id,
        FriendMessagesData: content,
        AttachmentUrl: attachment.attachmentUrl,
        AttachmentContentType: attachment.attachmentContentType,
      });
    } else if (target.type === 'group') {
      await apiClient.post(`${homeApiBase}/api/GroupChat/SendGroupMessage`, {
        groupId: target.id,
        content,
        attachmentUrl: attachment.attachmentUrl,
        attachmentContentType: attachment.attachmentContentType,
      });
    } else if (target.type === 'server') {
      await apiClient.post(`${homeApiBase}/api/ServerMessages/ServerMessages`, {
        MessageID: generateUUID(),
        ChannelId: target.id,
        userText: content,
        AttachmentUrl: attachment.attachmentUrl,
        AttachmentContentType: attachment.attachmentContentType,
      });
    }

    closeForwardDialog();
    showAppMessage('Message forwarded.', 'success');
    await refreshForwardTargetIfVisible(target);
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not forward message.'), 'error');
  }
}

function ensurePollComposerDialog() {
  let overlay = document.getElementById('pollComposerDialog');
  if (overlay) {
    return overlay;
  }

  overlay = document.createElement('div');
  overlay.id = 'pollComposerDialog';
  overlay.className = 'poll-composer-overlay is-hidden';

  const dialog = document.createElement('form');
  dialog.className = 'poll-composer-dialog';
  dialog.addEventListener('submit', submitPollComposer);

  const header = document.createElement('div');
  header.className = 'poll-composer-header';
  const title = document.createElement('h3');
  title.textContent = 'Create Poll';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'poll-composer-close';
  close.textContent = 'x';
  close.title = 'Close';
  close.addEventListener('click', closePollComposer);
  header.appendChild(title);
  header.appendChild(close);

  const question = document.createElement('input');
  question.id = 'pollComposerQuestion';
  question.className = 'poll-composer-input';
  question.type = 'text';
  question.maxLength = 280;
  question.placeholder = 'Question';
  question.required = true;

  const options = document.createElement('div');
  options.id = 'pollComposerOptions';
  options.className = 'poll-composer-options';

  const addOption = document.createElement('button');
  addOption.type = 'button';
  addOption.className = 'poll-composer-add';
  addOption.textContent = 'Add Option';
  addOption.addEventListener('click', () => addPollOptionInput());

  const multipleLabel = document.createElement('label');
  multipleLabel.className = 'poll-composer-toggle';
  const multiple = document.createElement('input');
  multiple.id = 'pollComposerMultiple';
  multiple.type = 'checkbox';
  multipleLabel.appendChild(multiple);
  multipleLabel.appendChild(document.createTextNode('Allow multiple answers'));

  const actions = document.createElement('div');
  actions.className = 'poll-composer-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'poll-composer-secondary';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', closePollComposer);
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'poll-composer-primary';
  submit.textContent = 'Post Poll';
  actions.appendChild(cancel);
  actions.appendChild(submit);

  dialog.appendChild(header);
  dialog.appendChild(question);
  dialog.appendChild(options);
  dialog.appendChild(addOption);
  dialog.appendChild(multipleLabel);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closePollComposer();
    }
  });
  document.body.appendChild(overlay);
  return overlay;
}

function addPollOptionInput(value = '') {
  const options = document.getElementById('pollComposerOptions');
  if (!options || options.children.length >= 10) {
    return;
  }

  const row = document.createElement('div');
  row.className = 'poll-composer-option-row';
  const input = document.createElement('input');
  input.className = 'poll-composer-input poll-composer-option';
  input.type = 'text';
  input.maxLength = 100;
  input.placeholder = `Option ${options.children.length + 1}`;
  input.value = value;
  input.required = options.children.length < 2;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'poll-composer-remove';
  remove.textContent = 'x';
  remove.title = 'Remove option';
  remove.addEventListener('click', () => {
    row.remove();
    refreshPollOptionPlaceholders();
  });

  row.appendChild(input);
  row.appendChild(remove);
  options.appendChild(row);
}

function refreshPollOptionPlaceholders() {
  document.querySelectorAll('.poll-composer-option').forEach((input, index) => {
    input.placeholder = `Option ${index + 1}`;
    input.required = index < 2;
  });
}

function resetPollComposer() {
  const question = document.getElementById('pollComposerQuestion');
  if (question) question.value = '';
  const multiple = document.getElementById('pollComposerMultiple');
  if (multiple) multiple.checked = false;
  const options = document.getElementById('pollComposerOptions');
  if (options) options.innerHTML = '';
  addPollOptionInput();
  addPollOptionInput();
}

function openPollComposer() {
  const scope = getActiveMessageScope();
  if (!scope) {
    showAppMessage('Open a conversation before creating a poll.', 'info');
    return;
  }

  pendingPollComposerContext = {
    scope,
    conversationId: getConversationIdForScope(scope),
  };
  const overlay = ensurePollComposerDialog();
  resetPollComposer();
  showElement(overlay, 'flex');
  document.getElementById('pollComposerQuestion')?.focus();
}

function closePollComposer() {
  pendingPollComposerContext = null;
  hideElement('#pollComposerDialog');
}

async function submitPollComposer(event) {
  event.preventDefault();
  const context = pendingPollComposerContext;
  if (!context || context.conversationId !== getConversationIdForScope(context.scope)) {
    closePollComposer();
    showAppMessage('That conversation changed. Open the poll composer again.', 'info');
    return;
  }

  const question = document.getElementById('pollComposerQuestion')?.value?.trim() || '';
  const options = Array.from(document.querySelectorAll('.poll-composer-option'))
    .map((input) => input.value.trim())
    .filter(Boolean);
  const uniqueOptions = new Set(options.map((option) => option.toLowerCase()));
  if (!question || options.length < 2 || uniqueOptions.size !== options.length) {
    showAppMessage('Polls need a question and at least two unique options.', 'error');
    return;
  }

  const poll = {
    Question: question,
    Options: options,
    AllowMultiple: Boolean(document.getElementById('pollComposerMultiple')?.checked),
  };

  try {
    await sendPollMessage(context.scope, poll);
    closePollComposer();
    showAppMessage('Poll posted.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not post poll.'), 'error');
  }
}

async function sendPollMessage(scope, poll) {
  const input = getMessageInputForScope(scope);
  const content = input?.value?.trim() || '';
  const replyDraft = getActiveReplyDraft(scope);

  if (scope === 'server') {
    await apiClient.post(`${homeApiBase}/api/ServerMessages/ServerMessages`, {
      MessageID: generateUUID(),
      ChannelId: selectedChannelID,
      userText: content,
      ReplyToMessageId: replyDraft?.messageId || null,
      Poll: poll,
    });
    if (input) input.value = '';
    if (replyDraft && pendingReplyDraft === replyDraft) clearReplyDraft();
    await fetchServerMessages();
    return;
  }

  if (scope === 'group') {
    await apiClient.post(`${homeApiBase}/api/GroupChat/SendGroupMessage`, {
      groupId: currentGroupId,
      content,
      replyToMessageId: replyDraft?.messageId || null,
      poll,
    });
    if (input) input.value = '';
    if (replyDraft && pendingReplyDraft === replyDraft) clearReplyDraft();
    await GetGroupMessages(currentGroupId);
    return;
  }

  if (scope === 'dm') {
    await apiClient.post(`${homeApiBase}/api/PrivateMessageFriend/SendPrivateMessage`, {
      PrivateMessageID: generateUUID(),
      MessageUserReciver: currentFriend,
      FriendMessagesData: content,
      ReplyToMessageId: replyDraft?.messageId || null,
      Poll: poll,
    });
    if (input) input.value = '';
    if (replyDraft && pendingReplyDraft === replyDraft) clearReplyDraft();
    await GetPrivateMessage();
  }
}

const slashCommands = [
  {
    name: 'help',
    usage: '/help',
    description: 'Show available slash commands.',
    handler: ({ scope }) => {
      showAppMessage(
        getAvailableSlashCommands(scope)
          .map((command) => `${command.usage} - ${command.description}`)
          .join('\n'),
        'info',
        7000
      );
      return { handled: true };
    },
  },
  {
    name: 'poll',
    usage: '/poll',
    description: 'Open the poll composer.',
    handler: () => {
      openPollComposer();
      return { handled: true, clearInput: true };
    },
  },
  {
    name: 'status',
    usage: '/status <message>',
    description: 'Set or clear your custom status.',
    handler: async ({ args }) => {
      const nextStatus = args.trim();
      await syncCustomStatus(nextStatus.toLowerCase() === 'clear' ? '' : nextStatus);
      return { handled: true, clearInput: true };
    },
  },
  {
    name: 'online',
    usage: '/online',
    description: 'Set presence to online.',
    handler: () => setPresenceFromSlashCommand('online'),
  },
  {
    name: 'idle',
    usage: '/idle',
    description: 'Set presence to idle.',
    handler: () => setPresenceFromSlashCommand('idle'),
  },
  {
    name: 'dnd',
    usage: '/dnd',
    description: 'Set presence to do not disturb.',
    handler: () => setPresenceFromSlashCommand('do-not-disturb'),
  },
  {
    name: 'invisible',
    usage: '/invisible',
    description: 'Set presence to invisible.',
    handler: () => setPresenceFromSlashCommand('invisible'),
  },
  {
    name: 'me',
    usage: '/me <action>',
    description: 'Send an action-style message.',
    transform: ({ args }) => args ? `*${JWTusername} ${args}*` : '',
  },
  {
    name: 'shrug',
    usage: '/shrug [text]',
    description: 'Append a shrug.',
    transform: ({ args }) => `${args ? `${args} ` : ''}\u00af\\_(\u30c4)_/\u00af`,
  },
  {
    name: 'tableflip',
    usage: '/tableflip [text]',
    description: 'Append a table flip.',
    transform: ({ args }) => `${args ? `${args} ` : ''}(\u256f\u00b0\u25a1\u00b0)\u256f\ufe35 \u253b\u2501\u253b`,
  },
  {
    name: 'unflip',
    usage: '/unflip [text]',
    description: 'Append a table reset.',
    transform: ({ args }) => `${args ? `${args} ` : ''}\u252c\u2500\u252c \u30ce( \u309c-\u309c\u30ce)`,
  },
  {
    name: 'spoiler',
    usage: '/spoiler <text>',
    description: 'Wrap text in spoiler markers.',
    transform: ({ args }) => args ? `||${args}||` : '',
  },
  {
    name: 'code',
    usage: '/code <text>',
    description: 'Send text as a code block.',
    transform: ({ args }) => args ? `\`\`\`\n${args}\n\`\`\`` : '',
  },
  {
    name: 'clear',
    usage: '/clear',
    description: 'Clear the message box.',
    handler: () => ({ handled: true, clearInput: true }),
  },
];

let slashCommandActiveIndex = 0;
let slashCommandActiveInput = null;

function normalizeRemoteSlashCommand(command = {}) {
  const rawName = getIntegrationField(command, 'name', '');
  const name = String(rawName || '').trim().replace(/^\/+/, '').toLowerCase();
  if (!name) return null;

  const usage = getIntegrationField(command, 'usage', `/${name}`) || `/${name}`;
  const description = getIntegrationField(command, 'description', 'Server slash command.');
  return {
    id: getIntegrationField(command, 'id', ''),
    name,
    usage: String(usage || `/${name}`).startsWith('/') ? String(usage || `/${name}`) : `/${usage}`,
    description,
    remote: true,
    botAccountId: getIntegrationField(command, 'botAccountId', ''),
    botDisplayName: getIntegrationField(command, 'botDisplayName', 'Bot'),
    isEnabled: getIntegrationField(command, 'isEnabled', true),
    botEnabled: getIntegrationField(command, 'botEnabled', true),
  };
}

function getAvailableSlashCommands(scope = '') {
  if (scope !== 'server') {
    return slashCommands;
  }

  const remoteCommands = currentServerSlashCommands
    .filter((command) => command?.isEnabled !== false && command?.botEnabled !== false);
  return [...slashCommands, ...remoteCommands];
}

function getSlashCommandScopeForInput(input) {
  if (input?.closest('.chatForm') && selectedServerID && selectedChannelID && isElementVisible('#serverDetails')) {
    return 'server';
  }

  if (input?.closest('.chatForm') && currentGroupId) {
    return 'group';
  }

  return 'dm';
}

async function loadServerSlashCommands(serverId = selectedServerID, { force = false, silent = true } = {}) {
  const normalizedServerId = String(serverId || '').trim();
  if (!normalizedServerId) {
    currentServerSlashCommands = [];
    currentServerSlashCommandServerId = null;
    return [];
  }

  if (!force && currentServerSlashCommandServerId === normalizedServerId) {
    return currentServerSlashCommands;
  }

  try {
    const response = await axios.get(
      `${homeApiBase}/api/ServerIntegrations/GetSlashCommands?serverId=${encodeURIComponent(normalizedServerId)}`
    );
    const commands = (Array.isArray(response.data) ? response.data : [])
      .map(normalizeRemoteSlashCommand)
      .filter(Boolean);
    if (selectedServerID === normalizedServerId) {
      currentServerSlashCommands = commands;
      currentServerSlashCommandServerId = normalizedServerId;
    }
    return commands;
  } catch (error) {
    if (!silent) {
      showAppMessage(getApiErrorMessage(error, 'Could not load server slash commands.'), 'error');
    }
    if (selectedServerID === normalizedServerId) {
      currentServerSlashCommands = [];
      currentServerSlashCommandServerId = normalizedServerId;
    }
    return [];
  }
}

function setPresenceFromSlashCommand(presenceStatus) {
  const normalizedPresence = normalizePresenceStatus(presenceStatus);
  const presenceSelect = document.getElementById('presenceStatusSelect');
  if (presenceSelect) {
    presenceSelect.value = normalizedPresence;
  }
  syncPresenceStatus(normalizedPresence);
  showAppMessage(`Presence set to ${getPresenceStatusLabel(normalizedPresence)}.`, 'success');
  return { handled: true, clearInput: true };
}

function parseSlashCommand(text = '', scope = '') {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const withoutSlash = trimmed.slice(1);
  const [rawName = '', ...parts] = withoutSlash.split(/\s+/);
  const name = rawName.toLowerCase();
  if (!name) {
    return null;
  }

  const command = getAvailableSlashCommands(scope).find((item) => item.name === name);
  if (!command) {
    return {
      unknown: true,
      name,
    };
  }

  const args = withoutSlash.slice(rawName.length).trimStart();
  return {
    command,
    args,
  };
}

async function handleSlashCommandBeforeSend(scope, input, rawText) {
  const parsed = parseSlashCommand(rawText, scope);
  if (!parsed) {
    return { handled: false, content: rawText };
  }

  if (parsed.unknown) {
    showAppMessage(`Unknown command /${parsed.name}. Type /help for available commands.`, 'error');
    return { handled: true };
  }

  const { command, args } = parsed;
  if (command.remote) {
    if (scope !== 'server' || !selectedServerID || !selectedChannelID) {
      showAppMessage('Server slash commands can only run in text channels.', 'error');
      return { handled: true };
    }

    try {
      const response = await axios.post(`${homeApiBase}/api/ServerIntegrations/ExecuteSlashCommand`, {
        commandId: command.id,
        serverId: selectedServerID,
        channelId: selectedChannelID,
        name: command.name,
        arguments: args,
      });
      showAppMessage(response.data?.message || `Command /${command.name} sent.`, 'success');
      if (input) input.value = '';
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, `Could not run /${command.name}.`), 'error');
    }
    closeSlashCommandPalette();
    return { handled: true };
  }

  if (command.handler) {
    let result = null;
    try {
      result = await command.handler({ args, scope, input, rawText });
    } catch {
      closeSlashCommandPalette();
      return { handled: true };
    }
    if (result?.clearInput && input) {
      input.value = '';
    }
    closeSlashCommandPalette();
    return { handled: true };
  }

  if (command.transform) {
    const content = command.transform({ args, scope, input, rawText });
    if (!content) {
      showAppMessage(`${command.usage} needs text.`, 'info');
      return { handled: true };
    }

    closeSlashCommandPalette();
    return { handled: false, content };
  }

  return { handled: false, content: rawText };
}

function getSlashCommandMatches(input) {
  if (!input) return [];
  const cursor = input.selectionStart ?? input.value.length;
  const leadingText = input.value.slice(0, cursor);
  const match = leadingText.match(/^\/([A-Za-z-]*)$/);
  if (!match) return [];

  const query = match[1].toLowerCase();
  return getAvailableSlashCommands(getSlashCommandScopeForInput(input))
    .filter((command) => command.name.startsWith(query));
}

function ensureSlashCommandPalette() {
  let palette = document.getElementById('slashCommandPalette');
  if (palette) {
    return palette;
  }

  palette = document.createElement('div');
  palette.id = 'slashCommandPalette';
  palette.className = 'slash-command-palette is-hidden';
  document.body.appendChild(palette);
  return palette;
}

function positionSlashCommandPalette(input, palette) {
  const rect = input.getBoundingClientRect();
  const paletteHeight = Math.min(270, palette.scrollHeight || 180);
  const top = Math.max(8, rect.top - paletteHeight - 8);
  const left = Math.min(rect.left, window.innerWidth - Math.min(420, window.innerWidth - 24) - 12);
  palette.style.left = `${Math.max(12, left)}px`;
  palette.style.top = `${top}px`;
}

function renderSlashCommandPalette(input) {
  const matches = getSlashCommandMatches(input);
  const palette = ensureSlashCommandPalette();
  slashCommandActiveInput = input;

  if (!matches.length) {
    closeSlashCommandPalette();
    return;
  }

  slashCommandActiveIndex = Math.min(slashCommandActiveIndex, matches.length - 1);
  palette.innerHTML = '';
  matches.forEach((command, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'slash-command-item';
    item.classList.toggle('active', index === slashCommandActiveIndex);
    item.dataset.command = command.name;
    const name = document.createElement('span');
    name.className = 'slash-command-name';
    name.textContent = command.usage;
    const description = document.createElement('span');
    description.className = 'slash-command-description';
    description.textContent = command.description;
    item.appendChild(name);
    item.appendChild(description);
    item.addEventListener('mousedown', (event) => {
      event.preventDefault();
      completeSlashCommand(input, command);
    });
    palette.appendChild(item);
  });

  showElement(palette, 'grid');
  positionSlashCommandPalette(input, palette);
}

function closeSlashCommandPalette() {
  const palette = document.getElementById('slashCommandPalette');
  if (palette) {
    hideElement(palette);
  }
  slashCommandActiveInput = null;
  slashCommandActiveIndex = 0;
}

function completeSlashCommand(input, command) {
  if (!input || !command) return;
  input.value = `/${command.name} `;
  input.focus();
  input.selectionStart = input.value.length;
  input.selectionEnd = input.value.length;
  closeSlashCommandPalette();
}

function handleSlashCommandKeydown(event) {
  const input = event.currentTarget;
  const matches = getSlashCommandMatches(input);
  const paletteVisible = isElementVisible('#slashCommandPalette') && slashCommandActiveInput === input;
  if (!matches.length || !paletteVisible) {
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    slashCommandActiveIndex = (slashCommandActiveIndex + 1) % matches.length;
    renderSlashCommandPalette(input);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    slashCommandActiveIndex = (slashCommandActiveIndex - 1 + matches.length) % matches.length;
    renderSlashCommandPalette(input);
  } else if (event.key === 'Tab' || event.key === 'Enter') {
    event.preventDefault();
    completeSlashCommand(input, matches[slashCommandActiveIndex] || matches[0]);
  } else if (event.key === 'Escape') {
    closeSlashCommandPalette();
  }
}

function setupSlashCommandInputs() {
  document.querySelectorAll('.chatForm .chatInput, .privateMessageForm .chatInput').forEach((input) => {
    if (input.dataset.slashCommandsReady === 'true') {
      return;
    }

    input.dataset.slashCommandsReady = 'true';
    input.addEventListener('input', () => {
      slashCommandActiveIndex = 0;
      renderSlashCommandPalette(input);
    });
    input.addEventListener('keydown', handleSlashCommandKeydown);
    input.addEventListener('blur', () => {
      window.setTimeout(closeSlashCommandPalette, 120);
    });
  });
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

async function fetchServerMessages({ appendOlder = false } = {}) {
  if (!selectedChannelID || !chatMessages) return;
  const state = getMessagePaginationState('server', selectedChannelID);
  if (appendOlder && (state.isLoadingOlder || !state.messages.length)) return;

  const previousScrollHeight = chatMessages.scrollHeight;
  const previousScrollTop = chatMessages.scrollTop;
  const shouldStickBottom = !appendOlder && isScrolledNearBottom(chatMessages);
  const beforeMessageId = appendOlder ? getMessageId(state.messages[0]) : '';

  try {
    if (appendOlder) {
      state.isLoadingOlder = true;
      renderPaginatedMessages(chatMessages, 'server', state, () => fetchServerMessages({ appendOlder: true }));
    }

    const params = new URLSearchParams({
      channelId: selectedChannelID,
      take: String(messagePageSize),
      includePageInfo: 'true',
    });
    if (beforeMessageId) {
      params.set('beforeMessageId', beforeMessageId);
    }

    const messageRes = await axios.get(
      `${homeApiBase}/api/ServerMessages/GetServerMessages?${params.toString()}`
    );
    const pageInfo = normalizePagedMessageResponse(messageRes.data);
    if (!appendOlder) {
      notifyPolledMessages(pageInfo.messages, {
        scope: 'server',
        conversationId: selectedChannelID,
        conversationName: getSelectedChannelNotificationName(),
      });
    }

    const nextState = applyMessagePage(
      'server',
      selectedChannelID,
      pageInfo,
      appendOlder ? 'older' : 'latest'
    );
    nextState.isLoadingOlder = false;
    cacheMessagesForScope('server', nextState.messages);
    renderPaginatedMessages(chatMessages, 'server', nextState, () => fetchServerMessages({ appendOlder: true }));

    if (appendOlder) {
      chatMessages.scrollTop = chatMessages.scrollHeight - previousScrollHeight + previousScrollTop;
    } else if (shouldStickBottom) {
      scrollMessageListToBottom(chatMessages);
    }

    await markSelectedChannelRead(nextState.messages);
  } catch (e) {
    state.isLoadingOlder = false;
    renderPaginatedMessages(chatMessages, 'server', state, () => fetchServerMessages({ appendOlder: true }));
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
  const input = form.querySelector('.chatInput');
  let messageText = String(formData.get('userText') || '');
  const commandResult = await handleSlashCommandBeforeSend('server', input, messageText);
  if (commandResult.handled) {
    return;
  }
  messageText = commandResult.content;

  if (!messageText.trim()) return;

  const messageId = generateUUID();
  const replyDraft = getActiveReplyDraft('server');
  const formDataObject = {
    MessageID: messageId,
    ChannelId: selectedChannelID,
    ServerName: currentServerName,
    MessagesUserSender: JWTusername,
    Date: new Date().toLocaleString().toString(),
    userText: messageText,
    ReplyToMessageId: replyDraft?.messageId || null,
  };

  const pendingDraft = {
    ...formDataObject,
    messagesUserSender: JWTusername,
    userText: messageText,
    date: formDataObject.Date,
    replyToMessageId: replyDraft?.messageId || null,
    replyPreview: replyDraft?.preview || null,
    deliveryState: 'pending',
  };
  upsertMessageIntoPaginationState('server', selectedChannelID, pendingDraft);
  renderMessageStateForScope('server', selectedChannelID, { stickToBottom: true });
  if (input) input.value = '';

  try {
    await axios.post(
      `${homeApiBase}/api/ServerMessages/ServerMessages`,
      formDataObject
    );

    pendingDraft.deliveryState = 'delivered';
    renderMessageStateForScope('server', selectedChannelID);
    if (replyDraft && pendingReplyDraft === replyDraft) {
      clearReplyDraft();
    }
    await fetchServerMessages();
  } catch (e) {
    console.error('msg send failed:', e);
    pendingDraft.deliveryState = 'failed';
    pendingDraft.retryHandler = () => {
      removeMessageFromPaginationState('server', selectedChannelID, messageId);
      renderMessageStateForScope('server', selectedChannelID);
      form.querySelector('.chatInput').value = messageText;
      ServerChat({ preventDefault() {}, target: form });
    };
    renderMessageStateForScope('server', selectedChannelID, { stickToBottom: true });
    showAppMessage(getApiErrorMessage(e, 'Message failed to send.'), 'error');
  }
}

async function runOptimisticMessageSend({
  container,
  scope = null,
  conversationId = null,
  draft,
  send,
  rollbackInput,
  refresh,
  failureMessage = 'Message failed to send.',
}) {
  const pendingDraft = {
    ...draft,
    deliveryState: 'pending',
  };
  if (!getMessageId(pendingDraft)) {
    pendingDraft.id = generateUUID();
  }

  let pendingMessage = null;
  if (scope && conversationId) {
    upsertMessageIntoPaginationState(scope, conversationId, pendingDraft);
    renderMessageStateForScope(scope, conversationId, { stickToBottom: true });
  } else {
    pendingMessage = renderCompactMessage(pendingDraft);
    container.appendChild(pendingMessage);
    container.scrollTop = container.scrollHeight;
  }

  try {
    const result = await send();
    pendingDraft.deliveryState = 'delivered';
    if (scope && conversationId) {
      renderMessageStateForScope(scope, conversationId);
    } else if (pendingMessage) {
      pendingMessage.classList.remove('message-pending');
      pendingMessage.classList.add('message-delivered');
    }
    if (typeof refresh === 'function') {
      if (scope && conversationId) {
        removeMessageFromPaginationState(scope, conversationId, getMessageId(pendingDraft));
      }
      await refresh(result);
    }
    return result;
  } catch (error) {
    pendingDraft.deliveryState = 'failed';
    pendingDraft.retryHandler = () => {
      if (scope && conversationId) {
        removeMessageFromPaginationState(scope, conversationId, getMessageId(pendingDraft));
        renderMessageStateForScope(scope, conversationId);
      } else {
        pendingMessage?.remove();
      }
      rollbackInput?.();
    };

    if (scope && conversationId) {
      renderMessageStateForScope(scope, conversationId, { stickToBottom: true });
    } else if (pendingMessage) {
      pendingMessage.classList.remove('message-pending');
      pendingMessage.classList.add('message-failed');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'message-retry-btn';
      retry.textContent = 'Retry';
      retry.addEventListener('click', pendingDraft.retryHandler);
      pendingMessage.appendChild(retry);
    }
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
  clearReplyDraft();
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
  if (!pendingList) return;
  pendingList.textContent = 'Loading...';
  try {
    const res = await axios.get(`${homeApiBase}/api/Account/GetFriendRequests`);
    pendingList.innerHTML = '';

    if (!Array.isArray(res.data) || res.data.length === 0) {
      setEmptyState(pendingList, {
        icon: 'OK',
        title: 'No pending requests',
        description: 'Incoming friend requests will appear here.',
        compact: true,
      });
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
    setEmptyState(pendingList, {
      icon: '!',
      title: 'Requests could not load',
      description: 'Check your connection and try again.',
      compact: true,
      className: 'error-state',
    });
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
  if (!mainFriendsDiv) return;
  mainFriendsDiv.innerHTML = '';
  try {
    let res = await axios.get(
      `${homeApiBase}/api/Account/GetFriends`
    );

    const friends = Array.isArray(res.data) ? [...new Set(res.data)] : [];
    if (friends.length > 0) {
      const friendProfiles = await fetchFriendProfileSummaries();
      console.log('GetFriends response:', friends);

      friends.forEach((friend) => {
        const profile = friendProfiles.get(String(friend).toLowerCase()) || getCachedProfileSummary(friend) || {
          username: friend,
          presenceStatus: 'online',
          customStatus: '',
          activityStatus: '',
          lastActiveAt: null,
        };
        const friendsTag = document.createElement('button');
        friendsTag.type = 'button';
        friendsTag.className = 'testaddeduser conversation-list-item';
        friendsTag.dataset.dmUsername = friend;

        const copy = document.createElement('span');
        copy.className = 'conversation-copy';
        const label = document.createElement('span');
        label.className = 'conversation-label';
        label.textContent = friend;
        const status = document.createElement('span');
        status.className = 'conversation-status';
        status.textContent = getStatusSummary(profile);
        const profileBadges = document.createElement('span');
        profileBadges.className = 'user-badges conversation-profile-badges';
        renderUserBadges(profileBadges, getProfileBadges(profile), { compact: true });
        copy.appendChild(label);
        copy.appendChild(profileBadges);
        copy.appendChild(status);

        const badge = document.createElement('span');
        badge.className = 'conversation-badge is-hidden';
        badge.setAttribute('aria-hidden', 'true');

        friendsTag.appendChild(copy);
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

      await refreshDmUnreadBadges();
    }

    await GetGroups();
    refreshConversationListEmptyState();
  } catch (e) {
    console.log('private msg handling broke:', e);
    setEmptyState(mainFriendsDiv, {
      icon: '!',
      title: 'Conversations could not load',
      description: 'Make sure the API is running and try again.',
      compact: true,
      className: 'error-state',
    });
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
  upsertMessageIntoPaginationState('dm', currentFriend, message);
  renderMessageStateForScope('dm', currentFriend, { stickToBottom: true });
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

  const groupId = message.GroupId || message.groupId;
  if (groupId === currentGroupId) {
    const messagesDisplay = document.querySelector('.messagesDisplay');
    notifyIncomingChatMessage(message, {
      scope: 'group',
      conversationId: groupId,
      conversationName: currentGroupName,
    });
    upsertMessageIntoPaginationState('group', groupId, message);
    renderMessageStateForScope('group', groupId, { stickToBottom: true });
    currentChatHistory.push({
      id: message.Id || message.id,
      messagesUserSender: getMessageSender(message),
      friendMessagesData: getMessageText(message),
      date: message.Date || message.date,
    });
    if (isAppWindowFocused() && isCurrentNotificationContextVisible('group', groupId)) {
      markGroupRead(groupId, message.Id || message.id);
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
  let content = String(formData.get('friendMessagesData') || '').trim();
  const scope = currentGroupId ? 'group' : 'dm';
  const commandResult = await handleSlashCommandBeforeSend(scope, input, content);
  if (commandResult.handled) {
    return;
  }
  content = String(commandResult.content || '').trim();
  if (!content) {
    return;
  }
  const messagesDisplay = document.querySelector('.messagesDisplay');

  if (currentGroupId) {
    const replyDraft = getActiveReplyDraft('group');
    if (input) input.value = '';
    const result = await runOptimisticMessageSend({
      container: messagesDisplay,
      scope: 'group',
      conversationId: currentGroupId,
      draft: {
        sender: JWTusername,
        content,
        date: new Date().toISOString(),
        replyToMessageId: replyDraft?.messageId || null,
        replyPreview: replyDraft?.preview || null,
      },
      send: () => apiClient.post(`${homeApiBase}/api/GroupChat/SendGroupMessage`, {
        groupId: currentGroupId,
        content,
        replyToMessageId: replyDraft?.messageId || null,
      }),
      rollbackInput: () => {
        if (input) input.value = content;
      },
      refresh: () => GetGroupMessages(currentGroupId),
      failureMessage: 'Group message failed to send.',
    }).catch(() => {});
    if (result && replyDraft && pendingReplyDraft === replyDraft) {
      clearReplyDraft();
    }
  } else {
    if (!currentFriend) {
      return;
    }
    const replyDraft = getActiveReplyDraft('dm');
    if (input) input.value = '';
    const messageId = generateUUID();
    const messageObject = {
      PrivateMessageID: messageId,
      MessagesUserSender: JWTusername,
      MessageUserReciver: currentFriend,
      friendMessagesData: content,
      date: new Date().toISOString(),
      ReplyToMessageId: replyDraft?.messageId || null,
    };

    const result = await runOptimisticMessageSend({
      container: messagesDisplay,
      scope: 'dm',
      conversationId: currentFriend,
      draft: {
        privateMessageID: messageId,
        messagesUserSender: JWTusername,
        friendMessagesData: content,
        date: messageObject.date,
        replyToMessageId: replyDraft?.messageId || null,
        replyPreview: replyDraft?.preview || null,
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
    if (result && replyDraft && pendingReplyDraft === replyDraft) {
      clearReplyDraft();
    }
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

async function GetPrivateMessage({ appendOlder = false } = {}) {
  if (!currentFriend) return;
  const messagesDisplay = document.querySelector('.messagesDisplay');
  const state = getMessagePaginationState('dm', currentFriend);
  if (!messagesDisplay || (appendOlder && (state.isLoadingOlder || !state.messages.length))) return;

  const previousScrollHeight = messagesDisplay.scrollHeight;
  const previousScrollTop = messagesDisplay.scrollTop;
  const shouldStickBottom = !appendOlder && isScrolledNearBottom(messagesDisplay);
  const beforeMessageId = appendOlder ? getMessageId(state.messages[0]) : '';

  try {
    if (appendOlder) {
      state.isLoadingOlder = true;
      renderPaginatedMessages(messagesDisplay, 'dm', state, () => GetPrivateMessage({ appendOlder: true }));
    }

    const params = new URLSearchParams({
      targetUsername: currentFriend,
      take: String(messagePageSize),
      includePageInfo: 'true',
    });
    if (beforeMessageId) {
      params.set('beforeMessageId', beforeMessageId);
    }

    const res = await axios.get(
      `${homeApiBase}/api/PrivateMessageFriend/GetPrivateMessage?${params.toString()}`
    );
    const pageInfo = normalizePagedMessageResponse(res.data);
    const nextState = applyMessagePage(
      'dm',
      currentFriend,
      pageInfo,
      appendOlder ? 'older' : 'latest'
    );
    nextState.isLoadingOlder = false;
    currentChatHistory = nextState.messages;
    cacheMessagesForScope('dm', nextState.messages);
    renderPaginatedMessages(messagesDisplay, 'dm', nextState, () => GetPrivateMessage({ appendOlder: true }));

    if (appendOlder) {
      messagesDisplay.scrollTop = messagesDisplay.scrollHeight - previousScrollHeight + previousScrollTop;
    } else if (shouldStickBottom || !nextState.olderPagesLoaded) {
      scrollMessageListToBottom(messagesDisplay);
    }

    if (
      nextState.messages.length > 0 &&
      isAppWindowFocused() &&
      isCurrentNotificationContextVisible('dm', currentFriend)
    ) {
      const lastMessage = nextState.messages[nextState.messages.length - 1];
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
    state.isLoadingOlder = false;
    renderPaginatedMessages(messagesDisplay, 'dm', state, () => GetPrivateMessage({ appendOlder: true }));
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
  const dmSearchInput = document.getElementById('dmSearchInput');
  if (dmSearchInput) dmSearchInput.value = '';
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
    setEmptyState(list, {
      icon: 'SRV',
      title: 'No public servers found',
      description: 'Try a different search, category, or tag.',
      compact: true,
      className: 'publicServerEmpty',
    });
    return;
  }

  servers.forEach((server) => {
    const serverId = getServerListingId(server);
    const serverName = getServerField(server, 'serverName') || 'Unnamed server';
    const serverIconUrl = getServerVisualUrl(server, 'icon');
    const serverBannerUrl = getServerVisualUrl(server, 'banner');
    const row = document.createElement('div');
    row.className = 'publicServerListing';
    if (serverBannerUrl) {
      row.style.backgroundImage = `linear-gradient(90deg, rgba(35, 36, 40, 0.92), rgba(35, 36, 40, 0.78)), url("${cssString(resolveMediaUrl(serverBannerUrl))}")`;
    }

    const icon = document.createElement('div');
    icon.className = 'publicServerIcon';
    icon.appendChild(createServerIconElement(serverName, serverIconUrl, 'public-server-icon-inner'));

    const details = document.createElement('div');
    details.className = 'publicServerDetails';
    const name = document.createElement('strong');
    name.textContent = serverName;
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
    setEmptyState(list, {
      icon: '!',
      title: 'Public servers could not load',
      description: getApiErrorMessage(error, 'Could not load public servers.'),
      compact: true,
      className: 'publicServerEmpty error-state',
    });
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
  if (!list) return;
  list.textContent = 'Loading...';

  try {
    let res = await axios.get(
      `${homeApiBase}/api/Account/GetFriends`
    );
    list.innerHTML = '';

    if (!Array.isArray(res.data) || res.data.length === 0) {
      setEmptyState(list, {
        icon: 'DM',
        title: 'No friends to message',
        description: 'Add a friend first, then start a DM or group chat.',
        actionLabel: 'Add Friend',
        onAction: () => {
          closeCreateDMModal();
          showAddFriends();
        },
        compact: true,
      });
      return;
    }

    res.data.forEach(friend => {
      const div = document.createElement('div');
      div.className = 'dmFriendItem';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'dmFriendInput';
      checkbox.value = friend;
      const avatar = document.createElement('div');
      avatar.className = 'server-member-avatar default-avatar-bg';
      const label = document.createElement('span');
      label.textContent = friend;
      div.appendChild(checkbox);
      div.appendChild(avatar);
      div.appendChild(label);
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
    setEmptyState(list, {
      icon: '!',
      title: 'Friends could not load',
      description: 'Check your connection and try again.',
      compact: true,
      className: 'error-state',
    });
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

    removeEmptyStates(mainFriendsDiv, 'conversation-list');
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
    refreshConversationListEmptyState();
  } catch (e) {
    console.error("Failed to load groups", e);
    refreshConversationListEmptyState();
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

async function GetGroupMessages(groupId, { appendOlder = false } = {}) {
  if (!groupId) return;
  const messagesDisplay = document.querySelector('.messagesDisplay');
  const state = getMessagePaginationState('group', groupId);
  if (!messagesDisplay || (appendOlder && (state.isLoadingOlder || !state.messages.length))) return;

  const previousScrollHeight = messagesDisplay.scrollHeight;
  const previousScrollTop = messagesDisplay.scrollTop;
  const shouldStickBottom = !appendOlder && isScrolledNearBottom(messagesDisplay);
  const beforeMessageId = appendOlder ? getMessageId(state.messages[0]) : '';

  try {
    if (appendOlder) {
      state.isLoadingOlder = true;
      renderPaginatedMessages(messagesDisplay, 'group', state, () => GetGroupMessages(groupId, { appendOlder: true }));
    }

    const params = new URLSearchParams({
      groupId,
      take: String(messagePageSize),
      includePageInfo: 'true',
    });
    if (beforeMessageId) {
      params.set('beforeMessageId', beforeMessageId);
    }

    const res = await axios.get(`${homeApiBase}/api/GroupChat/GetGroupMessages?${params.toString()}`);
    const pageInfo = normalizePagedMessageResponse(res.data);
    const nextState = applyMessagePage(
      'group',
      groupId,
      pageInfo,
      appendOlder ? 'older' : 'latest'
    );
    nextState.isLoadingOlder = false;
    currentChatHistory = nextState.messages.map(m => ({
      messagesUserSender: getMessageSender(m),
      friendMessagesData: getMessageText(m),
      date: m.date || m.Date,
    }));
    cacheMessagesForScope('group', nextState.messages);

    renderPaginatedMessages(messagesDisplay, 'group', nextState, () => GetGroupMessages(groupId, { appendOlder: true }));
    if (appendOlder) {
      messagesDisplay.scrollTop = messagesDisplay.scrollHeight - previousScrollHeight + previousScrollTop;
    } else if (shouldStickBottom || !nextState.olderPagesLoaded) {
      scrollMessageListToBottom(messagesDisplay);
    }

    if (
      nextState.messages.length > 0 &&
      isAppWindowFocused() &&
      isCurrentNotificationContextVisible('group', groupId)
    ) {
      const lastMessage = nextState.messages[nextState.messages.length - 1];
      await markGroupRead(groupId, lastMessage.id || lastMessage.Id);
    } else {
      await refreshGroupUnreadBadges();
    }
  } catch (e) {
    state.isLoadingOlder = false;
    renderPaginatedMessages(messagesDisplay, 'group', state, () => GetGroupMessages(groupId, { appendOlder: true }));
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
const DEFAULT_ROLE_COLORS = {
  owner: '#f0b232',
  admin: '#ed4245',
  moderator: '#23a559',
  user: '#5865f2',
  default: '#949ba4',
};

function getServerVerificationLabel(level) {
  return SERVER_VERIFICATION_LEVELS.find((item) => item.value === level)?.label || 'None';
}

function getServerVisualUrl(server = {}, kind = 'icon') {
  const camelKey = kind === 'banner' ? 'serverBannerUrl' : 'serverIconUrl';
  const pascalKey = kind === 'banner' ? 'ServerBannerUrl' : 'ServerIconUrl';
  return server?.[camelKey] || server?.[pascalKey] || '';
}

function getServerInitials(serverName = '') {
  const words = String(serverName || '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return String(serverName || '?').trim().slice(0, 2).toUpperCase() || '?';
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

function applyServerAppearanceState(server = {}) {
  currentServerIconUrl = getServerVisualUrl(server, 'icon');
  currentServerBannerUrl = getServerVisualUrl(server, 'banner');
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

function formatServerAppearanceSummary() {
  const icon = currentServerIconUrl ? 'Icon set' : 'No icon';
  const banner = currentServerBannerUrl ? 'Banner set' : 'No banner';
  return `${icon} | ${banner}`;
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

function getDefaultRoleColor(roleName = 'user') {
  return DEFAULT_ROLE_COLORS[normalizeRoleName(roleName)] || DEFAULT_ROLE_COLORS.default;
}

function getServerRoleColor(role = {}) {
  const roleName = getServerRoleName(role);
  return normalizeHexColor(getRoleProperty(role, 'color', ''), getDefaultRoleColor(roleName));
}

function getRoleColorByName(roleName = 'user') {
  const normalizedRole = normalizeRoleName(roleName);
  const role = currentServerRoles.find((item) => getServerRoleName(item) === normalizedRole);
  return role ? getServerRoleColor(role) : getDefaultRoleColor(normalizedRole);
}

function getServerMemberRole(username = '') {
  const member = currentServerMembers.find((item) =>
    String(item.username || item.Username || '').toLowerCase() === String(username || '').toLowerCase()
  );
  return normalizeRoleName(member?.role || member?.Role || 'user');
}

function applyRoleColorStyle(element, roleName = 'user', color = '') {
  if (!element) return;
  const roleColor = normalizeHexColor(color, getRoleColorByName(roleName));
  const softBackground = mixColors(roleColor, '#000000', 0.78);
  element.style.setProperty('--role-color', roleColor);
  element.style.setProperty('--role-color-soft', softBackground);
}

function normalizeServerRole(role = {}) {
  const normalizedRole = {
    id: getServerRoleId(role),
    name: getServerRoleName(role),
    color: getServerRoleColor(role),
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

  const appearanceSummary = document.createElement('div');
  appearanceSummary.className = 'server-verification-summary';
  appearanceSummary.textContent = formatServerAppearanceSummary();
  container.appendChild(appearanceSummary);

  const tools = document.createElement('div');
  tools.className = 'server-management-tools';

  const actions = [
    ['+ Channel', createChannelFromPrompt],
    ['+ Category', createCategoryFromPrompt],
    ['Roles', openRolesAndPermissionsDialog],
    ['Appearance', openServerAppearanceDialog],
    ['Expressions', () => openExpressionManagerDialog('emoji')],
    ['Integrations', openServerIntegrationsDialog],
    ['Media', openMediaBrowserDialog],
    ['Perms', () => openChannelPermissionsDialog()],
    ['Invite', createLimitedInviteFromPrompt],
    ['Listing', updatePublicListingFromPrompt],
    ['Welcome', updateServerWelcomeFromPrompt],
    ['Rules', updateServerVerificationFromPrompt],
    ['AutoMod', openAutoModRulesDialog],
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

function openServerAppearanceDialog() {
  if (!selectedServerID) return;

  closeAccountActionDialog();

  const overlay = document.createElement('div');
  overlay.className = 'account-action-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'account-action-dialog server-appearance-dialog';

  const heading = document.createElement('h3');
  heading.textContent = 'Server Appearance';
  const copy = document.createElement('p');
  copy.className = 'account-action-copy';
  copy.textContent = currentServerName || 'Server visuals';

  const preview = document.createElement('div');
  preview.className = 'server-appearance-preview';
  const previewBanner = document.createElement('div');
  previewBanner.className = 'server-appearance-preview-banner';
  const previewIcon = document.createElement('div');
  previewIcon.className = 'server-appearance-preview-icon';
  const previewName = document.createElement('strong');
  previewName.textContent = currentServerName || 'Server';
  preview.appendChild(previewBanner);
  preview.appendChild(previewIcon);
  preview.appendChild(previewName);

  const form = document.createElement('form');
  form.className = 'account-action-form';

  const iconLabel = document.createElement('label');
  iconLabel.textContent = 'Icon URL';
  const iconInput = document.createElement('input');
  iconInput.name = 'serverIconUrl';
  iconInput.value = currentServerIconUrl || '';
  iconInput.placeholder = 'https://example.com/icon.png';
  iconInput.required = false;
  iconLabel.appendChild(iconInput);

  const bannerLabel = document.createElement('label');
  bannerLabel.textContent = 'Banner URL';
  const bannerInput = document.createElement('input');
  bannerInput.name = 'serverBannerUrl';
  bannerInput.value = currentServerBannerUrl || '';
  bannerInput.placeholder = 'https://example.com/banner.png';
  bannerInput.required = false;
  bannerLabel.appendChild(bannerInput);

  const uploadRow = document.createElement('div');
  uploadRow.className = 'server-appearance-upload-row';
  const iconUploadButton = document.createElement('button');
  iconUploadButton.type = 'button';
  iconUploadButton.className = 'account-action-cancel';
  iconUploadButton.textContent = 'Upload Icon';
  const bannerUploadButton = document.createElement('button');
  bannerUploadButton.type = 'button';
  bannerUploadButton.className = 'account-action-cancel';
  bannerUploadButton.textContent = 'Upload Banner';
  uploadRow.appendChild(iconUploadButton);
  uploadRow.appendChild(bannerUploadButton);

  const iconFileInput = document.createElement('input');
  iconFileInput.type = 'file';
  iconFileInput.accept = 'image/*';
  iconFileInput.className = 'is-hidden';
  const bannerFileInput = document.createElement('input');
  bannerFileInput.type = 'file';
  bannerFileInput.accept = 'image/*';
  bannerFileInput.className = 'is-hidden';

  const error = document.createElement('div');
  error.className = 'account-action-error';

  const actions = document.createElement('div');
  actions.className = 'account-action-buttons';
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'account-action-cancel';
  cancelButton.textContent = 'Cancel';
  const saveButton = document.createElement('button');
  saveButton.type = 'submit';
  saveButton.className = 'account-action-submit';
  saveButton.textContent = 'Save Appearance';
  actions.appendChild(cancelButton);
  actions.appendChild(saveButton);

  const updatePreview = () => {
    const iconUrl = iconInput.value.trim();
    const bannerUrl = bannerInput.value.trim();
    previewBanner.style.backgroundImage = bannerUrl
      ? `linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(35, 36, 40, 0.62)), url("${cssString(resolveMediaUrl(bannerUrl))}")`
      : '';
    previewIcon.innerHTML = '';
    previewIcon.appendChild(createServerIconElement(currentServerName, iconUrl, 'server-appearance-preview-icon-inner'));
  };

  const close = () => overlay.remove();
  cancelButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  iconInput.addEventListener('input', updatePreview);
  bannerInput.addEventListener('input', updatePreview);
  iconUploadButton.addEventListener('click', () => iconFileInput.click());
  bannerUploadButton.addEventListener('click', () => bannerFileInput.click());

  const handleUpload = async (fileInput, targetInput, button, busyLabel) => {
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      setBusyState(button, true, busyLabel);
      const url = await uploadImageFile(file);
      targetInput.value = url;
      updatePreview();
      showAppMessage('Image uploaded.', 'success');
    } catch (uploadError) {
      error.textContent = getApiErrorMessage(uploadError, 'Could not upload image.');
    } finally {
      fileInput.value = '';
      setBusyState(button, false);
    }
  };

  iconFileInput.addEventListener('change', () => handleUpload(iconFileInput, iconInput, iconUploadButton, 'Uploading...'));
  bannerFileInput.addEventListener('change', () => handleUpload(bannerFileInput, bannerInput, bannerUploadButton, 'Uploading...'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    const serverIconUrl = iconInput.value.trim();
    const serverBannerUrl = bannerInput.value.trim();

    try {
      setBusyState(saveButton, true, 'Saving...');
      const res = await axios.post(`${homeApiBase}/api/Server/UpdateServerAppearance`, {
        serverId: selectedServerID,
        serverIconUrl,
        serverBannerUrl,
      });
      const server = res.data || { serverIconUrl, serverBannerUrl };
      applyServerAppearanceState(server);
      renderCurrentServerHeader(currentServerRole);
      upsertServerListItem({
        ...(server || {}),
        serverID: getServerListingId(server) || selectedServerID,
        serverName: getServerField(server, 'serverName') || currentServerName,
        role: getServerField(server, 'role') || currentServerRole,
      });
      await fetchServerDetails();
      showAppMessage('Server appearance updated.', 'success');
      close();
    } catch (saveError) {
      error.textContent = getApiErrorMessage(saveError, 'Could not save server appearance.');
    } finally {
      setBusyState(saveButton, false);
    }
  });

  form.appendChild(iconLabel);
  form.appendChild(bannerLabel);
  form.appendChild(uploadRow);
  form.appendChild(iconFileInput);
  form.appendChild(bannerFileInput);
  form.appendChild(error);
  form.appendChild(actions);

  dialog.appendChild(heading);
  dialog.appendChild(copy);
  dialog.appendChild(preview);
  dialog.appendChild(form);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  updatePreview();
  iconInput.focus();
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

function getServerWelcomeProgressKey(serverId = selectedServerID) {
  return `mydiscord.serverWelcomeProgress.${JWTusername || 'guest'}.${serverId || 'unknown'}`;
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
    localStorage.removeItem(getServerWelcomeProgressKey(serverId));
  } catch {
    // Local storage can be unavailable in hardened webviews; server completion still applies.
  }
}

function readServerWelcomeProgress(serverId = selectedServerID) {
  try {
    const raw = localStorage.getItem(getServerWelcomeProgressKey(serverId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((index) => Number.isInteger(index)) : [];
  } catch {
    return [];
  }
}

function writeServerWelcomeProgress(indexes = [], serverId = selectedServerID) {
  const normalized = Array.from(new Set(indexes.filter((index) => Number.isInteger(index))));
  try {
    localStorage.setItem(getServerWelcomeProgressKey(serverId), JSON.stringify(normalized));
  } catch {
    // Progress is a convenience layer; the server completion flag remains canonical.
  }
  return normalized;
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
  if (currentServerBannerUrl) {
    header.style.backgroundImage = `linear-gradient(90deg, rgba(35, 36, 40, 0.88), rgba(35, 36, 40, 0.68)), url("${cssString(resolveMediaUrl(currentServerBannerUrl))}")`;
  }

  const icon = document.createElement('div');
  icon.className = 'server-welcome-icon';
  icon.appendChild(createServerIconElement(currentServerName, currentServerIconUrl, 'server-welcome-icon-inner'));

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
  closeButton.addEventListener('click', () => {
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
  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'account-action-submit';

  let activeScreen = 0;
  let completedSteps = readServerWelcomeProgress()
    .filter((index) => index >= 0 && index < currentServerWelcomeChecklist.length);

  const toggleWelcomeStep = (index) => {
    completedSteps = completedSteps.includes(index)
      ? completedSteps.filter((item) => item !== index)
      : [...completedSteps, index];
    writeServerWelcomeProgress(completedSteps);
    renderScreen();
  };

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
      const progress = document.createElement('div');
      progress.className = 'server-welcome-progress';
      progress.textContent = `${completedSteps.length}/${currentServerWelcomeChecklist.length} steps checked`;
      body.appendChild(progress);

      const checklist = document.createElement('div');
      checklist.className = 'server-welcome-checklist';
      currentServerWelcomeChecklist.forEach((item, index) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'server-welcome-check-item';
        row.classList.toggle('complete', completedSteps.includes(index));
        row.addEventListener('click', () => toggleWelcomeStep(index));
        const marker = document.createElement('span');
        marker.textContent = completedSteps.includes(index) ? 'OK' : String(index + 1);
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

    backButton.disabled = false;
    backButton.textContent = activeScreen === 0 ? 'Later' : 'Back';
    const allStepsChecked = currentServerWelcomeChecklist.length === 0 ||
      completedSteps.length >= currentServerWelcomeChecklist.length;
    nextButton.disabled = activeScreen === 1 && !preview && !allStepsChecked;
    nextButton.textContent = activeScreen === 0
      ? 'Next'
      : preview
        ? 'Close'
        : allStepsChecked
          ? 'Finish'
          : `Finish (${completedSteps.length}/${currentServerWelcomeChecklist.length})`;
  };

  backButton.addEventListener('click', () => {
    if (activeScreen === 0) {
      closeServerWelcomeScreen();
      return;
    }
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

const AUTOMOD_TRIGGER_OPTIONS = [
  { value: 'keyword', label: 'Keyword' },
  { value: 'invite_link', label: 'Invite link' },
  { value: 'mention_spam', label: 'Mention spam' },
  { value: 'link', label: 'Link' },
];

function getAutoModField(rule = {}, key, fallback = '') {
  const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
  return rule[key] ?? rule[pascalKey] ?? fallback;
}

function getAutoModRuleId(rule = {}) {
  return String(getAutoModField(rule, 'id', '') || '');
}

function formatAutoModTrigger(rule = {}) {
  const triggerType = getAutoModField(rule, 'triggerType', 'keyword');
  const triggerValue = getAutoModField(rule, 'triggerValue', '');
  if (triggerType === 'mention_spam') {
    return `Mention spam > ${triggerValue || '5'}`;
  }
  if (triggerType === 'invite_link' || triggerType === 'link') {
    return formatRoleName(triggerType);
  }
  return triggerValue ? `Keyword: ${triggerValue}` : 'Keyword';
}

function formatAutoModAction(rule = {}) {
  const actionType = getAutoModField(rule, 'actionType', 'block_message');
  return actionType === 'flag' ? 'Flag' : 'Block message';
}

function renderAutoModRules(list, status, reload) {
  list.innerHTML = '';
  if (!currentServerAutoModRules.length) {
    const empty = document.createElement('div');
    empty.className = 'automod-empty';
    empty.textContent = 'No AutoMod rules yet.';
    list.appendChild(empty);
    return;
  }

  currentServerAutoModRules.forEach((rule) => {
    const row = document.createElement('div');
    row.className = 'automod-rule-row';
    row.classList.toggle('disabled', getAutoModField(rule, 'isEnabled', true) === false);

    const marker = document.createElement('span');
    marker.className = 'automod-rule-marker';
    marker.textContent = getAutoModField(rule, 'isEnabled', true) === false ? 'Off' : 'On';

    const copy = document.createElement('div');
    copy.className = 'automod-rule-copy';
    const name = document.createElement('strong');
    name.textContent = getAutoModField(rule, 'name', 'AutoMod rule');
    const meta = document.createElement('span');
    meta.textContent = `${formatAutoModTrigger(rule)} | ${formatAutoModAction(rule)} | ${getAutoModField(rule, 'timesTriggered', 0)} hits`;
    copy.appendChild(name);
    copy.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'automod-rule-actions';
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'server-tool-btn';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => openAutoModRuleEditor(rule, reload));
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'settings-btn-danger settings-btn-compact';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => deleteAutoModRule(rule, reload, status));
    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    row.appendChild(marker);
    row.appendChild(copy);
    row.appendChild(actions);
    list.appendChild(row);
  });
}

async function openAutoModRulesDialog() {
  if (!selectedServerID) return;

  closeAccountActionDialog();

  const overlay = document.createElement('div');
  overlay.className = 'account-action-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'account-action-dialog automod-dialog';

  const header = document.createElement('div');
  header.className = 'automod-dialog-header';
  const titleBlock = document.createElement('div');
  const heading = document.createElement('h3');
  heading.textContent = 'AutoMod';
  const copy = document.createElement('p');
  copy.className = 'account-action-copy';
  copy.textContent = currentServerName || 'Server moderation';
  titleBlock.appendChild(heading);
  titleBlock.appendChild(copy);
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'account-action-submit';
  addButton.textContent = '+ Rule';
  header.appendChild(titleBlock);
  header.appendChild(addButton);

  const status = document.createElement('div');
  status.className = 'role-manager-status';
  status.setAttribute('role', 'status');

  const list = document.createElement('div');
  list.className = 'automod-rule-list';

  const actions = document.createElement('div');
  actions.className = 'account-action-buttons';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'account-action-cancel';
  closeButton.textContent = 'Close';
  actions.appendChild(closeButton);

  const reload = async () => {
    status.textContent = 'Loading rules...';
    try {
      const res = await axios.get(
        `${homeApiBase}/api/Server/GetAutoModRules?serverId=${encodeURIComponent(selectedServerID)}`
      );
      currentServerAutoModRules = Array.isArray(res.data) ? res.data : [];
      status.textContent = `${currentServerAutoModRules.length} rules`;
      status.dataset.variant = '';
      renderAutoModRules(list, status, reload);
    } catch (error) {
      status.textContent = getApiErrorMessage(error, 'Could not load AutoMod rules.');
      status.dataset.variant = 'error';
    }
  };

  addButton.addEventListener('click', () => openAutoModRuleEditor(null, reload));
  closeButton.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove();
  });

  dialog.appendChild(header);
  dialog.appendChild(status);
  dialog.appendChild(list);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  await reload();
}

async function openAutoModRuleEditor(rule = null, reload = null) {
  const isEdit = Boolean(rule);
  const values = await openSimpleFormDialog({
    title: isEdit ? 'Edit AutoMod Rule' : 'New AutoMod Rule',
    description: 'Keyword rules use comma or line-separated terms. Mention spam rules use a numeric threshold.',
    fields: [
      {
        name: 'name',
        label: 'Rule name',
        value: isEdit ? getAutoModField(rule, 'name', '') : '',
        maxLength: 80,
      },
      {
        name: 'triggerType',
        label: 'Trigger',
        value: isEdit ? getAutoModField(rule, 'triggerType', 'keyword') : 'keyword',
        options: AUTOMOD_TRIGGER_OPTIONS,
      },
      {
        name: 'triggerValue',
        label: 'Trigger value',
        type: 'textarea',
        rows: 4,
        value: isEdit ? getAutoModField(rule, 'triggerValue', '') : '',
        maxLength: 1000,
        required: false,
      },
      {
        name: 'actionType',
        label: 'Action',
        value: isEdit ? getAutoModField(rule, 'actionType', 'block_message') : 'block_message',
        options: [
          { value: 'block_message', label: 'Block message' },
          { value: 'flag', label: 'Flag in audit log' },
        ],
      },
      {
        name: 'isEnabled',
        label: 'Status',
        value: isEdit && getAutoModField(rule, 'isEnabled', true) === false ? 'false' : 'true',
        options: [
          { value: 'true', label: 'Enabled' },
          { value: 'false', label: 'Disabled' },
        ],
      },
    ],
    confirmText: isEdit ? 'Save' : 'Create',
    preserveExisting: true,
  });

  if (!values) return;

  const payload = {
    ruleId: isEdit ? getAutoModRuleId(rule) : null,
    serverId: selectedServerID,
    name: values.name,
    triggerType: values.triggerType,
    triggerValue: values.triggerValue,
    actionType: values.actionType,
    isEnabled: values.isEnabled === 'true',
  };

  try {
    const endpoint = isEdit ? 'UpdateAutoModRule' : 'CreateAutoModRule';
    await axios.post(`${homeApiBase}/api/Server/${endpoint}`, payload);
    showAppMessage(isEdit ? 'AutoMod rule saved.' : 'AutoMod rule created.', 'success');
    if (reload) await reload();
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not save AutoMod rule.'), 'error');
  }
}

async function deleteAutoModRule(rule, reload, status) {
  if (!await askConfirm(
    'Delete AutoMod Rule',
    `Delete ${getAutoModField(rule, 'name', 'this rule')}?`,
    { danger: true, confirmText: 'Delete', preserveExisting: true }
  )) return;

  try {
    await axios.post(`${homeApiBase}/api/Server/DeleteAutoModRule`, {
      serverId: selectedServerID,
      ruleId: getAutoModRuleId(rule),
    });
    showAppMessage('AutoMod rule deleted.', 'success');
    if (reload) await reload();
  } catch (error) {
    if (status) {
      status.textContent = getApiErrorMessage(error, 'Could not delete AutoMod rule.');
      status.dataset.variant = 'error';
    }
    showAppMessage(getApiErrorMessage(error, 'Could not delete AutoMod rule.'), 'error');
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

async function openChannelPermissionsDialog(initialChannelId = null) {
  const channels = currentServerChannels.filter((channel) => channel.id);
  if (!selectedServerID || channels.length === 0) {
    showAppMessage('Create a channel first.', 'error');
    return;
  }

  closeAccountActionDialog();

  const overlay = document.createElement('div');
  overlay.className = 'account-action-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'account-action-dialog voice-permissions-dialog channel-permissions-dialog';

  const heading = document.createElement('h3');
  heading.textContent = 'Channel Permissions';
  dialog.appendChild(heading);

  const copy = document.createElement('p');
  copy.className = 'account-action-copy';
  copy.textContent = 'Choose which roles can view, send, connect, or speak in a channel.';
  dialog.appendChild(copy);

  const form = document.createElement('form');
  form.className = 'account-action-form';

  const channelLabel = document.createElement('label');
  channelLabel.textContent = 'Channel';
  const channelSelect = document.createElement('select');
  channelSelect.className = 'account-action-select';
  channels.forEach((channel) => {
    const option = document.createElement('option');
    option.value = channel.id;
    option.textContent = `${getChannelTypeIcon(channel.type)} ${channel.name}`;
    channelSelect.appendChild(option);
  });
  channelSelect.value =
    channels.some((channel) => channel.id === initialChannelId)
      ? initialChannelId
      : channels[0].id;
  channelLabel.appendChild(channelSelect);
  form.appendChild(channelLabel);

  const loading = document.createElement('p');
  loading.className = 'form-desc';
  loading.textContent = 'Loading permissions...';
  form.appendChild(loading);

  const rowsContainer = document.createElement('div');
  rowsContainer.className = 'voice-permission-rows channel-permission-rows';
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
        `${homeApiBase}/api/Server/GetChannelPermissions?channelId=${encodeURIComponent(channelSelect.value)}`
      );
      activePermissions = res.data;
      loading.textContent = '';

      const channelType = activePermissions.type || 'text';
      const isText = channelType === 'text';
      const isVoiceLike = isVoiceLikeChannelType(channelType);
      const isStage = channelType === 'stage';
      const restrictionToggles = [];

      const addRestrictionToggle = (name, checked, labelText) => {
        const label = document.createElement('label');
        label.className = 'voice-permission-toggle channel-permission-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = name;
        input.checked = Boolean(checked);
        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${labelText}`));
        rowsContainer.appendChild(label);
        restrictionToggles.push(input);
        return input;
      };

      const viewToggle = addRestrictionToggle(
        'viewAccessRestricted',
        activePermissions.viewAccessRestricted,
        'Restrict who can view this channel'
      );
      const sendToggle = isText
        ? addRestrictionToggle(
            'messageSendRestricted',
            activePermissions.messageSendRestricted,
            'Restrict who can send messages'
          )
        : null;
      const connectToggle = isVoiceLike
        ? addRestrictionToggle(
            'voiceAccessRestricted',
            activePermissions.voiceAccessRestricted,
            'Restrict who can connect'
          )
        : null;
      const speakToggle = isStage
        ? addRestrictionToggle(
            'stageSpeakerRestricted',
            activePermissions.stageSpeakerRestricted,
            'Restrict who can speak on stage'
          )
        : null;

      const viewRoles = new Set(parseRoleNameList(activePermissions.viewAllowedRoleNames));
      const sendRoles = new Set(parseRoleNameList(activePermissions.messageSendAllowedRoleNames));
      const allowedRoles = new Set(parseRoleNameList(activePermissions.voiceAllowedRoleNames));
      const speakerRoles = new Set(parseRoleNameList(activePermissions.stageSpeakerRoleNames));
      const roleRows = document.createElement('div');
      roleRows.className = 'voice-permission-role-list channel-permission-role-list';

      const appendPermissionInput = (row, permission, labelText, checked, disabled) => {
        const permissionLabel = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.permission = permission;
        input.checked = checked;
        input.disabled = disabled;
        permissionLabel.appendChild(input);
        permissionLabel.appendChild(document.createTextNode(` ${labelText}`));
        row.appendChild(permissionLabel);
      };

      (activePermissions.roles || []).forEach((role) => {
        const roleName = normalizeRoleName(role.name);
        const row = document.createElement('div');
        row.className = 'voice-permission-row channel-permission-row';
        row.dataset.role = roleName;

        const name = document.createElement('span');
        name.className = 'voice-permission-role-name';
        name.textContent = roleName;
        applyRoleColorStyle(name, roleName, role.color);
        row.appendChild(name);

        appendPermissionInput(row, 'view', 'View', !viewToggle.checked || viewRoles.has(roleName), !viewToggle.checked);
        if (sendToggle) {
          appendPermissionInput(row, 'send', 'Send', !sendToggle.checked || sendRoles.has(roleName), !sendToggle.checked);
        }
        if (connectToggle) {
          appendPermissionInput(row, 'connect', 'Connect', !connectToggle.checked || allowedRoles.has(roleName), !connectToggle.checked);
        }
        if (speakToggle) {
          appendPermissionInput(row, 'speak', 'Speak', !speakToggle.checked || speakerRoles.has(roleName), !speakToggle.checked);
        }

        roleRows.appendChild(row);
      });

      const syncPermissionInputs = (toggle, permission) => {
        roleRows.querySelectorAll(`input[data-permission="${permission}"]`).forEach((input) => {
          input.disabled = !toggle.checked;
          if (!toggle.checked) input.checked = true;
        });
      };

      viewToggle.addEventListener('change', () => syncPermissionInputs(viewToggle, 'view'));
      if (sendToggle) sendToggle.addEventListener('change', () => syncPermissionInputs(sendToggle, 'send'));
      if (connectToggle) connectToggle.addEventListener('change', () => syncPermissionInputs(connectToggle, 'connect'));
      if (speakToggle) speakToggle.addEventListener('change', () => syncPermissionInputs(speakToggle, 'speak'));

      if (restrictionToggles.length > 0) {
        const note = document.createElement('p');
        note.className = 'channel-permission-scope-note';
        note.textContent = 'Roles with server or channel management can still reach restricted channels.';
        rowsContainer.appendChild(note);
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

    const channelType = activePermissions.type || 'text';
    const viewAccessRestricted = Boolean(form.elements.viewAccessRestricted?.checked);
    const messageSendRestricted = channelType === 'text' && Boolean(form.elements.messageSendRestricted?.checked);
    const voiceAccessRestricted = isVoiceLikeChannelType(channelType) && Boolean(form.elements.voiceAccessRestricted?.checked);
    const stageSpeakerRestricted = channelType === 'stage' && Boolean(form.elements.stageSpeakerRestricted?.checked);
    const roleRows = [...rowsContainer.querySelectorAll('.channel-permission-row')];
    const selectedRolesFor = (permission) => roleRows
      .filter((row) => row.querySelector(`input[data-permission="${permission}"]`)?.checked)
      .map((row) => row.dataset.role);

    const viewAllowedRoleNames = selectedRolesFor('view');
    const messageSendAllowedRoleNames = selectedRolesFor('send');
    const voiceAllowedRoleNames = selectedRolesFor('connect');
    const stageSpeakerRoleNames = selectedRolesFor('speak');

    if (viewAccessRestricted && viewAllowedRoleNames.length === 0) {
      showAppMessage('Allow at least one role to view this channel.', 'error');
      return;
    }
    if (messageSendRestricted && messageSendAllowedRoleNames.length === 0) {
      showAppMessage('Allow at least one role to send messages.', 'error');
      return;
    }
    if (voiceAccessRestricted && voiceAllowedRoleNames.length === 0) {
      showAppMessage('Allow at least one role to connect.', 'error');
      return;
    }
    if (stageSpeakerRestricted && stageSpeakerRoleNames.length === 0) {
      showAppMessage('Allow at least one role to speak on stage.', 'error');
      return;
    }

    try {
      setBusyState(saveButton, true, 'Saving...');
      await axios.post(`${homeApiBase}/api/Server/UpdateChannelPermissions`, {
        channelId: channelSelect.value,
        viewAccessRestricted,
        viewAllowedRoleNames,
        messageSendRestricted,
        messageSendAllowedRoleNames,
        voiceAccessRestricted,
        voiceAllowedRoleNames,
        stageSpeakerRestricted,
        stageSpeakerRoleNames,
      });
      await fetchServerDetails();
      close();
      showAppMessage('Channel permissions updated.', 'success');
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not save channel permissions.'), 'error');
    } finally {
      setBusyState(saveButton, false);
    }
  });

  dialog.appendChild(form);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  renderPermissions();
}

function openVoiceChannelPermissionsDialog(initialChannelId = null) {
  return openChannelPermissionsDialog(initialChannelId);
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

function getIntegrationField(item = {}, key, fallback = '') {
  const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
  return item[key] ?? item[pascalKey] ?? fallback;
}

function getTextChannelOptions() {
  return currentServerChannels
    .filter((channel) => channel.type === 'text')
    .map((channel) => ({
      value: channel.id,
      label: `# ${channel.name}`,
    }));
}

function getIntegrationRoleOptions(roles = currentServerRoles) {
  const sourceRoles = roles.length
    ? roles
    : [{ name: 'user' }, { name: 'moderator' }, { name: 'admin' }];
  return sourceRoles
    .map((role) => getServerRoleName(role))
    .filter((roleName) => roleName !== 'owner')
    .filter((roleName, index, all) => all.indexOf(roleName) === index)
    .map((roleName) => ({
      value: roleName,
      label: formatRoleName(roleName),
    }));
}

async function copyIntegrationValue(value, successMessage = 'Copied.') {
  if (!value || !navigator.clipboard) {
    showAppMessage('Clipboard is not available.', 'error');
    return;
  }

  await navigator.clipboard.writeText(value);
  showAppMessage(successMessage, 'success');
}

function openIntegrationSecretDialog({ title, description = '', values = [] }) {
  const overlay = document.createElement('div');
  overlay.className = 'account-action-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'account-action-dialog integration-secret-dialog';

  const heading = document.createElement('h3');
  heading.textContent = title;
  dialog.appendChild(heading);

  if (description) {
    const copy = document.createElement('p');
    copy.className = 'account-action-copy';
    copy.textContent = description;
    dialog.appendChild(copy);
  }

  const list = document.createElement('div');
  list.className = 'integration-secret-list';
  values.forEach(({ label, value }) => {
    if (!value) return;
    const row = document.createElement('div');
    row.className = 'integration-secret-row';
    const rowLabel = document.createElement('span');
    rowLabel.textContent = label;
    const input = document.createElement('input');
    input.className = 'integration-code-input';
    input.value = value;
    input.readOnly = true;
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'server-tool-btn';
    copyButton.textContent = 'Copy';
    copyButton.addEventListener('click', () => copyIntegrationValue(value));
    row.appendChild(rowLabel);
    row.appendChild(input);
    row.appendChild(copyButton);
    list.appendChild(row);
  });
  dialog.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'account-action-buttons';
  const doneButton = document.createElement('button');
  doneButton.type = 'button';
  doneButton.className = 'account-action-submit';
  doneButton.textContent = 'Done';
  actions.appendChild(doneButton);
  dialog.appendChild(actions);

  const close = () => overlay.remove();
  doneButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  dialog.querySelector('input')?.select();
}

function openServerIntegrationsDialog() {
  if (!selectedServerID) {
    return;
  }

  closeAccountActionDialog();

  let bots = [];
  let webhooks = [];
  let registeredCommands = [];
  let roles = [];
  let isLoading = false;

  const overlay = document.createElement('div');
  overlay.className = 'account-action-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'account-action-dialog integrations-dialog';

  const header = document.createElement('div');
  header.className = 'integration-manager-header';
  const titleBlock = document.createElement('div');
  const heading = document.createElement('h3');
  heading.textContent = 'Integrations';
  const copy = document.createElement('p');
  copy.className = 'account-action-copy';
  copy.textContent = currentServerName || 'Server integrations';
  titleBlock.appendChild(heading);
  titleBlock.appendChild(copy);

  const headerActions = document.createElement('div');
  headerActions.className = 'integration-header-actions';
  const addBotButton = document.createElement('button');
  addBotButton.type = 'button';
  addBotButton.className = 'account-action-submit';
  addBotButton.textContent = '+ Bot';
  const addWebhookButton = document.createElement('button');
  addWebhookButton.type = 'button';
  addWebhookButton.className = 'account-action-submit';
  addWebhookButton.textContent = '+ Webhook';
  const addCommandButton = document.createElement('button');
  addCommandButton.type = 'button';
  addCommandButton.className = 'account-action-submit';
  addCommandButton.textContent = '+ Command';
  headerActions.appendChild(addBotButton);
  headerActions.appendChild(addWebhookButton);
  headerActions.appendChild(addCommandButton);
  header.appendChild(titleBlock);
  header.appendChild(headerActions);

  const status = document.createElement('div');
  status.className = 'role-manager-status';
  status.setAttribute('role', 'status');

  const grid = document.createElement('div');
  grid.className = 'integration-grid';
  const botsPanel = document.createElement('section');
  botsPanel.className = 'integration-panel';
  const webhooksPanel = document.createElement('section');
  webhooksPanel.className = 'integration-panel';
  const commandsPanel = document.createElement('section');
  commandsPanel.className = 'integration-panel';
  grid.appendChild(botsPanel);
  grid.appendChild(webhooksPanel);
  grid.appendChild(commandsPanel);

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

  const renderIntegrationRow = (kind, item) => {
    const row = document.createElement('div');
    row.className = 'integration-row';
    row.dataset.kind = kind;
    row.classList.toggle('is-disabled', !getIntegrationField(item, 'isEnabled', true));

    const marker = document.createElement('div');
    marker.className = 'integration-marker';
    marker.textContent = kind === 'bot' ? 'B' : kind === 'webhook' ? 'W' : '/';

    const copyBlock = document.createElement('div');
    copyBlock.className = 'integration-row-copy';
    const name = document.createElement('strong');
    name.textContent = kind === 'bot'
      ? getIntegrationField(item, 'displayName', getIntegrationField(item, 'username', 'Bot'))
      : kind === 'webhook'
        ? getIntegrationField(item, 'name', 'Webhook')
        : getIntegrationField(item, 'usage', `/${getIntegrationField(item, 'name', 'command')}`);
    const meta = document.createElement('span');
    if (kind === 'bot') {
      meta.textContent = `${formatRoleName(getIntegrationField(item, 'role', 'user'))} role`;
    } else if (kind === 'webhook') {
      meta.textContent = getIntegrationField(item, 'channelName', 'Text channel');
    } else {
      meta.textContent = `${getIntegrationField(item, 'botDisplayName', 'Bot')} | ${getIntegrationField(item, 'description', 'Slash command')}`;
    }
    copyBlock.appendChild(name);
    copyBlock.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'integration-row-actions';
    const actionDefinitions = kind === 'command'
      ? [
        ['Edit', () => editSlashCommand(item)],
        [
          getIntegrationField(item, 'isEnabled', true) ? 'Disable' : 'Enable',
          () => toggleSlashCommand(item),
        ],
        ['Delete', () => deleteSlashCommand(item)],
      ]
      : [
        ['Edit', () => kind === 'bot' ? editBot(item) : editWebhook(item)],
        ['Rotate', () => kind === 'bot' ? rotateBotToken(item) : rotateWebhookToken(item)],
        [
          getIntegrationField(item, 'isEnabled', true) ? 'Disable' : 'Enable',
          () => kind === 'bot' ? toggleBot(item) : toggleWebhook(item),
        ],
        ['Delete', () => kind === 'bot' ? deleteBot(item) : deleteWebhook(item)],
      ];

    actionDefinitions.forEach(([label, handler]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'server-tool-btn';
      button.textContent = label;
      button.addEventListener('click', handler);
      actions.appendChild(button);
    });

    row.appendChild(marker);
    row.appendChild(copyBlock);
    row.appendChild(actions);
    return row;
  };

  const renderPanel = (panel, title, items, kind) => {
    panel.innerHTML = '';
    const panelHeader = document.createElement('div');
    panelHeader.className = 'integration-panel-header';
    const panelTitle = document.createElement('h4');
    panelTitle.textContent = title;
    const panelCount = document.createElement('span');
    panelCount.textContent = String(items.length);
    panelHeader.appendChild(panelTitle);
    panelHeader.appendChild(panelCount);
    panel.appendChild(panelHeader);

    const list = document.createElement('div');
    list.className = 'integration-list';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state-card padded';
      empty.textContent = kind === 'bot'
        ? 'No bot accounts yet.'
        : kind === 'webhook'
          ? 'No webhooks yet.'
          : 'No slash commands yet.';
      list.appendChild(empty);
    } else {
      items.forEach((item) => list.appendChild(renderIntegrationRow(kind, item)));
    }
    panel.appendChild(list);
  };

  const render = () => {
    renderPanel(botsPanel, 'Bot Accounts', bots, 'bot');
    renderPanel(webhooksPanel, 'Webhooks', webhooks, 'webhook');
    renderPanel(commandsPanel, 'Slash Commands', registeredCommands, 'command');
  };

  const confirmIntegrationAction = async (title, description, { danger = false, confirmText = 'Confirm' } = {}) => {
    const result = await openSimpleFormDialog({
      title,
      description,
      fields: [],
      danger,
      confirmText,
      preserveExisting: true,
    });
    return result !== null;
  };

  const load = async () => {
    if (isLoading) return;
    isLoading = true;
    setStatus('Loading integrations...');
    try {
      const [botRes, webhookRes, commandRes, loadedRoles] = await Promise.all([
        axios.get(`${homeApiBase}/api/ServerIntegrations/GetBotAccounts?serverId=${encodeURIComponent(selectedServerID)}`),
        axios.get(`${homeApiBase}/api/ServerIntegrations/GetWebhooks?serverId=${encodeURIComponent(selectedServerID)}`),
        axios.get(`${homeApiBase}/api/ServerIntegrations/GetSlashCommands?serverId=${encodeURIComponent(selectedServerID)}`),
        fetchServerRoles({ force: true, silent: true }).catch(() => []),
      ]);
      bots = Array.isArray(botRes.data) ? botRes.data : [];
      webhooks = Array.isArray(webhookRes.data) ? webhookRes.data : [];
      registeredCommands = Array.isArray(commandRes.data) ? commandRes.data : [];
      roles = loadedRoles;
      currentServerSlashCommands = registeredCommands.map(normalizeRemoteSlashCommand).filter(Boolean);
      currentServerSlashCommandServerId = selectedServerID;
      setStatus(`${bots.length} bots | ${webhooks.length} webhooks | ${registeredCommands.length} commands`);
      render();
    } catch (error) {
      setStatus(getApiErrorMessage(error, 'Could not load integrations.'), 'error');
    } finally {
      isLoading = false;
    }
  };

  const showBotSecret = (bot) => {
    openIntegrationSecretDialog({
      title: 'Bot Token',
      description: 'Store this token now. It is only shown after creation or rotation.',
      values: [
        { label: 'Token', value: getIntegrationField(bot, 'botToken', '') },
        { label: 'Authorization', value: getIntegrationField(bot, 'authorizationHeader', '') },
      ],
    });
  };

  const showWebhookSecret = (webhook) => {
    openIntegrationSecretDialog({
      title: 'Webhook URL',
      description: 'Store this URL now. It is only shown after creation or rotation.',
      values: [
        { label: 'URL', value: getIntegrationField(webhook, 'url', '') },
        { label: 'Token', value: getIntegrationField(webhook, 'webhookToken', '') },
      ],
    });
  };

  const getBotOptions = () => bots.map((bot) => ({
    value: getIntegrationField(bot, 'id', ''),
    label: getIntegrationField(bot, 'displayName', getIntegrationField(bot, 'username', 'Bot')),
  })).filter((option) => option.value);

  const getSlashCommandPayload = (values, command = null) => ({
    commandId: command ? getIntegrationField(command, 'id', '') : null,
    serverId: selectedServerID,
    botAccountId: values.botAccountId,
    name: values.name,
    description: values.description,
    usage: values.usage || null,
    isEnabled: values.isEnabled === undefined ? true : values.isEnabled === 'true',
  });

  const createBot = async () => {
    const values = await openSimpleFormDialog({
      title: 'Create Bot Account',
      fields: [
        { name: 'name', label: 'Bot name', maxLength: 80 },
        { name: 'role', label: 'Role', value: 'user', options: getIntegrationRoleOptions(roles) },
        { name: 'avatarUrl', label: 'Avatar URL', required: false },
        { name: 'description', label: 'Description', type: 'textarea', rows: 3, maxLength: 240, required: false },
      ],
      confirmText: 'Create Bot',
      preserveExisting: true,
    });
    if (!values) return;

    try {
      const res = await axios.post(`${homeApiBase}/api/ServerIntegrations/CreateBotAccount`, {
        serverId: selectedServerID,
        name: values.name,
        role: values.role || 'user',
        avatarUrl: values.avatarUrl || null,
        description: values.description || null,
      });
      showBotSecret(res.data || {});
      await load();
      await fetchServerMembers();
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not create bot account.'), 'error');
    }
  };

  const editBot = async (bot) => {
    const values = await openSimpleFormDialog({
      title: 'Edit Bot Account',
      fields: [
        { name: 'name', label: 'Bot name', value: getIntegrationField(bot, 'displayName', ''), maxLength: 80 },
        { name: 'role', label: 'Role', value: getIntegrationField(bot, 'role', 'user'), options: getIntegrationRoleOptions(roles) },
        { name: 'avatarUrl', label: 'Avatar URL', value: getIntegrationField(bot, 'avatarUrl', ''), required: false },
        { name: 'description', label: 'Description', type: 'textarea', rows: 3, maxLength: 240, value: getIntegrationField(bot, 'description', ''), required: false },
        {
          name: 'isEnabled',
          label: 'Status',
          value: getIntegrationField(bot, 'isEnabled', true) ? 'true' : 'false',
          options: [
            { value: 'true', label: 'Enabled' },
            { value: 'false', label: 'Disabled' },
          ],
        },
      ],
      confirmText: 'Save Bot',
      preserveExisting: true,
    });
    if (!values) return;

    try {
      await axios.post(`${homeApiBase}/api/ServerIntegrations/UpdateBotAccount`, {
        botId: getIntegrationField(bot, 'id', ''),
        serverId: selectedServerID,
        name: values.name,
        role: values.role || 'user',
        avatarUrl: values.avatarUrl || null,
        description: values.description || null,
        isEnabled: values.isEnabled === 'true',
      });
      await load();
      await fetchServerMembers();
      showAppMessage('Bot account saved.', 'success');
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not save bot account.'), 'error');
    }
  };

  const rotateBotToken = async (bot) => {
    if (!await confirmIntegrationAction('Rotate Bot Token', 'Existing bot clients will stop working until they use the new token.', { danger: true, confirmText: 'Rotate' })) return;
    try {
      const res = await axios.post(`${homeApiBase}/api/ServerIntegrations/RotateBotToken`, {
        botId: getIntegrationField(bot, 'id', ''),
      });
      showBotSecret(res.data || {});
      await load();
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not rotate bot token.'), 'error');
    }
  };

  const toggleBot = async (bot) => {
    try {
      await axios.post(`${homeApiBase}/api/ServerIntegrations/UpdateBotAccount`, {
        botId: getIntegrationField(bot, 'id', ''),
        serverId: selectedServerID,
        name: getIntegrationField(bot, 'displayName', ''),
        role: getIntegrationField(bot, 'role', 'user'),
        avatarUrl: getIntegrationField(bot, 'avatarUrl', '') || null,
        description: getIntegrationField(bot, 'description', '') || null,
        isEnabled: !getIntegrationField(bot, 'isEnabled', true),
      });
      await load();
      await fetchServerMembers();
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not update bot account.'), 'error');
    }
  };

  const deleteBot = async (bot) => {
    if (!await confirmIntegrationAction('Delete Bot Account', `Delete ${getIntegrationField(bot, 'displayName', 'this bot')}?`, { danger: true, confirmText: 'Delete' })) return;
    try {
      await axios.post(`${homeApiBase}/api/ServerIntegrations/DeleteBotAccount`, {
        botId: getIntegrationField(bot, 'id', ''),
      });
      await load();
      await fetchServerMembers();
      showAppMessage('Bot account deleted.', 'success');
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not delete bot account.'), 'error');
    }
  };

  const createSlashCommand = async () => {
    const botOptions = getBotOptions();
    if (!botOptions.length) {
      showAppMessage('Create a bot account before adding slash commands.', 'error');
      return;
    }

    const values = await openSimpleFormDialog({
      title: 'Create Slash Command',
      fields: [
        { name: 'botAccountId', label: 'Bot', value: botOptions[0].value, options: botOptions },
        { name: 'name', label: 'Command name', maxLength: 32, autocapitalize: 'none', spellcheck: false },
        { name: 'description', label: 'Description', maxLength: 120 },
        { name: 'usage', label: 'Usage', maxLength: 120, required: false },
      ],
      confirmText: 'Create Command',
      preserveExisting: true,
    });
    if (!values) return;

    try {
      await axios.post(`${homeApiBase}/api/ServerIntegrations/CreateSlashCommand`, getSlashCommandPayload(values));
      await load();
      showAppMessage('Slash command created.', 'success');
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not create slash command.'), 'error');
    }
  };

  const editSlashCommand = async (command) => {
    const botOptions = getBotOptions();
    const values = await openSimpleFormDialog({
      title: 'Edit Slash Command',
      fields: [
        { name: 'botAccountId', label: 'Bot', value: getIntegrationField(command, 'botAccountId', botOptions[0]?.value || ''), options: botOptions },
        { name: 'name', label: 'Command name', value: getIntegrationField(command, 'name', ''), maxLength: 32, autocapitalize: 'none', spellcheck: false },
        { name: 'description', label: 'Description', value: getIntegrationField(command, 'description', ''), maxLength: 120 },
        { name: 'usage', label: 'Usage', value: getIntegrationField(command, 'usage', ''), maxLength: 120, required: false },
        {
          name: 'isEnabled',
          label: 'Status',
          value: getIntegrationField(command, 'isEnabled', true) ? 'true' : 'false',
          options: [
            { value: 'true', label: 'Enabled' },
            { value: 'false', label: 'Disabled' },
          ],
        },
      ],
      confirmText: 'Save Command',
      preserveExisting: true,
    });
    if (!values) return;

    try {
      await axios.post(`${homeApiBase}/api/ServerIntegrations/UpdateSlashCommand`, getSlashCommandPayload(values, command));
      await load();
      showAppMessage('Slash command saved.', 'success');
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not save slash command.'), 'error');
    }
  };

  const toggleSlashCommand = async (command) => {
    try {
      await axios.post(`${homeApiBase}/api/ServerIntegrations/UpdateSlashCommand`, {
        commandId: getIntegrationField(command, 'id', ''),
        serverId: selectedServerID,
        botAccountId: getIntegrationField(command, 'botAccountId', ''),
        name: getIntegrationField(command, 'name', ''),
        description: getIntegrationField(command, 'description', ''),
        usage: getIntegrationField(command, 'usage', ''),
        isEnabled: !getIntegrationField(command, 'isEnabled', true),
      });
      await load();
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not update slash command.'), 'error');
    }
  };

  const deleteSlashCommand = async (command) => {
    if (!await confirmIntegrationAction('Delete Slash Command', `Delete /${getIntegrationField(command, 'name', 'command')}?`, { danger: true, confirmText: 'Delete' })) return;
    try {
      await axios.post(`${homeApiBase}/api/ServerIntegrations/DeleteSlashCommand`, {
        commandId: getIntegrationField(command, 'id', ''),
      });
      await load();
      showAppMessage('Slash command deleted.', 'success');
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not delete slash command.'), 'error');
    }
  };

  const createWebhook = async () => {
    const channelOptions = getTextChannelOptions();
    if (!channelOptions.length) {
      showAppMessage('Create a text channel before adding a webhook.', 'error');
      return;
    }

    const values = await openSimpleFormDialog({
      title: 'Create Webhook',
      fields: [
        { name: 'name', label: 'Webhook name', maxLength: 80 },
        { name: 'channelId', label: 'Channel', value: selectedChannelID || channelOptions[0].value, options: channelOptions },
        { name: 'avatarUrl', label: 'Avatar URL', required: false },
      ],
      confirmText: 'Create Webhook',
      preserveExisting: true,
    });
    if (!values) return;

    try {
      const res = await axios.post(`${homeApiBase}/api/ServerIntegrations/CreateWebhook`, {
        serverId: selectedServerID,
        channelId: values.channelId,
        name: values.name,
        avatarUrl: values.avatarUrl || null,
      });
      showWebhookSecret(res.data || {});
      await load();
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not create webhook.'), 'error');
    }
  };

  const editWebhook = async (webhook) => {
    const channelOptions = getTextChannelOptions();
    const values = await openSimpleFormDialog({
      title: 'Edit Webhook',
      fields: [
        { name: 'name', label: 'Webhook name', value: getIntegrationField(webhook, 'name', ''), maxLength: 80 },
        { name: 'channelId', label: 'Channel', value: getIntegrationField(webhook, 'channelId', selectedChannelID), options: channelOptions },
        { name: 'avatarUrl', label: 'Avatar URL', value: getIntegrationField(webhook, 'avatarUrl', ''), required: false },
        {
          name: 'isEnabled',
          label: 'Status',
          value: getIntegrationField(webhook, 'isEnabled', true) ? 'true' : 'false',
          options: [
            { value: 'true', label: 'Enabled' },
            { value: 'false', label: 'Disabled' },
          ],
        },
      ],
      confirmText: 'Save Webhook',
      preserveExisting: true,
    });
    if (!values) return;

    try {
      await axios.post(`${homeApiBase}/api/ServerIntegrations/UpdateWebhook`, {
        webhookId: getIntegrationField(webhook, 'id', ''),
        serverId: selectedServerID,
        channelId: values.channelId,
        name: values.name,
        avatarUrl: values.avatarUrl || null,
        isEnabled: values.isEnabled === 'true',
      });
      await load();
      showAppMessage('Webhook saved.', 'success');
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not save webhook.'), 'error');
    }
  };

  const rotateWebhookToken = async (webhook) => {
    if (!await confirmIntegrationAction('Rotate Webhook URL', 'Existing callers will stop working until they use the new URL.', { danger: true, confirmText: 'Rotate' })) return;
    try {
      const res = await axios.post(`${homeApiBase}/api/ServerIntegrations/RotateWebhookToken`, {
        webhookId: getIntegrationField(webhook, 'id', ''),
      });
      showWebhookSecret(res.data || {});
      await load();
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not rotate webhook URL.'), 'error');
    }
  };

  const toggleWebhook = async (webhook) => {
    try {
      await axios.post(`${homeApiBase}/api/ServerIntegrations/UpdateWebhook`, {
        webhookId: getIntegrationField(webhook, 'id', ''),
        serverId: selectedServerID,
        channelId: getIntegrationField(webhook, 'channelId', ''),
        name: getIntegrationField(webhook, 'name', ''),
        avatarUrl: getIntegrationField(webhook, 'avatarUrl', '') || null,
        isEnabled: !getIntegrationField(webhook, 'isEnabled', true),
      });
      await load();
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not update webhook.'), 'error');
    }
  };

  const deleteWebhook = async (webhook) => {
    if (!await confirmIntegrationAction('Delete Webhook', `Delete ${getIntegrationField(webhook, 'name', 'this webhook')}?`, { danger: true, confirmText: 'Delete' })) return;
    try {
      await axios.post(`${homeApiBase}/api/ServerIntegrations/DeleteWebhook`, {
        webhookId: getIntegrationField(webhook, 'id', ''),
      });
      await load();
      showAppMessage('Webhook deleted.', 'success');
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not delete webhook.'), 'error');
    }
  };

  addBotButton.addEventListener('click', createBot);
  addWebhookButton.addEventListener('click', createWebhook);
  addCommandButton.addEventListener('click', createSlashCommand);
  refreshButton.addEventListener('click', load);

  dialog.appendChild(header);
  dialog.appendChild(status);
  dialog.appendChild(grid);
  dialog.appendChild(footer);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  load();
}

function createRoleChip(roleName, extraClass = '', color = '') {
  const chip = document.createElement('span');
  const normalizedRole = normalizeRoleName(roleName);
  chip.className = `server-member-role-chip ${extraClass}`.trim();
  chip.dataset.role = normalizedRole;
  applyRoleColorStyle(chip, normalizedRole, color);
  chip.textContent = formatRoleName(normalizedRole);
  chip.title = normalizedRole;
  return chip;
}

function createDraftRole() {
  return normalizeServerRole({
    id: 'draft',
    name: 'new-role',
    color: DEFAULT_ROLE_COLORS.default,
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

      const swatch = document.createElement('span');
      swatch.className = 'role-color-swatch';
      applyRoleColorStyle(swatch, roleName, role.color);

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

      item.appendChild(swatch);
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
    title.appendChild(createRoleChip(roleName, 'large', role.color));
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

    const colorLabel = document.createElement('label');
    colorLabel.className = 'role-field-label';
    colorLabel.textContent = 'Role color';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.name = 'color';
    colorInput.value = normalizeHexColor(role.color, getDefaultRoleColor(roleName));
    colorInput.disabled = controlsLocked;
    colorLabel.appendChild(colorInput);
    form.appendChild(colorLabel);

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
        color: normalizeHexColor(colorInput.value, getDefaultRoleColor(normalizedName)),
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
        await fetchServerMembers();
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

  const controls = document.createElement('form');
  controls.className = 'audit-log-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'textInput audit-log-search-input';
  searchInput.placeholder = 'Search audit logs';
  const actionInput = document.createElement('input');
  actionInput.type = 'text';
  actionInput.className = 'textInput audit-log-search-input';
  actionInput.placeholder = 'Action';
  const actorInput = document.createElement('input');
  actorInput.type = 'text';
  actorInput.className = 'textInput audit-log-search-input';
  actorInput.placeholder = 'Actor';
  const targetInput = document.createElement('input');
  targetInput.type = 'text';
  targetInput.className = 'textInput audit-log-search-input';
  targetInput.placeholder = 'Target';
  const afterInput = document.createElement('input');
  afterInput.type = 'date';
  afterInput.className = 'textInput audit-log-search-input';
  const beforeInput = document.createElement('input');
  beforeInput.type = 'date';
  beforeInput.className = 'textInput audit-log-search-input';
  const searchButton = document.createElement('button');
  searchButton.type = 'submit';
  searchButton.className = 'account-action-submit';
  searchButton.textContent = 'Search';
  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'account-action-cancel';
  clearButton.textContent = 'Clear';
  [
    searchInput,
    actionInput,
    actorInput,
    targetInput,
    afterInput,
    beforeInput,
    searchButton,
    clearButton,
  ].forEach((element) => controls.appendChild(element));

  const status = document.createElement('div');
  status.className = 'audit-log-status';

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

  let auditSearchTimer = null;
  const buildAuditUrl = () => {
    const params = new URLSearchParams({
      serverId: selectedServerID,
      take: '75',
    });
    const values = {
      query: searchInput.value.trim(),
      actionType: actionInput.value.trim(),
      actor: actorInput.value.trim(),
      target: targetInput.value.trim(),
      after: afterInput.value,
      before: beforeInput.value,
    };
    Object.entries(values).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    return `${homeApiBase}/api/Server/GetAuditLogs?${params.toString()}`;
  };

  const loadLogs = async () => {
    status.textContent = 'Loading audit logs...';
    list.innerHTML = '';
    try {
      const res = await axios.get(buildAuditUrl());
      const logs = Array.isArray(res.data) ? res.data : [];
      status.textContent = `${logs.length} ${logs.length === 1 ? 'entry' : 'entries'}`;
      list.innerHTML = '';
      if (!logs.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state-card padded';
        empty.textContent = 'No audit entries matched.';
        list.appendChild(empty);
        return;
      }

      logs.forEach((log) => list.appendChild(renderAuditLogRow(log)));
    } catch (error) {
      status.textContent = '';
      list.textContent = getApiErrorMessage(error, 'Could not load audit logs.');
    }
  };

  const scheduleLoad = () => {
    window.clearTimeout(auditSearchTimer);
    auditSearchTimer = window.setTimeout(loadLogs, 280);
  };

  controls.addEventListener('submit', (event) => {
    event.preventDefault();
    loadLogs();
  });
  [searchInput, actionInput, actorInput, targetInput].forEach((input) => {
    input.addEventListener('input', scheduleLoad);
  });
  [afterInput, beforeInput].forEach((input) => {
    input.addEventListener('change', loadLogs);
  });
  clearButton.addEventListener('click', () => {
    [searchInput, actionInput, actorInput, targetInput, afterInput, beforeInput].forEach((input) => {
      input.value = '';
    });
    loadLogs();
  });
  refreshButton.addEventListener('click', loadLogs);

  dialog.appendChild(heading);
  dialog.appendChild(copy);
  dialog.appendChild(controls);
  dialog.appendChild(status);
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

function getBlockedUsers(state = readSettingsState()) {
  return normalizeAccountUsernameList(state.blockedUsers || []);
}

function isUserBlocked(username, state = readSettingsState()) {
  const target = String(username || '').trim();
  if (!target) return false;
  return getBlockedUsers(state).some((item) => item.toLowerCase() === target.toLowerCase());
}

function setBlockedUsers(blockedUsers = []) {
  const nextBlockedUsers = normalizeAccountUsernameList(blockedUsers);
  writeSettingsState((state) => ({
    ...state,
    blockedUsers: nextBlockedUsers,
  }));
  return nextBlockedUsers;
}

async function blockAccountUser(targetUsername, { silent = false } = {}) {
  const username = String(targetUsername || '').trim();
  if (!username || username === JWTusername) return [];

  const response = await axios.post(`${homeApiBase}/api/Account/BlockUser`, {
    targetUsername: username,
  });
  const blockedUsers = setBlockedUsers(response.data?.blockedUsers || [...getBlockedUsers(), username]);
  if (!silent) {
    showAppMessage(`${username} blocked.`, 'success');
  }
  return blockedUsers;
}

async function unblockAccountUser(targetUsername, { silent = false } = {}) {
  const username = String(targetUsername || '').trim();
  if (!username) return [];

  const response = await axios.post(`${homeApiBase}/api/Account/UnblockUser`, {
    targetUsername: username,
  });
  const blockedUsers = setBlockedUsers(
    response.data?.blockedUsers ||
    getBlockedUsers().filter((item) => item.toLowerCase() !== username.toLowerCase())
  );
  if (!silent) {
    showAppMessage(`${username} unblocked.`, 'success');
  }
  return blockedUsers;
}

function buildReportPayload({ targetType, scopeType, message, targetUsername, reason, description, blockTarget = false }) {
  const normalizedScope = scopeType || getActiveReportScope(targetType);
  const payload = {
    scopeType: normalizedScope,
    targetType,
    targetUsername,
    reason,
    description,
    blockTarget: Boolean(blockTarget),
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
  const canBlockTarget = Boolean(targetUsername && targetUsername !== JWTusername);
  const alreadyBlocked = canBlockTarget && isUserBlocked(targetUsername);

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
      ...(canBlockTarget ? [{
        name: 'blockTarget',
        label: alreadyBlocked ? 'Block status' : 'Also block this user',
        value: alreadyBlocked ? 'true' : 'false',
        options: [
          { value: 'false', label: 'No, just report' },
          { value: 'true', label: alreadyBlocked ? 'Already blocked' : 'Block and report' },
        ],
      }] : []),
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
    blockTarget: result.blockTarget === 'true',
  });

  try {
    await axios.post(`${homeApiBase}/api/Reports/SubmitReport`, payload);
    if (payload.blockTarget && targetUsername) {
      setBlockedUsers([...getBlockedUsers(), targetUsername]);
    }
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

function getReportValue(report = {}, key, fallback = '') {
  const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
  return report[key] ?? report[pascalKey] ?? fallback;
}

function getReportTargetLabel(report = {}) {
  const targetUsername = getReportValue(report, 'targetUsername', 'unknown');
  if (getReportValue(report, 'targetType') === 'message') {
    return `Message from @${targetUsername || 'unknown'}`;
  }

  return `@${targetUsername || 'unknown'}`;
}

function renderReportRow(report = {}, onStatusChange) {
  const row = document.createElement('div');
  row.className = 'audit-log-row report-row';

  const marker = document.createElement('div');
  marker.className = 'audit-log-marker';
  marker.textContent = String(getReportValue(report, 'status', 'open')).slice(0, 1).toUpperCase();

  const content = document.createElement('div');
  content.className = 'audit-log-content';

  const title = document.createElement('div');
  title.className = 'audit-log-title';
  title.textContent = `${getReportTargetLabel(report)} - ${formatReportReason(getReportValue(report, 'reason'))}`;

  const meta = document.createElement('div');
  meta.className = 'audit-log-meta';
  const blockSignal = getReportValue(report, 'reporterBlockedTarget', false) ? ' - reporter blocked target' : '';
  meta.textContent = `${formatReportStatus(getReportValue(report, 'status'))} by ${getReportValue(report, 'reportedByUsername', 'Unknown')} - ${formatAuditTimestamp(getReportValue(report, 'createdAt'))}${blockSignal}`;

  content.appendChild(title);
  content.appendChild(meta);

  const messagePreview = getReportValue(report, 'messagePreview', '');
  if (messagePreview) {
    const preview = document.createElement('div');
    preview.className = 'audit-log-details';
    preview.textContent = messagePreview;
    content.appendChild(preview);
  }

  const description = getReportValue(report, 'description', '');
  if (description) {
    const details = document.createElement('div');
    details.className = 'audit-log-details';
    details.textContent = description;
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
    button.disabled = getReportValue(report, 'status') === status;
    button.addEventListener('click', () => onStatusChange(report, status));
    actions.appendChild(button);
  });
  content.appendChild(actions);

  row.appendChild(marker);
  row.appendChild(content);
  return row;
}

function getQueueValue(item = {}, key, fallback = '') {
  const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
  return item[key] ?? item[pascalKey] ?? fallback;
}

function getQueueArray(item = {}, key) {
  const value = getQueueValue(item, key, []);
  return Array.isArray(value) ? value : [];
}

function renderModerationQueueRow(item = {}, { onQueueStatusChange, onReportStatusChange, onModerateTarget }) {
  const row = document.createElement('div');
  row.className = 'audit-log-row moderation-queue-row';

  const reportCount = Number(getQueueValue(item, 'reportCount', 0)) || 0;
  const openCount = Number(getQueueValue(item, 'openReportCount', 0)) || 0;
  const blockSignalCount = Number(getQueueValue(item, 'blockSignalCount', 0)) || 0;
  const targetUsername = getQueueValue(item, 'targetUsername', 'unknown');

  const marker = document.createElement('div');
  marker.className = 'audit-log-marker moderation-queue-marker';
  marker.textContent = String(reportCount);

  const content = document.createElement('div');
  content.className = 'audit-log-content';

  const title = document.createElement('div');
  title.className = 'audit-log-title';
  title.textContent = `@${targetUsername}`;

  const meta = document.createElement('div');
  meta.className = 'audit-log-meta';
  const memberState = getQueueValue(item, 'isBanned', false)
    ? 'banned'
    : getQueueValue(item, 'isTimedOut', false)
      ? 'timed out'
      : getQueueValue(item, 'isMuted', false)
        ? 'muted'
        : getQueueValue(item, 'isMember', false)
          ? (getQueueValue(item, 'role', 'member') || 'member')
          : 'not a member';
  meta.textContent = `${openCount} open of ${reportCount} reports - ${blockSignalCount} block signals - ${memberState} - latest ${formatAuditTimestamp(getQueueValue(item, 'lastReportedAt'))}`;

  content.appendChild(title);
  content.appendChild(meta);

  const reasons = getQueueArray(item, 'reasons');
  const reporters = getQueueArray(item, 'reporters');
  const details = document.createElement('div');
  details.className = 'audit-log-details moderation-queue-details';
  details.textContent = [
    reasons.length ? `Reasons: ${reasons.map(formatReportReason).join(', ')}` : '',
    reporters.length ? `Reporters: ${reporters.join(', ')}` : '',
  ].filter(Boolean).join(' | ');
  if (details.textContent) {
    content.appendChild(details);
  }

  const actions = document.createElement('div');
  actions.className = 'report-row-actions moderation-queue-actions';
  [
    ['Review all', 'reviewed'],
    ['Resolve all', 'resolved'],
    ['Dismiss all', 'dismissed'],
  ].forEach(([label, status]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'server-tool-btn';
    button.textContent = label;
    button.addEventListener('click', () => onQueueStatusChange(item, status));
    actions.appendChild(button);
  });

  [
    ['Timeout', 'timeout'],
    [getQueueValue(item, 'isMuted', false) ? 'Unmute' : 'Mute', getQueueValue(item, 'isMuted', false) ? 'unmute' : 'mute'],
    ['Ban', 'ban'],
  ].forEach(([label, action]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = action === 'ban' ? 'settings-btn-danger settings-btn-compact' : 'server-tool-btn';
    button.textContent = label;
    button.disabled = action === 'ban' && getQueueValue(item, 'isBanned', false);
    button.addEventListener('click', () => onModerateTarget(action, targetUsername));
    actions.appendChild(button);
  });
  content.appendChild(actions);

  const reports = getQueueArray(item, 'reports');
  if (reports.length) {
    const sample = document.createElement('div');
    sample.className = 'moderation-queue-report-list';
    reports.forEach((report) => sample.appendChild(renderReportRow(report, onReportStatusChange)));
    content.appendChild(sample);
  }

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
  heading.textContent = 'Moderation Queue';
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
  list.textContent = 'Loading queue...';

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
        reportId: getReportValue(report, 'id'),
        status,
        resolutionNote: note || null,
      });
      await loadQueue();
      showAppMessage('Report updated.', 'success');
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not update report.'), 'error');
    }
  };

  const updateQueueStatus = async (item, status) => {
    let note = '';
    if (status !== 'reviewed') {
      const result = await openSimpleFormDialog({
        title: `${formatReportStatus(status)} Queue`,
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
      await axios.post(`${homeApiBase}/api/Reports/UpdateReportQueueStatus`, {
        serverId: selectedServerID,
        targetUsername: getQueueValue(item, 'targetUsername'),
        status,
        resolutionNote: note || null,
      });
      await loadQueue();
      showAppMessage('Queue updated.', 'success');
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not update queue.'), 'error');
    }
  };

  const moderateQueueTarget = async (action, targetUsername) => {
    if (action === 'timeout') {
      await timeoutServerMember(targetUsername);
    } else if (action === 'mute') {
      await muteServerMember(targetUsername);
    } else if (action === 'unmute') {
      await unmuteServerMember(targetUsername);
    } else if (action === 'ban') {
      await moderateServerMember('BanMember', targetUsername);
    }
    await loadQueue();
  };

  const loadQueue = async () => {
    list.textContent = 'Loading queue...';
    try {
      const res = await axios.get(
        `${homeApiBase}/api/Reports/GetServerModerationQueue?serverId=${encodeURIComponent(selectedServerID)}&status=${encodeURIComponent(statusFilter.value)}&take=50`
      );
      const queueItems = Array.isArray(res.data) ? res.data : [];
      list.innerHTML = '';
      if (!queueItems.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state-card padded';
        empty.textContent = 'No moderation queue items found.';
        list.appendChild(empty);
        return;
      }

      queueItems.forEach((item) => list.appendChild(renderModerationQueueRow(item, {
        onQueueStatusChange: updateQueueStatus,
        onReportStatusChange: updateStatus,
        onModerateTarget: moderateQueueTarget,
      })));
    } catch (error) {
      list.textContent = getApiErrorMessage(error, 'Could not load moderation queue.');
    }
  };

  statusFilter.addEventListener('change', loadQueue);
  refreshButton.addEventListener('click', loadQueue);

  dialog.appendChild(heading);
  dialog.appendChild(copy);
  dialog.appendChild(statusFilter);
  dialog.appendChild(list);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  loadQueue();
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
      applyServerAppearanceState(server);
      applyServerWelcomeState(server);
      currentServerRole = server.role || currentServerRole || 'user';
    }
    if (server?.serverName) {
      currentServerName = server.serverName;
    }
    renderCurrentServerHeader(currentServerRole);
    await loadServerExpressions(selectedServerID, { force: true });
    await loadServerSlashCommands(selectedServerID, { force: true });
    refreshEmojiPicker();
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
      const permissionButton = document.createElement('button');
      permissionButton.type = 'button';
      permissionButton.className = 'channel-inline-action';
      permissionButton.textContent = 'Perms';
      permissionButton.title = 'Channel permissions';
      permissionButton.addEventListener('click', (event) => {
        event.stopPropagation();
        openChannelPermissionsDialog(channel.id);
      });
      channelEl.appendChild(permissionButton);
      if (channel.type === 'text') {
        channelEl.onclick = () => {
          clearReplyDraft();
          selectedChannelID = channel.id;
          closeServerThreadPanel();
          hideElement('#serverPinnedMessagesPanel');
          setServerChatHeaderTitle('# ' + channel.name);
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
        channelEl.onclick = () => {
          selectedChannelID = channel.id;
          closeServerThreadPanel();
          hideElement('#serverPinnedMessagesPanel');
          setServerChatHeaderTitle(channel.type === 'stage' ? '[S] ' + channel.name : '[V] ' + channel.name);
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
      clearReplyDraft();
      selectedChannelID = firstTextChannel.id;
      closeServerThreadPanel();
      hideElement('#serverPinnedMessagesPanel');
      setServerChatHeaderTitle('# ' + firstTextChannel.name);
      fetchServerMessages();
      const firstChannelEl = channelsList.querySelector(`[data-channel-id="${escapeCssIdentifier(firstTextChannel.id)}"]`);
      firstChannelEl?.classList.add('active');
    }

    await refreshUnreadIndicators();

    await fetchServerRoles({ force: true, silent: true }).catch(() => []);
    upsertServerListItem({
      serverID: selectedServerID,
      serverName: currentServerName,
      role: currentServerRole,
      serverIconUrl: currentServerIconUrl,
      serverBannerUrl: currentServerBannerUrl,
    });
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
    const members = Array.isArray(response.data) ? response.data : [];
    currentServerMembers = members;
    const membersList = document.querySelector('.viewServerAccounts');

    membersList.innerHTML = '<p class="serverAccounts">Members</p>';

    members.sort((a, b) => {
      const roleDelta = getRoleSortPosition(a.role) - getRoleSortPosition(b.role);
      return roleDelta || a.username.localeCompare(b.username);
    });

    members.forEach(member => {
      const memberRole = normalizeRoleName(member.role);
      const isBotMember = Boolean(member.isBot ?? member.IsBot);
      const memberEl = document.createElement('div');
      memberEl.dataset.username = member.username;
      memberEl.dataset.role = memberRole;
      memberEl.classList.add('server-member-row');
        memberEl.classList.toggle('is-owner', memberRole === 'owner');
        memberEl.classList.toggle('is-bot', isBotMember);

        const avatar = document.createElement('div');
        avatar.className = 'server-member-avatar default-avatar-bg';
        const memberPictureUrl = getProfilePictureUrl(member);
        const memberPresenceStatus = getProfilePresenceStatus(member);
        const memberCustomStatus = getProfileCustomStatus(member);
        const memberBadges = getProfileBadges(member);
        cacheProfileSummary({
          username: member.username,
          profilePictureUrl: memberPictureUrl,
          presenceStatus: memberPresenceStatus,
          customStatus: memberCustomStatus,
          badges: memberBadges,
        });
        if (memberPictureUrl) {
          avatar.style.backgroundImage = `url("${cssString(resolveMediaUrl(memberPictureUrl))}")`;
        }
        if (!isBotMember) {
          avatar.onclick = (e) => openProfilePopout(member.username, e.pageX, e.pageY);
        }

        const statusDot = document.createElement('span');
        statusDot.className = 'member-status-dot';
        setPresenceClass(statusDot, memberPresenceStatus);

        const copy = document.createElement('div');
        copy.className = 'server-member-copy';
        const nameLine = document.createElement('span');
        nameLine.className = 'server-member-name-line';
        const name = document.createElement('span');
        name.className = 'server-member-name';
        name.textContent = member.username;
        applyRoleColorStyle(name, memberRole);
        if (!isBotMember) {
          name.onclick = (e) => openProfilePopout(member.username, e.pageX, e.pageY);
        }
        nameLine.appendChild(name);
        if (isBotMember) {
          const botBadge = document.createElement('span');
          botBadge.className = 'server-member-automation-badge';
          botBadge.textContent = 'Bot';
          nameLine.appendChild(botBadge);
        }
        const status = document.createElement('span');
        status.className = 'server-member-status';
        status.textContent = getStatusSummary(member);
        copy.appendChild(nameLine);
        const profileBadges = document.createElement('span');
        profileBadges.className = 'user-badges server-member-profile-badges';
        renderUserBadges(profileBadges, memberBadges, { compact: true });
        copy.appendChild(profileBadges);
        copy.appendChild(status);

        memberEl.appendChild(avatar);
        memberEl.appendChild(statusDot);
        memberEl.appendChild(copy);
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
      if (listEl) {
        setEmptyState(listEl, {
          icon: 'FR',
          title: 'No friends yet',
          description: 'Send a friend request to start building your list.',
          actionLabel: 'Add Friend',
          onAction: showAddFriends,
          compact: true,
        });
      }
      return;
    }

    friends = [...new Set(friends)];
    const friendProfiles = await fetchFriendProfileSummaries();

    if (listEl) listEl.innerHTML = '';

    friends.forEach(friendName => {
      const profile = friendProfiles.get(String(friendName).toLowerCase()) || getCachedProfileSummary(friendName) || {
        username: friendName,
        presenceStatus: 'online',
        customStatus: '',
        activityStatus: '',
        lastActiveAt: null,
      };
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
      if (profile.profilePictureUrl) {
        avatar.style.backgroundImage = `url("${cssString(resolveMediaUrl(profile.profilePictureUrl))}")`;
      }
      avatar.onclick = (e) => openProfilePopout(friendName, e.pageX, e.pageY);
      const statusDot = document.createElement('span');
      statusDot.className = 'presence-status-dot';
      setPresenceClass(statusDot, profile.presenceStatus);
      avatar.appendChild(statusDot);

      const info = document.createElement('div');
      info.className = 'friend-item-info';

      const name = document.createElement('span');
      name.className = 'friend-item-name';
      name.textContent = friendName;
      name.onclick = (e) => openProfilePopout(friendName, e.pageX, e.pageY);

      const status = document.createElement('span');
      status.className = 'friend-item-status';
      status.textContent = getStatusSummary(profile);
      const profileBadges = document.createElement('span');
      profileBadges.className = 'user-badges friend-profile-badges';
      renderUserBadges(profileBadges, getProfileBadges(profile), { compact: true });

      info.appendChild(name);
      info.appendChild(profileBadges);
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
    setEmptyState('.friendsListMain', {
      icon: '!',
      title: 'Friends could not load',
      description: 'Make sure the API is running and try again.',
      compact: true,
      className: 'error-state',
    });
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
        const fileUrl = getUploadUrlFromResponse(res.data);
        const displayFileUrl = getUploadDisplayUrl(res.data);
        console.log('File uploaded:', fileUrl);

        const messageText = `[Image](${displayFileUrl})`;
        const replyDraft = getActiveReplyDraft('dm');

        const messageObject = {
          PrivateMessageID: generateUUID(),
          MessageUserReciver: currentFriend,
          FriendMessagesData: messageText,
          AttachmentUrl: fileUrl,
          AttachmentContentType: file.type,
          ReplyToMessageId: replyDraft?.messageId || null,
        };

        await apiClient.post(`${homeApiBase}/api/PrivateMessageFriend/SendPrivateMessage`, messageObject);
        if (replyDraft && pendingReplyDraft === replyDraft) {
          clearReplyDraft();
        }
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
      const fileUrl = getUploadUrlFromResponse(res.data);
      const displayFileUrl = getUploadDisplayUrl(res.data);
      console.log('File uploaded:', fileUrl);

      const messageText = `[Image](${displayFileUrl})`;

      if (currentGroupId) {
        const replyDraft = getActiveReplyDraft('group');
        await apiClient.post(`${homeApiBase}/api/GroupChat/SendGroupMessage`, {
          groupId: currentGroupId,
          content: messageText,
          attachmentUrl: fileUrl,
          attachmentContentType: currentUploadFile.type,
          replyToMessageId: replyDraft?.messageId || null,
        });
        if (replyDraft && pendingReplyDraft === replyDraft) {
          clearReplyDraft();
        }
        await GetGroupMessages(currentGroupId);
      } else if (currentFriend) {
        const replyDraft = getActiveReplyDraft('dm');
        await apiClient.post(`${homeApiBase}/api/PrivateMessageFriend/SendPrivateMessage`, {
          PrivateMessageID: generateUUID(),
          MessageUserReciver: currentFriend,
          FriendMessagesData: messageText,
          AttachmentUrl: fileUrl,
          AttachmentContentType: currentUploadFile.type,
          ReplyToMessageId: replyDraft?.messageId || null,
        });
        if (replyDraft && pendingReplyDraft === replyDraft) {
          clearReplyDraft();
        }
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


function getExpressionValue(item = {}, camelKey, pascalKey, fallback = '') {
  return item[camelKey] ?? item[pascalKey] ?? fallback;
}

function normalizeExpressionItem(item = {}) {
  return {
    id: String(getExpressionValue(item, 'id', 'Id', '') || ''),
    serverId: String(getExpressionValue(item, 'serverId', 'ServerId', '') || ''),
    name: normalizeExpressionName(getExpressionValue(item, 'name', 'Name', '')),
    imageUrl: String(getExpressionValue(item, 'imageUrl', 'ImageUrl', '') || ''),
    createdBy: String(getExpressionValue(item, 'createdBy', 'CreatedBy', '') || ''),
  };
}

function normalizeExpressionPack(data = {}) {
  const rawEmojis = data.emojis || data.Emojis || [];
  const rawStickers = data.stickers || data.Stickers || [];
  return {
    emojis: (Array.isArray(rawEmojis) ? rawEmojis : [])
      .map(normalizeExpressionItem)
      .filter((item) => item.name && item.imageUrl),
    stickers: (Array.isArray(rawStickers) ? rawStickers : [])
      .map(normalizeExpressionItem)
      .filter((item) => item.name && item.imageUrl),
    canManage: Boolean(data.canManage ?? data.CanManage),
  };
}

function getEmptyExpressionPack() {
  return { emojis: [], stickers: [], canManage: false };
}

async function loadServerExpressions(serverId = selectedServerID, { force = false, silent = true } = {}) {
  const normalizedServerId = String(serverId || '').trim();
  if (!normalizedServerId) {
    return getEmptyExpressionPack();
  }

  if (!force && expressionPackCache.has(normalizedServerId)) {
    return expressionPackCache.get(normalizedServerId);
  }

  try {
    const response = await axios.get(
      `${homeApiBase}/api/ServerExpressions/GetExpressionPack?serverId=${encodeURIComponent(normalizedServerId)}`
    );
    const pack = normalizeExpressionPack(response.data || {});
    expressionPackCache.set(normalizedServerId, pack);
    return pack;
  } catch (error) {
    if (!silent) {
      showAppMessage(getApiErrorMessage(error, 'Could not load custom emojis and stickers.'), 'error');
    } else {
      console.warn('Could not load server expressions:', error);
    }
    const emptyPack = getEmptyExpressionPack();
    expressionPackCache.set(normalizedServerId, emptyPack);
    return emptyPack;
  }
}

function getCurrentExpressionPack() {
  if (!selectedServerID) {
    return getEmptyExpressionPack();
  }
  return expressionPackCache.get(String(selectedServerID)) || getEmptyExpressionPack();
}

function refreshEmojiPicker() {
  const searchInput = document.getElementById('emojiSearchInput');
  if (typeof renderEmojiPickerContent === 'function') {
    renderEmojiPickerContent(searchInput?.value || '');
  }
}

function insertTextAtCursor(input, text) {
  if (!input) return;
  const value = input.value || '';
  const start = typeof input.selectionStart === 'number' ? input.selectionStart : value.length;
  const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
  input.value = `${value.slice(0, start)}${text}${value.slice(end)}`;
  const nextCursor = start + text.length;
  input.setSelectionRange?.(nextCursor, nextCursor);
  input.focus();
}

function getComposerInputFromTarget(target) {
  const form = target?.closest?.('form');
  const formInput = form?.querySelector?.('.chatInput');
  if (formInput) return formInput;

  const scope = getActiveMessageScope();
  return getMessageInputForScope(scope) || document.querySelector('.chatInput');
}

function setActiveEmojiPickerInputFromTarget(target) {
  activeEmojiPickerInput = getComposerInputFromTarget(target);
  lastEmojiPickerToggle = target?.closest?.('[data-emoji-picker-toggle]') || target || null;
}

function positionEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  if (!picker) return;

  const anchor = lastEmojiPickerToggle || activeEmojiPickerInput;
  if (!anchor?.getBoundingClientRect) {
    picker.style.left = '';
    picker.style.right = '24px';
    picker.style.bottom = '76px';
    return;
  }

  const rect = anchor.getBoundingClientRect();
  const width = Math.min(420, window.innerWidth - 24);
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width));
  const bottom = Math.max(12, window.innerHeight - rect.top + 10);
  picker.style.width = `${width}px`;
  picker.style.left = `${left}px`;
  picker.style.right = 'auto';
  picker.style.bottom = `${bottom}px`;
}

function buildCustomEmojiToken(item) {
  return `<:${item.name}:${item.imageUrl}>`;
}

async function uploadExpressionImage(file) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Choose an image file.');
  }

  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post(`${homeApiBase}/api/Upload/UploadImage`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return getUploadUrlFromResponse(response.data);
}

async function saveCustomExpression(kind, { name, imageUrl }) {
  if (!selectedServerID) {
    showAppMessage('Open a server before adding custom expressions.', 'error');
    return;
  }

  const endpoint = kind === 'sticker' ? 'SaveSticker' : 'SaveEmoji';
  await axios.post(`${homeApiBase}/api/ServerExpressions/${endpoint}`, {
    serverId: selectedServerID,
    name,
    imageUrl,
  });
  expressionPackCache.delete(String(selectedServerID));
  await loadServerExpressions(selectedServerID, { force: true, silent: false });
  refreshEmojiPicker();
}

async function deleteCustomExpression(kind, id) {
  if (!selectedServerID || !id) return;
  const endpoint = kind === 'sticker' ? 'DeleteSticker' : 'DeleteEmoji';
  await axios.post(`${homeApiBase}/api/ServerExpressions/${endpoint}`, {
    serverId: selectedServerID,
    id,
  });
  expressionPackCache.delete(String(selectedServerID));
  await loadServerExpressions(selectedServerID, { force: true, silent: false });
  refreshEmojiPicker();
}

function ensureExpressionManagerDialog() {
  let overlay = document.getElementById('expressionManagerDialog');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'expressionManagerDialog';
  overlay.className = 'expression-manager-overlay is-hidden';
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      hideElement(overlay);
    }
  });
  document.body.appendChild(overlay);
  return overlay;
}

async function renderExpressionManagerDialog() {
  const overlay = ensureExpressionManagerDialog();
  const pack = await loadServerExpressions(selectedServerID, { silent: false });
  const isStickerMode = expressionDialogMode === 'sticker';
  const items = isStickerMode ? pack.stickers : pack.emojis;
  const kind = isStickerMode ? 'sticker' : 'emoji';

  overlay.innerHTML = '';
  const dialog = document.createElement('div');
  dialog.className = 'expression-manager-dialog';

  const header = document.createElement('div');
  header.className = 'expression-manager-header';
  const title = document.createElement('h3');
  title.textContent = 'Server Expressions';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'expression-manager-close';
  close.textContent = 'x';
  close.title = 'Close';
  close.addEventListener('click', () => hideElement(overlay));
  header.appendChild(title);
  header.appendChild(close);

  const tabs = document.createElement('div');
  tabs.className = 'expression-manager-tabs';
  [
    ['emoji', 'Custom Emoji'],
    ['sticker', 'Stickers'],
  ].forEach(([mode, label]) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'expression-manager-tab';
    tab.classList.toggle('active', expressionDialogMode === mode);
    tab.textContent = label;
    tab.addEventListener('click', () => {
      expressionDialogMode = mode;
      renderExpressionManagerDialog();
    });
    tabs.appendChild(tab);
  });

  const form = document.createElement('form');
  form.className = 'expression-manager-form';
  const name = document.createElement('input');
  name.type = 'text';
  name.name = 'name';
  name.maxLength = 32;
  name.placeholder = isStickerMode ? 'sticker_name' : 'emoji_name';
  name.autocomplete = 'off';
  const imageUrl = document.createElement('input');
  imageUrl.type = 'text';
  imageUrl.name = 'imageUrl';
  imageUrl.placeholder = 'Image URL';
  imageUrl.autocomplete = 'off';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/gif,image/webp';
  fileInput.className = 'is-hidden';
  const upload = document.createElement('button');
  upload.type = 'button';
  upload.className = 'expression-manager-secondary';
  upload.textContent = 'Upload';
  upload.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    upload.disabled = true;
    upload.textContent = 'Uploading...';
    try {
      imageUrl.value = await uploadExpressionImage(file);
    } catch (error) {
      showAppMessage(error.message || 'Could not upload image.', 'error');
    } finally {
      upload.disabled = false;
      upload.textContent = 'Upload';
      fileInput.value = '';
    }
  });
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'expression-manager-primary';
  submit.textContent = isStickerMode ? 'Add Sticker' : 'Add Emoji';

  [name, imageUrl, upload, submit].forEach((element) => {
    element.disabled = !pack.canManage;
  });

  form.appendChild(name);
  form.appendChild(imageUrl);
  form.appendChild(fileInput);
  form.appendChild(upload);
  form.appendChild(submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const normalizedName = normalizeExpressionName(name.value);
    if (!normalizedName || normalizedName.length < 2 || !imageUrl.value.trim()) {
      showAppMessage('Add a name and image URL.', 'error');
      return;
    }

    submit.disabled = true;
    try {
      await saveCustomExpression(kind, {
        name: normalizedName,
        imageUrl: imageUrl.value.trim(),
      });
      showAppMessage(isStickerMode ? 'Sticker added.' : 'Emoji added.', 'success');
      await renderExpressionManagerDialog();
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not save expression.'), 'error');
    } finally {
      submit.disabled = false;
    }
  });

  const status = document.createElement('div');
  status.className = 'expression-manager-status';
  status.textContent = pack.canManage
    ? `${items.length} ${isStickerMode ? 'stickers' : 'custom emojis'}`
    : 'View-only';

  const list = document.createElement('div');
  list.className = 'expression-manager-list';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'emoji-empty-state';
    empty.textContent = isStickerMode ? 'No stickers yet.' : 'No custom emojis yet.';
    list.appendChild(empty);
  } else {
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'expression-manager-item';
      const preview = document.createElement('img');
      preview.src = resolveMediaUrl(item.imageUrl);
      preview.alt = item.name;
      preview.loading = 'lazy';
      const label = document.createElement('span');
      label.textContent = `:${item.name}:`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.disabled = !pack.canManage;
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        try {
          await deleteCustomExpression(kind, item.id);
          await renderExpressionManagerDialog();
        } catch (error) {
          showAppMessage(getApiErrorMessage(error, 'Could not delete expression.'), 'error');
          remove.disabled = false;
        }
      });
      row.appendChild(preview);
      row.appendChild(label);
      row.appendChild(remove);
      list.appendChild(row);
    });
  }

  dialog.appendChild(header);
  dialog.appendChild(tabs);
  dialog.appendChild(form);
  dialog.appendChild(status);
  dialog.appendChild(list);
  overlay.appendChild(dialog);
}

async function openExpressionManagerDialog(mode = 'emoji') {
  if (!selectedServerID) {
    showAppMessage('Open a server before managing custom expressions.', 'error');
    return;
  }

  expressionDialogMode = mode === 'sticker' ? 'sticker' : 'emoji';
  const overlay = ensureExpressionManagerDialog();
  showElement(overlay, 'flex');
  await renderExpressionManagerDialog();
}

async function sendStickerMessage(sticker) {
  const scope = getActiveMessageScope();
  if (!scope || !sticker) {
    showAppMessage('Open a conversation before sending a sticker.', 'info');
    return;
  }

  const isBuiltInSticker = Boolean(sticker.id && sticker.url?.startsWith('data:image/'));
  const content = isBuiltInSticker ? `[[sticker:${sticker.id}]]` : '';
  const attachmentUrl = isBuiltInSticker ? '' : sticker.imageUrl || sticker.url || '';
  const attachmentContentType = attachmentUrl ? stickerMessageContentType : '';
  const replyDraft = getActiveReplyDraft(scope);
  const now = new Date().toISOString();

  if (scope === 'server') {
    const messageId = generateUUID();
    const payload = {
      MessageID: messageId,
      ChannelId: selectedChannelID,
      userText: content,
      AttachmentUrl: attachmentUrl || null,
      AttachmentContentType: attachmentContentType || null,
      ReplyToMessageId: replyDraft?.messageId || null,
    };
    const result = await runOptimisticMessageSend({
      container: chatMessages,
      scope: 'server',
      conversationId: selectedChannelID,
      draft: {
        ...payload,
        messagesUserSender: JWTusername,
        date: now,
        replyPreview: replyDraft?.preview || null,
      },
      send: () => apiClient.post(`${homeApiBase}/api/ServerMessages/ServerMessages`, payload),
      refresh: () => fetchServerMessages(),
      failureMessage: 'Sticker failed to send.',
    }).catch(() => {});
    if (result && replyDraft && pendingReplyDraft === replyDraft) {
      clearReplyDraft();
    }
    return;
  }

  const messagesDisplay = document.querySelector('.messagesDisplay');
  if (scope === 'group') {
    const result = await runOptimisticMessageSend({
      container: messagesDisplay,
      scope: 'group',
      conversationId: currentGroupId,
      draft: {
        sender: JWTusername,
        content,
        attachmentUrl,
        attachmentContentType,
        date: now,
        replyToMessageId: replyDraft?.messageId || null,
        replyPreview: replyDraft?.preview || null,
      },
      send: () => apiClient.post(`${homeApiBase}/api/GroupChat/SendGroupMessage`, {
        groupId: currentGroupId,
        content,
        attachmentUrl: attachmentUrl || null,
        attachmentContentType: attachmentContentType || null,
        replyToMessageId: replyDraft?.messageId || null,
      }),
      refresh: () => GetGroupMessages(currentGroupId),
      failureMessage: 'Sticker failed to send.',
    }).catch(() => {});
    if (result && replyDraft && pendingReplyDraft === replyDraft) {
      clearReplyDraft();
    }
    return;
  }

  if (scope === 'dm') {
    const messageId = generateUUID();
    const result = await runOptimisticMessageSend({
      container: messagesDisplay,
      scope: 'dm',
      conversationId: currentFriend,
      draft: {
        privateMessageID: messageId,
        messagesUserSender: JWTusername,
        friendMessagesData: content,
        attachmentUrl,
        attachmentContentType,
        date: now,
        replyToMessageId: replyDraft?.messageId || null,
        replyPreview: replyDraft?.preview || null,
      },
      send: () => apiClient.post(`${homeApiBase}/api/PrivateMessageFriend/SendPrivateMessage`, {
        PrivateMessageID: messageId,
        MessageUserReciver: currentFriend,
        FriendMessagesData: content,
        AttachmentUrl: attachmentUrl || null,
        AttachmentContentType: attachmentContentType || null,
        ReplyToMessageId: replyDraft?.messageId || null,
      }),
      refresh: () => GetPrivateMessage(),
      failureMessage: 'Sticker failed to send.',
    }).catch(() => {});
    if (result && replyDraft && pendingReplyDraft === replyDraft) {
      clearReplyDraft();
    }
  }
}



function setupEmojiPicker() {
  const container = document.getElementById('emojiGridContainer');
  const searchInput = document.getElementById('emojiSearchInput');
  const picker = document.getElementById('emojiPicker');

  if (!container || !picker) return;

  if (picker.parentElement !== document.body) {
    document.body.appendChild(picker);
  }

  const tabBar = picker.querySelector('.emoji-tabs');
  [
    ['emoji', 'Emoji'],
    ['custom', 'Custom'],
    ['stickers', 'Stickers'],
    ['gif', 'GIFs'],
  ].forEach(([tabId, label]) => {
    if (!tabBar?.querySelector(`[data-tab="${tabId}"]`)) {
      const tab = document.createElement('div');
      tab.className = 'emoji-tab';
      tab.dataset.tab = tabId;
      tab.textContent = label;
      tabBar?.appendChild(tab);
    }
  });

  const tabs = picker.querySelectorAll('.emoji-tab');
  let currentTab = picker.querySelector('.emoji-tab.active')?.dataset.tab || 'emoji';

  const setPreview = (preview, name) => {
    const pEmoji = document.getElementById('previewEmoji');
    const pName = document.getElementById('previewName');
    if (pEmoji) {
      pEmoji.textContent = '';
      if (preview instanceof Node) {
        pEmoji.appendChild(preview);
      } else {
        pEmoji.textContent = String(preview || '');
      }
    }
    if (pName) pName.textContent = name;
  };

  const renderEmptyState = (message) => {
    const msg = document.createElement('div');
    msg.className = 'emoji-empty-state';
    msg.textContent = message;
    container.appendChild(msg);
  };

  const renderManageExpressionButton = (kind, pack) => {
    if (!selectedServerID) return;
    const manage = document.createElement('button');
    manage.type = 'button';
    manage.className = 'emoji-manage-btn';
    manage.textContent = pack.canManage ? 'Manage' : 'View';
    manage.addEventListener('click', () => openExpressionManagerDialog(kind));
    container.appendChild(manage);
  };

  const renderContent = async (filterText = '') => {
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
          setPreview(item.char, ':' + item.names[0] + ':');
        };

        span.onclick = () => {
          insertTextAtCursor(activeEmojiPickerInput || getComposerInputFromTarget(lastEmojiPickerToggle), item.char);
        };
        container.appendChild(span);
      });

      if (filtered.length === 0) {
        renderEmptyState('No emojis found');
      }
    } else if (currentTab === 'custom') {
      const pack = await loadServerExpressions(selectedServerID);
      const title = document.createElement('div');
      title.className = 'emoji-category-title';
      title.textContent = 'Server Emojis';
      container.appendChild(title);

      const filtered = pack.emojis.filter((item) => {
        if (!safeFilter) return true;
        return item.name.includes(safeFilter);
      });

      filtered.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'custom-emoji-item';
        const image = createCustomEmojiNode(item.name, item.imageUrl);
        button.appendChild(image);
        button.title = `:${item.name}:`;
        button.onmouseenter = () => {
          setPreview(createCustomEmojiNode(item.name, item.imageUrl), `:${item.name}:`);
        };
        button.onclick = () => {
          insertTextAtCursor(
            activeEmojiPickerInput || getComposerInputFromTarget(lastEmojiPickerToggle),
            buildCustomEmojiToken(item)
          );
        };
        container.appendChild(button);
      });

      renderManageExpressionButton('emoji', pack);
      if (!filtered.length) {
        renderEmptyState(selectedServerID ? 'No custom emojis found' : 'Open a server to use custom emojis');
      }
    } else if (currentTab === 'stickers') {
      const pack = await loadServerExpressions(selectedServerID);
      const builtInStickers = typeof stickerList !== 'undefined' && Array.isArray(stickerList) ? stickerList : [];
      const stickerSections = [
        ['Stickers', builtInStickers.map((item) => ({ ...item, source: 'built-in' }))],
        ['Server Stickers', pack.stickers.map((item) => ({
          ...item,
          source: 'custom',
          url: item.imageUrl,
        }))],
      ];
      let renderedCount = 0;

      stickerSections.forEach(([titleText, stickers]) => {
        const filtered = stickers.filter((item) => {
          if (!safeFilter) return true;
          const keywords = Array.isArray(item.keywords) ? item.keywords : [];
          return item.name?.toLowerCase().includes(safeFilter) || keywords.some((keyword) => keyword.includes(safeFilter));
        });
        if (!filtered.length && titleText !== 'Server Stickers') return;

        const title = document.createElement('div');
        title.className = 'emoji-category-title';
        title.textContent = titleText;
        container.appendChild(title);

        filtered.forEach((item) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'sticker-picker-item';
          button.appendChild(createStickerImageNode(item));
          button.title = item.name;
          button.onmouseenter = () => {
            setPreview('Sticker', item.name);
          };
          button.onclick = async () => {
            await sendStickerMessage(item);
            hideElement(picker);
          };
          container.appendChild(button);
          renderedCount += 1;
        });
      });

      renderManageExpressionButton('sticker', pack);
      if (!renderedCount) {
        renderEmptyState('No stickers found');
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
          insertTextAtCursor(
            activeEmojiPickerInput || getComposerInputFromTarget(lastEmojiPickerToggle),
            `[Image](${item.url})`
          );
        };

        div.onmouseenter = () => {
          setPreview('GIF', 'GIF Image');
        };

        container.appendChild(div);
      });

      if (filteredGifs.length === 0) {
        renderEmptyState('No GIFs found');
      }
    }
  };

  renderEmojiPickerContent = renderContent;
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

      const sidebar = document.querySelector('.emoji-sidebar');
      if (sidebar) {
        setElementVisible(sidebar, currentTab === 'emoji', 'flex');
      }

      if (searchInput) {
        searchInput.value = '';
        searchInput.placeholder =
          currentTab === 'gif'
            ? 'Search GIFs'
            : currentTab === 'stickers'
              ? 'Search stickers'
              : currentTab === 'custom'
                ? 'Search custom emojis'
                : 'Find the perfect emoji';
      }
      renderContent();
    };
  });

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest?.('[data-emoji-picker-toggle]');
    if (!picker.contains(e.target) && !toggle) {
      hideElement(picker);
      if (searchInput) searchInput.value = '';
    }
  });

  window.addEventListener('resize', () => {
    if (isElementVisible(picker)) {
      positionEmojiPicker();
    }
  });
}

const messageSearchState = {
  query: '',
  scope: null,
  fromUser: '',
  mentions: '',
  after: '',
  before: '',
  hasAttachment: null,
  attachmentType: 'any',
  hasLink: null,
  pinned: null,
  sort: 'newest',
  timer: null,
  requestId: 0,
};

function parseSearchNullableBoolean(value) {
  return value === 'true' ? true : value === 'false' ? false : null;
}

function formatSearchFilterDate(value = '') {
  if (!value) {
    return '';
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function getSearchAttachmentTypeLabel(value = 'any') {
  return {
    image: 'Images',
    video: 'Videos',
    audio: 'Audio',
    file: 'Files',
  }[value] || '';
}

function getMessageSearchFilterDescriptors(scope = getActiveMessageScope()) {
  const filters = [];
  if (messageSearchState.fromUser) {
    filters.push({ key: 'fromUser', label: `From ${messageSearchState.fromUser}` });
  }
  if (messageSearchState.mentions) {
    filters.push({ key: 'mentions', label: `Mentions @${messageSearchState.mentions.replace(/^@/, '')}` });
  }
  if (messageSearchState.after) {
    filters.push({ key: 'after', label: `After ${formatSearchFilterDate(messageSearchState.after)}` });
  }
  if (messageSearchState.before) {
    filters.push({ key: 'before', label: `Before ${formatSearchFilterDate(messageSearchState.before)}` });
  }
  if (messageSearchState.hasAttachment !== null) {
    filters.push({
      key: 'hasAttachment',
      label: messageSearchState.hasAttachment ? 'With attachments' : 'Text only',
    });
  }
  if (messageSearchState.attachmentType !== 'any') {
    filters.push({
      key: 'attachmentType',
      label: getSearchAttachmentTypeLabel(messageSearchState.attachmentType),
    });
  }
  if (messageSearchState.hasLink !== null) {
    filters.push({
      key: 'hasLink',
      label: messageSearchState.hasLink ? 'Has links' : 'No links',
    });
  }
  if (scope === 'server' && messageSearchState.pinned !== null) {
    filters.push({
      key: 'pinned',
      label: messageSearchState.pinned ? 'Pinned' : 'Not pinned',
    });
  }
  return filters;
}

function hasActiveMessageSearchFilters(scope = getActiveMessageScope()) {
  return getMessageSearchFilterDescriptors(scope).length > 0;
}

function clearMessageSearchFilter(key) {
  if (key === 'fromUser' || key === 'mentions' || key === 'after' || key === 'before') {
    messageSearchState[key] = '';
  } else if (key === 'attachmentType') {
    messageSearchState.attachmentType = 'any';
  } else if (key === 'hasAttachment' || key === 'hasLink' || key === 'pinned') {
    messageSearchState[key] = null;
  }
  updateMessageSearchControls();
  if (messageSearchState.query || hasActiveMessageSearchFilters()) {
    handleSearchSubmit(messageSearchState.query).catch((error) => {
      console.warn('Could not refresh filtered search results:', error);
    });
  } else {
    closeSearchResults();
  }
}

function clearAllMessageSearchFilters() {
  messageSearchState.fromUser = '';
  messageSearchState.mentions = '';
  messageSearchState.after = '';
  messageSearchState.before = '';
  messageSearchState.hasAttachment = null;
  messageSearchState.attachmentType = 'any';
  messageSearchState.hasLink = null;
  messageSearchState.pinned = null;
  updateMessageSearchControls();
  if (messageSearchState.query) {
    handleSearchSubmit(messageSearchState.query).catch((error) => {
      console.warn('Could not refresh cleared search results:', error);
    });
  } else {
    closeSearchResults();
  }
}

function ensureMessageSearchSidebar() {
  const sidebar = document.getElementById('searchResultsSidebar');
  if (sidebar && sidebar.parentElement !== document.body) {
    document.body.appendChild(sidebar);
  }
  return sidebar;
}

function setupMessageSearch() {
  ensureMessageSearchSidebar();

  document.querySelectorAll('.search-form, .server-search-form').forEach((form) => {
    if (form.dataset.messageSearchReady === 'true') {
      return;
    }

    form.dataset.messageSearchReady = 'true';
    const input = form.querySelector('input');
    if (!input) {
      return;
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      handleSearchSubmit(input.value);
    });

    input.addEventListener('input', handleSearchInput);
  });

  document.querySelector('.search-filter-btn')?.addEventListener('click', openMessageSearchFilterDialog);
  document.querySelector('.search-sort-btn')?.addEventListener('click', toggleMessageSearchSort);
  updateMessageSearchControls();
}

function updateMessageSearchControls() {
  const scope = getActiveMessageScope();
  const activeFilters = getMessageSearchFilterDescriptors(scope);
  const filterButton = document.querySelector('.search-filter-btn');
  if (filterButton) {
    filterButton.textContent = activeFilters.length ? `${activeFilters.length} Filters` : 'Filters';
  }

  const sortButton = document.querySelector('.search-sort-btn');
  if (sortButton) {
    sortButton.textContent = messageSearchState.sort === 'oldest' ? 'Oldest' : 'Newest';
  }

  renderMessageSearchFilterSummary(activeFilters);
}

function renderMessageSearchFilterSummary(filters = getMessageSearchFilterDescriptors()) {
  const container = document.getElementById('searchActiveFilters');
  if (!container) {
    return;
  }

  container.innerHTML = '';
  if (!filters.length) {
    container.style.display = 'none';
    return;
  }

  filters.forEach((filter) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'search-filter-chip';
    chip.textContent = `${filter.label} x`;
    chip.addEventListener('click', () => clearMessageSearchFilter(filter.key));
    container.appendChild(chip);
  });

  const clearAll = document.createElement('button');
  clearAll.type = 'button';
  clearAll.className = 'search-filter-clear';
  clearAll.textContent = 'Clear';
  clearAll.addEventListener('click', clearAllMessageSearchFilters);
  container.appendChild(clearAll);
  container.style.display = 'flex';
}

function handleSearchInput(event) {
  scheduleMessageSearch(event.target.value);
}

function scheduleMessageSearch(query, delay = 280) {
  window.clearTimeout(messageSearchState.timer);
  messageSearchState.timer = window.setTimeout(() => {
    handleSearchSubmit(query);
  }, delay);
}

async function handleSearchSubmit(query) {
  messageSearchState.query = String(query || '').trim();
  if (!messageSearchState.query && !hasActiveMessageSearchFilters()) {
    closeSearchResults();
    return;
  }

  await performMessageSearch();
}

function getMessageSearchScopeLabel(scope = getActiveMessageScope()) {
  if (scope === 'server') {
    return getSelectedChannelNotificationName();
  }
  if (scope === 'group') {
    return currentGroupName || 'Group DM';
  }
  if (scope === 'dm') {
    return currentFriend || 'Direct Message';
  }
  return 'Messages';
}

function buildScopedMessageSearchUrl(scope, filters = {}) {
  const params = new URLSearchParams({
    query: filters.query || '',
    take: String(filters.take || 100),
  });

  if (filters.fromUser) {
    params.set('fromUser', filters.fromUser);
  }
  if (filters.mentions) {
    params.set('mentions', filters.mentions.replace(/^@/, ''));
  }
  if (filters.after) {
    params.set('after', filters.after);
  }
  if (filters.before) {
    params.set('before', filters.before);
  }
  if (filters.hasAttachment !== null && filters.hasAttachment !== undefined) {
    params.set('hasAttachment', String(filters.hasAttachment));
  }
  if (filters.attachmentType && filters.attachmentType !== 'any') {
    params.set('attachmentType', filters.attachmentType);
  }
  if (filters.hasLink !== null && filters.hasLink !== undefined) {
    params.set('hasLink', String(filters.hasLink));
  }

  if (scope === 'dm' && currentFriend) {
    params.set('targetUsername', currentFriend);
    return `${homeApiBase}/api/PrivateMessageFriend/SearchPrivateMessages?${params.toString()}`;
  }

  if (scope === 'group' && currentGroupId) {
    params.set('groupId', currentGroupId);
    return `${homeApiBase}/api/GroupChat/SearchGroupMessages?${params.toString()}`;
  }

  if (scope === 'server' && selectedChannelID) {
    params.set('channelId', selectedChannelID);
    if (filters.pinned !== null && filters.pinned !== undefined) {
      params.set('pinned', String(filters.pinned));
    }
    return `${homeApiBase}/api/ServerMessages/SearchMessages?${params.toString()}`;
  }

  return '';
}

function buildMessageSearchUrl(scope) {
  return buildScopedMessageSearchUrl(scope, messageSearchState);
}

function getSearchResultTimestamp(message = {}) {
  const date = new Date(message.date || message.Date || '');
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortSearchResults(messages = []) {
  return [...messages].sort((left, right) => {
    const diff = getSearchResultTimestamp(left) - getSearchResultTimestamp(right);
    return messageSearchState.sort === 'oldest' ? diff : -diff;
  });
}

async function performMessageSearch() {
  const scope = getActiveMessageScope();
  const url = buildMessageSearchUrl(scope);
  const sidebar = ensureMessageSearchSidebar();
  const list = document.getElementById('searchResultsList');
  const countSpan = document.getElementById('searchResultCount');

  if (!sidebar || !list || !countSpan) {
    return;
  }

  if (!url || !scope) {
    list.innerHTML = '<div class="search-empty-state">Open a conversation or text channel to search.</div>';
    countSpan.textContent = '0 Results';
    showElement(sidebar, 'flex');
    return;
  }

  const requestId = ++messageSearchState.requestId;
  messageSearchState.scope = scope;
  updateMessageSearchControls();
  list.innerHTML = '<div class="search-empty-state">Searching...</div>';
  countSpan.textContent = `Searching ${getMessageSearchScopeLabel(scope)}`;
  showElement(sidebar, 'flex');

  try {
    const response = await (apiClient || axios).get(url);
    if (requestId !== messageSearchState.requestId) {
      return;
    }

    const results = sortSearchResults(Array.isArray(response.data) ? response.data : []);
    renderMessageSearchResults(results, scope);
  } catch (error) {
    if (requestId !== messageSearchState.requestId) {
      return;
    }

    list.innerHTML = '<div class="search-empty-state">Search failed.</div>';
    countSpan.textContent = '0 Results';
    showAppMessage(getApiErrorMessage(error, 'Could not search messages.'), 'error');
  }
}

function renderMessageSearchResults(results, scope) {
  const list = document.getElementById('searchResultsList');
  const countSpan = document.getElementById('searchResultCount');
  if (!list || !countSpan) {
    return;
  }

  list.innerHTML = '';
  countSpan.textContent = `${results.length} ${results.length === 1 ? 'Result' : 'Results'}`;

  if (!results.length) {
    const empty = document.createElement('div');
    empty.className = 'search-empty-state';
    empty.textContent = 'No results found.';
    list.appendChild(empty);
    return;
  }

  results.forEach((message) => {
    list.appendChild(createSearchResultCard(message, messageSearchState.query, scope));
  });
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appendHighlightedText(container, text = '', query = '') {
  const source = String(text || '');
  const safeQuery = String(query || '').trim();
  if (!safeQuery) {
    container.textContent = source || 'Sent an attachment.';
    return;
  }

  const regex = new RegExp(escapeRegExp(safeQuery), 'gi');
  let cursor = 0;
  let match;
  while ((match = regex.exec(source)) !== null) {
    if (match.index > cursor) {
      container.appendChild(document.createTextNode(source.slice(cursor, match.index)));
    }

    const highlight = document.createElement('span');
    highlight.className = 'highlight';
    highlight.textContent = match[0];
    container.appendChild(highlight);
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) {
    container.appendChild(document.createTextNode(source.slice(cursor)));
  }

  if (!container.textContent) {
    container.textContent = 'Sent an attachment.';
  }
}

function getSearchResultAttachmentLabel(message = {}) {
  if (!getMessageAttachmentUrl(message)) {
    return '';
  }

  const contentType = getMessageAttachmentContentType(message).toLowerCase();
  if (contentType.startsWith('image/')) return 'Image';
  if (contentType.startsWith('video/')) return 'Video';
  if (contentType.startsWith('audio/')) return 'Audio';
  return 'Attachment';
}

function getSearchResultTags(message = {}, scope = getActiveMessageScope()) {
  const tags = [];
  const attachmentLabel = getSearchResultAttachmentLabel(message);
  if (attachmentLabel) {
    tags.push(attachmentLabel);
  }
  if (scope === 'server' && Boolean(message.isPinned ?? message.IsPinned)) {
    tags.push('Pinned');
  }
  if (getMessageIsWebhook(message)) {
    tags.push('Webhook');
  } else if (getMessageIsBot(message)) {
    tags.push('Bot');
  }
  return tags;
}

function createSearchResultCard(message, query, scope) {
  const username = getMessageSender(message);
  const text = getMessageText(message);
  const date = formatMessageDate(message.date || message.Date);
  const messageId = getMessageId(message);
  const card = document.createElement('div');
  card.className = 'search-result-card';
  card.dataset.messageId = messageId;
  card.dataset.messageScope = scope;
  card.title = messageId ? 'Jump to message' : '';

  const header = document.createElement('div');
  header.className = 'card-header';

  const avatar = document.createElement('div');
  avatar.className = 'card-avatar';
  avatar.textContent = username.charAt(0).toUpperCase() || '?';

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const name = document.createElement('span');
  name.className = 'card-username';
  name.textContent = username;
  const time = document.createElement('span');
  time.className = 'card-date';
  time.textContent = date;
  meta.appendChild(name);
  meta.appendChild(time);
  header.appendChild(avatar);
  header.appendChild(meta);

  const content = document.createElement('div');
  content.className = 'card-content';
  appendHighlightedText(content, text, query);

  card.appendChild(header);
  card.appendChild(content);
  const tags = getSearchResultTags(message, scope);
  if (tags.length) {
    const tagRow = document.createElement('div');
    tagRow.className = 'search-result-tags';
    tags.forEach((tag) => {
      const tagEl = document.createElement('span');
      tagEl.className = 'search-result-tag';
      tagEl.textContent = tag;
      tagRow.appendChild(tagEl);
    });
    card.appendChild(tagRow);
  }
  card.addEventListener('click', () => {
    if (messageId) {
      jumpToMessage(messageId, scope);
    }
  });

  return card;
}

function getAttachmentMediaKind(message = {}) {
  const attachmentUrl = getMessageAttachmentUrl(message);
  const contentType = getMessageAttachmentContentType(message).toLowerCase();
  if (!attachmentUrl) {
    return '';
  }

  if (contentType.startsWith('image/') || isStickerContentType(contentType) || /\.(png|jpe?g|gif|webp)$/i.test(attachmentUrl)) {
    return 'image';
  }
  if (contentType.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(attachmentUrl)) {
    return 'video';
  }
  if (contentType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(attachmentUrl)) {
    return 'audio';
  }
  return 'file';
}

function getAttachmentFileName(attachmentUrl = '') {
  const rawName = String(attachmentUrl || '').split('/').pop()?.split(/[?#]/)[0] || 'attachment';
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

function getMediaBrowserScopeLabel(scope = getActiveMessageScope()) {
  if (scope === 'server') {
    return `# ${getSelectedChannelNotificationName()}`;
  }
  if (scope === 'group') {
    return currentGroupName || 'Group DM';
  }
  if (scope === 'dm') {
    return currentFriend || 'Direct Message';
  }
  return 'Conversation';
}

function createMediaBrowserPreview(message = {}) {
  const attachmentUrl = getMessageAttachmentUrl(message);
  const resolvedUrl = resolveMediaUrl(attachmentUrl);
  const kind = getAttachmentMediaKind(message);
  const preview = document.createElement('div');
  preview.className = `media-browser-preview media-browser-preview-${kind || 'file'}`;

  if (kind === 'image') {
    const image = document.createElement('img');
    image.src = resolvedUrl;
    image.alt = getAttachmentFileName(attachmentUrl);
    image.loading = 'lazy';
    preview.appendChild(image);
  } else if (kind === 'video') {
    const video = document.createElement('video');
    video.src = resolvedUrl;
    video.controls = true;
    video.preload = 'metadata';
    preview.appendChild(video);
  } else if (kind === 'audio') {
    const audio = document.createElement('audio');
    audio.src = resolvedUrl;
    audio.controls = true;
    audio.preload = 'metadata';
    preview.appendChild(audio);
  } else {
    const fileIcon = document.createElement('div');
    fileIcon.className = 'media-browser-file-icon';
    fileIcon.textContent = 'FILE';
    preview.appendChild(fileIcon);
  }

  return preview;
}

function createMediaBrowserCard(message = {}, scope, closeDialog) {
  const attachmentUrl = getMessageAttachmentUrl(message);
  const resolvedUrl = resolveMediaUrl(attachmentUrl);
  const messageId = getMessageId(message);
  const card = document.createElement('div');
  card.className = 'media-browser-card';

  card.appendChild(createMediaBrowserPreview(message));

  const body = document.createElement('div');
  body.className = 'media-browser-card-body';

  const title = document.createElement('strong');
  title.textContent = getAttachmentFileName(attachmentUrl);
  const meta = document.createElement('span');
  meta.textContent = `${getMessageSender(message)} - ${formatMessageDate(message.date || message.Date)}`;
  body.appendChild(title);
  body.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'media-browser-card-actions';
  const openLink = document.createElement('a');
  openLink.className = 'server-tool-btn media-browser-open-link';
  openLink.href = resolvedUrl;
  openLink.target = '_blank';
  openLink.rel = 'noreferrer';
  openLink.textContent = 'Open';
  actions.appendChild(openLink);

  if (messageId) {
    const jumpButton = document.createElement('button');
    jumpButton.type = 'button';
    jumpButton.className = 'server-tool-btn';
    jumpButton.textContent = 'Jump';
    jumpButton.addEventListener('click', () => {
      closeDialog?.();
      jumpToMessage(messageId, scope);
    });
    actions.appendChild(jumpButton);
  }

  body.appendChild(actions);
  card.appendChild(body);
  return card;
}

function openMediaBrowserDialog() {
  const scope = getActiveMessageScope();
  if (!scope || (scope === 'server' && !isSelectedTextChannel())) {
    showAppMessage('Open a conversation or text channel first.', 'error');
    return;
  }

  closeAccountActionDialog();

  const overlay = document.createElement('div');
  overlay.className = 'account-action-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'account-action-dialog media-browser-dialog';

  const heading = document.createElement('h3');
  heading.textContent = 'Media Browser';
  const copy = document.createElement('p');
  copy.className = 'account-action-copy';
  copy.textContent = getMediaBrowserScopeLabel(scope);

  const controls = document.createElement('form');
  controls.className = 'media-browser-controls';
  controls.addEventListener('submit', (event) => {
    event.preventDefault();
    loadMedia();
  });

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'textInput media-browser-search';
  searchInput.placeholder = 'Search media';

  const typeSelect = document.createElement('select');
  typeSelect.className = 'settings-select media-browser-type';
  [
    ['image', 'Images'],
    ['video', 'Videos'],
    ['audio', 'Audio'],
    ['file', 'Files'],
    ['any', 'All'],
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    typeSelect.appendChild(option);
  });

  const refreshButton = document.createElement('button');
  refreshButton.type = 'submit';
  refreshButton.className = 'account-action-submit';
  refreshButton.textContent = 'Refresh';

  controls.appendChild(searchInput);
  controls.appendChild(typeSelect);
  controls.appendChild(refreshButton);

  const status = document.createElement('div');
  status.className = 'media-browser-status';
  status.textContent = 'Loading media...';

  const grid = document.createElement('div');
  grid.className = 'media-browser-grid';

  const actions = document.createElement('div');
  actions.className = 'account-action-buttons';
  const doneButton = document.createElement('button');
  doneButton.type = 'button';
  doneButton.className = 'account-action-cancel';
  doneButton.textContent = 'Done';
  actions.appendChild(doneButton);

  const close = () => overlay.remove();
  doneButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  let mediaRequestId = 0;
  let mediaTimer = null;
  const loadMedia = async () => {
    const requestId = ++mediaRequestId;
    const attachmentType = typeSelect.value || 'image';
    const url = buildScopedMessageSearchUrl(scope, {
      query: searchInput.value.trim(),
      hasAttachment: true,
      attachmentType,
      take: 100,
    });

    if (!url) {
      status.textContent = 'No conversation selected.';
      grid.innerHTML = '';
      return;
    }

    status.textContent = 'Loading media...';
    grid.innerHTML = '';
    try {
      const response = await (apiClient || axios).get(url);
      if (requestId !== mediaRequestId) {
        return;
      }

      const messages = sortSearchResults(Array.isArray(response.data) ? response.data : [])
        .filter((message) => getMessageAttachmentUrl(message));
      status.textContent = `${messages.length} ${messages.length === 1 ? 'item' : 'items'}`;
      if (!messages.length) {
        grid.innerHTML = '<div class="empty-state-card padded media-browser-empty">No media found.</div>';
        return;
      }

      messages.forEach((message) => {
        grid.appendChild(createMediaBrowserCard(message, scope, close));
      });
    } catch (error) {
      status.textContent = getApiErrorMessage(error, 'Could not load media.');
    }
  };

  searchInput.addEventListener('input', () => {
    window.clearTimeout(mediaTimer);
    mediaTimer = window.setTimeout(loadMedia, 280);
  });
  typeSelect.addEventListener('change', loadMedia);

  dialog.appendChild(heading);
  dialog.appendChild(copy);
  dialog.appendChild(controls);
  dialog.appendChild(status);
  dialog.appendChild(grid);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  searchInput.focus();
  loadMedia();
}

async function openMessageSearchFilterDialog() {
  const scope = getActiveMessageScope();
  const fields = [
    {
      name: 'fromUser',
      label: 'From user',
      value: messageSearchState.fromUser,
      required: false,
    },
    {
      name: 'mentions',
      label: 'Mentions user',
      value: messageSearchState.mentions,
      required: false,
    },
    {
      name: 'after',
      label: 'After date',
      type: 'date',
      value: messageSearchState.after,
      required: false,
    },
    {
      name: 'before',
      label: 'Before date',
      type: 'date',
      value: messageSearchState.before,
      required: false,
    },
    {
      name: 'hasAttachment',
      label: 'Attachments',
      value: messageSearchState.hasAttachment === null ? 'any' : String(messageSearchState.hasAttachment),
      options: [
        { value: 'any', label: 'Any' },
        { value: 'true', label: 'With attachments' },
        { value: 'false', label: 'Text only' },
      ],
    },
    {
      name: 'attachmentType',
      label: 'Attachment type',
      value: messageSearchState.attachmentType,
      options: [
        { value: 'any', label: 'Any' },
        { value: 'image', label: 'Images' },
        { value: 'video', label: 'Videos' },
        { value: 'audio', label: 'Audio' },
        { value: 'file', label: 'Files' },
      ],
    },
    {
      name: 'hasLink',
      label: 'Links',
      value: messageSearchState.hasLink === null ? 'any' : String(messageSearchState.hasLink),
      options: [
        { value: 'any', label: 'Any' },
        { value: 'true', label: 'Has links' },
        { value: 'false', label: 'No links' },
      ],
    },
  ];

  if (scope === 'server') {
    fields.push({
      name: 'pinned',
      label: 'Pinned',
      value: messageSearchState.pinned === null ? 'any' : String(messageSearchState.pinned),
      options: [
        { value: 'any', label: 'Any' },
        { value: 'true', label: 'Pinned' },
        { value: 'false', label: 'Not pinned' },
      ],
    });
  }

  const values = await openSimpleFormDialog({
    title: 'Advanced Search',
    fields,
    confirmText: 'Apply',
    preserveExisting: true,
  });

  if (!values) {
    return;
  }

  messageSearchState.fromUser = values.fromUser || '';
  messageSearchState.mentions = (values.mentions || '').replace(/^@/, '');
  messageSearchState.after = values.after || '';
  messageSearchState.before = values.before || '';
  messageSearchState.attachmentType = values.attachmentType || 'any';
  messageSearchState.hasAttachment = messageSearchState.attachmentType === 'any'
    ? parseSearchNullableBoolean(values.hasAttachment)
    : true;
  messageSearchState.hasLink = parseSearchNullableBoolean(values.hasLink);
  if (scope === 'server') {
    messageSearchState.pinned = parseSearchNullableBoolean(values.pinned);
  }
  updateMessageSearchControls();
  await handleSearchSubmit(messageSearchState.query);
}

function toggleMessageSearchSort() {
  messageSearchState.sort = messageSearchState.sort === 'newest' ? 'oldest' : 'newest';
  updateMessageSearchControls();
  if (messageSearchState.query || hasActiveMessageSearchFilters()) {
    handleSearchSubmit(messageSearchState.query).catch((error) => {
      console.warn('Could not refresh sorted search results:', error);
    });
  }
}

function closeSearchResults() {
  const sidebar = document.getElementById('searchResultsSidebar');
  if (sidebar) hideElement(sidebar);
  document.querySelectorAll('#dmSearchInput, #serverSearchInput').forEach((input) => {
    input.value = '';
  });
  messageSearchState.query = '';
  messageSearchState.requestId += 1;
}

function toggleEmojiPicker(event = null) {
  const picker = document.getElementById('emojiPicker');
  setActiveEmojiPickerInputFromTarget(event?.currentTarget || event?.target || document.activeElement);
  if (!isElementVisible(picker)) {
    positionEmojiPicker();
    showElement(picker, 'flex');
    const searchInput = document.getElementById('emojiSearchInput');
    refreshEmojiPicker();
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
  const popoutStatus = document.getElementById('popoutStatus');
  const popoutActivity = document.getElementById('popoutActivity');
  const popoutCustomStatus = document.getElementById('popoutCustomStatus');
  const popoutBadges = document.getElementById('popoutBadges');
  if (popoutStatus) {
    popoutStatus.textContent = 'Loading';
    setPresenceClass(popoutStatus, 'invisible');
  }
  if (popoutCustomStatus) {
    popoutCustomStatus.textContent = '';
    hideElement(popoutCustomStatus);
  }
  if (popoutActivity) {
    popoutActivity.textContent = '';
    hideElement(popoutActivity);
  }
  renderUserBadges(popoutBadges, []);
  let actionRow = document.getElementById('profilePopoutActions');
  if (!actionRow) {
    actionRow = document.createElement('div');
    actionRow.id = 'profilePopoutActions';
    actionRow.className = 'profile-popout-actions';
    document.querySelector('#profilePopout .profile-popout-body')?.appendChild(actionRow);
  }
  let reportButton = document.getElementById('profileReportBtn');
  if (!reportButton) {
    reportButton = document.createElement('button');
    reportButton.id = 'profileReportBtn';
    reportButton.type = 'button';
    reportButton.className = 'profile-popout-report-btn';
  }
  actionRow.appendChild(reportButton);
  let blockButton = document.getElementById('profileBlockBtn');
  if (!blockButton) {
    blockButton = document.createElement('button');
    blockButton.id = 'profileBlockBtn';
    blockButton.type = 'button';
    blockButton.className = 'profile-popout-block-btn';
  }
  actionRow.appendChild(blockButton);
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
  const refreshBlockButton = () => {
    const blocked = isUserBlocked(username);
    blockButton.textContent = blocked ? 'Unblock User' : 'Block User';
    blockButton.classList.toggle('blocked', blocked);
  };
  blockButton.hidden = username === JWTusername;
  refreshBlockButton();
  blockButton.onclick = async () => {
    try {
      if (isUserBlocked(username)) {
        await unblockAccountUser(username);
      } else if (await askConfirm('Block User', `Block ${username}? They will not be able to DM you.`, {
        danger: true,
        confirmText: 'Block',
        preserveExisting: true,
      })) {
        await blockAccountUser(username);
      }
      refreshBlockButton();
    } catch (error) {
      showAppMessage(getApiErrorMessage(error, 'Could not update block.'), 'error');
    }
  };

  try {
    const res = await axios.get(`${homeApiBase}/api/Account/GetAccountProfile?username=${encodeURIComponent(username)}`);
    const profile = res.data;

    if (profile) {
      cacheProfileSummary({ ...profile, username });
      const presenceStatus = getProfilePresenceStatus(profile);
      const customStatus = getProfileCustomStatus(profile);
      const activityStatus = getProfileActivityStatus(profile);
      const profileBadges = getProfileBadges(profile);
      if (popoutStatus) {
        popoutStatus.textContent = getPresenceStatusLabel(presenceStatus);
        setPresenceClass(popoutStatus, presenceStatus);
      }
      if (popoutActivity) {
        popoutActivity.textContent = activityStatus;
        setElementVisible(popoutActivity, Boolean(activityStatus), 'block');
      }
      if (popoutCustomStatus) {
        popoutCustomStatus.textContent = customStatus;
        setElementVisible(popoutCustomStatus, Boolean(customStatus), 'block');
      }
      renderUserBadges(popoutBadges, profileBadges);
      const profileBio = getProfileBio(profile);
      if (profileBio) {
        document.getElementById('popoutDescription').innerText = profileBio;
      } else {
        document.getElementById('popoutDescription').innerText = "No bio provided.";
      }

      if (profile.profilePictureUrl) {
        document.getElementById('popoutAvatar').src = resolveMediaUrl(profile.profilePictureUrl);
      }
    }
  } catch (err) {
    console.error("Failed to load profile for popout", err);
    document.getElementById('popoutDescription').innerText = "Failed to load profile.";
    if (popoutStatus) {
      popoutStatus.textContent = 'Unavailable';
      setPresenceClass(popoutStatus, 'invisible');
    }
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
  accent: '#5865f2',
};
const DEFAULT_APP_LANGUAGE = 'en-US';
const DEFAULT_DATA_CONTROLS = Object.freeze({
  useActivityForPersonalization: true,
  shareDiagnostics: false,
  localSearchHistory: true,
  localMediaCache: true,
});
const DATA_PRIVACY_CONTROL_KEYS = Object.freeze({
  privacyUseActivityForPersonalization: 'useActivityForPersonalization',
  privacyShareDiagnostics: 'shareDiagnostics',
  privacyLocalSearchHistory: 'localSearchHistory',
  privacyLocalMediaCache: 'localMediaCache',
});
const PORTABLE_APP_SETTINGS_KEYS = Object.freeze([
  'profileView',
  'themeMode',
  'customTheme',
  'messageDisplay',
  'inputMode',
  'fontSize',
  'zoomLevel',
  'saturation',
  'toggles',
  'checkboxes',
  'radios',
  'sliders',
  'selects',
  'keybinds',
  'voiceChanger',
  'connectedAccounts',
  'removedItems',
  'language',
  'dataControls',
]);
const SUPPORTED_LOCALES = Object.freeze({
  'en-US': {
    label: 'English (US)',
    lang: 'en-US',
    text: {},
  },
  'en-GB': {
    label: 'English (UK)',
    lang: 'en-GB',
    text: {
      'Use activity for personalization': 'Use activity for personalisation',
      'Let MyDiscord tailor suggestions and reminders from your activity status.':
        'Let MyDiscord tailor suggestions and reminders from your activity status.',
    },
  },
  de: {
    label: 'Deutsch',
    lang: 'de',
    text: {
      Settings: 'Einstellungen',
      'Search settings': 'Einstellungen suchen',
      'User Settings': 'Benutzereinstellungen',
      'App Settings': 'App-Einstellungen',
      'Activity Settings': 'Aktivitaetseinstellungen',
      'My Account': 'Mein Konto',
      Profiles: 'Profile',
      'Privacy & Safety': 'Datenschutz & Sicherheit',
      'Family Center': 'Familiencenter',
      'Authorized Apps': 'Autorisierte Apps',
      'Developer Portal': 'Entwicklerportal',
      Devices: 'Geraete',
      Connections: 'Verbindungen',
      Clips: 'Clips',
      Appearance: 'Darstellung',
      Accessibility: 'Barrierefreiheit',
      'Voice & Video': 'Sprache & Video',
      Chat: 'Chat',
      Notifications: 'Benachrichtigungen',
      Keybinds: 'Tastenkombinationen',
      Language: 'Sprache',
      'Streamer Mode': 'Streamer-Modus',
      Advanced: 'Erweitert',
      'Activity Privacy': 'Aktivitaetsdatenschutz',
      'Registered Games': 'Registrierte Spiele',
      'Log Out': 'Abmelden',
      'Select Language': 'Sprache auswaehlen',
      'Data Export': 'Datenexport',
      'Download JSON': 'JSON herunterladen',
      'Copy Summary': 'Zusammenfassung kopieren',
      'Data & Privacy Controls': 'Daten- und Datenschutzkontrollen',
      'Choose how local app data and optional diagnostics are used.':
        'Lege fest, wie lokale App-Daten und optionale Diagnosen verwendet werden.',
      'Use activity for personalization': 'Aktivitaet zur Personalisierung verwenden',
      'Let MyDiscord tailor suggestions and reminders from your activity status.':
        'MyDiscord darf Vorschlaege und Erinnerungen anhand deines Aktivitaetsstatus anpassen.',
      'Share crash and error diagnostics': 'Absturz- und Fehlerdiagnosen teilen',
      'Include technical reports that help improve app stability.':
        'Technische Berichte einschliessen, die die App-Stabilitaet verbessern.',
      'Keep local search and onboarding history': 'Lokalen Such- und Onboarding-Verlauf behalten',
      'Store convenience data on this device for faster repeat visits.':
        'Komfortdaten auf diesem Geraet fuer schnellere Wiederbesuche speichern.',
      'Cache media previews locally': 'Medienvorschauen lokal zwischenspeichern',
      'Keep temporary profile and media metadata on this device.':
        'Temporaere Profil- und Medienmetadaten auf diesem Geraet behalten.',
      'Download Data': 'Daten herunterladen',
      'Clear Local Data': 'Lokale Daten loeschen',
      'App Settings Backup': 'App-Einstellungen sichern',
      'Export your local app preferences or import a settings JSON file on this device.':
        'Exportiere lokale App-Einstellungen oder importiere eine JSON-Datei auf diesem Geraet.',
      'Export Settings': 'Einstellungen exportieren',
      'Import Settings': 'Einstellungen importieren',
      'Reset Settings': 'Einstellungen zuruecksetzen',
      'Settings backup is ready.': 'Einstellungssicherung ist bereit.',
      'App Updates': 'App-Updates',
      Diagnostics: 'Diagnose',
    },
  },
  fr: {
    label: 'Francais',
    lang: 'fr',
    text: {
      Settings: 'Parametres',
      'Search settings': 'Rechercher dans les parametres',
      'User Settings': 'Parametres utilisateur',
      'App Settings': 'Parametres de l app',
      'Activity Settings': 'Parametres d activite',
      'My Account': 'Mon compte',
      Profiles: 'Profils',
      'Privacy & Safety': 'Confidentialite et securite',
      'Family Center': 'Centre familial',
      'Authorized Apps': 'Applications autorisees',
      'Developer Portal': 'Portail developpeur',
      Devices: 'Appareils',
      Connections: 'Connexions',
      Clips: 'Clips',
      Appearance: 'Apparence',
      Accessibility: 'Accessibilite',
      'Voice & Video': 'Voix et video',
      Chat: 'Discussion',
      Notifications: 'Notifications',
      Keybinds: 'Raccourcis',
      Language: 'Langue',
      'Streamer Mode': 'Mode streamer',
      Advanced: 'Avance',
      'Activity Privacy': 'Confidentialite de l activite',
      'Registered Games': 'Jeux enregistres',
      'Log Out': 'Deconnexion',
      'Select Language': 'Choisir la langue',
      'Data Export': 'Export des donnees',
      'Download JSON': 'Telecharger JSON',
      'Copy Summary': 'Copier le resume',
      'Data & Privacy Controls': 'Controles donnees et confidentialite',
      'Choose how local app data and optional diagnostics are used.':
        'Choisis comment les donnees locales et les diagnostics optionnels sont utilises.',
      'Use activity for personalization': 'Utiliser l activite pour personnaliser',
      'Let MyDiscord tailor suggestions and reminders from your activity status.':
        'Autoriser MyDiscord a adapter les suggestions et rappels a partir de ton activite.',
      'Share crash and error diagnostics': 'Partager les diagnostics de plantage et d erreur',
      'Include technical reports that help improve app stability.':
        'Inclure des rapports techniques pour ameliorer la stabilite de l app.',
      'Keep local search and onboarding history': 'Conserver l historique local',
      'Store convenience data on this device for faster repeat visits.':
        'Stocker des donnees pratiques sur cet appareil pour les prochaines visites.',
      'Cache media previews locally': 'Mettre en cache les apercus media',
      'Keep temporary profile and media metadata on this device.':
        'Conserver les metadonnees temporaires de profils et medias sur cet appareil.',
      'Download Data': 'Telecharger les donnees',
      'Clear Local Data': 'Effacer les donnees locales',
      'App Settings Backup': 'Sauvegarde des parametres',
      'Export your local app preferences or import a settings JSON file on this device.':
        'Exporte tes preferences locales ou importe un fichier JSON de parametres sur cet appareil.',
      'Export Settings': 'Exporter',
      'Import Settings': 'Importer',
      'Reset Settings': 'Reinitialiser',
      'Settings backup is ready.': 'La sauvegarde des parametres est prete.',
      'App Updates': 'Mises a jour',
      Diagnostics: 'Diagnostics',
    },
  },
  es: {
    label: 'Espanol',
    lang: 'es',
    text: {
      Settings: 'Ajustes',
      'Search settings': 'Buscar ajustes',
      'User Settings': 'Ajustes de usuario',
      'App Settings': 'Ajustes de la app',
      'Activity Settings': 'Ajustes de actividad',
      'My Account': 'Mi cuenta',
      Profiles: 'Perfiles',
      'Privacy & Safety': 'Privacidad y seguridad',
      'Family Center': 'Centro familiar',
      'Authorized Apps': 'Apps autorizadas',
      'Developer Portal': 'Portal de desarrollador',
      Devices: 'Dispositivos',
      Connections: 'Conexiones',
      Clips: 'Clips',
      Appearance: 'Apariencia',
      Accessibility: 'Accesibilidad',
      'Voice & Video': 'Voz y video',
      Chat: 'Chat',
      Notifications: 'Notificaciones',
      Keybinds: 'Atajos',
      Language: 'Idioma',
      'Streamer Mode': 'Modo streamer',
      Advanced: 'Avanzado',
      'Activity Privacy': 'Privacidad de actividad',
      'Registered Games': 'Juegos registrados',
      'Log Out': 'Cerrar sesion',
      'Select Language': 'Seleccionar idioma',
      'Data Export': 'Exportar datos',
      'Download JSON': 'Descargar JSON',
      'Copy Summary': 'Copiar resumen',
      'Data & Privacy Controls': 'Controles de datos y privacidad',
      'Choose how local app data and optional diagnostics are used.':
        'Elige como se usan los datos locales y los diagnosticos opcionales.',
      'Use activity for personalization': 'Usar actividad para personalizacion',
      'Let MyDiscord tailor suggestions and reminders from your activity status.':
        'Permite que MyDiscord adapte sugerencias y recordatorios con tu estado de actividad.',
      'Share crash and error diagnostics': 'Compartir diagnosticos de fallos y errores',
      'Include technical reports that help improve app stability.':
        'Incluye informes tecnicos para mejorar la estabilidad de la app.',
      'Keep local search and onboarding history': 'Guardar busqueda local e historial inicial',
      'Store convenience data on this device for faster repeat visits.':
        'Guarda datos de comodidad en este dispositivo para visitas futuras.',
      'Cache media previews locally': 'Guardar vistas previas multimedia localmente',
      'Keep temporary profile and media metadata on this device.':
        'Guarda metadatos temporales de perfiles y multimedia en este dispositivo.',
      'Download Data': 'Descargar datos',
      'Clear Local Data': 'Borrar datos locales',
      'App Settings Backup': 'Copia de ajustes',
      'Export your local app preferences or import a settings JSON file on this device.':
        'Exporta tus preferencias locales o importa un archivo JSON de ajustes en este dispositivo.',
      'Export Settings': 'Exportar ajustes',
      'Import Settings': 'Importar ajustes',
      'Reset Settings': 'Restablecer ajustes',
      'Settings backup is ready.': 'La copia de ajustes esta lista.',
      'App Updates': 'Actualizaciones',
      Diagnostics: 'Diagnosticos',
    },
  },
  it: {
    label: 'Italiano',
    lang: 'it',
    text: {
      Settings: 'Impostazioni',
      'Search settings': 'Cerca impostazioni',
      'User Settings': 'Impostazioni utente',
      'App Settings': 'Impostazioni app',
      'My Account': 'Il mio account',
      'Privacy & Safety': 'Privacy e sicurezza',
      Language: 'Lingua',
      Advanced: 'Avanzate',
      'Select Language': 'Seleziona lingua',
      'Data & Privacy Controls': 'Controlli dati e privacy',
      'Download Data': 'Scarica dati',
      'Clear Local Data': 'Cancella dati locali',
      'App Settings Backup': 'Backup impostazioni app',
      'Export Settings': 'Esporta impostazioni',
      'Import Settings': 'Importa impostazioni',
      'Reset Settings': 'Reimposta impostazioni',
      'Settings backup is ready.': 'Backup impostazioni pronto.',
    },
  },
  'pt-BR': {
    label: 'Portugues (BR)',
    lang: 'pt-BR',
    text: {
      Settings: 'Configuracoes',
      'Search settings': 'Buscar configuracoes',
      'User Settings': 'Configuracoes do usuario',
      'App Settings': 'Configuracoes do app',
      'My Account': 'Minha conta',
      'Privacy & Safety': 'Privacidade e seguranca',
      Language: 'Idioma',
      Advanced: 'Avancado',
      'Select Language': 'Selecionar idioma',
      'Data & Privacy Controls': 'Controles de dados e privacidade',
      'Download Data': 'Baixar dados',
      'Clear Local Data': 'Limpar dados locais',
      'App Settings Backup': 'Backup das configuracoes',
      'Export Settings': 'Exportar configuracoes',
      'Import Settings': 'Importar configuracoes',
      'Reset Settings': 'Redefinir configuracoes',
      'Settings backup is ready.': 'Backup das configuracoes pronto.',
    },
  },
});

let settingsInteractivityInitialized = false;
let settingsSystemThemeListenerInitialized = false;
let settingsModalReturnFocusElement = null;
let accountSettingsLoadPromise = null;
let accountSettingsPersistTimer = null;
let accountSettingsServerState = null;
let voicePreviewStream = null;
let voicePreviewAudio = null;
let voicePreviewContext = null;

function normalizeAppLanguage(language, fallback = DEFAULT_APP_LANGUAGE) {
  const rawValue = String(language || '').trim();
  if (SUPPORTED_LOCALES[rawValue]) {
    return rawValue;
  }

  const normalized = rawValue.replace('_', '-').toLowerCase();
  if (normalized === 'en-gb') {
    return 'en-GB';
  }

  if (normalized === 'pt' || normalized === 'pt-br') {
    return 'pt-BR';
  }

  const baseLanguage = normalized.split('-')[0];
  if (SUPPORTED_LOCALES[baseLanguage]) {
    return baseLanguage;
  }

  return SUPPORTED_LOCALES[fallback] ? fallback : DEFAULT_APP_LANGUAGE;
}

function getDefaultAppLanguage() {
  if (typeof navigator === 'undefined') {
    return DEFAULT_APP_LANGUAGE;
  }

  return normalizeAppLanguage(
    navigator.languages?.[0] || navigator.language || DEFAULT_APP_LANGUAGE
  );
}

function normalizeDataControls(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_DATA_CONTROLS).map(([key, fallback]) => [
      key,
      typeof source[key] === 'boolean' ? source[key] : fallback,
    ])
  );
}

function getDataPrivacyControlKey(settingKey) {
  return DATA_PRIVACY_CONTROL_KEYS[settingKey] || null;
}

function getLocalizedSettingsText(locale, source) {
  const normalizedLocale = normalizeAppLanguage(locale);
  const bundle = SUPPORTED_LOCALES[normalizedLocale] || SUPPORTED_LOCALES[DEFAULT_APP_LANGUAGE];
  return bundle.text?.[source] || source;
}

function populateLanguageSelect(locale = readSettingsState().language) {
  const select =
    document.getElementById('languageSelect') ||
    document.querySelector('#view-language select.settings-select');
  if (!select) {
    return null;
  }

  const activeLocale = normalizeAppLanguage(locale);
  select.id = 'languageSelect';
  select.dataset.settingsSelect = 'language';
  select.setAttribute('aria-label', getLocalizedSettingsText(activeLocale, 'Select Language'));

  if (select.dataset.languageOptionsReady !== 'true') {
    select.innerHTML = '';
    Object.entries(SUPPORTED_LOCALES).forEach(([value, config]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = config.label;
      select.appendChild(option);
    });
    select.dataset.languageOptionsReady = 'true';
  }

  select.value = activeLocale;
  return select;
}

function applyLocalization(locale = readSettingsState().language) {
  const activeLocale = normalizeAppLanguage(locale);
  document.documentElement.lang = SUPPORTED_LOCALES[activeLocale]?.lang || DEFAULT_APP_LANGUAGE;
  populateLanguageSelect(activeLocale);

  const settingsModal = document.getElementById('settingsModal');
  if (!settingsModal) {
    return;
  }

  settingsModal.querySelectorAll('[placeholder]').forEach((element) => {
    if (!element.dataset.l10nPlaceholderSource) {
      element.dataset.l10nPlaceholderSource = element.getAttribute('placeholder') || '';
    }
    const source = element.dataset.l10nPlaceholderSource;
    element.setAttribute('placeholder', getLocalizedSettingsText(activeLocale, source));
  });

  const staticTextSelector = [
    'h2.settings-page-title',
    'h2.sr-only',
    'h3.settings-section-header',
    '.settings-group-title',
    '.settings-item',
    '.settings-tab',
    '.form-label',
    '.form-desc',
    '.toggle-label',
    '.toggle-desc',
    '.checkbox-label',
    '.radio-title',
    '.radio-desc',
    '.app-maintenance-label',
    'button',
    '.close-label',
  ].join(',');

  settingsModal
    .querySelectorAll(staticTextSelector)
    .forEach((element) => {
      if (element.closest('#languageSelect') || element.children.length > 0) {
        return;
      }

      const source = element.dataset.l10nSource || element.textContent.trim();
      if (!source) {
        return;
      }

      if (!element.dataset.l10nSource) {
        element.dataset.l10nSource = source;
      }

      element.textContent = getLocalizedSettingsText(activeLocale, source);
    });

  const activeNavItem = document.querySelector('.settings-item.active[data-target]');
  const dialogTitle = document.getElementById('settingsDialogTitle');
  if (dialogTitle && activeNavItem) {
    const source = activeNavItem.dataset.l10nSource || activeNavItem.textContent.trim();
    dialogTitle.textContent = getLocalizedSettingsText(activeLocale, source);
  }
}

function createDefaultSettingsState() {
  return {
    selectedTab: 'my-account',
    profileView: 'user-profile',
    themeMode: 'dark',
    customTheme: null,
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
    language: getDefaultAppLanguage(),
    dataControls: { ...DEFAULT_DATA_CONTROLS },
    profileBannerColor: '#0c0c0c',
    profileBannerUrl: '',
    presenceStatus: 'online',
    customStatus: '',
    activityStatus: '',
    accountStanding: {
      standing: 'good',
      label: 'Good',
      trustScore: 60,
      summary: 'No restrictions are applied to this account.',
      reason: '',
      signals: [],
    },
    profileBadges: [],
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
    blockedUsers: [],
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
      customTheme: normalizeCustomTheme(parsedState.customTheme, fallbackState.customTheme),
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
      language: normalizeAppLanguage(
        parsedState.language ?? parsedState.selects?.language,
        fallbackState.language
      ),
      dataControls: normalizeDataControls(parsedState.dataControls),
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
      customStatus:
        typeof parsedState.customStatus === 'string'
          ? normalizeCustomStatus(parsedState.customStatus)
          : fallbackState.customStatus,
      activityStatus:
        typeof parsedState.activityStatus === 'string'
          ? normalizeActivityStatus(parsedState.activityStatus)
          : fallbackState.activityStatus,
      accountStanding:
        parsedState.accountStanding && typeof parsedState.accountStanding === 'object'
          ? { ...fallbackState.accountStanding, ...parsedState.accountStanding }
          : fallbackState.accountStanding,
      profileBadges: normalizeProfileBadges(parsedState.profileBadges),
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
      blockedUsers: normalizeAccountUsernameList(parsedState.blockedUsers),
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

  if (Boolean(member.isBot ?? member.IsBot) || member.username === JWTusername || normalizeRoleName(member.role) === 'owner') {
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

  const uploadUrl = getUploadUrlFromResponse(res.data);
  if (!uploadUrl) {
    throw new Error('Upload did not return a file URL.');
  }

  return uploadUrl;
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
  delete settingsPayload.accountStanding;
  delete settingsPayload.activityStatus;
  delete settingsPayload.blockedUsers;

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
    customTheme: normalizeCustomTheme(serverState.customTheme, fallback.customTheme),
    customStatus: normalizeCustomStatus(
      data.customStatus ?? serverState.customStatus ?? fallback.customStatus
    ),
    activityStatus: normalizeActivityStatus(
      data.activityStatus ?? serverState.activityStatus ?? fallback.activityStatus
    ),
    accountStanding:
      data.accountStanding && typeof data.accountStanding === 'object'
        ? { ...fallback.accountStanding, ...data.accountStanding }
        : serverState.accountStanding && typeof serverState.accountStanding === 'object'
          ? { ...fallback.accountStanding, ...serverState.accountStanding }
          : fallback.accountStanding,
    profileBadges: normalizeProfileBadges(
      data.profileBadges ?? data.badges ?? serverState.profileBadges ?? fallback.profileBadges
    ),
    language: normalizeAppLanguage(serverState.language, fallback.language),
    dataControls: normalizeDataControls(serverState.dataControls),
    blockedUsers: normalizeAccountUsernameList(data.blockedUsers ?? serverState.blockedUsers ?? []),
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

function getAccessibleControlLabel(element) {
  return (
    element?.getAttribute?.('aria-label') ||
    element?.querySelector?.('.toggle-label, .checkbox-label, .radio-title')?.textContent?.trim() ||
    element?.textContent?.trim() ||
    'Control'
  );
}

function ensureKeyboardActivation(element) {
  if (!element || element.dataset.keyboardActivationReady === 'true') return;
  element.dataset.keyboardActivationReady = 'true';
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target?.matches?.('input, textarea, select, button')) return;
    event.preventDefault();
    element.click();
  });
}

function updateSettingsNavigationAccessibility() {
  document.querySelectorAll('.settings-item[data-target]').forEach((item) => {
    const target = item.dataset.target;
    const isActive = item.classList.contains('active');
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-controls', `view-${target}`);
    item.setAttribute('aria-current', isActive ? 'page' : 'false');
    ensureKeyboardActivation(item);
  });

  const logoutItem = document.querySelector('.settings-item.log-out');
  if (logoutItem) {
    logoutItem.setAttribute('role', 'button');
    logoutItem.setAttribute('tabindex', '0');
    logoutItem.setAttribute('aria-label', 'Log out');
    ensureKeyboardActivation(logoutItem);
  }

  const closeButton = document.querySelector('.settings-close-btn');
  if (closeButton) {
    closeButton.setAttribute('role', 'button');
    closeButton.setAttribute('tabindex', '0');
    closeButton.setAttribute('aria-label', 'Close settings');
    ensureKeyboardActivation(closeButton);
  }
}

function updateProfileTabAccessibility(activeTab = readSettingsState().profileView || 'user-profile') {
  const profileTabBar = document.querySelector('[data-settings-tab-bar="profileView"]');
  if (!profileTabBar) return;

  profileTabBar.setAttribute('role', 'tablist');
  profileTabBar.querySelectorAll('.settings-tab').forEach((tab) => {
    const tabKey = tab.dataset.tab || 'user-profile';
    const panel = document.querySelector(`[data-tab-panel="${tabKey}"]`);
    if (panel && !panel.id) {
      panel.id = `profile-tab-panel-${tabKey}`;
    }

    tab.setAttribute('role', 'tab');
    tab.setAttribute('tabindex', tabKey === activeTab ? '0' : '-1');
    tab.setAttribute('aria-selected', tabKey === activeTab ? 'true' : 'false');
    if (panel?.id) {
      tab.setAttribute('aria-controls', panel.id);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id || `profile-tab-${tabKey}`);
    }
    if (!tab.id) {
      tab.id = `profile-tab-${tabKey}`;
    }
    ensureKeyboardActivation(tab);
  });
}

function updateRadioGroupAccessibility(group) {
  if (!group) return;
  group.setAttribute('role', 'radiogroup');
  group.querySelectorAll('.radio-item').forEach((item) => {
    const isSelected = item.classList.contains('active');
    item.setAttribute('role', 'radio');
    item.setAttribute('tabindex', isSelected ? '0' : '-1');
    item.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    ensureKeyboardActivation(item);
  });
}

function updateToggleAccessibility(item) {
  const toggle = item?.querySelector?.('.toggle-switch');
  if (!item || !toggle) return;
  const isActive = toggle.classList.contains('active');
  item.setAttribute('role', 'switch');
  item.setAttribute('tabindex', '0');
  item.setAttribute('aria-checked', isActive ? 'true' : 'false');
  item.setAttribute('aria-label', getAccessibleControlLabel(item));
  ensureKeyboardActivation(item);
}

function updateCheckboxAccessibility(item) {
  const checkbox = item?.querySelector?.('.checkbox-box');
  if (!item || !checkbox) return;
  const isChecked = checkbox.classList.contains('checked');
  item.setAttribute('role', 'checkbox');
  item.setAttribute('tabindex', '0');
  item.setAttribute('aria-checked', isChecked ? 'true' : 'false');
  item.setAttribute('aria-label', getAccessibleControlLabel(item));
  ensureKeyboardActivation(item);
}

function setupSettingsAccessibility() {
  updateSettingsNavigationAccessibility();
  updateProfileTabAccessibility();
  document.querySelectorAll('.radio-group').forEach(updateRadioGroupAccessibility);
  document.querySelectorAll('.toggle-item').forEach(updateToggleAccessibility);
  document.querySelectorAll('.checkbox-item').forEach(updateCheckboxAccessibility);
  document.querySelectorAll('.settings-slider').forEach((slider, index) => {
    if (!slider.getAttribute('aria-label')) {
      const label =
        slider.closest('.form-group, .settings-view')?.querySelector('.form-label, .settings-section-header')?.textContent?.trim() ||
        getSliderSettingKey(slider, index);
      slider.setAttribute('aria-label', label);
    }
  });
  document.querySelectorAll('.settings-select').forEach((select, index) => {
    if (!select.getAttribute('aria-label') && !select.labels?.length) {
      const label =
        select.closest('.form-group, .settings-view')?.querySelector('.form-label, .settings-section-header')?.textContent?.trim() ||
        getSelectSettingKey(select, index);
      select.setAttribute('aria-label', label);
    }
  });

  document
    .querySelectorAll('.navText, .plus, .friends, .device-remove, .game-overlay-toggle, .remove-game-btn, .remove-link, .close, .closeJoin, .closeSecond, .backSecondModal, .closeThird, .creationBack')
    .forEach((element) => {
      element.setAttribute('role', 'button');
      element.setAttribute('tabindex', '0');
      ensureKeyboardActivation(element);
    });
}

function updateAccountStandingPanel(state = readSettingsState()) {
  const standing = getAccountStanding(state);
  const standingLabel = document.getElementById('accountStandingLabel');
  const standingSummary = document.getElementById('accountStandingSummary');
  const trustScore = document.getElementById('accountTrustScore');
  const trustMeter = document.getElementById('accountTrustMeter');
  const signalsList = document.getElementById('accountStandingSignals');

  if (standingLabel) {
    standingLabel.textContent = standing.label;
    standingLabel.dataset.standing = standing.standing;
  }

  if (standingSummary) {
    standingSummary.textContent = standing.reason || standing.summary;
  }

  if (trustScore) {
    trustScore.textContent = `${Math.round(standing.trustScore)}/100`;
  }

  if (trustMeter) {
    trustMeter.style.width = `${standing.trustScore}%`;
    trustMeter.dataset.standing = standing.standing;
  }

  if (signalsList) {
    const signals = standing.signals.length ? standing.signals : [standing.summary];
    signalsList.textContent = '';
    signals.forEach((signal) => {
      const item = document.createElement('li');
      item.textContent = signal;
      signalsList.appendChild(item);
    });
  }
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

  updateRadioGroupAccessibility(group);

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
  applyCurrentProfileStatus(state.customStatus || '', state.presenceStatus || 'online');
  setActivityStatusInputs(state.activityStatus || '');
  updateAccountStandingPanel(state);
  renderUserBadges('#settingsAccountBadges', state.profileBadges || [], { compact: true });
  renderUserBadges('#profilePreviewBadges', state.profileBadges || []);
  setProfileBadgePickerSelection(state.profileBadges || []);
  if (previewName) previewName.textContent = JWTusername;
  if (previewTag) {
    previewTag.textContent =
      '#' + Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  }
}

function updateProfileVisuals(
  profilePictureUrl,
  description,
  profileBannerUrl = null,
  profileBannerColor = '',
  customStatus = null,
  presenceStatus = null,
  profileBadges = null
) {
  const nextAvatarUrl = profilePictureUrl || homeDefaultAvatarUrl;
  const nextAvatarDisplayUrl = resolveMediaUrl(nextAvatarUrl) || homeDefaultAvatarUrl;
  const settingsState = readSettingsState();
  const nextBannerColor = profileBannerColor || settingsState.profileBannerColor || '#0c0c0c';
  const nextBannerUrl = profileBannerUrl === null ? settingsState.profileBannerUrl || '' : profileBannerUrl;
  const nextCustomStatus = customStatus === null ? settingsState.customStatus || '' : customStatus;
  const nextPresenceStatus = presenceStatus || settingsState.presenceStatus || 'online';
  const nextProfileBadges = profileBadges === null ? settingsState.profileBadges || [] : profileBadges;

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
      img.src = nextAvatarDisplayUrl;
    });

  const aboutMe = document.getElementById('popoutDescription');
  if (aboutMe) {
    aboutMe.textContent = description || 'No bio provided.';
  }

  applyCurrentProfileStatus(nextCustomStatus, nextPresenceStatus);
  renderUserBadges('#settingsAccountBadges', nextProfileBadges, { compact: true });
  renderUserBadges('#profilePreviewBadges', nextProfileBadges);

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

  updateProfileTabAccessibility(targetTab);
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
  slider.setAttribute('aria-valuenow', String(nextValue));

  if (slider.id === 'fontScalingSlider') {
    applyMessageFontSize(nextValue);
    slider.setAttribute('aria-valuetext', `${nextValue} pixels`);
  } else if (slider.id === 'zoomLevelSlider') {
    applyZoomLevel(nextValue);
    slider.setAttribute('aria-valuetext', `${nextValue} percent`);
  } else if (slider.id === 'saturationSlider') {
    applySaturationLevel(nextValue);
    slider.setAttribute('aria-valuetext', `${nextValue} percent`);
  } else if (settingKey === 'outputVolume' || slider.id === 'outputVolumeSlider') {
    applyOutputVolume(nextValue);
    slider.setAttribute('aria-valuetext', `${nextValue} percent`);
  } else {
    slider.setAttribute('aria-valuetext', String(nextValue));
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

function isReducedMotionSetting(settingKey) {
  return settingKey === 'reducedMotion' || settingKey.endsWith('-reduced-motion');
}

function getSystemThemeColors() {
  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? DEFAULT_THEME : LIGHT_THEME;
}

function syncThemeInputs(backgroundColor, textColor, accentColor = DEFAULT_THEME.accent) {
  const bgInput = document.getElementById('customBgColor');
  const textInput = document.getElementById('customTextColor');
  const accentInput = document.getElementById('customAccentColor');
  const bgHexInput = document.getElementById('customBgHex');
  const textHexInput = document.getElementById('customTextHex');
  const accentHexInput = document.getElementById('customAccentHex');
  const normalizedBackground = normalizeHexColor(backgroundColor, DEFAULT_THEME.background);
  const normalizedText = normalizeHexColor(textColor, DEFAULT_THEME.text);
  const normalizedAccent = normalizeHexColor(accentColor, DEFAULT_THEME.accent);

  if (bgInput) bgInput.value = normalizedBackground;
  if (textInput) textInput.value = normalizedText;
  if (accentInput) accentInput.value = normalizedAccent;
  if (bgHexInput) bgHexInput.value = normalizedBackground;
  if (textHexInput) textHexInput.value = normalizedText;
  if (accentHexInput) accentHexInput.value = normalizedAccent;
  updateCustomPresetSwatches(normalizedBackground, normalizedText, normalizedAccent);
  updateThemeEditorPreview(buildThemePalette(normalizedBackground, normalizedText, normalizedAccent));
}

function updateCustomPresetSwatches(backgroundColor, textColor, accentColor) {
  const swatches = {
    customPresetBg: backgroundColor,
    customPresetText: textColor,
    customPresetAccent: accentColor,
  };

  Object.entries(swatches).forEach(([id, color]) => {
    const swatch = document.getElementById(id);
    if (swatch) {
      swatch.style.background = color;
    }
  });
}

function updateThemeEditorPreview(theme) {
  const preview = document.getElementById('themePreview');
  if (!preview || !theme) return;

  preview.style.setProperty('--theme-preview-bg', theme.background);
  preview.style.setProperty('--theme-preview-sidebar', theme.secondBackground);
  preview.style.setProperty('--theme-preview-surface', theme.raisedSurface);
  preview.style.setProperty('--theme-preview-text', theme.mainText);
  preview.style.setProperty('--theme-preview-muted', theme.mutedText);
  preview.style.setProperty('--theme-preview-accent', theme.accent);
  preview.style.setProperty('--theme-preview-accent-text', theme.accentText);
  updateThemeContrastStatus(theme);
}

function updateThemeContrastStatus(theme) {
  const status = document.getElementById('themeContrastStatus');
  if (!status || !theme) return;

  const bodyContrast = getContrastRatio(theme.background, theme.mainText);
  const accentContrast = getContrastRatio(theme.accent, theme.accentText);
  const bodyLabel = bodyContrast >= 7 ? 'AAA' : bodyContrast >= 4.5 ? 'AA' : 'Low';
  const accentLabel = accentContrast >= 4.5 ? 'AA' : 'Low';
  const passes = bodyContrast >= 4.5 && accentContrast >= 4.5;

  status.dataset.variant = passes ? 'pass' : 'warn';
  status.textContent = `Text contrast ${bodyContrast.toFixed(1)}:1 (${bodyLabel}). Accent contrast ${accentContrast.toFixed(1)}:1 (${accentLabel}).`;
}

function getThemeFromInputs() {
  return {
    backgroundColor: normalizeHexColor(
      document.getElementById('customBgColor')?.value,
      DEFAULT_THEME.background
    ),
    textColor: normalizeHexColor(
      document.getElementById('customTextColor')?.value,
      DEFAULT_THEME.text
    ),
    accentColor: normalizeHexColor(
      document.getElementById('customAccentColor')?.value,
      DEFAULT_THEME.accent
    ),
  };
}

function setThemePresetSelection(presetKey = 'custom') {
  document.querySelectorAll('.theme-preset').forEach((button) => {
    const isSelected = button.dataset.themePreset === presetKey;
    button.classList.toggle('active', isSelected);
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });
}

function applyThemeEditorPreset(presetKey) {
  const preset = THEME_PRESETS[presetKey];
  if (!preset) {
    setThemePresetSelection('custom');
    return;
  }

  syncThemeInputs(preset.background, preset.text, preset.accent);
  applyTheme(preset.background, preset.text, preset.accent);
  setThemePresetSelection(presetKey);
}

function setupThemeEditor() {
  const fields = [
    ['customBgColor', 'customBgHex', DEFAULT_THEME.background],
    ['customTextColor', 'customTextHex', DEFAULT_THEME.text],
    ['customAccentColor', 'customAccentHex', DEFAULT_THEME.accent],
  ];

  const previewFromInputs = () => {
    const theme = getThemeFromInputs();
    syncThemeInputs(theme.backgroundColor, theme.textColor, theme.accentColor);
    applyTheme(theme.backgroundColor, theme.textColor, theme.accentColor);
    setThemePresetSelection('custom');
  };

  fields.forEach(([colorId, hexId, fallback]) => {
    const colorInput = document.getElementById(colorId);
    const hexInput = document.getElementById(hexId);
    if (colorInput && colorInput.dataset.themeInputReady !== 'true') {
      colorInput.dataset.themeInputReady = 'true';
      colorInput.addEventListener('input', () => {
        if (hexInput) hexInput.value = normalizeHexColor(colorInput.value, fallback);
        previewFromInputs();
      });
    }

    if (hexInput && hexInput.dataset.themeInputReady !== 'true') {
      hexInput.dataset.themeInputReady = 'true';
      hexInput.addEventListener('input', () => {
        const normalized = normalizeHexColor(hexInput.value, '');
        if (normalized && colorInput) {
          colorInput.value = normalized;
          previewFromInputs();
        }
      });
      hexInput.addEventListener('blur', () => {
        const normalized = normalizeHexColor(hexInput.value, fallback);
        hexInput.value = normalized;
        if (colorInput) colorInput.value = normalized;
        previewFromInputs();
      });
    }
  });

  document.querySelectorAll('.theme-preset').forEach((button) => {
    if (button.dataset.themePresetReady === 'true') return;
    button.dataset.themePresetReady = 'true';
    button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
    button.addEventListener('click', () => {
      const presetKey = button.dataset.themePreset || 'custom';
      if (presetKey === 'custom') {
        previewFromInputs();
      } else {
        applyThemeEditorPreset(presetKey);
      }
    });
  });
}

function applyThemeMode(themeMode, options = {}) {
  const { syncInputs = true } = options;
  const customTheme = normalizeCustomTheme(readSettingsState().customTheme);
  const presetTheme =
    themeMode === 'custom' && customTheme
      ? {
          background: customTheme.backgroundColor,
          text: customTheme.textColor,
          accent: customTheme.accentColor,
        }
      : themeMode === 'light'
        ? LIGHT_THEME
        : themeMode === 'sync-with-computer'
          ? getSystemThemeColors()
          : DEFAULT_THEME;

  if (syncInputs) {
    syncThemeInputs(presetTheme.background, presetTheme.text, presetTheme.accent);
  }

  applyTheme(presetTheme.background, presetTheme.text, presetTheme.accent);
  setThemePresetSelection(themeMode === 'custom' ? 'custom' : themeMode);
}

function syncThemeModeSelectionFromTheme(backgroundColor, textColor, accentColor = DEFAULT_THEME.accent) {
  const themeGroup = document.querySelector('[data-settings-radio="themeMode"]');
  if (!themeGroup) {
    return;
  }

  const normalizedBackground = normalizeHexColor(
    backgroundColor,
    DEFAULT_THEME.background
  );
  const normalizedText = normalizeHexColor(textColor, DEFAULT_THEME.text);
  const normalizedAccent = normalizeHexColor(accentColor, DEFAULT_THEME.accent);
  let nextThemeMode = readSettingsState().themeMode || 'dark';

  if (
    normalizedBackground === normalizeHexColor(DEFAULT_THEME.background) &&
    normalizedText === normalizeHexColor(DEFAULT_THEME.text) &&
    normalizedAccent === normalizeHexColor(DEFAULT_THEME.accent)
  ) {
    nextThemeMode = 'dark';
  } else if (
    normalizedBackground === normalizeHexColor(LIGHT_THEME.background) &&
    normalizedText === normalizeHexColor(LIGHT_THEME.text) &&
    normalizedAccent === normalizeHexColor(LIGHT_THEME.accent)
  ) {
    nextThemeMode = 'light';
  } else {
    nextThemeMode = 'custom';
  }

  setRadioGroupSelection(themeGroup, nextThemeMode);
  setThemePresetSelection(nextThemeMode === 'custom' ? 'custom' : nextThemeMode);
}

function handleToggleStateChange(settingKey, isActive) {
  writeSettingsState((state) => ({
    ...state,
    toggles: {
      ...state.toggles,
      [settingKey]: isActive,
    },
  }));

  if (isReducedMotionSetting(settingKey)) {
    applyReducedMotion(isActive);
  }

  const dataControlKey = getDataPrivacyControlKey(settingKey);
  if (dataControlKey) {
    writeSettingsState((state) => ({
      ...state,
      dataControls: {
        ...normalizeDataControls(state.dataControls),
        [dataControlKey]: isActive,
      },
    }));
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

  if (settingKey === 'language') {
    const language = normalizeAppLanguage(select.value);
    writeSettingsState((state) => ({
      ...state,
      language,
      selects: {
        ...state.selects,
        [settingKey]: language,
      },
    }));
    applyLocalization(language);
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
      if (value !== 'custom') {
        nextState.customTheme = null;
      }
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
  const normalizedPresence = normalizePresenceStatus(presenceStatus);
  writeSettingsState((state) => ({
    ...state,
    presenceStatus: normalizedPresence,
  }));
  applyCurrentProfileStatus(readSettingsState().customStatus || '', normalizedPresence);

  axios
    .post(`${homeApiBase}/api/Account/UpdatePresence`, { presenceStatus: normalizedPresence })
    .then((response) => {
      if (response.data) {
        applyAccountSettingsResponse(response.data);
      }
    })
    .catch((error) => {
      showAppMessage(getApiErrorMessage(error, 'Could not update status.'), 'error');
    });
}

async function syncCustomStatus(customStatus, { silent = false } = {}) {
  const normalizedCustomStatus = normalizeCustomStatus(customStatus);
  const previousState = readSettingsState();
  writeSettingsState((state) => ({
    ...state,
    customStatus: normalizedCustomStatus,
  }));
  applyCurrentProfileStatus(normalizedCustomStatus, previousState.presenceStatus || 'online');

  try {
    const response = await axios.post(`${homeApiBase}/api/Account/UpdateCustomStatus`, {
      customStatus: normalizedCustomStatus,
    });
    if (response.data) {
      applyAccountSettingsResponse(response.data);
    }
    if (!silent) {
      showAppMessage(normalizedCustomStatus ? 'Custom status updated.' : 'Custom status cleared.', 'success');
    }
    return normalizedCustomStatus;
  } catch (error) {
    writeSettingsState(previousState);
    applyCurrentProfileStatus(previousState.customStatus || '', previousState.presenceStatus || 'online');
    showAppMessage(getApiErrorMessage(error, 'Could not update custom status.'), 'error');
    throw error;
  }
}

async function saveCustomStatusFromInputs() {
  const sourceInput =
    document.activeElement?.matches?.('#customStatusInput, #profileCustomStatusInput')
      ? document.activeElement
      : document.getElementById('customStatusInput') || document.getElementById('profileCustomStatusInput');
  await syncCustomStatus(sourceInput?.value || '');
}

async function clearCustomStatus() {
  setCustomStatusInputs('');
  await syncCustomStatus('');
}

async function syncActivityStatus(activityStatus, { silent = false } = {}) {
  const normalizedActivityStatus = normalizeActivityStatus(activityStatus);
  const previousState = readSettingsState();
  writeSettingsState((state) => ({
    ...state,
    activityStatus: normalizedActivityStatus,
  }));
  setActivityStatusInputs(normalizedActivityStatus);

  try {
    const response = await axios.post(`${homeApiBase}/api/Account/UpdateActivityStatus`, {
      activityStatus: normalizedActivityStatus,
    });
    if (response.data) {
      applyAccountSettingsResponse(response.data);
    }
    if (!silent) {
      showAppMessage(normalizedActivityStatus ? 'Activity updated.' : 'Activity cleared.', 'success');
    }
    return normalizedActivityStatus;
  } catch (error) {
    writeSettingsState(previousState);
    setActivityStatusInputs(previousState.activityStatus || '');
    showAppMessage(getApiErrorMessage(error, 'Could not update activity.'), 'error');
    throw error;
  }
}

async function saveActivityStatusFromInput() {
  await syncActivityStatus(document.getElementById('activityStatusInput')?.value || '');
}

async function clearActivityStatus() {
  setActivityStatusInputs('');
  await syncActivityStatus('');
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
  const customTheme = normalizeCustomTheme(state.customTheme);
  const messageDisplay = state.messageDisplay || 'cozy';
  const fontSize = normalizeSettingsNumber(state.fontSize, 16, 12, 24);
  const zoomLevel = normalizeSettingsNumber(state.zoomLevel, 100, 50, 150);
  const saturation = normalizeSettingsNumber(state.saturation, 100, 0, 100);
  const language = normalizeAppLanguage(state.language);
  const dataControls = normalizeDataControls(state.dataControls);

  if (themeMode === 'custom' && customTheme) {
    syncThemeInputs(customTheme.backgroundColor, customTheme.textColor, customTheme.accentColor);
    applyTheme(customTheme.backgroundColor, customTheme.textColor, customTheme.accentColor);
    setThemePresetSelection('custom');
  } else {
    applyThemeMode(themeMode);
  }
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
        : settingKey === 'language'
          ? language
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
        : getDataPrivacyControlKey(settingKey)
          ? dataControls[getDataPrivacyControlKey(settingKey)]
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
    updateToggleAccessibility(item);

    if (isReducedMotionSetting(settingKey)) {
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
    updateCheckboxAccessibility(item);
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
  applyLocalization(language);
}

function getDefaultSettingsKeybinds() {
  return [
    { action: 'Push to Talk (Normal)', keys: ['CTRL', 'V'] },
    { action: 'Toggle Mute', keys: ['CTRL', 'SHIFT', 'M'] },
    { action: 'Toggle Deafen', keys: ['CTRL', 'SHIFT', 'D'] },
    { action: 'Open Settings', keys: ['CTRL', ','] },
    { action: 'Find Conversation', keys: ['CTRL', 'K'] },
    { action: 'Search Messages', keys: ['CTRL', 'F'] },
    { action: 'Add Friend', keys: ['CTRL', 'SHIFT', 'A'] },
    { action: 'Create Server', keys: ['CTRL', 'SHIFT', 'N'] },
  ];
}

function getShortcutEventKeys(event) {
  const keys = new Set();
  if (event.ctrlKey) keys.add('CTRL');
  if (event.metaKey) keys.add('META');
  if (event.altKey) keys.add('ALT');
  if (event.shiftKey) keys.add('SHIFT');

  const primaryKey = normalizeShortcutKey(event);
  if (primaryKey && !['CTRL', 'CONTROL', 'SHIFT', 'ALT', 'META'].includes(primaryKey)) {
    keys.add(primaryKey);
  }

  return keys;
}

function normalizeShortcutKeys(keys = []) {
  return keys
    .map((key) => String(key || '').trim().toUpperCase())
    .map((key) => (key === 'CONTROL' ? 'CTRL' : key))
    .filter(Boolean);
}

function shortcutMatchesEvent(keys, event) {
  const shortcutKeys = normalizeShortcutKeys(keys);
  const eventKeys = getShortcutEventKeys(event);
  if (shortcutKeys.length !== eventKeys.size) {
    return false;
  }

  return shortcutKeys.every((key) => eventKeys.has(key));
}

function getConfiguredKeybinds() {
  return readSettingsState().keybinds || getDefaultSettingsKeybinds();
}

function isEditableShortcutTarget(target) {
  return Boolean(
    target?.closest?.('input, textarea, select, [contenteditable="true"]')
  );
}

function focusConversationSearch() {
  const input = document.querySelector('.secondColumn .textInput');
  if (!input) return;
  showElement('.secondColumn', 'flex');
  input.focus();
  input.select?.();
}

function focusActiveMessageSearch() {
  const activeSearchInput =
    isElementVisible('#serverDetails')
      ? document.getElementById('serverSearchInput')
      : document.getElementById('dmSearchInput');

  if (activeSearchInput) {
    activeSearchInput.focus();
    activeSearchInput.select?.();
    return;
  }

  focusConversationSearch();
}

function executeKeyboardShortcut(action) {
  const normalizedAction = String(action || '').trim().toLowerCase();

  if (normalizedAction.includes('push to talk')) return false;
  if (normalizedAction === 'toggle mute') {
    Mute();
    return true;
  }
  if (normalizedAction === 'toggle deafen') {
    Deafen();
    return true;
  }
  if (normalizedAction === 'open settings') {
    openSettingsModal();
    return true;
  }
  if (normalizedAction === 'find conversation') {
    focusConversationSearch();
    return true;
  }
  if (normalizedAction === 'search messages') {
    focusActiveMessageSearch();
    return true;
  }
  if (normalizedAction === 'add friend') {
    showElement('.secondColumn', 'flex');
    showElement('.lastSection', 'flex');
    hideElement('#serverDetails');
    showAddFriends();
    document.querySelector('.friendsInput')?.focus();
    return true;
  }
  if (normalizedAction === 'create server') {
    openModal();
    return true;
  }

  return false;
}

function closeTopmostOverlay() {
  const closers = [
    { selector: '#settingsModal', close: closeSettingsModal },
    { selector: '#messageForwardDialog', close: closeForwardDialog },
    { selector: '#createDMModal', close: closeCreateDMModal },
    { selector: '.outerJoinModal', close: closeJoinModal },
    { selector: '.outerSecondModal', close: closeSecondModal },
    { selector: '.outerCreationModal', close: CloseCreationModal },
    { selector: '.outerModal', close: closeModal },
    { selector: '#searchResultsSidebar', close: closeSearchResults },
  ];

  const active = closers.find(({ selector }) => isElementVisible(selector));
  if (!active) return false;
  active.close();
  return true;
}

function handleGlobalKeyboardShortcuts(event) {
  if (event.defaultPrevented) return;

  if (event.key === 'Escape' && closeTopmostOverlay()) {
    event.preventDefault();
    return;
  }

  if (event.repeat) return;

  const isCommandShortcut = event.ctrlKey || event.metaKey || event.altKey;
  if (!isCommandShortcut && isEditableShortcutTarget(event.target)) {
    return;
  }

  const matchedKeybind = getConfiguredKeybinds().find((keybind) =>
    shortcutMatchesEvent(keybind.keys, event) && executeKeyboardShortcut(keybind.action)
  );

  if (matchedKeybind) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function setupConversationSearch() {
  const input = document.querySelector('.secondColumn .textInput');
  if (!input || input.dataset.conversationSearchReady === 'true') {
    return;
  }

  input.dataset.conversationSearchReady = 'true';
  input.addEventListener('input', applyConversationSearchFilter);
}

function applyConversationSearchFilter() {
  const input = document.querySelector('.secondColumn .textInput');
  if (!input) return;

  const query = input.value.trim().toLowerCase();
  const conversations = Array.from(document.querySelectorAll('.conversation-list-item'));
  let visibleCount = 0;

  if (conversations.length === 0) {
    mainFriendsDiv?.querySelector('[data-empty-state-kind="conversation-search"]')?.remove();
    return;
  }

  conversations.forEach((item) => {
    const isMatch = !query || item.textContent.toLowerCase().includes(query);
    item.classList.toggle('is-filtered-out', !isMatch);
    if (isMatch) visibleCount += 1;
  });

  const empty = mainFriendsDiv?.querySelector('[data-empty-state-kind="conversation-search"]');
  if (empty) empty.remove();

  if (query && mainFriendsDiv && visibleCount === 0) {
    mainFriendsDiv.appendChild(createEmptyState({
      icon: 'SRCH',
      title: 'No conversations found',
      description: 'Try a different name, group, or server.',
      compact: true,
      className: 'conversation-empty-state',
      kind: 'conversation-search',
    }));
  }
}

document.addEventListener('keydown', handleGlobalKeyboardShortcuts);

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

async function askConfirm(
  title,
  description,
  { danger = false, confirmText = 'Confirm', preserveExisting = false } = {}
) {
  const result = await openSimpleFormDialog({
    title,
    description,
    fields: [],
    danger,
    confirmText,
    preserveExisting,
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

async function fetchAccountDeletionPreview() {
  const response = await axios.get(`${homeApiBase}/api/Account/GetAccountDeletionPreview`);
  return response.data || {};
}

function createAccountDeletionSummary(preview = {}) {
  const summary = preview.summary || {};
  const items = [
    ['Direct messages', summary.directMessageCount],
    ['Group chats', summary.groupChatCount],
    ['Group messages', summary.groupMessageCount],
    ['Server memberships', summary.serverMembershipCount],
    ['Owned servers', summary.ownedServerCount],
    ['Server messages', summary.authoredServerMessageCount],
    ['Thread messages', summary.authoredThreadMessageCount],
    ['Reports', summary.reportCount],
    ['Active sessions', summary.activeSessionCount],
    ['Owned apps', summary.ownedOAuthApplicationCount],
    ['Authorized apps', summary.authorizedApplicationCount],
  ];

  const grid = document.createElement('div');
  grid.className = 'account-deletion-summary';

  items.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'account-deletion-summary-item';

    const valueEl = document.createElement('strong');
    valueEl.textContent = String(value ?? 0);
    const labelEl = document.createElement('span');
    labelEl.textContent = label;

    item.appendChild(valueEl);
    item.appendChild(labelEl);
    grid.appendChild(item);
  });

  return grid;
}

async function openDeleteAccountDialog() {
  closeAccountActionDialog();

  let preview = null;
  try {
    preview = await fetchAccountDeletionPreview();
  } catch (error) {
    console.warn('Could not load deletion preview:', error);
    showAppMessage(getApiErrorMessage(error, 'Could not load deletion preview. Showing the required warnings.'), 'error');
    preview = {
      confirmationText: JWTusername,
      warnings: [
        'Account deletion is permanent after you confirm it.',
        'Download your data export first if you need a copy of your account data.',
        'Friends, sessions, app authorizations, and account settings will be removed.',
      ],
      summary: {},
    };
  }

  const expectedUsername = String(preview.confirmationText || JWTusername || '').trim();
  const overlay = document.createElement('div');
  overlay.className = 'account-action-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'account-action-dialog account-deletion-dialog';

  const heading = document.createElement('h3');
  heading.textContent = 'Delete Account';

  const copy = document.createElement('p');
  copy.className = 'account-action-copy';
  copy.textContent = 'Review what will happen, download an export if you need it, then confirm with your username and password.';

  const warningPanel = document.createElement('div');
  warningPanel.className = 'account-deletion-warning';
  const warningTitle = document.createElement('div');
  warningTitle.className = 'account-deletion-warning-title';
  warningTitle.textContent = 'Before you continue';
  const warningList = document.createElement('ul');
  (Array.isArray(preview.warnings) ? preview.warnings : []).forEach((warning) => {
    const item = document.createElement('li');
    item.textContent = warning;
    warningList.appendChild(item);
  });
  warningPanel.appendChild(warningTitle);
  warningPanel.appendChild(warningList);

  const exportPanel = document.createElement('div');
  exportPanel.className = 'account-deletion-export';
  const exportCopy = document.createElement('p');
  exportCopy.textContent = 'Your export includes account profile, settings, sessions, relationships, conversations, reports, and app authorizations.';
  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.className = 'account-action-cancel account-deletion-export-btn';
  exportButton.textContent = 'Download Data Export';
  const exportStatus = document.createElement('span');
  exportStatus.className = 'account-deletion-export-status';
  exportStatus.textContent = 'No export downloaded in this flow.';
  exportPanel.appendChild(exportCopy);
  exportPanel.appendChild(exportButton);
  exportPanel.appendChild(exportStatus);

  const form = document.createElement('form');
  form.className = 'account-action-form';

  const acknowledgeLabel = document.createElement('label');
  acknowledgeLabel.className = 'account-deletion-ack';
  const acknowledgeInput = document.createElement('input');
  acknowledgeInput.type = 'checkbox';
  acknowledgeInput.required = true;
  const acknowledgeText = document.createElement('span');
  acknowledgeText.textContent = 'I have downloaded my data or I do not need an export, and I understand this deletion cannot be undone.';
  acknowledgeLabel.appendChild(acknowledgeInput);
  acknowledgeLabel.appendChild(acknowledgeText);

  const usernameLabel = document.createElement('label');
  usernameLabel.textContent = `Type ${expectedUsername} to confirm`;
  const usernameInput = document.createElement('input');
  usernameInput.type = 'text';
  usernameInput.name = 'confirmationUsername';
  usernameInput.autocomplete = 'username';
  usernameInput.required = true;
  usernameLabel.appendChild(usernameInput);

  const passwordLabel = document.createElement('label');
  passwordLabel.textContent = 'Password';
  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.name = 'password';
  passwordInput.autocomplete = 'current-password';
  passwordInput.minLength = 6;
  passwordInput.required = true;
  passwordLabel.appendChild(passwordInput);

  const error = document.createElement('p');
  error.className = 'account-action-error';
  error.setAttribute('role', 'alert');

  const actions = document.createElement('div');
  actions.className = 'account-action-buttons';
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'account-action-cancel';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', closeAccountActionDialog);

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'account-action-submit danger';
  submitButton.textContent = 'Delete Account';

  const updateSubmitState = () => {
    submitButton.disabled = !(
      acknowledgeInput.checked &&
      usernameInput.value.trim() === expectedUsername &&
      passwordInput.value.length >= 6
    );
  };

  acknowledgeInput.addEventListener('change', updateSubmitState);
  usernameInput.addEventListener('input', updateSubmitState);
  passwordInput.addEventListener('input', updateSubmitState);
  updateSubmitState();

  exportButton.addEventListener('click', async () => {
    const downloaded = await downloadUserDataExport(exportButton);
    if (downloaded) {
      exportStatus.textContent = 'Export downloaded for this deletion review.';
      acknowledgeInput.checked = true;
      updateSubmitState();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';

    if (usernameInput.value.trim() !== expectedUsername) {
      error.textContent = 'The confirmation username does not match.';
      updateSubmitState();
      return;
    }

    try {
      setBusyState(submitButton, true, 'Deleting...');
      const res = await axios.post(`${homeApiBase}/api/Account/DeleteAccount`, {
        username: JWTusername,
        confirmationUsername: usernameInput.value.trim(),
        password: passwordInput.value,
        acknowledgedWarnings: acknowledgeInput.checked,
      });
      showAppMessage(res.data?.message || 'Account deleted.', 'success');
      closeAccountActionDialog();
      window.setTimeout(LogOut, 900);
    } catch (err) {
      console.error('Delete Account failed:', err);
      error.textContent = getApiErrorMessage(err, 'Could not delete account.');
    } finally {
      setBusyState(submitButton, false);
      updateSubmitState();
    }
  });

  actions.appendChild(cancelButton);
  actions.appendChild(submitButton);
  form.appendChild(acknowledgeLabel);
  form.appendChild(usernameLabel);
  form.appendChild(passwordLabel);
  form.appendChild(error);
  form.appendChild(actions);

  dialog.appendChild(heading);
  dialog.appendChild(copy);
  dialog.appendChild(warningPanel);
  dialog.appendChild(createAccountDeletionSummary(preview));
  dialog.appendChild(exportPanel);
  dialog.appendChild(form);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeAccountActionDialog();
    }
  });

  usernameInput.focus();
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

function getFilenameFromContentDisposition(value = '') {
  const match = String(value).match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  if (!match) {
    return '';
  }

  try {
    return decodeURIComponent(match[1].replace(/"$/g, '').trim());
  } catch {
    return match[1].replace(/"$/g, '').trim();
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function downloadUserDataExport(button = document.getElementById('downloadDataExportBtn')) {
  if (button && typeof button === 'object' && 'currentTarget' in button) {
    button = button.currentTarget;
  }

  try {
    setBusyState(button, true, 'Preparing...');
    const response = await axios.get(`${homeApiBase}/api/Account/ExportUserData`, {
      responseType: 'blob',
    });
    const filename =
      getFilenameFromContentDisposition(response.headers?.['content-disposition']) ||
      `${JWTusername || 'mydiscord'}-data-export.json`;
    downloadBlob(response.data, filename);
    showAppMessage('Data export downloaded.', 'success');
    return true;
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not download data export.'), 'error');
    return false;
  } finally {
    setBusyState(button, false);
  }
}

async function fetchUserDataExportJson() {
  const response = await axios.get(`${homeApiBase}/api/Account/ExportUserData`, {
    responseType: 'json',
  });
  return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
}

function buildDataExportSummaryText(exportData = {}) {
  const summary = exportData.summary || {};
  const account = exportData.account || {};
  return [
    `MyDiscord data export for ${account.username || JWTusername || 'user'}`,
    `Exported at: ${exportData.exportedAt || new Date().toISOString()}`,
    `Direct messages: ${summary.directMessageCount ?? 0}`,
    `Group chats: ${summary.groupChatCount ?? 0}`,
    `Group messages: ${summary.groupMessageCount ?? 0}`,
    `Server memberships: ${summary.serverMembershipCount ?? 0}`,
    `Owned servers: ${summary.ownedServerCount ?? 0}`,
    `Authored server messages: ${summary.authoredServerMessageCount ?? 0}`,
    `Reports: ${summary.reportCount ?? 0}`,
    `Authorized apps: ${summary.authorizedApplicationCount ?? 0}`,
  ].join('\n');
}

async function copyUserDataExportSummary() {
  const button = document.getElementById('copyDataExportSummaryBtn');
  try {
    setBusyState(button, true, 'Copying...');
    const exportData = await fetchUserDataExportJson();
    const summaryText = buildDataExportSummaryText(exportData);
    if (!navigator.clipboard) {
      throw new Error('Clipboard access is unavailable.');
    }

    await navigator.clipboard.writeText(summaryText);
    showAppMessage('Export summary copied.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not copy data export summary.'), 'error');
  } finally {
    setBusyState(button, false);
  }
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cloneJsonValue(value) {
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

function pickPlainObject(value, fallback = {}) {
  return isPlainObject(value) ? cloneJsonValue(value) || fallback : fallback;
}

function normalizeImportedKeybinds(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((keybind) => ({
      action: String(keybind?.action || '').trim(),
      keys: normalizeShortcutKeys(Array.isArray(keybind?.keys) ? keybind.keys : []),
    }))
    .filter((keybind) => keybind.action && keybind.keys.length);
}

function normalizeImportedAppSettings(source = {}) {
  if (!isPlainObject(source)) {
    throw new Error('Settings import must contain a JSON object.');
  }

  const fallback = createDefaultSettingsState();
  const imported = {};
  const themeModes = new Set(['dark', 'light', 'sync-with-computer', 'custom']);
  const messageDisplays = new Set(['cozy', 'compact']);
  const inputModes = new Set(['voice-activity', 'push-to-talk']);

  if (typeof source.profileView === 'string') imported.profileView = source.profileView;
  if (themeModes.has(source.themeMode)) imported.themeMode = source.themeMode;
  if (source.customTheme !== undefined) {
    imported.customTheme = normalizeCustomTheme(source.customTheme, null);
  }
  if (messageDisplays.has(source.messageDisplay)) imported.messageDisplay = source.messageDisplay;
  if (inputModes.has(source.inputMode)) imported.inputMode = source.inputMode;
  if (source.fontSize !== undefined) {
    imported.fontSize = normalizeSettingsNumber(source.fontSize, fallback.fontSize, 12, 24);
  }
  if (source.zoomLevel !== undefined) {
    imported.zoomLevel = normalizeSettingsNumber(source.zoomLevel, fallback.zoomLevel, 50, 150);
  }
  if (source.saturation !== undefined) {
    imported.saturation = normalizeSettingsNumber(source.saturation, fallback.saturation, 0, 100);
  }

  ['toggles', 'checkboxes', 'radios', 'sliders', 'selects', 'connectedAccounts', 'removedItems']
    .forEach((key) => {
      if (isPlainObject(source[key])) {
        imported[key] = pickPlainObject(source[key], {});
      }
    });

  const keybinds = normalizeImportedKeybinds(source.keybinds);
  if (keybinds) {
    imported.keybinds = keybinds;
  }

  if (isPlainObject(source.voiceChanger)) {
    imported.voiceChanger = {
      ...fallback.voiceChanger,
      ...pickPlainObject(source.voiceChanger, {}),
    };
  }

  if (source.language !== undefined) {
    imported.language = normalizeAppLanguage(source.language);
  } else if (source.selects?.language) {
    imported.language = normalizeAppLanguage(source.selects.language);
  }

  if (isPlainObject(source.dataControls)) {
    imported.dataControls = normalizeDataControls(source.dataControls);
  }

  return imported;
}

function getAppSettingsSourceFromImportPayload(payload = {}) {
  if (!isPlainObject(payload)) {
    throw new Error('Import file must be a JSON object.');
  }

  if (payload.exportType === 'mydiscord-app-settings' && isPlainObject(payload.settings)) {
    return {
      ...payload.settings,
      voiceChanger: payload.voiceChangerSettings || payload.settings.voiceChanger,
    };
  }

  if (isPlainObject(payload.account?.settings)) {
    return {
      ...payload.account.settings,
      voiceChanger: payload.account.voiceChangerSettings || payload.account.settings.voiceChanger,
    };
  }

  if (isPlainObject(payload.settings)) {
    return payload.settings;
  }

  return payload;
}

function syncDataControlToggles(state) {
  const dataControls = normalizeDataControls(state.dataControls);
  const toggles = { ...(state.toggles || {}) };
  Object.entries(DATA_PRIVACY_CONTROL_KEYS).forEach(([settingKey, dataControlKey]) => {
    toggles[settingKey] = Boolean(dataControls[dataControlKey]);
  });
  return { ...state, dataControls, toggles };
}

function getServerManagedSettingsSlice(state) {
  return {
    contact: state.contact,
    verification: state.verification,
    twoFactor: state.twoFactor,
    privacy: state.privacy,
    accountStanding: state.accountStanding,
    blockedUsers: state.blockedUsers,
    presenceStatus: state.presenceStatus,
    customStatus: state.customStatus,
    activityStatus: state.activityStatus,
    profileBannerColor: state.profileBannerColor,
    profileBannerUrl: state.profileBannerUrl,
    profileBadges: state.profileBadges,
  };
}

function applyImportedAppSettings(importedSettings) {
  const currentState = readSettingsState();
  const nextState = syncDataControlToggles({
    ...currentState,
    ...importedSettings,
    ...getServerManagedSettingsSlice(currentState),
  });

  writeSettingsState(nextState);
  applyPersistedSettingsState();
  renderSettingsKeybinds();
  applyRemovedSettingsItems();
  updateSettingsIdentityFields();
  return nextState;
}

function buildPortableAppSettings(state = readSettingsState()) {
  const portable = {};
  PORTABLE_APP_SETTINGS_KEYS.forEach((key) => {
    const value = cloneJsonValue(state[key]);
    if (value !== undefined) {
      portable[key] = value;
    }
  });

  portable.language = normalizeAppLanguage(portable.language);
  portable.dataControls = normalizeDataControls(portable.dataControls);
  portable.toggles = syncDataControlToggles(portable).toggles;
  return portable;
}

function setAppSettingsBackupStatus(message) {
  const status = document.getElementById('appSettingsBackupStatus');
  if (status) {
    status.textContent = message;
  }
}

function exportAppSettings() {
  const payload = {
    exportType: 'mydiscord-app-settings',
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    application: 'MyDiscord',
    settings: buildPortableAppSettings(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const safeUsername = String(JWTusername || 'mydiscord').replace(/[^A-Za-z0-9_.-]/g, '_');
  downloadBlob(blob, `${safeUsername}-app-settings-${Date.now()}.json`);
  setAppSettingsBackupStatus('Settings exported.');
  showAppMessage('App settings exported.', 'success');
}

async function importAppSettingsFromFile(file) {
  if (!file) {
    return;
  }

  const text = await file.text();
  const payload = JSON.parse(text);
  const importedSettings = normalizeImportedAppSettings(
    getAppSettingsSourceFromImportPayload(payload)
  );
  applyImportedAppSettings(importedSettings);
  setAppSettingsBackupStatus('Settings imported.');
  showAppMessage('App settings imported.', 'success');
}

async function resetAppSettings() {
  if (!await askConfirm(
    'Reset App Settings',
    'Reset local appearance, accessibility, voice, notification, keybind, language, and privacy-control preferences?',
    { danger: true, confirmText: 'Reset' }
  )) {
    return;
  }

  const currentState = readSettingsState();
  const nextState = syncDataControlToggles({
    ...createDefaultSettingsState(),
    ...getServerManagedSettingsSlice(currentState),
  });
  writeSettingsState(nextState);
  applyPersistedSettingsState();
  renderSettingsKeybinds();
  applyRemovedSettingsItems();
  updateSettingsIdentityFields();
  setAppSettingsBackupStatus('Settings reset.');
  showAppMessage('App settings reset.', 'success');
}

function clearLocalPrivacyCaches() {
  profileSummaryCache.clear();
  mediaUrlCache.clear();
  peerVolumeLevels.clear();
  Object.values(renderedMessageCache).forEach((cache) => cache.clear?.());

  try {
    const keysToRemove = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (
        key === PEER_VOLUME_STORAGE_KEY ||
        key === 'discordClone_turnServers' ||
        key?.startsWith('mydiscord.serverWelcome.')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Could not clear local privacy data:', error);
  }
}

async function clearLocalPrivacyData() {
  if (!await askConfirm(
    'Clear Local Data',
    'Clear local search, onboarding, peer volume, TURN server, profile, and media caches on this device?',
    { danger: true, confirmText: 'Clear' }
  )) {
    return;
  }

  clearLocalPrivacyCaches();
  showAppMessage('Local privacy data cleared.', 'success');
}

function formatAppUpdatePhase(phase = '') {
  const labels = {
    disabled: 'Disabled',
    idle: 'Ready',
    checking: 'Checking',
    available: 'Available',
    downloading: 'Downloading',
    downloaded: 'Ready',
    'up-to-date': 'Up to date',
    error: 'Error',
  };
  return labels[phase] || 'Unknown';
}

function updateAppUpdateControls(status = {}) {
  const version = document.getElementById('appUpdateVersion');
  const phase = document.getElementById('appUpdatePhase');
  const statusText = document.getElementById('appUpdateStatusText');
  const checkButton = document.getElementById('checkForUpdatesBtn');
  const downloadButton = document.getElementById('downloadUpdateBtn');
  const installButton = document.getElementById('installUpdateBtn');
  const progress = document.getElementById('appUpdateProgress');
  const progressBar = document.getElementById('appUpdateProgressBar');
  const progressPercent = Math.round(status.progress?.percent || 0);

  if (version) {
    version.textContent = status.currentVersion || 'Unknown';
  }

  if (phase) {
    phase.textContent = formatAppUpdatePhase(status.phase);
    phase.dataset.phase = status.phase || 'disabled';
  }

  if (statusText) {
    statusText.textContent = status.message || 'Update status unavailable.';
  }

  if (checkButton) {
    checkButton.disabled = !status.canCheck;
  }

  if (downloadButton) {
    downloadButton.disabled = !status.canDownload;
  }

  if (installButton) {
    installButton.disabled = !status.canInstall;
  }

  if (progress) {
    const isVisible = status.phase === 'downloading';
    progress.classList.toggle('is-visible', isVisible);
    progress.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
  }

  if (progressBar) {
    progressBar.style.width = `${progressPercent}%`;
  }
}

async function refreshAppUpdateStatus() {
  const bridge = getAppUpdateBridge();
  if (!bridge?.getStatus) {
    updateAppUpdateControls({
      phase: 'disabled',
      message: 'Desktop update integration unavailable.',
      currentVersion: 'Unknown',
    });
    return null;
  }

  try {
    const status = await bridge.getStatus();
    updateAppUpdateControls(status);
    return status;
  } catch (error) {
    updateAppUpdateControls({
      phase: 'error',
      message: getApiErrorMessage(error, 'Could not read update status.'),
      currentVersion: 'Unknown',
    });
    return null;
  }
}

async function checkForDesktopUpdates() {
  const bridge = getAppUpdateBridge();
  const button = document.getElementById('checkForUpdatesBtn');
  if (!bridge?.checkForUpdates) {
    showAppMessage('Desktop update integration unavailable.', 'error');
    return;
  }

  setBusyState(button, true, 'Checking...');
  try {
    const status = await bridge.checkForUpdates();
    updateAppUpdateControls(status);
    if (status.phase === 'up-to-date') {
      showAppMessage('MyDiscord is up to date.', 'success');
    } else if (status.phase === 'available') {
      showAppMessage(status.message || 'An update is available.', 'success');
    } else if (status.phase === 'disabled' || status.phase === 'error') {
      showAppMessage(status.message || 'Update check failed.', 'error');
    }
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not check for updates.'), 'error');
  } finally {
    setBusyState(button, false);
    refreshAppUpdateStatus();
  }
}

async function downloadDesktopUpdate() {
  const bridge = getAppUpdateBridge();
  const button = document.getElementById('downloadUpdateBtn');
  if (!bridge?.downloadUpdate) {
    showAppMessage('Desktop update integration unavailable.', 'error');
    return;
  }

  setBusyState(button, true, 'Starting...');
  try {
    const status = await bridge.downloadUpdate();
    updateAppUpdateControls(status);
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not download update.'), 'error');
  } finally {
    setBusyState(button, false);
    refreshAppUpdateStatus();
  }
}

async function installDesktopUpdate() {
  const bridge = getAppUpdateBridge();
  if (!bridge?.installUpdate) {
    showAppMessage('Desktop update integration unavailable.', 'error');
    return;
  }

  try {
    const status = await bridge.installUpdate();
    updateAppUpdateControls(status);
    if (!status.installStarted) {
      showAppMessage(status.message || 'Update is not ready to install.', 'error');
    }
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not install update.'), 'error');
  }
}

function setupAppUpdateControls() {
  const bridge = getAppUpdateBridge();
  document.getElementById('checkForUpdatesBtn')?.addEventListener('click', checkForDesktopUpdates);
  document.getElementById('downloadUpdateBtn')?.addEventListener('click', downloadDesktopUpdate);
  document.getElementById('installUpdateBtn')?.addEventListener('click', installDesktopUpdate);

  if (bridge?.onStatus && !setupAppUpdateControls.unsubscribe) {
    setupAppUpdateControls.unsubscribe = bridge.onStatus(updateAppUpdateControls);
  }

  refreshAppUpdateStatus();
}

function formatDiagnosticsLastReport(lastReport) {
  if (!lastReport) {
    return 'No renderer error reports recorded this session.';
  }

  if (lastReport.submitted) {
    return `Last report sent: ${lastReport.type || 'error'} at ${lastReport.timestamp || 'unknown time'}.`;
  }

  if (lastReport.uploadError) {
    return `Last report saved locally. Upload failed: ${lastReport.uploadError}`;
  }

  return `Last report saved locally: ${lastReport.type || 'error'} at ${lastReport.timestamp || 'unknown time'}.`;
}

function updateDiagnosticsControls(status = {}) {
  const crashStatus = document.getElementById('crashReporterStatus');
  const errorStatus = document.getElementById('errorReporterStatus');
  const message = document.getElementById('diagnosticsStatusText');
  const crash = status.crashReporter || {};
  const errors = status.errorReporting || {};

  if (crashStatus) {
    crashStatus.textContent = crash.started
      ? crash.uploadToServer
        ? 'Remote'
        : 'Local'
      : 'Unavailable';
  }

  if (errorStatus) {
    errorStatus.textContent = errors.remoteConfigured ? 'Remote' : 'Local';
  }

  if (message) {
    const pathText = errors.diagnosticFilePath ? ` Logs: ${errors.diagnosticFilePath}` : '';
    message.textContent = `${formatDiagnosticsLastReport(errors.lastReport)}${pathText}`;
  }
}

async function refreshDesktopDiagnostics() {
  const bridge = getAppDiagnosticsBridge();
  const button = document.getElementById('refreshDiagnosticsBtn');
  if (!bridge?.getStatus) {
    updateDiagnosticsControls({
      crashReporter: { started: false },
      errorReporting: { remoteConfigured: false },
    });
    return;
  }

  setBusyState(button, true, 'Refreshing...');
  try {
    updateDiagnosticsControls(await bridge.getStatus());
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not load diagnostics status.'), 'error');
  } finally {
    setBusyState(button, false);
  }
}

async function sendDesktopTestErrorReport() {
  const bridge = getAppDiagnosticsBridge();
  const button = document.getElementById('sendTestErrorReportBtn');
  if (!bridge?.sendTestReport) {
    showAppMessage('Desktop diagnostics integration unavailable.', 'error');
    return;
  }

  setBusyState(button, true, 'Sending...');
  try {
    const result = await bridge.sendTestReport();
    await refreshDesktopDiagnostics();
    showAppMessage(result?.submitted ? 'Test report sent.' : 'Test report saved locally.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not create test report.'), 'error');
  } finally {
    setBusyState(button, false);
  }
}

function setupDesktopDiagnosticsControls() {
  document.getElementById('refreshDiagnosticsBtn')?.addEventListener('click', refreshDesktopDiagnostics);
  document.getElementById('sendTestErrorReportBtn')?.addEventListener('click', sendDesktopTestErrorReport);
  refreshDesktopDiagnostics();
}

function setupSettingsActionButtons() {
  setupAppUpdateControls();
  setupDesktopDiagnosticsControls();

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
  document.getElementById('downloadDataExportBtn')?.addEventListener('click', downloadUserDataExport);
  document.getElementById('copyDataExportSummaryBtn')?.addEventListener('click', copyUserDataExportSummary);
  document.getElementById('openDataExportSettingsBtn')?.addEventListener('click', downloadUserDataExport);
  document.getElementById('clearLocalPrivacyDataBtn')?.addEventListener('click', clearLocalPrivacyData);
  document.getElementById('exportAppSettingsBtn')?.addEventListener('click', exportAppSettings);
  document.getElementById('importAppSettingsBtn')?.addEventListener('click', () => {
    document.getElementById('appSettingsImportInput')?.click();
  });
  document.getElementById('resetAppSettingsBtn')?.addEventListener('click', resetAppSettings);
  document.getElementById('appSettingsImportInput')?.addEventListener('change', async (event) => {
    const input = event.currentTarget;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    try {
      setAppSettingsBackupStatus('Importing settings...');
      await importAppSettingsFromFile(file);
    } catch (error) {
      setAppSettingsBackupStatus('Settings import failed.');
      showAppMessage(getApiErrorMessage(error, 'Could not import app settings.'), 'error');
    } finally {
      if (input) {
        input.value = '';
      }
    }
  });

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

  renderProfileBadgePicker(readSettingsState().profileBadges || []);

  document.getElementById('saveCustomStatusBtn')?.addEventListener('click', saveCustomStatusFromInputs);
  document.getElementById('saveProfileCustomStatusBtn')?.addEventListener('click', saveCustomStatusFromInputs);
  document.getElementById('clearCustomStatusBtn')?.addEventListener('click', clearCustomStatus);
  document.getElementById('saveActivityStatusBtn')?.addEventListener('click', saveActivityStatusFromInput);
  document.getElementById('clearActivityStatusBtn')?.addEventListener('click', clearActivityStatus);
  document.querySelectorAll('#customStatusInput, #profileCustomStatusInput').forEach((input) => {
    input.addEventListener('input', () => {
      input.value = input.value.slice(0, customStatusMaxLength);
      setCustomStatusInputs(input.value);
      applyCurrentProfileStatus(input.value, readSettingsState().presenceStatus || 'online');
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveCustomStatusFromInputs();
      }
    });
  });
  document.querySelectorAll('#activityStatusInput').forEach((input) => {
    input.addEventListener('input', () => {
      input.value = input.value.slice(0, activityStatusMaxLength);
      setActivityStatusInputs(input.value);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveActivityStatusFromInput();
      }
    });
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
  document.getElementById('createDeveloperAppBtn')?.addEventListener('click', () => openDeveloperAppDialog());
  document.getElementById('refreshDeveloperAppsBtn')?.addEventListener('click', () => {
    developerPortalLoaded = false;
    loadDeveloperPortalApplications({ force: true });
  });
  document.getElementById('refreshAuthorizedAppsBtn')?.addEventListener('click', () => {
    authorizedAppsLoaded = false;
    loadAuthorizedApps({ force: true });
  });

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

const oauthScopeCatalog = [
  'identify',
  'servers.read',
  'messages.read',
  'slash.commands',
  'bot',
  'webhooks.manage',
];
let developerPortalLoaded = false;
let authorizedAppsLoaded = false;

function getOAuthArrayField(item = {}, key) {
  const value = getIntegrationField(item, key, []);
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return value
      .split(/[\s,;]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeOAuthListInput(value = '') {
  return String(value || '')
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, index, all) => all.indexOf(part) === index);
}

function normalizeOAuthScopeInput(value = '') {
  const allowed = new Set(oauthScopeCatalog);
  const scopes = String(value || '')
    .split(/[\s,;]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => allowed.has(part))
    .filter((part, index, all) => all.indexOf(part) === index);
  return scopes.length ? scopes : ['identify'];
}

function formatOAuthDate(value) {
  if (!value) {
    return 'Never';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

function getDeveloperAppId(app = {}) {
  return getIntegrationField(app, 'clientId', getIntegrationField(app, 'id', ''));
}

function getDeveloperAppName(app = {}) {
  return getIntegrationField(app, 'name', 'Untitled app');
}

function getDeveloperAppDescription(app = {}) {
  return getIntegrationField(app, 'description', '') || 'No description';
}

function getDeveloperAppScopes(app = {}) {
  return getOAuthArrayField(app, 'allowedScopes');
}

function buildOAuthMutationPayload(values = {}, app = null) {
  const payload = {
    name: values.name || '',
    description: values.description || null,
    iconUrl: values.iconUrl || null,
    redirectUris: normalizeOAuthListInput(values.redirectUris),
    allowedScopes: normalizeOAuthScopeInput(values.allowedScopes),
    botAccountId: values.botAccountId || null,
    isEnabled: values.isEnabled !== 'false',
  };
  if (app) {
    payload.applicationId = getDeveloperAppId(app);
  }
  return payload;
}

function getDeveloperAuthorizationUrl(app = {}) {
  const clientId = getDeveloperAppId(app);
  const redirects = getOAuthArrayField(app, 'redirectUris');
  const scopes = getDeveloperAppScopes(app);
  const base = getIntegrationField(
    app,
    'authorizationUrl',
    `${homeApiBase}/api/OAuthApps/GetAuthorizationPreview?clientId=${encodeURIComponent(clientId)}`
  );

  try {
    const url = new URL(base, homeApiBase);
    url.searchParams.set('clientId', clientId);
    if (redirects[0]) {
      url.searchParams.set('redirectUri', redirects[0]);
    }
    if (scopes.length) {
      url.searchParams.set('scope', scopes.join(' '));
    }
    return url.toString();
  } catch {
    return base;
  }
}

function showDeveloperAppSecret(app = {}) {
  openIntegrationSecretDialog({
    title: 'OAuth Client Secret',
    description: 'Store this secret now. It is only shown after creation or rotation.',
    values: [
      { label: 'Client ID', value: getDeveloperAppId(app) },
      { label: 'Client Secret', value: getIntegrationField(app, 'clientSecret', '') },
      { label: 'Authorization URL', value: getDeveloperAuthorizationUrl(app) },
    ],
  });
}

function setDeveloperPortalStatus(message, variant = '') {
  const status = document.getElementById('developerPortalStatus');
  if (!status) {
    return;
  }
  status.textContent = message;
  status.dataset.variant = variant;
}

function createAppIconElement(item = {}, className = 'developer-app-icon') {
  const icon = document.createElement('div');
  icon.className = className;
  const iconUrl = getIntegrationField(item, 'iconUrl', getIntegrationField(item, 'applicationIconUrl', ''));
  if (iconUrl) {
    const img = document.createElement('img');
    img.src = resolveMediaUrl(iconUrl);
    img.alt = '';
    icon.appendChild(img);
  } else {
    icon.textContent = getDeveloperAppName(item).charAt(0).toUpperCase() || 'A';
  }
  return icon;
}

async function openDeveloperAppDialog(app = null) {
  const scopes = app ? getDeveloperAppScopes(app).join(' ') : 'identify';
  const redirectUris = app
    ? getOAuthArrayField(app, 'redirectUris').join('\n')
    : 'http://localhost/callback';
  const values = await openSimpleFormDialog({
    title: app ? 'Edit Application' : 'New Application',
    fields: [
      { name: 'name', label: 'Application name', value: app ? getDeveloperAppName(app) : '', maxLength: 80 },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        rows: 3,
        value: app ? getDeveloperAppDescription(app) : '',
        maxLength: 240,
        required: false,
      },
      {
        name: 'redirectUris',
        label: 'Redirect URLs',
        type: 'textarea',
        rows: 4,
        value: redirectUris,
        required: true,
      },
      {
        name: 'allowedScopes',
        label: 'Allowed scopes',
        value: scopes,
      },
      {
        name: 'iconUrl',
        label: 'Icon URL',
        value: app ? getIntegrationField(app, 'iconUrl', '') : '',
        required: false,
      },
      {
        name: 'botAccountId',
        label: 'Linked bot ID',
        value: app ? getIntegrationField(app, 'botAccountId', '') : '',
        required: false,
      },
      {
        name: 'isEnabled',
        label: 'Status',
        value: app && getIntegrationField(app, 'isEnabled', true) === false ? 'false' : 'true',
        options: [
          { value: 'true', label: 'Enabled' },
          { value: 'false', label: 'Disabled' },
        ],
      },
    ],
    confirmText: app ? 'Save' : 'Create',
    preserveExisting: true,
  });

  if (!values) {
    return;
  }

  const payload = buildOAuthMutationPayload(values, app);
  if (!payload.name || payload.redirectUris.length === 0) {
    showAppMessage('Add an application name and at least one redirect URL.', 'error');
    return;
  }

  try {
    const endpoint = app ? 'UpdateOAuthApplication' : 'CreateOAuthApplication';
    const response = await axios.post(`${homeApiBase}/api/OAuthApps/${endpoint}`, payload);
    if (!app) {
      showDeveloperAppSecret(response.data || {});
    }
    developerPortalLoaded = false;
    await loadDeveloperPortalApplications({ force: true });
    showAppMessage(app ? 'Application saved.' : 'Application created.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not save application.'), 'error');
  }
}

async function rotateDeveloperAppSecret(app) {
  const confirmed = await askConfirm(
    'Rotate Client Secret',
    'Existing clients will stop working until they use the new secret.',
    { danger: true, confirmText: 'Rotate' }
  );
  if (!confirmed) {
    return;
  }

  try {
    const response = await axios.post(`${homeApiBase}/api/OAuthApps/RotateOAuthClientSecret`, {
      applicationId: getDeveloperAppId(app),
    });
    showDeveloperAppSecret(response.data || {});
    developerPortalLoaded = false;
    await loadDeveloperPortalApplications({ force: true });
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not rotate client secret.'), 'error');
  }
}

async function deleteDeveloperApp(app) {
  const confirmed = await askConfirm(
    'Delete Application',
    `Delete ${getDeveloperAppName(app)}?`,
    { danger: true, confirmText: 'Delete' }
  );
  if (!confirmed) {
    return;
  }

  try {
    await axios.post(`${homeApiBase}/api/OAuthApps/DeleteOAuthApplication`, {
      applicationId: getDeveloperAppId(app),
    });
    developerPortalLoaded = false;
    await loadDeveloperPortalApplications({ force: true });
    showAppMessage('Application deleted.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not delete application.'), 'error');
  }
}

function renderDeveloperApp(app) {
  const row = document.createElement('div');
  row.className = 'developer-app-row';
  row.appendChild(createAppIconElement(app));

  const copy = document.createElement('div');
  copy.className = 'developer-app-copy';
  const name = document.createElement('strong');
  name.textContent = getDeveloperAppName(app);
  const desc = document.createElement('span');
  desc.textContent = getDeveloperAppDescription(app);
  const clientId = document.createElement('code');
  clientId.textContent = `Client ID: ${getDeveloperAppId(app)}`;
  const dates = document.createElement('span');
  dates.textContent = `Created ${formatOAuthDate(getIntegrationField(app, 'createdAt', ''))} | Secret rotated ${formatOAuthDate(getIntegrationField(app, 'secretLastRotatedAt', ''))}`;
  const scopes = document.createElement('div');
  scopes.className = 'developer-scope-list';
  getDeveloperAppScopes(app).forEach((scope) => {
    const pill = document.createElement('span');
    pill.className = 'developer-scope-pill';
    pill.textContent = scope;
    scopes.appendChild(pill);
  });
  copy.appendChild(name);
  copy.appendChild(desc);
  copy.appendChild(clientId);
  copy.appendChild(dates);
  copy.appendChild(scopes);

  const actions = document.createElement('div');
  actions.className = 'developer-app-actions';
  [
    ['Copy ID', () => copyIntegrationValue(getDeveloperAppId(app), 'Client ID copied.')],
    ['Copy URL', () => copyIntegrationValue(getDeveloperAuthorizationUrl(app), 'Authorization URL copied.')],
    ['Edit', () => openDeveloperAppDialog(app)],
    ['Rotate', () => rotateDeveloperAppSecret(app)],
    ['Delete', () => deleteDeveloperApp(app)],
  ].forEach(([label, handler]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = label === 'Delete' ? 'settings-btn-danger settings-btn-compact' : 'server-tool-btn';
    button.textContent = label;
    button.addEventListener('click', handler);
    actions.appendChild(button);
  });

  row.appendChild(copy);
  row.appendChild(actions);
  return row;
}

function renderDeveloperApps(apps = []) {
  const list = document.getElementById('developerAppsList');
  if (!list) {
    return;
  }

  list.innerHTML = '';
  if (!apps.length) {
    list.innerHTML = '<div class="empty-state-card padded">No applications yet.</div>';
    return;
  }

  apps.forEach((app) => list.appendChild(renderDeveloperApp(app)));
}

async function loadDeveloperPortalApplications({ force = false } = {}) {
  const list = document.getElementById('developerAppsList');
  if (!list || (developerPortalLoaded && !force)) {
    return;
  }

  list.innerHTML = '<div class="empty-state-card padded">Loading applications...</div>';
  setDeveloperPortalStatus('Loading applications...');
  try {
    const response = await axios.get(`${homeApiBase}/api/OAuthApps/GetOAuthApplications`);
    const apps = Array.isArray(response.data) ? response.data : [];
    renderDeveloperApps(apps);
    setDeveloperPortalStatus(`${apps.length} ${apps.length === 1 ? 'application' : 'applications'}`);
    developerPortalLoaded = true;
  } catch (error) {
    list.innerHTML = '<div class="empty-state-card padded">Could not load applications.</div>';
    setDeveloperPortalStatus(getApiErrorMessage(error, 'Could not load applications.'), 'error');
  }
}

function renderAuthorizedApp(authorization = {}) {
  const row = document.createElement('div');
  row.className = 'authorized-app-row';
  row.appendChild(createAppIconElement(authorization, 'authorized-app-icon'));

  const copy = document.createElement('div');
  copy.className = 'authorized-app-copy';
  const name = document.createElement('strong');
  name.textContent = getIntegrationField(authorization, 'applicationName', 'Authorized app');
  const desc = document.createElement('span');
  const scopes = getOAuthArrayField(authorization, 'scopes').join(', ') || 'identify';
  desc.textContent = `${scopes} | Authorized ${formatOAuthDate(getIntegrationField(authorization, 'createdAt', ''))}`;
  copy.appendChild(name);
  copy.appendChild(desc);

  const actions = document.createElement('div');
  actions.className = 'authorized-app-actions';
  const revoke = document.createElement('button');
  revoke.type = 'button';
  revoke.className = 'settings-btn-danger';
  revoke.textContent = 'Deauthorize';
  revoke.addEventListener('click', () => revokeAuthorizedApp(getIntegrationField(authorization, 'id', '')));
  actions.appendChild(revoke);

  row.appendChild(copy);
  row.appendChild(actions);
  return row;
}

function renderAuthorizedApps(authorizations = []) {
  const list = document.getElementById('authorizedAppsList');
  if (!list) {
    return;
  }

  list.innerHTML = '';
  if (!authorizations.length) {
    list.innerHTML = '<div class="empty-state-card padded">No authorized apps.</div>';
    return;
  }

  authorizations.forEach((authorization) => list.appendChild(renderAuthorizedApp(authorization)));
}

async function loadAuthorizedApps({ force = false } = {}) {
  const list = document.getElementById('authorizedAppsList');
  if (!list || (authorizedAppsLoaded && !force)) {
    return;
  }

  list.innerHTML = '<div class="empty-state-card padded">Loading authorized apps...</div>';
  try {
    const response = await axios.get(`${homeApiBase}/api/OAuthApps/GetAuthorizedApps`);
    renderAuthorizedApps(Array.isArray(response.data) ? response.data : []);
    authorizedAppsLoaded = true;
  } catch (error) {
    list.innerHTML = '<div class="empty-state-card padded">Could not load authorized apps.</div>';
    showAppMessage(getApiErrorMessage(error, 'Could not load authorized apps.'), 'error');
  }
}

async function revokeAuthorizedApp(authorizationId) {
  if (!authorizationId) {
    return;
  }

  const confirmed = await askConfirm(
    'Deauthorize App',
    'This app will lose access to your account.',
    { danger: true, confirmText: 'Deauthorize' }
  );
  if (!confirmed) {
    return;
  }

  try {
    await axios.post(`${homeApiBase}/api/OAuthApps/RevokeAuthorization`, {
      authorizationId,
    });
    authorizedAppsLoaded = false;
    await loadAuthorizedApps({ force: true });
    showAppMessage('App deauthorized.', 'success');
  } catch (error) {
    showAppMessage(getApiErrorMessage(error, 'Could not deauthorize app.'), 'error');
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
  setupConversationSearch();
  setupEmojiPicker();
  setupSlashCommandInputs();
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

  const activeNavItem = document.querySelector(`.settings-item[data-target="${escapeCssIdentifier(target)}"]`);
  const dialogTitle = document.getElementById('settingsDialogTitle');
  if (dialogTitle && activeNavItem) {
    dialogTitle.textContent = activeNavItem.textContent.trim();
  }
  updateSettingsNavigationAccessibility();

  writeSettingsState((state) => ({
    ...state,
    selectedTab: target,
  }));

  if (target === 'developer-portal') {
    loadDeveloperPortalApplications().catch((error) => {
      console.warn('Could not load developer portal:', error);
    });
  } else if (target === 'authorized-apps') {
    loadAuthorizedApps().catch((error) => {
      console.warn('Could not load authorized apps:', error);
    });
  }
}
window.switchSettingsTab = switchSettingsTab;

function setupSettingsInteractivity() {
  if (settingsInteractivityInitialized) {
    return;
  }

  settingsInteractivityInitialized = true;
  populateLanguageSelect(readSettingsState().language);
  setupSettingsAccessibility();

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

      tab.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const tabs = Array.from(profileTabBar.querySelectorAll('.settings-tab'));
        const currentIndex = tabs.indexOf(tab);
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length];
        nextTab?.focus();
        nextTab?.click();
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
      updateToggleAccessibility(item);
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

      item.addEventListener('keydown', (event) => {
        if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return;
        event.preventDefault();
        const items = Array.from(group.querySelectorAll('.radio-item'));
        const currentIndex = items.indexOf(item);
        const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
        const nextItem = items[(currentIndex + direction + items.length) % items.length];
        nextItem?.focus();
        nextItem?.click();
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
      updateCheckboxAccessibility(item);
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
    trapSettingsModalFocus(event);
  });

  const saveProfileBtn = document.getElementById('saveProfileSettingsBtn');
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      const profilePicUrl = document.getElementById('profilePictureUrlInput')?.value?.trim() || '';
      const profileBannerUrl = document.getElementById('profileBannerUrlInput')?.value?.trim() || '';
      const profileBannerColor = readSettingsState().profileBannerColor || '#0c0c0c';
      const bio =
        document.getElementById('profileDescriptionInput')?.value?.trim() || '';
      const profileBadges = getSelectedProfileBadges();
      const customStatus =
        document.getElementById('profileCustomStatusInput')?.value?.trim() ||
        document.getElementById('customStatusInput')?.value?.trim() ||
        '';

      try {
        saveProfileBtn.textContent = 'Saving...';
        saveProfileBtn.disabled = true;

        await axios.post(`${homeApiBase}/api/Account/UpdateAccountProfile`, {
          profilePictureUrl: profilePicUrl,
          profileBannerUrl,
          profileBannerColor,
          bio,
          description: bio,
          badges: profileBadges,
        });
        await syncCustomStatus(customStatus, { silent: true });

        updateProfileVisuals(
          profilePicUrl,
          bio,
          profileBannerUrl,
          profileBannerColor,
          customStatus,
          readSettingsState().presenceStatus,
          profileBadges
        );
        writeSettingsState((state) => ({
          ...state,
          profileBannerUrl,
          profileBannerColor,
          customStatus: normalizeCustomStatus(customStatus),
          profileBadges,
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
      const customTheme = getThemeFromInputs();

      try {
        saveThemeBtn.textContent = 'Saving...';
        saveThemeBtn.disabled = true;

        await axios.post(`${homeApiBase}/api/Account/UpdateAccountTheme`, {
          username: JWTusername,
          backgroundColor: customTheme.backgroundColor,
          textColor: customTheme.textColor,
        });

        applyTheme(customTheme.backgroundColor, customTheme.textColor, customTheme.accentColor);
        syncThemeInputs(customTheme.backgroundColor, customTheme.textColor, customTheme.accentColor);
        syncThemeModeSelectionFromTheme(
          customTheme.backgroundColor,
          customTheme.textColor,
          customTheme.accentColor
        );
        writeSettingsState((state) => ({
          ...state,
          themeMode: 'custom',
          customTheme,
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

        applyTheme(DEFAULT_THEME.background, DEFAULT_THEME.text, DEFAULT_THEME.accent);
        syncThemeInputs(DEFAULT_THEME.background, DEFAULT_THEME.text, DEFAULT_THEME.accent);
        setRadioGroupSelection(
          document.querySelector('[data-settings-radio="themeMode"]'),
          'dark'
        );
        setThemePresetSelection('dark');
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
  setupThemeEditor();

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
  accent: '#5865f2',
};

const THEME_PRESETS = {
  dark: DEFAULT_THEME,
  light: LIGHT_THEME,
  midnight: {
    background: '#101114',
    text: '#f4f7fb',
    accent: '#3cc7a0',
  },
  forest: {
    background: '#17231d',
    text: '#e8f4ee',
    accent: '#55b87a',
  },
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

function normalizeCustomTheme(theme, fallback = null) {
  if (!theme || typeof theme !== 'object') return fallback;

  return {
    backgroundColor: normalizeHexColor(
      theme.backgroundColor ?? theme.background ?? theme.bgColor,
      fallback?.backgroundColor || DEFAULT_THEME.background
    ),
    textColor: normalizeHexColor(
      theme.textColor ?? theme.text,
      fallback?.textColor || DEFAULT_THEME.text
    ),
    accentColor: normalizeHexColor(
      theme.accentColor ?? theme.accent,
      fallback?.accentColor || DEFAULT_THEME.accent
    ),
  };
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

function buildThemePalette(backgroundColor, textColor, accentColor = DEFAULT_THEME.accent) {
  const background = normalizeHexColor(
    backgroundColor,
    DEFAULT_THEME.background
  );
  const mainText = getReadableTextColor(background, textColor);
  const accent = normalizeHexColor(accentColor, DEFAULT_THEME.accent);
  const isDarkTheme = getRelativeLuminance(background) < 0.35;
  const referenceColor = isDarkTheme ? '#ffffff' : '#000000';
  const accentReference = getRelativeLuminance(accent) < 0.35 ? '#ffffff' : '#000000';
  const accentHover = mixColors(accent, accentReference, 0.16);

  return {
    background,
    accent,
    accentHover,
    accentText: getReadableTextColor(accent, '#ffffff'),
    focusRing: mixColors(accent, accentReference, 0.34),
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

function applyTheme(bgColor, textColor, accentColor = DEFAULT_THEME.accent) {
  const theme = buildThemePalette(bgColor, textColor, accentColor);

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
  --brand-primary: ${theme.accent};
  --brand-hover: ${theme.accentHover};
  --brand-text: ${theme.accentText};
  --focus-ring: ${theme.focusRing};
}`
  );

  updateThemeEditorPreview(theme);
  return theme;
}

async function loadUserTheme() {
  try {
    if (typeof JWTusername === 'undefined' || !JWTusername) return;
    const res = await axios.get(`${homeApiBase}/api/Account/GetAccountTheme`);
    if (res.data && res.data.backgroundColor) {
      const savedTheme = normalizeCustomTheme(readSettingsState().customTheme);
      const backgroundColor = normalizeHexColor(res.data.backgroundColor, DEFAULT_THEME.background);
      const textColor = normalizeHexColor(res.data.textColor || DEFAULT_THEME.text, DEFAULT_THEME.text);
      const accentColor = savedTheme?.accentColor || DEFAULT_THEME.accent;

      applyTheme(backgroundColor, textColor, accentColor);
      syncThemeInputs(backgroundColor, textColor, accentColor);
      syncThemeModeSelectionFromTheme(
        backgroundColor,
        textColor,
        accentColor
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
      const customStatus = getProfileCustomStatus(res.data);
      const profileBadges = getProfileBadges(res.data);
      const nextAvatarUrl = res.data.profilePictureUrl || homeDefaultAvatarUrl;
      const nextDescription = getProfileBio(res.data);
      const nextBannerUrl = res.data.profileBannerUrl || '';
      const nextBannerColor = res.data.profileBannerColor || readSettingsState().profileBannerColor || '#0c0c0c';
      cacheProfileSummary({
        ...res.data,
        username: JWTusername,
        profilePictureUrl: nextAvatarUrl,
        customStatus,
        badges: profileBadges,
        presenceStatus: getProfilePresenceStatus(res.data),
      });
      
      if (picInput) picInput.value = res.data.profilePictureUrl || '';
      if (bannerInput) bannerInput.value = nextBannerUrl;
      if (descInput) descInput.value = nextDescription;
      setCustomStatusInputs(customStatus);
      setProfileBadgePickerSelection(profileBadges);
      updateProfileVisuals(
        nextAvatarUrl,
        nextDescription,
        nextBannerUrl,
        nextBannerColor,
        customStatus,
        getProfilePresenceStatus(res.data),
        profileBadges
      );
      writeSettingsState((state) => ({
        ...state,
        profileBannerUrl: nextBannerUrl,
        profileBannerColor: nextBannerColor,
        customStatus,
        profileBadges,
        presenceStatus: getProfilePresenceStatus(res.data),
      }));
    }
  } catch (err) {
    console.log('Could not load profile, using defaults');
  }
}
