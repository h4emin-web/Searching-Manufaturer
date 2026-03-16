-- Supabase SQL Editor에 이 내용을 붙여넣고 실행하세요

create table if not exists business_items (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  category text not null,         -- '원료 수입' or '샘플 소싱'
  item_name text,                  -- 원료명
  manufacturer text,               -- 제조사
  distributor text,                -- 대리점
  customer text,                   -- 제약 고객사
  salesperson text,                -- 담당 영업사원 (자동)
  requester text,                  -- 요청자 (실제 요청한 사람)
  status text,                     -- 진행현황
  note text                        -- 메모
);

-- 실시간 활성화
alter publication supabase_realtime add table business_items;

-- Row Level Security 비활성화 (팀 내부용이므로)
alter table business_items disable row level security;
