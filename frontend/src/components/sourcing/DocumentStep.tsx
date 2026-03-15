import { useState } from "react";
import { motion } from "framer-motion";

interface DocumentStepProps {
  onSubmit: (docs: { documents: string[]; sampleAmount: string; customNote: string }) => void;
  onBack: () => void;
}

const documentOptions = [
  { id: "coa", label: "COA", description: "Certificate of Analysis — 시험성적서" },
  { id: "msds", label: "MSDS/SDS", description: "물질안전보건자료" },
  { id: "sample", label: "샘플", description: "평가용 무상 샘플 요청" },
  { id: "dmf", label: "DMF 사본", description: "Drug Master File 등록 사본" },
  { id: "gmp-cert", label: "GMP 인증서", description: "제조소 GMP 인증서 사본" },
  { id: "spec", label: "Specification", description: "원료 규격서" },
  { id: "stability", label: "안정성 자료", description: "Stability Study Data" },
];

const DocumentStep = ({ onSubmit, onBack }: DocumentStepProps) => {
  const [selected, setSelected] = useState<string[]>(["coa", "msds", "sample"]);
  const [sampleAmount, setSampleAmount] = useState("최대한 많이 (무상 제공)");
  const [customNote, setCustomNote] = useState("");
  const showSample = selected.includes("sample");

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
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
        <div className="text-data text-primary font-mono">STEP 4/5 — 요청 서류</div>
        <h2 className="text-xl font-semibold text-foreground">제조소에 요청할 서류를 선택하세요</h2>
        <p className="text-muted-foreground text-ui">기본 항목이 선택되어 있습니다. 추가/제거할 수 있습니다.</p>
      </div>

      <div className="grid gap-2">
        {documentOptions.map((doc, i) => {
          const isActive = selected.includes(doc.id);
          return (
            <motion.button
              key={doc.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => toggle(doc.id)}
              className={`
                glass-surface rounded-sm p-3 text-left flex items-center gap-3 transition-all duration-200 cursor-pointer
                ${isActive ? "glow-primary" : "hover:glass-surface-hover"}
              `}
              style={isActive ? { borderColor: 'hsl(160, 100%, 45%, 0.4)' } : {}}
            >
              <div className={`w-2 h-2 rounded-full transition-colors ${isActive ? "bg-primary" : "bg-muted-foreground/30"}`} />
              <div>
                <span className="font-mono text-data font-semibold text-foreground">{doc.label}</span>
                <span className="text-muted-foreground text-data ml-2">{doc.description}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {showSample && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-2"
        >
          <label className="text-data text-muted-foreground">샘플 수량</label>
          <select
            value={sampleAmount}
            onChange={(e) => setSampleAmount(e.target.value)}
            className="w-full glass-surface rounded-sm p-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="최대한 많이 (무상 제공)">최대한 많이 (무상 제공)</option>
            <option value="100g">100g</option>
            <option value="500g">500g</option>
            <option value="1kg">1kg</option>
            <option value="5kg">5kg</option>
          </select>
        </motion.div>
      )}

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
          onClick={() => onSubmit({ documents: selected, sampleAmount, customNote })}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-sm font-semibold text-ui hover:opacity-90 transition-opacity cursor-pointer"
        >
          제조소 탐색 시작 →
        </button>
      </div>
    </motion.div>
  );
};

export default DocumentStep;
