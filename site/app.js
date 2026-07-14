import {joinRoom,selfId} from 'https://esm.sh/trystero@0.25.2';

const $=id=>document.getElementById(id);
const landing=$('landing'),roomEl=$('room'),messages=$('messages'),empty=$('empty'),people=$('people'),peoplePanel=$('peoplePanel'),peopleBackdrop=$('peopleBackdrop'),typing=$('typing');
let room=null,peers=new Set(),reply=null,typingTimer=null,peerTyping=new Map(),msgs=new Map();
let sendText=null,sendTyping=null,sendReactionAction=null,sendFile=null,sendCallSignal=null;
let callState=null,incomingInvite=null,localStream=null,remoteStream=null,callTimer=null,callTimeout=null;
let notificationRegistration=null,activeNotificationTag=null;
const groupTiles=new Map();

const words=['Amber','Azure','Bright','Calm','Cosmic','Golden','Minty','Neon','Quiet','Silver','Swift','Velvet'];
const animals=['Fox','Owl','Otter','Panda','Raven','Tiger','Wolf','Moth','Bear','Crane'];
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const user=id=>{const h=hash(id),w=words[h%words.length],a=animals[(h>>>7)%animals.length];return{id,name:`${w} ${a} · ${id.slice(-2).toUpperCase()}`,initials:w[0]+a[0],h:h%360}};
const me=user(selfId);
const toast=t=>{const el=$('toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400)};
const escapeHtml=(s='')=>{const d=document.createElement('div');d.textContent=s;return d.innerHTML};
const token=()=>{const a=new Uint8Array(18);crypto.getRandomValues(a);return [...a].map(x=>x.toString(36).padStart(2,'0')).join('')};
const parse=()=>{const m=location.hash.match(/^#\/room\/([^/]+)\/([^/]+)$/);return m?{id:m[1],secret:m[2]}:null};
const open=r=>{location.hash=`#/room/${r.id}/${r.secret}`};
const isMobile=()=>matchMedia('(max-width:760px)').matches;

const notificationSupported=()=>('Notification'in window)&&('serviceWorker'in navigator)&&window.isSecureContext;
async function initNotificationSupport(){
  if(!notificationSupported()){updateNotificationButton();return}
  try{notificationRegistration=await navigator.serviceWorker.register('./sw.js')}catch(error){console.warn('Notification service worker registration failed.',error)}
  updateNotificationButton()
}
function updateNotificationButton(){
  const button=$('notifyBtn');if(!button)return;
  button.classList.remove('alert-on','alert-blocked');button.disabled=false;
  if(!notificationSupported()){button.textContent='No alerts';button.disabled=true;return}
  if(Notification.permission==='granted'){button.textContent='Alerts on';button.classList.add('alert-on');button.disabled=true;return}
  if(Notification.permission==='denied'){button.textContent='Alerts blocked';button.classList.add('alert-blocked');button.disabled=true;return}
  button.textContent='Alerts'
}
async function requestCallNotifications(){
  if(!notificationSupported())return toast('Browser call alerts need HTTPS and notification support.');
  try{
    const permission=await Notification.requestPermission();updateNotificationButton();
    if(permission==='granted'){if(!notificationRegistration)notificationRegistration=await navigator.serviceWorker.register('./sw.js');toast('Call alerts enabled.')}
    else if(permission==='denied')toast('Notifications are blocked in your browser settings.')
  }catch{toast('Could not enable browser notifications.')}
}
async function closeCallNotification(){
  const tag=activeNotificationTag;activeNotificationTag=null;navigator.vibrate?.(0);
  if(!tag||!notificationRegistration)return;
  try{(await notificationRegistration.getNotifications({tag})).forEach(notification=>notification.close())}catch{}
}
async function showIncomingCallNotification(peerId,mode,callId,isGroup=false){
  if(!notificationSupported()||Notification.permission!=='granted'||(!document.hidden&&document.hasFocus()))return;
  const caller=user(peerId),tag=`ephemera-call-${callId}`;activeNotificationTag=tag;
  const title=isGroup?`Incoming group ${mode==='video'?'video':'voice'} call`:`Incoming ${mode==='video'?'video':'voice'} call`;
  const options={body:`${caller.name} is calling. Return to Ephemera to answer.`,tag,renotify:true,requireInteraction:true,vibrate:[300,150,300,150,500],data:{url:location.href,callId}};
  try{if(!notificationRegistration)notificationRegistration=await navigator.serviceWorker.ready;await notificationRegistration.showNotification(title,options)}catch(error){
    try{const notification=new Notification(title,options);notification.onclick=()=>{window.focus();notification.close()}}catch{console.warn('Incoming call notification could not be shown.',error)}
  }
}

$('create').onclick=()=>open({id:token().slice(0,18),secret:token()});
$('join').onsubmit=e=>{e.preventDefault();try{const u=new URL($('link').value);const m=u.hash.match(/^#\/room\/([^/]+)\/([^/]+)$/);if(!m)throw new Error();$('error').textContent='';open({id:m[1],secret:m[2]})}catch{$('error').textContent='Paste a complete room link.'}};

function forceClosePeoplePanel(){peoplePanel.classList.remove('open');peopleBackdrop.classList.remove('open');document.body.classList.remove('drawer-open')}
function openPeoplePanel(){
  if(peoplePanel.classList.contains('open'))return;
  peoplePanel.classList.add('open');peopleBackdrop.classList.add('open');document.body.classList.add('drawer-open');
  if(isMobile()&&!history.state?.peoplePanel)history.pushState({...history.state,peoplePanel:true},'',location.href)
}
function closePeoplePanel(fromPop=false){
  if(!peoplePanel.classList.contains('open'))return;
  if(!fromPop&&history.state?.peoplePanel){history.back();return}
  forceClosePeoplePanel()
}
async function shareRoom(){
  const data={title:'Join my Ephemera room',text:'Open this temporary Ephemera room to chat or call.',url:location.href};
  try{if(navigator.share){await navigator.share(data);return}await navigator.clipboard.writeText(location.href);toast('Room link copied')}catch(error){if(error?.name!=='AbortError')toast('Copy the room URL from your address bar.')}
}

function renderPeople(){
  people.innerHTML='';
  [me,...[...peers].map(user)].forEach((p,i)=>{
    const d=document.createElement('div');d.className='person';
    d.innerHTML=`<b class="avatar" style="--h:${p.h}">${p.initials}</b><span class="person-main"><strong class="person-name">${escapeHtml(p.name)}${i===0?' (you)':''}</strong><small class="person-sub">${i===0?'This tab':'Online now'}</small></span>${i===0?'':`<span class="person-calls"><button class="call-small voice-call" title="Voice call" aria-label="Voice call ${escapeHtml(p.name)}">☎</button><button class="call-small video-call" title="Video call" aria-label="Video call ${escapeHtml(p.name)}">📹</button></span>`}`;
    if(i>0){d.querySelector('.voice-call').onclick=()=>startOutgoingCall(p.id,'audio');d.querySelector('.video-call').onclick=()=>startOutgoingCall(p.id,'video')}
    people.append(d)
  });
  $('count').textContent=String(peers.size+1);$('groupVoiceBtn').disabled=peers.size===0;$('groupVideoBtn').disabled=peers.size===0
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
function sendSignal(payload,target){if(!sendCallSignal)return;target?sendCallSignal(payload,{target}):sendCallSignal(payload)}
function clearCallTimers(){clearTimeout(callTimeout);clearInterval(callTimer);callTimeout=null;callTimer=null}
function clearGroupTiles(){for(const tile of groupTiles.values()){const media=tile.querySelector('video,audio');if(media)media.srcObject=null;tile.remove()}groupTiles.clear()}
function stopLocalStream(){
  if(localStream&&room&&callState){
    const targets=callState.kind==='group'?[...(callState.streamedPeers||[])]:callState.peerId?[callState.peerId]:[];
    for(const target of targets){try{room.removeStream(localStream,{target})}catch{}}
  }
  localStream?.getTracks().forEach(track=>track.stop());localStream=null;$('localVideo').srcObject=null
}
function resetCallUi(){
  $('incomingModal').classList.add('hidden');$('outgoingModal').classList.add('hidden');$('activeCall').classList.add('hidden');$('remoteVideo').classList.add('hidden');$('localVideo').classList.add('hidden');$('voiceStage').classList.remove('hidden');$('groupGrid').classList.add('hidden');$('cameraBtn').classList.add('hidden');$('mediaNote').classList.add('hidden');$('remoteVideo').srcObject=null;remoteStream=null;clearGroupTiles();$('callTimer').textContent='00:00';$('muteBtn').classList.remove('off');$('muteBtn').textContent='🎙';$('cameraBtn').classList.remove('off');$('cameraBtn').textContent='📹'
}
function cleanupCall(reason='',notify=false){
  const previous=callState;
  if(notify&&previous){
    if(previous.kind==='direct'&&previous.peerId)sendSignal({type:'hangup',callId:previous.callId},previous.peerId);
    if(previous.kind==='group'){previous.hostId===selfId?sendSignal({type:'group-end',callId:previous.callId}):sendSignal({type:'group-leave',callId:previous.callId},previous.hostId)}
  }
  clearCallTimers();closeCallNotification();stopLocalStream();callState=null;incomingInvite=null;resetCallUi();if(reason)toast(reason)
}
async function acquireMedia(mode){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Voice and video calls require HTTPS and a supported browser.');
  return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:mode==='video'?{facingMode:'user',width:{ideal:1280},height:{ideal:720}}:false})
}
function updateCallTimer(){if(!callState?.startedAt)return;const seconds=Math.floor((Date.now()-callState.startedAt)/1000);$('callTimer').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')}
function startTimer(){callState.startedAt=Date.now();updateCallTimer();callTimer=setInterval(updateCallTimer,1000)}

async function beginDirectCall(){
  if(!callState||callState.kind!=='direct')return;
  try{
    localStream=await acquireMedia(callState.mode);if(!callState)return localStream.getTracks().forEach(track=>track.stop());
    $('activeCall').classList.remove('hidden');$('outgoingModal').classList.add('hidden');$('incomingModal').classList.add('hidden');$('groupGrid').classList.add('hidden');
    setCallPerson('active',callState.peerId);$('callPeer').textContent=user(callState.peerId).name;$('activeMode').textContent=callState.mode==='video'?'Video call':'Voice call';
    if(callState.mode==='video'){$('voiceStage').classList.add('hidden');$('remoteVideo').classList.remove('hidden');$('localVideo').classList.remove('hidden');$('cameraBtn').classList.remove('hidden');$('localVideo').srcObject=localStream}else{$('voiceStage').classList.remove('hidden')}
    startTimer();room.addStream(localStream,{target:callState.peerId,metadata:{kind:'ephemera-call',callId:callState.callId,mode:callState.mode}})
  }catch(error){sendSignal({type:'media-error',callId:callState?.callId},callState?.peerId);cleanupCall(error instanceof Error?error.message:'Could not access your microphone or camera.')}
}
function startOutgoingCall(peerId,mode){
  if(!peers.has(peerId))return toast('That participant is no longer online.');if(callState||incomingInvite)return toast('Finish the current call first.');
  forceClosePeoplePanel();const callId=crypto.randomUUID();callState={kind:'direct',callId,peerId,mode,direction:'outgoing',startedAt:null};setCallPerson('outgoing',peerId);$('outgoingType').textContent=mode==='video'?'Video calling…':'Voice calling…';$('outgoingStatus').textContent='Waiting for an answer';$('outgoingModal').classList.remove('hidden');sendSignal({type:'invite',callId,mode},peerId);
  callTimeout=setTimeout(()=>{if(callState?.callId===callId){sendSignal({type:'cancel',callId},peerId);cleanupCall('No answer.')}},30000)
}
function receiveDirectInvite(data,peerId){
  if(callState||incomingInvite){sendSignal({type:'busy',callId:data.callId},peerId);return}if(!['audio','video'].includes(data.mode))return;
  incomingInvite={kind:'direct',callId:data.callId,peerId,mode:data.mode};setCallPerson('incoming',peerId);$('incomingType').textContent=data.mode==='video'?'Incoming video call':'Incoming voice call';$('incomingDescription').textContent='Microphone and camera access are requested only after you accept.';$('incomingModal').classList.remove('hidden');showIncomingCallNotification(peerId,data.mode,data.callId,false);
  callTimeout=setTimeout(()=>{if(incomingInvite?.callId===data.callId){sendSignal({type:'decline',callId:data.callId},peerId);incomingInvite=null;closeCallNotification();resetCallUi()}},30000)
}

function updateGroupHeader(){if(callState?.kind!=='group')return;const total=callState.members?.size||1;$('callPeer').textContent=`Group ${callState.mode==='video'?'video':'voice'} · ${total} ${total===1?'person':'people'}`}
function createGroupTile(peerId,stream,isSelf=false){
  if(callState?.kind!=='group')return;removeGroupTile(peerId);
  const participant=user(peerId),tile=document.createElement('article');tile.className='group-tile'+(isSelf?' self':'');tile.dataset.peerId=peerId;
  if(callState.mode==='video'){
    const video=document.createElement('video');video.autoplay=true;video.playsInline=true;video.muted=isSelf;video.srcObject=stream;video.onclick=()=>video.play().catch(()=>{});tile.append(video);video.play().catch(()=>{})
  }else{
    const content=document.createElement('div');content.className='group-tile-audio';content.innerHTML=`<div class="call-avatar" style="--h:${participant.h}">${participant.initials}</div><strong>${escapeHtml(participant.name)}</strong><div class="group-tile-status">${isSelf?'You are in the call':'Connected'}</div>`;tile.append(content);
    if(!isSelf){const audio=document.createElement('audio');audio.autoplay=true;audio.srcObject=stream;tile.append(audio);audio.play().catch(()=>$('mediaNote').classList.remove('hidden'))}
  }
  const label=document.createElement('div');label.className='group-tile-name';label.textContent=isSelf?`${participant.name} (you)`:participant.name;tile.append(label);$('groupGrid').append(tile);groupTiles.set(peerId,tile)
}
function removeGroupTile(peerId){const tile=groupTiles.get(peerId);if(!tile)return;const media=tile.querySelector('video,audio');if(media)media.srcObject=null;tile.remove();groupTiles.delete(peerId)}
function showGroupCallUi(){
  $('activeCall').classList.remove('hidden');$('incomingModal').classList.add('hidden');$('outgoingModal').classList.add('hidden');$('groupGrid').classList.remove('hidden');$('remoteVideo').classList.add('hidden');$('localVideo').classList.add('hidden');$('voiceStage').classList.add('hidden');$('cameraBtn').classList.toggle('hidden',callState.mode!=='video');createGroupTile(selfId,localStream,true);updateGroupHeader();startTimer()
}
function ensureGroupStreamTo(peerId){
  if(callState?.kind!=='group'||!localStream||peerId===selfId||callState.streamedPeers.has(peerId)||!peers.has(peerId))return;
  room.addStream(localStream,{target:peerId,metadata:{kind:'ephemera-group-call',callId:callState.callId,mode:callState.mode}});callState.streamedPeers.add(peerId)
}
function applyGroupMembers(members){
  if(callState?.kind!=='group')return;callState.members=new Set(members.filter(id=>id===selfId||peers.has(id)));callState.members.add(selfId);
  for(const peerId of callState.members)ensureGroupStreamTo(peerId);
  for(const peerId of [...groupTiles.keys()])if(peerId!==selfId&&!callState.members.has(peerId))removeGroupTile(peerId);
  updateGroupHeader()
}
function publishGroupMembers(){
  if(callState?.kind!=='group'||callState.hostId!==selfId)return;const members=[...callState.members];
  for(const peerId of members)if(peerId!==selfId)sendSignal({type:'group-members',callId:callState.callId,mode:callState.mode,members},peerId);updateGroupHeader()
}
async function startGroupCall(mode){
  if(peers.size===0)return toast('Invite at least one other person before starting a group call.');if(callState||incomingInvite)return toast('Finish the current call first.');
  forceClosePeoplePanel();const callId=crypto.randomUUID();callState={kind:'group',callId,mode,hostId:selfId,members:new Set([selfId]),streamedPeers:new Set(),startedAt:null};
  try{localStream=await acquireMedia(mode);if(!callState)return localStream.getTracks().forEach(track=>track.stop());showGroupCallUi();for(const peerId of peers)sendSignal({type:'group-invite',callId,mode},peerId);toast(`Group ${mode==='video'?'video':'voice'} call started.`)}catch(error){cleanupCall(error instanceof Error?error.message:'Could not access your microphone or camera.')}
}
function receiveGroupInvite(data,peerId){
  if(callState||incomingInvite){sendSignal({type:'group-busy',callId:data.callId},peerId);return}if(!['audio','video'].includes(data.mode))return;
  incomingInvite={kind:'group',callId:data.callId,peerId,hostId:peerId,mode:data.mode};setCallPerson('incoming',peerId);$('incomingType').textContent=`Incoming group ${data.mode==='video'?'video':'voice'} call`;$('incomingDescription').textContent='Join everyone who accepts in this room-wide call.';$('incomingModal').classList.remove('hidden');showIncomingCallNotification(peerId,data.mode,data.callId,true);
  callTimeout=setTimeout(()=>{if(incomingInvite?.callId===data.callId){sendSignal({type:'group-decline',callId:data.callId},peerId);incomingInvite=null;closeCallNotification();resetCallUi()}},30000)
}
async function acceptIncoming(){
  if(!incomingInvite)return;clearTimeout(callTimeout);closeCallNotification();const invite=incomingInvite;incomingInvite=null;
  if(invite.kind==='direct'){callState={...invite,direction:'incoming',startedAt:null};sendSignal({type:'accept',callId:callState.callId,mode:callState.mode},callState.peerId);await beginDirectCall();return}
  callState={kind:'group',callId:invite.callId,mode:invite.mode,hostId:invite.hostId,members:new Set([selfId,invite.hostId]),streamedPeers:new Set(),startedAt:null};
  try{localStream=await acquireMedia(invite.mode);if(!callState)return localStream.getTracks().forEach(track=>track.stop());showGroupCallUi();sendSignal({type:'group-join',callId:callState.callId,mode:callState.mode},callState.hostId)}catch(error){sendSignal({type:'group-decline',callId:invite.callId},invite.hostId);cleanupCall(error instanceof Error?error.message:'Could not access your microphone or camera.')}
}
function declineIncoming(){
  if(!incomingInvite)return;const invite=incomingInvite;sendSignal({type:invite.kind==='group'?'group-decline':'decline',callId:invite.callId},invite.peerId);incomingInvite=null;closeCallNotification();clearCallTimers();resetCallUi()
}
async function handleCallSignal(data,peerId){
  if(!data?.type||!data.callId)return;
  if(data.type==='invite')return receiveDirectInvite(data,peerId);
  if(data.type==='group-invite')return receiveGroupInvite(data,peerId);
  if(incomingInvite?.callId===data.callId&&['cancel','hangup','group-end'].includes(data.type)){incomingInvite=null;closeCallNotification();clearCallTimers();resetCallUi();return}
  if(data.type==='group-join'&&callState?.kind==='group'&&callState.hostId===selfId&&callState.callId===data.callId){callState.members.add(peerId);ensureGroupStreamTo(peerId);publishGroupMembers();return}
  if(data.type==='group-members'&&callState?.kind==='group'&&callState.callId===data.callId){applyGroupMembers(Array.isArray(data.members)?data.members:[]);return}
  if(data.type==='group-leave'&&callState?.kind==='group'&&callState.hostId===selfId&&callState.callId===data.callId){callState.members.delete(peerId);callState.streamedPeers.delete(peerId);removeGroupTile(peerId);publishGroupMembers();return}
  if(data.type==='group-end'&&callState?.kind==='group'&&callState.callId===data.callId){cleanupCall('Group call ended.');return}
  if(!callState||callState.kind!=='direct'||callState.callId!==data.callId||callState.peerId!==peerId)return;
  if(data.type==='accept'){clearTimeout(callTimeout);$('outgoingStatus').textContent='Connecting…';await beginDirectCall()}
  if(data.type==='decline')cleanupCall('Call declined.');if(data.type==='busy')cleanupCall('That participant is already in another call.');if(data.type==='cancel')cleanupCall('Call cancelled.');if(data.type==='hangup')cleanupCall('Call ended.');if(data.type==='media-error')cleanupCall('The other participant could not access their microphone or camera.')
}
function handlePeerStream(stream,peerId,metadata){
  if(!callState||metadata?.callId!==callState.callId)return;
  if(callState.kind==='direct'&&peerId===callState.peerId&&metadata?.kind==='ephemera-call'){
    remoteStream=stream;const video=$('remoteVideo');video.srcObject=stream;const play=()=>video.play().then(()=>$('mediaNote').classList.add('hidden')).catch(()=>$('mediaNote').classList.remove('hidden'));play();video.onclick=play;return
  }
  if(callState.kind==='group'&&metadata?.kind==='ephemera-group-call'&&callState.members.has(peerId))createGroupTile(peerId,stream,false)
}

function setup(desc){
  cleanupCall();if(room)room.leave();forceClosePeoplePanel();landing.classList.add('hidden');roomEl.classList.remove('hidden');$('roomName').textContent='#'+desc.id.slice(0,10);peers=new Set();msgs.clear();messages.innerHTML='';messages.append(empty);empty.classList.remove('hidden');renderPeople();
  room=joinRoom({appId:'com.maksoftwares.ephemera.v1',password:desc.secret,relayConfig:{redundancy:3}},desc.id);
  const textA=room.makeAction('text-v1'),typeA=room.makeAction('typing-v1'),reactA=room.makeAction('reaction-v1'),fileA=room.makeAction('file-v1'),callA=room.makeAction('call-v2');
  sendText=textA.send;sendTyping=typeA.send;sendReactionAction=reactA.send;sendFile=fileA.send;sendCallSignal=callA.send;
  textA.onMessage=(x,{peerId})=>addMsg(x,peerId);reactA.onMessage=x=>showReaction(x);callA.onMessage=(x,{peerId})=>handleCallSignal(x,peerId);
  typeA.onMessage=(x,{peerId})=>{if(x.on){peerTyping.set(peerId,Date.now());typing.textContent=user(peerId).name+' is typing…';setTimeout(()=>{if(Date.now()-(peerTyping.get(peerId)||0)>1800)typing.textContent=''},2000)}else{peerTyping.delete(peerId);typing.textContent=''}};
  fileA.onMessage=(blob,{peerId,metadata})=>{const url=URL.createObjectURL(new Blob([blob]));addMsg({id:metadata.id,time:metadata.time,reply:metadata.reply,file:{name:metadata.name,url}},peerId)};
  room.onPeerStream=handlePeerStream;
  room.onPeerJoin=id=>{peers.add(id);renderPeople();addSystem(user(id).name+' joined');if(callState?.kind==='group'&&callState.hostId===selfId)sendSignal({type:'group-invite',callId:callState.callId,mode:callState.mode},id)};
  room.onPeerLeave=id=>{
    peers.delete(id);renderPeople();addSystem(user(id).name+' left');removeGroupTile(id);
    if(callState?.kind==='direct'&&callState.peerId===id)cleanupCall('The other participant left the room.');
    if(callState?.kind==='group'){
      callState.streamedPeers?.delete(id);callState.members?.delete(id);
      if(callState.hostId===id)cleanupCall('The group-call host left the room.');else if(callState.hostId===selfId)publishGroupMembers();else updateGroupHeader()
    }
    if(incomingInvite?.peerId===id){incomingInvite=null;closeCallNotification();resetCallUi()}
  };
  $('status').textContent='Connected · encrypted peer-to-peer'
}

$('send').onclick=()=>{const text=$('text').value.trim();if(!text||!sendText)return;const x={id:crypto.randomUUID(),text,time:Date.now(),reply};addMsg(x);sendText(x);$('text').value='';reply=null;$('replybar').classList.add('hidden');sendTyping?.({on:false})};
$('text').oninput=()=>{sendTyping?.({on:true});clearTimeout(typingTimer);typingTimer=setTimeout(()=>sendTyping?.({on:false}),1200)};
$('text').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('send').click()}};
$('emoji').onclick=()=>{$('text').value+=' 😊';$('text').focus()};$('fileBtn').onclick=()=>$('file').click();
$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>10*1024*1024){toast('File limit is 10 MB');return}const meta={id:crypto.randomUUID(),name:f.name,time:Date.now(),reply};addMsg({...meta,file:{name:f.name,url:URL.createObjectURL(f)}});await sendFile?.(f,{metadata:meta});e.target.value=''};
$('copy').onclick=shareRoom;$('inviteBtn').onclick=shareRoom;$('panelInviteBtn').onclick=shareRoom;
$('clear').onclick=()=>{messages.innerHTML='';messages.append(empty);empty.classList.remove('hidden');msgs.clear()};$('cancelReply').onclick=()=>{reply=null;$('replybar').classList.add('hidden')};
$('peopleToggle').onclick=openPeoplePanel;$('peopleClose').onclick=()=>closePeoplePanel();$('peopleBackdrop').onclick=()=>closePeoplePanel();
$('groupVoiceBtn').onclick=()=>startGroupCall('audio');$('groupVideoBtn').onclick=()=>startGroupCall('video');
$('notifyBtn').onclick=requestCallNotifications;
$('leave').onclick=()=>{forceClosePeoplePanel();cleanupCall('',true);room?.leave();room=null;history.replaceState(null,'',location.pathname);roomEl.classList.add('hidden');landing.classList.remove('hidden')};
$('acceptCall').onclick=acceptIncoming;$('declineCall').onclick=declineIncoming;$('cancelCall').onclick=()=>cleanupCall('Call cancelled.',true);$('hangupBtn').onclick=()=>cleanupCall('Call ended.',true);
$('muteBtn').onclick=()=>{const track=localStream?.getAudioTracks()[0];if(!track)return;track.enabled=!track.enabled;$('muteBtn').classList.toggle('off',!track.enabled);$('muteBtn').textContent=track.enabled?'🎙':'🔇'};
$('cameraBtn').onclick=()=>{const track=localStream?.getVideoTracks()[0];if(!track)return;track.enabled=!track.enabled;$('cameraBtn').classList.toggle('off',!track.enabled);$('cameraBtn').textContent=track.enabled?'📹':'🚫'};
$('mediaNote').onclick=()=>{const elements=[...document.querySelectorAll('#activeCall video,#activeCall audio')];Promise.allSettled(elements.map(element=>element.play())).then(()=>$('mediaNote').classList.add('hidden'))};
addEventListener('popstate',()=>{if(peoplePanel.classList.contains('open'))closePeoplePanel(true)});
addEventListener('resize',()=>{if(!isMobile())forceClosePeoplePanel()});
addEventListener('visibilitychange',()=>{if(!document.hidden)closeCallNotification()});
addEventListener('hashchange',()=>{const p=parse();if(p)setup(p)});
addEventListener('beforeunload',()=>{cleanupCall('',true);room?.leave()});
initNotificationSupport();const initial=parse();if(initial)setup(initial);
