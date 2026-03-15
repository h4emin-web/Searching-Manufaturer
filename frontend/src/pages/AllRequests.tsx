import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface AllRequest {
  id: string;
  user_name: string;
  ingredient_name: string;
  purpose: string;
  status: string;
  total_found: number;
  sent: number;
  replied: number;
  created_at: string;
  notes: string[];
}

interface AllRequestsProps {
  onBack: () => void;
  apiBase: string;
  filterUser?: string; // 특정 사용자만 보기
}

const PURPOSE_LABEL: Record<string, string> = {
  pharma: "의약품", pharmaceutical: "의약품", cosmetic: "화장품", food: "식품",
};

// 진행 단계 정의
const STEPS = [
  { key: "searching",    label: "AI 검색" },
  { key: "reviewing",    label: "제조소 검토" },
  { key: "outreach",     label: "연락 발송" },
  { key: "monitoring",   label: "응답 대기" },
  { key: "negotiating",  label: "연락 중" },
  { key: "completed",    label: "완료" },
];

const STATUS_ORDER: Record<string, number> = {
  searching: 0, reviewing: 1, outreach: 2, monitoring: 3, negotiating: 4, completed: 5,
};

function ProgressSteps({ status }: { status: string }) {
  const currentIdx = STATUS_ORDER[status] ?? -1;
  const isStopped = status === "completed" && currentIdx < 4; // 완료 전 중단

  return (
    <div className="flex items-center gap-0 mt-2">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  done || active ? "bg-foreground" : "bg-border"
                }`}
              />
              <span className={`text-[10px] font-mono mt-0.5 whitespace-nowrap ${
                active ? "text-foreground font-semibold" : done ? "text-muted-foreground" : "text-border"
              }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-[1px] mb-3 ${i < currentIdx ? "bg-foreground" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const AllRequests = ({ onBack, apiBase, filterUser }: AllRequestsProps) => {
  const [requests, setRequests] = useState<AllRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [generatingBriefing, setGeneratingBriefing] = useState<string | null>(null);

  const handleGenerateBriefing = async (req: AllRequest) => {
    setGeneratingBriefing(req.id);
    try {
      const res = await fetch(`${apiBase}/users/${encodeURIComponent(req.user_name)}/requests/${req.id}/briefing`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(prev => prev.map(r => r.id === req.id ? { ...r, notes: data.notes } : r));
      }
    } catch { /* ignore */ }
    setGeneratingBriefing(null);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const url = filterUser
          ? `${apiBase}/users/${encodeURIComponent(filterUser)}/requests`
          : `${apiBase}/users/requests/all`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          // snake_case → unified shape
          setRequests(data.map((r: any) => ({
            id: r.id,
            user_name: r.user_name ?? filterUser ?? "",
            ingredient_name: r.ingredient_name ?? r.ingredientName ?? "",
            purpose: r.purpose ?? "",
            status: r.status ?? "",
            total_found: r.total_found ?? r.totalFound ?? 0,
            sent: r.sent ?? 0,
            replied: r.replied ?? 0,
            created_at: r.created_at ?? r.createdAt ?? "",
            notes: r.notes ?? [],
          })));
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [apiBase, filterUser]);

  const filtered = requests.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.ingredient_name?.toLowerCase().includes(q) || r.user_name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="font-semibold text-foreground tracking-tight">Pharma Sourcing</span>
          <span className="text-data text-muted-foreground font-mono">v1.0</span>
        </div>
        <button onClick={onBack} className="text-data text-muted-foreground hover:text-foreground transition-colors">
          ← 내 요청 목록
        </button>
      </header>

      <main className="px-6 py-8 max-w-5xl mx-auto space-y-6">
        <div className="space-y-1">
          <div className="text-data text-primary font-mono">{filterUser ? "MY PROGRESS" : "ALL REQUESTS"}</div>
          <h2 className="text-xl font-semibold text-foreground">
            {filterUser ? `${filterUser}님의 진행 현황` : "전체 진행 현황"}
          </h2>
        </div>

        <div className="flex gap-3 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="담당자 또는 원료명 검색..."
            className="flex-1 min-w-[200px] glass-surface rounded-sm px-4 py-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="glass-surface rounded-sm px-4 py-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">전체 상태</option>
            <option value="searching">AI 검색 중</option>
            <option value="reviewing">제조소 검토 대기</option>
            <option value="outreach">연락 발송 중</option>
            <option value="monitoring">응답 대기</option>
            <option value="negotiating">연락 중</option>
            <option value="completed">완료</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-12 justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
            <span className="text-data text-muted-foreground font-mono">불러오는 중...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-surface rounded-sm p-12 text-center">
            <p className="text-muted-foreground text-ui">
              {search || statusFilter !== "all" ? "검색 결과가 없습니다." : "요청이 없습니다."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-data text-muted-foreground font-mono">{filtered.length}건</div>
            {filtered.map((req, i) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-surface rounded-sm px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <span className="font-semibold text-foreground">{req.ingredient_name}</span>
                      <span className="text-data font-mono px-2 py-0.5 rounded-sm bg-secondary text-muted-foreground">
                        {PURPOSE_LABEL[req.purpose] || req.purpose}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-data text-muted-foreground flex-wrap">
                      <span className="font-semibold text-foreground">담당: {req.user_name}</span>
                      <span className="font-mono">{new Date(req.created_at).toLocaleDateString("ko-KR")}</span>
                      {req.total_found > 0 && (
                        <span>제조소 <span className="text-foreground font-semibold">{req.total_found}</span>곳 확인</span>
                      )}
                      {req.sent > 0 && (
                        <span>발송 <span className="text-foreground font-semibold">{req.sent}</span> / 응답 <span className="text-foreground font-semibold">{req.replied ?? 0}</span></span>
                      )}
                    </div>
                    <ProgressSteps status={req.status} />

                    {/* AI 브리핑 */}
                    {req.notes && req.notes.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {req.notes.map((note, ni) => (
                          <div key={ni} className="text-data text-muted-foreground flex gap-2">
                            <span className="text-primary font-mono shrink-0">▸</span>
                            <span>{note}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => handleGenerateBriefing(req)}
                      disabled={generatingBriefing === req.id}
                      className="mt-2 text-data text-muted-foreground hover:text-primary transition-colors font-mono disabled:opacity-40"
                    >
                      {generatingBriefing === req.id ? "AI 분석 중..." : "↻ AI 현황 브리핑"}
                    </button>
                  </div>
                  <div className="shrink-0 text-right">
                    {(req.status === "searching" || req.status === "outreach" || req.status === "monitoring" || req.status === "negotiating") && (
                      <div className="w-16 h-[2px] overflow-hidden rounded-full bg-secondary">
                        <div className="scanning-line h-full w-full" />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AllRequests;
