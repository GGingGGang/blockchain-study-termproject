/**
 * NFT 동기화 서비스
 * 유저 요청 시 동기화 (5분 쿨다운)
 */

const BlockchainService = require('./BlockchainService');

class NFTSyncService {
  constructor() {
    this.blockchain = new BlockchainService();
    this.lastSyncTimes = new Map(); // 주소별 마지막 동기화 시간
    this.COOLDOWN_MS = 5 * 60 * 1000; // 5분
  }

  /**
   * 쿨다운 확인
   * @param {string} address - 확인할 주소
   * @returns {Object} 쿨다운 정보
   */
  checkCooldown(address) {
    const lastSync = this.lastSyncTimes.get(address.toLowerCase());
    
    if (!lastSync) {
      return { canSync: true, remainingMs: 0 };
    }
    
    const elapsed = Date.now() - lastSync;
    const remaining = this.COOLDOWN_MS - elapsed;
    
    if (remaining <= 0) {
      return { canSync: true, remainingMs: 0 };
    }
    
    return {
      canSync: false,
      remainingMs: remaining,
      remainingSeconds: Math.ceil(remaining / 1000),
      lastSyncTime: new Date(lastSync)
    };
  }

  /**
   * 특정 주소의 NFT 동기화 (쿨다운 적용)
   * @param {string} address - 동기화할 주소
   * @param {boolean} force - 쿨다운 무시 (기본: false)
   * @returns {Promise<Object>} 동기화 결과
   */
  async syncAddress(address, force = false) {
    const addressLower = address.toLowerCase();
    
    // 쿨다운 확인
    if (!force) {
      const cooldown = this.checkCooldown(addressLower);
      
      if (!cooldown.canSync) {
        console.log(`⏳ 쿨다운 중: ${address} (${cooldown.remainingSeconds}초 남음)`);
        return {
          success: false,
          cooldown: true,
          message: 'Sync cooldown active',
          remainingSeconds: cooldown.remainingSeconds,
          lastSyncTime: cooldown.lastSyncTime
        };
      }
    }

    const startTime = Date.now();

    try {
      console.log(`🔄 NFT 동기화 시작: ${address}`);
      
      const result = await this.blockchain.syncNFTsForAddress(addressLower);
      
      // 동기화 시간 기록
      this.lastSyncTimes.set(addressLower, Date.now());
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ 동기화 완료 (${duration}초): 추가 ${result.synced}개, 업데이트 ${result.updated}개`);
      
      return {
        success: true,
        synced: result.synced,
        updated: result.updated,
        total: result.total,
        duration: parseFloat(duration),
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ 동기화 실패 (${address}):`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 쿨다운 정리 (메모리 관리)
   * 1시간 이상 지난 기록 삭제
   */
  cleanupOldCooldowns() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const [address, timestamp] of this.lastSyncTimes.entries()) {
      if (timestamp < oneHourAgo) {
        this.lastSyncTimes.delete(address);
      }
    }
  }

  /**
   * 동기화 상태 조회
   * @param {string} address - 확인할 주소
   * @returns {Object} 상태 정보
   */
  getStatus(address) {
    const cooldown = this.checkCooldown(address);
    
    return {
      canSync: cooldown.canSync,
      cooldownSeconds: this.COOLDOWN_MS / 1000,
      remainingSeconds: cooldown.remainingSeconds || 0,
      lastSyncTime: cooldown.lastSyncTime || null
    };
  }
}

module.exports = NFTSyncService;
