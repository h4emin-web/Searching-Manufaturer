import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Manufacturer } from "@/pages/Index";

interface ConversationMsg {
  role: "us" | "manufacturer";
  body: string;
  sent_at: string;
}

interface ManufacturerThread {
  manufacturer_id: string;
  manufacturer_name: string;
  country: string;
  email: string;
  status: string;
  sent_at: string;
  email_subject: string;
  email_body: string;
  web_form_url: string;
  error: string;
  escalated_questions: string[];
  missing_items: string[];
  conversation: ConversationMsg[];
  has_reply: boolean;
  auto_reply_count: number;
}

interface SourcingDashboardProps {
  apiName: string;
  manufacturers: Manufacturer[];
  outreachPlanId: string;
  apiBase: string;
}

const STATUS_CONFIG: Record<string, { emoji: string; label: string; bg: string; text: string; border: string }> = {
  pending:   { emoji: "⏳", label: "대기중",        bg: "bg-zinc-50 dark:bg-zinc-900",       text: "text-zinc-500",             border: "border-zinc-200 dark:border-zinc-700" },
  crawling:  { emoji: "🔍", label: "처리중",        bg: "bg-zinc-50 dark:bg-zinc-900",       text: "text-zinc-500",             border: "border-zinc-200 dark:border-zinc-700" },
  sending:   { emoji: "📤", label: "발송중",        bg: "bg-blue-50 dark:bg-blue-950",       text: "text-blue-600",             border: "border-blue-200 dark:border-blue-800" },
  sent:      { emoji: "📤", label: "발송완료",      bg: "bg-blue-50 dark:bg-blue-950",       text: "text-blue-600",             border: "border-blue-200 dark:border-blue-800" },
  webform:   { emoji: "🌐", label: "홈페이지 문의", bg: "bg-orange-50 dark:bg-orange-950",   text: "text-orange-600",           border: "border-orange-200 dark:border-orange-800" },
  failed:    { emoji: "❌", label: "실패",          bg: "bg-red-50 dark:bg-red-950",         text: "text-red-600",              border: "border-red-200 dark:border-red-800" },
  replied:   { emoji: "💬", label: "답장 수신",     bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-700",          border: "border-emerald-300 dark:border-emerald-700" },
  escalated: { emoji: "⚠️", label: "검토 필요",    bg: "bg-amber-50 dark:bg-amber-950",     text: "text-amber-700",            border: "border-amber-300 dark:border-amber-700" },
  completed: { emoji: "✅", label: "수집 완료",     bg: "bg-emerald-100 dark:bg-emerald-900",text: "text-emerald-800 font-bold", border: "border-emerald-400 dark:border-emerald-600" },
  closed:    { emoji: "🚫", label: "공급 불가",     bg: "bg-zinc-100 dark:bg-zinc-800",      text: "text-zinc-400",             border: "border-zinc-200 dark:border-zinc-700" },
};

function formatDate(iso: string) {
  if (!iso) return "";
  const normalized = /[Zz+]/.test(iso) ? iso : iso + "Z";
  const d = new Date(normalized);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3600000;
  if (diffH < 24) return d.toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function isKorean(text: string) {
  return /[가-힯]/.test(text);
}

function EmailBody({ body, apiBase }: { body: string; apiBase: string }) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [translated, setTranslated] = useState("");
  const [translating, setTranslating] = useState(false);
  const needsTranslation = !isKorean(body) && body.trim().length > 0;

  const handleTranslate = async () => {
    if (translated) { setShowTranslation(v => !v); return; }
    setTranslating(true);
    try {
      const res = await fetch(`${apiBase}/outreach/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      if (res.ok) {
        const data = await res.json();
        setTranslated(data.translated || "");
        setShowTranslation(true);
      }
    } catch { /**/ }
    setTranslating(false);
  };

  return (
    <div className="space-y-2">
      <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
      {needsTranslation && (
        <div>
          <button onClick={handleTranslate} disabled={translating}
            className="text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-40">
            {translating ? "번역 중..." : showTranslation ? "원문 보기" : "한국어 번역 보기"}
          </button>
          <AnimatePresence>
            {showTranslation && translated && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} className="mt-2 border-l-2 border-primary/30 pl-3">
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{translated}</pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function ThreadModal({ thread, apiBase, onClose }: { thread: ManufacturerThread; apiBase: string; onClose: () => void }) {
  const cfg = STATUS_CONFIG[thread.status] || STATUS_CONFIG.pending;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        className="glass-surface rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl border border-border"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <span>{cfg.emoji}</span>
            <span className="font-semibold text-foreground">{thread.manufacturer_name}</span>
            {thread.country && <span className="text-sm text-muted-foreground">{thread.country}</span>}
            {thread.email && <span className="text-xs text-muted-foreground font-mono">{thread.email}</span>}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>{cfg.label}</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl ml-4">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {thread.missing_items.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <span className="text-sm text-amber-700 dark:text-amber-400 font-semibold">미수신 항목: </span>
              <span className="text-sm text-amber-700 dark:text-amber-400">{thread.missing_items.join(", ")}</span>
            </div>
          )}
          {thread.escalated_questions.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
              <div className="text-sm text-amber-700 dark:text-amber-400 font-semibold">검토 필요 질문</div>
              {thread.escalated_questions.map((q, i) => (
                <div key={i} className="text-sm text-amber-700 dark:text-amber-400 flex gap-2">
                  <span className="shrink-0">-</span><span>{q}</span>
                </div>
              ))}
            </div>
          )}
          {thread.conversation.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">대화 내용이 없습니다.</p>
          ) : thread.conversation.map((msg, i) => (
            <div key={i} className={`space-y-2 pb-4 ${i < thread.conversation.length - 1 ? "border-b border-border" : ""}`}>
              <div className="flex items-center gap-3 text-sm">
                <span className={`font-semibold ${msg.role === "us" ? "text-primary" : "text-foreground"}`}>
                  {msg.role === "us" ? "📤 발송" : `💬 ${thread.manufacturer_name}`}
                </span>
                <span className="text-muted-foreground text-xs">{formatDate(msg.sent_at)}</span>
              </div>
              <div className={`pl-3 border-l-2 ${msg.role === "us" ? "border-primary/40" : "border-emerald-400/60"}`}>
                <EmailBody body={msg.body} apiBase={apiBase} />
              </div>
            </div>
          ))}
          {thread.web_form_url && (
            <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 rounded-lg p-3">
              <span className="text-sm text-orange-700">이메일 없음 — 홈페이지 직접 문의: </span>
              <a href={thread.web_form_url} target="_blank" rel="noopener noreferrer"
                className="text-sm text-primary hover:underline font-mono break-all">{thread.web_form_url}</a>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function FeedbackPanel({ planId, apiBase }: { planId: string; apiBase: string }) {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading || !planId) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/outreach/simple-plans/${planId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "ai", text: data.reply }]);
      }
    } catch { /**/ }
    setLoading(false);
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <div>
          <p className="text-sm font-semibold text-foreground">AI 어시스턴트</p>
          <p className="text-xs text-muted-foreground">진행 상황 질문, 지시사항, 조언 요청 등</p>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="max-h-64 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-xl px-3 py-2 text-sm text-muted-foreground">
                <span className="animate-pulse">생각 중...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="p-4 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={planId ? "질문이나 지시사항을 입력하세요" : "소싱 시작 후 사용 가능합니다"}
          disabled={!planId}
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim() || !planId}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
        >
          전송
        </button>
      </div>
    </div>
  );
}

const SourcingDashboard = ({ apiName, manufacturers, outreachPlanId, apiBase }: SourcingDashboardProps) => {
  const [threads, setThreads] = useState<ManufacturerThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ManufacturerThread | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!outreachPlanId) return;
    const fetchThreads = async () => {
      try {
        const res = await fetch(`${apiBase}/outreach/simple-plans/${outreachPlanId}/threads`);
        if (res.ok) setThreads(await res.json());
      } catch { /**/ }
    };
    fetchThreads();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchThreads, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [outreachPlanId, apiBase]);

  const total = threads.length || manufacturers.length;
  const replied = threads.filter(t => ["replied", "completed", "escalated"].includes(t.status)).length;
  const escalated = threads.filter(t => t.status === "escalated").length;
  const completed = threads.filter(t => t.status === "completed").length;
  const active = threads.filter(t => ["replied", "sent", "webform"].includes(t.status)).length;

  const displayThreads: ManufacturerThread[] = threads.length > 0
    ? [...threads].sort((a, b) => {
        const order: Record<string, number> = { escalated: 0, replied: 1, completed: 2, sent: 3, sending: 4, webform: 5, pending: 6, crawling: 6, failed: 7, closed: 8 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      })
    : manufacturers.map(m => ({
        manufacturer_id: m.id, manufacturer_name: m.name, country: m.country,
        email: m.contact_email || "", status: "pending", sent_at: "", email_subject: "",
        email_body: "", web_form_url: "", error: "", escalated_questions: [],
        missing_items: [], conversation: [], has_reply: false, auto_reply_count: 0,
      }));

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* 요약 헤더 */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <span className="font-semibold text-foreground text-base">{apiName} 소싱</span>
        <span className="text-muted-foreground">제조사 {total}곳</span>
        {active > 0 && <span className="text-blue-600 font-medium">📤 발송완료 {active}건</span>}
        {replied > 0 && <span className="text-emerald-600 font-medium">💬 답장 {replied}건</span>}
        {escalated > 0 && <span className="text-amber-600 font-medium">⚠️ 검토필요 {escalated}건</span>}
        {completed > 0 && <span className="text-emerald-700 font-semibold">✅ 완료 {completed}건</span>}
      </div>

      {/* 대화 카드 목록 */}
      <div className="space-y-2">
        {displayThreads.map((t) => {
          const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending;
          const lastMsg = t.conversation[t.conversation.length - 1];
          const prevMsg = t.conversation.length > 1 ? t.conversation[t.conversation.length - 2] : null;
          const isActive = ["replied", "escalated", "completed"].includes(t.status);

          return (
            <div
              key={t.manufacturer_id}
              onClick={() => (t.conversation.length > 0 || !!t.web_form_url) && setSelectedThread(t)}
              className={`rounded-xl border p-4 transition-colors ${cfg.bg} ${cfg.border} ${
                t.conversation.length > 0 || t.web_form_url ? "cursor-pointer hover:brightness-[0.97]" : ""
              }`}
            >
              {/* 헤더 행 */}
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{cfg.emoji}</span>
                  <span className="font-semibold text-foreground truncate">{t.manufacturer_name}</span>
                  {t.country && (
                    <span className="text-xs text-muted-foreground bg-background/60 px-1.5 py-0.5 rounded shrink-0">{t.country}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.auto_reply_count > 0 && (
                    <span className="text-xs text-muted-foreground">대화 {t.auto_reply_count}회</span>
                  )}
                  <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                  {isActive && <span className="text-xs text-muted-foreground">→</span>}
                </div>
              </div>

              {/* 대화 미리보기 */}
              {lastMsg ? (
                <div className="space-y-1.5">
                  {/* 이전 메시지 (있을 때) */}
                  {prevMsg && (
                    <div className={`pl-3 border-l-2 ${prevMsg.role === "us" ? "border-primary/30" : "border-emerald-400/40"} opacity-50`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {prevMsg.role === "us" ? "📤 발송" : `💬 답장`}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(prevMsg.sent_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {prevMsg.body.replace(/\n/g, " ").slice(0, 80)}
                      </p>
                    </div>
                  )}
                  {/* 최신 메시지 */}
                  <div className={`pl-3 border-l-2 ${lastMsg.role === "us" ? "border-primary/50" : "border-emerald-500/70"}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[11px] font-semibold ${lastMsg.role === "us" ? "text-primary" : "text-emerald-700 dark:text-emerald-400"}`}>
                        {lastMsg.role === "us" ? "📤 발송" : "💬 답장"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(lastMsg.sent_at)}</span>
                    </div>
                    <p className="text-sm text-foreground/80 line-clamp-2 leading-snug">
                      {lastMsg.body.replace(/\n+/g, " ").slice(0, 150)}
                    </p>
                  </div>
                </div>
              ) : t.status === "webform" && t.web_form_url ? (
                <a href={t.web_form_url} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-xs text-primary hover:underline font-mono mt-1 block">🌐 홈페이지 직접 문의 →</a>
              ) : t.email ? (
                <p className="text-xs text-muted-foreground mt-1 font-mono">{t.email}</p>
              ) : null}

              {/* 미수신 항목 */}
              {t.missing_items.length > 0 && (
                <div className="mt-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-1 rounded">
                  ⚠️ 미수신: {t.missing_items.join(" · ")}
                </div>
              )}
              {t.escalated_questions.length > 0 && (
                <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ {t.escalated_questions[0]}{t.escalated_questions.length > 1 ? ` 외 ${t.escalated_questions.length - 1}건` : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI 어시스턴트 */}
      <FeedbackPanel planId={outreachPlanId} apiBase={apiBase} />

      <AnimatePresence>
        {selectedThread && (
          <ThreadModal thread={selectedThread} apiBase={apiBase} onClose={() => setSelectedThread(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SourcingDashboard;
