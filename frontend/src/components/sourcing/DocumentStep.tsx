import { useState } from "react";
import { motion } from "framer-motion";

export interface DocumentData {
  documents: string[];
  pricingQuantities: string[];
  sampleAmount: string;
  customNote: string;
}

interface DocumentStepProps {
  onSubmit: (data: DocumentData) => void;
  onBack: () => void;
}

const topItems = [
  { id: "pricing", label: "단가", description: "CIF Busan 기준 수량별 단가 문의" },
  { id: "moq",     label: "MOQ",  description: "최소 주문 수량 문의" },
  { id: "sample",  label: "샘플", description: "평가용 무상 샘플 요청" },
];

const docItems = [
  { id: "coa",       label: "COA",          description: "Certificate of Analysis — 시험성적서" },
  { id: "msds",      label: "MSDS/SDS",     description: "물질안전보건자료" },
  { id: "dmf",       label: "DMF 사본",     description: "Drug Master File 등록 사본" },
  { id: "gmp-cert",  label: "GMP 인증서",   description: "제조소 GMP 인증서 사본" },
  { id: "spec",      label: "Specification", description: "원료 규격서" },
  { id: "stability", label: "안정성 자료",   description: "Stability Study Data" },
];

const DocumentStep = ({ onSubmit, onBack }: DocumentStepProps) => {
  const [selected, setSelected] = useState<string[]>(["pricing", "moq", "sample"]);
  const [pricingInput, setPricingInput] = useState("");
  const [pricingQuantities, setPricingQuantities] = useState<string[]>([]);
  const [sampleAmount, setSampleAmount] = useState("");
  const [customNote, setCustomNote] = useState("");

  const showPricing = selected.includes("pricing");
  const showSample  = selected.includes("sample");

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const addQuantity = () => {
    const val = pricingInput.trim();
    if (!val) return;
    // 쉼표로 구분된 경우 여러 개 처리
    const parts = val.split(",").map(s => s.trim()).filter(Boolean);
    setPricingQuantities(prev => [...new Set([...prev, ...parts])]);
    setPricingInput("");
  };

  const removeQuantity = (q: string) => {
    setPricingQuantities(prev => prev.filter(x => x !== q));
  };

  const allItems = [...topItems, ...docItems];

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
        <div className="text-data text-primary font-mono">STEP 4/5 — 요청 내용</div>
        <h2 className="text-xl font-semibold text-foreground">요청할 내용을 선택하세요</h2>
        <p className="text-muted-foreground text-ui">기본 항목이 선택되어 있습니다. 추가/제거할 수 있습니다.</p>
      </div>

      <div className="grid gap-2">
        {allItems.map((item, i) => {
          const isActive = selected.includes(item.id);
          const isFirst = i === topItems.length;
          return (
            <div key={item.id}>
              {isFirst && (
                <div className="border-t border-border my-3" />
              )}
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => toggle(item.id)}
                className={`w-full glass-surface rounded-sm p-3 text-left flex items-center gap-3 transition-all duration-200 cursor-pointer ${
                  isActive ? "glow-primary" : "hover:glass-surface-hover"
                }`}
                style={isActive ? { borderColor: "hsl(160, 100%, 45%, 0.4)" } : {}}
              >
                <div className={`w-2 h-2 rounded-full transition-colors shrink-0 ${isActive ? "bg-primary" : "bg-muted-foreground/30"}`} />
                <div>
                  <span className="font-mono text-data font-semibold text-foreground">{item.label}</span>
                  <span className="text-muted-foreground text-data ml-2">{item.description}</span>
                </div>
              </motion.button>

              {/* 단가 수량 입력 */}
              {item.id === "pricing" && showPricing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-2 ml-5 space-y-2"
                >
                  <label className="text-data text-muted-foreground">수량 기준 입력 (Enter 또는 쉼표로 구분)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={pricingInput}
                      onChange={(e) => setPricingInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQuantity(); } }}
                      placeholder="예: 10kg, 100kg"
                      className="flex-1 glass-surface rounded-sm p-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
                    />
                    <button
                      type="button"
                      onClick={addQuantity}
                      className="px-4 glass-surface hover:glass-surface-hover rounded-sm text-data text-muted-foreground hover:text-foreground transition-colors"
                    >
                      추가
                    </button>
                  </div>
                  {pricingQuantities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {pricingQuantities.map((q) => (
                        <span key={q} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-data font-mono rounded-sm">
                          {q}
                          <button onClick={() => removeQuantity(q)} className="hover:text-destructive transition-colors">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* 샘플 수량 입력 */}
              {item.id === "sample" && showSample && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-2 ml-5"
                >
                  <input
                    type="text"
                    value={sampleAmount}
                    onChange={(e) => setSampleAmount(e.target.value)}
                    placeholder="최소 필요 수량 (예: 500g, 1kg — 비워두면 무상 최대 요청)"
                    className="w-full glass-surface rounded-sm p-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
                  />
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <label className="text-data text-muted-foreground">추가 요청 사항 (선택)</label>
        <textarea
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          placeholder="특별히 요청하고 싶은 사항을 기재하세요..."
          className="w-full glass-surface rounded-sm p-3 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary resize-none h-20 placeholder:text-muted-foreground/50"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => onSubmit({ documents: selected, pricingQuantities, sampleAmount, customNote })}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-sm font-semibold text-ui hover:opacity-90 transition-opacity cursor-pointer"
        >
          제조소 탐색 시작 →
        </button>
      </div>
    </motion.div>
  );
};

export default DocumentStep;
