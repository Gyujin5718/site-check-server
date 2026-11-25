# site-check-server

현장점검 앱(site-check)의 백엔드 서버입니다.  
[Resend](https://resend.com) API를 사용하여 공사감독일지 PDF를 이메일로 발송합니다.

## 기능

- 📧 **이메일 발송** — A4 공사감독일지 PDF 첨부 메일 발송 (Resend)
- 🔌 기타 API 엔드포인트 스텁 (AI 정제, 데이터 동기화 등)

## 빠른 시작

### 1. Resend API 키 발급

1. [resend.com](https://resend.com) 가입
2. Dashboard → API Keys → **Create API Key**
3. 발급된 `re_...` 키를 `.env`에 설정

### 2. 로컬 실행

```bash
cd site-check-server
cp .env.example .env
# .env 파일에 RESEND_API_KEY 입력

npm install
npm start
```

서버가 `http://localhost:5000`에서 시작됩니다.

### 3. 프론트엔드 연결

`site-check/.env` 파일:
```
REACT_APP_API_BASE_URL=http://localhost:5000
```

### 4. Render 배포

1. GitHub에 이 폴더를 별도 레포로 푸시
2. [Render](https://render.com) → New Web Service → 레포 연결
3. Environment Variables에 `RESEND_API_KEY` 추가
4. 배포 완료 후 URL을 프론트엔드 `REACT_APP_API_BASE_URL`에 설정

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 헬스체크 |
| GET | `/api/health` | 서버 상태 확인 |
| POST | `/api/send-email` | 이메일 발송 (PDF 첨부) |

### POST `/api/send-email`

```json
{
  "toEmail": "manager@example.com",
  "projectName": "토성초 리모델링",
  "date": "2026-11-24",
  "category": "품질 관리",
  "summary": "마감 몰탈 불량 재시공 지시",
  "content": "상세 내용...",
  "pdfBase64": "data:application/pdf;base64,..."
}
```

## 환경변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `RESEND_API_KEY` | ✅ | Resend API 키 |
| `PORT` | ❌ | 서버 포트 (기본: 5000) |
| `FRONTEND_URL` | ❌ | CORS 허용 프론트엔드 URL |

## 참고: 발신자 주소

- **무료 테스트**: `onboarding@resend.dev` (Resend 기본 제공)
- **커스텀 도메인**: Resend에서 도메인 인증 후 `noreply@yourdomain.com` 사용 가능
