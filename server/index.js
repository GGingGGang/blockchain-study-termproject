/**
 * 블록체인 게임 자산 시스템 - 브릿지 서버
 * 메인 엔트리 포인트
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// 미들웨어 설정
// ============================================================

// CORS 설정
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// JSON 파싱
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 로깅
app.use(morgan('combined'));

// ============================================================
// 라우트 설정
// ============================================================

// 헬스 체크ㅉ
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API 라우트
app.use('/api/auth', require('./routes/auth'));
app.use('/api/nft', require('./routes/nft'));
app.use('/api/marketplace', require('./routes/marketplace'));

// ============================================================
// 에러 핸들러
// ============================================================

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================================
// 서버 시작
// ============================================================

app.listen(PORT, () => {
  console.log('============================================================');
  console.log('🚀 브릿지 서버 시작');
  console.log('============================================================');
  console.log(`📡 포트: ${PORT}`);
  console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log('============================================================');
  
  // 데이터베이스 연결 테스트
  db.query('SELECT 1')
    .then(() => console.log('✅ 데이터베이스 연결 성공'))
    .catch(err => console.error('❌ 데이터베이스 연결 실패:', err.message));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM 신호 수신. 서버 종료 중...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT 신호 수신. 서버 종료 중...');
  process.exit(0);
});

module.exports = app;
