'use strict';

async function Auth() {
  let token = getCookie('token');
  const tokenRes = await axios.post(
    `http://localhost:5017/api/Account/VerifyToken?token=${token}`
  );

  if (tokenRes.data.message !== 'Token is correct.') {
    window.location.replace('/Pages/LogIn.html');
  }
}
function getCookie(name) {
  let value = `; ${document.cookie}`;
  let parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}
Auth();
