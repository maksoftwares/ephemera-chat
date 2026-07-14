const ROOM_STORAGE_KEY='ephemera.rooms.v1';
const MAX_SAVED_ROOMS=24;
const section=document.getElementById('roomHistorySection');
const list=document.getElementById('roomHistoryList');
const clearButton=document.getElementById('clearRoomHistory');
const renameCurrentButton=document.getElementById('renameRoomBtn');

function parseRoom(hash=location.hash){
  const match=String(hash).match(/^#\/room\/([^/]+)\/([^/]+)$/);
  if(!match)return null;
  const id=match[1].slice(0,200),secret=match[2].slice(0,500);
  return id&&secret?{id,secret}:null;
}
function roomKey(room){return `${room.id}\u0000${room.secret}`}
function defaultRoomName(id){return `Room ${id.slice(0,8)}`}
function storageAvailable(){
  try{const key='__ephemera_room_test__';localStorage.setItem(key,'1');localStorage.removeItem(key);return true}catch{return false}
}
function readRooms(){
  if(!storageAvailable())return [];
  try{
    const value=JSON.parse(localStorage.getItem(ROOM_STORAGE_KEY)||'[]');
    if(!Array.isArray(value))return [];
    const unique=new Map();
    for(const item of value){
      if(!item||typeof item.id!=='string'||typeof item.secret!=='string'||!item.id||!item.secret)continue;
      const room={
        id:item.id.slice(0,200),
        secret:item.secret.slice(0,500),
        name:typeof item.name==='string'&&item.name.trim()?item.name.trim().slice(0,60):defaultRoomName(item.id),
        lastVisited:Number.isFinite(item.lastVisited)?item.lastVisited:0,
      };
      const key=roomKey(room),existing=unique.get(key);
      if(!existing||room.lastVisited>existing.lastVisited)unique.set(key,room);
    }
    return [...unique.values()].sort((a,b)=>b.lastVisited-a.lastVisited).slice(0,MAX_SAVED_ROOMS);
  }catch{return []}
}
function writeRooms(rooms){
  try{localStorage.setItem(ROOM_STORAGE_KEY,JSON.stringify(rooms.slice(0,MAX_SAVED_ROOMS)));return true}catch{return false}
}
function roomUrl(room){return `${location.origin}${location.pathname}#/room/${room.id}/${room.secret}`}
function formatVisited(timestamp){
  if(!timestamp)return 'Saved room';
  try{return `Visited ${new Intl.RelativeTimeFormat(undefined,{numeric:'auto'}).format(-Math.max(0,Math.round((Date.now()-timestamp)/86400000)),'day')}`}catch{return 'Saved room'}
}
function notify(text){
  const toast=document.getElementById('toast');
  if(!toast)return;
  toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)
}
function findRoom(target){return readRooms().find(room=>roomKey(room)===roomKey(target))||null}
function updateRoom(target,patch){
  const rooms=readRooms(),key=roomKey(target),index=rooms.findIndex(room=>roomKey(room)===key);
  if(index<0)return false;
  rooms[index]={...rooms[index],...patch};rooms.sort((a,b)=>b.lastVisited-a.lastVisited);
  const saved=writeRooms(rooms);renderRooms();applyCurrentRoomName();return saved
}
function rememberRoom(room){
  const rooms=readRooms(),key=roomKey(room),existing=rooms.find(item=>roomKey(item)===key);
  const next={id:room.id,secret:room.secret,name:existing?.name||defaultRoomName(room.id),lastVisited:Date.now()};
  const updated=[next,...rooms.filter(item=>roomKey(item)!==key)].slice(0,MAX_SAVED_ROOMS);
  writeRooms(updated);renderRooms();applyCurrentRoomName()
}
function renameRoom(room){
  const saved=findRoom(room);if(!saved)return;
  const value=prompt('Rename this room on this device:',saved.name);
  if(value===null)return;
  const name=value.trim().slice(0,60);
  if(!name)return notify('Room name cannot be empty.');
  updateRoom(room,{name});notify('Room renamed on this device.')
}
function forgetRoom(room){
  const rooms=readRooms().filter(item=>roomKey(item)!==roomKey(room));
  writeRooms(rooms);renderRooms();notify('Room removed from this device.')
}
function rejoinRoom(room){location.hash=`#/room/${room.id}/${room.secret}`}
function createRoomRow(room){
  const article=document.createElement('article');article.className='room-history-item';
  const main=document.createElement('button');main.type='button';main.className='room-history-main';main.addEventListener('click',()=>rejoinRoom(room));
  const name=document.createElement('strong');name.className='room-history-name';name.textContent=room.name;
  const meta=document.createElement('span');meta.className='room-history-meta';meta.textContent=`${formatVisited(room.lastVisited)} · ${room.id.slice(0,8)}`;
  main.append(name,meta);
  const actions=document.createElement('div');actions.className='room-history-actions';
  const join=document.createElement('button');join.type='button';join.className='room-history-action primary-room-action';join.textContent='Join';join.addEventListener('click',()=>rejoinRoom(room));
  const rename=document.createElement('button');rename.type='button';rename.className='room-history-action';rename.textContent='Rename';rename.addEventListener('click',()=>renameRoom(room));
  const forget=document.createElement('button');forget.type='button';forget.className='room-history-action danger-room-action';forget.textContent='Forget';forget.addEventListener('click',()=>forgetRoom(room));
  actions.append(join,rename,forget);article.append(main,actions);return article
}
function renderRooms(){
  if(!section||!list)return;
  const rooms=readRooms();section.classList.toggle('hidden',rooms.length===0);list.replaceChildren(...rooms.map(createRoomRow))
}
function applyCurrentRoomName(){
  const current=parseRoom(),heading=document.getElementById('roomName');
  if(!current||!heading)return;
  const saved=findRoom(current);heading.textContent=saved?.name||`#${current.id.slice(0,10)}`
}
function syncCurrentRoom(){
  const current=parseRoom();
  if(current)rememberRoom(current);else renderRooms()
}

clearButton?.addEventListener('click',()=>{
  if(!confirm('Forget all saved room shortcuts on this device?'))return;
  try{localStorage.removeItem(ROOM_STORAGE_KEY)}catch{}
  renderRooms();notify('Saved rooms cleared.')
});
renameCurrentButton?.addEventListener('click',()=>{const room=parseRoom();if(room)renameRoom(room)});
addEventListener('hashchange',()=>setTimeout(syncCurrentRoom,0));
addEventListener('storage',event=>{if(event.key===ROOM_STORAGE_KEY){renderRooms();applyCurrentRoomName()}});
setTimeout(syncCurrentRoom,0);
