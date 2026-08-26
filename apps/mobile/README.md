# FaithTube — mobile app

The native client, built with Expo and React Native. It talks to the same API as
the web app and shares its palette and brand, but the navigation and layout are
designed for touch rather than adapted from the web.

## Running it

```bash
cd apps/mobile
npm install

# A phone cannot reach "localhost" — that is the phone itself. Use the LAN
# address of the machine running the API.
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 npx expo start
```

Then scan the QR code with Expo Go, or press `a` / `i` for an emulator.

To point the app at a deployment instead:

```bash
EXPO_PUBLIC_API_URL=https://your-app.onrender.com npx expo start
```

## What is here

| Screen | What it does |
|---|---|
| Home | Hero, Continue Watching, recommendations, trending, category rails |
| Watch | Player with chapters, transcript, like/save/share/report, related videos |
| Discover | Search, category grid, and the entry point to Bible Search |
| Bible Search | Scripture with AI commentary kept visibly separate and labelled |
| Faith Clips | Vertical short-form feed; only the visible clip plays |
| Create | Upload from the device library, then watch the real review pipeline |
| Connect | Subscriptions feed and the channels you follow |
| Channel | Channel page with subscribe |
| Profile | Account, notifications, Premium status, sign out |
| Report | The same reporting flow as the web client |

## Notes on the implementation

**Sessions.** React Native has no httpOnly cookie, so the app uses the Bearer
token the API already returns and stores it in the device keychain/keystore via
`expo-secure-store` — not `AsyncStorage`, which is plain text on disk.

**Background playback** is a Premium feature. In `expo-av` that is a property of
the audio session rather than of the player, so it is set from the viewer's
entitlement in `WatchScreen`.

**The clips feed** mounts a player only for the visible clip and its immediate
neighbours. Video players are expensive, and a long scroll otherwise exhausts
memory on lower-end devices.

**Monorepo resolution.** `metro.config.js` pins React and its renderer to the
copies inside this package. The web app pins different versions, and without
that, two copies of React can end up in one bundle.

## Building for the stores

```bash
npm install -g eas-cli
eas build --platform ios
eas build --platform android
```

`app.json` already declares the bundle identifiers, the background-audio
capability, and the media-library and camera permission strings the stores
require.
