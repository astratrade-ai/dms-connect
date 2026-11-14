import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
    const url = Deno.env.get("SUPABASE_URL");
    const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? (secretKeysRaw ? JSON.parse(secretKeysRaw).default : undefined);
    if (!url || !serviceKey) throw new Error("Supabase server secret is not configured.");
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(authHeader.slice(7));
    if (authError || !authData.user) return Response.json({ error: "Invalid session" }, { status: 401, headers: cors });
    const body = await req.json();
    const conversationId = String(body.conversation_id || "");
    const message = String(body.message || "").slice(0, 300);
    if (!conversationId || !message) return Response.json({ error: "Missing conversation_id or message" }, { status: 400, headers: cors });
    const { data: membership } = await admin.from("conversation_members").select("user_id").eq("conversation_id", conversationId).eq("user_id", authData.user.id).maybeSingle();
    if (!membership) return Response.json({ error: "Forbidden" }, { status: 403, headers: cors });
    const { data: members, error: membersError } = await admin.from("conversation_members").select("user_id").eq("conversation_id", conversationId).neq("user_id", authData.user.id);
    if (membersError) throw membersError;
    const recipientIds = (members || []).map((x: { user_id: string }) => x.user_id);
    if (!recipientIds.length) return Response.json({ sent: 0 }, { headers: cors });
    const { data: subscriptions, error: subError } = await admin.from("push_subscriptions").select("id,subscription").in("user_id", recipientIds);
    if (subError) throw subError;
    if (!subscriptions?.length) return Response.json({ sent: 0, reason: "No registered devices" }, { headers: cors });
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublic || !vapidPrivate) return Response.json({ sent: 0, configured: false, reason: "VAPID secrets are not configured" }, { status: 503, headers: cors });
    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:admin@dmsconnect.app", vapidPublic, vapidPrivate);
    let sent = 0;
    const stale: string[] = [];
    await Promise.all(subscriptions.map(async (row: { id: string; subscription: unknown }) => {
      try {
        await webpush.sendNotification(row.subscription as webpush.PushSubscription, JSON.stringify({ title: "DMS Connect", body: message, url: "/" }));
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(row.id);
        else console.error("Push send failed", status);
      }
    }));
    if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);
    return Response.json({ sent, staleRemoved: stale.length }, { headers: cors });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500, headers: cors });
  }
});
