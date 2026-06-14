# 🎥 YouTube AI Transcript Hub (유튜브 AI 자막 가공 & 인터랙티브 대화 분석기)

구글 AI 스튜디오에서 제작된 **YouTube AI Transcript Hub**는 유튜브 동영상의 자막 데이터(자막 트랙이 없는 경우 Google Search Grounding 및 메타데이터 기반 스마트 복원)를 고정밀 분석하여 한국어 요약 리포트, 구조화된 챕터 타임라인, 핵심 Takeaways를 생성하고, 해당 동영상의 문맥을 기반으로 인공지능과 전용 워크스테이션에서 실시간 질의응답(Chat)을 진행하며 다양한 형식(대본, 타임스탬프, SRT 자막, JSON 원본)으로 데이터를 영구 저장 및 다운로드할 수 있는 웹 애플리케이션입니다.

---

## 🚀 주요 기능

- **실시간 비디오 분석 & 자막 다운로드**: 유튜브 링크 또는 비디오 ID만 입력해 동영상 정보를 실시간 분석합니다.
- **AI 대본 타임라인 복원**: 재생 시간에 비례해 고르게 촘촘한 한국어 시나리오 및 타임스탬프 발화록을 복구 제공합니다.
- **동영상 챕터 연동형 재생**: 주요 챕터를 누르면 유튜브 플레이어의 해당 재생 위치(초)로 스마트 이동합니다.
- **컨텍스트 기반 AI 챗봇**: 동영상의 실제 자막 및 세부 메타 데이터를 인지한 상태에서 대화식 탐색과 영상 내용 기반 질문이 가능합니다.
- **다포맷 데이터 다운로드**: SRT(자막 파일), 일반 텍스트 대본, 타임스탬프 대본, 기계 학습용 JSON 형식 완벽 지원.

---

## 🌐 인터넷(웹)에 배포하여 나만의 서비스로 만드는 방법

이 프로젝트는 풀스택 **Node.js (Express) + React (Vite/TypeScript)** 아키텍처로 설계되어 있어, 전 세계 어디서든 인터넷을 통해 접속 가능한 나만의 웹서비스로 쉽게 배포할 수 있습니다.

### 방법 1. 구글 AI 스튜디오 내보내기 및 배포 (권장)
1. 구글 AI 스튜디오(AI Studio Build) 우측 상단의 **설정(Settings)** 또는 **내보내기(Export)** 메뉴를 클릭합니다.
2. **Export to GitHub**를 선택하여 자신의 깃허브 저장소(GitHub Repository)로 코드를 원클릭 전송합니다.
3. 해당 깃허브 저장소를 토대로 하단의 호스팅 플랫폼 중 하나에 배포할 수 있습니다.

---

### 방법 2. 인터넷 클라우드 플랫폼에 라이브 배포하기

이 앱은 프론트엔드와 백엔드가 결합된 풀스택 Node.js 서버 환경에서 작동하므로, 아래 플랫폼에 코드 연동 한 번으로 무료 배포가 가능합니다.

#### 1) Google Cloud Run (가장 뛰어난 확장성 및 원클릭 추천)
구글 AI 스튜디오 프리뷰가 사용하고 있는 것과 동일한 강력한 컨테이너 기반 서버리스 서비스입니다.
```bash
# Google Cloud CLI로 즉시 배포 (프로젝트 루트 디렉토리에서 실행)
gcloud run deploy youtube-ai-hub --source . --port 3000 --allow-unauthenticated
```
- 배포 시 환경 변수(`GEMINI_API_KEY`, `YOUTUBE_API_KEY`)를 설정창에 입력해주시면 됩니다.

#### 2) Render (render.com)
설정이 가장 쉽고 깃허브 저장소와 실시간 동기화되는 무료 지원 PaaS 플랫폼입니다.
1. Render 대시보드에서 **New Web Service**를 생성하고 깃허브 저장소를 연동합니다.
2. 설정을 다음과 같이 지정합니다:
   - **Language**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. 하단 **Environment Variables(환경 변수)** 섹션에 두 가지 키 값을 추가합니다:
   - `GEMINI_API_KEY`: 나의 구글 제미나이 API 키
   - `YOUTUBE_API_KEY`: 유튜브 Data API v3 키
4. 배포가 완료되면 영구적으로 작동하는 무료 `onrender.com` 주소가 발급됩니다.

#### 3) Fly.io (fly.io)
글로벌 엣지 배포가 쉬운 개발자 친화적 경량 컨테이너 실행 환경입니다.
```bash
# fly cli 설치 후
fly launch
```
- 포트를 `3000`으로 매핑하여 시작하면 즉시 배포됩니다.

---

## 💻 로컬 컴퓨터(내 컴퓨터)에서 실행하는 방법

인터넷 배포 전, 내 컴퓨터 환경에서 테스트하고 싶다면 아래 과정을 따르세요.

### 1) 환경 구성을 위한 필수 요구 사항
- **Node.js** v18 이상 최신 버전을 설치해 주세요.

### 2) 설정 파일 빌드 및 환경변수 주입
프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 아래와 같이 API 키를 채워 넣습니다:

```env
# .env
GEMINI_API_KEY=your_gemini_api_key_here
YOUTUBE_API_KEY=your_youtube_api_key_here
```

### 3) 라이브러리 설치 및 개발 서버 실행

```bash
# 1. 의존성 패키지 일괄 설치
npm install

# 2. 로컬 개발(Dev) 모드 서버 실행
npm run dev
```

서버가 켜지면 터미널에 나타나는 주소 `http://localhost:3000`으로 브라우저를 열어 접속하시면 됩니다.

---

## 🛠️ 기술 사양 및 프로젝트 구조

- **Frontend**: `React 19`, `Vite`, `TypeScript`, `Tailwind CSS 4`, `Motion (Animations)`, `Lucide icons`
- **Backend**: `Express`, `esbuild` 크로스플랫폼 하이퍼 번들러 (서버 자체 완결형 프로덕션 빌드 시스템 탑재)
- **AI Core**: `@google/genai`공식 최신 SDK 및 멀티 레이어 자막 복구 모델 설계
- **APIs**: `YouTube Data API v3`, `Gemini Flash 2.5`
