'use strict';

const usernameInput = document.getElementsByClassName('usernameInput')[0];
const passwordInput = document.getElementsByClassName('passwordInput')[0];
const confirmPasswordInput = document.getElementsByClassName(
  'confirmPasswordInput'
)[0];

async function LogInForm(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const formDataObject = {};
  formData.forEach((value, key) => {
    formDataObject[key] = value;
  });
  try {
    const response = await axios.post(
      'https://localhost:7170/api/Account/LogIn',
      formDataObject
    );
    console.log(response);

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
  console.log(formDataObject);
}

async function RegisterForm(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const formDataObject = {};
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
        'https://localhost:7170/api/Account/CreateAccount',
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
