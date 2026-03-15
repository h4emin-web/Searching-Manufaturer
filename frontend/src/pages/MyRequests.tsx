import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  onViewAll: () => void;
  apiBase: string;
}

const STATUS_LABEL: Record<SourcingRequest["status"], string> = {
  searching:  "AI 검색 중",
  reviewing:  "제조소 검토 대기",
  outreach:   "연락 발송 중",
  monitoring: "응답 대기 중",
  completed:  "완료",
};

const STATUS_COLOR: Record<SourcingRequest["status"], string> = {
  searching:  "text-foreground",
  reviewing:  "text-accent",
  outreach:   "text-foreground",
  monitoring: "text-foreground",
  completed:  "text-muted-foreground",
};

const PURPOSE_LABEL: Record<string, string> = {
  pharma: "의약품", pharmaceutical: "의약품", cosmetic: "화장품", food: "식품",
};

const MyRequests = ({ user, onNewRequest, onViewRequest, onViewAll, apiBase }: MyRequestsProps) => {
  const [requests, setRequests] = useState<SourcingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/users/${encodeURIComponent(user.koreanName)}/requests`);
      if (res.ok) {
        const data = await res.json();
        const mapped = data.map((r: any) => ({
          id: r.id,
          ingredientName: r.ingredient_name ?? r.ingredientName,
          purpose: r.purpose,
          requirements: r.requirements ?? [],
          status: r.status,
          createdAt: r.created_at ?? r.createdAt,
          taskId: r.task_id ?? r.taskId,
          totalFound: r.total_found ?? r.totalFound,
          replied: r.replied,
          sent: r.sent,
        }));
        setRequests(mapped);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.koreanName, apiBase]);

  const handleCancel = async (e: React.MouseEvent, req: SourcingRequest) => {
    e.stopPropagation();
    setCancelling(req.id);
    try {
      if (req.taskId) {
        await fetch(`${apiBase}/sourcing/${req.taskId}`, { method: "DELETE" });
      }
      await fetch(`${apiBase}/users/${encodeURIComponent(user.koreanName)}/requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      // refresh list
      await load();
    } catch { /* ignore */ }
    setCancelling(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="font-semibold text-foreground tracking-tight">Pharma Sourcing</span>
          <span className="text-data text-muted-foreground font-mono">v1.0</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-data text-muted-foreground font-mono">{user.koreanName}</span>
          <button
            onClick={onViewAll}
            className="text-data text-muted-foreground hover:text-foreground transition-colors font-mono"
          >
            전체 진행상황
          </button>
          <button
            onClick={onNewRequest}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded-sm text-data font-semibold hover:opacity-90 transition-opacity"
          >
            + 새 소싱 요청
          </button>
        </div>
      </header>

      <main className="px-6 py-8 max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <div className="text-data text-primary font-mono">MY REQUESTS</div>
          <h2 className="text-xl font-semibold text-foreground">
            {user.koreanName}님의 소싱 요청 목록
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-12 justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
            <span className="text-data text-muted-foreground font-mono">불러오는 중...</span>
          </div>
        ) : requests.length === 0 ? (
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
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="w-full glass-surface rounded-sm p-4 text-left transition-all duration-200"
                >
                  <div
                    className="cursor-pointer hover:glass-surface-hover rounded-sm"
                    onClick={() => onViewRequest(req)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="font-semibold text-foreground">{req.ingredientName}</span>
                          <span className="text-data font-mono px-2 py-0.5 rounded-sm bg-secondary text-muted-foreground">
                            {PURPOSE_LABEL[req.purpose] || req.purpose}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-data text-muted-foreground flex-wrap">
                          <span className="font-mono">
                            {new Date(req.createdAt).toLocaleDateString("ko-KR")}
                          </span>
                          {req.requirements.length > 0 && (
                            <span>{req.requirements.slice(0, 3).join(" · ")}{req.requirements.length > 3 ? " ..." : ""}</span>
                          )}
                          {req.totalFound !== undefined && req.totalFound > 0 && (
                            <span>제조소 <span className="text-foreground font-semibold">{req.totalFound}</span>곳</span>
                          )}
                          {req.status === "monitoring" && req.sent !== undefined && (
                            <>
                              <span>발송 <span className="text-foreground font-semibold">{req.sent}</span></span>
                              <span>응답 <span className="text-foreground font-semibold">{req.replied || 0}</span></span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={`text-data font-mono font-semibold shrink-0 ml-4 ${STATUS_COLOR[req.status]}`}>
                        {STATUS_LABEL[req.status]}
                      </div>
                    </div>

                    {(req.status === "searching" || req.status === "outreach" || req.status === "monitoring") && (
                      <div className="mt-3 h-[1px] bg-secondary overflow-hidden">
                        <div className="scanning-line h-full w-full" />
                      </div>
                    )}
                  </div>

                  {/* 진행 중 소싱 중단 버튼 */}
                  {req.status === "searching" && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={(e) => handleCancel(e, req)}
                        disabled={cancelling === req.id}
                        className="text-data text-muted-foreground hover:text-destructive transition-colors border border-border hover:border-destructive/30 px-3 py-1 rounded-sm disabled:opacity-40"
                      >
                        {cancelling === req.id ? "중단 중..." : "✕ 소싱 중단"}
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
};

export default MyRequests;
