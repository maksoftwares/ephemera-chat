const incomingModal=document.getElementById('incomingModal');
const activeCall=document.getElementById('activeCall');
const alertsButton=document.getElementById('notifyBtn');
let audioContext=null;
let ringTimer=null;
let titleTimer=null;
let wakeLock=null;
let originalTitle=document.title;

function callVisible(){return incomingModal&&!incomingModal.classList.contains('hidden')}
function activeCallVisible(){return activeCall&&!activeCall.classList.contains('hidden')}
async function unlockAudio(){
  try{
    audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')await audioContext.resume();
    const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
    gain.gain.value=0;oscillator.connect(gain).connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+.01)
  }catch{}
}
function tone(frequency,start,duration,volume=.11){
  if(!audioContext||audioContext.state!=='running')return;
  const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
  oscillator.type='sine';oscillator.frequency.value=frequency;
  gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.025);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  oscillator.connect(gain).connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+duration+.03)
}
function ringPulse(){
  if(!callVisible())return;
  unlockAudio().then(()=>{if(!audioContext)return;const now=audioContext.currentTime+.02;tone(720,now,.34);tone(900,now+.43,.42)});
  navigator.vibrate?.([380,160,380,750]);
}
async function requestWakeLock(){
  if(document.hidden||wakeLock||!('wakeLock'in navigator)||(!callVisible()&&!activeCallVisible()))return;
  try{wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null})}catch{}
}
function releaseWakeLock(){try{wakeLock?.release()}catch{}wakeLock=null}
function startRinging(){
  if(ringTimer)return;
  originalTitle=document.title;
  ringPulse();ringTimer=setInterval(ringPulse,2300);
  let on=false;titleTimer=setInterval(()=>{on=!on;document.title=on?'📞 Incoming call · Ephemera':originalTitle},750);
  requestWakeLock();
}
function stopRinging(){
  clearInterval(ringTimer);clearInterval(titleTimer);ringTimer=titleTimer=null;
  navigator.vibrate?.(0);document.title=originalTitle;
  if(!activeCallVisible())releaseWakeLock()
}
function syncCallExperience(){
  callVisible()?startRinging():stopRinging();
  activeCallVisible()?requestWakeLock():(!callVisible()&&releaseWakeLock())
}
if(incomingModal)new MutationObserver(syncCallExperience).observe(incomingModal,{attributes:true,attributeFilter:['class']});
if(activeCall)new MutationObserver(syncCallExperience).observe(activeCall,{attributes:true,attributeFilter:['class']});
document.addEventListener('pointerdown',unlockAudio,{passive:true});
document.addEventListener('keydown',unlockAudio,{passive:true});
alertsButton?.addEventListener('click',unlockAudio);
addEventListener('visibilitychange',()=>{if(!document.hidden){unlockAudio();requestWakeLock()}else releaseWakeLock()});
addEventListener('beforeunload',()=>{stopRinging();releaseWakeLock()});

if('ServiceWorkerRegistration'in window&&ServiceWorkerRegistration.prototype.showNotification){
  const original=ServiceWorkerRegistration.prototype.showNotification;
  ServiceWorkerRegistration.prototype.showNotification=function(title,options={}){
    const isCall=/call/i.test(String(title));
    return original.call(this,title,isCall?{silent:false,timestamp:Date.now(),...options}:options)
  }
}
