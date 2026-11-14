# DMS Connect device QA checklist

Use two separate Android phones and two distinct confirmed Supabase Auth accounts. Do not use the same account on both devices.

## Accounts and messaging
- [ ] Create account A and account B; complete email confirmation if enabled.
- [ ] Choose unique usernames for both accounts.
- [ ] From A, start a direct chat with B's username.
- [ ] Confirm the same chat appears on B.
- [ ] Send messages in both directions; check realtime delivery without refresh.
- [ ] Create a group from A, invite B, and confirm B can read/send messages.
- [ ] Upload a JPG/PNG and a PDF/TXT; confirm only group/direct members can read them.
- [ ] Try an unsupported file and a file over 10 MB; confirm rejection.

## Voice and video calls
- [ ] Grant microphone permission on both devices.
- [ ] Grant camera permission for video calls.
- [ ] Start audio call A → B; accept on B; verify two-way sound.
- [ ] End the call on either side and confirm both UIs close.
- [ ] Repeat B → A.
- [ ] Repeat video call; verify remote and local video.
- [ ] Test Wi-Fi ↔ mobile data and two different mobile carriers. STUN-only calls can fail behind restrictive NAT; production requires a TURN relay.

## Push notifications
- [ ] Configure matching VAPID public/private keys and VAPID_SUBJECT as Supabase Edge Function secrets.
- [ ] Open the supported HTTPS PWA/browser on Android and allow notifications.
- [ ] Register both devices; verify one row per device in push_subscriptions.
- [ ] Send a direct message while the recipient app is backgrounded.
- [ ] Confirm notification arrives; tap it and confirm app opens.
- [ ] For native Capacitor APK notifications, configure Firebase Android app, google-services.json, FCM credentials, and native push plugin before claiming native push support.

## Security and release
- [ ] Confirm user A cannot query B's private conversations or files.
- [ ] Confirm non-members cannot subscribe to or receive call signaling.
- [ ] Confirm signed-out users cannot access app data.
- [ ] Test expired/invalid sessions and account sign-out.
- [ ] Test app restart, network loss/reconnect, and low bandwidth.
- [ ] Complete privacy policy, terms, abuse reporting, block/report, rate limiting, backup/restore and release signing before Play Store publication.
