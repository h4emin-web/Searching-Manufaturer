import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LoginStep from "@/components/sourcing/LoginStep";
import SearchStep from "@/components/sourcing/SearchStep";
import PurposeStep from "@/components/sourcing/PurposeStep";
import RequirementsStep from "@/components/sourcing/RequirementsStep";
import RegionStep from "@/components/sourcing/RegionStep";
import DocumentStep from "@/components/sourcing/DocumentStep";
import ResultsStep from "@/components/sourcing/ResultsStep";
import AgentTerminal from "@/components/sourcing/AgentTerminal";
import MyRequests, { SourcingRequest } from "@/pages/MyRequests";
import AllRequests from "@/pages/AllRequests";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

type Step = "search" | "purpose" | "requirements" | "region" | "documents" | "searching" | "results" | "sourcing";

export interface Manufacturer {
  id: string;
  name: string;
  country: string;
  city?: string;
  contact_email?: string;
  website?: string;
  web_form_url?: string;
  certifications: string[];
  source_llms: string[];
  confidence_score: number;
  is_excluded: boolean;
  is_manually_added?: boolean;
}

const getFlag = (_country: string) => "";

// ─── API helpers ──────────────────────────────────────────────
async function apiSaveRequest(userName: string, req: SourcingRequest) {
  try {
    await fetch(`${API_BASE}/users/${encodeURIComponent(userName)}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request: {
          id: req.id,
          ingredient_name: req.ingredientName,
          purpose: req.purpose,
          requirements: req.requirements,
          status: req.status,
          task_id: req.taskId ?? null,
          total_found: req.totalFound ?? 0,
          sent: req.sent ?? 0,
          replied: req.replied ?? 0,
          created_at: req.createdAt,
        },
      }),
    });
  } catch { /* ignore */ }
}

async function apiUpdateRequest(userName: string, requestId: string, updates: Partial<SourcingRequest>) {
  const body: Record<string, unknown> = {};
  if (updates.status !== undefined) body.status = updates.status;
  if (updates.taskId !== undefined) body.task_id = updates.taskId;
  if (updates.totalFound !== undefined) body.total_found = updates.totalFound;
  if (updates.sent !== undefined) body.sent = updates.sent;
  if (updates.replied !== undefined) body.replied = updates.replied;
  try {
    await fetch(`${API_BASE}/users/${encodeURIComponent(userName)}/requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch { /* ignore */ }
}

async function apiLoadRequests(userName: string): Promise<SourcingRequest[]> {
  try {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userName)}/requests`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// ─── Component ───────────────────────────────────────────────
const Index = () => {
  const [user, setUser] = useState<{ koreanName: string; englishName: string } | null>(null);
  const [view, setView] = useState<"login" | "requests" | "sourcing" | "all-requests">("login");

  const [step, setStep] = useState<Step>("search");
  const [apiName, setApiName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [requirements, setRequirements] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [sourcingProgress, setSourcingProgress] = useState(0);
  const [sourcingError, setSourcingError] = useState("");
  const [currentRequestId, setCurrentRequestId] = useState<string>("");
  const [currentTaskId, setCurrentTaskId] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // ─── polling helper (survives view changes) ───────────────────
  const startPolling = (taskId: string, reqId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const statusRes = await fetch(`${API_BASE}/sourcing/${taskId}`);
        const statusData = await statusRes.json();
        // only move forward, never backward
        if (statusData.progress) setSourcingProgress(prev => Math.max(prev, statusData.progress));

        if (statusData.status === "completed") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          // 에러 메시지 있으면 표시 (API 키 미설정 등)
          if (statusData.error && (!statusData.deduplicated || statusData.deduplicated.length === 0)) {
            setSourcingError(`검색 실패: ${statusData.error}`);
            setView("sourcing");
            return;
          }
          const mfrs: Manufacturer[] = (statusData.deduplicated || []).map((m: any) => ({
            id: m.id || m.canonical_name || Math.random().toString(),
            name: m.name, country: m.country, city: m.city,
            contact_email: m.contact_email, website: m.website,
            web_form_url: m.web_form_url,
            certifications: m.certifications || [],
            source_llms: m.source_llms || [],
            confidence_score: m.confidence_score || 0.8,
            is_excluded: false,
          }));
          setManufacturers(mfrs);
          if (userRef.current) {
            await apiUpdateRequest(userRef.current.koreanName, reqId, {
              status: "reviewing", totalFound: statusData.total_deduplicated,
            });
          }
          setStep("results");
          setView("sourcing"); // bring user to results regardless of current view
        } else if (statusData.status === "failed") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          if (statusData.error === "cancelled") {
            setStep("search");
            setView("requests");
          } else {
            setSourcingError(statusData.error ? `오류: ${statusData.error}` : "검색 중 오류가 발생했습니다.");
            setView("sourcing");
          }
        }
      } catch {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setSourcingError("서버 연결 오류");
        setView("sourcing");
      }
    }, 2000);
  };

  // ─── fake progress animation while searching ─────────────────
  // slowly creeps toward 65% so the bar moves even before backend reports 70%
  useEffect(() => {
    if (step !== "searching") return;
    const timer = setInterval(() => {
      setSourcingProgress(prev => {
        if (prev >= 65) return prev;
        return Math.min(prev + 0.6, 65);
      });
    }, 800);
    return () => clearInterval(timer);
  }, [step]);

  // Load user from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("pharma_user");
    if (stored) {
      setUser(JSON.parse(stored));
      setView("requests");
    }
  }, []);

  const handleLogin = (koreanName: string, englishName: string) => {
    const u = { koreanName, englishName };
    setUser(u);
    localStorage.setItem("pharma_user", JSON.stringify(u));
    setView("requests");
  };

  const handleNewRequest = () => {
    setStep("search");
    setApiName(""); setPurpose(""); setRequirements([]);
    setManufacturers([]); setSourcingError("");
    setCurrentRequestId(""); setCurrentTaskId("");
    setView("sourcing");
  };

  const handleViewRequest = (req: SourcingRequest) => {
    setApiName(req.ingredientName);
    setPurpose(req.purpose);
    setRequirements(req.requirements);
    setCurrentRequestId(req.id);
    setCurrentTaskId(req.taskId || "");
    if (req.status === "reviewing") {
      setStep("results");
    } else if (req.status === "monitoring" || req.status === "outreach") {
      setStep("sourcing");
    } else if (req.status === "searching" && req.taskId) {
      // resume polling for in-progress task
      setSourcingProgress(0);
      setSourcingError("");
      setStep("searching");
      startPolling(req.taskId, req.id);
    } else {
      setStep("searching");
    }
    setView("sourcing");
  };

  // Create session
  useEffect(() => {
    if (view !== "sourcing") return;
    fetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then(r => r.json())
      .then(data => setSessionId(data.id || data.session_id || "demo"))
      .catch(() => setSessionId("demo-" + Date.now()));
  }, [view]);

  const handleSearch = (query: string) => { setApiName(query); setStep("purpose"); };
  const handlePurpose = (p: string) => { setPurpose(p); setStep("requirements"); };

  const handleRequirements = (reqs: Record<string, boolean> | string[]) => {
    const selected = Array.isArray(reqs)
      ? reqs
      : Object.entries(reqs).filter(([, v]) => v).map(([k]) => k);
    setRequirements(selected);
    setStep("region");
  };

  const handleRegion = (r: string[]) => { setRegions(r); setStep("documents"); };

  const handleDocuments = async () => {
    setStep("searching");
    setSourcingProgress(0);
    setSourcingError("");
    if (pollRef.current) clearInterval(pollRef.current);

    const reqId = "req-" + Date.now();
    setCurrentRequestId(reqId);

    // Save initial request
    if (user) {
      const newReq: SourcingRequest = {
        id: reqId, ingredientName: apiName, purpose,
        requirements, status: "searching",
        createdAt: new Date().toISOString(),
      };
      await apiSaveRequest(user.koreanName, newReq);
    }

    try {
      const res = await fetch(`${API_BASE}/sourcing/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId || "demo",
          ingredient_name: apiName,
          use_case: purpose === "pharma" ? "pharmaceutical" : purpose,
          regulatory_requirements: requirements,
          regions,
          sourcing_notes: "",
          requester_name: user?.englishName || "",
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setSourcingError(`검색 시작 실패: ${errData.detail || res.status}`);
        return;
      }
      const data = await res.json();
      const taskId = data.task_id;
      if (!taskId) {
        setSourcingError("서버 응답 오류: task_id 없음");
        return;
      }
      setCurrentTaskId(taskId);
      if (user) await apiUpdateRequest(user.koreanName, reqId, { taskId });

      startPolling(taskId, reqId);
    } catch {
      setSourcingError("검색 시작 실패. 백엔드 서버를 확인해주세요.");
    }
  };

  // Cancel sourcing
  const handleCancel = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (currentTaskId) {
      try {
        await fetch(`${API_BASE}/sourcing/${currentTaskId}`, { method: "DELETE" });
      } catch { /* ignore */ }
    }
    if (user && currentRequestId) {
      await apiUpdateRequest(user.koreanName, currentRequestId, { status: "searching" });
    }
    setView("requests");
  };

  const handleStartSourcing = async (selected: string[], excluded: string[]) => {
    setManufacturers(prev => prev.map(m => ({ ...m, is_excluded: excluded.includes(m.id) })));
    if (user && currentRequestId) {
      await apiUpdateRequest(user.koreanName, currentRequestId, {
        status: "monitoring", sent: selected.length, replied: 0,
      });
    }
    setStep("sourcing");
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (view === "login") return <LoginStep onLogin={handleLogin} />;
  if (view === "all-requests" && user) {
    return <AllRequests onBack={() => setView("requests")} apiBase={API_BASE} />;
  }
  if (view === "requests" && user) {
    return (
      <MyRequests
        user={user}
        onNewRequest={handleNewRequest}
        onViewRequest={handleViewRequest}
        onViewAll={() => setView("all-requests")}
        apiBase={API_BASE}
      />
    );
  }

  const progressWidth =
    step === "purpose" ? "20%" : step === "requirements" ? "40%" :
    step === "region" ? "60%" : step === "documents" ? "80%" :
    (step === "searching" || step === "results" || step === "sourcing") ? "100%" : "0%";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="font-semibold text-foreground tracking-tight">Pharma Sourcing</span>
          <span className="text-data text-muted-foreground font-mono">v1.0</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setView("requests")}
            className="text-data text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            내 요청 목록
          </button>
          {step !== "search" && (
            <button
              onClick={() => { setStep("search"); setApiName(""); setPurpose(""); setManufacturers([]); }}
              className="text-data text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              새 소싱
            </button>
          )}
          <span className="text-data text-muted-foreground font-mono">
            {user?.koreanName} —{" "}
            {step === "search" && "원료 입력"}
            {step === "purpose" && "Step 1/5"}
            {step === "requirements" && "Step 2/5"}
            {step === "region" && "Step 3/5"}
            {step === "documents" && "Step 4/5"}
            {step === "searching" && "AI 검색 중..."}
            {step === "results" && "Step 5/5"}
            {step === "sourcing" && "소싱 진행 중"}
          </span>
        </div>
      </header>

      {step !== "search" && (
        <div className="h-[2px] bg-secondary">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: progressWidth }} />
        </div>
      )}

      <main className={`px-6 py-8 ${step === "sourcing" ? "pb-60" : ""}`}>
        <AnimatePresence mode="wait">
          {step === "search" && <SearchStep key="search" onSearch={handleSearch} />}
          {step === "purpose" && <PurposeStep key="purpose" apiName={apiName} onSelect={handlePurpose} onBack={() => setStep("search")} />}
          {step === "requirements" && (
            <RequirementsStep key="requirements" purpose={purpose} onSubmit={handleRequirements} onBack={() => setStep("purpose")} />
          )}
          {step === "region" && <RegionStep key="region" onSubmit={handleRegion} onBack={() => setStep("requirements")} />}
          {step === "documents" && <DocumentStep key="documents" onSubmit={handleDocuments} onBack={() => setStep("region")} />}

          {step === "searching" && (
            <motion.div
              key="searching"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[60vh] gap-8"
            >
              {sourcingError ? (
                <div className="text-center space-y-4">
                  <p className="text-accent text-ui">{sourcingError}</p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={handleDocuments} className="bg-primary text-primary-foreground px-5 py-2 rounded-sm text-ui font-semibold hover:opacity-90">
                      다시 시도
                    </button>
                    <button onClick={() => setView("requests")} className="glass-surface px-5 py-2 rounded-sm text-ui text-muted-foreground hover:text-foreground">
                      목록으로
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-center space-y-3">
                    <div className="text-data text-primary font-mono tracking-widest">AI SOURCING</div>
                    <h2 className="text-xl font-semibold text-foreground">
                      <span className="text-foreground">{apiName}</span> 제조소 탐색 중
                    </h2>
                    <p className="text-muted-foreground text-ui">
                      Gemini와 Qwen이 전 세계 제조소를 병렬로 검색하고 있습니다...
                    </p>
                  </div>

                  <div className="w-full max-w-md space-y-4">
                    <div className="flex justify-between text-data text-muted-foreground font-mono">
                      <span>검색 진행률</span>
                      <span>{Math.round(sourcingProgress)}%</span>
                    </div>
                    <div className="h-[2px] bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        animate={{ width: `${sourcingProgress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <div className="relative h-8 overflow-hidden rounded-sm glass-surface">
                      <div className="scanning-line h-full w-full" />
                    </div>
                    <div className="flex gap-6 justify-center">
                      {["Gemini", "Qwen"].map(model => (
                        <div key={model} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
                          <span className="text-data text-muted-foreground font-mono">{model} 검색 중...</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 중단 버튼 */}
                  <button
                    onClick={handleCancel}
                    className="glass-surface hover:glass-surface-hover px-6 py-2.5 rounded-sm text-ui text-muted-foreground hover:text-destructive transition-colors cursor-pointer border border-border hover:border-destructive/30"
                  >
                    ✕ 검색 중단
                  </button>
                </>
              )}
            </motion.div>
          )}

          {step === "results" && (
            <ResultsStep
              key="results"
              apiName={apiName}
              manufacturers={manufacturers}
              onStartSourcing={handleStartSourcing}
              onSearchMore={handleDocuments}
              getFlag={getFlag}
            />
          )}
        </AnimatePresence>
      </main>

      {step === "sourcing" && (
        <AgentTerminal
          apiName={apiName}
          isActive={true}
          sessionId={sessionId}
          manufacturers={manufacturers.filter(m => !m.is_excluded)}
        />
      )}
    </div>
  );
};

export default Index;
