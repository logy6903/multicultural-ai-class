# AI 다문화 동료 기반 협력학습 앱 MVP

## 1. 프로젝트 개요

이 프로젝트는 생성형 AI를 다문화 배경의 가상 모둠원으로 배치하여, 학생들이 AI 동료와 함께 주제 중심 모둠활동을 수행하도록 돕는 수업용 웹앱 MVP입니다.

학생들은 AI 다문화 동료의 필요와 강점을 파악하고, 그 동료가 모둠활동에 의미 있게 참여할 수 있도록 역할을 나누어 협력합니다.
교사는 수업을 생성하고, 모둠별 활동 과정과 결과를 확인할 수 있습니다.

이 앱은 실제 학교 수업 실험을 위한 최소 기능 제품, 즉 MVP입니다.

---

## 2. 교육적 목표

본 앱의 목표는 다음과 같습니다.

1. 학생들이 다문화 배경을 가진 가상 동료와 협력하는 상황을 경험한다.
2. 학생들이 다문화 감수성을 단순 지식이 아니라 실제 협업 행동으로 연습한다.
3. 학생들이 언어, 문화, 관계, 공정성의 관점에서 동료의 참여 조건을 고민한다.
4. 학생들이 AI 동료를 도움만 받는 존재가 아니라 모둠에 기여하는 동료로 인식한다.
5. 교사가 모둠활동 과정, 역할 분담, 성찰 기록을 수업 평가 자료로 활용할 수 있도록 한다.

---

## 3. 핵심 수업 모델

이 앱은 다음 수업 흐름을 지원합니다.

```text
교사가 수업 생성
        ↓
모둠별 수업방 입장
        ↓
AI 다문화 동료 만나기
        ↓
AI 동료의 필요와 강점 파악
        ↓
학생 역할 분담
        ↓
주제 중심 모둠활동 수행
        ↓
AI 동료에게 중간 피드백 받기
        ↓
최종 산출물 작성
        ↓
개인 성찰문 제출
        ↓
교사 활동 결과 확인
```

---

## 4. 환경 설정

### 4.1 Supabase 프로젝트 생성

여러 학생·교사 디바이스 간 실시간 동기화는 Supabase Realtime 으로 구현되어 있습니다.

1. [https://supabase.com](https://supabase.com) 에서 프로젝트 생성 (Region: Northeast Asia 권장)
2. **SQL Editor** 에서 `supabase/schema.sql` 전체를 붙여넣고 실행
3. **API Keys** 메뉴에서 다음 두 키 확인
   - `Publishable key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `Secret key` → `SUPABASE_SERVICE_ROLE_KEY` (**서버 전용 — 클라이언트 절대 금지**)
4. **Data API** (또는 프로젝트 홈) 에서 Project URL → `NEXT_PUBLIC_SUPABASE_URL`
5. **Database → Replication** 에서 `messages`, `role_assignments`, `members`, `activity_records`, `reflections` 5개 테이블의 Realtime 토글이 켜져 있는지 확인 (스키마에 publication 명령이 포함되어 있어 자동 켜짐)

### 4.2 환경 변수

`.env.local` 에 직접 입력 (`.gitignore` 로 차단되어 안전).

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

### 4.3 실행

```bash
npm install
npm run dev   # http://localhost:13000
```

### 4.4 주요 페이지

| 경로            | 용도                                       |
| --------------- | ------------------------------------------ |
| `/`             | 진입 페이지                                |
| `/teacher`      | 교사 — 수업 생성, 모둠 구성, 활동 현황      |
| `/group?code=…` | 학생 — 코드 → 모둠 선택 → 이름 입력 → 활동방 |

---

## 5. 보안 원칙 (상업 배포 대비)

본 프로젝트는 학교 현장 및 상업 배포를 전제로 하므로, 아래 원칙을 반드시 지켜야 합니다.

### 5.1 절대 커밋 금지 항목

- `.env` 및 모든 `.env.*` 변형 (`.gitignore` 로 차단됨)
- API 키 / 시크릿 / 토큰 / 서비스 계정 JSON
- 학생·교사 개인정보, 세션 로그, DB 덤프
- 인증서 (`*.pem`, `*.key`, `*.p12` 등)

`.gitignore` 에 위 항목이 모두 등록되어 있으나, **커밋 직전 `git status` 로 한 번 더 확인**하는 것을 권장합니다.

### 5.2 키 관리

- 모든 외부 API 호출은 **서버 사이드(API Route)** 에서만 수행. 클라이언트 번들에 키가 포함되지 않도록 주의
- `NEXT_PUBLIC_*` 또는 `VITE_*` 등 클라이언트 노출 prefix에는 시크릿 키를 절대 넣지 않을 것
- Supabase는 **`service_role` 키와 `anon` 키를 명확히 구분**해 사용. `service_role` 은 서버 전용
- 키 유출 의심 시 즉시 해당 콘솔에서 폐기·재발급

### 5.3 학생·교사 데이터 보호

- 학생 개인정보(이름·학번 등)는 최소한으로만 수집·저장
- 교사 화면에서도 **학급 단위 통계 위주**로 노출하고, 개별 학생의 대화 원문 노출은 신중하게 결정
- 외부 LLM API에 보낼 때 **개인 식별 정보가 포함되지 않도록 사전 마스킹**
- 운영 로그에 프롬프트·응답을 평문 저장할 때는 보존 기간·접근 권한 정책을 명확히 설정

### 5.4 배포 전 체크리스트

- [ ] `.env` 가 git history 어디에도 포함되지 않았는지 확인 (`git log --all --full-history -- .env`)
- [ ] 빌드 산출물(`dist/`, `build/`, `.next/`)에 시크릿이 인라인되지 않았는지 검사
- [ ] 클라이언트 번들 검색 시 API 키 문자열이 노출되지 않는지 확인
- [ ] 의존성 보안 점검: `npm audit`
- [ ] 운영 환경 변수는 호스팅 플랫폼(Vercel·Supabase 등)의 시크릿 매니저에 등록
- [ ] HTTPS 강제, CORS 화이트리스트, Rate limiting 설정

### 5.5 키 유출 시 대응 절차

1. 해당 서비스 콘솔에서 키 즉시 폐기·재발급
2. 유출된 커밋 식별 후 git history 정리 (BFG Repo-Cleaner 또는 `git filter-repo`)
3. 강제 푸시 전 팀원·협력자에게 사전 공지
4. 사용량·과금 로그 점검으로 무단 사용 여부 확인

