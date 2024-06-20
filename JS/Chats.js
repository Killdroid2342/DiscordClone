import { JWTusername } from './Home.js';

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let peerConnection;
const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

async function startCall() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  localVideo.srcObject = localStream;

  peerConnection = new RTCPeerConnection(config);
  peerConnection.onicecandidate = handleIceCandidate;
  peerConnection.ontrack = handleRemoteStream;
  localStream
    .getTracks()
    .forEach((track) => peerConnection.addTrack(track, localStream));

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  await fetch(`https://yourserver/api/signaling/offer/${JWTusername}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'user1', data: JSON.stringify(offer) }),
  });

  pollAnswer();
}

async function pollAnswer() {
  const response = await fetch('https://yourserver/api/signaling/answer/user1');
  const answer = await response.json();
  if (answer) {
    const remoteDesc = new RTCSessionDescription(JSON.parse(answer));
    await peerConnection.setRemoteDescription(remoteDesc);
    pollIceCandidates();
  } else {
    setTimeout(pollAnswer, 1000);
  }
}

async function pollIceCandidates() {
  const response = await fetch(
    'https://localhost:7170/api/Signalling/pollicecandidate/user2'
  );
  const candidate = await response.json();
  if (candidate) {
    await peerConnection.addIceCandidate(JSON.parse(candidate));
  } else {
    setTimeout(pollIceCandidates, 1000);
  }
}

function handleIceCandidate(event) {
  if (event.candidate) {
    fetch('https://yourserver/api/signaling/candidate/user1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: 'user1',
        data: JSON.stringify(event.candidate),
      }),
    });
  }
}

function handleRemoteStream(event) {
  remoteVideo.srcObject = event.streams[0];
}

window.startCall = startCall;
