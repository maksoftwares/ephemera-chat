let deferredInstallPrompt=null;
const buttons=()=>[...document.querySelectorAll('[data-install]')];
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const isIos=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
const showToast=text=>{
  const toast=document.getElementById('toast');
  if(!toast)return;
  toast.textContent=text;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2400);
};
function updateButtons(){
  const show=!isStandalone()&&Boolean(deferredInstallPrompt||isIos());
  buttons().forEach(button=>{
    button.classList.toggle('hidden',!show);
    button.textContent=isIos()&&!deferredInstallPrompt?'Add to Home Screen':'Install app';
  });
}
async function installApp(){
  if(isStandalone())return showToast('Ephemera is already installed.');
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    const choice=await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null;
    updateButtons();
    showToast(choice.outcome==='accepted'?'Installing Ephemera…':'Installation cancelled.');
    return;
  }
  if(isIos())return showToast('On iPhone or iPad: tap Share, then Add to Home Screen.');
  showToast('Use the browser menu and choose Install app or Add to Home screen.');
}
function updateNetworkStatus(){
  const room=document.getElementById('room');
  const status=document.getElementById('status');
  if(!status||!room||room.classList.contains('hidden'))return;
  status.classList.toggle('offline',!navigator.onLine);
  status.textContent=navigator.onLine?'Connected · encrypted peer-to-peer':'Offline · reconnect to resume';
}
buttons().forEach(button=>button.addEventListener('click',installApp));
addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;updateButtons()});
addEventListener('appinstalled',()=>{deferredInstallPrompt=null;updateButtons();showToast('Ephemera installed.')});
addEventListener('online',updateNetworkStatus);
addEventListener('offline',updateNetworkStatus);
addEventListener('hashchange',()=>setTimeout(updateNetworkStatus,0));
if('serviceWorker'in navigator&&window.isSecureContext){navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(error=>console.warn('PWA service worker registration failed.',error))}
updateButtons();
