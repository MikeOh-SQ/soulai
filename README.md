# soul.ai.kr

ADHD 선별/감별 보조를 위한 모바일 웹 앱 프로토타입입니다.  
현재 흐름은 `intro -> id -> ASRS -> ASRS quick analysis -> DSM-5 -> game placeholder -> report -> plan` 이며, 각 단계 결과는 사용자별 JSON 파일로 저장됩니다.

## Features

- 모바일 우선 단일 페이지 UI
- 신규 ID 생성 및 기존 기록 불러오기
- ASRS Part A 6문항 0~4 척도 평가
- 문항별 이미지 기반 ASRS 화면
- Gemini 기반 ASRS quick analysis
- DSM-5 기반 yes/no 질문 흐름
- 게임 placeholder 단계
- 방사형 그래프 기반 리포트와 계획 생성
- `database/*.json` 파일 기반 로컬 저장

## Project Structure

```text
.
├── asrs/
├── config/
│   ├── asrs.json
│   ├── dsm-5.json
│   └── report.json
├── database/
├── images/
├── public/
│   ├── app.js
│   ├── asrs01.png ~ asrs06.png
│   ├── index.html
│   ├── intro.png
│   └── styles.css
├── uiexample/
├── server.js
├── run.sh
├── end.sh
└── package.json
```

## Environment

루트에 `.env` 파일을 만들고 아래 값을 설정합니다.

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
HOST=0.0.0.0
PORT=3333
```

`GEMINI_API_KEY`가 없더라도 기본 흐름과 로컬 저장은 동작하지만, AI 분석/리포트 생성 기능은 제한됩니다.

## Run

의존성 설치:

```bash
npm install
```

개발 서버 실행:

```bash
npm start
```

네트워크에서 접속 가능한 백그라운드 실행:

```bash
./run.sh
```

서버 중단:

```bash
./end.sh
```

## Data Storage

- 사용자 기록은 `database/<id>.json` 형태로 저장됩니다.
- 기록에는 현재 단계, ASRS 응답, DSM-5 응답, 분석 결과, 리포트/계획 초안이 함께 저장됩니다.
- `.env`, `server.log`, `.server.pid`, `database/*.json` 같은 개인 데이터는 Git에 포함되지 않도록 설정되어 있습니다.

## Notes

- 이 앱은 진단 확정 도구가 아니라 선별/감별 보조용 프로토타입입니다.
- 서버는 이전 `asar` 키를 읽어 `asrs` 데이터로 호환 처리합니다.
- 리포트와 계획 문장은 Gemini 응답 또는 서버 계산 결과를 기반으로 생성됩니다.
