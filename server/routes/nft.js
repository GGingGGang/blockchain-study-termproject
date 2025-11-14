/**
 * NFT API 라우트
 * 게임 클라이언트용 NFT 민팅/소각 API
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const BlockchainService = require('../services/BlockchainService');
const IPFSManager = require('../services/IPFSManager');
const db = require('../config/database');

const blockchain = new BlockchainService();
const ipfs = new IPFSManager();

/**
 * POST /api/nft/mint
 * NFT 민팅
 */
router.post('/mint', authenticateToken, async (req, res) => {
  try {
    const { walletAddress, itemData } = req.body;

    // 입력 검증
    if (!walletAddress || !itemData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: walletAddress, itemData'
      });
    }

    const { name, description, imageBase64, attributes, gameData } = itemData;

    if (!name || !description || !imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Missing item data fields: name, description, imageBase64'
      });
    }

    console.log(`🎨 NFT 민팅 요청: ${name} → ${walletAddress}`);

    // 1. IPFS에 업로드
    const nftData = await ipfs.uploadNFT({
      image: imageBase64,
      name,
      description,
      attributes: attributes || [],
      gameData
    });

    // 2. 토큰 ID 생성
    const tokenId = await blockchain.generateTokenId();

    // 3. 블록체인에 민팅
    const mintResult = await blockchain.mintNFT(
      walletAddress,
      tokenId,
      nftData.metadataURI
    );

    // 4. 데이터베이스에 기록
    await db.insert('nft_records', {
      token_id: tokenId,
      owner_address: walletAddress.toLowerCase(),
      ipfs_cid: nftData.metadataCID,
      mint_tx_hash: mintResult.transactionHash,
      status: 'active'
    });

    await db.insert('transaction_log', {
      tx_hash: mintResult.transactionHash,
      tx_type: 'mint',
      token_id: tokenId,
      to_address: walletAddress.toLowerCase(),
      status: 'confirmed',
      block_number: mintResult.blockNumber,
      gas_used: mintResult.gasUsed
    });

    console.log(`✅ NFT 민팅 완료: TokenID ${tokenId}`);

    res.json({
      success: true,
      tokenId,
      txHash: mintResult.transactionHash,
      status: 'confirmed',
      ipfsCID: nftData.metadataCID,
      metadataURI: nftData.metadataURI,
      imageURL: nftData.imageURL,
      blockNumber: mintResult.blockNumber
    });

  } catch (error) {
    console.error('NFT 민팅 오류:', error);
    res.status(500).json({
      success: false,
      error: 'NFT minting failed',
      message: error.message
    });
  }
});

/**
 * POST /api/nft/burn
 * NFT 소각
 */
router.post('/burn', authenticateToken, async (req, res) => {
  try {
    const { tokenId, walletAddress } = req.body;

    if (!tokenId || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tokenId, walletAddress'
      });
    }

    console.log(`🔥 NFT 소각 요청: TokenID ${tokenId}`);

    // 1. 소유권 검증
    const isOwner = await blockchain.verifyOwnership(tokenId, walletAddress);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Not the owner of this NFT'
      });
    }

    // 2. 블록체인에서 소각
    const burnResult = await blockchain.burnNFT(tokenId);

    // 3. 데이터베이스 업데이트
    await db.query(
      'UPDATE nft_records SET status = ?, burn_tx_hash = ? WHERE token_id = ?',
      ['burned', burnResult.transactionHash, tokenId]
    );

    await db.insert('transaction_log', {
      tx_hash: burnResult.transactionHash,
      tx_type: 'burn',
      token_id: tokenId,
      from_address: walletAddress.toLowerCase(),
      status: 'confirmed',
      block_number: burnResult.blockNumber,
      gas_used: burnResult.gasUsed
    });

    console.log(`✅ NFT 소각 완료: TokenID ${tokenId}`);

    res.json({
      success: true,
      txHash: burnResult.transactionHash,
      status: 'confirmed',
      tokenId,
      blockNumber: burnResult.blockNumber
    });

  } catch (error) {
    console.error('NFT 소각 오류:', error);
    res.status(500).json({
      success: false,
      error: 'NFT burning failed',
      message: error.message
    });
  }
});

/**
 * GET /api/nft/player/:address
 * 플레이어 NFT 목록 조회
 */
router.get('/player/:address', async (req, res) => {
  try {
    const { address } = req.params;

    const nfts = await db.query(
      `SELECT 
        token_id, 
        owner_address, 
        ipfs_cid, 
        mint_tx_hash, 
        status, 
        created_at 
      FROM nft_records 
      WHERE owner_address = ? AND status = 'active'
      ORDER BY created_at DESC`,
      [address.toLowerCase()]
    );

    // 메타데이터 URL 추가
    const nftsWithMetadata = nfts.map(nft => ({
      ...nft,
      metadataURL: ipfs.getFileURL(nft.ipfs_cid),
      imageURL: `${ipfs.pinataGateway}/ipfs/${nft.ipfs_cid}`
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
 * GET /api/transaction/:txHash
 * 트랜잭션 상태 조회
 */
router.get('/transaction/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;

    const txStatus = await blockchain.getTransactionStatus(txHash);

    res.json({
      success: true,
      ...txStatus
    });

  } catch (error) {
    console.error('트랜잭션 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transaction status'
    });
  }
});

module.exports = router;
