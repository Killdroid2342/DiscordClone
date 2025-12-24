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
let signalRConnection = null;

let currentChatHistory = [];
let currentGroupId = null;

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

let ringtoneAudio = null;

function startRingtone() {
  if (ringtoneAudio) return;
  console.log("Starting Ringtone");

  try {
    ringtoneAudio = new Audio('/assets/audio/ringtone.mp3');
    ringtoneAudio.loop = true;
    ringtoneAudio.volume = 0.5;


    const playPromise = ringtoneAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        console.warn("Autoplay blocked. Waiting for interaction...", e);
        const banner = document.getElementById('audioPermBanner');
        if (banner) banner.style.display = 'block';

        const resumeAudio = () => {
          if (ringtoneAudio) ringtoneAudio.play().catch(err => console.error("Retry failed", err));
          if (banner) banner.style.display = 'none';
          document.removeEventListener('click', resumeAudio);
          document.removeEventListener('keydown', resumeAudio);
        };
        document.addEventListener('click', resumeAudio);
        document.addEventListener('keydown', resumeAudio);
      });
    }
  } catch (e) {
    console.error("Failed to load ringtone:", e);
  }
}

const playBeep = () => {
  try {
    const osc = globalAudioContext.createOscillator();
    const gain = globalAudioContext.createGain();
    osc.connect(gain);
    gain.connect(globalAudioContext.destination);


    osc.frequency.setValueAtTime(800, globalAudioContext.currentTime);
    osc.frequency.setValueAtTime(600, globalAudioContext.currentTime + 0.4);

    gain.gain.setValueAtTime(0.2, globalAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 1.5);

    osc.start();
    osc.stop(globalAudioContext.currentTime + 1.5);
  } catch (e) { console.error("Ringtone error:", e); }
};



function stopRingtone() {
  if (ringtoneAudio) {
    console.log("Stopping Ringtone");
    ringtoneAudio.pause();
    ringtoneAudio.currentTime = 0;
    ringtoneAudio = null;
  }
}

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


        await fetchServerDetails();
        if (signalRConnection && signalRConnection.state === "Connected") {
          try {
            await signalRConnection.invoke("JoinServer", server.serverID, JWTusername);
          } catch (err) { console.error("SignalR Join failed", err); }
        } else {
          console.log("SignalR not connected yet, skipping join group...");
        }
        startServerMessagePolling();


        const joinedServer = sessionStorage.getItem('UserJoined');
        if (joinedServer && joinedServer === selectedServerID) {
          console.log("Auto-rejoining voice for", selectedServerID);
          JoinVoiceCalls();
        }
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
      `http://localhost:5018/api/ServerMessages/GetServerMessages?channelId=${selectedChannelID}`
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
      'http://localhost:5018/api/ServerMessages/ServerMessages',
      formDataObject
    );

    event.target.querySelector('.chatInput').value = '';
  } catch (e) {
    console.log('msg send failed:', e);
  }
}
function showAddFriends() {
  clearContent();
  const addDiv = document.querySelector('.addFriendsDiv');
  if (addDiv) addDiv.style.display = 'block';
}

function clearContent() {
  const sections = [
    '.addFriendsDiv',
    '.removeFriendsDiv',
    '.pendingRequestsDiv',
    '.privateMessage',
    '.friendsMainView',
    '#serverDetails'
  ];

  sections.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.style.display = 'none';
    });
  });


  const accountElement = document.querySelector('.account');

}

const friendsDiv = document.querySelector('.friendsDiv');
if (friendsDiv) {
  friendsDiv.addEventListener('click', () => {
    document.querySelector('.secondColumn').style.display = 'block';
    document.querySelector('.lastSection').style.display = 'block';
    document.getElementById('serverDetails').style.display = 'none';

    document.querySelector('.nav').style.display = 'flex';
    const privateMsg = document.querySelector('.privateMessage');
    if (privateMsg) privateMsg.style.display = 'none';

    ShowFriendsMainView();
  });
}
function showPendingRequests() {
  clearContent();
  const pendingDiv = document.querySelector('.pendingRequestsDiv');
  if (pendingDiv) {
    pendingDiv.style.display = 'block';
    fetchPendingRequests();
  }
}
async function fetchPendingRequests() {
  const pendingList = document.querySelector('.pendingList');
  pendingList.innerHTML = 'Loading...';
  try {
    const res = await axios.get(`http://localhost:5018/api/Account/GetFriendRequests?username=${JWTusername}`);
    pendingList.innerHTML = '';

    if (!Array.isArray(res.data) || res.data.length === 0) {
      pendingList.innerHTML = '<p class="no-requests">No pending requests.</p>';
      return;
    }

    res.data.forEach(reqUser => {
      const item = document.createElement('div');
      item.className = 'friend-item';
      item.style.cursor = 'default';

      const left = document.createElement('div');
      left.className = 'friend-item-left';

      const avatar = document.createElement('div');
      avatar.className = 'friend-item-avatar';
      avatar.style.backgroundImage = 'url(/assets/img/titlePic.png)';

      const info = document.createElement('div');
      info.className = 'friend-item-info';

      const name = document.createElement('span');
      name.className = 'friend-item-name';
      name.textContent = reqUser;

      const status = document.createElement('span');
      status.className = 'friend-item-status';
      status.textContent = 'Incoming Friend Request';

      info.appendChild(name);
      info.appendChild(status);
      left.appendChild(avatar);
      left.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'friend-item-actions';
      actions.style.display = 'flex';
      actions.style.gap = '10px';

      const acceptBtn = document.createElement('button');
      acceptBtn.title = 'Accept';
      acceptBtn.innerHTML = '✓';
      acceptBtn.style.background = '#3ba55c';
      acceptBtn.style.color = 'white';
      acceptBtn.style.border = 'none';
      acceptBtn.style.borderRadius = '50%';
      acceptBtn.style.width = '36px';
      acceptBtn.style.height = '36px';
      acceptBtn.style.cursor = 'pointer';
      acceptBtn.style.fontSize = '18px';
      acceptBtn.onclick = () => acceptRequest(reqUser);

      const declineBtn = document.createElement('button');
      declineBtn.title = 'Decline';
      declineBtn.innerHTML = '✕';
      declineBtn.style.background = '#ed4245';
      declineBtn.style.color = 'white';
      declineBtn.style.border = 'none';
      declineBtn.style.borderRadius = '50%';
      declineBtn.style.width = '36px';
      declineBtn.style.height = '36px';
      declineBtn.style.cursor = 'pointer';
      declineBtn.style.fontSize = '18px';
      declineBtn.onclick = () => declineRequest(reqUser);

      actions.appendChild(acceptBtn);
      actions.appendChild(declineBtn);

      item.appendChild(left);
      item.appendChild(actions);
      pendingList.appendChild(item);
    });
  } catch (err) {
    console.error('Error fetching requests:', err);
    pendingList.innerHTML = '<p style="color:red; padding:20px;">Error loading requests</p>';
  }
}
async function acceptRequest(friendUsername) {
  try {
    const res = await axios.post(`http://localhost:5018/api/Account/AcceptFriendRequest?username=${JWTusername}&friendUsername=${friendUsername}`);
    alert(res.data.message);
    fetchPendingRequests();
    GetFriends();
  } catch (err) {
    console.error(err);
    alert('Failed to accept request');
  }
}
async function declineRequest(friendUsername) {
  try {
    const res = await axios.post(`http://localhost:5018/api/Account/DeclineFriendRequest?username=${JWTusername}&friendUsername=${friendUsername}`);
    alert(res.data.message);
    fetchPendingRequests();
  } catch (err) {
    console.error(err);
    alert('Failed to decline request');
  }
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

function showDeleteFriend() {
  clearContent();
  const pendingDiv = document.querySelector('.pendingRequestsDiv');
  if (pendingDiv) pendingDiv.style.display = 'none';
  document.querySelector('.removeFriendsDiv').style.display = 'block';

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
      console.log('GetFriends response:', friends);
      if (Array.isArray(friends)) {
        friends.forEach((friend) => {
          let friendsTag = document.createElement('p');
          friendsTag.textContent = friend;
          friendsTag.addEventListener('click', async () => {
            console.log("Friend clicked:", friend);
            clearContent();


            const pendingRequests = document.querySelectorAll('.pendingRequestsDiv');
            pendingRequests.forEach(el => {
              el.style.cssText = 'display: none !important;';
              void el.offsetWidth; 
            });
            console.log("Pending requests forced hidden");

            currentFriend = friend;
            InitWebSocket();
            await GetPrivateMessage();
            document.querySelector('.nav').style.display = 'none';

            const privateMsg = document.querySelector('.privateMessage');
            if (privateMsg) privateMsg.style.display = 'flex';
            directMessageUser.innerText = currentFriend;
          });
          mainFriendsDiv.appendChild(friendsTag);
        });
      }

      await GetGroups();
    }
  } catch (e) {
    console.log('private msg handling broke:', e);
  }
}
const socketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

function createMessageElement(sender, text, date) {
  const container = document.createElement('div');
  container.className = 'message-group';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';


  const content = document.createElement('div');
  content.className = 'message-content';

  const header = document.createElement('div');
  header.className = 'message-header';

  const username = document.createElement('span');
  username.className = 'message-username';
  username.textContent = sender;

  const timestamp = document.createElement('span');
  timestamp.className = 'message-timestamp';
  timestamp.textContent = date;

  header.appendChild(username);
  header.appendChild(timestamp);

  const messageText = document.createElement('div');
  messageText.className = 'message-text';

  const imageMatch = text.match(/^\[Image\]\((.*)\)$/);

  if (imageMatch && imageMatch[1]) {
    const img = document.createElement('img');
    img.src = imageMatch[1];
    img.style.maxWidth = '300px';
    img.style.maxHeight = '300px';
    img.style.borderRadius = '5px';
    img.style.marginTop = '5px';
    img.style.cursor = 'pointer';
    img.onclick = () => window.open(img.src, '_blank');
    messageText.appendChild(img);
  } else {
    messageText.textContent = text;
  }

  content.appendChild(header);
  content.appendChild(messageText);

  container.appendChild(avatar);
  container.appendChild(content);

  return container;
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
    const messageElement = createMessageElement(message.MessagesUserSender, message.friendMessagesData, message.date);
    messagesDisplay.appendChild(messageElement);
    messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
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
  const content = formData.get('friendMessagesData');

  if (currentGroupId) {

    const messageObject = {
      GroupId: currentGroupId,
      Sender: JWTusername,
      Content: content,
      Date: new Date().toISOString()
    };
    socket.send(JSON.stringify(messageObject));


  } else {

    const messageObject = {
      MessagesUserSender: JWTusername,
      MessageUserReciver: currentFriend,
      friendMessagesData: content,
      date: new Date().toISOString(),
    };
    socket.send(JSON.stringify(messageObject));
    const messagesDisplay = document.querySelector('.messagesDisplay');
    const messageElement = createMessageElement(JWTusername, messageObject.friendMessagesData, messageObject.date);
    messagesDisplay.appendChild(messageElement);
    messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
    currentChatHistory.push({ messagesUserSender: JWTusername, friendMessagesData: messageObject.friendMessagesData, date: messageObject.date });
  }

  event.target.reset();
}
async function GetPrivateMessage() {
  try {
    const res = await axios.get(
      `http://localhost:5018/api/PrivateMessageFriend/GetPrivateMessage?currentUsername=${JWTusername}&targetUsername=${currentFriend}`
    );
    const messagesDisplay = document.querySelector('.messagesDisplay');
    messagesDisplay.innerHTML = '';
    currentChatHistory = res.data;
    res.data.forEach((message) => {
      const messageElement = createMessageElement(message.messagesUserSender, message.friendMessagesData, message.date);
      messagesDisplay.appendChild(messageElement);
    });
    messagesDisplay.scrollTop = messagesDisplay.scrollHeight;


    const searchInput = document.getElementById('dmSearchInput');
    if (searchInput) {
      searchInput.removeEventListener('input', handleSearchInput); 
      searchInput.addEventListener('input', handleSearchInput);
    }

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


function handleSearchInput(e) {
  const query = e.target.value.toLowerCase();
  const sidebar = document.getElementById('searchResultsSidebar');
  const resultsList = document.getElementById('searchResultsList');
  const countSpan = document.getElementById('searchResultCount');

  if (!query) {
    sidebar.style.display = 'none';
    return;
  }

  sidebar.style.display = 'flex';
  resultsList.innerHTML = '';

  const results = currentChatHistory.filter(msg =>
    (msg.friendMessagesData && msg.friendMessagesData.toLowerCase().includes(query)) ||
    (msg.messagesUserSender && msg.messagesUserSender.toLowerCase().includes(query))
  );

  countSpan.textContent = `${results.length} RESULTS`;

  if (results.length === 0) {
    const noRes = document.createElement('div');
    noRes.style.padding = '20px';
    noRes.style.color = '#b9bbbe';
    noRes.style.textAlign = 'center';
    noRes.textContent = 'No results found.';
    resultsList.appendChild(noRes);
  } else {
    results.forEach(msg => {
      const el = document.createElement('div');
      el.className = 'search-result-item';
    
      el.style.padding = '10px';
      el.style.borderBottom = '1px solid #2f3136';
      el.style.cursor = 'pointer';

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.marginBottom = '4px';

      const name = document.createElement('span');
      name.style.fontWeight = 'bold';
      name.style.color = 'white';
      name.textContent = msg.messagesUserSender;

      const date = document.createElement('span');
      date.style.fontSize = '0.8em';
      date.style.color = '#72767d';
      date.textContent = msg.date;

      header.appendChild(name);
      header.appendChild(date);

      const content = document.createElement('div');
      content.style.color = '#dcddde';
      content.style.fontSize = '0.9em';
      content.textContent = msg.friendMessagesData;

      el.appendChild(header);
      el.appendChild(content);

    

      resultsList.appendChild(el);
    });
  }
}

function closeSearchResults() {
  document.getElementById('searchResultsSidebar').style.display = 'none';
  document.getElementById('dmSearchInput').value = '';
}
GetFriends();

if (JWTusername) {
  setTimeout(initializeVoiceConnection, 500);
}



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
      closeModal();
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

console.log("%c HOME.JS RELOADED - VERSION 26", "background: red; color: white; font-size: 20px");



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

async function openCreateDMModal() {
  document.getElementById('createDMModal').style.display = 'flex';
  const list = document.getElementById('dmFriendsList');
  list.innerHTML = 'Loading...';

  try {
    let res = await axios.get(
      `http://localhost:5018/api/Account/GetFriends?username=${JWTusername}`
    );
    list.innerHTML = '';

    if (!Array.isArray(res.data) || res.data.length === 0) {
      list.innerHTML = '<p style="color: #b9bbbe; padding: 10px;">No friends found.</p>';
      return;
    }

    res.data.forEach(friend => {
      const div = document.createElement('div');
      div.className = 'dmFriendItem';
      div.innerHTML = `
              <input type="checkbox" class="dmFriendInput" value="${friend}">
              <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #5865f2; margin-right: 10px; background-image: url('/assets/img/titlePic.png'); background-size: cover;"></div>
              <span>${friend}</span>
          `;
      div.onclick = (e) => {
        if (e.target.type !== 'checkbox') {
          const cb = div.querySelector('input');
          cb.checked = !cb.checked;
        }
        div.classList.toggle('selected', div.querySelector('input').checked);
      };
      list.appendChild(div);
    });
  } catch (e) {
    console.error(e);
    list.innerHTML = '<p style="color: red; padding: 10px;">Failed to load friends.</p>';
  }
}

function closeCreateDMModal() {
  document.getElementById('createDMModal').style.display = 'none';
}


async function CreateDM() {
  const selected = Array.from(document.querySelectorAll('.dmFriendInput:checked')).map(cb => cb.value);
  if (selected.length === 0) return;

  closeCreateDMModal();

  if (selected.length > 1) {
 
    const groupName = selected.join(', '); 

    const allMembers = [...selected, JWTusername];
    const uniqueMembers = [...new Set(allMembers)]; 

    try {
      const res = await axios.post('http://localhost:5018/api/GroupChat/CreateGroup', {
        Name: groupName,
        Owner: JWTusername,
        Members: uniqueMembers
      });
      const group = res.data;

      console.log("Created Group:", group);

     
      OpenGroupChat(group);

      GetFriends(); 

    } catch (e) {
      console.error("Failed to create group", e);
      alert("Failed to create group.");
    }

  } else {
   
    const friend = selected[0];
    console.log("Creating DM with", friend);

    clearContent();
    currentFriend = friend;
    currentGroupId = null;

    
    document.querySelector('.secondColumn').style.display = 'block';
    document.querySelector('.lastSection').style.display = 'block';
    document.getElementById('serverDetails').style.display = 'none';
    document.querySelector('.nav').style.display = 'none';

    const privateMsg = document.querySelector('.privateMessage');
    if (privateMsg) privateMsg.style.display = 'flex';

    if (directMessageUser) directMessageUser.innerText = currentFriend;

    InitWebSocket();
    await GetPrivateMessage();
  }
}

async function GetGroups() {
  try {
    const res = await axios.get(`http://localhost:5018/api/GroupChat/GetGroups?username=${JWTusername}`);
    const groups = res.data;

  
    document.querySelectorAll('.group-chat-item').forEach(e => e.remove());

    if (Array.isArray(groups)) {
      groups.forEach(group => {
        const p = document.createElement('p');
        p.textContent = `📢 ${group.name}`;
        p.style.cursor = 'pointer';
        p.className = 'group-chat-item';
        p.addEventListener('click', () => {
          OpenGroupChat(group);
        });
        mainFriendsDiv.appendChild(p);
      });
    }
  } catch (e) {
    console.error("Failed to load groups", e);
  }
}


setInterval(() => {
  if (document.querySelector('.nav').style.display !== 'none') {
    GetGroups();
  }
}, 5000);

function OpenGroupChat(group) {
  clearContent();

  const pendingRequests = document.querySelectorAll('.pendingRequestsDiv');
  pendingRequests.forEach(el => {
    el.style.cssText = 'display: none !important;';
    void el.offsetWidth;
  });

  currentGroupId = group.id;
  currentFriend = null;
  currentServerName = null;

  document.querySelector('.secondColumn').style.display = 'block';
  document.querySelector('.lastSection').style.display = 'block';
  document.getElementById('serverDetails').style.display = 'none';
  document.querySelector('.nav').style.display = 'none';

  const privateMsg = document.querySelector('.privateMessage');
  if (privateMsg) privateMsg.style.display = 'flex';

  if (directMessageUser) directMessageUser.innerText = group.name;

  InitGroupWebSocket(); 
  GetGroupMessages(group.id);
}

function InitGroupWebSocket() {
  if (socket) {
    socket.close();
  }
  socket = new WebSocket(
    `ws://localhost:5018/api/GroupChat/HandleGroupWebsocket?username=${JWTusername}`
  );
  socket.onopen = function () {
    console.log('connected to GROUP chat');
  };
  socket.onmessage = function (event) {
    const message = JSON.parse(event.data);

    if (message.GroupId !== currentGroupId) return; 


    if (message.GroupId === currentGroupId) {
      const messagesDisplay = document.querySelector('.messagesDisplay');
      const messageElement = createMessageElement(message.Sender, message.Content, message.Date);
      messagesDisplay.appendChild(messageElement);
      messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
      currentChatHistory.push({ messagesUserSender: message.Sender, friendMessagesData: message.Content, date: message.Date });
    }
  };
  socket.onclose = function () {
    console.log('group chat disconnected');
  };
}

async function GetGroupMessages(groupId) {
  try {
    const res = await axios.get(`http://localhost:5018/api/GroupChat/GetGroupMessages?groupId=${groupId}`);
    const messagesDisplay = document.querySelector('.messagesDisplay');
    messagesDisplay.innerHTML = '';
    currentChatHistory = res.data.map(m => ({ messagesUserSender: m.sender, friendMessagesData: m.content, date: m.date })); 

    res.data.forEach((message) => {
      const messageElement = createMessageElement(message.sender, message.content, message.date);
      messagesDisplay.appendChild(messageElement);
    });
    messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
  } catch (e) {
    console.error('Failed to load group messages', e);
  }
}



document.addEventListener('click', enableAudioPlayback, { once: true });
document.addEventListener('keydown', enableAudioPlayback, { once: true });
document.addEventListener('touchstart', enableAudioPlayback, { once: true });


async function initializeVoiceConnection() {
  try {
    if (voiceConnection && (voiceConnection.readyState === WebSocket.OPEN || voiceConnection.readyState === WebSocket.CONNECTING)) {
      console.log("Voice connection already active or connecting");
      return;
    }
    voiceConnection = new WebSocket('ws://localhost:5018/voice-ws');

    voiceConnection.onopen = () => {
      console.log('voice chat connected');



      voiceConnection.send(JSON.stringify({
        Type: 'identify',
        Username: JWTusername
      }));

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
            if (!currentVoiceUsers.includes(message.Username)) {
              currentVoiceUsers.push(message.Username);
              renderVoiceUserList(currentVoiceUsers);
            }

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
            currentVoiceUsers = currentVoiceUsers.filter(u => u !== message.Username);
            renderVoiceUserList(currentVoiceUsers);

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
            renderVoiceUserList(currentVoiceUsers);

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
            currentVoiceUsers = updatedUsers;
            renderVoiceUserList(currentVoiceUsers);
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
            await handlePeerOffer(message.Username, message.Data, message.IsPrivate, message.IsVideo);
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

          case 'call-cancel':

            break;

          case 'call-ended':
            console.log(`Call ended by ${message.Username}`);
            if (activeCallUI && activeCallUI.style.display !== 'none') {
              endPrivateCall(false);
            }
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
      voiceConnection = null;

      const joinedServer = sessionStorage.getItem('UserJoined');
      if (joinedServer) {
        console.log("Attempting to reconnect voice in 3 seconds...");
        setTimeout(() => {
          initializeVoiceConnection();
        }, 3000);
      }
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


    async function handlePeerOffer(fromUser, offer, isPrivateCall, isVideo) {


      const isServerPeer = currentVoiceUsers && currentVoiceUsers.includes(fromUser);

      if (isPrivateCall || !isServerPeer) {
        console.log(`Routing offer from ${fromUser} to Private Call Handler (Private=${isPrivateCall}, Video=${isVideo})`);
        if (window.handlePrivatePeerOffer) {
          await window.handlePrivatePeerOffer(fromUser, offer, isVideo);
        } else {
          console.error("handlePrivatePeerOffer not found!");
        }
        return;
      }



      try {
        let peerConnection = peerConnections.get(fromUser);


        if (peerConnection && peerConnection.signalingState !== 'stable' && peerConnection.signalingState !== 'have-local-offer') {
          console.log(`Connection with ${fromUser} is busy (${peerConnection.signalingState}), possibly ignoring offer collision.`);
          return;
        }

        if (!peerConnection) {
          peerConnection = await createPeerConnection(fromUser);
        }

        const remoteDesc = new RTCSessionDescription(JSON.parse(offer));
        if (peerConnection.signalingState === 'have-local-offer') {
          if (platform === 'browser') {
            if (JWTusername > fromUser) {
              console.log("I am impolite (initiator), ignoring colliding offer from", fromUser);
              return;
            }
          }

          await peerConnection.setRemoteDescription(remoteDesc);
          logToScreen(`RX SDP: hasVideo=${offer.includes('m=video')}, State=${peerConnection.signalingState}`);

          if (peerConnection.signalingState === 'have-remote-offer') {
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
              voiceConnection.send(JSON.stringify({
                Type: 'peer-answer',
                Data: JSON.stringify(answer),
                TargetUser: fromUser
              }));
            }
          } else {
            console.warn(`Cannot set local answer, state is ${peerConnection.signalingState} (expected have-remote-offer)`);
          }
        }
      } catch (err) {
        console.error('couldnt handle connection request:', err);
      }
    }

    async function handlePeerAnswer(fromUser, answer) {
      logToScreen(`RX Answer from ${fromUser}`);


      const isServerPeer = currentVoiceUsers && currentVoiceUsers.includes(fromUser);
      if (!isServerPeer) {
        if (window.handlePeerAnswer) {
          await window.handlePeerAnswer(fromUser, answer);
        } else {
          console.error("Global handlePeerAnswer not found!");
        }
        return;
      }

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
    window.createPeerConnection = createPeerConnection;

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

    track.onmute = () => {
      console.log(`Track ${track.kind} muted`);
      if (track.kind === 'video') {
        const privateRemoteVideo = document.getElementById('remoteVideo');
        if (privateRemoteVideo) privateRemoteVideo.srcObject = null;

        const groupVideo = document.getElementById('remote_' + peerName);
        if (groupVideo && groupVideo.tagName === 'VIDEO') groupVideo.srcObject = null;
      }
    };

    track.onunmute = () => {
      console.log(`Track ${track.kind} unmuted`);
      if (track.kind === 'video') {
        const privateRemoteVideo = document.getElementById('remoteVideo');
        if (privateRemoteVideo) privateRemoteVideo.srcObject = stream;

        const groupVideo = document.getElementById('remote_' + peerName);
        if (groupVideo && groupVideo.tagName === 'VIDEO') groupVideo.srcObject = stream;
      }
    };

    track.onended = () => {
      console.log(`Track ${track.kind} ended`);
      if (track.kind === 'video') {
        const privateRemoteVideo = document.getElementById('remoteVideo');
        if (privateRemoteVideo) privateRemoteVideo.srcObject = null;

        const groupVideo = document.getElementById('remote_' + peerName);
        if (groupVideo && groupVideo.tagName === 'VIDEO') groupVideo.srcObject = null;
      }
    };
  });


  const isOwnStream = peerName === JWTusername;
  if (isOwnStream) {
    console.log(`muting your own voice to prevent echo from ${peerName}`);
    return null;
  }

  const privateCallUI = document.getElementById('activeCallUI');
  const privateRemoteVideo = document.getElementById('remoteVideo');

  if (privateCallUI && privateCallUI.style.display !== 'none' && privateRemoteVideo) {
    console.log(`Redirecting stream from ${peerName} to Private Call Video UI`);
    privateRemoteVideo.srcObject = stream;
    return privateRemoteVideo;
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
  const localVideo = document.getElementById('localVideo');

  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: wantAudio,
      video: wantVideo,
    });
    if (localVideo) {
      localVideo.srcObject = localStream;
      localVideo.muted = true;
    }

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

  if (!wantVideo && localStream.getVideoTracks().length > 0) {
    console.log("Stopping video tracks for voice-only call");
    localStream.getVideoTracks().forEach(track => {
      track.stop();
      localStream.removeTrack(track);
    });

    if (localVideo) localVideo.srcObject = localStream;
  }

  if (wantVideo && localStream.getVideoTracks().length === 0) {
    const vs = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoTrack = vs.getVideoTracks()[0];
    localStream.addTrack(videoTrack);
    if (localVideo) {
      localVideo.srcObject = localStream;
      localVideo.muted = true;
    }
  }
}
async function JoinVoiceCalls() {
  enableAudioPlayback();
  try {
    if (!selectedServerID) {
      console.error('please select a server first before joining voice chat');
      return;
    }


    if (sessionStorage.getItem('UserJoined') === selectedServerID && voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
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
      } catch (err) {
        console.error('problem disconnecting from voice server:', err);
      }
      serverPeerConnection = null;
    }


    for (const [user, pc] of peerConnections.entries()) {
      try {
        pc.close();
      } catch (e) {
        console.warn(`Failed to close peer connection for ${user}`, e);
      }
    }
    peerConnections.clear();
    currentVoiceUsers = [];


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


    isMuted = false;
    isDeafened = false;
    let btn = document.querySelector('button[onclick="Mute()"]');
    if (btn) {
      btn.textContent = "Mute";
      btn.style.color = "white";
    }
    btn = document.querySelector('button[onclick="Deafen()"]');
    if (btn) {
      btn.textContent = "Deafen";
      btn.style.color = "white";
    }
    btn = document.querySelector('button[onclick="ShareScreen()"]');
    if (btn) {
      btn.textContent = "Share Screen";
      btn.style.color = "white";
      btn.onclick = ShareScreen;
    }


  } catch (err) {
    console.error('couldnt leave voice chat:', err);
  }
}
async function VideoOn() {
  try {
    await ensureLocalStream(true, true);


    const localVideo = document.getElementById('localVideo');
    if (localVideo && localStream) {
      localVideo.srcObject = localStream;
      localVideo.muted = true;
    }

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
  const localVideo = document.getElementById('localVideo');
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

let isMuted = false;
function Mute() {
  isMuted = !isMuted;
  if (isMuted) {
    MuteAudio();
    const btn = document.querySelector('button[onclick="Mute()"]');
    if (btn) {
      btn.textContent = "Unmute";
      btn.style.color = "red";
    }
  } else {
    UnmuteAudio();
    const btn = document.querySelector('button[onclick="Mute()"]');
    if (btn) {
      btn.textContent = "Mute";
      btn.style.color = "white";
    }
  }
}

let isDeafened = false;
function Deafen() {
  isDeafened = !isDeafened;
  const remotes = document.querySelectorAll('audio[id^="remote_"]');
  remotes.forEach(audio => {
    audio.muted = isDeafened;
  });

  const btn = document.querySelector('button[onclick="Deafen()"]');
  if (btn) {
    if (isDeafened) {
      btn.textContent = "Undeafen";
      btn.style.color = "red";
      if (!isMuted) Mute();
    } else {
      btn.textContent = "Deafen";
      btn.style.color = "white";
    }
  }
}

let isVideoOn = false;
function ToggleVideo() {
  isVideoOn = !isVideoOn;
  const btn = document.querySelector('#activeCallUI button:nth-child(2)');

  if (isVideoOn) {
    VideoOn();
    if (btn) {
      btn.textContent = "Stop Video";
      btn.style.color = "red";
    }
  } else {
    VideoOff();
    if (btn) {
      btn.textContent = "Video";
      btn.style.color = "white";
    }
  }
}

async function ShareScreen() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const screenTrack = screenStream.getVideoTracks()[0];


    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        localStream.removeTrack(videoTrack);
      }
      localStream.addTrack(screenTrack);

      const localVideo = document.getElementById('localVideo');
      if (localVideo) {
        localVideo.srcObject = localStream;
        localVideo.muted = true;
      }
    }

    const btn = document.querySelector('button[onclick="ShareScreen()"]');
    if (btn) {
      btn.textContent = "Stop Sharing";
      btn.style.color = "red";
      btn.onclick = () => {
        screenTrack.stop();

      };
    }


    for (const pc of peerConnections.values()) {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(screenTrack);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);


        let targetUser = null;
        for (const [user, conn] of peerConnections.entries()) {
          if (conn === pc) { targetUser = user; break; }
        }

        if (targetUser && voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
          voiceConnection.send(JSON.stringify({
            Type: 'peer-offer',
            Data: JSON.stringify(offer),
            TargetUser: targetUser
          }));
        }

      } else {
        pc.addTrack(screenTrack, localStream);


        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        let targetUser = null;
        for (const [user, conn] of peerConnections.entries()) {
          if (conn === pc) { targetUser = user; break; }
        }

        if (targetUser && voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
          logToScreen(`ShareScreen (New Track): Sending offer to ${targetUser}`);
          voiceConnection.send(JSON.stringify({
            Type: 'peer-offer',
            Data: JSON.stringify(offer),
            TargetUser: targetUser
          }));
        }
      }
    }

    screenTrack.onended = () => {
      VideoOff();
      if (btn) {
        btn.textContent = "Share Screen";
        btn.style.color = "white";
        btn.onclick = ShareScreen;
      }
    };

  } catch (err) {
    console.error("Error sharing screen:", err);
  }
}

window.Mute = Mute;
window.Deafen = Deafen;
window.ShareScreen = ShareScreen;
window.JoinVoiceCalls = JoinVoiceCalls;
window.LeaveCall = LeaveCall;
window.VideoOn = VideoOn;
window.VideoOff = VideoOff;
window.ToggleVideo = ToggleVideo;
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
  line.textContent = `[${new Date().toLocaleTimeString()}] MY_CODE: ${msg}`;
  debugConsole.appendChild(line);
  debugConsole.scrollTop = debugConsole.scrollHeight;
  console.log(`MY_CODE: ${msg}`);
}

async function fetchServerDetails() {
  try {
    const response = await axios.get(
      `http://localhost:5018/api/Server/GetServerDetails?serverId=${selectedServerID}`
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


    renderVoiceUserList(currentVoiceUsers);

  } catch (err) {
    console.error('Failed to fetch server details:', err);
  }
}



async function fetchServerMembers() {
  try {
    const response = await axios.get(
      `http://localhost:5018/api/Server/GetServerMembers?serverId=${selectedServerID}`
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


    if (typeof currentVoiceUsers !== 'undefined') {
      renderVoiceUserList(currentVoiceUsers);
    }

  } catch (err) {
    console.error('Failed to fetch members:', err);
  }
}

function renderVoiceUserList(users) {
  if (!users) return;

  document.querySelectorAll('.voice-user-list').forEach(el => el.remove());


  const allMemberEls = document.querySelectorAll('.viewServerAccounts div[data-username]');
  allMemberEls.forEach(el => {
    const icon = el.querySelector('.voice-status-icon');
    if (icon) icon.remove();
  });

  const firstVoiceChannel = document.querySelector('div[data-channel-type="voice"]');

  if (firstVoiceChannel && users.length > 0) {
    const userListContainer = document.createElement('div');
    userListContainer.className = 'voice-user-list';
    userListContainer.style.marginLeft = '20px';
    userListContainer.style.marginBottom = '5px';

    users.forEach(username => {
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
}

async function startSignalR() {
  try {
    signalRConnection = new signalR.HubConnectionBuilder()
      .withUrl("http://localhost:5018/chatHub")
      .withAutomaticReconnect()
      .build();

    signalRConnection.on("NewMember", (username) => {
      console.log("New member joined:", username);

      fetchServerMembers();
    });

    signalRConnection.on("UserLeft", (username) => {
      console.log("User left:", username);
      fetchServerMembers();
    });

    await signalRConnection.start();
    console.log("SignalR Connected");

    if (selectedServerID) {
      await signalRConnection.invoke("JoinServer", selectedServerID, JWTusername);
    }

  } catch (err) {
    console.error("SignalR Connection Error: ", err);
    setTimeout(startSignalR, 5000);
  }
}


startSignalR();

async function startPrivateCall() {
  const preCallUI = document.getElementById('preCallUI');
  const activeCallUI = document.getElementById('activeCallUI');


  if (preCallUI) preCallUI.style.display = 'none';
  if (activeCallUI) activeCallUI.style.display = 'block';

  const activeCallUsername = document.getElementById('activeCallUsername');
  const centerCallUser = document.getElementById('centerCallUser');
  if (activeCallUsername) activeCallUsername.textContent = currentFriend || 'Unknown User';
  if (centerCallUser) centerCallUser.textContent = currentFriend || 'Unknown User';

  console.log('Private call UI started, initiating call...');

  try {

    initializeVoiceConnection();


    await new Promise(resolve => setTimeout(resolve, 500));

    if (!voiceConnection || voiceConnection.readyState !== WebSocket.OPEN) {
      console.error("Voice connection not ready");
      return;
    }


    console.log(`Identifying as ${JWTusername} for call`);
    voiceConnection.send(JSON.stringify({
      Type: 'identify',
      Username: JWTusername
    }));


    await ensureLocalStream(true, false);


    if (!currentFriend) {
      console.error("No friend selected to call");
      return;
    }

    const peerConnection = await createPeerConnection(currentFriend);


    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const offerPayload = {
      type: offer.type,
      sdp: offer.sdp,
      isVideo: false
    };

    voiceConnection.send(JSON.stringify({
      Type: 'peer-offer',
      Data: JSON.stringify(offerPayload),
      TargetUser: currentFriend,
      IsPrivate: true
    }));

    console.log(`Offer sent to ${currentFriend}`);

  } catch (err) {
    console.error("Failed to start private call:", err);
  }
}

async function createPeerConnection(peerName) {
  if (peerConnections.has(peerName)) {
    return peerConnections.get(peerName);
  }

  const pc = new RTCPeerConnection(config);
  peerConnections.set(peerName, pc);

  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  pc.onicecandidate = (event) => {
    if (event.candidate && voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
      voiceConnection.send(JSON.stringify({
        Type: 'peer-ice-candidate',
        Data: JSON.stringify(event.candidate),
        TargetUser: peerName
      }));
    }
  };

  pc.ontrack = (event) => {
    console.log(`Received track from ${peerName}: Kind=${event.track.kind}, ID=${event.track.id}`);

    let remoteAudio = document.getElementById(`remote_${peerName}`);
    if (!remoteAudio) {
      remoteAudio = document.createElement('audio');
      remoteAudio.id = `remote_${peerName}`;
      remoteAudio.autoplay = true;
      remoteAudio.controls = false;
      document.body.appendChild(remoteAudio);
    }
    if (event.track.kind === 'audio') {
      remoteAudio.srcObject = event.streams[0];
    }


    if (event.track.kind === 'video') {
      console.log("FOUND REMOTE VIDEO TRACK! Attaching to #remoteVideo");
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
        remoteVideo.play().catch(e => console.error("Remote video play failed:", e));
        console.log("Attached remote video stream to DOM");
      } else {
        console.error("remoteVideo element MISSING from DOM");
      }
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`Connection state with ${peerName}: ${pc.connectionState}`);
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      removePeerUI(peerName);
      pc.close();
      peerConnections.delete(peerName);
    }
  };

  return pc;
}


let pendingPeer = null;
let pendingOffer = null;
let pendingIsVideo = false;

async function handlePrivatePeerOffer(peerName, offerData, _unusedIsVideo) {

  let isVideo = false;
  try {
    const payload = JSON.parse(offerData);
    if (payload.isVideo) isVideo = true;
  } catch (e) { console.warn("Failed to parse offer data for IsVideo flag", e); }

  console.log(`Handling offer from ${peerName} (Video=${isVideo})`);


  if (peerConnections.has(peerName)) {
    console.log(`Renegotiation offer from ${peerName} detected. processing silently.`);
    const pc = peerConnections.get(peerName);


    const offerDesc = typeof offerData === 'string' ? JSON.parse(offerData) : offerData;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
      voiceConnection.send(JSON.stringify({
        Type: 'peer-answer',
        Data: JSON.stringify(answer),
        TargetUser: peerName
      }));
    }
    return;
  }


  pendingPeer = peerName;
  pendingOffer = offerData;
  pendingIsVideo = isVideo;


  const modal = document.getElementById('incomingCallModal');
  const userText = document.getElementById('incomingCallUser');
  if (modal && userText) {
    userText.textContent = `${peerName} is calling... ` + (isVideo ? '(Video)' : '(Voice)');
    modal.style.display = 'flex';
    startRingtone();
  } else {

    console.warn("Incoming call modal missing");

  }
}

async function AcceptCall() {
  stopRingtone();
  const modal = document.getElementById('incomingCallModal');
  if (modal) modal.style.display = 'none';

  if (!pendingPeer || !pendingOffer) return;

  const peerName = pendingPeer;
  const offerData = pendingOffer;


  pendingPeer = null;
  pendingOffer = null;


  if (globalAudioContext) {
    if (globalAudioContext.state === 'suspended') {
      await globalAudioContext.resume();
      console.log('AudioContext resumed by AcceptCall');
    }
  } else {
    enableAudioPlayback();
  }


  await ensureLocalStream(true, pendingIsVideo);


  const pc = await createPeerConnection(peerName);
  await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(offerData)));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  if (voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
    voiceConnection.send(JSON.stringify({
      Type: 'peer-answer',
      Data: JSON.stringify(answer),
      TargetUser: peerName
    }));
  }


  const preCallUI = document.getElementById('preCallUI');
  const activeCallUI = document.getElementById('activeCallUI');

  if (preCallUI) preCallUI.style.display = 'none';
  if (activeCallUI) activeCallUI.style.display = 'block';

  const activeCallUsername = document.getElementById('activeCallUsername');
  const centerCallUser = document.getElementById('centerCallUser');

  if (activeCallUsername) activeCallUsername.textContent = peerName;
  if (centerCallUser) centerCallUser.textContent = `${JWTusername} & ${peerName}`;

  currentFriend = peerName;


  try {
    clearContent();

    const pendingRequests = document.querySelectorAll('.pendingRequestsDiv');
    pendingRequests.forEach(el => el.style.cssText = 'display: none !important;');


    InitWebSocket();
    await GetPrivateMessage();

    const nav = document.querySelector('.nav');
    if (nav) nav.style.display = 'none';

    const privateMsg = document.querySelector('.privateMessage');
    if (privateMsg) privateMsg.style.display = 'block';

    if (typeof directMessageUser !== 'undefined' && directMessageUser) {
      directMessageUser.innerText = currentFriend;
    }
  } catch (e) {
    console.error("Auto-navigation to DM failed:", e);
  }
}

function DeclineCall() {
  stopRingtone();
  const modal = document.getElementById('incomingCallModal');
  if (modal) modal.style.display = 'none';

  console.log(`Declined call from ${pendingPeer}`);
  pendingPeer = null;
  pendingOffer = null;


}

async function handlePeerAnswer(peerName, answerData) {
  console.log(`Handling answer from ${peerName}`);
  const pc = peerConnections.get(peerName);
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(answerData)));


    const centerCallUser = document.getElementById('centerCallUser');
    if (centerCallUser) centerCallUser.textContent = `${JWTusername} & ${peerName}`;


    try {
      if (document.querySelector('.nav') && document.querySelector('.nav').style.display !== 'none') {
        clearContent();
        const pendingRequests = document.querySelectorAll('.pendingRequestsDiv');
        pendingRequests.forEach(el => el.style.cssText = 'display: none !important;');

        InitWebSocket();
        await GetPrivateMessage();

        const nav = document.querySelector('.nav');
        if (nav) nav.style.display = 'none';

        const privateMsg = document.querySelector('.privateMessage');
        if (privateMsg) privateMsg.style.display = 'flex';

        if (typeof directMessageUser !== 'undefined' && directMessageUser) {
          directMessageUser.innerText = peerName;
        }
      }
    } catch (e) { console.error("Auto-nav for caller failed", e); }
  }
}

async function handlePeerIceCandidate(peerName, candidateData) {
  console.log(`Handling candidate from ${peerName}`);
  const pc = peerConnections.get(peerName);
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidateData)));
    } catch (e) {
      console.warn(`Error adding ice candidate from ${peerName}:`, e);
    }
  }
}

async function endPrivateCall(notifyPeer = true) {
  const preCallUI = document.getElementById('preCallUI');
  const activeCallUI = document.getElementById('activeCallUI');

  if (notifyPeer && currentFriend && voiceConnection && voiceConnection.readyState === WebSocket.OPEN) {
    console.log(`Sending call-ended signal to ${currentFriend}`);
    voiceConnection.send(JSON.stringify({
      Type: 'call-ended',
      TargetUser: currentFriend
    }));
  }

  if (activeCallUI) activeCallUI.style.display = 'none';
  if (preCallUI) preCallUI.style.display = 'flex';

  console.log('Private call UI ended, cleaning up...');

  try {
    if (currentFriend && peerConnections.has(currentFriend)) {
      const pc = peerConnections.get(currentFriend);
      pc.close();
      peerConnections.delete(currentFriend);
      removePeerUI(currentFriend);
    }

    if (peerConnections.size === 0 && localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
      if (localVideo) localVideo.srcObject = null;
    }

  } catch (err) {
    console.error("Error ending private call:", err);
  }
}



async function ShowFriendsMainView() {
  clearContent();

  const viewsToHide = [
    '.pendingRequestsDiv',
    '.addFriendsDiv',
    '.removeFriendsDiv',
    '.privateMessage',
    '#serverDetails'
  ];

  viewsToHide.forEach(selector => {
    const el = document.querySelector(selector);
    if (el) el.style.display = 'none';
  });

  document.querySelectorAll('.pendingRequestsDiv').forEach(el => el.style.cssText = 'display: none !important;');

  const friendsView = document.querySelector('.friendsMainView');
  if (friendsView) {
    friendsView.style.display = 'flex';
    document.querySelector('.nav').style.display = 'flex';

    await FetchAndRenderFriendsMain();
  }
}

async function FetchAndRenderFriendsMain() {
  try {
    const countEl = document.getElementById('friendsCount');
    const listEl = document.querySelector('.friendsListMain');

    if (listEl) listEl.innerHTML = '';

    const res = await axios.get(
      'http://localhost:5018/api/Account/GetFriends?username=' + JWTusername
    );

    let friends = [];
    if (Array.isArray(res.data)) {
      friends = res.data;
    }

    if (countEl) countEl.textContent = friends.length;

    if (friends.length === 0) {
      if (listEl) listEl.innerHTML = '<p style=\'color: #b9bbbe; padding: 20px; text-align: center;\'>No friends found.</p>';
      return;
    }

    friends = [...new Set(friends)];

    if (listEl) listEl.innerHTML = '';

    friends.forEach(friendName => {
      const item = document.createElement('div');
      item.className = 'friend-item';
      item.onclick = (e) => {
        OpenDM(friendName);
      };

      const left = document.createElement('div');
      left.className = 'friend-item-left';

      const avatar = document.createElement('div');
      avatar.className = 'friend-item-avatar';
      avatar.style.backgroundImage = 'url(/assets/img/titlePic.png)';

      const info = document.createElement('div');
      info.className = 'friend-item-info';

      const name = document.createElement('span');
      name.className = 'friend-item-name';
      name.textContent = friendName;

      const status = document.createElement('span');
      status.className = 'friend-item-status';
      status.textContent = 'Online';

      info.appendChild(name);
      info.appendChild(status);
      left.appendChild(avatar);
      left.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'friend-actions';

      const msgBtn = document.createElement('div');
      msgBtn.className = 'friend-action-btn';
      msgBtn.innerHTML = '';
      msgBtn.title = 'Message';
      msgBtn.onclick = (e) => {
        e.stopPropagation();
        OpenDM(friendName);
      };

      actions.appendChild(msgBtn);

      item.appendChild(left);
      item.appendChild(actions);

      if (listEl) listEl.appendChild(item);
    });

  } catch (err) {
    console.error('Failed to render friends main:', err);
  }
}

function OpenDM(friendName) {
  clearContent();
  const pendingRequests = document.querySelectorAll('.pendingRequestsDiv');
  pendingRequests.forEach(el => el.style.cssText = 'display: none !important;');

  const friendsView = document.querySelector('.friendsMainView');
  if (friendsView) friendsView.style.display = 'none';

  currentFriend = friendName;
  InitWebSocket();
  GetPrivateMessage();
  document.querySelector('.nav').style.display = 'none';

  const privateMsg = document.querySelector('.privateMessage');
  if (privateMsg) privateMsg.style.display = 'flex';

  if (typeof directMessageUser !== 'undefined') directMessageUser.innerText = currentFriend;
}

setTimeout(() => {
  const seeFriendsBtn = document.getElementById('seeFriends');
  if (seeFriendsBtn) {
    seeFriendsBtn.onclick = ShowFriendsMainView;
  }
}, 1000);


async function startPrivateVideoCall() {
  const preCallUI = document.getElementById('preCallUI');
  const activeCallUI = document.getElementById('activeCallUI');

  if (preCallUI) preCallUI.style.display = 'none';
  if (activeCallUI) activeCallUI.style.display = 'block';

  const activeCallUsername = document.getElementById('activeCallUsername');
  const centerCallUser = document.getElementById('centerCallUser');
  if (activeCallUsername) activeCallUsername.textContent = currentFriend || 'Unknown User';
  if (centerCallUser) centerCallUser.textContent = currentFriend || 'Unknown User';

  console.log('Private VIDEO call UI started, initiating call...');

  try {
    initializeVoiceConnection();

    await new Promise(resolve => setTimeout(resolve, 500));

    if (!voiceConnection || voiceConnection.readyState !== WebSocket.OPEN) {
      console.error('Voice connection not ready');
      return;
    }

    voiceConnection.send(JSON.stringify({
      Type: 'identify',
      Username: JWTusername
    }));

    await ensureLocalStream(true, true);

    if (!currentFriend) {
      console.error('No friend selected to call');
      return;
    }

    const peerConnection = await createPeerConnection(currentFriend);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const offerPayload = {
      type: offer.type,
      sdp: offer.sdp,
      isVideo: true
    };

    voiceConnection.send(JSON.stringify({
      Type: 'peer-offer',
      Data: JSON.stringify(offerPayload),
      TargetUser: currentFriend,
      IsPrivate: true
    }));

    console.log('Video Offer sent to ' + currentFriend);

  } catch (err) {
    console.error('Failed to start private video call:', err);
  }
}
window.startPrivateVideoCall = startPrivateVideoCall;


function updateVideoDiagnostics() {
  const debugEl = document.getElementById('videoDebug');
  if (!debugEl || document.getElementById('activeCallUI').style.display === 'none') return;

  let localStatus = 'Local: Disconnected';
  if (localStream) {
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    localStatus = `Local: Audio=${audioTracks.length} (En=${audioTracks[0]?.enabled}), Video=${videoTracks.length} (En=${videoTracks[0]?.enabled})`;
  }

  let remoteStatus = 'Remote: Disconnected';
  const remoteVideo = document.getElementById('remoteVideo');
  if (remoteVideo && remoteVideo.srcObject) {
    const rStream = remoteVideo.srcObject;
    const rvTracks = rStream.getVideoTracks();
    const raTracks = rStream.getAudioTracks();
    remoteStatus = `Remote: Audio=${raTracks.length}, Video=${rvTracks.length} (Paused=${remoteVideo.paused}, Ready=${remoteVideo.readyState})`;
  } else {
    remoteStatus = 'Remote: No Stream Attached';
  }

  let pcStatus = 'PC: N/A';
  if (currentFriend && peerConnections.has(currentFriend)) {
    const pc = peerConnections.get(currentFriend);
    pcStatus = `PC: ${pc.connectionState}, ICE: ${pc.iceConnectionState}, Sig: ${pc.signalingState}`;
  }

  debugEl.innerHTML = `<h3>Diagnostics</h3>${localStatus}<br>${remoteStatus}<br>${pcStatus}`;
}


async function handleDMFileUpload(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('http://localhost:5018/api/Upload/UploadImage', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data && res.data.url) {
        const fileUrl = 'http://localhost:5018' + res.data.url; 
        console.log('File uploaded:', fileUrl);

        const messageText = `[Image](${fileUrl})`;

        if (!socket || socket.readyState !== WebSocket.OPEN) {
          console.log('not connected to chat');
          return;
        }

        const messageObject = {
          MessagesUserSender: JWTusername,
          MessageUserReciver: currentFriend,
          friendMessagesData: messageText,
          date: new Date().toLocaleString(),
        };

        socket.send(JSON.stringify(messageObject));

        const messagesDisplay = document.querySelector('.messagesDisplay');
        const messageElement = createMessageElement(JWTusername, messageText, messageObject.date);
        messagesDisplay.appendChild(messageElement);
        messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
      }
    } catch (err) {
      console.error('File upload failed:', err);
      alert('Failed to upload image.');
    }

    input.value = '';
  }
}



let currentUploadFile = null;

function openUploadModal() {
  const modal = document.getElementById('uploadModal');
  const dropZone = document.getElementById('uploadDropZone');
  const fileInput = document.getElementById('modalFileInput');

  currentUploadFile = null;
  document.getElementById('uploadPreview').style.display = 'none';
  document.getElementById('uploadDropZone').style.display = 'block';
  fileInput.value = '';

  modal.style.display = 'flex';

  dropZone.onclick = () => fileInput.click();

  dropZone.ondragover = (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-active');
  };

  dropZone.ondragleave = () => {
    dropZone.classList.remove('drag-active');
  };

  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-active');

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  fileInput.onchange = (e) => {
    if (fileInput.files && fileInput.files[0]) {
      handleFileSelection(fileInput.files[0]);
    }
  };
}

function closeUploadModal() {
  document.getElementById('uploadModal').style.display = 'none';
}

function handleFileSelection(file) {
  if (!file.type.startsWith('image/')) {
    alert('Only image files are supported.');
    return;
  }

  currentUploadFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('uploadDropZone').style.display = 'none';
    const preview = document.getElementById('uploadPreview');
    preview.style.display = 'block';

    document.getElementById('uploadFileName').textContent = file.name;
    const img = document.getElementById('uploadImagePreview');
    img.src = e.target.result;
    img.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function submitUploadModal() {
  if (!currentUploadFile) return;

  const formData = new FormData();
  formData.append('file', currentUploadFile);

  const btn = document.querySelector('#uploadModal .upload-btn');
  const originalText = btn.textContent;
  btn.textContent = 'Uploading...';
  btn.disabled = true;

  try {
    const res = await axios.post('http://localhost:5018/api/Upload/UploadImage', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    if (res.data && res.data.url) {
      const fileUrl = 'http://localhost:5018' + res.data.url;
      console.log('File uploaded:', fileUrl);

      const messageText = `[Image](${fileUrl})`;

      if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.log('not connected to chat');
        return;
      }

      const messageObject = {
        MessagesUserSender: JWTusername,
        MessageUserReciver: currentFriend,
        friendMessagesData: messageText,
        date: new Date().toLocaleString(),
      };

      socket.send(JSON.stringify(messageObject));

      const messagesDisplay = document.querySelector('.messagesDisplay');
      const messageElement = createMessageElement(JWTusername, messageText, messageObject.date);
      messagesDisplay.appendChild(messageElement);
      messagesDisplay.scrollTop = messagesDisplay.scrollHeight;

      closeUploadModal();
    }
  } catch (err) {
    console.error('File upload failed:', err);
    alert('Failed to upload image.');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}




function setupEmojiPicker() {
  const container = document.getElementById('emojiGridContainer');
  const searchInput = document.getElementById('emojiSearchInput');
  const picker = document.getElementById('emojiPicker');
  const tabs = document.querySelectorAll('.emoji-tab');

  if (!container || !picker) return;

  let currentTab = 'emoji';

  const renderContent = (filterText = '') => {
    container.innerHTML = '';
    const safeFilter = filterText.toLowerCase();

    if (currentTab === 'emoji') {
      const title = document.createElement('div');
      title.className = 'emoji-category-title';
      title.textContent = 'All Emojis';
      container.appendChild(title);

      const filtered = emojiList.filter(e => {
        if (!safeFilter) return true;
        return e.names.some(name => name.includes(safeFilter)) || e.char.includes(safeFilter);
      });

      filtered.forEach(item => {
        const span = document.createElement('span');
        span.textContent = item.char;
        span.className = 'emoji-item';

        span.onmouseenter = () => {
          const pEmoji = document.getElementById('previewEmoji');
          const pName = document.getElementById('previewName');
          if (pEmoji) pEmoji.textContent = item.char;
          if (pName) pName.textContent = ':' + item.names[0] + ':';
        };

        span.onclick = () => {
          const input = document.querySelector('.chatInput');
          if (input) {
            input.value += item.char;
            input.focus();
          }
        };
        container.appendChild(span);
      });

      if (filtered.length === 0) {
        const msg = document.createElement('div');
        msg.style.cssText = 'color: #b9bbbe; padding: 20px; text-align: center; grid-column: span 8;';
        msg.textContent = 'No emojis found';
        container.appendChild(msg);
      }
    } else if (currentTab === 'gif') {
      const title = document.createElement('div');
      title.className = 'emoji-category-title';
      title.textContent = 'Trending GIFs';
      container.appendChild(title);

      const filteredGifs = gifList.filter(item => {
        if (!safeFilter) return true;
        return item.keywords.some(k => k.includes(safeFilter));
      });

      filteredGifs.forEach(item => {
        const div = document.createElement('div');
        div.className = 'gif-item';
        div.style.cssText = `
           background-image: url('${item.url}');
           background-size: cover;
           background-position: center;
           width: 100%;
           height: 100px;
           border-radius: 4px;
           cursor: pointer;
           grid-column: span 4; 
        `; 

        div.onclick = () => {
          const input = document.querySelector('.chatInput');
          if (input) {
            input.value += `[Image](${item.url})`;
            input.focus();
          }
        };

        div.onmouseenter = () => {
          const pEmoji = document.getElementById('previewEmoji');
          const pName = document.getElementById('previewName');
          if (pEmoji) pEmoji.textContent = 'GIF';
          if (pName) pName.textContent = 'GIF Image';
        };

        container.appendChild(div);
      });

      if (filteredGifs.length === 0) {
        const msg = document.createElement('div');
        msg.style.cssText = 'color: #b9bbbe; padding: 20px; text-align: center; grid-column: span 8;';
        msg.textContent = 'No GIFs found';
        container.appendChild(msg);
      }
    }
  };

  renderContent();

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderContent(e.target.value);
    });
  }

  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      console.log('Switched to tab:', currentTab);

      const sidebar = document.querySelector('.emoji-sidebar');
      if (sidebar) {
        sidebar.style.display = currentTab === 'emoji' ? 'flex' : 'none';
      }

      if (searchInput) {
        searchInput.value = '';
        searchInput.placeholder = currentTab === 'emoji' ? 'Find the perfect emoji' : 'Search Tenor';
      }
      renderContent();
    };
  });

  document.addEventListener('click', (e) => {
    const btn = document.querySelector('.chat-icon-btn');
    if (!picker.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      picker.style.display = 'none';
      if (searchInput) searchInput.value = '';
    }
  });
}

function setupMessageSearch() {
  const form = document.querySelector('.search-form');
  const input = document.getElementById('dmSearchInput');

  if (!form || !input) return;

  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  const newInput = document.getElementById('dmSearchInput');

  newForm.onsubmit = (e) => {
    e.preventDefault();
    handleSearchSubmit(newInput.value);
  };
}

function handleSearchSubmit(query) {
  if (!query.trim()) return;

  const sidebar = document.getElementById('searchResultsSidebar');
  const list = document.getElementById('searchResultsList');
  const countSpan = document.getElementById('searchResultCount');

  if (!sidebar || !list) return;

  list.innerHTML = ''; 
  sidebar.style.display = 'flex';

  const messages = document.querySelectorAll('.messagesDisplay p'); 
  let matchCount = 0;

  messages.forEach(msg => {

    const content = msg.textContent;
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    if (lowerContent.includes(lowerQuery)) {
      matchCount++;



      let username = "User";
      let messageText = content;
      let date = "";

      const firstColon = content.indexOf(':');
      const lastParenOpen = content.lastIndexOf('(');
      const lastParenClose = content.lastIndexOf(')');

      if (firstColon > -1) {
        username = content.substring(0, firstColon).trim();

        if (lastParenOpen > firstColon && lastParenClose > lastParenOpen) {
         
          messageText = content.substring(firstColon + 1, lastParenOpen).trim();
          date = content.substring(lastParenOpen + 1, lastParenClose);
        } else {
       
          messageText = content.substring(firstColon + 1).trim();
        }
      }

      const card = createSearchResultCard(username, messageText, date, query);
      list.appendChild(card);
    }
  });

  if (countSpan) {
    countSpan.textContent = `${matchCount} Results`;
  }
}

function createSearchResultCard(username, text, date, query) {
  const card = document.createElement('div');
  card.className = 'search-result-card';


  const regex = new RegExp(`(${query})`, 'gi');
  const highlightedText = text.replace(regex, '<span class="highlight">$1</span>');


  const avatarLetter = username.charAt(0).toUpperCase();

  card.innerHTML = `
    <div class="card-header">
      <div class="card-avatar">${avatarLetter}</div>
      <div class="card-meta">
        <span class="card-username">${username}</span>
        <span class="card-date">${date}</span>
      </div>
    </div>
    <div class="card-content">${highlightedText}</div>
  `;

  return card;
}

function closeSearchResults() {
  const sidebar = document.getElementById('searchResultsSidebar');
  if (sidebar) sidebar.style.display = 'none';
}

function toggleEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  if (picker.style.display === 'none') {
    picker.style.display = 'flex'; 
    const searchInput = document.getElementById('emojiSearchInput');
    if (searchInput) searchInput.focus();
  } else {
    picker.style.display = 'none';
  }
}


document.addEventListener('DOMContentLoaded', () => {
  setupEmojiPicker();
  setupMessageSearch();
});
