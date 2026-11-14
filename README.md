# DMS Connect

DMS Connect is a Bengali-first, mobile-friendly messaging MVP built with Next.js, TypeScript, Supabase and Capacitor.

## Implemented

- Email/password signup and login through Supabase Auth
- Profile setup with username
- Direct conversations and groups; invite group members by username
- Realtime text messages
- Private image/document attachments (JPG, PNG, WEBP, PDF, TXT; maximum 10 MB)
- Supabase Row Level Security on all public application tables
- One-to-one WebRTC audio/video call UI and signaling through Supabase Realtime
- Push subscription UI, private subscription storage, and authenticated `send-push` Edge Function
- Android debug APK GitHub Actions build pipeline

## Current limitations — do not treat as production-ready yet

- Voice/video uses STUN only (no TURN relay). It is not verified on two physical phones and may fail on restrictive mobile networks. Group calls are not supported.
- Web Push is not active until the matching `VAPID_PRIVATE_KEY` and `VAPID_PUBLIC_KEY` plus `VAPID_SUBJECT` are configured as Supabase Edge Function secrets. The public key is configured in the CI build. The private key must never be committed to GitHub.
- The current PushManager implementation targets supported secure-origin browsers/PWA. Native Android push delivery inside the Capacitor APK still needs Firebase Cloud Messaging configuration and a native Capacitor push plugin.
- No production web hosting domain has been deployed.
- No release-signed APK or Play Store bundle has been produced.
- Two-account and two-device end-to-end tests, load tests, backup/restore drills, privacy/terms pages, abuse reporting, blocking, and rate limiting remain to be completed.

## Stack

- Next.js 15.5.29, React 19.1.10, TypeScript
- Supabase Auth, Postgres, RLS, Realtime and Storage
- Supabase Edge Function `send-push`
- Capacitor 7 for Android packaging

## Local setup

1. Install Node.js 22+ and Java 21.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set the Supabase URL, publishable key, and VAPID public key.
4. Apply `supabase/migrations/20261114_dms_connect_features.sql` to the project if the schema is not already applied.
5. Run `npm run dev`.

## Push secret setup

In Supabase Dashboard → Edge Functions → Secrets, configure:
- `VAPID_PUBLIC_KEY`: the same public key used by the Android/web build
- `VAPID_PRIVATE_KEY`: matching private key (server-side only; never commit it)
- `VAPID_SUBJECT`: a contact URI such as `mailto:admin@example.com`

The Edge Function `send-push` verifies the caller JWT and confirms the caller belongs to the conversation before looking up recipients. It returns a configuration error until VAPID secrets are installed.

## Android debug APK

Workflow: `.github/workflows/android-debug-apk.yml`. It runs on pushes to `main` and can be started manually from GitHub Actions. It builds the static web bundle, adds Capacitor Android, adds camera/microphone permissions, and uploads `app-debug.apk` as `dms-connect-debug-apk` if all steps pass.

A debug APK is for testing only. A production Play Store release needs release signing credentials, a versioned release workflow, privacy disclosures, and a final device QA pass.

Never commit service-role keys, private API keys, VAPID private keys, signing credentials or other secrets.
