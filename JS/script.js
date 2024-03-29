'use strict';

const usernameInput = document.getElementsByClassName('usernameInput')[0];
const passwordInput = document.getElementsByClassName('passwordInput')[0];
const confirmPasswordInput = document.getElementsByClassName(
  'confirmPasswordInput'
)[0];

function LogInForm(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  console.log(formData);
  const formDataObject = {};
  formData.forEach((value, key) => {
    formDataObject[key] = value;
  });

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
  }
}
