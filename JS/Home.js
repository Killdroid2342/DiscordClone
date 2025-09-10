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
      'https://localhost:7170/api/Server/CreateServer',
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
    console.log('failed', err);
  }
}

async function GetServer() {
  try {
    const response = await axios.get(
      `https://localhost:7170/api/Server/GetServer?username=${JWTusername}`
    );
    let serverData = response.data;
    let allServersDiv = document.querySelector('.allservers');
    if (!Array.isArray(serverData)) {
      console.log(serverData.message || serverData);
      return;
    }
    serverData.forEach((server) => {
      let newServerElement = document.createElement('div');
      newServerElement.classList.add('servers');
      newServerElement.textContent = server.serverName;
      newServerElement.addEventListener('click', async function () {
        selectedServerID = server.serverID;
        document.querySelector('.secondColumn').style.display = 'none';
        document.querySelector('.lastSection').style.display = 'none';
        document.getElementById('serverDetails').style.display = 'flex';
        document
          .getElementById('serverDetails')
          .querySelector('h1').textContent = server.serverName;
        currentServerName = server.serverName;
        chatMessages.innerHTML = '';
        userJoined.innerHTML = '';
        startActiveUserPolling();

        await fetchServerMessages();
        startServerMessagePolling();
      });
      allServersDiv.appendChild(newServerElement);
    });
    document.getElementById('home').addEventListener('click', function () {
      document.querySelector('.secondColumn').style.display = 'block';
      document.querySelector('.lastSection').style.display = 'block';
      document.getElementById('serverDetails').style.display = 'none';
      stopActiveUserPolling();
      stopServerMessagePolling();
    });
  } catch (e) {
    console.log(e);
  }
}
GetServer();
async function fetchServerMessages() {
  try {
    const messageRes = await axios.get(
      `https://localhost:7170/api/ServerMessages/GetServerMessages?serverID=${selectedServerID}`
    );
    chatMessages.innerHTML = '';
    messageRes.data.forEach((message) => {
      const userMessageServer = document.createElement('p');
      userMessageServer.textContent = `${message.messagesUserSender}: ${message.userText} (${message.date})`;
      chatMessages.appendChild(userMessageServer);
    });
  } catch (e) {
    console.log(e);
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
  const formDataObject = {
    MessageID: crypto.randomUUID(),
    ServerID: selectedServerID,
    ServerName: currentServerName,
    MessagesUserSender: JWTusername,
    Date: new Date().toLocaleString().toString(),
    userText: formData.get('userText'),
  };
  try {
    await axios.post(
      'https://localhost:7170/api/ServerMessages/ServerMessages',
      formDataObject
    );
    const messageElement = document.createElement('p');
    messageElement.textContent = `${JWTusername}: ${formDataObject.userText} (${formDataObject.Date})`;
    chatMessages.appendChild(messageElement);
    event.target.querySelector('.chatInput').value = '';
  } catch (e) {
    console.log(e);
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
      `https://localhost:7170/api/Account/AddFriend?username=${JWTusername}&friendUsername=${friendUsername}`,
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
    console.log(e);
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
      `https://localhost:7170/api/Account/RemoveFriend?username=${JWTusername}&friendUsername=${friendUsername}`
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
    console.log(e);
  }
}
async function GetFriends() {
  mainFriendsDiv.innerHTML = '';
  try {
    let res = await axios.get(
      `https://localhost:7170/api/Account/GetFriends?username=${JWTusername}`
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
    console.log(e);
  }
}
function InitWebSocket() {
  socket = new WebSocket(
    `wss://localhost:7170/api/PrivateMessageFriend/HandlePrivateWebsocket?username=${JWTusername}`
  );
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
      `https://localhost:7170/api/PrivateMessageFriend/GetPrivateMessage?currentUsername=${JWTusername}&targetUsername=${currentFriend}`
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
    console.log(e);
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
      `https://localhost:7170/api/Server/GetInviteLink?serverId=${serverId}`
    );
    if (res.ok) {
      let data = await res.json();
      navigator.clipboard.writeText(data.inviteLink);
      alert(' link copied: ' + data.inviteLink);
    } else {
      alert(' invite link');
    }
  } catch (err) {
    console.error('Error fetching invite link:', err);
    alert('Error fetching invite link');
  }
}

// JOIN SERVER and update sidebar
async function JoinServer(event) {
  event.preventDefault();
  let serverLink = document.getElementById('serverLinkInput').value.trim();
  try {
    let res = await fetch('https://localhost:7170/api/Server/JoinServer', {
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

      // Add to sidebar
      let newServerElement = document.createElement('div');
      newServerElement.classList.add('servers');
      newServerElement.textContent = server.serverName;
      newServerElement.addEventListener('click', function () {
        document.querySelector('.secondColumn').style.display = 'none';
        document.querySelector('.lastSection').style.display = 'none';
        document.getElementById('serverDetails').style.display = 'flex';
        document.querySelector('.currentServerName').textContent =
          server.serverName;
        selectedServerID = server.serverID;
        startActiveUserPolling();
      });
      document.querySelector('.allservers').appendChild(newServerElement);
      newServerElement.click(); // Optionally auto-switch
    } else {
      const err = await res.json();
      alert('❌ Could not join server: ' + (err.message || res.statusText));
    }
  } catch (err) {
    console.error('Error joining server:', err);
    alert('Error joining server');
  }
}

// ---- Real-time active users block ----
async function refreshActiveUsers() {
  try {
    if (!selectedServerID) return;
    let response = await fetch(
      `https://localhost:7170/api/Signaling/GetActiveUsers?serverId=${encodeURIComponent(
        selectedServerID
      )}`
    );
    if (response.ok) {
      let users = await response.json(); // array of usernames
      let userListDiv = document.getElementById('activeUsersList');
      userListDiv.innerHTML = '<b>Active Users:</b>';
      users.forEach((name) => {
        let p = document.createElement('p');
        p.textContent = name;
        userListDiv.appendChild(p);
      });
    }
  } catch (err) {
    console.log('Failed to refresh active users', err);
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

// ---- Video chat (kept same as your source) ----
const API_BASE = 'https://localhost:7170/api/Signaling';
let localStream = null;
let localVideo = document.getElementById('localVideo'); // local preview
let peers = {};
let pendingCandidates = {};
let signalingInterval = null;
let usersInterval = null;
const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function normalizeMsgFields(msg) {
  return {
    type: msg.type ?? msg.Type,
    from: msg.from ?? msg.From,
    data: msg.data ?? msg.Data,
  };
}
function createRemoteMediaElement(peerName, stream) {
  let existing = document.getElementById('remote_' + peerName);
  if (existing) existing.remove();
  const hasVideo = stream.getVideoTracks().length > 0;
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
    document.body.appendChild(a);
    return a;
  }
}
function removePeerUI(peerName) {
  let el = document.getElementById('remote_' + peerName);
  if (el) el.remove();
}
async function sendMessageToServer(message, toUser) {
  const payload = {
    Type: message.Type ?? message.type,
    From: message.From ?? message.from,
    Data: message.Data ?? message.data,
  };
  const url = `${API_BASE}/SendMessage?serverId=${encodeURIComponent(
    selectedServerID
  )}&toUser=${encodeURIComponent(toUser)}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
async function receiveMessagesFromServer() {
  const url = `${API_BASE}/ReceiveMessages?serverId=${encodeURIComponent(
    selectedServerID
  )}&username=${encodeURIComponent(JWTusername)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}
async function joinVoiceOnServer() {
  const url = `${API_BASE}/JoinVoice?serverId=${encodeURIComponent(
    selectedServerID
  )}&username=${encodeURIComponent(JWTusername)}`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) return [];
  return res.json();
}
async function leaveVoiceOnServer() {
  const url = `${API_BASE}/LeaveVoice?serverId=${encodeURIComponent(
    selectedServerID
  )}&username=${encodeURIComponent(JWTusername)}`;
  await fetch(url, { method: 'POST' });
}
async function getActiveUsersFromServer() {
  const url = `${API_BASE}/GetActiveUsers?serverId=${encodeURIComponent(
    selectedServerID
  )}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}
function ensurePeerExists(peerName) {
  if (peers[peerName]) return peers[peerName];
  const pc = new RTCPeerConnection(config);
  if (localStream) {
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }
  }
  pc.ontrack = (event) => {
    const stream = event.streams[0];
    createRemoteMediaElement(peerName, stream);
  };
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendMessageToServer(
        {
          Type: 'ice',
          From: JWTusername,
          Data: JSON.stringify(event.candidate),
        },
        peerName
      ).catch(console.error);
    }
  };
  pc.onconnectionstatechange = () => {
    if (
      pc.connectionState === 'failed' ||
      pc.connectionState === 'closed' ||
      pc.connectionState === 'disconnected'
    ) {
      if (peers[peerName]) {
        peers[peerName].close();
        delete peers[peerName];
      }
      removePeerUI(peerName);
    }
  };
  peers[peerName] = pc;
  pendingCandidates[peerName] = pendingCandidates[peerName] || [];
  return pc;
}
async function callUser(peerName) {
  if (peerName === JWTusername) return;
  const pc = ensurePeerExists(peerName);
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendMessageToServer(
      { Type: 'offer', From: JWTusername, Data: JSON.stringify(offer) },
      peerName
    );
  } catch (err) {
    console.error('callUser error', err);
  }
}
async function processIncomingMessages() {
  try {
    const messages = await receiveMessagesFromServer();
    for (const raw of messages) {
      const msg = normalizeMsgFields(raw);
      if (!msg.type || !msg.from) continue;
      if (msg.type === 'offer') {
        const pc = ensurePeerExists(msg.from);
        const remoteDesc = new RTCSessionDescription(JSON.parse(msg.data));
        await pc.setRemoteDescription(remoteDesc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendMessageToServer(
          { Type: 'answer', From: JWTusername, Data: JSON.stringify(answer) },
          msg.from
        );
        if (pendingCandidates[msg.from] && pendingCandidates[msg.from].length) {
          for (const cand of pendingCandidates[msg.from]) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(cand)));
            } catch (e) {
              console.warn('failed adding pending candidate', e);
            }
          }
          pendingCandidates[msg.from] = [];
        }
      } else if (msg.type === 'answer') {
        if (!peers[msg.from]) ensurePeerExists(msg.from);
        try {
          await peers[msg.from].setRemoteDescription(
            new RTCSessionDescription(JSON.parse(msg.data))
          );
        } catch (e) {
          console.warn('setRemoteDescription(answer) failed', e);
        }
      } else if (msg.type === 'ice') {
        if (peers[msg.from]) {
          try {
            await peers[msg.from].addIceCandidate(
              new RTCIceCandidate(JSON.parse(msg.data))
            );
          } catch (e) {
            console.warn('addIceCandidate failed', e);
          }
        } else {
          pendingCandidates[msg.from] = pendingCandidates[msg.from] || [];
          pendingCandidates[msg.from].push(msg.data);
        }
      } else {
        console.warn('unknown message type', msg.type);
      }
    }
  } catch (e) {
    console.error('processIncomingMessages error', e);
  }
}
async function pollActiveUsers() {
  try {
    const active = await getActiveUsersFromServer();
    const activeSet = new Set(active);
    for (const u of active) {
      if (u === JWTusername) continue;
      if (!peers[u]) {
        await callUser(u);
      }
    }
    for (const peerName of Object.keys(peers)) {
      if (!activeSet.has(peerName)) {
        peers[peerName].close();
        delete peers[peerName];
        removePeerUI(peerName);
      }
    }
  } catch (e) {
    console.error('pollActiveUsers error', e);
  }
}
async function ensureLocalStream(wantAudio = true, wantVideo = false) {
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: wantAudio,
      video: wantVideo,
    });
    localVideo.srcObject = localStream;
    return;
  }
  if (wantVideo && localStream.getVideoTracks().length === 0) {
    const vs = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoTrack = vs.getVideoTracks()[0];
    localStream.addTrack(videoTrack);
    localVideo.srcObject = localStream;
  }
}
async function JoinVoiceCalls() {
  try {
    if (!selectedServerID) {
      console.error('No selectedServerID — please open a server first.');
      return;
    }
    await ensureLocalStream(true, false);
    const currentUsers = await joinVoiceOnServer();
    for (const user of currentUsers) {
      if (user !== JWTusername) {
        await callUser(user);
      }
    }
    if (!signalingInterval) {
      signalingInterval = setInterval(processIncomingMessages, 1000);
    }
    if (!usersInterval) {
      usersInterval = setInterval(pollActiveUsers, 2000);
    }
    sessionStorage.setItem('UserJoined', selectedServerID);
    userJoined.style.display = 'block';
    userJoined.innerHTML = JWTusername;
  } catch (err) {
    console.error('JoinVoiceCalls error', err);
  }
}
async function LeaveCall() {
  try {
    await leaveVoiceOnServer();
    if (signalingInterval) {
      clearInterval(signalingInterval);
      signalingInterval = null;
    }
    if (usersInterval) {
      clearInterval(usersInterval);
      usersInterval = null;
    }
    for (const p of Object.values(peers)) {
      try {
        p.close();
      } catch {}
    }
    peers = {};
    pendingCandidates = {};
    const videoBox = document.querySelector('.videoBox');
    const remotes = Array.from(document.querySelectorAll('[id^="remote_"]'));
    remotes.forEach((el) => el.remove());
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
    if (localVideo) localVideo.srcObject = null;
    sessionStorage.removeItem('UserJoined');
    userJoined.innerHTML = '';
  } catch (err) {
    console.error('LeaveCall error', err);
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
    console.error('VideoOn error', err);
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
    console.log(e);
  }
  for (const pc of Object.values(peers)) {
    const sender = pc
      .getSenders()
      .find((s) => s.track && s.track.kind === 'video');
    if (sender) {
      try {
        sender.replaceTrack(null);
      } catch (e) {
        console.warn('replaceTrack(null) failed', e);
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
}
function UnmuteAudio() {
  if (!localStream) return;
  for (const track of localStream.getAudioTracks()) {
    track.enabled = true;
  }
}
window.JoinVoiceCalls = JoinVoiceCalls;
window.LeaveCall = LeaveCall;
window.VideoOn = VideoOn;
window.VideoOff = VideoOff;
window.MuteAudio = MuteAudio;
window.UnmuteAudio = UnmuteAudio;
