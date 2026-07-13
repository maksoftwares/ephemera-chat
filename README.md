# Ephemera

Anonymous, browser-to-browser chat for people who share a room link. Ephemera has no application server and no chat database. A visitor sees only messages that arrive while their tab is connected; refreshing, closing, leaving, or clearing the tab removes that visitor's in-memory copy.

## Included

- Unique room URLs with a random room identifier and room secret
- Fresh anonymous identity on each page load
- Real-time text messages
- Typing indicators and online participant list
- Join and leave notices
- Replies and emoji reactions
- Image and file sharing with transfer progress (10 MB per file)
- Responsive desktop and mobile interface
- No accounts, cookies, analytics, message history, or browser storage
- WebRTC-encrypted peer-to-peer chat and file traffic
- Encrypted WebRTC signaling through public Nostr relays

## How it works

A static page alone cannot introduce browsers on different networks. Ephemera therefore uses [Trystero](https://trystero.dev/) to exchange encrypted WebRTC connection descriptions through public Nostr signaling relays. After peers connect, messages and files travel directly over encrypted WebRTC data channels; the app does not send chat content through those relays.

```text
Static host / ChatGPT Sites
        │ serves HTML, CSS, JavaScript only
        ▼
 Browser A ── encrypted WebRTC data ── Browser B
     │                                      │
     └──── encrypted connection setup ──────┘
                 public Nostr relays
```

The link format is:

```text
https://your-site.example/#/room/<room-id>/<room-secret>
```

The room secret is in the URL fragment (`#...`). Browsers do not include a fragment in the HTTP request sent to the static host. The secret is used by Trystero to encrypt session descriptions during peer discovery.

There is deliberately no history-sync message type. A newly joined or rejoined tab cannot request earlier messages from current participants.

## Local development

Requirements: a current Node.js release with npm.

```bash
npm install
npm run dev
```

Open the local URL Vite prints. To test a room, open the same generated room link in two separate browser profiles or a normal and private window.

## Checks and production build

```bash
npm run check
npm run preview
```

The production-ready static output is written to `dist/`. It uses relative asset paths, so it can be hosted from a root domain or a subpath.

## Deploy with GitHub Pages

This repository includes a GitHub Pages workflow at `.github/workflows/pages.yml`. After the first push:

1. Open **Settings → Pages** in GitHub.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Open **Actions → Deploy to GitHub Pages** and rerun the workflow if the first automatic run occurred before Pages was enabled.
4. Use the deployment URL shown by the workflow to test the same room link in separate tabs, browser profiles, or devices.

Each browsing context receives a fresh anonymous peer identity. Two tabs opening the same complete room URL therefore appear as two participants. The app does not use browser storage to preserve an identity between visits.

## Deploy with ChatGPT Sites

ChatGPT Sites can work from a compatible local project. Open this source folder in the ChatGPT desktop app or attach the project in the Sites workflow, then ask:

> Deploy this project with Sites. Check whether it is compatible, make any required hosting-only changes, save a reviewable version, and show me the preview before publishing.

In the preview:

1. Create a room.
2. Copy its room URL.
3. Open that URL in a separate private window or browser profile.
4. Verify both tabs show two participants and can exchange a message and a small file.
5. Publish with the access level that allows the intended visitors to open the Site.

The deployed runtime must permit outbound secure WebSocket connections used for signaling and normal WebRTC connections. If both test tabs remain on **Connecting**, the host may be blocking the public signaling relays; this cannot be solved by static frontend code alone.

## Privacy model

### What the app does not retain

- Message text, reactions, replies, typing state, and participant state stay in React memory only.
- Incoming files are represented by temporary in-memory object URLs.
- The app does not use `localStorage`, `sessionStorage`, IndexedDB, cookies, a service worker, or a message API.
- Closing or refreshing a tab destroys its current application state. A back-forward cache restore is forced through a reload to avoid reviving an old in-memory view.
- No message history is transferred to a newly joined peer.

### What “not retained” cannot guarantee

This design prevents the application from intentionally persisting chat content. It cannot prevent a participant from taking a screenshot, copying text, recording the screen, saving a file, using a browser extension, or running modified client code. The browser, operating system, network security software, or hosting/signaling providers may also retain operational metadata such as IP addresses, connection times, page requests, and logs. Do not treat this as an anti-forensics system.

Anyone who has the complete room link—including its fragment secret—can join while the room is active. There is no authentication, moderation, blocking, or verified identity.

## Scale and network limitations

Ephemera uses a full peer-to-peer mesh. With `n` participants, the room may create roughly `n × (n − 1) / 2` peer links. At 100 participants that is up to 4,950 links overall and 99 peer connections per browser. Text chat may work on capable devices and networks, but a reliable 100-person guarantee—especially for files—is not realistic without an SFU, relay, or managed realtime backend. Sending a 10 MB file to 99 peers can require close to 990 MB of uploader traffic.

WebRTC may also fail on restrictive corporate networks, carrier-grade NATs, VPNs, or firewalls when a direct path cannot be established. Production-grade fallback normally requires a TURN service, which would add external infrastructure and relay traffic.

## Security notes

- React renders message text as text, not HTML.
- Incoming protocol data is type-checked and length-limited.
- Text messages are limited to 4,000 characters.
- Files are limited to 10 MB and file names are sanitized.
- Only JPEG, PNG, GIF, WebP, and AVIF are shown inline; other files remain downloads.
- The room secret is generated with the Web Crypto API.
- No secret is hard-coded in the source or build.

For a public deployment, add moderation and abuse controls before promoting the app broadly. A public, anonymous link can be shared beyond its intended audience.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run lint` | Run Oxlint |
| `npm test` | Run protocol and room-link regression tests |
| `npm run build` | Type-check and build the static app |
| `npm run verify:static` | Check for persistence APIs and resolve build assets |
| `npm run check` | Run lint, tests, build, and static verification |
| `npm run preview` | Preview the built app locally |

## Project structure

```text
src/
  components/          Interface components
  hooks/               Ephemeral room and WebRTC state
  lib/                 Room links, protocol validation, formatting, identities
  App.tsx               Hash-based room routing
  App.css               Complete responsive design
  main.tsx              Browser entry point and BFCache protection
```

## License

MIT. Third-party packages remain under their respective licenses.
