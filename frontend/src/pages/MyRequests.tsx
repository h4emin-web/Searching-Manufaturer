import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export interface SourcingRequest {
  id: string;
  ingredientName: string;
  purpose: string;
  requirements: string[];
  status: "searching" | "reviewing" | "outreach" | "monitoring" | "completed";
  createdAt: string;
  taskId?: string;
  totalFound?: number;
  replied?: number;
  sent?: number;
}

interface MyRequestsProps {
  user: { koreanName: string; englishName: string };
  onNewRequest: () => void;
  onViewRequest: (req: SourcingRequest) => void;
}

const STATUS_LABEL: Record<SourcingRequest["status"], string> = {
  searching:  "AI 검색 중",
  reviewing:  "제조소 검토 중",
  outreach:   "연락 발송 중",
  monitoring: "응답 대기 중",
  completed:  "완료",
};

const STATUS_COLOR: Record<SourcingRequest["status"], string> = {
  searching:  "text-primary",
  reviewing:  "text-accent",
  outreach:   "text-primary",
  monitoring: "text-primary animate-pulse-glow",
  completed:  "text-muted-foreground",
};

const PURPOSE_LABEL: Record<string, string> = {
  pharma: "의약품", cosmetic: "화장품", food: "식품",
};

const MyRequests = ({ user, onNewRequest, onViewRequest }: MyRequestsProps) => {
  const [requests, setRequests] = useState<SourcingRequest[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(`requests_${user.koreanName}`);
    if (stored) setRequests(JSON.parse(stored));
  }, [user.koreanName]);

  // Poll status for active requests
  useEffect(() => {
    const active = requests.filter(r => r.taskId && r.status === "searching");
    if (active.length === 0) return;

    const interval = setInterval(async () => {
      const updated = [...requests];
      let changed = false;

      for (const req of active) {
        if (!req.taskId) continue;
        try {
          const res = await fetch(`${API_BASE}/sourcing/${req.taskId}`);
          const data = await res.json();
          if (data.status === "completed") {
            const idx = updated.findIndex(r => r.id === req.id);
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], status: "reviewing", totalFound: data.total_deduplicated };
              changed = true;
            }
          }
        } catch { /* ignore */ }
      }

      if (changed) {
        setRequests(updated);
        localStorage.setItem(`requests_${user.koreanName}`, JSON.stringify(updated));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [requests, user.koreanName]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="font-semibold text-foreground tracking-tight">Pharma Sourcing</span>
          <span className="text-data text-muted-foreground font-mono">v1.0</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-data text-muted-foreground font-mono">{user.koreanName}</span>
          <button
            onClick={onNewRequest}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded-sm text-data font-semibold hover:opacity-90 transition-opacity"
          >
            + 새 소싱 요청
          </button>
        </div>
      </header>

      <main className="px-6 py-8 max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <div className="text-data text-primary font-mono">MY REQUESTS</div>
          <h2 className="text-xl font-semibold text-foreground">
            {user.koreanName}님의 소싱 요청 목록
          </h2>
        </div>

        {requests.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-surface rounded-sm p-12 text-center space-y-4"
          >
            <div className="text-4xl">🔬</div>
            <p className="text-muted-foreground text-ui">아직 소싱 요청이 없습니다.</p>
            <button
              onClick={onNewRequest}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-sm font-semibold text-ui hover:opacity-90 transition-opacity"
            >
              첫 번째 소싱 시작하기 →
            </button>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {requests.map((req, i) => (
                <motion.button
                  key={req.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => onViewRequest(req)}
                  className="w-full glass-surface hover:glass-surface-hover rounded-sm p-4 text-left transition-all duration-200 hover:glow-primary"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-foreground">{req.ingredientName}</span>
                        <span className="text-data font-mono px-2 py-0.5 rounded-sm bg-secondary text-muted-foreground">
                          {PURPOSE_LABEL[req.purpose] || req.purpose}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-data text-muted-foreground">
                        <span className="font-mono">{new Date(req.createdAt).toLocaleDateString("ko-KR")}</span>
                        {req.requirements.length > 0 && (
                          <span>{req.requirements.slice(0, 3).join(" · ")}{req.requirements.length > 3 ? " ..." : ""}</span>
                        )}
                        {req.totalFound !== undefined && (
                          <span>제조소 <span className="text-primary font-semibold">{req.totalFound}</span>곳</span>
                        )}
                      </div>
                    </div>
                    <div className={`text-data font-mono font-semibold shrink-0 ml-4 ${STATUS_COLOR[req.status]}`}>
                      {STATUS_LABEL[req.status]}
                    </div>
                  </div>

                  {/* Progress indicator for active requests */}
                  {(req.status === "searching" || req.status === "outreach" || req.status === "monitoring") && (
                    <div className="mt-3 h-[1px] bg-secondary overflow-hidden">
                      <div className="scanning-line h-full w-full" />
                    </div>
                  )}

                  {req.status === "monitoring" && req.sent !== undefined && (
                    <div className="mt-2 flex gap-4 text-data text-muted-foreground">
                      <span>발송 <span className="text-foreground font-semibold">{req.sent}</span></span>
                      <span>응답 <span className="text-primary font-semibold">{req.replied || 0}</span></span>
                    </div>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
};

export default MyRequests;
