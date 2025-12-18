'use strict';

const usernameInput = document.getElementsByClassName('usernameInput')[0];
const passwordInput = document.getElementsByClassName('passwordInput')[0];
const confirmPasswordInput = document.getElementsByClassName(
  'confirmPasswordInput'
)[0];

async function LogInForm(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  console.log('login stuff:', formData);
  const formDataObject = { Friends: [] };
  formData.forEach((value, key) => {
    formDataObject[key] = value;
  });
  try {
    const response = await axios.post(
      'http://localhost:5018/api/Account/LogIn',
      formDataObject
    );
    console.log('login response:', response);

    const token = response.data.token;
    document.cookie = `token=${token}; path=/`;

    const jwtRes = await axios.post(
      `http://localhost:5018/api/Account/VerifyToken?token=${token}`
    );
    console.log('token check result:', jwtRes);

    if (response.data.message) {
      const modalContent = document.querySelector('.content');
      modalContent.innerText = response.data.message;
      const outerModal = document.querySelector('.outerModal');
      outerModal.style.display = 'flex';

      setTimeout(() => {
        outerModal.style.display = 'none';
      }, 2000);
    }
    setTimeout(() => {
      if (jwtRes.data.message === 'Token is correct.') {
        window.location.replace('/Pages/Home.html');
      }
    }, 1000);
  } catch (e) {
    console.log('login failed:', e);
  }
  console.log('form validation broke:', formDataObject);
}

async function RegisterForm(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const formDataObject = { Friends: [] };
  formData.forEach((value, key) => {
    formDataObject[key] = value;
  });

  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (password !== confirmPassword) {
    console.log('passwords dont match');
  } else {
    console.log('passwords match');
    console.log('signup data being sent:', formDataObject);

    try {
      const response = await axios.post(
        'http://localhost:5018/api/Account/CreateAccount',
        formDataObject
      );
      console.log('signup response:', response);
      console.log('signup msg:', response.data.message);

      if (response.data.message) {
        const modalContent = document.querySelector('.content');
        modalContent.innerText = response.data.message;
        const outerModal = document.querySelector('.outerModal');
        outerModal.style.display = 'flex';

        setTimeout(() => {
          outerModal.style.display = 'none';
          if (response.data.message.includes('Account Created') || response.status === 200) {
            window.location.href = 'LogIn.html';
          }
        }, 2000);
      }
    } catch (e) {
      console.log('signup failed:', e);
    }
  }
}
