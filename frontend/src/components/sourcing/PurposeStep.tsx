import { motion } from "framer-motion";

interface PurposeStepProps {
  apiName: string;
  onSelect: (purpose: string) => void;
  onBack: () => void;
}

const purposes = [
  {
    id: "pharma",
    label: "의약품",
    description: "WHO-GMP, KDMF, WC, COPP 등 규제 요건 충족 필요",
    icon: "💊",
  },
  {
    id: "cosmetic",
    label: "화장품",
    description: "CGMP, ICID 등록, 안전성 자료 필요",
    icon: "🧴",
  },
  {
    id: "food",
    label: "식품",
    description: "HACCP, 식품첨가물 등록, 규격 적합성 확인 필요",
    icon: "🍽️",
  },
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
        <p className="text-muted-foreground text-ui">
          용도에 따라 필요한 규제 요건과 인증 조건이 달라집니다.
        </p>
      </div>

      <div className="grid gap-3">
        {purposes.map((p, i) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={() => onSelect(p.id)}
            className="glass-surface hover:glass-surface-hover rounded-sm p-4 text-left flex items-start gap-4 transition-all duration-200 hover:glow-primary group cursor-pointer"
          >
            <span className="text-2xl">{p.icon}</span>
            <div>
              <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {p.label}
              </div>
              <div className="text-muted-foreground text-data mt-1">{p.description}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default PurposeStep;
