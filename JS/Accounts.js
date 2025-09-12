'use strict';

const usernameInput = document.getElementsByClassName('usernameInput')[0];
const passwordInput = document.getElementsByClassName('passwordInput')[0];
const confirmPasswordInput = document.getElementsByClassName(
  'confirmPasswordInput'
)[0];

async function LogInForm(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  console.log(formData);
  const formDataObject = { Friends: [] };
  formData.forEach((value, key) => {
    formDataObject[key] = value;
  });
  try {
    const response = await axios.post(
      'http://localhost:5018/api/Account/LogIn',
      formDataObject
    );
    console.log(response);

    const token = response.data.token;
    document.cookie = `token = ${token}`;

    const jwtRes = await axios.post(
      `http://localhost:5018/api/Account/VerifyToken?token=${token}`
    );
    console.log(jwtRes);

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
        window.location.replace('http://127.0.0.1:5500/Pages/Home.html');
      }
    }, 3000);
  } catch (e) {
    console.log(e);
  }
  console.log(formDataObject);
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
    console.log('Passwords do not match');
  } else {
    console.log('Passwords match');
    console.log(formDataObject, 'data being sent from form');

    try {
      const response = await axios.post(
        'http://localhost:5018/api/Account/CreateAccount',
        formDataObject
      );
      console.log(response);
      console.log(response.data.message);

      if (response.data.message) {
        const modalContent = document.querySelector('.content');
        modalContent.innerText = response.data.message;
        const outerModal = document.querySelector('.outerModal');
        outerModal.style.display = 'flex';

        setTimeout(() => {
          outerModal.style.display = 'none';
        }, 2000);
      }
    } catch (e) {
      console.log(e);
    }
  }
}
