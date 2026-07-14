import {joinRoom,selfId} from 'https://esm.sh/trystero@0.25.2';

const $=id=>document.getElementById(id);
const landing=$('landing'),roomEl=$('room'),messages=$('messages'),empty=$('empty'),people=$('people'),peoplePanel=$('peoplePanel'),typing=$('typing');
let room=null,peers=new Set(),reply=null,typingTimer=null,peerTyping=new Map(),msgs=new Map();
let sendText=null,sendTyping=null,sendReactionAction=null,sendFile=null,sendCallSignal=null;
let callState=null,incomingInvite=null,localStream=null,remoteStream=null,callTimer=null,callTimeout=null;
let notificationRegistration=null,activeNotificationTag=null;

const words=['Amber','Azure','Bright','Calm','Cosmic','Golden','Minty','Neon','Quiet','Silver','Swift','Velvet'];
const animals=['Fox','Owl','Otter','Panda','Raven','Tiger','Wolf','Moth','Bear','Crane'];
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const user=id=>{const h=hash(id),w=words[h%words.length],a=animals[(h>>>7)%animals.length];return{id,name:`${w} ${a} · ${id.slice(-2).toUpperCase()}`,initials:w[0]+a[0],h:h%360}};
const me=user(selfId);
const toast=t=>{const el=$('toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)};
const escapeHtml=(s='')=>{const d=document.createElement('div');d.textContent=s;return d.innerHTML};
const token=()=>{const a=new Uint8Array(18);crypto.getRandomValues(a);return [...a].map(x=>x.toString(36).padStart(2,'0')).join('')};
const parse=()=>{const m=location.hash.match(/^#\/room\/([^/]+)\/([^/]+)$/);return m?{id:m[1],secret:m[2]}:null};
const open=r=>{location.hash=`#/room/${r.id}/${r.secret}`};

const notificationSupported=()=>('Notification' in window)&&('serviceWorker' in navigator)&&window.isSecureContext;
async function initNotificationSupport(){
  if(!notificationSupported()){updateNotificationButton();return}
  try{notificationRegistration=await navigator.serviceWorker.register('./sw.js')}catch(error){console.warn('Notification service worker registration failed.',error)}
  updateNotificationButton()
}
function updateNotificationButton(){
  const button=$('notifyBtn');if(!button)return;
  button.classList.remove('alert-on','alert-blocked');button.disabled=false;
  if(!notificationSupported()){button.textContent='Alerts unavailable';button.disabled=true;return}
  if(Notification.permission==='granted'){button.textContent='Call alerts on';button.classList.add('alert-on');button.disabled=true;return}
  if(Notification.permission==='denied'){button.textContent='Alerts blocked';button.classList.add('alert-blocked');button.disabled=true;return}
  button.textContent='Enable call alerts'
}
async function requestCallNotifications(){
  if(!notificationSupported())return toast('Browser call alerts need HTTPS and notification support.');
  try{
    const permission=await Notification.requestPermission();updateNotificationButton();
    if(permission==='granted'){if(!notificationRegistration)notificationRegistration=await navigator.serviceWorker.register('./sw.js');toast('Call alerts enabled.')}
    else if(permission==='denied')toast('Notifications are blocked. Change this site permission in your browser settings.');
  }catch{toast('Could not enable browser notifications.')}
}
async function closeCallNotification(){
  const tag=activeNotificationTag;activeNotificationTag=null;
  navigator.vibrate?.(0);
  if(!tag||!notificationRegistration)return;
  try{(await notificationRegistration.getNotifications({tag})).forEach(notification=>notification.close())}catch{}
}
async function showIncomingCallNotification(peerId,mode,callId){
  if(!notificationSupported()||Notification.permission!=='granted'||(!document.hidden&&document.hasFocus()))return;
  const caller=user(peerId),tag=`ephemera-call-${callId}`;activeNotificationTag=tag;
  const title=mode==='video'?'Incoming video call':'Incoming voice call';
  const options={
    body:`${caller.name} is calling. Return to Ephemera to answer.`,
    tag,
    renotify:true,
    requireInteraction:true,
    vibrate:[300,150,300,150,500],
    data:{url:location.href,callId}
  };
  try{
    if(!notificationRegistration)notificationRegistration=await navigator.serviceWorker.ready;
    await notificationRegistration.showNotification(title,options)
  }catch(error){
    try{
      const notification=new Notification(title,options);
      notification.onclick=()=>{window.focus();notification.close()}
    }catch{console.warn('Incoming call notification could not be shown.',error)}
  }
}

$('create').onclick=()=>open({id:token().slice(0,18),secret:token()});
$('join').onsubmit=e=>{e.preventDefault();try{const u=new URL($('link').value);const m=u.hash.match(/^#\/room\/([^/]+)\/([^/]+)$/);if(!m)throw new Error();$('error').textContent='';open({id:m[1],secret:m[2]})}catch{$('error').textContent='Paste a complete room link.'}};

function renderPeople(){
  people.innerHTML='';
  [me,...[...peers].map(user)].forEach((p,i)=>{
    const d=document.createElement('div');d.className='person';
    d.innerHTML=`<b class="avatar" style="--h:${p.h}">${p.initials}</b><span class="person-main"><strong class="person-name">${escapeHtml(p.name)}${i===0?' (you)':''}</strong><small class="person-sub">${i===0?'This tab':'Online now'}</small></span>${i===0?'':`<span class="person-calls"><button class="call-small voice-call" title="Voice call" aria-label="Voice call ${escapeHtml(p.name)}">☎</button><button class="call-small video-call" title="Video call" aria-label="Video call ${escapeHtml(p.name)}">📹</button></span>`}`;
    if(i>0){d.querySelector('.voice-call').onclick=()=>startOutgoingCall(p.id,'audio');d.querySelector('.video-call').onclick=()=>startOutgoingCall(p.id,'video')}
    people.append(d)
  });
  $('count').textContent=String(peers.size+1)
}

function addSystem(t){empty.classList.add('hidden');const d=document.createElement('div');d.className='system';d.textContent=t;messages.append(d);messages.scrollTop=messages.scrollHeight}
function addMsg(data,peerId=selfId){
  if(msgs.has(data.id))return;msgs.set(data.id,data);empty.classList.add('hidden');
  const p=user(peerId),wrap=document.createElement('article');wrap.className='msg'+(peerId===selfId?' self':'');wrap.dataset.id=data.id;
  const body=data.file?`<a href="${data.file.url}" download="${escapeHtml(data.file.name)}" style="color:inherit">📎 ${escapeHtml(data.file.name)}</a>`:escapeHtml(data.text);
  wrap.innerHTML=`<b class="avatar" style="--h:${p.h}">${p.initials}</b><div><div class="name">${escapeHtml(p.name)}</div><div class="bubble">${data.reply?`<div class="quote">${escapeHtml(data.reply)}</div>`:''}${body}</div><div class="meta"><span>${new Date(data.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span><button class="reply">Reply</button><button class="react">React</button></div><div class="reactions"></div></div>`;
  wrap.querySelector('.reply').onclick=()=>{reply=data.file?'Attachment: '+data.file.name:data.text;$('replyText').textContent='Replying to: '+reply;$('replybar').classList.remove('hidden');$('text').focus()};
  wrap.querySelector('.react').onclick=()=>sendReaction({id:data.id,emoji:'👍'});messages.append(wrap);messages.scrollTop=messages.scrollHeight
}
function showReaction(x){const el=messages.querySelector(`[data-id="${CSS.escape(x.id)}"] .reactions`);if(el){const s=document.createElement('span');s.className='reaction';s.textContent=x.emoji;el.append(s)}}
function sendReaction(x){showReaction(x);sendReactionAction?.(x)}

function setCallPerson(prefix,peerId){const p=user(peerId);$(prefix+'Avatar').textContent=p.initials;$(prefix+'Avatar').style.setProperty('--h',p.h);const nameId=prefix==='incoming'?'incomingTitle':prefix==='outgoing'?'outgoingName':'activeName';$(nameId).textContent=p.name}
function sendSignal(payload,target){sendCallSignal?.(payload,{target})}
function clearCallTimers(){clearTimeout(callTimeout);clearInterval(callTimer);callTimeout=null;callTimer=null}
function stopLocalStream(){if(localStream&&room&&callState?.peerId){try{room.removeStream(localStream,{target:callState.peerId})}catch{}}localStream?.getTracks().forEach(t=>t.stop());localStream=null;$('localVideo').srcObject=null}
function resetCallUi(){
  $('incomingModal').classList.add('hidden');$('outgoingModal').classList.add('hidden');$('activeCall').classList.add('hidden');$('remoteVideo').classList.add('hidden');$('localVideo').classList.add('hidden');$('voiceStage').classList.remove('hidden');$('cameraBtn').classList.add('hidden');$('mediaNote').classList.add('hidden');$('remoteVideo').srcObject=null;remoteStream=null
}
function cleanupCall(reason='',notify=false){
  const previous=callState;if(notify&&previous?.peerId)sendSignal({type:'hangup',callId:previous.callId},previous.peerId);
  clearCallTimers();closeCallNotification();stopLocalStream();callState=null;incomingInvite=null;resetCallUi();if(reason)toast(reason)
}
async function acquireMedia(mode){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Voice and video calls require HTTPS and a supported browser.');
  return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:mode==='video'?{facingMode:'user',width:{ideal:1280},height:{ideal:720}}:false})
}
async function beginConnectedCall(){
  if(!callState)return;
  try{
    localStream=await acquireMedia(callState.mode);
    if(!callState)return localStream.getTracks().forEach(t=>t.stop());
    $('activeCall').classList.remove('hidden');$('outgoingModal').classList.add('hidden');$('incomingModal').classList.add('hidden');
    setCallPerson('active',callState.peerId);$('callPeer').textContent=user(callState.peerId).name;$('activeMode').textContent=callState.mode==='video'?'Video call':'Voice call';
    if(callState.mode==='video'){$('voiceStage').classList.add('hidden');$('remoteVideo').classList.remove('hidden');$('localVideo').classList.remove('hidden');$('cameraBtn').classList.remove('hidden');$('localVideo').srcObject=localStream}else{$('voiceStage').classList.remove('hidden')}
    callState.startedAt=Date.now();updateCallTimer();callTimer=setInterval(updateCallTimer,1000);
    room.addStream(localStream,{target:callState.peerId,metadata:{kind:'ephemera-call',callId:callState.callId,mode:callState.mode}})
  }catch(error){sendSignal({type:'media-error',callId:callState?.callId},callState?.peerId);cleanupCall(error instanceof Error?error.message:'Could not access your microphone or camera.')}
}
function updateCallTimer(){if(!callState?.startedAt)return;const s=Math.floor((Date.now()-callState.startedAt)/1000);$('callTimer').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function startOutgoingCall(peerId,mode){
  if(!peers.has(peerId))return toast('That participant is no longer online.');
  if(callState||incomingInvite)return toast('Finish the current call first.');
  const callId=crypto.randomUUID();callState={callId,peerId,mode,direction:'outgoing',startedAt:null};setCallPerson('outgoing',peerId);$('outgoingType').textContent=mode==='video'?'Video calling…':'Voice calling…';$('outgoingStatus').textContent='Waiting for an answer';$('outgoingModal').classList.remove('hidden');sendSignal({type:'invite',callId,mode},peerId);
  callTimeout=setTimeout(()=>{if(callState?.callId===callId){sendSignal({type:'cancel',callId},peerId);cleanupCall('No answer.')}},30000)
}
function receiveInvite(data,peerId){
  if(callState||incomingInvite){sendSignal({type:'busy',callId:data.callId},peerId);return}
  if(!['audio','video'].includes(data.mode))return;
  incomingInvite={callId:data.callId,peerId,mode:data.mode};setCallPerson('incoming',peerId);$('incomingType').textContent=data.mode==='video'?'Incoming video call':'Incoming voice call';$('incomingModal').classList.remove('hidden');showIncomingCallNotification(peerId,data.mode,data.callId);
  callTimeout=setTimeout(()=>{if(incomingInvite?.callId===data.callId){sendSignal({type:'decline',callId:data.callId},peerId);incomingInvite=null;closeCallNotification();resetCallUi()}},30000)
}
async function acceptIncoming(){
  if(!incomingInvite)return;clearTimeout(callTimeout);closeCallNotification();callState={...incomingInvite,direction:'incoming',startedAt:null};incomingInvite=null;sendSignal({type:'accept',callId:callState.callId,mode:callState.mode},callState.peerId);await beginConnectedCall()
}
function declineIncoming(){if(!incomingInvite)return;sendSignal({type:'decline',callId:incomingInvite.callId},incomingInvite.peerId);incomingInvite=null;closeCallNotification();clearCallTimers();resetCallUi()}
async function handleCallSignal(data,peerId){
  if(!data?.type||!data.callId)return;
  if(data.type==='invite')return receiveInvite(data,peerId);
  if(incomingInvite?.callId===data.callId&&['cancel','hangup'].includes(data.type)){incomingInvite=null;closeCallNotification();clearCallTimers();resetCallUi();return}
  if(!callState||callState.callId!==data.callId||callState.peerId!==peerId)return;
  if(data.type==='accept'){clearTimeout(callTimeout);$('outgoingStatus').textContent='Connecting…';await beginConnectedCall()}
  if(data.type==='decline')cleanupCall('Call declined.')
  if(data.type==='busy')cleanupCall('That participant is already in another call.')
  if(data.type==='cancel')cleanupCall('Call cancelled.')
  if(data.type==='hangup')cleanupCall('Call ended.')
  if(data.type==='media-error')cleanupCall('The other participant could not access their microphone or camera.')
}
function handlePeerStream(stream,peerId,metadata){
  if(!callState||peerId!==callState.peerId||metadata?.kind!=='ephemera-call'||metadata?.callId!==callState.callId)return;
  remoteStream=stream;const video=$('remoteVideo');video.srcObject=stream;
  const play=()=>video.play().then(()=>$('mediaNote').classList.add('hidden')).catch(()=>$('mediaNote').classList.remove('hidden'));
  play();video.onclick=play
}

function setup(desc){
  cleanupCall();if(room)room.leave();landing.classList.add('hidden');roomEl.classList.remove('hidden');$('roomName').textContent='#'+desc.id.slice(0,10);peers=new Set();msgs.clear();messages.innerHTML='';messages.append(empty);empty.classList.remove('hidden');renderPeople();
  room=joinRoom({appId:'com.maksoftwares.ephemera.v1',password:desc.secret,relayConfig:{redundancy:3}},desc.id);
  const textA=room.makeAction('text-v1'),typeA=room.makeAction('typing-v1'),reactA=room.makeAction('reaction-v1'),fileA=room.makeAction('file-v1'),callA=room.makeAction('call-v1');
  sendText=textA.send;sendTyping=typeA.send;sendReactionAction=reactA.send;sendFile=fileA.send;sendCallSignal=callA.send;
  textA.onMessage=(x,{peerId})=>addMsg(x,peerId);reactA.onMessage=x=>showReaction(x);callA.onMessage=(x,{peerId})=>handleCallSignal(x,peerId);
  typeA.onMessage=(x,{peerId})=>{if(x.on){peerTyping.set(peerId,Date.now());typing.textContent=user(peerId).name+' is typing…';setTimeout(()=>{if(Date.now()-(peerTyping.get(peerId)||0)>1800)typing.textContent=''},2000)}else{peerTyping.delete(peerId);typing.textContent=''}};
  fileA.onMessage=(blob,{peerId,metadata})=>{const url=URL.createObjectURL(new Blob([blob]));addMsg({id:metadata.id,time:metadata.time,reply:metadata.reply,file:{name:metadata.name,url}},peerId)};
  room.onPeerStream=handlePeerStream;
  room.onPeerJoin=id=>{peers.add(id);renderPeople();addSystem(user(id).name+' joined')};
  room.onPeerLeave=id=>{peers.delete(id);renderPeople();addSystem(user(id).name+' left');if(callState?.peerId===id)cleanupCall('The other participant left the room.');if(incomingInvite?.peerId===id){incomingInvite=null;closeCallNotification();resetCallUi()}};
  $('status').textContent='Connected · encrypted peer-to-peer';
}

$('send').onclick=()=>{const text=$('text').value.trim();if(!text||!sendText)return;const x={id:crypto.randomUUID(),text,time:Date.now(),reply};addMsg(x);sendText(x);$('text').value='';reply=null;$('replybar').classList.add('hidden');sendTyping?.({on:false})};
$('text').oninput=()=>{sendTyping?.({on:true});clearTimeout(typingTimer);typingTimer=setTimeout(()=>sendTyping?.({on:false}),1200)};
$('text').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('send').click()}};
$('emoji').onclick=()=>{$('text').value+=' 😊';$('text').focus()};
$('fileBtn').onclick=()=>$('file').click();
$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>10*1024*1024){toast('File limit is 10 MB');return}const meta={id:crypto.randomUUID(),name:f.name,time:Date.now(),reply};addMsg({...meta,file:{name:f.name,url:URL.createObjectURL(f)}});await sendFile?.(f,{metadata:meta});e.target.value=''};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('Room link copied')}catch{toast('Copy the room URL from your address bar.')}};
$('clear').onclick=()=>{messages.innerHTML='';messages.append(empty);empty.classList.remove('hidden');msgs.clear()};
$('cancelReply').onclick=()=>{reply=null;$('replybar').classList.add('hidden')};
$('peopleToggle').onclick=()=>peoplePanel.classList.toggle('open');
$('notifyBtn').onclick=requestCallNotifications;
$('leave').onclick=()=>{cleanupCall('',true);room?.leave();room=null;history.replaceState(null,'',location.pathname);roomEl.classList.add('hidden');landing.classList.remove('hidden')};
$('acceptCall').onclick=acceptIncoming;$('declineCall').onclick=declineIncoming;
$('cancelCall').onclick=()=>cleanupCall('Call cancelled.',true);
$('hangupBtn').onclick=()=>cleanupCall('Call ended.',true);
$('muteBtn').onclick=()=>{const track=localStream?.getAudioTracks()[0];if(!track)return;track.enabled=!track.enabled;$('muteBtn').classList.toggle('off',!track.enabled);$('muteBtn').textContent=track.enabled?'🎙':'🔇'};
$('cameraBtn').onclick=()=>{const track=localStream?.getVideoTracks()[0];if(!track)return;track.enabled=!track.enabled;$('cameraBtn').classList.toggle('off',!track.enabled);$('cameraBtn').textContent=track.enabled?'📹':'🚫'};
addEventListener('visibilitychange',()=>{if(!document.hidden)closeCallNotification()});
addEventListener('hashchange',()=>{const p=parse();if(p)setup(p)});
addEventListener('beforeunload',()=>{cleanupCall('',true);room?.leave()});
initNotificationSupport();
const initial=parse();if(initial)setup(initial);
