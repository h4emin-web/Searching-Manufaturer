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

const countryFlag: Record<string, string> = {
  "India": "🇮🇳", "China": "🇨🇳", "Germany": "🇩🇪", "USA": "🇺🇸",
  "Korea": "🇰🇷", "Japan": "🇯🇵", "France": "🇫🇷", "Italy": "🇮🇹",
  "Spain": "🇪🇸", "UK": "🇬🇧", "Netherlands": "🇳🇱", "Switzerland": "🇨🇭",
};

const getFlag = (country: string) =>
  countryFlag[country] || (country?.toLowerCase().includes("korea") ? "🇰🇷" :
  country?.toLowerCase().includes("china") ? "🇨🇳" :
  country?.toLowerCase().includes("india") ? "🇮🇳" : "🌏");

const Index = () => {
  // Auth
  const [user, setUser] = useState<{ koreanName: string; englishName: string } | null>(null);
  const [view, setView] = useState<"login" | "requests" | "sourcing">("login");

  // Sourcing flow
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    setApiName("");
    setPurpose("");
    setRequirements([]);
    setManufacturers([]);
    setSourcingError("");
    setView("sourcing");
  };

  const handleViewRequest = (req: SourcingRequest) => {
    setApiName(req.ingredientName);
    setPurpose(req.purpose);
    setRequirements(req.requirements);
    setCurrentRequestId(req.id);
    if (req.status === "reviewing") {
      setStep("results");
    } else if (req.status === "monitoring" || req.status === "outreach") {
      setStep("sourcing");
    } else {
      setStep("searching");
    }
    setView("sourcing");
  };

  // Save request to localStorage
  const saveRequest = (req: Partial<SourcingRequest>) => {
    if (!user) return;
    const key = `requests_${user.koreanName}`;
    const stored = localStorage.getItem(key);
    const requests: SourcingRequest[] = stored ? JSON.parse(stored) : [];
    const existing = requests.findIndex(r => r.id === currentRequestId);
    if (existing >= 0) {
      requests[existing] = { ...requests[existing], ...req };
    } else {
      const newReq: SourcingRequest = {
        id: currentRequestId,
        ingredientName: apiName,
        purpose,
        requirements,
        status: "searching",
        createdAt: new Date().toISOString(),
        ...req,
      };
      requests.unshift(newReq);
    }
    localStorage.setItem(key, JSON.stringify(requests));
  };

  const updateRequestStatus = (id: string, updates: Partial<SourcingRequest>) => {
    if (!user) return;
    const key = `requests_${user.koreanName}`;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    const requests: SourcingRequest[] = JSON.parse(stored);
    const idx = requests.findIndex(r => r.id === id);
    if (idx >= 0) {
      requests[idx] = { ...requests[idx], ...updates };
      localStorage.setItem(key, JSON.stringify(requests));
    }
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

  const handleSearch = (query: string) => {
    setApiName(query);
    setStep("purpose");
  };

  const handlePurpose = (p: string) => {
    setPurpose(p);
    setStep("requirements");
  };

  const handleRequirements = (reqs: Record<string, boolean> | string[]) => {
    const selected = Array.isArray(reqs)
      ? reqs
      : Object.entries(reqs).filter(([, v]) => v).map(([k]) => k);
    setRequirements(selected);
    setStep("region");
  };

  const handleRegion = (selectedRegions: string[]) => {
    setRegions(selectedRegions);
    setStep("documents");
  };

  const handleDocuments = async () => {
    setStep("searching");
    setSourcingProgress(0);
    setSourcingError("");

    const reqId = "req-" + Date.now();
    setCurrentRequestId(reqId);

    try {
      const res = await fetch(`${API_BASE}/sourcing/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId || "demo",
          ingredient_name: apiName,
          use_case: purpose,
          regulatory_requirements: requirements,
          regions,
          sourcing_notes: "",
          requester_name: user?.englishName || "",
        }),
      });
      const data = await res.json();
      const taskId = data.task_id;

      // Save request
      saveRequest({ id: reqId, taskId, status: "searching" });

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/sourcing/${taskId}`);
          const statusData = await statusRes.json();
          setSourcingProgress(statusData.progress || 0);

          if (statusData.status === "completed") {
            clearInterval(pollRef.current!);
            const mfrs: Manufacturer[] = (statusData.deduplicated || []).map((m: any) => ({
              id: m.id || m.canonical_name || Math.random().toString(),
              name: m.name,
              country: m.country,
              city: m.city,
              contact_email: m.contact_email,
              website: m.website,
              web_form_url: m.web_form_url,
              certifications: m.certifications || [],
              source_llms: m.source_llms || [],
              confidence_score: m.confidence_score || 0.8,
              is_excluded: false,
            }));
            setManufacturers(mfrs);
            updateRequestStatus(reqId, { status: "reviewing", totalFound: statusData.total_deduplicated });
            setStep("results");
          } else if (statusData.status === "failed") {
            clearInterval(pollRef.current!);
            setSourcingError("검색 중 오류가 발생했습니다.");
          }
        } catch {
          clearInterval(pollRef.current!);
          setSourcingError("서버 연결 오류");
        }
      }, 2000);
    } catch {
      setSourcingError("검색 시작 실패");
    }
  };

  const handleStartSourcing = (selected: string[], excluded: string[]) => {
    setManufacturers(prev => prev.map(m => ({ ...m, is_excluded: excluded.includes(m.id) })));
    updateRequestStatus(currentRequestId, { status: "monitoring", sent: selected.length, replied: 0 });
    setStep("sourcing");
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Render login
  if (view === "login") {
    return <LoginStep onLogin={handleLogin} />;
  }

  // Render my requests
  if (view === "requests" && user) {
    return (
      <MyRequests
        user={user}
        onNewRequest={handleNewRequest}
        onViewRequest={handleViewRequest}
      />
    );
  }

  // Render sourcing flow
  const progressWidth =
    step === "purpose" ? "20%" :
    step === "requirements" ? "40%" :
    step === "region" ? "60%" :
    step === "documents" ? "80%" :
    (step === "searching" || step === "results" || step === "sourcing") ? "100%" : "0%";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
          <div className="text-data text-muted-foreground font-mono">
            {user?.koreanName} —{" "}
            {step === "search" && "원료 입력"}
            {step === "purpose" && "Step 1/5"}
            {step === "requirements" && "Step 2/5"}
            {step === "region" && "Step 3/5"}
            {step === "documents" && "Step 4/5"}
            {step === "searching" && "AI 검색 중..."}
            {step === "results" && "Step 5/5"}
            {step === "sourcing" && "소싱 진행 중"}
          </div>
        </div>
      </header>

      {/* Progress bar */}
      {step !== "search" && (
        <div className="h-[2px] bg-secondary">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: progressWidth }} />
        </div>
      )}

      {/* Main content */}
      <main className={`px-6 py-8 ${step === "sourcing" ? "pb-60" : ""}`}>
        <AnimatePresence mode="wait">
          {step === "search" && <SearchStep key="search" onSearch={handleSearch} />}
          {step === "purpose" && <PurposeStep key="purpose" apiName={apiName} onSelect={handlePurpose} />}
          {step === "requirements" && (
            <RequirementsStep key="requirements" purpose={purpose} onSubmit={handleRequirements} />
          )}
          {step === "region" && <RegionStep key="region" onSubmit={handleRegion} />}
          {step === "documents" && <DocumentStep key="documents" onSubmit={handleDocuments} />}

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
                  <button onClick={handleDocuments} className="text-data text-primary hover:underline cursor-pointer">
                    다시 시도
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-center space-y-3">
                    <div className="text-data text-primary font-mono tracking-widest">AI SOURCING</div>
                    <h2 className="text-xl font-semibold text-foreground">
                      <span className="text-primary">{apiName}</span> 제조소 탐색 중
                    </h2>
                    <p className="text-muted-foreground text-ui">
                      Gemini와 Qwen이 전 세계 제조소를 병렬로 검색하고 있습니다...
                    </p>
                  </div>
                  <div className="w-full max-w-md space-y-4">
                    <div className="flex justify-between text-data text-muted-foreground font-mono">
                      <span>검색 진행률</span>
                      <span>{sourcingProgress}%</span>
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
