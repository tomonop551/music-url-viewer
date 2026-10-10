"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatReply } from "@/types/chat";

const suggestions = ["ゆっくり落ち着きたい", "気分を上げたい", "クセになる曲が聴きたい"];

export function MusicChat({ available = true }: { available?: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => () => request.current?.abort(), []);

  async function send(text: string, reset = false) {
    if (inFlight.current || (!reset && !text.trim())) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reset ? { reset: true } : { message: text, startNew: messages.length === 0 }), signal: controller.signal });
      const data = (await response.json()) as { error?: unknown };
      if (!response.ok) throw Object.assign(new Error(typeof data.error === "string" ? data.error : "送信できませんでした。"), { name: "ChatRequestError" });
      if (reset) setMessages([]);
      else {
        const reply = data as ChatReply;
        setMessages(previous => [...previous, { role: "user", message: text, recommendations: [] }, { role: "assistant", ...reply }]);
      }
      setInput("");
    } catch (cause) {
      setError(cause instanceof Error && cause.name === "ChatRequestError" ? cause.message : cause instanceof Error && cause.name === "AbortError" ? "応答に時間がかかっています。少し待ってから再送してください。" : "送信できませんでした。接続を確認してもう一度お試しください。");
      if (!reset) setInput(text);
    } finally {
      clearTimeout(timer);
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="music-chat" className="fixed bottom-5 right-5 z-30 rounded-full bg-indigo-700 px-5 py-3 font-semibold text-white shadow-lg lg:hidden">
        {open ? "閉じる" : "気分から曲を探す"}
      </button>
      <aside id="music-chat" aria-label="気分から曲を探すチャット" className={`${open ? "flex" : "hidden"} fixed inset-x-3 top-4 bottom-20 z-20 flex-col overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-xl lg:sticky lg:top-6 lg:flex lg:h-[calc(100dvh-3rem)] lg:max-h-[900px] lg:shadow-sm`}>
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 p-5">
          <div><p className="text-xs font-semibold tracking-widest text-indigo-600">YOUR MUSIC COMPANION</p><h2 className="mt-1 text-xl font-bold text-gray-900">今、どんな気分？</h2><p className="mt-2 text-sm text-gray-500">登録された曲から、一緒に選びましょう。</p></div>
          <button type="button" disabled={busy} onClick={() => send("", true)} className="shrink-0 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40">新しい会話</button>
        </header>
        {available ? (
          <>
            <div role="log" aria-label="会話" aria-live="polite" aria-busy={busy} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              {messages.length === 0 && <div className="rounded-xl bg-indigo-50 p-4 text-sm leading-7 text-gray-700">落ち着きたい夜も、気分を上げたい朝も。<br />今の気分や、聴きたい曲の雰囲気を教えてください。</div>}
              {messages.map((message, index) => <div key={index} className={message.role === "user" ? "ml-8 rounded-xl bg-indigo-700 p-3 text-sm text-white" : "space-y-3 text-sm text-gray-700"}>
                <p className="whitespace-pre-wrap break-words leading-7">{message.message}</p>
                {message.recommendations.map(item => <article key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-700 underline decoration-indigo-200 underline-offset-4">{item.title} ↗</a>
                  <p className="mt-2 leading-6">{item.reason}</p>
                  <span className="mt-3 inline-block rounded-full bg-pink-50 px-2 py-1 text-xs text-pink-700">中毒性 {item.dopamine === undefined ? "未評価" : `${item.dopamine}/10`}</span>
                </article>)}
              </div>)}
              {busy && <p role="status" className="animate-pulse text-sm text-indigo-600">曲を探しています…</p>}
              <div ref={end} />
            </div>
            <div className="border-t border-gray-100 p-4">
              <div className="mb-3 flex flex-wrap gap-2">{(messages.length ? ["別の3曲を探して", "もっと落ち着いた曲"] : suggestions).map(text => <button key={text} type="button" disabled={busy} onClick={() => { setInput(text); void send(text); }} className="rounded-full border border-indigo-100 px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50 disabled:opacity-40">{text}</button>)}</div>
              {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
              <p className="mb-3 text-[11px] text-gray-500">曲情報: <a href="https://musicbrainz.org" target="_blank" rel="noopener noreferrer" className="underline">MusicBrainz</a> · 雰囲気との相性は推定です。</p>
              <form onSubmit={event => { event.preventDefault(); void send(input); }} className="flex items-end gap-2">
                <label htmlFor="chat-message" className="sr-only">今の気分や聴きたい曲</label>
                <textarea id="chat-message" rows={2} maxLength={1000} value={input} disabled={busy} onChange={event => setInput(event.target.value)} placeholder="今日は少し疲れた…" className="min-w-0 flex-1 resize-none rounded-xl border border-gray-300 p-3 text-sm text-gray-900 focus:outline-2 focus:outline-indigo-500 disabled:opacity-60" />
                <button type="submit" disabled={busy || !input.trim()} className="rounded-xl bg-indigo-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">送信</button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm leading-7 text-gray-500">AIチャットは準備中です。<br />しばらくしてからお試しください。</p>
          </div>
        )}
      </aside>
    </>
  );
}
