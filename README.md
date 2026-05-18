# SpendSnap

SpendSnap is an Expo React Native personal finance app built with Expo Router, NativeWind, Zustand, React Query, and Supabase integration.

## Features

- Expense tracking and history
- Category management
- Budget overview
- Transaction details
- Onboarding flow
- Local SQLite persistence
- Supabase sync support

## Project structure

- `spendsnap/`
  - `App.tsx` - Expo root entry
  - `app/` - Expo Router screens and routes
  - `services/` - app services (db, sync, OCR, SMS, etc.)
  - `stores/` - Zustand stores
  - `utils/` - helper utilities
  - `assets/` - static assets

## Setup

1. Install dependencies:

```bash
cd spendsnap
npm install
```

2. Start Expo:

```bash
npm start
```

3. Open the app with Expo Go or a compatible development build.

## Notes

- The project uses `expo-router` and requires the router entry at `index.ts`.
- Environment variables are stored in `.env`, but `.env` is ignored by Git.

## Useful commands

```bash
npm run android
npm run ios
npm run web
```
