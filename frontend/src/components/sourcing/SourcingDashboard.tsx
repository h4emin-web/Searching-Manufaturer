import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:   { label: "대기중",        bg: "bg-zinc-100 dark:bg-zinc-800",      text: "text-zinc-500",            dot: "bg-zinc-400" },
  crawling:  { label: "처리중",        bg: "bg-zinc-100 dark:bg-zinc-800",      text: "text-zinc-500",            dot: "bg-zinc-400 animate-pulse" },
  sending:   { label: "발송중",        bg: "bg-blue-50 dark:bg-blue-950",       text: "text-blue-600",            dot: "bg-blue-500 animate-pulse" },
  sent:      { label: "발송완료",      bg: "bg-blue-50 dark:bg-blue-950",       text: "text-blue-600",            dot: "bg-blue-500" },
  webform:   { label: "홈페이지 문의", bg: "bg-orange-50 dark:bg-orange-950",   text: "text-orange-600",          dot: "bg-orange-500" },
  failed:    { label: "실패",          bg: "bg-red-50 dark:bg-red-950",         text: "text-red-600",             dot: "bg-red-500" },
  replied:   { label: "답장 수신",     bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-600",         dot: "bg-emerald-500" },
  escalated: { label: "검토 필요",     bg: "bg-amber-50 dark:bg-amber-950",     text: "text-amber-600",           dot: "bg-amber-500" },
  completed: { label: "수집 완료",     bg: "bg-emerald-100 dark:bg-emerald-900",text: "text-emerald-700 font-bold",dot: "bg-emerald-600" },
  closed:    { label: "공급 불가",     bg: "bg-zinc-100 dark:bg-zinc-800",      text: "text-zinc-400",            dot: "bg-zinc-300" },
};

const PIPELINE_STEP: Record<string, number> = {
  pending: 0, crawling: 0, sending: 1,
  sent: 1, webform: 1, failed: 1,
  replied: 2, escalated: 2,
  completed: 3, closed: 3,
};

const PIPELINE_LABELS = ["발송 준비", "발송 완료", "답장 수신", "처리 완료"];

function PipelineBar({ status }: { status: string }) {
  const step = PIPELINE_STEP[status] ?? 0;
  const isFailed = status === "failed" || status === "closed";
  const isEscalated = status === "escalated";
  return (
    <div className="flex items-center gap-1 mt-2">
      {PIPELINE_LABELS.map((label, i) => {
        const active = i <= step;
        const current = i === step;
        return (
          <div key={i} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-0.5">
              <div className={`w-2 h-2 rounded-full transition-colors ${
                current && isFailed ? "bg-red-500" :
                current && isEscalated ? "bg-amber-500" :
                active ? "bg-primary" : "bg-border"
              }`} />
              <span className={`text-[10px] font-mono whitespace-nowrap ${
                active ? "text-foreground/70" : "text-muted-foreground/40"
              }`}>{label}</span>
            </div>
            {i < PIPELINE_LABELS.length - 1 && (
              <div className={`w-6 h-[1px] mb-3 ${i < step ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: "bg-zinc-100", text: "text-zinc-500", dot: "bg-zinc-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  if (!iso) return "";
  // Backend stores UTC without 'Z' — append it so JS parses as UTC, not local
  const normalized = /[Zz+]/.test(iso) ? iso : iso + "Z";
  const d = new Date(normalized);
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
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        className="glass-surface rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl border border-border"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-foreground">{thread.manufacturer_name}</span>
            {thread.country && <span className="text-sm text-muted-foreground">{thread.country}</span>}
            {thread.email && <span className="text-xs text-muted-foreground font-mono">{thread.email}</span>}
            <StatusBadge status={thread.status} />
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl ml-4">x</button>
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
                  {msg.role === "us" ? "발송" : thread.manufacturer_name}
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
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
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
          placeholder={planId ? "예: 답장 안 온 곳들 어떻게 할까요? / 중국 제조원 상황은?" : "소싱 시작 후 사용 가능합니다"}
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
  const planIdRef = useRef(outreachPlanId);

  useEffect(() => {
    planIdRef.current = outreachPlanId;
  }, [outreachPlanId]);

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
    pollRef.current = setInterval(fetchThreads, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [outreachPlanId, apiBase]);

  const total = threads.length || manufacturers.length;
  const sent = threads.filter(t => !["pending", "crawling", "sending"].includes(t.status)).length;
  const replied = threads.filter(t => ["replied", "completed", "escalated"].includes(t.status)).length;
  const escalated = threads.filter(t => t.status === "escalated").length;
  const completed = threads.filter(t => t.status === "completed").length;

  // Progress based on how much info was gathered (not just sent)
  const getInfoScore = (t: ManufacturerThread): number => {
    if (t.status === "completed") return 100;
    if (t.status === "closed" || t.status === "failed") return 0;
    if (t.status === "webform") return 5;
    if (["replied", "escalated"].includes(t.status)) {
      const missing = t.missing_items?.length ?? 4;
      return Math.max(30, Math.round(((4 - missing) / 4) * 100));
    }
    if (t.status === "sent") return 15;
    return 0;
  };
  const infoProgress = displayThreads.length > 0
    ? Math.round(displayThreads.reduce((sum, t) => sum + getInfoScore(t), 0) / displayThreads.length)
    : 0;

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
    <div className="max-w-4xl mx-auto space-y-5">
      {/* 발송 현황 카드 */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">{apiName} — 발송 현황</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-blue-600">{sent}</span>
              <span className="text-lg text-muted-foreground">/ {total}개 발송 완료</span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-emerald-600 font-medium">답장 {replied}건</span>
              {escalated > 0 && <span className="text-amber-600 font-medium">검토필요 {escalated}건</span>}
              {completed > 0 && <span className="text-emerald-700 font-semibold">수집완료 {completed}건</span>}
            </div>
          </div>
          <div className="flex-1 min-w-[160px] max-w-xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>정보 수집률</span>
              <span className="font-mono">{infoProgress}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div className="h-full bg-primary rounded-full"
                animate={{ width: `${infoProgress}%` }}
                transition={{ duration: 0.5 }} />
            </div>
            {replied > 0 && (
              <div className="mt-1">
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div className="h-full bg-emerald-500 rounded-full"
                    animate={{ width: total > 0 ? `${(replied / total) * 100}%` : "0%" }}
                    transition={{ duration: 0.5 }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">답장률 {total > 0 ? Math.round((replied / total) * 100) : 0}%</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 제조원 목록 */}
      <div className="space-y-2">
        {displayThreads.map((t, i) => {
          const hasContent = t.conversation.length > 0 || !!t.web_form_url || !!t.error;
          const isHighlight = ["replied", "escalated", "completed"].includes(t.status);
          return (
            <motion.div key={t.manufacturer_id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`rounded-xl border p-4 transition-all ${
                isHighlight
                  ? t.status === "escalated"
                    ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30"
                    : "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30"
                  : "border-border bg-card"
              } ${hasContent ? "cursor-pointer hover:shadow-md" : ""}`}
              onClick={() => hasContent && setSelectedThread(t)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{t.manufacturer_name}</span>
                    {t.country && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t.country}</span>}
                    <StatusBadge status={t.status} />
                    {t.has_reply && t.auto_reply_count > 0 && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">대화 {t.auto_reply_count}회</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {t.email && <span className="font-mono">{t.email}</span>}
                    {t.sent_at && <span>{formatDate(t.sent_at)}</span>}
                  </div>
                  {t.email_subject && <div className="text-xs text-muted-foreground font-mono truncate">{t.email_subject}</div>}
                  {t.missing_items.length > 0 && (
                    <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded">
                      미수신: {t.missing_items.join(", ")}
                    </div>
                  )}
                  {t.escalated_questions.length > 0 && (
                    <div className="text-xs text-amber-700 dark:text-amber-400">
                      ⚠ {t.escalated_questions[0]}{t.escalated_questions.length > 1 ? ` 외 ${t.escalated_questions.length - 1}건` : ""}
                    </div>
                  )}
                  {t.web_form_url && !hasContent && (
                    <a href={t.web_form_url} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-primary hover:underline font-mono">홈페이지 직접 문의 →</a>
                  )}
                  <PipelineBar status={t.status} />
                </div>
                {hasContent && <span className="text-xs text-muted-foreground shrink-0 mt-1">상세 →</span>}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* AI 피드백 패널 */}
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
