'use strict';
let inServerUsername = document.getElementById('inServerUsername');
let selectedServerID;
let currentServerName;
let chatMessages = document.querySelector('.chatMessages');
let userJoined = document.querySelector('.UserJoined');
let mainFriendsDiv = document.querySelector('.MainFriendsDiv');
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
let JWTusername = decodedJWT.payload.username;
username.innerHTML = JWTusername;
inServerUsername.innerHTML = JWTusername;

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

  await axios.post('https://localhost:7170/api/Server/CreateServer', formData);

  let newServerElement = document.createElement('div');
  newServerElement.classList.add('servers');
  newServerElement.textContent = ServerName;

  let allServersDiv = document.querySelector('.allservers');
  allServersDiv.appendChild(newServerElement);

  inputElement.value = '';
  CloseCreationModal();

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
  try {
    const response = await axios.get(
      `https://localhost:7170/api/Server/GetServer?username=${JWTusername}`
    );

    let serverData = response.data;

    let allServersDiv = document.querySelector('.allservers');

    serverData.forEach((server) => {
      let newServerElement = document.createElement('div');
      newServerElement.classList.add('servers');
      newServerElement.textContent = server.serverName;
      allServersDiv.appendChild(newServerElement);

      newServerElement.addEventListener('click', async function ClickServer() {
        selectedServerID = server.serverID;
        console.log(selectedServerID, 'this is selectedServerID');
        document.querySelector('.secondColumn').style.display = 'none';
        document.querySelector('.lastSection').style.display = 'none';

        document.getElementById('serverDetails').style.display = 'flex';
        document
          .getElementById('serverDetails')
          .querySelector('h1').textContent = server.serverName;
        currentServerName = server.serverName;

        chatMessages.innerHTML = '';
        userJoined.innerHTML = '';

        let getJoined = sessionStorage.getItem('UserJoined');
        if (getJoined === selectedServerID) {
          userJoined.innerHTML = JWTusername;
        }
        const messageRes = await axios.get(
          `https://localhost:7170/api/ServerMessages/GetServerMessages?serverID=${selectedServerID}`
        );

        messageRes.data.forEach((message) => {
          const UserMessageServer = document.createElement('p');
          UserMessageServer.textContent = message.userText;
          chatMessages.appendChild(UserMessageServer);
        });
      });
      console.log(server, 'this is server');
    });

    document.getElementById('home').addEventListener('click', function () {
      document.querySelector('.secondColumn').style.display = 'block';
      document.querySelector('.lastSection').style.display = 'block';
      document.getElementById('serverDetails').style.display = 'none';
    });
  } catch (e) {
    console.log(e);
  }
}

GetServer();

function LogOut() {
  document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  window.location.href = 'http://127.0.0.1:5500/Pages/LogIn.html';
}

async function ServerChat(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const formDataObject = {
    MessageID: crypto.randomUUID(),
    ServerID: selectedServerID,
    ServerName: currentServerName,
    MessagesUserSender: JWTusername,
    Date: new Date().toLocaleString().toString(),
    userText: formData.get('userText'),
  };

  formData.forEach((value, key) => {
    formDataObject[key] = value;
  });
  try {
    const res = await axios.post(
      'https://localhost:7170/api/ServerMessages/ServerMessages',
      formDataObject
    );
  } catch (e) {
    console.log(e);
  }

  const messageElement = document.createElement('p');
  messageElement.textContent = formDataObject.userText;

  chatMessages.appendChild(messageElement);

  event.target.querySelector('.chatInput').value = '';
}
function showAddFriends() {
  document.querySelector('.addFriendsDiv').style.display = 'block';
  document.querySelector('.removeFriendsDiv').style.display = 'none';
}

function clearContent() {
  document.querySelector('.addFriendsDiv').style.display = 'none';
  document.querySelector('.removeFriendsDiv').style.display = 'none';
}

async function SearchFriends(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const formDataObject = {};
  formData.forEach((value, key) => {
    formDataObject[key] = value;
  });
  let friendUsername = formDataObject.friendUsername;
  console.log(friendUsername);

  try {
    const res = await axios.post(
      `https://localhost:7170/api/Account/AddFriend?username=${JWTusername}&friendUsername=${friendUsername}`,
      formDataObject
    );
    console.log(res.data.message);
    await GetFriends();
  } catch (e) {
    console.log(e);
  }
}

function LeaveCall() {
  sessionStorage.removeItem('UserJoined');
  userJoined.innerHTML = '';
}
function JoinVoiceCalls() {
  sessionStorage.setItem('UserJoined', selectedServerID);
  let joined = sessionStorage.getItem('UserJoined');
  if (joined === selectedServerID) {
    userJoined.style.display = 'block';
    userJoined.innerHTML = JWTusername;
  }
}

function showDeleteFriend() {
  document.querySelector('.removeFriendsDiv').style.display = 'block';
  document.querySelector('.addFriendsDiv').style.display = 'none';
}

async function RemoveFriends(event) {
  event.preventDefault();
  try {
    const formData = new FormData(event.target);
    const formDataObject = {};
    formData.forEach((value, key) => {
      formDataObject[key] = value;
    });
    let friendUsername = formDataObject.friendUsername;
    await axios.post(
      `https://localhost:7170/api/Account/RemoveFriend?username=${JWTusername}&friendUsername=${friendUsername}`
    );
    await GetFriends();
  } catch (e) {
    console.log(e);
  }
}
async function GetFriends() {
  mainFriendsDiv.innerHTML = '';

  try {
    let res = await axios.get(
      `https://localhost:7170/api/Account/GetFriends?username=${JWTusername}`
    );
    console.log(res.data);

    if (res.data === 'No Friends Added!') {
      let noFriendsTag = document.createElement('p');
      noFriendsTag.textContent = 'No Friends Added!';
      mainFriendsDiv.appendChild(noFriendsTag);
    } else {
      let friends = res.data;
      friends.forEach((friend) => {
        let friendsTag = document.createElement('p');
        friendsTag.textContent = friend;
        mainFriendsDiv.appendChild(friendsTag);
      });
    }
  } catch (e) {
    console.log(e);
  }
}
GetFriends();
