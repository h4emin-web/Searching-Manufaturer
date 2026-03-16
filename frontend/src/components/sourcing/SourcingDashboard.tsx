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

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:   { label: "대기중",            color: "text-muted-foreground" },
  crawling:  { label: "이메일 확인 중",    color: "text-foreground" },
  sending:   { label: "발송중",            color: "text-foreground" },
  sent:      { label: "발송완료",          color: "text-primary" },
  webform:   { label: "홈페이지 문의 필요", color: "text-accent" },
  failed:    { label: "실패",              color: "text-destructive" },
  replied:   { label: "답장 수신",         color: "text-primary font-semibold" },
  escalated: { label: "검토 필요",         color: "text-accent font-semibold" },
  completed: { label: "정보 수집 완료",    color: "text-primary font-semibold" },
  closed:    { label: "공급 불가",         color: "text-muted-foreground" },
};

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function isKorean(text: string) {
  return /[\uAC00-\uD7AF]/.test(text);
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
    } catch { /* ignore */ }
    setTranslating(false);
  };

  return (
    <div className="space-y-2">
      <pre className="text-data text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
      {needsTranslation && (
        <div>
          <button
            onClick={handleTranslate}
            disabled={translating}
            className="text-data text-muted-foreground hover:text-primary transition-colors font-mono disabled:opacity-40"
          >
            {translating ? "번역 중..." : showTranslation ? "원문 보기" : "한국어 번역 보기"}
          </button>
          <AnimatePresence>
            {showTranslation && translated && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 border-l-2 border-primary/30 pl-3"
              >
                <pre className="text-data text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{translated}</pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function ThreadModal({ thread, apiBase, onClose }: {
  thread: ManufacturerThread;
  apiBase: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="glass-surface rounded-sm w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-foreground">{thread.manufacturer_name}</span>
            {thread.country && <span className="text-data text-muted-foreground">{thread.country}</span>}
            {thread.email && <span className="text-data text-muted-foreground font-mono">{thread.email}</span>}
            <span className={`text-data font-mono ${STATUS_LABEL[thread.status]?.color || "text-muted-foreground"}`}>
              {STATUS_LABEL[thread.status]?.label || thread.status}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none ml-4">
            x
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {thread.missing_items.length > 0 && (
            <div className="glass-surface rounded-sm p-3">
              <span className="text-data text-accent font-mono">미수신 항목: </span>
              <span className="text-data text-foreground">{thread.missing_items.join(", ")}</span>
            </div>
          )}

          {thread.escalated_questions.length > 0 && (
            <div className="glass-surface rounded-sm p-3 space-y-1">
              <div className="text-data text-accent font-mono font-semibold">검토 필요 질문</div>
              {thread.escalated_questions.map((q, i) => (
                <div key={i} className="text-data text-foreground flex gap-2">
                  <span className="text-accent shrink-0">-</span>
                  <span>{q}</span>
                </div>
              ))}
            </div>
          )}

          {thread.conversation.length === 0 ? (
            <p className="text-data text-muted-foreground text-center py-8">대화 내용이 없습니다.</p>
          ) : (
            thread.conversation.map((msg, i) => (
              <div
                key={i}
                className={`space-y-2 pb-4 ${i < thread.conversation.length - 1 ? "border-b border-border" : ""}`}
              >
                <div className="flex items-center gap-3 text-data">
                  <span className={`font-mono font-semibold ${msg.role === "us" ? "text-primary" : "text-foreground"}`}>
                    {msg.role === "us" ? "발송" : thread.manufacturer_name}
                  </span>
                  <span className="text-muted-foreground">{formatDate(msg.sent_at)}</span>
                </div>
                <div className={`pl-3 border-l-2 ${msg.role === "us" ? "border-primary/40" : "border-border"}`}>
                  <EmailBody body={msg.body} apiBase={apiBase} />
                </div>
              </div>
            ))
          )}

          {thread.web_form_url && (
            <div className="glass-surface rounded-sm p-3">
              <span className="text-data text-muted-foreground">이메일 없음 - 홈페이지 문의: </span>
              <a
                href={thread.web_form_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-data text-primary hover:underline font-mono break-all"
              >
                {thread.web_form_url}
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
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
      } catch { /* ignore */ }
    };
    fetchThreads();
    pollRef.current = setInterval(fetchThreads, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [outreachPlanId, apiBase]);

  const total = threads.length || manufacturers.length;
  const sent = threads.filter(t => !["pending", "crawling", "sending"].includes(t.status)).length;
  const replied = threads.filter(t => ["replied", "completed", "escalated"].includes(t.status)).length;
  const completed = threads.filter(t => t.status === "completed").length;

  const displayThreads: ManufacturerThread[] = threads.length > 0
    ? threads
    : manufacturers.map(m => ({
        manufacturer_id: m.id,
        manufacturer_name: m.name,
        country: m.country,
        email: m.contact_email || "",
        status: "pending",
        sent_at: "",
        email_subject: "",
        email_body: "",
        web_form_url: "",
        error: "",
        escalated_questions: [],
        missing_items: [],
        conversation: [],
        has_reply: false,
        auto_reply_count: 0,
      }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 요약 헤더 */}
      <div className="glass-surface rounded-sm p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-foreground">{apiName} 소싱 현황</h2>
          <div className="flex items-center gap-4 text-data font-mono flex-wrap">
            <span className="text-muted-foreground">
              전체 <span className="text-foreground font-semibold">{total}</span>곳
            </span>
            <span className="text-muted-foreground">
              발송 <span className="text-primary font-semibold">{sent}</span>곳
            </span>
            <span className="text-muted-foreground">
              답장 <span className="text-primary font-semibold">{replied}</span>곳
            </span>
            {completed > 0 && (
              <span className="text-muted-foreground">
                완료 <span className="text-primary font-semibold">{completed}</span>곳
              </span>
            )}
          </div>
        </div>
        <div className="h-[2px] bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: total > 0 ? `${(sent / total) * 100}%` : "0%" }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* 제조원 카드 목록 */}
      <div className="space-y-2">
        {displayThreads.map((t, i) => {
          const st = STATUS_LABEL[t.status] || { label: t.status, color: "text-muted-foreground" };
          const hasContent = t.conversation.length > 0 || !!t.web_form_url || !!t.error;
          return (
            <motion.div
              key={t.manufacturer_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`glass-surface rounded-sm p-4 ${
                hasContent ? "cursor-pointer hover:glass-surface-hover transition-all" : ""
              }`}
              onClick={() => hasContent && setSelectedThread(t)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-foreground">{t.manufacturer_name}</span>
                    {t.country && (
                      <span className="text-data text-muted-foreground">{t.country}</span>
                    )}
                    <span className={`text-data font-mono ${st.color}`}>{st.label}</span>
                    {["sending", "crawling", "pending"].includes(t.status) && (
                      <div className="w-8 h-[2px] overflow-hidden rounded-full bg-secondary">
                        <div className="scanning-line h-full w-full" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-data text-muted-foreground flex-wrap">
                    {t.email && <span className="font-mono">{t.email}</span>}
                    {t.sent_at && <span>{formatDate(t.sent_at)}</span>}
                    {t.missing_items.length > 0 && (
                      <span className="text-accent">미수신: {t.missing_items.join(", ")}</span>
                    )}
                  </div>

                  {t.email_subject && (
                    <div className="text-data text-muted-foreground font-mono truncate">
                      {t.email_subject}
                    </div>
                  )}

                  {t.escalated_questions.length > 0 && (
                    <div className="text-data text-accent">
                      검토 필요: {t.escalated_questions[0]}
                      {t.escalated_questions.length > 1
                        ? ` 외 ${t.escalated_questions.length - 1}건`
                        : ""}
                    </div>
                  )}

                  {t.web_form_url && !hasContent && (
                    <a
                      href={t.web_form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-data text-primary hover:underline font-mono"
                    >
                      홈페이지 직접 문의
                    </a>
                  )}
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1">
                  {t.has_reply && (
                    <span className="text-data font-mono text-primary">
                      답장 {t.auto_reply_count}회
                    </span>
                  )}
                  {hasContent && (
                    <span className="text-data text-muted-foreground font-mono text-xs">
                      상세 보기
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedThread && (
          <ThreadModal
            thread={selectedThread}
            apiBase={apiBase}
            onClose={() => setSelectedThread(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SourcingDashboard;
