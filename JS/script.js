'use strict';

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

function RegisterForm(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const formDataObject = {};
  formData.forEach((value, key) => {
    formDataObject[key] = value;
  });

  console.log(formDataObject);
}
