'use strict';

const authAppPaths = window.APP_PATHS || {};
const authApiBase = authAppPaths.apiBase || 'http://localhost:5018';
const authLoginPageUrl =
  typeof authAppPaths.pageUrl === 'function'
    ? authAppPaths.pageUrl('LogIn.html')
    : './LogIn.html';

if (typeof axios !== 'undefined') {
  axios.defaults.withCredentials = true;
}

async function Auth() {
  const token = getCookie('token');

  if (!token) {
    window.location.replace(authLoginPageUrl);
    return;
  }

  try {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    const tokenRes = await axios.post(`${authApiBase}/api/Account/VerifyToken`);

    if (tokenRes?.data?.message === 'Token is correct.') {
      return;
    }
  } catch (error) {
    console.error('Token verification failed', error);
  }

  if (await tryRefreshSession()) {
    return;
  }

  document.cookie = 'token=; path=/; max-age=0; SameSite=Lax';
  localStorage.removeItem('refreshToken');
  window.location.replace(authLoginPageUrl);
}

async function tryRefreshSession() {
  try {
    const refreshToken = localStorage.getItem('refreshToken') || '';
    const refreshRes = await axios.post(`${authApiBase}/api/Account/Refresh`, {
      refreshToken,
    });

    const nextToken = refreshRes?.data?.token;
    if (!nextToken) return false;

    document.cookie = `token=${nextToken}; path=/; max-age=1209600; SameSite=Lax`;
    axios.defaults.headers.common.Authorization = `Bearer ${nextToken}`;
    if (refreshRes?.data?.refreshToken) {
      localStorage.setItem('refreshToken', refreshRes.data.refreshToken);
    }
    return true;
  } catch (error) {
    console.error('Session refresh failed', error);
    return false;
  }
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return '';
}

if (typeof axios !== 'undefined') {
  Auth();
} else {
  window.location.replace(authLoginPageUrl);
}
