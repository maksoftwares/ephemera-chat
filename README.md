# Ephemera Chat

Ephemera is an anonymous, browser-to-browser chat application with temporary text messages, file sharing, private voice calls, private video calls, browser call alerts, and installable Progressive Web App support.

## Privacy model

- Messages, replies, reactions, typing state, participants, calls, and received files exist only in browser memory.
- There is no chat database, account system, analytics SDK, or message-history API.
- A visitor joining later receives no earlier messages.
- Refreshing or closing a tab destroys that tab's visible conversation.
- The PWA service worker caches only static application files such as HTML, CSS, JavaScript, the manifest, and icons. It does not cache chat messages, call media, or transferred files.

This design cannot stop another participant from copying text, saving a file, recording a call, taking screenshots, or using modified client code.

## Features

- Unique room links
- A fresh anonymous identity for each tab or device
- Real-time text chat
- Replies, reactions, emoji, typing indicators, and join/leave notices
- File transfers up to 10 MB
- Private 1-to-1 voice and video calls
- Mute, camera toggle, call timer, incoming-call screen, busy/decline/no-answer handling
- Browser notifications for incoming calls while the page remains open and connected
- Installable PWA with standalone display and cached application shell
- Responsive desktop and mobile interface

## Architecture

The deployed application is static. It uses Trystero and WebRTC for peer discovery and direct encrypted browser-to-browser communication. Public Nostr relays are used for encrypted WebRTC signaling. No custom application backend is included.

```text
Static host
    │ serves site files
    ▼
Browser A ───── encrypted WebRTC ───── Browser B
    │                                        │
    └──── encrypted connection setup ────────┘
                    Nostr relays
```

The room secret is placed after `#` in the URL, so it is not sent to the static hosting server in the HTTP request.

## PWA installation

On supported desktop and Android browsers, use the **Install app** button or the browser's install option. On iPhone and iPad, open the Share menu and choose **Add to Home Screen**.

The app shell can reopen from the cache, but active chat, calls, peer discovery, and notifications still require network connectivity and an open connected Ephemera page.

## Deploying with Netlify

The repository contains `netlify.toml`. Netlify publishes the `site` directory directly and does not run a TypeScript build.

## Deploying with GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`. In GitHub, open **Settings → Pages** and select **GitHub Actions** as the deployment source.

## Static deployment files

```text
site/
  index.html
  app.js
  styles.css
  pwa.js
  pwa.css
  sw.js
  manifest.webmanifest
  icons/
```

## Important limitations

- Calls are one-to-one. Large group calls need an SFU or managed media service.
- Direct WebRTC can fail on restrictive networks without TURN relay infrastructure.
- Browser call alerts work only while an Ephemera page remains open and connected. Closed-browser push would require a push subscription and server-side sender.
- Full peer-to-peer mesh scaling is not reliable for 100 simultaneous users, particularly for calls and file transfers.

## License

MIT. Third-party packages remain under their respective licenses.
