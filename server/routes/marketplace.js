/**
 * 마켓플레이스 API 라우트
 * P2P NFT 거래 및 서버 상점
 */

const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const BlockchainService = require('../services/BlockchainService');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

const blockchain = new BlockchainService();

// ============================================================
// 인증 API (EIP-4361)
// ============================================================

/**
 * POST /api/marketplace/auth/request-message
 * EIP-4361 서명 메시지 생성
 */
router.post('/auth/request-message', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address is required'
      });
    }

    // nonce 생성 (재생 공격 방지)
    const nonce = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    const expiresAt = new Date(timestamp + 5 * 60 * 1000); // 5분 유효

    // EIP-4361 표준 메시지 생성
    const domain = process.env.DOMAIN || 'localhost:3000';
    const message = `${domain} wants you to sign in with your Ethereum account:
${address}

Sign in to NFT Marketplace

URI: https://${domain}
Version: 1
Chain ID: 11155111
Nonce: ${nonce}
Issued At: ${new Date(timestamp).toISOString()}`;

    // nonce를 데이터베이스에 저장
    await db.insert('auth_nonces', {
      wallet_address: address.toLowerCase(),
      nonce: nonce,
      message: message,
      expires_at: expiresAt,
      used: false
    });

    console.log(`📝 인증 메시지 생성: ${address}`);

    res.json({
      success: true,
      message: message,
      nonce: nonce,
      timestamp: timestamp
    });

  } catch (error) {
    console.error('메시지 생성 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate message'
    });
  }
});

/**
 * POST /api/marketplace/auth/verify
 * 서명 검증 및 세션 토큰 발급
 */
router.post('/auth/verify', async (req, res) => {
  try {
    const { address, signature, message } = req.body;

    if (!address || !signature || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: address, signature, message'
      });
    }

    // 메시지에서 nonce 추출
    const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
    if (!nonceMatch) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message format'
      });
    }
    const nonce = nonceMatch[1];

    // nonce 검증
    const nonceRecord = await db.queryOne(
      'SELECT * FROM auth_nonces WHERE nonce = ? AND wallet_address = ? AND used = FALSE AND expires_at > NOW()',
      [nonce, address.toLowerCase()]
    );

    if (!nonceRecord) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired nonce'
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

    // nonce 사용 처리 (재사용 방지)
    await db.query(
      'UPDATE auth_nonces SET used = TRUE WHERE nonce = ?',
      [nonce]
    );

    // JWT 세션 토큰 생성
    const sessionToken = jwt.sign(
      { 
        address: address.toLowerCase(),
        type: 'marketplace'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 세션 저장
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간
    await db.insert('auth_sessions', {
      wallet_address: address.toLowerCase(),
      token: sessionToken,
      session_type: 'marketplace',
      expires_at: expiresAt
    });

    console.log(`✅ 마켓플레이스 인증 성공: ${address}`);

    res.json({
      success: true,
      sessionToken: sessionToken,
      expiresIn: 86400, // 24시간 (초)
      address: address.toLowerCase()
    });

  } catch (error) {
    console.error('서명 검증 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: error.message
    });
  }
});

// ============================================================
// NFT 조회 API
// ============================================================

/**
 * GET /api/marketplace/nfts/:address
 * 내 NFT 목록 조회
 */
router.get('/nfts/:address', authenticateToken, async (req, res) => {
  try {
    const { address } = req.params;

    // 본인 확인
    if (req.user.address !== address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // NFT 목록 조회
    const nfts = await db.query(
      `SELECT 
        nr.token_id,
        nr.owner_address,
        nr.ipfs_cid,
        nr.created_at,
        ml.id AS listing_id,
        ml.price AS listing_price,
        ml.status AS listing_status
      FROM nft_records nr
      LEFT JOIN marketplace_listings ml ON nr.token_id = ml.token_id AND ml.status = 'active'
      WHERE nr.owner_address = ? AND nr.status = 'active'
      ORDER BY nr.created_at DESC`,
      [address.toLowerCase()]
    );

    // 메타데이터 URL 추가
    const nftsWithMetadata = nfts.map(nft => ({
      tokenId: nft.token_id,
      ownerAddress: nft.owner_address,
      ipfsCID: nft.ipfs_cid,
      createdAt: nft.created_at,
      isListed: !!nft.listing_id,
      listingPrice: nft.listing_price,
      metadataURL: `https://gateway.pinata.cloud/ipfs/${nft.ipfs_cid}`
    }));

    res.json({
      success: true,
      nfts: nftsWithMetadata,
      count: nfts.length
    });

  } catch (error) {
    console.error('NFT 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NFTs'
    });
  }
});

/**
 * GET /api/marketplace/listings
 * 마켓 판매 목록 조회
 */
router.get('/listings', async (req, res) => {
  try {
    const { sortBy = 'latest', minPrice, maxPrice, page = 1, limit = 20 } = req.query;

    let orderBy = 'ml.listed_at DESC';
    if (sortBy === 'price') {
      orderBy = 'ml.price ASC';
    }

    let whereClause = 'ml.status = "active" AND nr.status = "active"';
    const params = [];

    if (minPrice) {
      whereClause += ' AND ml.price >= ?';
      params.push(minPrice);
    }

    if (maxPrice) {
      whereClause += ' AND ml.price <= ?';
      params.push(maxPrice);
    }

    const offset = (page - 1) * limit;
    params.push(parseInt(limit), offset);

    const listings = await db.query(
      `SELECT 
        ml.id AS listing_id,
        ml.token_id,
        ml.seller_address,
        ml.price,
        ml.listed_at,
        nr.ipfs_cid
      FROM marketplace_listings ml
      INNER JOIN nft_records nr ON ml.token_id = nr.token_id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
      params
    );

    // 총 개수 조회
    const [{ total }] = await db.query(
      `SELECT COUNT(*) as total
      FROM marketplace_listings ml
      INNER JOIN nft_records nr ON ml.token_id = nr.token_id
      WHERE ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({
      success: true,
      listings: listings.map(l => ({
        listingId: l.listing_id,
        tokenId: l.token_id,
        seller: l.seller_address,
        price: l.price,
        listedAt: l.listed_at,
        metadataURL: `https://gateway.pinata.cloud/ipfs/${l.ipfs_cid}`
      })),
      total: total,
      page: parseInt(page),
      limit: parseInt(limit)
    });

  } catch (error) {
    console.error('판매 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch listings'
    });
  }
});

// ============================================================
// 판매 등록 API
// ============================================================

/**
 * POST /api/marketplace/listings
 * NFT 판매 등록
 */
router.post('/listings', authenticateToken, async (req, res) => {
  try {
    const { tokenId, price } = req.body;

    if (!tokenId || !price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tokenId, price'
      });
    }

    // 소유권 검증
    const isOwner = await blockchain.verifyOwnership(tokenId, req.user.address);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Not the owner of this NFT'
      });
    }

    // 중복 등록 확인
    const existing = await db.queryOne(
      'SELECT * FROM marketplace_listings WHERE token_id = ? AND status = "active"',
      [tokenId]
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'NFT is already listed'
      });
    }

    // 판매 등록
    const listingId = await db.insert('marketplace_listings', {
      token_id: tokenId,
      seller_address: req.user.address,
      price: price,
      status: 'active'
    });

    console.log(`📋 판매 등록: TokenID ${tokenId}, 가격 ${price}`);

    res.json({
      success: true,
      listingId: listingId,
      status: 'active'
    });

  } catch (error) {
    console.error('판매 등록 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create listing'
    });
  }
});

/**
 * DELETE /api/marketplace/listings/:listingId
 * 판매 취소
 */
router.delete('/listings/:listingId', authenticateToken, async (req, res) => {
  try {
    const { listingId } = req.params;

    // 판매 정보 조회
    const listing = await db.queryOne(
      'SELECT * FROM marketplace_listings WHERE id = ?',
      [listingId]
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    // 판매자 확인
    if (listing.seller_address !== req.user.address) {
      return res.status(403).json({
        success: false,
        error: 'Not the seller'
      });
    }

    // 판매 취소
    await db.query(
      'UPDATE marketplace_listings SET status = "cancelled", cancelled_at = NOW() WHERE id = ?',
      [listingId]
    );

    console.log(`❌ 판매 취소: Listing ${listingId}`);

    res.json({
      success: true,
      message: 'Listing cancelled'
    });

  } catch (error) {
    console.error('판매 취소 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel listing'
    });
  }
});

module.exports = router;
