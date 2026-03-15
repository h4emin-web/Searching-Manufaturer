import { useState } from "react";
import { motion } from "framer-motion";

interface RegionStepProps {
  onSubmit: (regions: string[]) => void;
  onBack: () => void;
}

const regions = [
  { id: "china",  label: "중국" },
  { id: "india",  label: "인도" },
  { id: "europe", label: "유럽" },
  { id: "usa",    label: "미국" },
  { id: "korea",  label: "국내" },
  { id: "other",  label: "기타 (일본, 대만 등)" },
];

const RegionStep = ({ onSubmit, onBack }: RegionStepProps) => {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
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
        <div className="text-data text-primary font-mono">STEP 3/5 — 제조소 지역</div>
        <h2 className="text-xl font-semibold text-foreground">소싱 대상 지역을 선택하세요</h2>
        <p className="text-muted-foreground text-ui">복수 선택 가능합니다. 선택한 지역의 제조소를 우선 탐색합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {regions.map((region, i) => {
          const isActive = selected.includes(region.id);
          return (
            <motion.button
              key={region.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => toggle(region.id)}
              className={`
                glass-surface rounded-sm p-4 text-left transition-all duration-200 cursor-pointer
                ${isActive ? "glow-primary" : "hover:glass-surface-hover"}
              `}
              style={isActive ? { borderColor: 'hsl(160, 100%, 45%, 0.4)' } : {}}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{region.label}</span>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary ml-auto animate-pulse-glow" />}
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="flex justify-between items-center">
        <div className="text-data text-muted-foreground">
          {selected.length > 0 ? `${selected.length}개 지역 선택됨` : "지역을 선택하세요"}
        </div>
        <button
          onClick={() => selected.length > 0 && onSubmit(selected)}
          disabled={selected.length === 0}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-sm font-semibold text-ui hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          다음 단계 →
        </button>
      </div>
    </motion.div>
  );
};

export default RegionStep;
