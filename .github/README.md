# GitHub CI & CD Configurations

이 폴더는 GitHub 저장소에서 코드가 올바르게 빌드되고 동작하는지 자동으로 검증(CI)하는 워크플로우를 담고 있습니다.

## 🔐 GitHub Secrets 설정 (매우 중요)

이 애플리케이션은 **제미나이 AI 요약 기능**과 **유튜브 메타데이터 공식 API**를 활용하므로, GitHub Actions에서 온전한 작동 확인 및 테스트/배포를 진행하려면 아래 비밀 키들을 **GitHub Secrets**에 추가해 주는 것이 안전하고 바람직합니다.

1. 본인의 깃허브 저장소(GitHub Repository) 페이지로 이동합니다.
2. **Settings** -> **Secrets and variables** -> **Actions** 메뉴를 순서대로 클릭합니다.
3. **New repository secret** 버튼을 선택한 한 후, 다음 두 개의 값을 등록합니다:
   - `GEMINI_API_KEY`: 구글 AI 스튜디오 또는 Google Cloud 등에서 발급받은 제미나이(Gemini) API 키
   - `YOUTUBE_API_KEY`: 구글 개발자 콘솔에서 발급받은 YouTube Data API v3 키

이렇게 등록해두면 소스코드 유출 없이 안전하게 자동 빌드, 테스트, 배포 파이프라인에서 환경변수(`process.env`)에 들어가 작동하게 됩니다.
