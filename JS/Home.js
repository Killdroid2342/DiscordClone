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

let chatConnection = null;

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
  let inputElement = document.getElementById('serverNameInput');
  let ServerName = inputElement.value.trim();
  let ServerOwner = decodedJWT.payload.username;
  let ServerID = crypto.randomUUID();
  let formData = {
    ServerID: ServerID,
    ServerName: ServerName,
    ServerOwner: ServerOwner,
  };
  try {
    const response = await axios.post(
      'http://localhost:5018/api/Server/CreateServer',
      formData
    );
    const createdServer = response.data;
    let newServerElement = document.createElement('div');
    newServerElement.classList.add('servers');
    newServerElement.textContent = createdServer.serverName;
    newServerElement.addEventListener('click', function () {
      document.querySelector('.secondColumn').style.display = 'none';
      document.querySelector('.lastSection').style.display = 'none';
      document.getElementById('serverDetails').style.display = 'flex';
      document.querySelector('.currentServerName').textContent =
        createdServer.serverName;
      selectedServerID = createdServer.serverID;
      startActiveUserPolling();
    });
    document.querySelector('.allservers').appendChild(newServerElement);
    inputElement.value = '';
    CloseCreationModal();
    newServerElement.click();
    document.getElementById('home').addEventListener('click', function () {
      document.querySelector('.secondColumn').style.display = 'block';
      document.querySelector('.lastSection').style.display = 'block';
      document.getElementById('serverDetails').style.display = 'none';
      stopActiveUserPolling();
    });
  } catch (err) {
    console.log('couldnt make server:', err);
  }
}

async function GetServer() {
  try {
    const response = await axios.get(
      `http://localhost:5018/api/Server/GetServer?username=${JWTusername}`
    );
    let serverData = response.data;
    let allServersDiv = document.querySelector('.allservers');
    if (!Array.isArray(serverData)) {
      console.log('server response:', serverData.message || serverData);
      return;
    }

    const joinedServer = sessionStorage.getItem('UserJoined');
    let serverToSelect = null;

    serverData.forEach((server) => {
      let newServerElement = document.createElement('div');
      newServerElement.classList.add('servers');

      let serverNameSpan = document.createElement('span');
      serverNameSpan.textContent = server.serverName;

      let roleBadge = document.createElement('span');
      roleBadge.classList.add('role-badge');
      roleBadge.textContent = server.role || 'user';
      roleBadge.style.fontSize = '10px';
      roleBadge.style.padding = '2px 5px';
      roleBadge.style.borderRadius = '10px';
      roleBadge.style.marginLeft = '5px';
      roleBadge.style.display = 'inline-block';

      if (server.role === 'owner') {
        roleBadge.style.backgroundColor = '#ff7b00';
        roleBadge.style.color = 'white';
      } else {
        roleBadge.style.backgroundColor = '#3498db';
        roleBadge.style.color = 'white';
      }

      newServerElement.appendChild(serverNameSpan);
      newServerElement.appendChild(roleBadge);

      newServerElement.addEventListener('click', async function () {
        selectedServerID = server.serverID;
        document.querySelector('.secondColumn').style.display = 'none';
        document.querySelector('.lastSection').style.display = 'none';
        document.getElementById('serverDetails').style.display = 'flex';
        document
          .getElementById('serverDetails')
          .querySelector('h1').textContent =
          server.serverName + ' (' + (server.role || 'user') + ')';
        currentServerName = server.serverName;
        chatMessages.innerHTML = '';
        userJoined.innerHTML = '';
        startActiveUserPolling();

        await fetchServerMessages();
        startServerMessagePolling();
      });
      allServersDiv.appendChild(newServerElement);

      if (joinedServer && server.serverID === joinedServer) {
        serverToSelect = newServerElement;
      }
    });

    if (serverToSelect) {
      serverToSelect.click();
    }

    document
      .getElementById('home')
      .addEventListener('click', async function () {
        document.querySelector('.secondColumn').style.display = 'block';
        document.querySelector('.lastSection').style.display = 'block';
        document.getElementById('serverDetails').style.display = 'none';
        stopActiveUserPolling();
        stopServerMessagePolling();
      });
  } catch (e) {
    console.log('couldnt load servers:', e);
  }
}
GetServer();
async function fetchServerMessages() {
  try {
    const messageRes = await axios.get(
      `http://localhost:5018/api/ServerMessages/GetServerMessages?serverID=${selectedServerID}`
    );
    chatMessages.innerHTML = '';
    messageRes.data.forEach((message) => {
      const userMessageServer = document.createElement('p');
      userMessageServer.textContent = `${message.messagesUserSender}: ${message.userText} (${message.date})`;
      chatMessages.appendChild(userMessageServer);
    });
  } catch (e) {
    console.log('couldnt join server:', e);
  }
}

let serverMessageInterval = null;
function startServerMessagePolling() {
  stopServerMessagePolling();
  fetchServerMessages();
  serverMessageInterval = setInterval(fetchServerMessages, 2000);
}
function stopServerMessagePolling() {
  if (serverMessageInterval) clearInterval(serverMessageInterval);
  serverMessageInterval = null;
}
function LogOut() {
  document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  window.location.href = 'http://127.0.0.1:5500/Pages/LogIn.html';
}
async function ServerChat(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const messageText = formData.get('userText');

  if (!messageText.trim()) return;

  const formDataObject = {
    MessageID: crypto.randomUUID(),
    ServerID: selectedServerID,
    ServerName: currentServerName,
    MessagesUserSender: JWTusername,
    Date: new Date().toLocaleString().toString(),
    userText: messageText,
  };

  try {
    await axios.post(
      'http://localhost:5018/api/ServerMessages/ServerMessages',
      formDataObject
    );

    event.target.querySelector('.chatInput').value = '';
  } catch (e) {
    console.log('msg send failed:', e);
  }
}
function showAddFriends() {
  document.querySelector('.addFriendsDiv').style.display = 'block';
  document.querySelector('.removeFriendsDiv').style.display = 'none';
}
function clearContent() {
  document.querySelector('.addFriendsDiv').style.display = 'none';
  document.querySelector('.removeFriendsDiv').style.display = 'none';
  const accountElement = document.querySelector('.account');
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
  try {
    const res = await axios.post(
      `http://localhost:5018/api/Account/AddFriend?username=${JWTusername}&friendUsername=${friendUsername}`,
      formDataObject
    );
    if (res.data.message) {
      messageModalContent.innerText = res.data.message;
      messageOuterModal.style.display = 'flex';
      setTimeout(() => {
        messageOuterModal.style.display = 'none';
      }, 2000);
    }
    await GetFriends();
  } catch (e) {
    console.log('server creation broke:', e);
  }
}
function LeaveCall() {
  sessionStorage.removeItem('UserJoined');
  userJoined.innerHTML = '';
  EndCall();
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
    let res = await axios.post(
      `http://localhost:5018/api/Account/RemoveFriend?username=${JWTusername}&friendUsername=${friendUsername}`
    );
    if (res.data.message) {
      messageModalContent.innerText = res.data.message;
      messageOuterModal.style.display = 'flex';
      setTimeout(() => {
        messageOuterModal.style.display = 'none';
      }, 2000);
    }
    await GetFriends();
  } catch (e) {
    console.log('couldnt load friends:', e);
  }
}
async function GetFriends() {
  mainFriendsDiv.innerHTML = '';
  try {
    let res = await axios.get(
      `http://localhost:5018/api/Account/GetFriends?username=${JWTusername}`
    );
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
    console.log('private msg handling broke:', e);
  }
}
function InitWebSocket() {
  socket = new WebSocket(
    `ws://localhost:5018/api/PrivateMessageFriend/HandlePrivateWebsocket?username=${JWTusername}`
  );
  socket.onopen = function () {
    console.log('connected to chat');
  };
  socket.onmessage = function (event) {
    const message = JSON.parse(event.data);
    const messagesDisplay = document.querySelector('.messagesDisplay');
    const messageElement = document.createElement('p');
    messageElement.textContent = `${message.MessagesUserSender}: ${message.friendMessagesData} (${message.date})`;
    messagesDisplay.appendChild(messageElement);
  };
  socket.onclose = function () {
    console.log('chat disconnected');
  };
}
async function PrivateMessage(event) {
  event.preventDefault();
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.log('not connected to chat');
    return;
  }
  const formData = new FormData(event.target);
  const messageObject = {
    MessagesUserSender: JWTusername,
    MessageUserReciver: currentFriend,
    friendMessagesData: formData.get('friendMessagesData'),
    date: new Date().toLocaleString(),
  };
  socket.send(JSON.stringify(messageObject));
  const messagesDisplay = document.querySelector('.messagesDisplay');
  const messageElement = document.createElement('p');
  messageElement.textContent = `${JWTusername}: ${messageObject.friendMessagesData} (${messageObject.date})`;
  messagesDisplay.appendChild(messageElement);
  event.target.reset();
}
async function GetPrivateMessage() {
  try {
    const res = await axios.get(
      `http://localhost:5018/api/PrivateMessageFriend/GetPrivateMessage?currentUsername=${JWTusername}&targetUsername=${currentFriend}`
    );
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
      stopActiveUserPolling();
    });
  } catch (e) {
    console.log('ugh something went wrong with private msgs:', e);
  }
}
GetFriends();



function openJoinModal() {
  document.querySelector('.outerJoinModal').style.display = 'flex';
}
function closeJoinModal() {
  document.querySelector('.outerJoinModal').style.display = 'none';
}

async function getInviteLink(serverId) {
  try {
    let res = await fetch(
      `http://localhost:5018/api/Server/GetInviteLink?serverId=${serverId}`
    );
    if (res.ok) {
      let data = await res.json();
      navigator.clipboard.writeText(data.inviteLink);
      alert('invite link copied: ' + data.inviteLink);
    } else {
      alert('Failed to copy invite link');
    }
  } catch (err) {
    console.error('couldnt get invite link:', err);
    alert('Unable to get invite link');
  }
}


async function JoinServer(event) {
  event.preventDefault();
  let serverLink = document.getElementById('serverLinkInput').value.trim();
  try {
    let res = await fetch('http://localhost:5018/api/Server/JoinServer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Username: JWTusername,
        InviteLink: serverLink,
      }),
    });
    if (res.ok) {
      let server = await res.json();
      closeJoinModal();
      document.querySelector('.currentServerName').innerText =
        server.serverName;
      selectedServerID = server.serverID;
      currentServerName = server.serverName;

      let newServerElement = document.createElement('div');
        newServerElement.classList.add('servers');

        let serverNameSpan = document.createElement('span');
        serverNameSpan.textContent = server.serverName;

        let roleBadge = document.createElement('span');
        roleBadge.classList.add('role-badge');
        roleBadge.textContent = 'user';
        roleBadge.style.fontSize = '10px';
        roleBadge.style.padding = '2px 5px';
        roleBadge.style.borderRadius = '10px';
        roleBadge.style.marginLeft = '5px';
        roleBadge.style.display = 'inline-block';
        roleBadge.style.backgroundColor = '#3498db';
        roleBadge.style.color = 'white';

        newServerElement.appendChild(serverNameSpan);
        newServerElement.appendChild(roleBadge);

      newServerElement.addEventListener('click', async function () {
        document.querySelector('.secondColumn').style.display = 'none';
        document.querySelector('.lastSection').style.display = 'none';
        document.getElementById('serverDetails').style.display = 'flex';
        document.querySelector('.currentServerName').textContent =
          server.serverName + ' (user)';
        selectedServerID = server.serverID;
        currentServerName = server.serverName;
        chatMessages.innerHTML = '';
        userJoined.innerHTML = '';
        startActiveUserPolling();

        await fetchServerMessages();
        startServerMessagePolling();
      });
      document.querySelector('.allservers').appendChild(newServerElement);

      newServerElement.click();
    } else {
      const err = await res.json();
      alert('❌ Unable to join server: ' + (err.message || res.statusText));
    }
  } catch (err) {
    console.error('couldnt join server:', err);
    alert('Could not join server');
  }
}

async function refreshActiveUsers() {
  try {
    const joinedServer = sessionStorage.getItem('UserJoined');
    if (joinedServer === selectedServerID && !userJoined.innerHTML) {
      userJoined.style.display = 'block';
      userJoined.innerHTML = JWTusername;
    }
  } catch (err) {
    console.log('couldnt update user list:', err);
  }
}
let activeUsersInterval = null;
function startActiveUserPolling() {
  stopActiveUserPolling();
  refreshActiveUsers();
  activeUsersInterval = setInterval(refreshActiveUsers, 2000);
}
function stopActiveUserPolling() {
  if (activeUsersInterval) clearInterval(activeUsersInterval);
  activeUsersInterval = null;
}


let localStream = null;
let localVideo = document.getElementById('localVideo');
let serverPeerConnection = null;
let voiceConnection = null;
let currentVoiceUsers = [];
let peerConnections = new Map();
const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};


let globalAudioContext = null;


function enableAudioPlayback() {
  if (!globalAudioContext) {
    globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  if (globalAudioContext.state === 'suspended') {
    globalAudioContext.resume().then(() => {
      console.log('audio ready, voice should work');
      
    
      document.querySelectorAll('audio[id^="remote_"]').forEach(audio => {
        if (audio.paused) {
          audio.play().catch(err => console.log('couldnt auto play audio again:', err));
        }
      });
    });
  }
}


document.addEventListener('click', enableAudioPlayback, { once: true });
document.addEventListener('keydown', enableAudioPlayback, { once: true });
document.addEventListener('touchstart', enableAudioPlayback, { once: true });


async function initializeVoiceConnection() {
  try {
    voiceConnection = new WebSocket('ws://localhost:5018/voice-ws');

    voiceConnection.onopen = () => {
      console.log('voice chat connected');
    };

    voiceConnection.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.Type) {
          case 'user-joined':
            console.log(`${message.Username} joined voice chat`);

            if (JWTusername < message.Username) {
              try {
                const peerConnection = await createPeerConnection(message.Username);
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                
                if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
                  voiceConnection.send(JSON.stringify({
                    Type: 'peer-offer',
                    Data: JSON.stringify(offer),
                    TargetUser: message.Username
                  }));
                }
              } catch (err) {
                console.error('couldnt connect to new user:', err);
              }
            }
            break;

          case 'user-left':
            console.log(`${message.Username} left the voice channel`);
            removePeerUI(message.Username);
            
            const peerConnection = peerConnections.get(message.Username);
            if (peerConnection) {
              peerConnection.close();
              peerConnections.delete(message.Username);
            }
            break;

          case 'existing-users':
            const users = JSON.parse(message.Data);
            console.log('users already in voice chat:', users);
            currentVoiceUsers = users;

            if (!serverPeerConnection && users.length > 0) {
              await establishServerConnection();
            }

            for (const existingUser of users) {
              if (existingUser !== JWTusername && JWTusername < existingUser) {
                try {
                  const peerConnection = await createPeerConnection(existingUser);
                  const offer = await peerConnection.createOffer();
                  await peerConnection.setLocalDescription(offer);
                  
                  if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
                    voiceConnection.send(JSON.stringify({
                      Type: 'peer-offer',
                      Data: JSON.stringify(offer),
                      TargetUser: existingUser
                    }));
                  }
                } catch (err) {
                  console.error(`Failed to connect to ${existingUser}:`, err);
                }
              }
            }
            break;

          case 'users-updated':
            const updatedUsers = JSON.parse(message.Data);
            console.log('voice channel updated:', updatedUsers);

            let voiceUsersList = document.getElementById('voiceUsersList');
            if (!voiceUsersList) {
                      voiceUsersList = document.createElement('div');
              voiceUsersList.id = 'voiceUsersList';
              voiceUsersList.style.marginTop = '10px';
              voiceUsersList.style.padding = '10px';
              voiceUsersList.style.backgroundColor = '#2c2f33';
              voiceUsersList.style.borderRadius = '5px';

              const userJoinedElement = document.querySelector('.UserJoined');
              if (userJoinedElement && userJoinedElement.parentNode) {
                userJoinedElement.parentNode.insertBefore(
                  voiceUsersList,
                  userJoinedElement.nextSibling
                );
              }
            }


            voiceUsersList.innerHTML = '<b style="color: #7289da;">🔊 Voice Chat:</b>';
            if (updatedUsers.length === 0) {
              const emptyMsg = document.createElement('div');
              emptyMsg.style.color = '#72767d';
              emptyMsg.style.fontStyle = 'italic';
              emptyMsg.textContent = 'No users in voice chat';
              voiceUsersList.appendChild(emptyMsg);
            } else {
              updatedUsers.forEach((username) => {
                const userDiv = document.createElement('div');
                userDiv.style.color = '#ffffff';
                userDiv.style.padding = '2px 0';
                userDiv.textContent = `🎤 ${username}`;
                voiceUsersList.appendChild(userDiv);
              });
            }
            break;

          case 'server-offer':
            await handleServerOffer(message.Data);
            break;

          case 'server-answer':
            await handleServerAnswer(message.Data);
            break;

          case 'server-ice-candidate':
            await handleServerIceCandidate(message.Data);
            break;

          case 'peer-offer':
            await handlePeerOffer(message.Username, message.Data);
            break;

          case 'peer-answer':
            await handlePeerAnswer(message.Username, message.Data);
            break;

          case 'peer-ice-candidate':
            await handlePeerIceCandidate(message.Username, message.Data);
            break;

          case 'audio-data':
            await handleIncomingAudio(message.Username, message.Data);
            break;
        }
      } catch (err) {
        console.error('couldnt process voice msg:', err);
      }
    };

    voiceConnection.onerror = (error) => {
      console.error('voice connection broke:', error);
    };

    voiceConnection.onclose = () => {
      console.log('voice disconnected');
    };


    async function handleServerOffer(offer) {
      console.log('got connection offer from server');
      if (!serverPeerConnection) {
        await createServerPeerConnection();
      }

      await serverPeerConnection.setRemoteDescription(
        new RTCSessionDescription(JSON.parse(offer))
      );
      const answer = await serverPeerConnection.createAnswer();
      await serverPeerConnection.setLocalDescription(answer);

      if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
        voiceConnection.send(
          JSON.stringify({
            Type: 'server-answer',
            Data: JSON.stringify(answer),
          })
        );
      }
    }

    async function handleServerAnswer(answer) {
      console.log('got connection response from server');
      if (serverPeerConnection) {
        await serverPeerConnection.setRemoteDescription(
          new RTCSessionDescription(JSON.parse(answer))
        );
      }
    }

    async function handleServerIceCandidate(candidate) {
      console.log('got network info from server');
      if (serverPeerConnection) {
        try {
          await serverPeerConnection.addIceCandidate(
            new RTCIceCandidate(JSON.parse(candidate))
          );
        } catch (e) {
          console.warn('couldnt process server network info:', e);
        }
      }
    }

    async function handleIncomingAudio(fromUser, audioData) {
  
      console.log(`receiving audio from ${fromUser}`);
      try {
    
        const audioBuffer = atob(audioData);
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = audioContext.createBuffer(1, audioBuffer.length, 48000);
        const channelData = buffer.getChannelData(0);
        
        for (let i = 0; i < audioBuffer.length; i++) {
          channelData[i] = (audioBuffer.charCodeAt(i) - 128) / 128.0;
        }
        
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
      } catch (err) {
        console.error('couldnt play incoming audio:', err);
      }
    }


    async function handlePeerOffer(fromUser, offer) {
      console.log(`${fromUser} wants to connect`);
      try {
        let peerConnection = peerConnections.get(fromUser);
        
        if (peerConnection && peerConnection.signalingState !== 'stable') {
          console.log(`already connected to ${fromUser}, ignoring...`);
          return;
        }

        if (!peerConnection || peerConnection.signalingState === 'stable') {
          peerConnection = await createPeerConnection(fromUser);
        }
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(offer)));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
          voiceConnection.send(JSON.stringify({
            Type: 'peer-answer',
            Data: JSON.stringify(answer),
            TargetUser: fromUser
          }));
        }
      } catch (err) {
        console.error('couldnt handle connection request:', err);
      }
    }
    
    async function handlePeerAnswer(fromUser, answer) {
      console.log(`connection response from ${fromUser}`);
      try {
        const peerConnection = peerConnections.get(fromUser);
        if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(answer)));
        } else {
          console.log(`connection with ${fromUser} already established, ignoring response`);
        }
      } catch (err) {
        console.error('couldnt handle connection response:', err);
      }
    }
    
    async function handlePeerIceCandidate(fromUser, candidate) {
      console.log(`network info from ${fromUser}`);
      try {
        const peerConnection = peerConnections.get(fromUser);
        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)));
        }
      } catch (err) {
        console.error('couldnt process network info:', err);
      }
    }
    
    async function createPeerConnection(userId) {
      console.log(`connecting to ${userId}`);
      
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
   
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
      }
      
   
      peerConnection.ontrack = (event) => {
        console.log(`hearing ${userId} now`);
        const remoteStream = event.streams[0];
        createRemoteMediaElement(userId, remoteStream);
      };
      
   
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
          voiceConnection.send(JSON.stringify({
            Type: 'peer-ice-candidate',
            Data: JSON.stringify(event.candidate),
            TargetUser: userId
          }));
        }
      };
      
    
      peerConnection.onconnectionstatechange = () => {
        console.log(`connection with ${userId}: ${peerConnection.connectionState}`);
        if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
          peerConnections.delete(userId);
          removePeerUI(userId);
        }
      };
      
      peerConnections.set(userId, peerConnection);
      return peerConnection;
    }

    console.log('voice chat system ready');
  } catch (err) {
    console.error('voice chat connection failed:', err);
  }
}


function createRemoteMediaElement(peerName, stream) {
  let existing = document.getElementById('remote_' + peerName);
  if (existing) existing.remove();
  const hasVideo = stream.getVideoTracks().length > 0;
  const hasAudio = stream.getAudioTracks().length > 0;

  console.log(
    `Creating remote media for ${peerName}: video=${hasVideo}, audio=${hasAudio}`
  );
  

  stream.getTracks().forEach((track, i) => {
    console.log(`Stream track ${i} for ${peerName}: enabled=${track.enabled}, readyState=${track.readyState}, kind=${track.kind}`);
  });


  const isOwnStream = peerName === JWTusername;
  if (isOwnStream) {
    console.log(`muting your own voice to prevent echo from ${peerName}`);
    return null;
  }

  if (hasVideo) {
    const v = document.createElement('video');
    v.id = 'remote_' + peerName;
    v.autoplay = true;
    v.playsInline = true;
    v.srcObject = stream;
    v.width = 240;
    document.querySelector('.videoBox').appendChild(v);
    return v;
  } else {
    const a = document.createElement('audio');
    a.id = 'remote_' + peerName;
    a.autoplay = true;
    a.srcObject = stream;
    a.style.display = 'none';
    a.volume = 1.0;
    a.muted = false;
    
    if (globalAudioContext && globalAudioContext.state === 'suspended') {
      globalAudioContext.resume().then(() => {
        console.log(`Audio system activated for ${peerName}`);
      });
    } else if (!globalAudioContext) {
      enableAudioPlayback();
    }
    
    a.addEventListener('loadedmetadata', () => {
      console.log(`Audio ready for ${peerName}`);
    });
    a.addEventListener('canplay', () => {
      console.log(`Audio playback ready for ${peerName}`);
 
      a.play().then(() => {
        console.log(`can hear ${peerName} now`);
        console.log(`Audio status for ${peerName}: paused=${a.paused}, muted=${a.muted}, volume=${a.volume}`);
        

        setTimeout(() => {
          console.log(`audio check for ${peerName}: currentTime=${a.currentTime}, duration=${a.duration}`);
          if (a.currentTime === 0) {
            console.warn(`${peerName} audio might not be working, no sound detected`);
          }
        }, 1000);
      }).catch(err => {
        console.error(`cannot hear ${peerName}:`, err);

        document.addEventListener('click', () => {
          a.play().catch(e => console.error(`Still cannot hear ${peerName}:`, e));
        }, { once: true });
      });
    });
    a.addEventListener('error', (e) => {
      console.error(`audio broke for ${peerName}:`, e);
    });
    
    document.body.appendChild(a);
    console.log(`audio working with ${peerName}`);
    return a;
  }
}
function removePeerUI(peerName) {
  let el = document.getElementById('remote_' + peerName);
  if (el) el.remove();
}

async function createServerPeerConnection() {
  if (serverPeerConnection) {
    serverPeerConnection.close();
  }

  serverPeerConnection = new RTCPeerConnection(config);


  if (localStream) {
    for (const track of localStream.getTracks()) {
      serverPeerConnection.addTrack(track, localStream);
    }
  }


  serverPeerConnection.ontrack = (event) => {
    const stream = event.streams[0];
    console.log('getting audio from server');
    createRemoteMediaElement('server-mixed', stream);
  };


  serverPeerConnection.onicecandidate = (event) => {
    if (
      event.candidate &&
      voiceConnection &&
      voiceConnection.readyState === WebSocket.OPEN
    ) {
      voiceConnection.send(
        JSON.stringify({
          Type: 'server-ice-candidate',
          Data: JSON.stringify(event.candidate),
        })
      );
    }
  };

  
  serverPeerConnection.onconnectionstatechange = () => {
    console.log(
      'Server connection state:',
      serverPeerConnection.connectionState
    );
    if (
      serverPeerConnection.connectionState === 'failed' ||
      serverPeerConnection.connectionState === 'closed' ||
      serverPeerConnection.connectionState === 'disconnected'
    ) {
      console.log('lost connection to server, trying to reconnect');
      setTimeout(() => establishServerConnection(), 2000);
    }
  };

  return serverPeerConnection;
}

async function establishServerConnection() {
  try {
    console.log('connecting to voice server');
    await createServerPeerConnection();

 
    const offer = await serverPeerConnection.createOffer();
    await serverPeerConnection.setLocalDescription(offer);

    if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
      voiceConnection.send(
        JSON.stringify({
          Type: 'server-offer',
          Data: JSON.stringify(offer),
        })
      );
    }
  } catch (err) {
    console.error('couldnt connect to voice server:', err);
  }
}

async function ensureLocalStream(wantAudio = true, wantVideo = false) {
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: wantAudio,
      video: wantVideo,
    });
    localVideo.srcObject = localStream;
    localVideo.muted = true;
    
    if (wantAudio) {
      let localAudio = document.getElementById('localAudio');
      if (!localAudio) {
        localAudio = document.createElement('audio');
        localAudio.id = 'localAudio';
        localAudio.autoplay = true;
        localAudio.volume = 0.3;
        localAudio.srcObject = localStream;
        localAudio.muted = false;
        
        localAudio.addEventListener('loadedmetadata', () => {
          console.log('your microphone is ready');
        });
        localAudio.addEventListener('canplay', () => {
          console.log('audio system ready');
          localAudio.play().then(() => {
            console.log('your microphone is now active');
          }).catch(err => {
          console.error('couldnt turn on mic:', err);

            document.addEventListener('click', () => {
              localAudio.play().then(() => {
                console.log('mic working now after clicking');
              }).catch(e => console.error('mic still not working:', e));
            }, { once: true });
          });
        });
        localAudio.addEventListener('error', (e) => {
          console.error('microphone error:', e);
        });
        
        document.body.appendChild(localAudio);
        console.log('microphone monitoring enabled');
      }
    }
    return;
  }
  if (wantVideo && localStream.getVideoTracks().length === 0) {
    const vs = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoTrack = vs.getVideoTracks()[0];
    localStream.addTrack(videoTrack);
    localVideo.srcObject = localStream;
    localVideo.muted = true;
  }
}
async function JoinVoiceCalls() {
  try {
    if (!selectedServerID) {
      console.error('please select a server first before joining voice chat');
      return;
    }


    if (sessionStorage.getItem('UserJoined') === selectedServerID) {
      console.log('you are already in this voice channel');
      return;
    }


    if (!voiceConnection || voiceConnection.readyState !== WebSocket.OPEN) {
      console.log('setting up voice connection');
      await initializeVoiceConnection();
    }


    await ensureLocalStream(true, false);


    if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
      voiceConnection.send(
        JSON.stringify({
          Type: 'join',
          ServerId: selectedServerID,
          Username: JWTusername,
        })
      );
      console.log(`joined voice in server: ${selectedServerID}`);
    }


    await establishServerConnection();


    sessionStorage.setItem('UserJoined', selectedServerID);
    userJoined.style.display = 'block';
    userJoined.innerHTML = JWTusername;
  } catch (err) {
    console.error('couldnt join voice chat:', err);
  }
}
async function LeaveCall() {
  try {
    if (!selectedServerID) {
      console.error('cant leave voice, no server picked');
      return;
    }


    if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
      voiceConnection.send(
        JSON.stringify({
          Type: 'leave',
          ServerId: selectedServerID,
          Username: JWTusername,
        })
      );
      console.log(`left voice in server: ${selectedServerID}`);
    }


    if (serverPeerConnection) {
      try {
        serverPeerConnection.close();
        serverPeerConnection = null;
      } catch (err) {
        console.error('problem disconnecting from voice server:', err);
      }
    }


    const remotes = Array.from(document.querySelectorAll('[id^="remote_"]'));
    remotes.forEach((el) => el.remove());


    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    if (localVideo) localVideo.srcObject = null;
    
    const localAudio = document.getElementById('localAudio');
    if (localAudio) {
      localAudio.remove();
      console.log('microphone monitoring disabled');
    }


    sessionStorage.removeItem('UserJoined');
    userJoined.innerHTML = '';
    userJoined.style.display = 'none';
  } catch (err) {
    console.error('couldnt leave voice chat:', err);
  }
}
async function VideoOn() {
  try {
    await ensureLocalStream(true, true);
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    for (const pc of Object.values(peers)) {
      const sender = pc
        .getSenders()
        .find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(videoTrack);
      } else {
        pc.addTrack(videoTrack, localStream);
      }
    }
  } catch (err) {
    console.error('couldnt enable video:', err);
  }
}
function VideoOff() {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;
  try {
    videoTrack.stop();
  } catch {}
  try {
    localStream.removeTrack(videoTrack);
  } catch (e) {
    console.log('video toggle error:', e);
  }
  for (const pc of Object.values(peers)) {
    const sender = pc
      .getSenders()
      .find((s) => s.track && s.track.kind === 'video');
    if (sender) {
      try {
        sender.replaceTrack(null);
      } catch (e) {
        console.warn('couldnt disable video track:', e);
      }
    }
  }
  if (localVideo) localVideo.srcObject = localStream;
}
function MuteAudio() {
  if (!localStream) return;
  for (const track of localStream.getAudioTracks()) {
    track.enabled = false;
  }

  const localAudio = document.getElementById('localAudio');
  if (localAudio) {
    localAudio.muted = true;
    console.log('mic is muted now');
  }
}
function UnmuteAudio() {
  if (!localStream) return;
  for (const track of localStream.getAudioTracks()) {
    track.enabled = true;
  }

  const localAudio = document.getElementById('localAudio');
  if (localAudio) {
    localAudio.muted = false;
    console.log('your microphone is now unmuted');
  }
}
window.JoinVoiceCalls = JoinVoiceCalls;
window.LeaveCall = LeaveCall;
window.VideoOn = VideoOn;
window.VideoOff = VideoOff;
window.MuteAudio = MuteAudio;
window.UnmuteAudio = UnmuteAudio;
