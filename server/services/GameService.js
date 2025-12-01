/**
 * 게임 서비스 로직
 * 인벤토리, 몬스터 드랍, 아이템 관리
 */

const db = require('../config/database');
const BlockchainService = require('./BlockchainService');
const IPFSManager = require('./IPFSManager');
const { createGameItemMetadata } = require('../utils/metadataHelper');

class GameService {
  constructor() {
    this.blockchainService = new BlockchainService();
    this.ipfsManager = new IPFSManager();
    
    // 민팅 큐 (동시 민팅 방지)
    this.mintQueue = [];
    this.isMinting = false;
    
    // 드랍 확률 설정
    this.dropRates = {
      training_dummy: 0.5,  // 50% (테스트용)
      goblin: 0.3,          // 30%
      orc: 0.25,            // 25%
      dragon: 0.5,          // 50%
      boss: 0.8,            // 80%
      default: 0.2          // 20%
    };
    
    // 아이템 등급별 확률
    this.gradeRates = {
      Common: 0.6,      // 60%
      Rare: 0.3,        // 30%
      Epic: 0.09,       // 9%
      Legendary: 0.01   // 1%
    };
    
    // 몬스터별 드랍 아이템
    this.dropItems = {
      training_dummy: ['Wooden Sword', 'Practice Shield', 'Training Manual'],
      goblin: ['Goblin Tooth', 'Rusty Dagger', 'Torn Cloth'],
      orc: ['Orc Tusk', 'Battle Axe', 'Iron Armor'],
      dragon: ['Dragon Scale', 'Fire Gem', 'Ancient Sword'],
      boss: ['Boss Crown', 'Legendary Weapon', 'Epic Armor'],
      default: ['Common Item', 'Basic Material', 'Small Potion']
    };
  }

  /**
   * 플레이어 인벤토리 조회
   * 기존 NFT 목록 반환
   */
  async getInventory(address) {
    try {
      // nft_records 테이블에서 활성 NFT 조회
      const nfts = await db.query(
        `SELECT 
          token_id as tokenId,
          ipfs_cid as ipfsCid,
          created_at as createdAt
        FROM nft_records
        WHERE owner_address = ? AND status = 'active'
        ORDER BY created_at DESC`,
        [address]
      );
      
      // IPFS 메타데이터 파싱
      const items = await Promise.all(nfts.map(async (nft) => {
        try {
          // IPFS에서 메타데이터 가져오기
          const metadata = await this.ipfsManager.getMetadata(nft.ipfsCid);
          
          // Rarity 속성 찾기
          const rarityAttr = metadata.attributes?.find(attr => 
            attr.trait_type === 'Rarity' || attr.trait_type === 'Grade'
          );
          
          return {
            tokenId: nft.tokenId,
            name: metadata.name || `Item #${nft.tokenId}`,
            grade: rarityAttr?.value || 'Common',
            ipfsCid: nft.ipfsCid,
            image: metadata.image,
            attributes: metadata.attributes || [],
            createdAt: nft.createdAt
          };
        } catch (error) {
          console.error(`메타데이터 파싱 실패 (Token #${nft.tokenId}):`, error);
          // 메타데이터 로드 실패 시 기본값 반환
          return {
            tokenId: nft.tokenId,
            name: `Item #${nft.tokenId}`,
            grade: 'Common',
            ipfsCid: nft.ipfsCid,
            createdAt: nft.createdAt
          };
        }
      }));
      
      return items;
      
    } catch (error) {
      console.error('인벤토리 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 민팅 큐 처리
   */
  async processMintQueue() {
    if (this.isMinting || this.mintQueue.length === 0) {
      return;
    }
    
    this.isMinting = true;
    
    while (this.mintQueue.length > 0) {
      const task = this.mintQueue.shift();
      try {
        const result = await task.execute();
        task.resolve(result);
      } catch (error) {
        task.reject(error);
      }
      
      // 트랜잭션 간 약간의 딜레이 (nonce 충돌 방지)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    this.isMinting = false;
  }

  /**
   * 민팅 작업을 큐에 추가
   */
  async queueMint(mintTask) {
    return new Promise((resolve, reject) => {
      this.mintQueue.push({
        execute: mintTask,
        resolve,
        reject
      });
      
      // 큐 처리 시작
      this.processMintQueue();
    });
  }

  /**
   * 몬스터 처치 이벤트 처리
   * 드랍 시 바로 NFT 민팅
   */
  async handleMonsterKill(address, monsterType, monsterLevel, location) {
    try {
      // 드랍 확률 계산
      const dropRate = this.dropRates[monsterType] || this.dropRates.default;
      const dropped = Math.random() < dropRate;
      
      if (!dropped) {
        return {
          dropped: false,
          message: 'No item dropped'
        };
      }
      
      // 드랍 아이템 결정
      const itemGrade = this.calculateItemGrade();
      const itemName = this.getDropItem(monsterType);
      
      console.log(`🎲 드랍 발생: ${itemName} (${itemGrade}) - ${monsterType} Lv.${monsterLevel}`);
      
      // NFT 민팅 (큐에 추가)
      try {
        // 민팅 작업 정의
        const mintTask = async () => {
          // 1. 메타데이터 생성
          const metadata = createGameItemMetadata({
            name: itemName,
            description: `Dropped from ${monsterType} (Level ${monsterLevel})`,
            imageCID: 'QmPlaceholder', // TODO: 실제 이미지 CID
            rarity: itemGrade,
            itemType: 'Drop',
            itemId: `${monsterType}_${Date.now()}`
          });
          
          // 2. IPFS에 메타데이터 업로드
          const metadataCID = await this.ipfsManager.uploadJSON(metadata);
          console.log(`📦 메타데이터 업로드 완료: ${metadataCID}`);
          
          // 3. Token ID 생성
          const tokenId = await this.blockchainService.generateTokenId();
          console.log(`🔢 Token ID 생성: ${tokenId}`);
          
          // 4. NFT 민팅
          const tokenURI = `ipfs://${metadataCID}`;
          const mintResult = await this.blockchainService.mintNFT(address, tokenId, tokenURI);
          console.log(`✅ NFT 민팅 완료: Token #${mintResult.tokenId}`);
          
          return { mintResult, metadataCID };
        };
        
        // 큐에 추가하고 결과 대기
        const { mintResult, metadataCID } = await this.queueMint(mintTask);
        
        // 5. drop_items 테이블에 기록
        await db.query(
          `INSERT INTO drop_items 
          (user_address, monster_type, monster_level, item_name, item_grade, status, minted_token_id)
          VALUES (?, ?, ?, ?, ?, 'minted', ?)`,
          [address, monsterType, monsterLevel, itemName, itemGrade, mintResult.tokenId]
        );
        
        return {
          dropped: true,
          item: {
            tokenId: mintResult.tokenId,
            name: itemName,
            grade: itemGrade,
            monsterType: monsterType,
            monsterLevel: monsterLevel,
            ipfsCid: metadataCID
          },
          message: `${itemName} dropped and minted!`
        };
        
      } catch (mintError) {
        console.error('NFT 민팅 실패, drop_items에만 기록:', mintError);
        
        // 민팅 실패 시 pending 상태로 기록
        const result = await db.query(
          `INSERT INTO drop_items 
          (user_address, monster_type, monster_level, item_name, item_grade, status)
          VALUES (?, ?, ?, ?, ?, 'pending')`,
          [address, monsterType, monsterLevel, itemName, itemGrade]
        );
        
        return {
          dropped: true,
          item: {
            dropId: result.insertId,
            name: itemName,
            grade: itemGrade,
            monsterType: monsterType,
            monsterLevel: monsterLevel
          },
          message: `${itemName} dropped! (Minting pending)`
        };
      }
      
    } catch (error) {
      console.error('몬스터 킬 처리 실패:', error);
      throw error;
    }
  }

  /**
   * 드랍 아이템 목록 조회
   */
  async getDrops(address, status = null) {
    try {
      let query = `
        SELECT 
          id as dropId,
          monster_type as monsterType,
          monster_level as monsterLevel,
          item_name as itemName,
          item_grade as itemGrade,
          status,
          dropped_at as droppedAt,
          minted_token_id as mintedTokenId
        FROM drop_items
        WHERE user_address = ?
      `;
      
      const params = [address];
      
      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }
      
      query += ' ORDER BY dropped_at DESC LIMIT 100';
      
      const drops = await db.query(query, params);
      
      return drops;
      
    } catch (error) {
      console.error('드랍 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 플레이어 통계 조회
   */
  async getPlayerStats(address) {
    try {
      // NFT 개수
      const nftCount = await db.queryOne(
        'SELECT COUNT(*) as count FROM nft_records WHERE owner_address = ? AND status = "active"',
        [address]
      );
      
      // 드랍 개수
      const dropCount = await db.queryOne(
        'SELECT COUNT(*) as count FROM drop_items WHERE user_address = ?',
        [address]
      );
      
      // 등급별 드랍 통계
      const gradeStats = await db.query(
        `SELECT item_grade as grade, COUNT(*) as count 
        FROM drop_items 
        WHERE user_address = ? 
        GROUP BY item_grade`,
        [address]
      );
      
      return {
        nftCount: nftCount.count,
        totalDrops: dropCount.count,
        gradeStats: gradeStats
      };
      
    } catch (error) {
      console.error('통계 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 드랍 아이템을 NFT로 민팅 (P2 - 선택)
   */
  async claimDrop(address, dropId) {
    try {
      // 드랍 아이템 확인
      const drop = await db.queryOne(
        'SELECT * FROM drop_items WHERE id = ? AND user_address = ?',
        [dropId, address]
      );
      
      if (!drop) {
        throw new Error('Drop not found');
      }
      
      if (drop.status !== 'pending') {
        throw new Error('Drop already claimed');
      }
      
      // TODO: 실제 NFT 민팅 로직 (BlockchainService 사용)
      // 지금은 간단히 상태만 업데이트
      
      await db.query(
        'UPDATE drop_items SET status = "claimed" WHERE id = ?',
        [dropId]
      );
      
      return {
        tokenId: null, // 실제 민팅 시 토큰 ID 반환
        message: 'Drop claimed (minting not implemented yet)'
      };
      
    } catch (error) {
      console.error('드랍 클레임 실패:', error);
      throw error;
    }
  }

  /**
   * 아이템 등급 계산 (확률 기반)
   */
  calculateItemGrade() {
    const rand = Math.random();
    let cumulative = 0;
    
    for (const [grade, rate] of Object.entries(this.gradeRates)) {
      cumulative += rate;
      if (rand < cumulative) {
        return grade;
      }
    }
    
    return 'Common';
  }



  /**
   * 몬스터별 드랍 아이템 선택
   */
  getDropItem(monsterType) {
    const items = this.dropItems[monsterType] || this.dropItems.default;
    return items[Math.floor(Math.random() * items.length)];
  }
}

module.exports = GameService;
