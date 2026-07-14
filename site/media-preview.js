const imageExtensions=new Set(['jpg','jpeg','png','gif','webp','avif','bmp']);
const videoExtensions=new Set(['mp4','webm','ogv','mov','m4v']);
const audioExtensions=new Set(['mp3','wav','ogg','oga','m4a','aac','flac','opus','weba']);
const trackedBlobUrls=new Set();

const extensionOf=name=>{
  const clean=String(name||'').split(/[?#]/)[0];
  const index=clean.lastIndexOf('.');
  return index>=0?clean.slice(index+1).toLowerCase():'';
};
const formatBytes=value=>{
  const bytes=Number(value)||0;
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${(bytes/1024).toFixed(bytes<10240?1:0)} KB`;
  return `${(bytes/1024/1024).toFixed(bytes<10*1024*1024?1:0)} MB`;
};
const kindOf=(name,type='')=>{
  const mime=String(type).toLowerCase();
  if(mime.startsWith('image/'))return 'image';
  if(mime.startsWith('video/'))return 'video';
  if(mime.startsWith('audio/'))return 'audio';
  const ext=extensionOf(name);
  if(imageExtensions.has(ext))return 'image';
  if(videoExtensions.has(ext))return 'video';
  if(audioExtensions.has(ext))return 'audio';
  return 'file';
};

const viewer=document.createElement('div');
viewer.className='media-viewer hidden';
viewer.setAttribute('role','dialog');
viewer.setAttribute('aria-modal','true');
viewer.setAttribute('aria-label','Media preview');
viewer.innerHTML='<button class="media-viewer-close" type="button" aria-label="Close media preview">×</button><img alt=""><div class="media-viewer-name"></div>';
document.body.append(viewer);
const viewerImage=viewer.querySelector('img');
const viewerName=viewer.querySelector('.media-viewer-name');

function forceCloseViewer(){
  viewer.classList.add('hidden');
  viewerImage.removeAttribute('src');
  viewerImage.alt='';
  viewerName.textContent='';
  document.body.classList.remove('media-viewer-open');
}
function closeViewer(fromPop=false){
  if(viewer.classList.contains('hidden'))return;
  if(!fromPop&&history.state?.mediaPreview){history.back();return}
  forceCloseViewer();
}
function openViewer(url,name){
  viewerImage.src=url;
  viewerImage.alt=name;
  viewerName.textContent=name;
  viewer.classList.remove('hidden');
  document.body.classList.add('media-viewer-open');
  if(!history.state?.mediaPreview)history.pushState({...history.state,mediaPreview:true},'',location.href);
}
viewer.querySelector('.media-viewer-close').addEventListener('click',()=>closeViewer());
viewer.addEventListener('click',event=>{if(event.target===viewer)closeViewer()});
addEventListener('keydown',event=>{if(event.key==='Escape')closeViewer()});
addEventListener('popstate',()=>{if(!viewer.classList.contains('hidden'))closeViewer(true)});

async function enhanceAttachment(anchor){
  if(!(anchor instanceof HTMLAnchorElement)||anchor.dataset.mediaEnhanced==='true')return;
  const url=anchor.href;
  if(!url.startsWith('blob:'))return;
  anchor.dataset.mediaEnhanced='true';
  trackedBlobUrls.add(url);
  const name=anchor.getAttribute('download')||anchor.textContent?.replace(/^📎\s*/,'').trim()||'Attachment';
  let blob=null;
  try{blob=await fetch(url).then(response=>response.blob())}catch{}
  const kind=kindOf(name,blob?.type||'');
  if(kind==='file'){
    anchor.classList.add('attachment-download');
    anchor.textContent=`📎 ${name}`;
    return;
  }

  const card=document.createElement('section');
  card.className=`media-attachment media-${kind}`;
  const preview=document.createElement('div');
  preview.className='media-preview-surface';
  let media;
  if(kind==='image'){
    media=document.createElement('img');
    media.loading='lazy';
    media.decoding='async';
    media.alt=name;
    media.src=url;
    media.addEventListener('click',()=>openViewer(url,name));
    media.tabIndex=0;
    media.setAttribute('role','button');
    media.setAttribute('aria-label',`Open ${name}`);
    media.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openViewer(url,name)}});
  }else if(kind==='video'){
    media=document.createElement('video');
    media.src=url;
    media.controls=true;
    media.playsInline=true;
    media.preload='metadata';
  }else{
    media=document.createElement('audio');
    media.src=url;
    media.controls=true;
    media.preload='metadata';
  }
  media.className='chat-media';
  preview.append(media);

  const footer=document.createElement('div');
  footer.className='media-attachment-footer';
  const details=document.createElement('div');
  details.className='media-attachment-details';
  const title=document.createElement('strong');
  title.textContent=name;
  const meta=document.createElement('span');
  meta.textContent=`${kind[0].toUpperCase()+kind.slice(1)}${blob?` · ${formatBytes(blob.size)}`:''}`;
  details.append(title,meta);
  const download=document.createElement('a');
  download.href=url;
  download.download=name;
  download.className='media-download-button';
  download.textContent='Download';
  footer.append(details,download);
  card.append(preview,footer);
  anchor.replaceWith(card);
}

function scan(root=document){
  const anchors=[];
  if(root instanceof HTMLAnchorElement)anchors.push(root);
  if(root.querySelectorAll)anchors.push(...root.querySelectorAll('a[download][href^="blob:"]'));
  anchors.forEach(anchor=>enhanceAttachment(anchor));
}
const messages=document.getElementById('messages');
if(messages){
  new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===Node.ELEMENT_NODE)scan(node)}))).observe(messages,{childList:true,subtree:true});
  scan(messages);
}
function revokeTrackedUrls(){
  forceCloseViewer();
  for(const url of trackedBlobUrls)URL.revokeObjectURL(url);
  trackedBlobUrls.clear();
}
document.getElementById('clear')?.addEventListener('click',()=>setTimeout(revokeTrackedUrls,0));
addEventListener('hashchange',revokeTrackedUrls);
addEventListener('beforeunload',revokeTrackedUrls);
