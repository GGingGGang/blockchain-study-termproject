/**
 * 게임 NFT 동기화 스크립트
 * 블록체인에서 모든 NFT를 스캔하여 DB에 동기화
 */

require('dotenv').config();
const { web3, gameAssetNFTContract } = require('../server/config/web3');
const db = require('../server/config/database');

async function syncAllNFTs() {
  try {
    console.log('🔄 NFT 동기화 시작...');
    
    // 컨트랙트 배포 블록부터 현재 블록까지
    const CONTRACT_DEPLOY_BLOCK = BigInt(process.env.CONTRACT_DEPLOY_BLOCK || 9619320);
    const currentBlock = await web3.eth.getBlockNumber();
    const CHUNK_SIZE = 10000n;
    
    console.log(`📦 블록 스캔: ${CONTRACT_DEPLOY_BLOCK} ~ ${currentBlock}`);
    
    let syncedCount = 0;
    let updatedCount = 0;
    
    // 청크 단위로 이벤트 조회
    const allEvents = [];
    for (let from = CONTRACT_DEPLOY_BLOCK; from <= currentBlock; from += CHUNK_SIZE) {
      const to = from + CHUNK_SIZE - 1n < currentBlock ? from + CHUNK_SIZE - 1n : currentBlock;
      
      console.log(`  스캔 중: ${from} ~ ${to}`);
      
      try {
        const events = await gameAssetNFTContract.getPastEvents('Transfer', {
          fromBlock: from.toString(),
          toBlock: to.toString()
        });
        
        if (events.length > 0) {
          console.log(`    발견: ${events.length}개 이벤트`);
          allEvents.push(...events);
        }
      } catch (error) {
        console.warn(`  청크 스캔 실패 (${from}-${to}):`, error.message);
      }
    }
    
    console.log(`\n✅ 총 ${allEvents.length}개 Transfer 이벤트 발견`);
    
    // Token ID 추출
    const tokenIds = new Set(allEvents.map(e => e.returnValues.tokenId));
    console.log(`📋 고유 Token ID: ${tokenIds.size}개\n`);
    
    // 각 Token ID 처리
    for (const tokenId of tokenIds) {
      try {
        // 현재 소유자 확인
        let owner;
        try {
          owner = await gameAssetNFTContract.methods.ownerOf(tokenId).call();
        } catch (ownerError) {
          // NFT가 소각됨
          console.log(`Token ${tokenId}: 소각됨`);
          
          const dbRecord = await db.queryOne(
            'SELECT * FROM nft_records WHERE token_id = ?',
            [tokenId]
          );
          
          if (dbRecord && dbRecord.status === 'active') {
            await db.query(
              'UPDATE nft_records SET status = ? WHERE token_id = ?',
              ['burned', tokenId]
            );
            updatedCount++;
          }
          
          continue;
        }
        
        // DB 확인
        const dbRecord = await db.queryOne(
          'SELECT * FROM nft_records WHERE token_id = ?',
          [tokenId]
        );
        
        if (dbRecord) {
          // 소유자 업데이트
          if (dbRecord.owner_address.toLowerCase() !== owner.toLowerCase()) {
            await db.query(
              'UPDATE nft_records SET owner_address = ?, status = ? WHERE token_id = ?',
              [owner.toLowerCase(), 'active', tokenId]
            );
            console.log(`Token ${tokenId}: 소유자 업데이트 (${owner})`);
            updatedCount++;
          }
        } else {
          // 새로 추가
          let ipfsCID = null;
          try {
            const tokenURI = await gameAssetNFTContract.methods.tokenURI(tokenId).call();
            if (tokenURI.includes('ipfs://')) {
              ipfsCID = tokenURI.replace('ipfs://', '');
            } else if (tokenURI.includes('/ipfs/')) {
              ipfsCID = tokenURI.split('/ipfs/')[1];
            }
          } catch (e) {
            console.warn(`  메타데이터 조회 실패 (Token ${tokenId})`);
          }
          
          await db.query(
            'INSERT INTO nft_records (token_id, owner_address, status, ipfs_cid, created_at) VALUES (?, ?, ?, ?, ?)',
            [tokenId, owner.toLowerCase(), 'active', ipfsCID, new Date()]
          );
          
          console.log(`Token ${tokenId}: DB에 추가 (소유자: ${owner})`);
          syncedCount++;
        }
      } catch (error) {
        console.error(`Token ${tokenId} 처리 오류:`, error.message);
      }
    }
    
    console.log('\n✅ 동기화 완료!');
    console.log(`  추가: ${syncedCount}개`);
    console.log(`  업데이트: ${updatedCount}개`);
    console.log(`  총: ${tokenIds.size}개`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 동기화 실패:', error);
    process.exit(1);
  }
}

// 실행
syncAllNFTs();
