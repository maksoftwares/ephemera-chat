import {joinRoom,selfId} from 'https://esm.sh/trystero@0.25.2';

const APP_ID='com.maksoftwares.ephemera.v1';
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
  setTimeout(()=>toast.classList.remove('show'),2600);
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
  const row=[...document.querySelectorAll('#people .person')].find(element=>element.querySelector('.person-name')?.textContent?.includes(peerId.slice(-2).toUpperCase()));
  return row?.querySelector('.person-name')?.textContent?.replace(' (you)','')||'A participant';
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
  const attempts=[
    context.callAction.send({type:normalType,callId:invite.callId},options),
    context.declineAction.send(receipt,options),
  ];
  await Promise.allSettled(attempts);
  setTimeout(()=>{
    context?.declineAction?.send({...receipt,retry:true},{target:invite.peerId}).catch(()=>{});
  },220);
}

function handleDeclineReceipt(data,{peerId}){
  if(!data?.callId||data.recipientId&&data.recipientId!==selfId)return;
  if(data.kind==='group'){
    const label=peerLabel(peerId);
    showToast(`${label} declined the group call.`);
    addSystemNotice(`${label} declined the group call`);
    return;
  }
  context?.appCallHandler?.({type:'decline',callId:data.callId},{peerId});
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
