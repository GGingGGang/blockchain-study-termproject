/**
 * 인증 API 라우트
 * EIP-4361 기반 지갑 인증
 */

const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

/**
 * POST /api/auth/verify-signature
 * 서명 검증 및 JWT 토큰 발급
 */
router.post('/verify-signature', async (req, res) => {
  try {
    const { message, signature, address } = req.body;

    // 입력 검증
    if (!message || !signature || !address) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: message, signature, address'
      });
    }

    // 서명 검증
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { 
        address: address.toLowerCase(),
        type: 'game'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 세션 저장
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간
    await db.insert('auth_sessions', {
      wallet_address: address.toLowerCase(),
      token: token,
      session_type: 'game',
      expires_at: expiresAt
    });

    console.log(`✅ 인증 성공: ${address}`);

    res.json({
      success: true,
      token: token,
      expiresIn: 86400, // 24시간 (초)
      address: address.toLowerCase()
    });

  } catch (error) {
    console.error('인증 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/verify-token
 * 토큰 유효성 검증
 */
router.get('/verify-token', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
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

    res.json({
      success: true,
      valid: true,
      address: decoded.address,
      expiresAt: session.expires_at
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      valid: false,
      error: 'Invalid token'
    });
  }
});

/**
 * POST /api/auth/logout
 * 로그아웃 (세션 삭제)
 */
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      await db.query('DELETE FROM auth_sessions WHERE token = ?', [token]);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

module.exports = router;
