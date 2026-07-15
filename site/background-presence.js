const STORAGE_KEY='ephemera.backgroundMode.v1';
const RECOVERY_KEY='ephemera.lastRecovery.v1';
const buttons=()=>[document.getElementById('backgroundModeBtn'),document.getElementById('panelBackgroundBtn')].filter(Boolean);
const trackedConnections=new Set();
const NativePeerConnection=globalThis.RTCPeerConnection;

if(NativePeerConnection){
  class TrackedPeerConnection extends NativePeerConnection{
    constructor(...args){
      super(...args);
      trackedConnections.add(this);
      const cleanup=()=>{if(this.connectionState==='closed')trackedConnections.delete(this)};
      this.addEventListener('connectionstatechange',cleanup);
    }
    close(){trackedConnections.delete(this);return super.close()}
  }
  globalThis.RTCPeerConnection=TrackedPeerConnection;
}

let audioContext=null;
let oscillator=null;
let gainNode=null;
let destination=null;
let audioElement=null;
let enabled=false;
let hiddenAt=document.hidden?Date.now():0;
let recoveryTimer=null;

const roomOpen=()=>/^#\/room\/[^/]+\/[^/]+$/.test(location.hash);
const storedEnabled=()=>{try{return localStorage.getItem(STORAGE_KEY)==='1'}catch{return false}};
const saveEnabled=value=>{try{value?localStorage.setItem(STORAGE_KEY,'1'):localStorage.removeItem(STORAGE_KEY)}catch{}};
const notify=text=>{
  const toast=document.getElementById('toast');
  if(!toast)return;
  toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600);
};

function updateButtons(){
  const label=enabled?'Background on':storedEnabled()?'Resume background':'Stay online';
  buttons().forEach(button=>{
    button.textContent=label;
    button.classList.toggle('background-on',enabled);
    button.setAttribute('aria-pressed',String(enabled));
  });
}

function configureMediaSession(){
  if(!('mediaSession'in navigator))return;
  try{
    navigator.mediaSession.metadata=new MediaMetadata({title:'Ephemera room active',artist:'Background connection mode',album:'Ephemera Chat'});
    navigator.mediaSession.setActionHandler('play',()=>startBackgroundMode(false));
    navigator.mediaSession.setActionHandler('pause',()=>stopBackgroundMode(false));
    navigator.mediaSession.playbackState='playing';
  }catch{}
}

async function startBackgroundMode(showMessage=true){
  if(enabled)return;
  try{
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)throw new Error('Audio playback is not supported.');
    audioContext=new AudioContextClass();
    await audioContext.resume();
    oscillator=audioContext.createOscillator();
    gainNode=audioContext.createGain();
    destination=audioContext.createMediaStreamDestination();
    oscillator.type='sine';
    oscillator.frequency.value=28;
    gainNode.gain.value=0.000001;
    oscillator.connect(gainNode).connect(destination);
    audioElement=new Audio();
    audioElement.srcObject=destination.stream;
    audioElement.autoplay=true;
    audioElement.playsInline=true;
    audioElement.volume=1;
    oscillator.start();
    await audioElement.play();
    enabled=true;saveEnabled(true);configureMediaSession();updateButtons();
    if(showMessage)notify('Background mode enabled. Android may still stop the app under battery or memory pressure.');
  }catch(error){
    stopBackgroundMode(false);
    notify(error instanceof Error?error.message:'Could not enable background mode.');
  }
}

function stopBackgroundMode(showMessage=true){
  try{oscillator?.stop()}catch{}
  try{audioElement?.pause()}catch{}
  if(audioElement)audioElement.srcObject=null;
  try{audioContext?.close()}catch{}
  oscillator=gainNode=destination=audioElement=audioContext=null;
  enabled=false;saveEnabled(false);
  if('mediaSession'in navigator){try{navigator.mediaSession.playbackState='none';navigator.mediaSession.metadata=null}catch{}}
  updateButtons();
  if(showMessage)notify('Background mode disabled.');
}

async function toggleBackgroundMode(){
  if(enabled)stopBackgroundMode();else await startBackgroundMode();
}

function connectionAlive(){
  for(const connection of trackedConnections){
    const state=connection.connectionState;
    const ice=connection.iceConnectionState;
    if(['new','connecting','connected'].includes(state)||['new','checking','connected','completed'].includes(ice))return true;
  }
  return false;
}

function scheduleRecovery(reason){
  clearTimeout(recoveryTimer);
  recoveryTimer=setTimeout(()=>recoverConnection(reason),1400);
}

function recoverConnection(reason){
  if(!roomOpen()||document.hidden)return;
  const awayFor=hiddenAt?Date.now()-hiddenAt:0;
  hiddenAt=0;
  const shouldRecover=document.wasDiscarded||awayFor>12000&&!connectionAlive();
  if(!shouldRecover)return;
  let last=0;
  try{last=Number(sessionStorage.getItem(RECOVERY_KEY)||0)}catch{}
  if(Date.now()-last<20000)return;
  try{sessionStorage.setItem(RECOVERY_KEY,String(Date.now()))}catch{}
  notify(`Reconnecting after ${reason}…`);
  setTimeout(()=>location.reload(),350);
}

buttons().forEach(button=>button.addEventListener('click',toggleBackgroundMode));
addEventListener('visibilitychange',()=>{
  if(document.hidden){hiddenAt=Date.now();return}
  if(storedEnabled()&&!enabled)startBackgroundMode(false).catch(()=>{});
  scheduleRecovery('background suspension');
});
addEventListener('focus',()=>scheduleRecovery('focus return'));
addEventListener('pageshow',()=>scheduleRecovery('page restore'));
addEventListener('online',()=>scheduleRecovery('network return'));
document.addEventListener('resume',()=>scheduleRecovery('browser resume'));
document.addEventListener('freeze',()=>{hiddenAt=hiddenAt||Date.now()});
addEventListener('beforeunload',()=>{try{oscillator?.stop()}catch{}});

updateButtons();
if(document.wasDiscarded)scheduleRecovery('discarded page');
