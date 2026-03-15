import { useState } from "react";
import { motion } from "framer-motion";

interface RequirementsStepProps {
  purpose: string;
  onSubmit: (requirements: Record<string, boolean>) => void;
  onBack: () => void;
}

const requirementsByPurpose: Record<string, { id: string; label: string }[]> = {
  pharma: [
    { id: "who-gmp", label: "WHO-GMP" },
    { id: "kdmf", label: "KDMF" },
    { id: "wc", label: "WC (Written Confirmation)" },
    { id: "copp", label: "COPP" },
    { id: "cep", label: "CEP/COS" },
    { id: "usdmf", label: "US DMF" },
  ],
  cosmetic: [
    { id: "cgmp", label: "CGMP" },
    { id: "icid", label: "ICID 등록" },
    { id: "reach", label: "REACH" },
    { id: "safety", label: "안전성 자료" },
  ],
  food: [
    { id: "haccp", label: "HACCP" },
    { id: "fda-gras", label: "FDA GRAS" },
    { id: "food-additive", label: "식품첨가물 등록" },
    { id: "halal", label: "Halal 인증" },
    { id: "kosher", label: "Kosher 인증" },
  ],
};

const RequirementsStep = ({ purpose, onSubmit, onBack }: RequirementsStepProps) => {
  const [requirements, setRequirements] = useState(requirementsByPurpose[purpose] || []);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [customInput, setCustomInput] = useState("");

  const toggle = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    const id = `custom-${Date.now()}`;
    setRequirements((prev) => [...prev, { id, label: trimmed }]);
    setSelected((prev) => ({ ...prev, [id]: true }));
    setCustomInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustom();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <div className="space-y-2">
        <button onClick={onBack} className="text-data text-muted-foreground hover:text-foreground transition-colors mb-1">← 뒤로</button>
        <div className="text-data text-primary font-mono">STEP 2/5 — 규제 요건</div>
        <h2 className="text-xl font-semibold text-foreground">필요한 인증 및 규제 요건을 선택하세요</h2>
        <p className="text-muted-foreground text-ui">
          필요한 요건을 선택하거나, 직접 추가할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-2">
        {requirements.map((req, i) => {
          const isActive = selected[req.id];
          return (
            <motion.button
              key={req.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => toggle(req.id)}
              className={`
                glass-surface rounded-sm p-3 text-left flex items-center gap-3 transition-all duration-200 cursor-pointer
                ${isActive ? "glow-primary" : "hover:glass-surface-hover"}
              `}
              style={isActive ? { borderColor: 'hsl(160, 100%, 45%, 0.4)' } : {}}
            >
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  isActive ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
              <span className="font-mono text-data font-semibold text-foreground">{req.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* 직접 추가 입력 */}
      <div className="flex gap-2">
        <input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="필요한 요건을 직접 입력하세요"
          className="flex-1 glass-surface rounded-sm p-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
        />
        <button
          onClick={addCustom}
          disabled={!customInput.trim()}
          className="glass-surface hover:glass-surface-hover px-4 py-2.5 rounded-sm text-ui text-foreground transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          추가
        </button>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => onSubmit(selected)}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-sm font-semibold text-ui hover:opacity-90 transition-opacity cursor-pointer"
        >
          다음 단계 →
        </button>
      </div>

    </motion.div>
  );
};

export default RequirementsStep;
