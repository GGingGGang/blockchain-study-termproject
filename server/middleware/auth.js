/**
 * 인증 미들웨어
 * JWT 토큰 검증
 */

const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * JWT 토큰 검증 미들웨어
 */
async function authenticateToken(req, res, next) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    // JWT 검증
    const decoded = jwt.verify(token, JWT_SECRET);

    // 데이터베이스에서 세션 확인
    const session = await db.queryOne(
      'SELECT * FROM auth_sessions WHERE token = ? AND expires_at > NOW()',
      [token]
    );

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // 요청 객체에 사용자 정보 추가
    req.user = {
      address: decoded.address,
      sessionType: decoded.type
    };

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

/**
 * 선택적 인증 미들웨어
 * 토큰이 있으면 검증하고, 없으면 통과
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const session = await db.queryOne(
        'SELECT * FROM auth_sessions WHERE token = ? AND expires_at > NOW()',
        [token]
      );

      if (session) {
        req.user = {
          address: decoded.address,
          sessionType: decoded.type
        };
      }
    }

    next();

  } catch (error) {
    // 토큰이 유효하지 않아도 계속 진행
    next();
  }
}

module.exports = {
  authenticateToken,
  optionalAuth
};
