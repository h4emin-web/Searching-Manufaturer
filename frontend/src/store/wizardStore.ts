/**
 * Zustand 마스터 위자드 스토어
 * - 모든 단계 데이터를 단일 스토어에서 관리
 * - localStorage 미들웨어로 페이지 리로드 시 복원
 * - 백엔드와 2초 디바운스 동기화
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UseCase = 'pharmaceutical' | 'cosmetic' | 'food'
export type LLMProvider = 'gpt4o' | 'gemini' | 'deepseek' | 'qwen'
export type OutreachChannel = 'wechat' | 'whatsapp' | 'email' | 'web_form' | 'none'

export interface RegulatorySelection {
  requirement_id: string
  is_selected: boolean
  notes: string
}

export interface Manufacturer {
  id: string
  name: string
  canonical_name: string
  country: string
  country_code?: string
  city?: string
  contact_email?: string
  contact_wechat?: string
  contact_whatsapp?: string
  web_form_url?: string
  website?: string
  certifications: string[]
  source_llms: LLMProvider[]
  confidence_score: number
  merge_similarity_score?: number
  is_excluded: boolean
  is_manually_added: boolean
  exclusion_reason?: string
}

export interface Step1Data {
  ingredient_name: string
  ingredient_name_ko?: string
  ingredient_name_zh?: string
  cas_number?: string
  use_case: UseCase | null
  sourcing_notes?: string
}

export interface Step2Data {
  selections: RegulatorySelection[]
  additional_notes: string
}

export interface Step3Data {
  sourcing_task_id: string | null
  sourcing_status: 'idle' | 'running' | 'completed' | 'failed'
  progress: number
  total_raw: number
  total_deduplicated: number
  llm_progress: Record<LLMProvider, 'pending' | 'running' | 'done' | 'failed'>
}

export interface Step4Data {
  excluded_ids: string[]
  manually_added: Manufacturer[]
}

export interface Step5Data {
  outreach_plan_id: string | null
  outreach_status: 'draft' | 'scheduled' | 'running' | 'completed'
  scheduled_at: string | null
  auto_crawl: boolean
}

export interface Step6Data {
  dashboard_session_id: string
}

export interface WizardState {
  // 세션
  session_id: string | null
  current_step: number
  max_completed_step: number
  is_dirty: boolean
  last_synced_at: string | null

  // 단계별 데이터
  step1: Step1Data
  step2: Step2Data
  step3: Step3Data
  step4: Step4Data
  step5: Step5Data
  step6: Step6Data

  // 제조소 목록 (step3 결과 + step4 수동 추가)
  manufacturers: Manufacturer[]

  // Actions
  setSessionId: (id: string) => void
  goToStep: (step: number) => void
  markStepComplete: (step: number) => void

  updateStep1: (data: Partial<Step1Data>) => void
  updateStep2: (data: Partial<Step2Data>) => void
  updateStep3: (data: Partial<Step3Data>) => void
  updateStep4: (data: Partial<Step4Data>) => void
  updateStep5: (data: Partial<Step5Data>) => void

  setManufacturers: (list: Manufacturer[]) => void
  toggleExclude: (id: string, reason?: string) => void
  addManualManufacturer: (mfr: Manufacturer) => void
  removeManualManufacturer: (id: string) => void

  markDirty: () => void
  markSynced: () => void
  hydrate: (serverData: Partial<WizardState>) => void
  reset: () => void
}

const DEFAULT_STEP3: Step3Data = {
  sourcing_task_id: null,
  sourcing_status: 'idle',
  progress: 0,
  total_raw: 0,
  total_deduplicated: 0,
  llm_progress: { gpt4o: 'pending', gemini: 'pending', deepseek: 'pending', qwen: 'pending' },
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      session_id: null,
      current_step: 1,
      max_completed_step: 0,
      is_dirty: false,
      last_synced_at: null,

      step1: { ingredient_name: '', use_case: null },
      step2: { selections: [], additional_notes: '' },
      step3: DEFAULT_STEP3,
      step4: { excluded_ids: [], manually_added: [] },
      step5: { outreach_plan_id: null, outreach_status: 'draft', scheduled_at: null, auto_crawl: true },
      step6: { dashboard_session_id: '' },
      manufacturers: [],

      setSessionId: (id) => set({ session_id: id }),

      goToStep: (step) => {
        const { max_completed_step } = get()
        // 완료된 단계보다 앞으로만 이동 가능 (StepGuard 로직)
        if (step <= max_completed_step + 1) {
          set({ current_step: step })
        }
      },

      markStepComplete: (step) => set((s) => ({
        max_completed_step: Math.max(s.max_completed_step, step),
        is_dirty: true,
      })),

      updateStep1: (data) => set((s) => ({
        step1: { ...s.step1, ...data },
        is_dirty: true,
      })),

      updateStep2: (data) => set((s) => ({
        step2: { ...s.step2, ...data },
        is_dirty: true,
      })),

      updateStep3: (data) => set((s) => ({
        step3: { ...s.step3, ...data },
        is_dirty: true,
      })),

      updateStep4: (data) => set((s) => ({
        step4: { ...s.step4, ...data },
        is_dirty: true,
      })),

      updateStep5: (data) => set((s) => ({
        step5: { ...s.step5, ...data },
        is_dirty: true,
      })),

      setManufacturers: (list) => set({ manufacturers: list, is_dirty: true }),

      toggleExclude: (id, reason) => set((s) => ({
        manufacturers: s.manufacturers.map((m) =>
          m.id === id
            ? { ...m, is_excluded: !m.is_excluded, exclusion_reason: reason }
            : m
        ),
        step4: {
          ...s.step4,
          excluded_ids: s.manufacturers
            .map((m) => m.id === id ? { ...m, is_excluded: !m.is_excluded } : m)
            .filter((m) => m.is_excluded)
            .map((m) => m.id),
        },
        is_dirty: true,
      })),

      addManualManufacturer: (mfr) => set((s) => ({
        manufacturers: [...s.manufacturers, { ...mfr, is_manually_added: true }],
        step4: {
          ...s.step4,
          manually_added: [...s.step4.manually_added, mfr],
        },
        is_dirty: true,
      })),

      removeManualManufacturer: (id) => set((s) => ({
        manufacturers: s.manufacturers.filter((m) => m.id !== id),
        step4: {
          ...s.step4,
          manually_added: s.step4.manually_added.filter((m) => m.id !== id),
        },
        is_dirty: true,
      })),

      markDirty: () => set({ is_dirty: true }),
      markSynced: () => set({ is_dirty: false, last_synced_at: new Date().toISOString() }),

      hydrate: (serverData) => set((s) => ({ ...s, ...serverData })),

      reset: () => set({
        session_id: null,
        current_step: 1,
        max_completed_step: 0,
        is_dirty: false,
        step1: { ingredient_name: '', use_case: null },
        step2: { selections: [], additional_notes: '' },
        step3: DEFAULT_STEP3,
        step4: { excluded_ids: [], manually_added: [] },
        step5: { outreach_plan_id: null, outreach_status: 'draft', scheduled_at: null, auto_crawl: true },
        step6: { dashboard_session_id: '' },
        manufacturers: [],
      }),
    }),
    {
      name: 'pharma-wizard',
      // 민감 정보 제외하고 저장
      partialize: (s) => ({
        session_id: s.session_id,
        current_step: s.current_step,
        max_completed_step: s.max_completed_step,
        step1: s.step1,
        step2: s.step2,
        step3: { ...s.step3, sourcing_status: s.step3.sourcing_status === 'running' ? 'idle' : s.step3.sourcing_status },
        step4: s.step4,
        step5: s.step5,
        manufacturers: s.manufacturers,
      }),
    }
  )
)
