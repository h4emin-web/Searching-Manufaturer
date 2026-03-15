import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Manufacturer } from "@/pages/Index";

interface ResultsStepProps {
  apiName: string;
  manufacturers: Manufacturer[];
  onStartSourcing: (selected: string[], excluded: string[]) => void;
  onSearchMore: () => void;
  getFlag: (country: string) => string;
}

const ResultsStep = ({ apiName, manufacturers, onStartSourcing, onSearchMore, getFlag }: ResultsStepProps) => {
  const [excluded, setExcluded] = useState<string[]>([]);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [extras, setExtras] = useState<Manufacturer[]>([]);

  const allMfrs = [...manufacturers, ...extras];
  const visible = allMfrs.filter((m) => !excluded.includes(m.id));
  const excludedItems = allMfrs.filter((m) => excluded.includes(m.id));

  const toggleExclude = (id: string) => {
    setExcluded((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    const newMfr: Manufacturer = {
      id: "manual-" + Date.now(),
      name: customName.trim(),
      country: customCountry || "Unknown",
      contact_email: customEmail || undefined,
      certifications: [],
      source_llms: [],
      confidence_score: 1.0,
      is_excluded: false,
      is_manually_added: true,
    };
    setExtras(prev => [...prev, newMfr]);
    setCustomName(""); setCustomCountry(""); setCustomEmail("");
    setAddingCustom(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="space-y-2">
        <div className="text-data text-primary font-mono">STEP 5/5 — 탐색 결과</div>
        <h2 className="text-xl font-semibold text-foreground">
          {allMfrs.length}개 제조소 중 요건에 부합하는{" "}
          <span className="text-primary">{visible.length}곳</span>을 식별했습니다
        </h2>
        <p className="text-muted-foreground text-ui">
          제외할 제조소를 선택하세요. 나머지 제조소에 대해 소싱을 시작합니다.
        </p>
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {visible.map((m) => {
            const score = Math.round(m.confidence_score * 100);
            return (
              <motion.div
                key={m.id}
                layout
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                className="glass-surface rounded-sm p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span>{getFlag(m.country)}</span>
                      <span className="font-semibold text-foreground">{m.name}</span>
                      {m.is_manually_added && (
                        <span className="text-data font-mono px-2 py-0.5 rounded-sm bg-accent/10 text-accent">수동 추가</span>
                      )}
                      {m.source_llms.length > 1 && (
                        <span className="text-data font-mono px-2 py-0.5 rounded-sm bg-primary/10 text-primary">
                          {m.source_llms.length}개 AI 확인
                        </span>
                      )}
                      <span className="text-data text-muted-foreground">— {m.country}{m.city && `, ${m.city}`}</span>
                    </div>
                    <div className="flex gap-4 mb-2 flex-wrap">
                      <div>
                        <span className="text-data text-muted-foreground">신뢰도 </span>
                        <span className={`text-data font-mono font-semibold ${score >= 90 ? "text-primary" : "text-accent"}`}>
                          {score}%
                        </span>
                      </div>
                      {m.contact_email && (
                        <div>
                          <span className="text-data text-muted-foreground">✉ </span>
                          <span className="text-data font-mono text-foreground">{m.contact_email}</span>
                        </div>
                      )}
                      {m.website && (
                        <a
                          href={m.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-data text-muted-foreground hover:text-primary transition-colors"
                        >
                          🌐 웹사이트
                        </a>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {m.certifications.map((cert) => (
                        <span
                          key={cert}
                          className="text-data font-mono px-2 py-0.5 rounded-sm bg-primary/10 text-primary"
                        >
                          {cert}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleExclude(m.id)}
                    className="text-data text-muted-foreground hover:text-destructive transition-colors ml-4 cursor-pointer shrink-0"
                  >
                    제외
                  </button>
                </div>

                {/* Confidence bar */}
                <div className="mt-3">
                  <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${score}%` }} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {excludedItems.length > 0 && (
        <div className="space-y-2">
          <div className="text-data text-muted-foreground">제외된 제조소 ({excludedItems.length})</div>
          {excludedItems.map((m) => (
            <div key={m.id} className="glass-surface rounded-sm p-3 opacity-50 flex items-center justify-between">
              <span className="text-data text-muted-foreground">{getFlag(m.country)} {m.name}</span>
              <button
                onClick={() => toggleExclude(m.id)}
                className="text-data text-primary hover:underline cursor-pointer"
              >
                복원
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => setAddingCustom(true)}
          className="glass-surface hover:glass-surface-hover px-4 py-2.5 rounded-sm text-ui text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          + 제조소 직접 추가
        </button>
        <button
          onClick={onSearchMore}
          className="glass-surface hover:glass-surface-hover px-4 py-2.5 rounded-sm text-ui text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          🔍 다시 검색
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onStartSourcing(visible.map(m => m.id), excluded)}
          disabled={visible.length === 0}
          className="bg-primary text-primary-foreground px-8 py-2.5 rounded-sm font-semibold text-ui hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          🚀 {visible.length}개 제조소 소싱 시작
        </button>
      </div>

      <AnimatePresence>
        {addingCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-surface rounded-sm p-4 space-y-3"
          >
            <div className="text-ui text-foreground font-semibold">제조소 직접 추가</div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="제조소명 *"
                className="glass-surface rounded-sm p-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
              />
              <input
                value={customCountry}
                onChange={(e) => setCustomCountry(e.target.value)}
                placeholder="국가"
                className="glass-surface rounded-sm p-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
              />
              <input
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="이메일"
                className="glass-surface rounded-sm p-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 col-span-2"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAddingCustom(false)} className="text-data text-muted-foreground hover:text-foreground cursor-pointer">취소</button>
              <button onClick={handleAddCustom} className="bg-primary text-primary-foreground px-4 py-1.5 rounded-sm text-data font-semibold cursor-pointer">추가</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ResultsStep;
