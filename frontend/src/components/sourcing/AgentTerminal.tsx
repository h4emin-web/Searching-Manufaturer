import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Manufacturer } from "@/pages/Index";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

interface AgentTerminalProps {
  apiName: string;
  isActive: boolean;
  sessionId: string;
  manufacturers: Manufacturer[];
}

interface LogEntry {
  time: string;
  message: string;
  type: "info" | "action" | "success" | "warning";
}

const now = () => new Date().toLocaleTimeString("ko-KR", { hour12: false });

const AgentTerminal = ({ apiName, isActive, sessionId, manufacturers }: AgentTerminalProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tasksDone, setTasksDone] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef(Date.now());
  const sseConnectedRef = useRef(false);
  const sseErrorCountRef = useRef(0);

  const addLog = (type: LogEntry["type"], message: string) => {
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    setLogs(prev => [...prev, { time: `${mm}:${ss}`, message, type }]);
  };

  useEffect(() => {
    if (!isActive) return;

    // Initial logs
    addLog("info", `소싱 프로토콜 초기화 — ${apiName}`);
    addLog("action", `${manufacturers.length}개 제조소에 COA 및 샘플 요청 메일 발송 시작`);

    // Log each manufacturer
    manufacturers.forEach((m, i) => {
      setTimeout(() => {
        addLog("action", `${m.name} (${m.country})에 문의 메일 발송 중...`);
        setTimeout(() => {
          if (m.contact_email) {
            addLog("success", `${m.name} — 이메일 발송 완료 (${m.contact_email})`);
          } else {
            addLog("action", `${m.name} — 웹 문의 폼으로 전송 중...`);
            addLog("success", `${m.name} — 웹 폼 전송 완료`);
          }
          setTasksDone(prev => prev + 1);
        }, 600);
      }, i * 1400);
    });

    // Connect to SSE stream for real-time events
    const connectSSE = () => {
      esRef.current?.close();
      const es = new EventSource(`${API_BASE}/dashboard/${sessionId}/stream`);
      esRef.current = es;

      es.onopen = () => {
        sseErrorCountRef.current = 0;
        if (!sseConnectedRef.current) {
          sseConnectedRef.current = true;
          addLog("info", "실시간 모니터링 연결 완료");
        }
      };

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === "outreach_replied") {
            addLog("success", `${event.manufacturer || "제조소"} 응답 수신! ${event.message || ""}`);
            setTasksDone(prev => prev + 1);
          } else if (event.type === "outreach_sent") {
            addLog("action", `${event.manufacturer || "제조소"} — 발송 완료`);
          } else if (event.type === "outreach_failed") {
            addLog("warning", `${event.manufacturer || "제조소"} — 발송 실패`);
          }
        } catch { /* ignore parse errors */ }
      };

      es.onerror = () => {
        sseErrorCountRef.current += 1;
        // 3번 연속 실패 시에만 로그 출력, EventSource가 자동 재연결함
        if (sseErrorCountRef.current === 3) {
          addLog("warning", "모니터링 연결 불안정 — 자동 재연결 중");
        }
      };
    };

    setTimeout(connectSSE, manufacturers.length * 1400 + 1000);

    return () => {
      esRef.current?.close();
    };
  }, [isActive, sessionId]);

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
      style={{ borderTopColor: "hsl(160, 100%, 45%, 0.2)" }}
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

      {/* Scanning line */}
      <div className="h-[2px] overflow-hidden">
        <div className="scanning-line h-full w-full" />
      </div>
    </motion.div>
  );
};

export default AgentTerminal;
