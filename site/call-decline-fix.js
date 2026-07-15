import {joinRoom,selfId} from 'https://esm.sh/trystero@0.25.2';

const APP_ID='com.maksoftwares.ephemera.v1';
const handledReceipts=new Set();
let context=null;
let incomingExpiry=null;

const parseRoom=()=>{
  const match=location.hash.match(/^#\/room\/([^/]+)\/([^/]+)$/);
  return match?{id:match[1],secret:match[2]}:null;
};

const showToast=text=>{
  const toast=document.getElementById('toast');
  if(!toast)return;
  toast.textContent=text;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2800);
};

const addSystemNotice=text=>{
  const messages=document.getElementById('messages');
  const empty=document.getElementById('empty');
  if(!messages)return;
  empty?.classList.add('hidden');
  const notice=document.createElement('div');
  notice.className='system';
  notice.textContent=text;
  messages.append(notice);
  messages.scrollTop=messages.scrollHeight;
};

const peerLabel=peerId=>{
  const suffix=peerId.slice(-2).toUpperCase();
  const row=[...document.querySelectorAll('#people .person')].find(element=>element.querySelector('.person-name')?.textContent?.includes(suffix));
  return row?.querySelector('.person-name')?.textContent?.replace(' (you)','')||'The participant';
};

function rememberIncoming(data,peerId){
  if(!['invite','group-invite'].includes(data?.type)||!data.callId)return;
  clearTimeout(incomingExpiry);
  context.lastIncoming={
    callId:data.callId,
    peerId,
    kind:data.type==='group-invite'?'group':'direct',
  };
  incomingExpiry=setTimeout(()=>{
    if(context?.lastIncoming?.callId===data.callId)context.lastIncoming=null;
  },35000);
}

async function sendDeclineReceipt(invite){
  if(!context||!invite)return;
  const normalType=invite.kind==='group'?'group-decline':'decline';
  const receipt={
    callId:invite.callId,
    kind:invite.kind,
    recipientId:invite.peerId,
    declinedAt:Date.now(),
  };
  const options={target:invite.peerId};
  await Promise.allSettled([
    context.callAction.send({type:normalType,callId:invite.callId},options),
    context.declineAction.send(receipt,options),
  ]);
  setTimeout(()=>{
    context?.declineAction?.send({...receipt,retry:true},{target:invite.peerId}).catch(()=>{});
  },260);
}

function closeCallerRingingUi(){
  const outgoing=document.getElementById('outgoingModal');
  if(!outgoing||outgoing.classList.contains('hidden'))return false;

  // The application's cancel handler owns the private call state and timeout.
  // Triggering it guarantees that the caller stops ringing immediately. We
  // then replace its generic cancellation feedback with the real outcome.
  document.getElementById('outgoingStatus').textContent='Call declined';
  document.getElementById('cancelCall')?.click();
  queueMicrotask(()=>showToast('Call declined.'));
  addSystemNotice('Call declined');
  navigator.vibrate?.([120,70,120]);
  return true;
}

function handleDeclineReceipt(data,{peerId}){
  if(!data?.callId||(data.recipientId&&data.recipientId!==selfId))return;
  const receiptKey=`${data.kind||'direct'}:${data.callId}:${peerId}`;
  if(handledReceipts.has(receiptKey))return;
  handledReceipts.add(receiptKey);
  setTimeout(()=>handledReceipts.delete(receiptKey),60000);

  const label=peerLabel(peerId);
  if(data.kind==='group'){
    showToast(`${label} declined the group call.`);
    addSystemNotice(`${label} declined the group call`);
    return;
  }

  // The standard call-v2 decline is still sent. This dedicated receipt is a
  // second path that also repairs the caller UI when the normal control message
  // is delayed, dropped, or not reflected by the current cached client.
  if(!closeCallerRingingUi())showToast('Call declined.');
}

function installForRoom(){
  const descriptor=parseRoom();
  if(!descriptor)return;
  const key=`${descriptor.id}\u0000${descriptor.secret}`;
  if(context?.key===key)return;

  const room=joinRoom({appId:APP_ID,password:descriptor.secret,relayConfig:{redundancy:3}},descriptor.id);
  const callAction=room.makeAction('call-v2');
  const declineAction=room.makeAction('call-decline-v1');
  const appCallHandler=callAction.onMessage;

  context={key,room,callAction,declineAction,appCallHandler,lastIncoming:null};

  callAction.onMessage=(data,meta)=>{
    rememberIncoming(data,meta.peerId);
    if(context?.lastIncoming?.callId===data?.callId&&['cancel','hangup','group-end'].includes(data?.type))context.lastIncoming=null;
    return appCallHandler?.(data,meta);
  };
  declineAction.onMessage=handleDeclineReceipt;
}

document.getElementById('declineCall')?.addEventListener('click',()=>{
  const invite=context?.lastIncoming;
  if(!invite)return;
  context.lastIncoming=null;
  clearTimeout(incomingExpiry);
  sendDeclineReceipt(invite).catch(()=>{});
});

addEventListener('hashchange',()=>setTimeout(installForRoom,0));
setTimeout(installForRoom,0);
