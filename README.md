# DMS Connect

A mobile-friendly messaging app prototype built with Next.js, TypeScript, Supabase and Capacitor.

## Current implementation

- Email/password authentication with Supabase Auth
- User profiles and username-based discovery
- Direct conversations and group conversations
- Realtime text messaging
- Private conversation attachments (JPG, PNG, WEBP, PDF, TXT; 10 MB limit)
- WebRTC voice/video calling prototype using Supabase signaling
- PWA manifest and service-worker skeleton
- Capacitor configuration for Android packaging
- GitHub Actions workflow intended to produce a debug APK

## Stack

- Next.js 15 / React 19 / TypeScript
- Supabase Auth, Postgres, RLS, Realtime and Storage
- Capacitor for Android packaging

## Setup

1. Install Node.js 22+ and npm.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key.
4. Apply the SQL schema and migration in the `supabase` directory to the DMS Connect Supabase project.
5. Run `npm run dev` for local development.

## Important readiness notes

This is an in-progress prototype, not a production-ready messenger. The source package has not yet passed a full dependency install, production build, device test, or end-to-end test. Voice/video calling currently uses STUN only; a TURN service is still needed for reliable calls across mobile networks. Push notifications still need subscription management, VAPID configuration, and a server-side sender. The Android workflow can only be validated after the complete source tree is committed and CI runs.

Never commit Supabase service-role keys, private API keys, signing credentials, or other secrets. Configure secrets in the deployment provider instead.
