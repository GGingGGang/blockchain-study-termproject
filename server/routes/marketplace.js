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
// 메타 트랜잭션 헬퍼 API
// ============================================================

/**
 * POST /api/marketplace/meta-tx/prepare
 * 메타 트랜잭션 준비 (nonce 및 서명 데이터 생성)
 */
router.post('/meta-tx/prepare', authenticateToken, async (req, res) => {
  try {
    console.log('🔐 메타 트랜잭션 준비 요청:', {
      body: req.body,
      user: req.user
    });
    
    const { fromAddress, toAddress, amount } = req.body;

    if (!fromAddress || !toAddress || !amount) {
      console.error('❌ 필수 필드 누락:', {
        fromAddress: fromAddress || 'MISSING',
        toAddress: toAddress || 'MISSING',
        amount: amount || 'MISSING',
        receivedFields: Object.keys(req.body)
      });
      
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fromAddress, toAddress, amount',
        received: {
          fromAddress: !!fromAddress,
          toAddress: !!toAddress,
          amount: !!amount
        },
        receivedFields: Object.keys(req.body)
      });
    }

    // 본인 확인
    if (req.user.address !== fromAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Address mismatch'
      });
    }

    // 현재 nonce 조회
    const nonce = await blockchain.getMetaTxNonce(fromAddress);
    
    // transfer 함수 호출 데이터 생성
    const amountInWei = blockchain.web3.utils.toWei(amount.toString(), 'ether');
    const transferData = blockchain.gameTokenContract.methods.transfer(toAddress, amountInWei).encodeABI();
    
    // ForwardRequest 생성
    const request = {
      from: fromAddress,
      to: blockchain.gameTokenContract.options.address,
      value: '0',
      gas: '100000',
      nonce: nonce,
      data: transferData
    };

    // EIP-712 타입 데이터 생성
    const domain = {
      name: 'MinimalForwarder',
      version: '1.0.0',
      chainId: 11155111, // Sepolia
      verifyingContract: process.env.MINIMAL_FORWARDER_ADDRESS
    };

    const types = {
      ForwardRequest: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'gas', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'data', type: 'bytes' }
      ]
    };

    res.json({
      success: true,
      request: request,
      domain: domain,
      types: types,
      primaryType: 'ForwardRequest'
    });

  } catch (error) {
    console.error('❌ 메타 트랜잭션 준비 오류:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      user: req.user
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to prepare meta-transaction',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

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
    const domain = process.env.DOMAIN || 'bridge:3000';
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
    const { sync = 'false' } = req.query; // 동기화 옵션

    // 본인 확인 (대소문자 무시)
    if (req.user.address.toLowerCase() !== address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // 자동 블록체인 동기화 (5분 쿨다운)
    let syncResult = null;
    if (sync === 'true' && global.nftSyncService) {
      try {
        syncResult = await global.nftSyncService.syncAddress(address);
        
        if (syncResult.cooldown) {
          console.log(`⏳ 동기화 쿨다운: ${address} (${syncResult.remainingSeconds}초 남음)`);
        }
      } catch (error) {
        console.error('동기화 오류 (계속 진행):', error.message);
      }
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
      listingId: nft.listing_id,
      listingPrice: nft.listing_price,
      metadataURL: `https://gateway.pinata.cloud/ipfs/${nft.ipfs_cid}`
    }));

    res.json({
      success: true,
      nfts: nftsWithMetadata,
      count: nfts.length,
      syncResult: syncResult // 동기화 결과 포함
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

    // 블록체인에서 실제 소유권 검증
    console.log(`🔍 소유권 검증 시작:`, {
      tokenId,
      requestAddress: req.user.address
    });
    
    let actualOwner;
    try {
      actualOwner = await blockchain.getOwner(tokenId);
      console.log(`📋 블록체인 소유자: ${actualOwner}`);
    } catch (error) {
      console.log(`❌ 토큰 조회 실패:`, error.message);
      return res.status(404).json({
        success: false,
        error: 'NFT does not exist or has been burned'
      });
    }
    
    const isOwner = actualOwner.toLowerCase() === req.user.address.toLowerCase();
    console.log(`🔍 소유권 검증 결과: ${isOwner ? '✅ 소유자' : '❌ 소유자 아님'}`);
    
    if (!isOwner) {
      console.log(`❌ 소유권 불일치:`, {
        tokenId,
        requestedBy: req.user.address,
        actualOwner: actualOwner
      });
      
      return res.status(403).json({
        success: false,
        error: 'Not the owner of this NFT',
        details: {
          yourAddress: req.user.address,
          actualOwner: actualOwner
        }
      });
    }
    
    // DB 레코드 확인 및 업데이트
    const dbRecord = await db.queryOne(
      'SELECT * FROM nft_records WHERE token_id = ?',
      [tokenId]
    );
    
    if (dbRecord && dbRecord.owner_address.toLowerCase() !== actualOwner.toLowerCase()) {
      console.log(`⚠️  DB 소유자 불일치 감지, 업데이트 중...`);
      await db.query(
        'UPDATE nft_records SET owner_address = ? WHERE token_id = ?',
        [actualOwner.toLowerCase(), tokenId]
      );
      console.log(`✅ DB 소유자 업데이트 완료`);
    }

    // 기존 등록 확인
    const existing = await db.queryOne(
      'SELECT * FROM marketplace_listings WHERE token_id = ?',
      [tokenId]
    );

    let listingId;
    
    if (existing) {
      if (existing.status === 'active') {
        return res.status(400).json({
          success: false,
          error: 'NFT is already listed'
        });
      }
      
      // 이전 레코드 재사용 (sold 또는 cancelled 상태)
      await db.query(
        `UPDATE marketplace_listings 
         SET seller_address = ?, price = ?, status = 'active', 
             buyer_address = NULL, listed_at = NOW(), sold_at = NULL, cancelled_at = NULL
         WHERE id = ?`,
        [req.user.address, price, existing.id]
      );
      listingId = existing.id;
      console.log(`♻️  기존 레코드 재사용: Listing ${listingId}`);
    } else {
      // 새 판매 등록
      listingId = await db.insert('marketplace_listings', {
        token_id: tokenId,
        seller_address: req.user.address,
        price: price,
        status: 'active'
      });
    }

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

// ============================================================
// NFT 구매 API
// ============================================================

/**
 * POST /api/marketplace/purchase
 * NFT 구매 (메타 트랜잭션 사용)
 */
router.post('/purchase', authenticateToken, async (req, res) => {
  try {
    console.log('💰 NFT 구매 요청 받음:', {
      body: req.body,
      headers: req.headers,
      user: req.user
    });
    
    const { listingId, buyerAddress, paymentSignature, paymentRequest } = req.body;

    if (!listingId || !buyerAddress || !paymentSignature || !paymentRequest) {
      console.error('❌ 필수 필드 누락:', {
        listingId: listingId || 'MISSING',
        buyerAddress: buyerAddress || 'MISSING',
        paymentSignature: paymentSignature ? 'EXISTS' : 'MISSING',
        paymentRequest: paymentRequest ? 'EXISTS' : 'MISSING',
        receivedFields: Object.keys(req.body)
      });
      
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: listingId, buyerAddress, paymentSignature, paymentRequest',
        received: {
          listingId: !!listingId,
          buyerAddress: !!buyerAddress,
          paymentSignature: !!paymentSignature,
          paymentRequest: !!paymentRequest
        },
        receivedFields: Object.keys(req.body)
      });
    }

    // 구매자 확인
    if (req.user.address !== buyerAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Buyer address mismatch'
      });
    }

    // 판매 정보 조회
    const listing = await db.queryOne(
      'SELECT * FROM marketplace_listings WHERE id = ? AND status = "active"',
      [listingId]
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found or already sold'
      });
    }

    // 자기 자신에게 구매 방지
    if (listing.seller_address === buyerAddress.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: 'Cannot buy your own NFT'
      });
    }

    console.log(`💰 NFT 구매 시작: Listing ${listingId}`);

    // 토큰 잔액 확인
    const balance = await blockchain.getTokenBalance(buyerAddress);
    const balanceInEther = blockchain.web3.utils.fromWei(balance, 'ether');
    
    if (parseFloat(balanceInEther) < parseFloat(listing.price)) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient token balance'
      });
    }

    // 1단계: 메타 트랜잭션으로 토큰 결제 (구매자 → 판매자)
    console.log(`💳 1단계: 토큰 결제 (${listing.price} KQTP)`);
    
    let paymentResult;
    try {
      // 프론트엔드에서 서명한 request 객체를 그대로 사용
      paymentResult = await blockchain.executeMetaTransaction(
        paymentRequest,
        paymentSignature
      );
      console.log(`✅ 토큰 결제 완료: ${paymentResult.transactionHash}`);
    } catch (error) {
      console.error(`❌ 토큰 결제 실패:`, error.message);
      return res.status(500).json({
        success: false,
        error: 'Payment failed',
        message: error.message
      });
    }

    // 2단계: NFT 소유권 이전 (판매자 → 구매자)
    console.log(`🎨 2단계: NFT 전송`);
    let transferResult;
    try {
      transferResult = await blockchain.transferNFT(
        listing.seller_address,
        buyerAddress,
        listing.token_id
      );
      console.log(`✅ NFT 전송 완료: ${transferResult.transactionHash}`);
    } catch (error) {
      console.error(`❌ NFT 전송 실패:`, error.message);
      // 토큰은 이미 전송되었으므로 심각한 오류
      // TODO: 관리자에게 알림 필요
      return res.status(500).json({
        success: false,
        error: 'NFT transfer failed after payment',
        message: error.message,
        paymentTxHash: paymentResult.transactionHash,
        critical: true
      });
    }

    // 3단계: 판매 상태 업데이트
    await db.query(
      `UPDATE marketplace_listings 
       SET status = 'sold', buyer_address = ?, sold_at = NOW() 
       WHERE id = ?`,
      [buyerAddress.toLowerCase(), listingId]
    );

    // NFT 소유자 업데이트
    await db.query(
      'UPDATE nft_records SET owner_address = ? WHERE token_id = ?',
      [buyerAddress.toLowerCase(), listing.token_id]
    );

    // 구매 내역 저장
    await db.insert('purchase_history', {
      listing_id: listingId,
      token_id: listing.token_id,
      seller_address: listing.seller_address,
      buyer_address: buyerAddress.toLowerCase(),
      price: listing.price,
      purchase_type: 'p2p',
      transfer_tx_hash: transferResult.transactionHash,
      payment_tx_hash: paymentResult.transactionHash
    });

    console.log(`✅ NFT 구매 완료: TokenID ${listing.token_id}`);

    res.json({
      success: true,
      paymentTxHash: paymentResult.transactionHash,
      transferTxHash: transferResult.transactionHash,
      status: 'confirmed',
      tokenId: listing.token_id
    });

  } catch (error) {
    console.error('❌ NFT 구매 오류:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      user: req.user
    });
    
    res.status(500).json({
      success: false,
      error: 'Purchase failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============================================================
// 서버 상점 API
// ============================================================

/**
 * GET /api/marketplace/shop/items
 * 서버 상점 아이템 목록 (인증 불필요 - 누구나 볼 수 있음)
 */
router.get('/shop/items', async (req, res) => {
  try {
    const items = await db.query(
      `SELECT 
        id, name, description, item_type, price, stock, 
        image_url, rarity, summon_uses 
       FROM server_shop 
       WHERE active = TRUE AND stock > 0
       ORDER BY price DESC`
    );

    res.json({
      success: true,
      items: items.map(item => ({
        itemId: item.id,
        name: item.name,
        description: item.description,
        itemType: item.item_type,
        price: item.price,
        stock: item.stock,
        image: item.image_url,
        rarity: item.rarity,
        summonUses: item.summon_uses
      }))
    });

  } catch (error) {
    console.error('상점 아이템 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shop items'
    });
  }
});

/**
 * POST /api/marketplace/shop/purchase
 * 서버 상점 아이템 구매 (메타 트랜잭션 사용)
 */
router.post('/shop/purchase', authenticateToken, async (req, res) => {
  try {
    console.log('🛒 상점 구매 요청 받음:', {
      body: req.body,
      headers: req.headers,
      user: req.user
    });
    
    const { itemId, buyerAddress, paymentSignature, paymentRequest } = req.body;

    if (!itemId || !buyerAddress || !paymentSignature || !paymentRequest) {
      console.error('❌ 필수 필드 누락:', {
        itemId: itemId || 'MISSING',
        buyerAddress: buyerAddress || 'MISSING',
        paymentSignature: paymentSignature ? 'EXISTS' : 'MISSING',
        paymentRequest: paymentRequest ? 'EXISTS' : 'MISSING',
        receivedFields: Object.keys(req.body)
      });
      
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: itemId, buyerAddress, paymentSignature, paymentRequest',
        received: {
          itemId: !!itemId,
          buyerAddress: !!buyerAddress,
          paymentSignature: !!paymentSignature,
          paymentRequest: !!paymentRequest
        },
        receivedFields: Object.keys(req.body)
      });
    }

    // 구매자 확인
    if (req.user.address !== buyerAddress.toLowerCase()) {
      console.error('❌ 구매자 주소 불일치:', {
        authenticated: req.user.address,
        requested: buyerAddress.toLowerCase()
      });
      return res.status(403).json({
        success: false,
        error: 'Buyer address mismatch'
      });
    }

    // 아이템 정보 조회
    const item = await db.queryOne(
      'SELECT * FROM server_shop WHERE id = ? AND active = TRUE',
      [itemId]
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    if (item.stock <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Item out of stock'
      });
    }

    console.log(`🛒 상점 아이템 구매: ${item.name}`);

    // 토큰 잔액 확인
    const balance = await blockchain.getTokenBalance(buyerAddress);
    const balanceInEther = blockchain.web3.utils.fromWei(balance, 'ether');
    
    if (parseFloat(balanceInEther) < parseFloat(item.price)) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient token balance'
      });
    }

    console.log(`✅ 토큰 잔액 확인 완료: ${balanceInEther} KQTP`);
    
    // 서버 지갑 주소
    const serverWallet = process.env.SERVER_WALLET_ADDRESS;
    if (!serverWallet) {
      throw new Error('SERVER_WALLET_ADDRESS not configured');
    }

    // 1단계: 메타 트랜잭션으로 토큰 결제 (구매자 → 서버)
    console.log(`💳 1단계: 토큰 결제 (${item.price} KQTP → ${serverWallet})`);
    
    let paymentResult;
    try {
      // 프론트엔드에서 서명한 request 객체를 그대로 사용
      paymentResult = await blockchain.executeMetaTransaction(
        paymentRequest,
        paymentSignature
      );
      console.log(`✅ 토큰 결제 완료: ${paymentResult.transactionHash}`);
    } catch (error) {
      console.error(`❌ 토큰 결제 실패:`, error.message);
      return res.status(500).json({
        success: false,
        error: 'Payment failed',
        message: error.message
      });
    }

    // 2단계: NFT 메타데이터 생성 및 IPFS 업로드
    console.log(`📦 2단계: NFT 메타데이터 생성`);
    const IPFSManager = require('../services/IPFSManager');
    const ipfs = new IPFSManager();
    
    // 간단한 SVG 이미지 생성 (실제로는 item.image_url 사용)
    const itemImage = `
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#E74C3C"/>
        <text x="100" y="100" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">
          ${item.name}
        </text>
      </svg>
    `;

    const nftData = await ipfs.uploadNFT({
      image: Buffer.from(itemImage),
      name: item.name,
      description: item.description,
      attributes: [
        { trait_type: 'Type', value: item.item_type },
        { trait_type: 'Rarity', value: item.rarity },
        { trait_type: 'Source', value: 'Server Shop' },
        { trait_type: 'Summon Uses', value: item.summon_uses || 1 }
      ],
      gameData: {
        item_id: item.id,
        item_type: item.item_type,
        summon_uses: item.summon_uses || 1
      }
    });

    // 3단계: NFT 민팅
    console.log(`🎨 3단계: NFT 민팅`);
    const tokenId = await blockchain.generateTokenId();
    let mintResult;
    try {
      mintResult = await blockchain.mintNFT(
        buyerAddress,
        tokenId,
        nftData.metadataURI
      );
      console.log(`✅ NFT 민팅 완료: TokenID ${tokenId}`);
    } catch (error) {
      console.error(`❌ NFT 민팅 실패:`, error.message);
      // 토큰은 이미 전송되었으므로 심각한 오류
      // TODO: 관리자에게 알림 필요
      return res.status(500).json({
        success: false,
        error: 'NFT minting failed after payment',
        message: error.message,
        paymentTxHash: paymentResult.transactionHash,
        critical: true
      });
    }

    // 4단계: 재고 감소
    await db.query(
      'UPDATE server_shop SET stock = stock - 1 WHERE id = ?',
      [itemId]
    );

    // NFT 레코드 저장
    await db.insert('nft_records', {
      token_id: tokenId,
      owner_address: buyerAddress.toLowerCase(),
      ipfs_cid: nftData.metadataCID,
      mint_tx_hash: mintResult.mintTransactionHash || mintResult.transactionHash,
      status: 'active'
    });

    // 구매 내역 저장
    await db.insert('purchase_history', {
      item_id: itemId,
      token_id: tokenId,
      buyer_address: buyerAddress.toLowerCase(),
      price: item.price,
      purchase_type: 'server_shop',
      payment_tx_hash: paymentResult.transactionHash,
      mint_tx_hash: mintResult.mintTransactionHash || mintResult.transactionHash,
      transfer_tx_hash: mintResult.transferTransactionHash || null
    });

    console.log(`✅ 상점 구매 완료: TokenID ${tokenId}`);

    res.json({
      success: true,
      tokenId: tokenId,
      paymentTxHash: paymentResult.transactionHash,
      mintTxHash: mintResult.mintTransactionHash || mintResult.transactionHash,
      transferTxHash: mintResult.transferTransactionHash,
      status: 'confirmed',
      metadata: nftData.metadataURI
    });

  } catch (error) {
    console.error('❌ 상점 구매 오류:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      user: req.user
    });
    
    res.status(500).json({
      success: false,
      error: 'Shop purchase failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============================================================
// 거래 내역 API
// ============================================================

/**
 * GET /api/marketplace/history/:address
 * 거래 내역 조회
 */
router.get('/history/:address', authenticateToken, async (req, res) => {
  try {
    const { address } = req.params;
    const { type = 'all', page = 1, limit = 20 } = req.query;

    // 본인 확인 (대소문자 무시)
    if (req.user.address.toLowerCase() !== address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    let whereClause = '(buyer_address = ? OR seller_address = ?)';
    const params = [address.toLowerCase(), address.toLowerCase()];

    if (type === 'buy') {
      whereClause = 'buyer_address = ?';
      params.splice(1, 1);
    } else if (type === 'sell') {
      whereClause = 'seller_address = ?';
      params.splice(1, 1);
    }

    const offset = (page - 1) * limit;
    params.push(parseInt(limit), offset);

    const history = await db.query(
      `SELECT 
        id, token_id, seller_address, buyer_address, 
        price, purchase_type, purchased_at,
        transfer_tx_hash, payment_tx_hash
       FROM purchase_history
       WHERE ${whereClause}
       ORDER BY purchased_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    // 총 개수 조회
    const [{ total }] = await db.query(
      `SELECT COUNT(*) as total FROM purchase_history WHERE ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({
      success: true,
      history: history.map(h => ({
        id: h.id,
        type: h.buyer_address === address.toLowerCase() ? 'buy' : 'sell',
        tokenId: h.token_id,
        price: h.price,
        counterparty: h.buyer_address === address.toLowerCase() ? h.seller_address : h.buyer_address,
        timestamp: h.purchased_at,
        txHash: h.transfer_tx_hash || h.payment_tx_hash,
        purchaseType: h.purchase_type
      })),
      total: total,
      page: parseInt(page)
    });

  } catch (error) {
    console.error('거래 내역 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch history'
    });
  }
});
