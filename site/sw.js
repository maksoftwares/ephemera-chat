self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const targetUrl=event.notification.data?.url||self.location.origin;
  event.waitUntil(
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
      for(const client of clients){
        if(new URL(client.url).origin===self.location.origin){
          if('navigate' in client&&client.url!==targetUrl)await client.navigate(targetUrl);
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    })
  )
});
