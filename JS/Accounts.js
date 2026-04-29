'use strict';

const accountsAppPaths = window.APP_PATHS || {};
const accountsApiBase = accountsAppPaths.apiBase || 'http://localhost:5018';
const accountsRedirectToPage =
  typeof accountsAppPaths.pageUrl === 'function'
    ? accountsAppPaths.pageUrl
    : (pageName) => `./${pageName}`;

const usernameInput = document.querySelector('.usernameInput');
const loginPasswordInput = document.querySelector('.LogInpasswordInput');
const passwordInput = document.querySelector('.passwordInput');
const confirmPasswordInput = document.querySelector('.confirmPasswordInput');
const modalContent = document.querySelector('.content');
const outerModal = document.querySelector('.outerModal');
let pendingTwoFactorChallenge = null;
let twoFactorCodeInput = null;

if (typeof axios !== 'undefined') {
  axios.defaults.withCredentials = true;
}

function showStatusMessage(message, duration = 2200) {
  if (!modalContent || !outerModal) return;

  modalContent.innerText = message;
  outerModal.style.display = 'flex';

  window.clearTimeout(showStatusMessage.timeoutId);
  showStatusMessage.timeoutId = window.setTimeout(() => {
    outerModal.style.display = 'none';
  }, duration);
}

function setButtonState(form, isLoading, label) {
  const submitButton = form.querySelector('input[type="submit"]');
  if (!submitButton) return;

  submitButton.disabled = isLoading;
  submitButton.value = label;
}

function showTwoFactorStep(form, challenge) {
  pendingTwoFactorChallenge = challenge;

  if (!twoFactorCodeInput) {
    const submitButton = form.querySelector('input[type="submit"]');
    const label = document.createElement('label');
    label.className = 'twoFactorLabel';
    label.textContent = 'AUTHENTICATOR OR BACKUP CODE';

    twoFactorCodeInput = document.createElement('input');
    twoFactorCodeInput.type = 'text';
    twoFactorCodeInput.className = 'twoFactorInput';
    twoFactorCodeInput.name = 'twoFactorCode';
    twoFactorCodeInput.autocomplete = 'one-time-code';
    twoFactorCodeInput.inputMode = 'text';
    twoFactorCodeInput.autocapitalize = 'characters';
    twoFactorCodeInput.spellcheck = false;
    twoFactorCodeInput.required = true;

    form.insertBefore(label, submitButton);
    form.insertBefore(twoFactorCodeInput, submitButton);
  }

  twoFactorCodeInput.value = '';
  twoFactorCodeInput.focus();
  setButtonState(form, false, 'Verify');
  showStatusMessage('Enter your authenticator code or a backup code.');
}

async function completeTwoFactorLogin(form) {
  const code = twoFactorCodeInput?.value.trim();
  if (!pendingTwoFactorChallenge || !code) {
    showStatusMessage('Enter your two-factor code.');
    return;
  }

  setButtonState(form, true, 'Verifying...');

  try {
    const response = await axios.post(`${accountsApiBase}/api/Account/CompleteTwoFactorLogin`, {
      username: pendingTwoFactorChallenge.username,
      twoFactorTicket: pendingTwoFactorChallenge.twoFactorTicket,
      code,
    });

    await finishLogin(response);
  } catch (error) {
    const message = error?.response?.data?.message || 'Two-factor verification failed.';
    showStatusMessage(message);
  } finally {
    setButtonState(form, false, 'Verify');
  }
}

async function finishLogin(response) {
  const token = response?.data?.token;

  if (!token) {
    showStatusMessage(response?.data?.message || 'Login failed.');
    return;
  }

  document.cookie = `token=${token}; path=/; max-age=1209600; SameSite=Lax`;
  axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  if (response?.data?.refreshToken) {
    localStorage.setItem('refreshToken', response.data.refreshToken);
  }
  const jwtRes = await axios.post(`${accountsApiBase}/api/Account/VerifyToken`);

  if (response.data.message) {
    showStatusMessage(response.data.message);
  }

  if (jwtRes?.data?.message === 'Token is correct.') {
    window.setTimeout(() => {
      window.location.replace(accountsRedirectToPage('Home.html'));
    }, 500);
    return;
  }

  showStatusMessage('Your session could not be verified.');
}

async function LogInForm(event) {
  event.preventDefault();

  const form = event.target;
  if (pendingTwoFactorChallenge) {
    await completeTwoFactorLogin(form);
    return;
  }

  const username = usernameInput?.value.trim();
  const password = loginPasswordInput?.value;

  if (!username || !password) {
    showStatusMessage('Enter both your username and password.');
    return;
  }

  const payload = {
    UserName: username,
    PassWord: password,
    Friends: [],
  };

  setButtonState(form, true, 'Logging In...');

  try {
    const response = await axios.post(`${accountsApiBase}/api/Account/LogIn`, payload);
    if (response?.data?.twoFactorRequired) {
      showTwoFactorStep(form, response.data);
      return;
    }

    await finishLogin(response);
  } catch (e) {
    const message =
      e?.response?.data?.message ||
      'The server could not be reached. Make sure the API is running on port 5018.';
    showStatusMessage(message);
  } finally {
    setButtonState(form, false, pendingTwoFactorChallenge ? 'Verify' : 'Log In');
  }
}

async function RegisterForm(event) {
  event.preventDefault();

  const form = event.target;
  const username = usernameInput?.value.trim();
  const password = passwordInput?.value;
  const confirmPassword = confirmPasswordInput?.value;

  if (!username || !password || !confirmPassword) {
    showStatusMessage('Fill out every required field.');
    return;
  }

  if (password !== confirmPassword) {
    showStatusMessage('Passwords do not match.');
    confirmPasswordInput?.focus();
    return;
  }

  const payload = {
    UserName: username,
    PassWord: password,
    Friends: [],
  };

  setButtonState(form, true, 'Creating Account...');

  try {
    const response = await axios.post(
      `${accountsApiBase}/api/Account/CreateAccount`,
      payload
    );
    const message = response?.data?.message || 'Account created.';

    showStatusMessage(message);

    if (
      response.status === 200 &&
      typeof message === 'string' &&
      message.toLowerCase().includes('created')
    ) {
      window.setTimeout(() => {
        window.location.replace(accountsRedirectToPage('LogIn.html'));
      }, 700);
    }
  } catch (e) {
    const message =
      e?.response?.data?.message ||
      'The server could not be reached. Make sure the API is running on port 5018.';
    showStatusMessage(message);
  } finally {
    setButtonState(form, false, 'Continue');
  }
}
