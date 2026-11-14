# DMS Connect

DMS Connect is a Bengali-first, mobile-friendly messaging MVP built with Next.js, TypeScript, Supabase and Capacitor.

## Implemented in the current repository

- Email/password signup and login through Supabase Auth
- Profile setup with unique username
- Create direct conversations by username
- Create groups and invite members by username
- Realtime text messaging
- Private file attachments (JPG, PNG, WEBP, PDF and TXT; 10 MB maximum)
- Row Level Security and private Supabase Storage bucket
- Android debug APK GitHub Actions workflow

## Not yet enabled or verified

- Voice/video calling is not included in the current committed UI. A previous prototype is available in the downloadable source archive, but has not passed device-to-device testing.
- Push notifications are not active; a push subscription flow and secure server-side VAPID sender still need implementation.
- No release-signed APK or Play Store package has been produced.
- No production web deployment has been configured.
- The app has not passed end-to-end tests with two real user accounts or an Android device.

## Stack and setup

- Next.js 15.5.29 / React 19.1.10 / TypeScript
- Supabase Auth, Postgres, RLS, Realtime and Storage
- Capacitor 7 for Android packaging

1. Install Node.js 22+ and Java 21.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set the Supabase project URL and publishable key.
4. Apply `supabase/migrations/20261114_dms_connect_features.sql` to the Supabase project (the linked DMS Connect project already has the feature tables and policies applied).
5. Run `npm run dev`.

## Android debug APK

The workflow `.github/workflows/android-debug-apk.yml` runs on pushes to `main` and can also be started manually from GitHub Actions. It builds a static web bundle, adds the Capacitor Android project, applies camera/microphone permissions for future calling support, and uploads `app-debug.apk` as the `dms-connect-debug-apk` artifact if all steps pass.

A debug APK is for testing only. A production Play Store release requires a separately configured signing key and release workflow.

Never commit service-role keys, private API keys, signing credentials or other secrets.
