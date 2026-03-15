import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";

interface SearchStepProps {
  onSearch: (query: string) => void;
}

const SearchStep = ({ onSearch }: SearchStepProps) => {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="원료 의약품명을 입력하세요"
            className="w-full bg-transparent pl-11 pr-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none text-ui"
          />
          <div className="absolute bottom-0 left-0 right-0 h-[1px] overflow-hidden">
            <div className="scanning-line h-full w-full" />
          </div>
        </div>
      </form>

    </motion.div>
  );
};

export default SearchStep;
