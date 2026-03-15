import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

interface SearchStepProps {
  onSearch: (query: string) => void;
}

const SearchStep = ({ onSearch }: SearchStepProps) => {
  const [query, setQuery] = useState("");
  const [checking, setChecking] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [original, setOriginal] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setChecking(true);
    setSuggestion(null);
    try {
      const res = await fetch(`${API_BASE}/sourcing/suggest-ingredient`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        const suggested = data.suggested;
        // 제안이 있고 입력값과 다르면 확인 요청
        if (suggested && suggested.toLowerCase() !== trimmed.toLowerCase()) {
          setOriginal(trimmed);
          setSuggestion(suggested);
          setChecking(false);
          return;
        }
      }
    } catch { /* ignore, proceed */ }
    setChecking(false);
    onSearch(trimmed);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex flex-col items-center justify-center min-h-[60vh] gap-8"
    >
      <div className="text-center space-y-3">
        <div className="text-data text-muted-foreground tracking-widest uppercase">
          API Sourcing Command Center
        </div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          원료 의약품 소싱 에이전트
        </h1>
        <p className="text-muted-foreground max-w-md">
          원료명을 입력하면 AI 에이전트가 글로벌 제조소 탐색부터 견적 확보까지 전 과정을 자동으로 수행합니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xl">
        <div className="relative glass-surface rounded-sm group focus-within:glow-primary transition-shadow duration-300">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSuggestion(null); }}
            placeholder="원료 의약품명을 입력하세요"
            className="w-full bg-transparent pl-11 pr-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none text-ui"
            disabled={checking}
          />
          {checking && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-data text-muted-foreground font-mono animate-pulse">
              확인 중...
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] overflow-hidden">
            <div className="scanning-line h-full w-full" />
          </div>
        </div>
      </form>

      {/* 오타 교정 제안 */}
      <AnimatePresence>
        {suggestion && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
            className="glass-surface rounded-sm px-6 py-4 max-w-xl w-full space-y-3"
          >
            <p className="text-ui text-muted-foreground">
              혹시{" "}
              <span className="text-primary font-semibold">{suggestion}</span>
              을(를) 말씀하신 건가요?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setSuggestion(null); onSearch(suggestion); }}
                className="bg-primary text-primary-foreground px-5 py-2 rounded-sm text-ui font-semibold hover:opacity-90"
              >
                네, {suggestion}
              </button>
              <button
                onClick={() => { setSuggestion(null); onSearch(original); }}
                className="glass-surface px-5 py-2 rounded-sm text-ui text-muted-foreground hover:text-foreground"
              >
                아니요, {original}로 계속
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SearchStep;
