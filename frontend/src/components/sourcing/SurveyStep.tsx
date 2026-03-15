import { useState } from "react";
import { motion } from "framer-motion";

export interface SurveyData {
  clientSituation: string;
  clientSituationOther: string;
  ingredientUse: string;
  endUserDisclosure: "가능" | "불가능" | "";
  disclosureTo: string;
  confidentialInfo: string;
  specialNotes: string;
}

interface SurveyStepProps {
  onSubmit: (data: SurveyData) => void;
  onBack: () => void;
}

const CLIENT_SITUATIONS = [
  "신제품 개발용",
  "제조사 이원화",
  "신규 제조원 발굴",
  "기타",
];

const SurveyStep = ({ onSubmit, onBack }: SurveyStepProps) => {
  const [clientSituation, setClientSituation] = useState("");
  const [clientSituationOther, setClientSituationOther] = useState("");
  const [ingredientUse, setIngredientUse] = useState("");
  const [endUserDisclosure, setEndUserDisclosure] = useState<"가능" | "불가능" | "">("");
  const [disclosureTo, setDisclosureTo] = useState("");
  const [confidentialInfo, setConfidentialInfo] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");

  const canSubmit = clientSituation !== "" && ingredientUse.trim() !== "" && endUserDisclosure !== "";

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      clientSituation,
      clientSituationOther,
      ingredientUse,
      endUserDisclosure,
      disclosureTo,
      confidentialInfo,
      specialNotes,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="max-w-2xl mx-auto space-y-8"
    >
      <div className="space-y-2">
        <button onClick={onBack} className="text-data text-muted-foreground hover:text-foreground transition-colors">← 뒤로</button>
        <div className="text-data text-primary font-mono">STEP 2/6 — 소싱 현황</div>
        <h2 className="text-xl font-semibold text-foreground">소싱 배경을 알려주세요</h2>
      </div>

      {/* Q1 고객사 현황 */}
      <div className="space-y-3">
        <div className="text-ui font-semibold text-foreground">고객사 현황</div>
        <div className="flex flex-wrap gap-2">
          {CLIENT_SITUATIONS.map((s) => (
            <button
              key={s}
              onClick={() => setClientSituation(s)}
              className={`px-4 py-2 rounded-sm text-ui transition-all duration-150 border ${
                clientSituation === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "glass-surface border-border text-foreground hover:glass-surface-hover"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {clientSituation === "기타" && (
          <input
            value={clientSituationOther}
            onChange={(e) => setClientSituationOther(e.target.value)}
            placeholder="상황을 직접 입력해주세요"
            className="w-full glass-surface rounded-sm px-4 py-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
          />
        )}
      </div>

      {/* Q2 원료 사용 용도 */}
      <div className="space-y-2">
        <div className="text-ui font-semibold text-foreground">원료 사용 용도</div>
        <p className="text-data text-muted-foreground">예: API, 부형제, 샴푸 베이스, 연고 기제 등</p>
        <input
          value={ingredientUse}
          onChange={(e) => setIngredientUse(e.target.value)}
          placeholder="사용 용도를 입력하세요"
          className="w-full glass-surface rounded-sm px-4 py-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Q3 END USER 공개 여부 */}
      <div className="space-y-3">
        <div className="text-ui font-semibold text-foreground">제조원에 End User 공개 가능 여부</div>
        <div className="flex gap-3">
          {(["가능", "불가능"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setEndUserDisclosure(opt)}
              className={`px-6 py-2.5 rounded-sm text-ui transition-all duration-150 border ${
                endUserDisclosure === opt
                  ? "bg-primary text-primary-foreground border-primary"
                  : "glass-surface border-border text-foreground hover:glass-surface-hover"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {endUserDisclosure === "불가능" && (
          <input
            value={disclosureTo}
            onChange={(e) => setDisclosureTo(e.target.value)}
            placeholder="공개 불가 시 어느 회사로 밝히면 되는지 입력"
            className="w-full glass-surface rounded-sm px-4 py-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
          />
        )}
      </div>

      {/* Q4 기밀 정보 */}
      <div className="space-y-2">
        <div className="text-ui font-semibold text-foreground">제조원에 밝히면 안 되는 정보 <span className="text-muted-foreground font-normal text-data">(선택)</span></div>
        <textarea
          value={confidentialInfo}
          onChange={(e) => setConfidentialInfo(e.target.value)}
          placeholder="예: 최종 고객사명, 사용 제품명 등"
          className="w-full glass-surface rounded-sm px-4 py-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary resize-none h-16 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Q5 특이사항 */}
      <div className="space-y-2">
        <div className="text-ui font-semibold text-foreground">특이사항 <span className="text-muted-foreground font-normal text-data">(선택)</span></div>
        <textarea
          value={specialNotes}
          onChange={(e) => setSpecialNotes(e.target.value)}
          placeholder="그 외 전달할 내용을 자유롭게 입력하세요"
          className="w-full glass-surface rounded-sm px-4 py-2.5 text-foreground text-ui bg-transparent focus:outline-none focus:ring-1 focus:ring-primary resize-none h-16 placeholder:text-muted-foreground/50"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-sm font-semibold text-ui hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          다음 단계 →
        </button>
      </div>
    </motion.div>
  );
};

export default SurveyStep;
