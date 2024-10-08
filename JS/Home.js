'use strict';
let inServerUsername = document.getElementById('inServerUsername');
let selectedServerID;
let currentServerName;
let currentFriend;
let chatMessages = document.querySelector('.chatMessages');
let userJoined = document.querySelector('.UserJoined');
let mainFriendsDiv = document.querySelector('.MainFriendsDiv');
let directMessageUser = document.querySelector('.messageUser');
document.getElementById('serverDetails').style.display = 'none';
const messageModalContent = document.querySelector('.ContentMessage');
const messageOuterModal = document.querySelector('.outerModalMessage');
const username = document.getElementById('username');
let socket;
function GetCookieToken(name) {
  let value = '; ' + document.cookie;
  let parts = value.split('; ' + name + '=');
  if (parts.length == 2) return parts.pop().split(';').shift();
}

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
          await startCall();
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

  const accountElement = document.querySelector('.account');
  // temp solution
  accountElement.style.marginTop = '668px';
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
    console.log(res, 'ADD FRIEND');
    console.log(res.data.message);

    if (res.data.message) {
      messageModalContent.innerText = res.data.message;

      messageOuterModal.style.display = 'flex';

      setTimeout(() => {
        messageOuterModal.style.display = 'none';
      }, 2000);
    }
    await GetFriends();
  } catch (e) {
    console.log(e);
  }
}

function LeaveCall() {
  sessionStorage.removeItem('UserJoined');
  userJoined.innerHTML = '';
  EndCall();
  // REMOVE THE VOICE CHATS HERE
}
function JoinVoiceCalls() {
  sessionStorage.setItem('UserJoined', selectedServerID);
  let joined = sessionStorage.getItem('UserJoined');
  if (joined === selectedServerID) {
    userJoined.style.display = 'block';
    userJoined.innerHTML = JWTusername;
  }
  startCall();
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
    let res = await axios.post(
      `https://localhost:7170/api/Account/RemoveFriend?username=${JWTusername}&friendUsername=${friendUsername}`
    );
    console.log(res, 'REMOVE FRIENDS');
    if (res.data.message) {
      messageModalContent.innerText = res.data.message;
      messageOuterModal.style.display = 'flex';

      setTimeout(() => {
        messageOuterModal.style.display = 'none';
      }, 2000);
    }
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
        friendsTag.addEventListener('click', async () => {
          console.log(friend, 'name clicked');
          currentFriend = friend;
          InitWebSocket();
          await GetPrivateMessage();
          document.querySelector('.nav').style.display = 'none';
          document.querySelector('.privateMessage').style.display = 'block';
          directMessageUser.innerText = currentFriend;
        });
        mainFriendsDiv.appendChild(friendsTag);
      });
    }
  } catch (e) {
    console.log(e);
  }
}
// async function PrivateMessage(event) {
//   event.preventDefault();
//   try {
//     const formData = new FormData(event.target);
//     const formDataObject = {
//       messageUserReciver: currentFriend,
//       messagesUserSender: JWTusername,
//       date: new Date().toLocaleString().toString(),
//     };

//     formData.forEach((value, key) => {
//       formDataObject[key] = value;
//     });
//     console.log(formDataObject, 'this is formdataobject');

//     const response = await axios.post(
//       'https://localhost:7170/api/PrivateMessageFriend/SendPrivateMessage',
//       formDataObject
//     );
//     console.log(response);

//     const messagesDisplay = document.querySelector('.messagesDisplay');
//     const messageText = formDataObject.friendMessagesData;
//     const messageElement = document.createElement('p');
//     messageElement.textContent = `${JWTusername}: ${messageText} (${formDataObject.date})`;
//     messagesDisplay.appendChild(messageElement);

//     event.target.reset();
//   } catch (e) {
//     console.log(e);
//   }
// }
function InitWebSocket() {
  socket = new WebSocket(
    `wss://localhost:7170/api/PrivateMessageFriend/HandlePrivateWebsocket?username=${JWTusername}`
  );
  console.log(socket);

  socket.onopen = function () {
    console.log('WebSocket connected.');
  };

  socket.onmessage = function (event) {
    const message = JSON.parse(event.data);

    const messagesDisplay = document.querySelector('.messagesDisplay');
    const messageElement = document.createElement('p');
    messageElement.textContent = `${message.MessagesUserSender}: ${message.friendMessagesData} (${message.date})`;
    messagesDisplay.appendChild(messageElement);
  };

  socket.onclose = function () {
    console.log('WebSocket disconnected.');
  };
}

async function PrivateMessage(event) {
  event.preventDefault();

  // Ensure that WebSocket is connected
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.log('WebSocket is not connected.');
    return;
  }

  const formData = new FormData(event.target);
  const messageObject = {
    MessagesUserSender: JWTusername,
    MessageUserReciver: currentFriend,
    friendMessagesData: formData.get('friendMessagesData'),
    date: new Date().toLocaleString(),
  };

  // Send the message via WebSocket
  socket.send(JSON.stringify(messageObject));

  // Optionally, display the message locally
  const messagesDisplay = document.querySelector('.messagesDisplay');
  const messageElement = document.createElement('p');
  messageElement.textContent = `${JWTusername}: ${messageObject.friendMessagesData} (${messageObject.date})`;
  messagesDisplay.appendChild(messageElement);

  event.target.reset();
}
async function GetPrivateMessage() {
  try {
    const res = await axios.get(
      `https://localhost:7170/api/PrivateMessageFriend/GetPrivateMessage?currentUsername=${JWTusername}&targetUsername=${currentFriend}`
    );
    console.log(res);

    const messagesDisplay = document.querySelector('.messagesDisplay');
    messagesDisplay.innerHTML = '';

    res.data.forEach((message) => {
      const messageElement = document.createElement('p');
      const sender = message.messagesUserSender;
      const text = message.friendMessagesData;
      const date = message.date;

      messageElement.textContent = `${sender}: ${text} (${date})`;
      messagesDisplay.appendChild(messageElement);
    });
    document.getElementById('home').addEventListener('click', function () {
      document.querySelector('.secondColumn').style.display = 'block';
      document.querySelector('.lastSection').style.display = 'block';
      document.getElementById('serverDetails').style.display = 'none';
      document.querySelector('.privateMessage').style.display = 'none';
      document.querySelector('.nav').style.display = 'flex';
    });
  } catch (e) {
    console.log(e);
  }
}
GetFriends();
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
////////////////////VIDEO CHAT////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let peerConnection;
const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

async function startStream(videoEnabled, audioEnabled) {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: videoEnabled,
    audio: audioEnabled,
  });
  localVideo.srcObject = localStream;

  peerConnection = new RTCPeerConnection(config);

  localStream
    .getTracks()
    .forEach((track) => peerConnection.addTrack(track, localStream));

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  console.log(offer, 'this is the offer');
  await fetch(`https://localhost:7170/api/Signaling/PostOffer/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'user1', data: JSON.stringify(offer) }),
  });
}

async function startCall() {
  await startStream(false, true);
}

async function VideoOn() {
  await startStream(true, true);
}

async function VideoOff() {
  await startStream(false, true);
}

async function EndCall() {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  localVideo.srcObject = null;

  console.log('Call ended');
}

window.startCall = startCall;
