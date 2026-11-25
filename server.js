const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

// ─── 환경변수 로드 ───────────────────────────────────────────
// 로컬 개발 시 .env 파일 사용 (dotenv 선택 설치)
try { require('dotenv').config(); } catch (_) { /* dotenv 미설치 시 무시 */ }

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Resend 초기화 ──────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── CORS 설정 ──────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // origin이 없으면(서버간 요청, Postman 등) 허용
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      console.warn(`CORS 차단: ${origin}`);
      callback(null, true); // 개발 편의를 위해 일단 허용, 프로덕션에선 조정
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '15mb' })); // PDF base64 첨부를 위해 넉넉하게

// ─── 헬스체크 ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'site-check-server',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── 이메일 발송 API ────────────────────────────────────────
app.post('/api/send-email', async (req, res) => {
  try {
    const { toEmail, projectName, date, category, summary, content, pdfBase64 } = req.body;

    // 필수값 검증
    if (!toEmail || !projectName) {
      return res.status(400).json({
        success: false,
        error: '수신자 이메일(toEmail)과 현장명(projectName)은 필수입니다.',
      });
    }

    // Resend API 키 확인
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_xxxx')) {
      return res.status(500).json({
        success: false,
        error: 'RESEND_API_KEY가 설정되지 않았습니다. 환경변수를 확인하세요.',
      });
    }

    // 이메일 본문 HTML 생성
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="ko">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: 'Apple SD Gothic Neo','Malgun Gothic',sans-serif; color:#1e293b; max-width:600px; margin:0 auto; padding:20px;">
        <div style="background:#4f46e5; color:#fff; padding:16px 20px; border-radius:8px 8px 0 0;">
          <h2 style="margin:0; font-size:16px;">📋 공사감독일지</h2>
        </div>
        <div style="border:1px solid #e2e8f0; border-top:none; padding:20px; border-radius:0 0 8px 8px;">
          <table style="width:100%; border-collapse:collapse; font-size:14px;">
            <tr>
              <td style="padding:8px 0; color:#64748b; width:100px;">현장명</td>
              <td style="padding:8px 0; font-weight:700;">${projectName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:#64748b;">일자</td>
              <td style="padding:8px 0;">${date || '-'}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:#64748b;">분류</td>
              <td style="padding:8px 0;">
                <span style="background:#e0e7ff; color:#4338ca; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:700;">
                  ${category || '기타'}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:#64748b;">지적사항</td>
              <td style="padding:8px 0; font-weight:700;">${summary || '-'}</td>
            </tr>
          </table>
          <hr style="border:none; border-top:1px solid #e2e8f0; margin:16px 0;">
          <div style="font-size:13px; line-height:1.7; color:#334155;">
            ${(content || '').replace(/\n/g, '<br>')}
          </div>
          <hr style="border:none; border-top:1px solid #e2e8f0; margin:16px 0;">
          <p style="font-size:11px; color:#94a3b8; margin:0;">
            본 메일은 현장점검 앱에서 자동 발송되었습니다. PDF 파일이 첨부되어 있습니다.
          </p>
        </div>
      </body>
      </html>
    `;

    // 발송 옵션 구성
    const emailOptions = {
      from: '공사감독일지 <onboarding@resend.dev>',
      to: [toEmail],
      subject: `[공사감독일지] ${projectName} - ${date || ''} ${summary || ''}`.trim(),
      html: emailHtml,
    };

    // PDF 첨부파일 처리
    if (pdfBase64) {
      // "data:application/pdf;base64,..." 형식에서 순수 base64 추출
      const base64Data = pdfBase64.replace(/^data:[^;]+;(?:filename=[^;]*;)?base64,/, '');
      const dateStr = date ? date.substring(0, 10).replace(/\s/g, '') : '';
      emailOptions.attachments = [
        {
          filename: `공사감독일지_${projectName}_${dateStr}.pdf`,
          content: base64Data,
          contentType: 'application/pdf',
        },
      ];
    }

    // Resend API로 발송
    console.log(`[이메일 발송] to: ${toEmail}, 현장: ${projectName}`);
    const { data, error } = await resend.emails.send(emailOptions);

    if (error) {
      console.error('[이메일 발송 실패]', error);
      return res.json({
        success: false,
        error: error.message || '이메일 발송 중 오류가 발생했습니다.',
      });
    }

    console.log(`[이메일 발송 성공] messageId: ${data.id}`);
    return res.json({
      success: true,
      messageId: data.id,
    });

  } catch (err) {
    console.error('[이메일 API 서버 오류]', err);
    return res.status(500).json({
      success: false,
      error: err.message || '서버 내부 오류가 발생했습니다.',
    });
  }
});

// ─── AI 정제 API (기존 프론트엔드 호환용 스텁) ──────────────
app.post('/api/ai-refine', async (req, res) => {
  // 추후 OpenAI/Gemini API 연동 시 여기에 구현
  res.json({
    success: false,
    error: 'AI 정제 기능은 아직 백엔드에 연결되지 않았습니다.',
  });
});

// ─── 데이터 동기화 API (Firebase 사용 중이므로 스텁) ─────────
app.get('/api/data', (req, res) => {
  res.json({ projects: [], issues: [] });
});

app.post('/api/projects', (req, res) => {
  res.json({ success: true, message: 'Firebase를 통해 직접 동기화됩니다.' });
});

app.post('/api/issues', (req, res) => {
  res.json({ success: true, message: 'Firebase를 통해 직접 동기화됩니다.' });
});

app.delete('/api/projects/:id', (req, res) => {
  res.json({ success: true, message: 'Firebase를 통해 직접 동기화됩니다.' });
});

app.post('/api/settings', (req, res) => {
  res.json({ success: true, message: '설정이 저장되었습니다.' });
});

// ─── 서버 시작 ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 site-check-server 가동 중: http://localhost:${PORT}`);
  console.log(`📧 Resend API: ${process.env.RESEND_API_KEY ? '키 설정됨 ✅' : '⚠️ 키 미설정'}`);
  console.log(`🌐 CORS 허용: ${allowedOrigins.join(', ')}\n`);
});
