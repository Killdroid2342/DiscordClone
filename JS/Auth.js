'use strict';

const authAppPaths = window.APP_PATHS || {};
const authApiBase = authAppPaths.apiBase || 'http://localhost:5018';
const authLoginPageUrl =
  typeof authAppPaths.pageUrl === 'function'
    ? authAppPaths.pageUrl('LogIn.html')
    : './LogIn.html';

async function Auth() {
  const token = getCookie('token');

  if (!token) {
    window.location.replace(authLoginPageUrl);
    return;
  }

  try {
    const tokenRes = await axios.post(
      `${authApiBase}/api/Account/VerifyToken?token=${encodeURIComponent(token)}`
    );

    if (tokenRes?.data?.message === 'Token is correct.') {
      return;
    }
  } catch (error) {
    console.error('Token verification failed', error);
  }

  document.cookie = 'token=; path=/; max-age=0; SameSite=Lax';
  window.location.replace(authLoginPageUrl);
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
