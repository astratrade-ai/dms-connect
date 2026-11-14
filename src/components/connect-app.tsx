"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Profile = { id: string; username: string | null; display_name: string };
type Conversation = { id: string; kind: "direct" | "group"; title: string | null; updated_at: string };
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };

export default function ConnectApp() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function loadConversations() {
    const { data: memberships, error } = await supabase.from("conversation_members").select("conversation_id").order("joined_at", { ascending: false });
    if (error) { setNotice(error.message); return; }
    const ids = (memberships || []).map(row => row.conversation_id);
    if (!ids.length) { setConversations([]); setActiveId(""); return; }
    const { data } = await supabase.from("conversations").select("id,kind,title,updated_at").in("id", ids).order("updated_at", { ascending: false });
    const list = (data || []) as Conversation[];
    setConversations(list);
    setActiveId(current => current && ids.includes(current) ? current : (list[0]?.id || ""));
  }

  useEffect(() => {
    if (!user) { setProfile(null); setConversations([]); setMessages([]); return; }
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from("profiles").select("id,username,display_name").eq("id", user.id).maybeSingle();
      if (error) { setNotice(error.message); return; }
      if (!data) {
        const name = String(user.user_metadata?.display_name || user.email?.split("@")[0] || "DMS User");
        const { data: created, error: createError } = await supabase.from("profiles").insert({ id: user.id, display_name: name }).select("id,username,display_name").single();
        if (createError) setNotice(createError.message);
        else if (alive) setProfile(created as Profile);
      } else if (alive) setProfile(data as Profile);
      await loadConversations();
    })();
    return () => { alive = false; };
  }, [user, supabase]);

  useEffect(() => {
    if (!user || !activeId) { setMessages([]); return; }
    let alive = true;
    supabase.from("messages").select("id,conversation_id,sender_id,body,created_at").eq("conversation_id", activeId).is("deleted_at", null).order("created_at", { ascending: true }).limit(100)
      .then(({ data, error }) => { if (alive) { if (error) setNotice(error.message); setMessages((data || []) as Message[]); } });
    const channel = supabase.channel("messages-" + activeId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "conversation_id=eq." + activeId }, payload => {
        const row = payload.new as Message;
        setMessages(old => old.some(item => item.id === row.id) ? old : [...old, row]);
      }).subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [activeId, user, supabase]);

  async function authenticate(e: FormEvent) {
    e.preventDefault(); setNotice("একটু অপেক্ষা করুন…");
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { display_name: email.split("@")[0] } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setNotice(result.error?.message || (mode === "signup" ? "অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল নিশ্চিতকরণ চালু থাকলে ইনবক্স দেখুন।" : "লগইন সফল।"));
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const clean = username.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(clean)) { setNotice("ইউজারনেম ৩–২৪ অক্ষরের ইংরেজি অক্ষর, সংখ্যা বা _ হতে হবে।"); return; }
    const { data, error } = await supabase.from("profiles").update({ username: clean, display_name: displayName.trim() || "DMS User" }).eq("id", user.id).select("id,username,display_name").single();
    if (error) setNotice(error.message); else { setProfile(data as Profile); setNotice("প্রোফাইল সংরক্ষিত হয়েছে।"); }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!user || !activeId || !draft.trim()) return;
    const body = draft.trim(); setDraft("");
    const { error } = await supabase.from("messages").insert({ conversation_id: activeId, sender_id: user.id, body });
    if (error) { setDraft(body); setNotice(error.message); }
  }

  async function createGroup() {
    if (!user) return;
    const title = window.prompt("গ্রুপের নাম লিখুন");
    if (!title?.trim()) return;
    const id = crypto.randomUUID();
    const { error } = await supabase.from("conversations").insert({ id, kind: "group", title: title.trim(), created_by: user.id });
    if (error) { setNotice(error.message); return; }
    const { error: memberError } = await supabase.from("conversation_members").insert({ conversation_id: id, user_id: user.id, member_role: "owner" });
    if (memberError) { setNotice(memberError.message); return; }
    await loadConversations(); setActiveId(id);
  }

  async function startDirect() {
    const name = window.prompt("অন্য ব্যক্তির DMS username লিখুন");
    if (!name?.trim()) return;
    const { data, error } = await supabase.rpc("create_direct_conversation", { p_username: name.trim() });
    if (error || !data) { setNotice(error?.message || "চ্যাট তৈরি করা যায়নি"); return; }
    await loadConversations(); setActiveId(data as string);
  }

  async function invite() {
    const active = conversations.find(c => c.id === activeId);
    if (!active || active.kind !== "group") return;
    const name = window.prompt("যাকে যুক্ত করবেন তার DMS username লিখুন");
    if (!name?.trim()) return;
    const { error } = await supabase.rpc("add_conversation_member", { p_conversation_id: active.id, p_username: name.trim() });
    setNotice(error?.message || "গ্রুপ সদস্য যুক্ত হয়েছে।");
  }

  async function attach(file?: File) {
    if (!file || !user || !activeId) return;
    const types = ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"];
    if (!types.includes(file.type) || file.size > 10 * 1024 * 1024) { setNotice("JPG, PNG, WEBP, PDF বা TXT ফাইল দিন (সর্বোচ্চ ১০ MB)।"); return; }
    const path = activeId + "/" + user.id + "/" + crypto.randomUUID() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const { error } = await supabase.storage.from("dms-attachments").upload(path, file, { contentType: file.type });
    if (error) { setNotice(error.message); return; }
    const { data } = await supabase.storage.from("dms-attachments").createSignedUrl(path, 3600);
    if (!data?.signedUrl) { setNotice("ফাইল লিংক তৈরি করা যায়নি।"); return; }
    const { error: messageError } = await supabase.from("messages").insert({ conversation_id: activeId, sender_id: user.id, body: "📎 " + file.name + "\n" + data.signedUrl });
    setNotice(messageError?.message || "ফাইল পাঠানো হয়েছে।");
  }

  const active = conversations.find(c => c.id === activeId);
  const filtered = conversations.filter(c => (c.title || (c.kind === "group" ? "গ্রুপ" : "ব্যক্তিগত চ্যাট")).toLowerCase().includes(search.toLowerCase()));

  if (loading) return <main className="center">DMS Connect চালু হচ্ছে…</main>;
  if (!user) return <main className="auth-wrap"><form className="auth-card" onSubmit={authenticate}>
    <div className="logo">D</div><p className="eyebrow">YOUR WORLD, CONNECTED</p><h1>DMS <span>Connect</span></h1>
    <p>সহজে কথা বলুন, কাছের মানুষদের সঙ্গে যুক্ত থাকুন।</p>
    <label>ইমেইল<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>
    <label>পাসওয়ার্ড<input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="কমপক্ষে ৬ অক্ষর"/></label>
    <button className="primary">{mode === "signup" ? "অ্যাকাউন্ট তৈরি করুন" : "লগইন করুন"}</button>
    <button type="button" className="link" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>{mode === "signup" ? "আগে অ্যাকাউন্ট আছে? লগইন করুন" : "নতুন ব্যবহারকারী? অ্যাকাউন্ট তৈরি করুন"}</button>
    {notice && <p className="notice">{notice}</p>}
  </form></main>;

  if (!profile?.username) return <main className="center"><form className="auth-card" onSubmit={saveProfile}>
    <div className="logo">D</div><h1>আপনার প্রোফাইল তৈরি করুন</h1><p>অন্যরা এই username দিয়ে আপনাকে খুঁজে পাবে।</p>
    <label>নাম<input value={displayName || profile?.display_name || ""} onChange={e => setDisplayName(e.target.value)} required/></label>
    <label>ইউজারনেম<input value={username} onChange={e => setUsername(e.target.value)} required placeholder="যেমন: siham_01"/></label>
    <button className="primary">প্রোফাইল সংরক্ষণ</button>{notice && <p className="notice">{notice}</p>}
  </form></main>;

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="logo small">D</div><div><b>DMS Connect</b><small>Stay connected</small></div></div>
      <div className="userline"><div className="avatar">{profile.display_name.slice(0,1).toUpperCase()}</div><div><b>{profile.display_name}</b><small>@{profile.username}</small></div><button className="link" onClick={() => supabase.auth.signOut()}>লগআউট</button></div>
      <div className="tools"><button onClick={startDirect}>＋ ব্যক্তিগত চ্যাট</button><button onClick={createGroup}>＋ নতুন গ্রুপ</button></div>
      <input className="search" placeholder="চ্যাট খুঁজুন" value={search} onChange={e => setSearch(e.target.value)}/>
      <div className="chat-list">{filtered.map(c => <button key={c.id} className={activeId === c.id ? "chat selected" : "chat"} onClick={() => setActiveId(c.id)}><span className="avatar">{(c.title || (c.kind === "group" ? "G" : "D")).slice(0,1).toUpperCase()}</span><span><b>{c.title || (c.kind === "group" ? "গ্রুপ" : "ব্যক্তিগত চ্যাট")}</b><small>{c.kind === "group" ? "গ্রুপ" : "ব্যক্তিগত"}</small></span></button>)}</div>
      <small className="privacy">আপনার কথোপকথন অ্যাকাউন্টভিত্তিক RLS নীতিতে সুরক্ষিত।</small>
    </aside>
    <section className="panel">
      <header><div><h2>{active?.title || (active ? "ব্যক্তিগত চ্যাট" : "স্বাগতম!")}</h2><p>{active ? "DMS Connect কথোপকথন" : "একটি চ্যাট নির্বাচন করুন"}</p></div>{active?.kind === "group" && <button onClick={invite}>সদস্য যোগ করুন</button>}</header>
      <div className="messages">{active ? messages.map(m => <article key={m.id} className={m.sender_id === user.id ? "mine" : ""}><p>{m.body}</p><time>{new Date(m.created_at).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" })}</time></article>) : <div className="empty"><div className="logo">D</div><h2>আপনার যোগাযোগের নতুন ঠিকানা</h2><p>ব্যক্তিগত চ্যাট বা গ্রুপ তৈরি করে শুরু করুন।</p></div>}</div>
      {active && <form className="composer" onSubmit={sendMessage}><label className="attach">＋<input type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" onChange={e => attach(e.target.files?.[0])}/></label><input value={draft} onChange={e => setDraft(e.target.value)} maxLength={10000} placeholder="একটি মেসেজ লিখুন…"/><button className="primary" disabled={!draft.trim()}>পাঠান</button></form>}
      {notice && <p className="notice bottom">{notice}</p>}
      <footer>DMS Connect • Voice/video call and push notifications are not enabled in this build.</footer>
    </section>
  </main>;
}
