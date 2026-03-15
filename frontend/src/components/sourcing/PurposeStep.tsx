import { motion } from "framer-motion";

interface PurposeStepProps {
  apiName: string;
  onSelect: (purpose: string) => void;
  onBack: () => void;
}

const purposes = [
  { id: "pharma",   label: "의약품" },
  { id: "cosmetic", label: "화장품" },
  { id: "food",     label: "식품"   },
];

const PurposeStep = ({ apiName, onSelect, onBack }: PurposeStepProps) => {
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
        <div className="text-data text-primary font-mono">STEP 1/5 — 용도 선택</div>
        <h2 className="text-xl font-semibold text-foreground">
          <span className="text-foreground font-mono">{apiName}</span>의 사용 용도를 선택하세요
        </h2>
      </div>

      <div className="flex gap-3">
        {purposes.map((p, i) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            onClick={() => onSelect(p.id)}
            className="glass-surface hover:glass-surface-hover rounded-sm px-8 py-3 font-semibold text-foreground transition-all duration-200 hover:glow-primary cursor-pointer"
          >
            {p.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default PurposeStep;
