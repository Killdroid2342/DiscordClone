'use strict';

async function Auth() {
  let token = getCookie('token');
  const tokenRes = await axios.post(
    `https://localhost:7170/api/Account/VerifyToken?token=${token}`
  );
  console.log(tokenRes);
  if (tokenRes.data.message !== 'Token is correct.') {
    window.location.replace('http://127.0.0.1:5500/Pages/LogIn.html');
  }
}
function getCookie(name) {
  let value = `; ${document.cookie}`;
  let parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}
Auth();
