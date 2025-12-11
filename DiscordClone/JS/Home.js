'use strict';
let inServerUsername = document.getElementById('inServerUsername');
let selectedServerID;
let selectedChannelID;
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
      'http://localhost:5017/api/Server/CreateServer',
      formData
    );
    const createdServer = response.data;
    let newServerElement = document.createElement('div');
    newServerElement.classList.add('servers');
    newServerElement.textContent = createdServer.serverName;
    newServerElement.addEventListener('click', async function () {
      document.querySelector('.secondColumn').style.display = 'none';
      document.querySelector('.lastSection').style.display = 'none';
      document.getElementById('serverDetails').style.display = 'flex';
      document.querySelector('.currentServerName').textContent =
        createdServer.serverName;
      selectedServerID = createdServer.serverID;
     
      await fetchServerDetails();
      startServerMessagePolling();
    });
    document.querySelector('.allservers').appendChild(newServerElement);
    inputElement.value = '';
    CloseCreationModal();
    newServerElement.click();
    document.getElementById('home').addEventListener('click', function () {
      document.querySelector('.secondColumn').style.display = 'block';
      document.querySelector('.lastSection').style.display = 'block';
      document.getElementById('serverDetails').style.display = 'none';
      
    });
  } catch (err) {
    console.log('couldnt make server:', err);
  }
}

async function GetServer() {
  try {
    const response = await axios.get(
      `http://localhost:5017/api/Server/GetServer?username=${JWTusername}`
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


        await fetchServerDetails();
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
      `http://localhost:5017/api/ServerMessages/GetServerMessages?channelId=${selectedChannelID}`
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
  window.location.href = '/Pages/LogIn.html';
}
async function ServerChat(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const messageText = formData.get('userText');

  if (!messageText.trim()) return;

  const formDataObject = {
    MessageID: crypto.randomUUID(),
    ChannelId: selectedChannelID,
    ServerName: currentServerName,
    MessagesUserSender: JWTusername,
    Date: new Date().toLocaleString().toString(),
    userText: messageText,
  };

  try {
    await axios.post(
      'http://localhost:5017/api/ServerMessages/ServerMessages',
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
      `http://localhost:5017/api/Account/AddFriend?username=${JWTusername}&friendUsername=${friendUsername}`,
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

  const myMemberEl = document.querySelector(`.viewServerAccounts div[data-username="${JWTusername}"]`);
  if (myMemberEl) {
    const icon = myMemberEl.querySelector('.voice-status-icon');
    if (icon) icon.remove();
  }


  document.querySelectorAll('.voice-user-list').forEach(el => el.remove());

  EndCall();
}
function JoinVoiceCalls() {
  sessionStorage.setItem('UserJoined', selectedServerID);

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
      `http://localhost:5017/api/Account/RemoveFriend?username=${JWTusername}&friendUsername=${friendUsername}`
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
      `http://localhost:5017/api/Account/GetFriends?username=${JWTusername}`
    );
    if (res.data === 'No Friends Added!') {
      let noFriendsTag = document.createElement('p');
      noFriendsTag.textContent = 'No Friends Added!';
      mainFriendsDiv.appendChild(noFriendsTag);
    } else {
      let friends = res.data;
      console.log('GetFriends response:', friends);
      if (Array.isArray(friends)) {
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
    }
  } catch (e) {
    console.log('private msg handling broke:', e);
  }
}
function InitWebSocket() {
  socket = new WebSocket(
    `ws://localhost:5017/api/PrivateMessageFriend/HandlePrivateWebsocket?username=${JWTusername}`
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
      `http://localhost:5017/api/PrivateMessageFriend/GetPrivateMessage?currentUsername=${JWTusername}&targetUsername=${currentFriend}`
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
      document.querySelector('.nav').style.display = 'flex';
      
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
      `http://localhost:5017/api/Server/GetInviteLink?serverId=${serverId}`
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
    let res = await fetch('http://localhost:5017/api/Server/JoinServer', {
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
        await fetchServerDetails();
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
    voiceConnection = new WebSocket('ws://localhost:5017/voice-ws');

    voiceConnection.onopen = () => {
      console.log('voice chat connected');
      const joinedServer = sessionStorage.getItem('UserJoined');
      if (joinedServer) {
        console.log(`Re-joining voice for server ${joinedServer} as ${JWTusername}`);
        voiceConnection.send(JSON.stringify({
          Type: 'join',
          ServerId: joinedServer,
          Username: JWTusername
        }));
      }
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

            document.querySelectorAll('.voice-user-list').forEach(el => el.remove());

       
            const allMemberEls = document.querySelectorAll('.viewServerAccounts div[data-username]');
            allMemberEls.forEach(el => {
              const icon = el.querySelector('.voice-status-icon');
              if (icon) icon.remove();
            });


            const firstVoiceChannel = document.querySelector('div[data-channel-type="voice"]');

            if (firstVoiceChannel && updatedUsers.length > 0) {
              const userListContainer = document.createElement('div');
              userListContainer.className = 'voice-user-list';
              userListContainer.style.marginLeft = '20px';
              userListContainer.style.marginBottom = '5px';

              updatedUsers.forEach(username => {
                const userDiv = document.createElement('div');
                userDiv.style.color = '#dbdee1';
                userDiv.style.fontSize = '12px';
                userDiv.style.padding = '2px 0';
                userDiv.style.cursor = 'pointer';
                userDiv.style.display = 'flex';
                userDiv.style.alignItems = 'center';

                const avatar = document.createElement('div');
                avatar.style.width = '20px';
                avatar.style.height = '20px';
                avatar.style.borderRadius = '50%';
                avatar.style.backgroundColor = '#5865f2'; 
                avatar.style.marginRight = '5px';
                avatar.style.backgroundImage = 'url(/assets/img/titlePic.png)';
                avatar.style.backgroundSize = 'cover';

                const nameSpan = document.createElement('span');
                nameSpan.textContent = username;

                userDiv.appendChild(avatar);
                userDiv.appendChild(nameSpan);
                userListContainer.appendChild(userDiv);

                const memberEl = document.querySelector(`.viewServerAccounts div[data-username="${username}"]`);
                if (memberEl) {
                  const icon = document.createElement('span');
                  icon.className = 'voice-status-icon';
                  icon.textContent = ' 🔊';
                  icon.style.marginLeft = 'auto';
                  icon.style.fontSize = '12px';
                  memberEl.appendChild(icon);
                }
              });

              firstVoiceChannel.after(userListContainer);
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
      logToScreen(`RX Offer from ${fromUser}`);
      try {
        let peerConnection = peerConnections.get(fromUser);

        if (peerConnection && peerConnection.signalingState !== 'stable') {
          console.log(`already connected to ${fromUser}, ignoring...`);
          return;
        }

        if (!peerConnection) {
          peerConnection = await createPeerConnection(fromUser);
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(offer)));
        logToScreen(`RX SDP: hasVideo=${offer.includes('m=video')}`);

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
      logToScreen(`RX Answer from ${fromUser}`);
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
  logToScreen(`Media for ${peerName}: Vid=${hasVideo} Aud=${hasAudio}`);


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
    v.classList.add('videos'); 
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

    const myMemberEl = document.querySelector(`.viewServerAccounts div[data-username="${JWTusername}"]`);
    if (myMemberEl) {
      const icon = myMemberEl.querySelector('.voice-status-icon');
      if (icon) icon.remove();
    }

    document.querySelectorAll('.voice-user-list').forEach(el => el.remove());

  } catch (err) {
    console.error('couldnt leave voice chat:', err);
  }
}
async function VideoOn() {
  try {
    await ensureLocalStream(true, true);
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    for (const pc of peerConnections.values()) {
      const sender = pc
        .getSenders()
        .find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(videoTrack);
      } else {
        pc.addTrack(videoTrack, localStream);
      }

      const offer = await pc.createOffer();
      logToScreen(`SDP content: hasVideo=${offer.sdp.includes('m=video')}`);
      await pc.setLocalDescription(offer);

      let targetUser = null;
      for (const [user, conn] of peerConnections.entries()) {
        if (conn === pc) {
          targetUser = user;
          break;
        }
      }

      if (targetUser && voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
        logToScreen(`VideoOn: Sending offer to ${targetUser}`);
        voiceConnection.send(JSON.stringify({
          Type: 'peer-offer',
          Data: JSON.stringify(offer),
          TargetUser: targetUser
        }));
      }
    }
  } catch (err) {
    console.error('couldnt enable video:', err);
  }
}
async function VideoOff() {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;
  try {
    videoTrack.stop();
  } catch { }
  try {
    localStream.removeTrack(videoTrack);
  } catch (e) {
    console.log('video toggle error:', e);
  }
  for (const pc of peerConnections.values()) {
    const sender = pc
      .getSenders()
      .find((s) => s.track && s.track.kind === 'video');
    if (sender) {
      try {
        sender.replaceTrack(null);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        let targetUser = null;
        for (const [user, conn] of peerConnections.entries()) {
          if (conn === pc) {
            targetUser = user;
            break;
          }
        }

        if (targetUser && voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
          voiceConnection.send(JSON.stringify({
            Type: 'peer-offer',
            Data: JSON.stringify(offer),
            TargetUser: targetUser
          }));
        }

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

function logToScreen(msg) {
  let debugConsole = document.getElementById('debugConsole');
  if (!debugConsole) {
    debugConsole = document.createElement('div');
    debugConsole.id = 'debugConsole';
    debugConsole.style.position = 'fixed';
    debugConsole.style.bottom = '0';
    debugConsole.style.left = '0';
    debugConsole.style.width = '100%';
    debugConsole.style.height = '150px';
    debugConsole.style.backgroundColor = 'rgba(0,0,0,0.8)';
    debugConsole.style.color = '#00ff00';
    debugConsole.style.overflowY = 'scroll';
    debugConsole.style.zIndex = '9999';
    debugConsole.style.fontSize = '12px';
    debugConsole.style.padding = '5px';
    debugConsole.style.pointerEvents = 'none'; 
    document.body.appendChild(debugConsole);
  }
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  debugConsole.appendChild(line);
  debugConsole.scrollTop = debugConsole.scrollHeight;
  console.log(msg);
}

async function fetchServerDetails() {
  try {
    const response = await axios.get(
      `http://localhost:5017/api/Server/GetServerDetails?serverId=${selectedServerID}`
    );
    const { categories, channels } = response.data;
    const channelsList = document.getElementById('channelsList');
    channelsList.innerHTML = '';

    const renderChannel = (channel) => {
      const channelEl = document.createElement('div');
      channelEl.dataset.channelId = channel.id;
      channelEl.dataset.channelType = channel.type;
      channelEl.style.padding = '5px 10px';
      channelEl.style.cursor = 'pointer';
      channelEl.style.color = '#8e9297';
      channelEl.style.marginLeft = '10px';
      channelEl.onmouseover = () => channelEl.style.backgroundColor = '#34373c';
      channelEl.onmouseout = () => {
        if (selectedChannelID !== channel.id) channelEl.style.backgroundColor = 'transparent';
      };

      if (channel.type === 'text') {
        channelEl.textContent = '# ' + channel.name;
        channelEl.onclick = () => {
          selectedChannelID = channel.id;
          document.querySelector('.chatHeader').textContent = '# ' + channel.name;
          fetchServerMessages();
          Array.from(channelsList.querySelectorAll('div')).forEach(d => {
            if (d.textContent.startsWith('#') || d.textContent.startsWith('🔊')) d.style.color = '#8e9297';
          });
          channelEl.style.color = 'white';
        };
      } else {
        channelEl.textContent = '🔊 ' + channel.name;
        channelEl.onclick = () => {
          selectedChannelID = channel.id;
          Array.from(channelsList.querySelectorAll('div')).forEach(d => {
            if (d.textContent.startsWith('#') || d.textContent.startsWith('🔊')) d.style.color = '#8e9297';
          });
          channelEl.style.color = 'white';
          JoinVoiceCalls();
        };
      }
      return channelEl;
    };

    categories.forEach(category => {
      const categoryEl = document.createElement('div');
      categoryEl.style.textTransform = 'uppercase';
      categoryEl.style.fontSize = '12px';
      categoryEl.style.fontWeight = 'bold';
      categoryEl.style.color = '#8e9297';
      categoryEl.style.padding = '15px 5px 5px 10px';
      categoryEl.textContent = category.name;
      channelsList.appendChild(categoryEl);

      const categoryChannels = channels.filter(c => c.categoryId === category.id);
      categoryChannels.forEach(channel => {
        channelsList.appendChild(renderChannel(channel));
      });
    });

    const uncategorized = channels.filter(c => !c.categoryId);
    if (uncategorized.length > 0) {
      uncategorized.forEach(channel => {
        channelsList.appendChild(renderChannel(channel));
      });
    }

    const firstTextChannel = channels.find(c => c.type === 'text');
    if (firstTextChannel) {
      selectedChannelID = firstTextChannel.id;
      document.querySelector('.chatHeader').textContent = '# ' + firstTextChannel.name;
      fetchServerMessages();
    }

    fetchServerMembers();

  } catch (err) {
    console.error('Failed to fetch server details:', err);
  }
}



async function fetchServerMembers() {
  try {
    const response = await axios.get(
      `http://localhost:5017/api/Server/GetServerMembers?serverId=${selectedServerID}`
    );
    const members = response.data;
    const membersList = document.querySelector('.viewServerAccounts');

    membersList.innerHTML = '<p class="serverAccounts">Members</p>';

    members.sort((a, b) => {
      if (a.role === 'owner') return -1;
      if (b.role === 'owner') return 1;
      return a.username.localeCompare(b.username);
    });

    members.forEach(member => {
      const memberEl = document.createElement('div');
      memberEl.dataset.username = member.username; 
      memberEl.style.padding = '10px';
      memberEl.style.color = member.role === 'owner' ? '#ff7b00' : '#b9bbbe';
      memberEl.style.cursor = 'pointer';
      memberEl.style.display = 'flex';
      memberEl.style.alignItems = 'center';

      const avatar = document.createElement('div');
      avatar.style.width = '32px';
      avatar.style.height = '32px';
      avatar.style.borderRadius = '50%';
      avatar.style.backgroundColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
      avatar.style.marginRight = '10px';
      avatar.style.backgroundImage = 'url(/assets/img/titlePic.png)';
      avatar.style.backgroundSize = 'cover';

      const name = document.createElement('span');
      name.textContent = member.username;

      memberEl.appendChild(avatar);
      memberEl.appendChild(name);

      membersList.appendChild(memberEl);
    });

  } catch (err) {
    console.error('Failed to fetch members:', err);
  }
}
