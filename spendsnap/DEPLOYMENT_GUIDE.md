# SpendSnap Deployment Guide

This is the production path for Android. Commands are meant to be run from the
`spendsnap` folder unless a step says otherwise.

## Quick Command Map

```bash
npm run doctor
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_KEY
npm run deploy:supabase:function
npm run build:android:preview
npm run build:android:production
```

`npm run doctor` checks local env, CLI availability, TypeScript, and Expo Doctor.

## 1. Accounts You Need

- Expo account
- Supabase account
- OpenAI API account
- Google Play Console account
- Google Cloud project for Google Sign-In OAuth

## 2. Supabase Setup

1. Create a new Supabase project.
2. Copy the project ref from Project Settings > General.
3. Login/link locally:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

4. Apply the database schema. Preferred:

```bash
npx supabase db push
```

If `db push` asks for migration setup or fails, use the manual fallback:

- Open Supabase Dashboard > SQL Editor.
- Paste and run `supabase.sql`.

5. Go to Authentication > Providers:
   - Enable Email.
   - Enable Google after creating OAuth credentials in Google Cloud.
6. Go to Storage and confirm the private `receipts` bucket exists.

## 3. Supabase Edge Function

Install Supabase CLI, then from the `spendsnap` folder:

```bash
npx supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_KEY
npm run deploy:supabase:function
```

The mobile app calls `ai-expense`; the OpenAI key must never be stored in Expo env.
The function requires a signed-in Supabase user, logs every AI request in `ai_usage`, and enforces daily AI limits:

- Free users: 20 AI calls/day
- Premium users with `subscriptions.status = 'active'`: 500 AI calls/day

Manual entry does not use AI and is not limited.

## 4. Expo Env

Create `.env` from `.env.example`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
EXPO_PUBLIC_SEED_DEMO_DATA=0
```

Restart Expo after changing `.env`.

Do not put `OPENAI_API_KEY` in `.env` for Expo/EAS. Keep it only in Supabase secrets.

Run:

```bash
npm run doctor
```

## 5. Local Test

```bash
npm install
npm run start
```

Test on Android:

- Sign up
- Sign in
- Quick Type AI
- AI Voice
- Scan Bill
- Save/edit/delete transactions
- Sync after app restart
- History filters
- Analytics
- Categories
- Budget
- Settings language switch

Offline behavior to test:

- Manual add/edit/delete transactions works offline because the app stores data in local SQLite.
- History, Analytics, Budget, Categories, and Settings read local data offline.
- Sync waits until Supabase is reachable again.
- AI Quick Type, AI Voice, Scan Bill, Google Sign-In, and receipt upload need internet.

## 6. EAS Setup

```bash
eas login
eas init
```

`eas init` will add a real `extra.eas.projectId` to `app.json`.
EAS CLI is already available on this machine at the time this guide was written.

## 7. Internal APK Build

Use this before Google Play:

```bash
npm run build:android:preview
```

Install the APK on your phone and test all production flows.

## 8. Google Play AAB Build

```bash
npm run build:android:production
```

Upload the generated `.aab` to Google Play Console.

## 9. Google Play Release Checklist

- App name, icon, screenshots
- Short and full description
- Privacy policy URL
- Data safety form
- Content rating
- Internal testing release first
- Production release after internal test passes

## 10. Security Rules

- Do not put `OPENAI_API_KEY` in Expo env.
- Keep Supabase service role key out of the app.
- Keep RLS enabled.
- Use Edge Functions for AI and payment verification.
- Review Supabase logs after test users use the app.

## 11. Production Cost Model

SpendSnap should not ask end users for their own AI keys. Users sign in and use the app; the app calls your Supabase Edge Function, and the Edge Function calls OpenAI using your server-side key. Control cost with:

- Daily AI limits in `ai_usage`.
- Premium entitlements in `subscriptions`.
- Google Play Billing before raising AI limits.
- OpenAI dashboard monthly budget alerts.
- Receipt image size/quality limits before upload.
