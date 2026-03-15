import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LoginStepProps {
  onLogin: (koreanName: string, englishName: string) => void;
}

const LoginStep = ({ onLogin }: LoginStepProps) => {
  const [phase, setPhase] = useState<"korean" | "english">("korean");
  const [koreanName, setKoreanName] = useState("");
  const [englishName, setEnglishName] = useState("");

  const handleKorean = (e: React.FormEvent) => {
    e.preventDefault();
    if (koreanName.trim().length < 2) return;
    setPhase("english");
  };

  const handleEnglish = (e: React.FormEvent) => {
    e.preventDefault();
    if (englishName.trim().length < 2) return;
    onLogin(koreanName.trim(), englishName.trim());
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10">
      <div className="text-center space-y-3">
        <div className="text-data text-muted-foreground tracking-widest uppercase font-mono">
          Pharma Sourcing Agent
        </div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          소싱 에이전트에 오신 것을 환영합니다
        </h1>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <AnimatePresence mode="wait">
          {phase === "korean" ? (
            <motion.form
              key="korean"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleKorean}
              className="space-y-3"
            >
              <div className="text-data text-muted-foreground font-mono text-center">
                이름을 입력하세요
              </div>
              <div className="relative glass-surface rounded-sm focus-within:glow-primary transition-shadow duration-300">
                <input
                  type="text"
                  value={koreanName}
                  onChange={(e) => setKoreanName(e.target.value)}
                  placeholder="예: 강해민"
                  autoFocus
                  className="w-full bg-transparent px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none text-ui text-center text-lg tracking-widest"
                />
                <div className="absolute bottom-0 left-0 right-0 h-[1px] overflow-hidden">
                  <div className="scanning-line h-full w-full" />
                </div>
              </div>
              <button
                type="submit"
                disabled={koreanName.trim().length < 2}
                className="w-full bg-primary text-primary-foreground py-3 rounded-sm font-semibold text-ui hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                다음 →
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="english"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleEnglish}
              className="space-y-3"
            >
              <div className="text-data text-muted-foreground font-mono text-center">
                <span className="text-primary">{koreanName}</span>님, 이메일에 사용될 영문 이름을 입력하세요
              </div>
              <div className="relative glass-surface rounded-sm focus-within:glow-primary transition-shadow duration-300">
                <input
                  type="text"
                  value={englishName}
                  onChange={(e) => setEnglishName(e.target.value)}
                  placeholder="예: Haemin Kang"
                  autoFocus
                  className="w-full bg-transparent px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none text-ui text-center text-lg"
                />
                <div className="absolute bottom-0 left-0 right-0 h-[1px] overflow-hidden">
                  <div className="scanning-line h-full w-full" />
                </div>
              </div>
              <button
                type="submit"
                disabled={englishName.trim().length < 2}
                className="w-full bg-primary text-primary-foreground py-3 rounded-sm font-semibold text-ui hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                시작하기 →
              </button>
              <button
                type="button"
                onClick={() => setPhase("korean")}
                className="w-full text-data text-muted-foreground hover:text-foreground transition-colors"
              >
                ← 이름 다시 입력
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LoginStep;
