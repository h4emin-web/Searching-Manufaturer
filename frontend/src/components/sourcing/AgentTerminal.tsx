import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Manufacturer } from "@/pages/Index";

interface AgentTerminalProps {
  apiName: string;
  isActive: boolean;
  sessionId: string;
  manufacturers: Manufacturer[];
  outreachPlanId?: string;
  apiBase?: string;
}

interface LogEntry {
  time: string;
  message: string;
  type: "info" | "action" | "success" | "warning";
}

const API_BASE_DEFAULT = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

const AgentTerminal = ({ apiName, isActive, manufacturers, outreachPlanId, apiBase }: AgentTerminalProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tasksDone, setTasksDone] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const base = apiBase || API_BASE_DEFAULT;

  const addLog = (type: LogEntry["type"], message: string) => {
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    setLogs(prev => [...prev, { time: `${mm}:${ss}`, message, type }]);
  };

  useEffect(() => {
    if (!isActive) return;
    addLog("info", `소싱 프로토콜 초기화 — ${apiName}`);
    addLog("action", `${manufacturers.length}개 제조소 이메일 확인 및 발송 시작`);
  }, [isActive]);

  // 실제 outreach 플랜 폴링
  useEffect(() => {
    if (!outreachPlanId || !isActive) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${base}/outreach/simple-plans/${outreachPlanId}`);
        if (!res.ok) return;
        const plan = await res.json();
        let done = 0;

        for (const item of plan.items) {
          const key = `${item.id}-${item.status}`;
          if (seenRef.current.has(key)) {
            if (item.status !== "pending" && item.status !== "crawling" && item.status !== "sending") done++;
            continue;
          }

          if (item.status === "crawling") {
            if (!seenRef.current.has(`${item.id}-crawling`)) {
              seenRef.current.add(`${item.id}-crawling`);
              addLog("action", `${item.name} — 이메일 주소 크롤링 중...`);
            }
          } else if (item.status === "sending") {
            if (!seenRef.current.has(`${item.id}-sending`)) {
              seenRef.current.add(`${item.id}-sending`);
              addLog("action", `${item.name} — 이메일 발송 중... (${item.email})`);
            }
          } else if (item.status === "sent") {
            seenRef.current.add(key);
            addLog("success", `${item.name} — 이메일 발송 완료 (${item.email})`);
            done++;
          } else if (item.status === "webform") {
            seenRef.current.add(key);
            addLog("warning", `${item.name} — 이메일 없음, 홈페이지 문의 필요: ${item.web_form_url || item.website || ""}`);
            done++;
          } else if (item.status === "failed") {
            seenRef.current.add(key);
            addLog("warning", `${item.name} — 발송 실패: ${item.error || ""}`);
            done++;
          }
        }

        setTasksDone(done);

        if (plan.status === "completed") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          addLog("info", `아웃리치 완료 — ${done}/${plan.items.length}건 처리됨`);
        }
      } catch { /* ignore */ }
    }, 2000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [outreachPlanId, isActive]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  const typeColor = {
    info: "text-muted-foreground",
    action: "text-foreground",
    success: "text-foreground font-semibold",
    warning: "text-accent",
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className="fixed bottom-0 left-0 right-0 glass-surface border-t border-border z-50"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="text-data font-mono text-primary font-semibold">AGENT TERMINAL</span>
          <span className="text-data text-muted-foreground">
            — {tasksDone}/{manufacturers.length} 작업 완료
          </span>
        </div>
        <div className="text-data text-muted-foreground font-mono">
          {tasksDone < manufacturers.length ? "실행 중..." : "응답 대기 중"}
        </div>
      </div>

      <div ref={scrollRef} className="h-48 overflow-y-auto p-4 space-y-1 font-mono">
        {logs.map((log, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex gap-3 text-data"
          >
            <span className="text-muted-foreground/50 shrink-0">{log.time}</span>
            <span className={typeColor[log.type]}>{log.message}</span>
          </motion.div>
        ))}
        {isActive && (
          <div className="flex gap-3 text-data">
            <span className="text-muted-foreground/50">···</span>
            <span className="text-primary animate-terminal-blink">▋</span>
          </div>
        )}
      </div>

      <div className="h-[2px] overflow-hidden">
        <div className="scanning-line h-full w-full" />
      </div>
    </motion.div>
  );
};

export default AgentTerminal;
