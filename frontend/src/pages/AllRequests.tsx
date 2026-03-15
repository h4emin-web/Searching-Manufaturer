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
}

interface AllRequestsProps {
  onBack: () => void;
  apiBase: string;
}

const STATUS_LABEL: Record<string, string> = {
  searching: "AI 검색 중",
  reviewing: "제조소 검토 대기",
  outreach: "연락 발송 중",
  monitoring: "응답 대기 중",
  completed: "완료",
};

const STATUS_COLOR: Record<string, string> = {
  searching: "text-primary",
  reviewing: "text-accent",
  outreach: "text-primary",
  monitoring: "text-primary",
  completed: "text-muted-foreground",
};

const PURPOSE_LABEL: Record<string, string> = {
  pharma: "의약품", pharmaceutical: "의약품", cosmetic: "화장품", food: "식품",
};

const AllRequests = ({ onBack, apiBase }: AllRequestsProps) => {
  const [requests, setRequests] = useState<AllRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/users/requests/all`);
        if (res.ok) {
          const data = await res.json();
          setRequests(data);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [apiBase]);

  const filtered = requests.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.ingredient_name?.toLowerCase().includes(q) ||
      r.user_name?.toLowerCase().includes(q);
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
        <button
          onClick={onBack}
          className="text-data text-muted-foreground hover:text-foreground transition-colors"
        >
          ← 내 요청 목록
        </button>
      </header>

      <main className="px-6 py-8 max-w-5xl mx-auto space-y-6">
        <div className="space-y-1">
          <div className="text-data text-primary font-mono">ALL REQUESTS</div>
          <h2 className="text-xl font-semibold text-foreground">전체 진행 현황</h2>
        </div>

        {/* 검색 / 필터 */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 또는 원료명 검색..."
              className="w-full glass-surface rounded-sm px-4 py-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="glass-surface rounded-sm px-4 py-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">전체 상태</option>
            <option value="searching">AI 검색 중</option>
            <option value="reviewing">검토 대기</option>
            <option value="outreach">연락 발송 중</option>
            <option value="monitoring">응답 대기</option>
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
          <div className="space-y-2">
            <div className="text-data text-muted-foreground font-mono mb-2">
              {filtered.length}건
            </div>
            {/* 테이블 헤더 */}
            <div className="hidden md:grid grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-2 text-data text-muted-foreground font-mono border-b border-border">
              <span>담당자</span>
              <span>원료명</span>
              <span>용도</span>
              <span>제조소</span>
              <span>발송/응답</span>
              <span>상태</span>
            </div>
            {filtered.map((req, i) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-surface rounded-sm px-4 py-3 grid md:grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr] gap-3 md:gap-4 items-center"
              >
                <span className="text-ui text-foreground font-semibold">{req.user_name}</span>
                <span className="text-ui text-foreground font-semibold">{req.ingredient_name}</span>
                <span className="text-data text-muted-foreground">
                  {PURPOSE_LABEL[req.purpose] || req.purpose}
                </span>
                <span className="text-data font-mono">
                  {req.total_found > 0 ? (
                    <span className="text-foreground">{req.total_found}곳</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </span>
                <span className="text-data font-mono text-muted-foreground">
                  {req.sent > 0 ? `${req.sent} / ${req.replied ?? 0}` : "—"}
                </span>
                <span className={`text-data font-mono font-semibold ${STATUS_COLOR[req.status] || "text-muted-foreground"}`}>
                  {STATUS_LABEL[req.status] || req.status}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AllRequests;
