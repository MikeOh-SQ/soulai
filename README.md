# soul.ai.kr

ADHD 선별/감별 보조를 위한 모바일 웹 앱 프로토타입입니다.  
`intro -> id -> ASRS -> DSM-5 -> mini game placeholder -> report -> plan` 흐름으로 구성되어 있으며, 각 단계 결과는 사용자별 JSON 파일로 저장됩니다.

## Features

- 모바일 우선 UI
- ID 생성 및 기존 기록 불러오기
- ASRS Part A 6문항 0~4 척도 평가
- DSM-5 기반 yes/no 질문 흐름
- 미니 게임 자리 표시자 화면
- 방사형 그래프 기반 리포트
- Gemini 기반 리포트/계획/계획 수정 채팅
- `database/*.json` 파일 기반 로컬 저장

## Project Structure

```text
.
├── config/
│   ├── asrs.json
│   ├── dsm-5.json
│   └── report.json
├── database/
├── public/
│   ├── app.js
│   ├── index.html
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

## Run

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

- 사용자 기록은 `database/id-생성날짜.json` 형태로 저장됩니다.
- `.env`, `server.log`, `.server.pid`, `database/*.json` 개인 데이터는 git에 포함되지 않도록 설정되어 있습니다.

## Notes

- 이 앱은 진단 확정 도구가 아니라 선별/감별 보조용 프로토타입입니다.
- 리포트와 계획 문장은 Gemini 응답을 기반으로 생성됩니다.
