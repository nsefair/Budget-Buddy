# Budget Buddy — Mobile App

Personal finance app for 18–30 year olds. Combines AI coaching (Bud), Duolingo-style gamification, and Strava-inspired social features.

## Stack

- **Expo SDK 54** + **Expo Router** (typed routes)
- **TypeScript** (strict)
- **NativeWind v4** (Tailwind CSS for React Native)
- **Zustand** (global state)
- **React Query** (server state)
- **Axios** (HTTP)
- **React Native Animated** (animations — Expo Go compatible)
- **expo-blur**, **expo-haptics**, **expo-linear-gradient**, **expo-secure-store**
- Inter font via `@expo-google-fonts/inter`

> `react-native-reanimated` and `moti` are installed but currently unused in our code (they require a dev build, not Expo Go). We use the built-in `Animated` API. When you migrate to a dev build later, you can swap them in for spring physics — see `src/components/TabBar.tsx` for a noted swap location.

## Run It

From inside the `budget-buddy/` folder:

```bash
npm install         # only needed once
npm run ios         # opens iOS simulator
npm run android     # opens Android emulator
npm run start       # opens Metro and shows QR code for Expo Go
```

If anything seems stale or weird:

```bash
npm run reset-cache   # nukes Metro + Expo cache and restarts
npm run fix-deps      # re-pins all packages to SDK 54 versions
npm run doctor        # Expo's diagnostic tool
npm run typecheck     # confirms TypeScript is clean
```

## Project Structure

```
budget-buddy/
├── app/                     # Expo Router file-based routing
│   ├── _layout.tsx          # Root: providers, fonts, error boundary
│   ├── index.tsx            # Initial redirect by auth state
│   ├── (auth)/              # Public screens
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── onboarding.tsx
│   └── (tabs)/              # Authenticated app
│       ├── _layout.tsx      # Custom tab bar wiring
│       ├── today.tsx        # Tab 1 — Daily heartbeat
│       ├── budget.tsx       # Tab 2 — Money truth
│       ├── bud.tsx          # Tab 3 — AI guide (center, elevated)
│       ├── quests.tsx       # Tab 4 — Gamification hub
│       └── buds.tsx         # Tab 5 — Social
├── src/
│   ├── api/
│   │   ├── client.ts        # Axios instance + token refresh interceptor
│   │   └── endpoints.ts     # ALL route paths (single source of truth)
│   ├── services/            # ★ feature data layer (mock-aware)
│   │   ├── authService.ts
│   │   ├── todayService.ts
│   │   ├── budgetService.ts
│   │   ├── budService.ts
│   │   ├── questsService.ts
│   │   └── budsService.ts
│   ├── stores/
│   │   └── authStore.ts     # Zustand auth state
│   ├── hooks/
│   │   └── useAuth.ts       # Selector hooks (avoid re-renders)
│   ├── providers/
│   │   └── QueryProvider.tsx
│   ├── components/
│   │   ├── TabBar.tsx       # Custom premium tab bar (blur, gold accent)
│   │   ├── TabIcons.tsx     # SVG icons for each tab
│   │   ├── ErrorBoundary.tsx
│   │   └── AppSplash.tsx
│   ├── constants/
│   │   └── colors.ts        # Brand palette (navy, gold, emerald, coral, teal)
│   └── mock/                # Realistic dev fixtures for every feature
│       ├── user.ts
│       ├── budget.ts
│       ├── quests.ts
│       ├── bud.ts
│       └── buds.ts
├── assets/                   # icons, splash, fonts (none custom yet)
├── .env                      # ★ swap backends in one line (see below)
├── babel.config.js           # NativeWind + Reanimated plugin
├── tailwind.config.js        # Brand color palette as Tailwind tokens
└── tsconfig.json             # Path alias: @/* → src/*
```

## Environment Variables (`.env`)

```bash
EXPO_PUBLIC_API_URL=https://api.budgetbuddy.app/v1   # Where to send requests
EXPO_PUBLIC_USE_MOCK=true                            # Use local mock data (dev)
```

Set `EXPO_PUBLIC_USE_MOCK=false` and provide the real `EXPO_PUBLIC_API_URL` when the backend engineer is ready. **No code changes required.**

## How to Integrate the Real Backend Later

The architecture is layered so backend changes never reach the screen code:

```
Screen
  └─ calls Service (todayService, etc.)
        └─ Service checks IS_MOCK flag
              ├─ true  → returns mock data
              └─ false → calls api.get() → Axios → ASP.NET Core API
```

| Backend change | What you edit | Screens affected |
|---|---|---|
| Server URL | `.env` → `EXPO_PUBLIC_API_URL` | 0 |
| An endpoint path | `src/api/endpoints.ts` (one line) | 0 |
| Auth scheme (Bearer → cookie/etc) | `src/api/client.ts` request interceptor | 0 |
| A response field name | The `toUser` mapper in the service | 0 |
| Token storage (SecureStore → MMKV) | `TokenStore` helpers in `client.ts` | 0 |
| Going live (mock → real) | `.env` → `EXPO_PUBLIC_USE_MOCK=false` | 0 |

You should never have to ask the backend engineer to touch this repo. They give you:
- Base URL
- Authentication endpoint contracts (you've defined them in `endpoints.ts`)
- Any access tokens / API keys for development environments

## Brand & Voice

See `Budget Buddy Developer Review .txt` (one folder up) for the full brand book. Critical rules:

- **Bud** never says "you should" or "you must" — always educational framing
- Never expose financial data in the social feed (privacy is non-negotiable)
- Never use "ALERT", "WARNING", "DANGER", or shame-based copy
- Never use "delve", "navigate", "embark", "level up your finances", or other tells
- Friend-on-your-side tone: "Dining's running hot — $187 over. Want a quick look?"

## Known Limitations (As of Now)

1. **Animations use built-in `Animated`** instead of Reanimated — this is required for Expo Go compatibility. Migrate to Reanimated when moving to a dev build.
2. **Plaid + Stripe** are not integrated — those are server-side concerns the backend engineer is handling.
3. **No real auth** — currently auto-loads the mock user via `IS_MOCK`. Real auth flow is wired up but only fires when `EXPO_PUBLIC_USE_MOCK=false`.

## Common Issues

**"Cannot find module 'babel-preset-expo'"**
Run `npm install` from inside `budget-buddy/`. Don't run from the parent `BUD/` folder.

**"npx wants to install expo@latest"**
You're not in the project folder. `cd budget-buddy/` first.

**Red error screen with "Exception in HostFunction"**
You imported from `react-native-reanimated` somewhere. Use built-in `Animated` from `react-native` instead while in Expo Go.

**Stale visuals after editing**
`npm run reset-cache`
