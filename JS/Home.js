'use strict';
document.getElementById('serverDetails').style.display = 'none';

const username = document.getElementById('username');
let GetCookieToken = function (name) {
  let value = '; ' + document.cookie;
  let parts = value.split('; ' + name + '=');
  if (parts.length == 2) return parts.pop().split(';').shift();
};

let cookieVal = GetCookieToken('token');

function decodeJWT(token) {
  const parts = token.split('.');
  const header = JSON.parse(atob(parts[0]));
  const payload = JSON.parse(atob(parts[1]));

  return {
    header: header,
    payload: payload,
  };
}
const jwt = cookieVal;
const decodedJWT = decodeJWT(jwt);
console.log(decodedJWT);
const JWTusername = decodedJWT.payload.username;
username.innerHTML = JWTusername;

function openModal() {
  document.querySelector('.outerModal').style.display = 'flex';
}

function closeModal() {
  document.querySelector('.outerModal').style.display = 'none';
}

function openSecondModal() {
  closeModal();
  document.querySelector('.outerSecondModal').style.display = 'flex';
}

function closeSecondModal() {
  document.querySelector('.outerSecondModal').style.display = 'none';
}

function BackToFirstModal() {
  closeSecondModal();
  openModal();
}

function OpenCreationModal() {
  closeSecondModal();
  document.querySelector('.outerCreationModal').style.display = 'flex';
}

function CloseCreationModal() {
  document.querySelector('.outerCreationModal').style.display = 'none';
}

function BackLastModal() {
  CloseCreationModal();
  openSecondModal();
}

async function CreateServer(event) {
  event.preventDefault();

  let inputElement = document.querySelector('.serverInput');

  let ServerName = inputElement.value;
  let serverOwner = decodedJWT.payload.username;

  let formData = {
    ServerName: ServerName,
    ServerID: crypto.randomUUID(),
    ServerOwner: serverOwner,
  };

  const response = await axios.post(
    'https://localhost:7170/api/Server/CreateServer',
    formData
  );
  console.log(response);
  let newServerElement = document.createElement('div');
  newServerElement.classList.add('servers');
  newServerElement.textContent = ServerName;

  let allServersDiv = document.querySelector('.allservers');
  allServersDiv.appendChild(newServerElement);

  inputElement.value = '';
  CloseCreationModal();
  console.log('server', formData);

  newServerElement.addEventListener('click', function () {
    document.querySelector('.secondColumn').style.display = 'none';
    document.querySelector('.lastSection').style.display = 'none';

    document.getElementById('serverDetails').style.display = 'flex';
    document.getElementById('serverDetails').querySelector('h1').textContent =
      ServerName;
  });

  document.getElementById('home').addEventListener('click', function () {
    document.querySelector('.secondColumn').style.display = 'block';
    document.querySelector('.lastSection').style.display = 'block';

    document.getElementById('serverDetails').style.display = 'none';
  });
}

async function GetServer() {
  const response =
    await axios.get(`https://localhost:7170/api/Server/GetServer?username=${JWTusername}
  `);
  console.log('server items retrived');
  console.log(response);
}
GetServer();
