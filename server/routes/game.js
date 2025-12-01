/**
 * 게임 클라이언트 전용 API 라우터
 * UE5 게임에서 사용하는 엔드포인트
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const GameService = require('../services/GameService');

const gameService = new GameService();

/**
 * GET /api/game/inventory
 * 플레이어의 NFT 인벤토리 조회
 */
router.get('/inventory', authenticateToken, async (req, res) => {
  try {
    const { address } = req.user;
    
    console.log(`[Game API] 인벤토리 조회 요청: ${address}`);
    
    const items = await gameService.getInventory(address);
    
    res.json({
      success: true,
      items: items,
      count: items.length
    });
    
  } catch (error) {
    console.error('[Game API] 인벤토리 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/game/monster-kill
 * 몬스터 처치 이벤트 처리
 */
router.post('/monster-kill', authenticateToken, async (req, res) => {
  try {
    const { address } = req.user;
    const { monsterType, monsterLevel, location } = req.body;
    
    // 입력 검증
    if (!monsterType) {
      return res.status(400).json({
        success: false,
        error: 'monsterType is required'
      });
    }
    
    console.log(`[Game API] 몬스터 킬 이벤트: ${address} - ${monsterType} Lv.${monsterLevel || 1}`);
    
    const result = await gameService.handleMonsterKill(
      address,
      monsterType,
      monsterLevel || 1,
      location
    );
    
    res.json({
      success: true,
      dropped: result.dropped,
      item: result.item || null,
      message: result.message
    });
    
  } catch (error) {
    console.error('[Game API] 몬스터 킬 처리 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/game/drops
 * 플레이어의 드랍 아이템 목록 조회
 */
router.get('/drops', authenticateToken, async (req, res) => {
  try {
    const { address } = req.user;
    const { status } = req.query; // pending, minted, claimed
    
    console.log(`[Game API] 드랍 목록 조회: ${address}`);
    
    const drops = await gameService.getDrops(address, status);
    
    res.json({
      success: true,
      drops: drops,
      count: drops.length
    });
    
  } catch (error) {
    console.error('[Game API] 드랍 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/game/stats
 * 플레이어 통계 조회 (선택)
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { address } = req.user;
    
    console.log(`[Game API] 통계 조회: ${address}`);
    
    const stats = await gameService.getPlayerStats(address);
    
    res.json({
      success: true,
      stats: stats
    });
    
  } catch (error) {
    console.error('[Game API] 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/game/claim-drop
 * 드랍 아이템을 NFT로 민팅 (P2 - 선택)
 */
router.post('/claim-drop', authenticateToken, async (req, res) => {
  try {
    const { address } = req.user;
    const { dropId } = req.body;
    
    if (!dropId) {
      return res.status(400).json({
        success: false,
        error: 'dropId is required'
      });
    }
    
    console.log(`[Game API] 드랍 클레임 요청: ${address} - Drop #${dropId}`);
    
    const result = await gameService.claimDrop(address, dropId);
    
    res.json({
      success: true,
      tokenId: result.tokenId,
      message: 'Drop claimed and minted as NFT'
    });
    
  } catch (error) {
    console.error('[Game API] 드랍 클레임 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/game/health
 * 게임 API 헬스 체크
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Game API is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
