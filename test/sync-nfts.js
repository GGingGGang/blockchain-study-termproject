/**
 * 블록체인과 데이터베이스 NFT 동기화
 * 블록체인에 있지만 DB에 없는 NFT를 찾아서 DB에 추가
 */

require('dotenv').config();
const BlockchainService = require('../server/services/BlockchainService');
const db = require('../server/config/database');

async function syncNFTs() {
  let syncedCount = 0;
  let errorCount = 0;
  
  try {
    console.log('\n🔄 NFT 동기화 시작...\n');
    
    const blockchain = new BlockchainService();
    const nftContract = blockchain.gameAssetNFTContract;
    
    // 1. 특정 주소의 NFT 스캔 (인자로 받거나 .env에서)
    const targetAddress = process.argv[2] || process.env.TEST_WALLET_ADDRESS;
    
    if (!targetAddress) {
      console.log('❌ 주소를 제공해주세요.');
      console.log('사용법: node sync-nfts.js <address>');
      console.log('또는 .env에 TEST_WALLET_ADDRESS 설정');
      await db.close();
      process.exit(1);
    }
    
    console.log(`📍 대상 주소: ${targetAddress}\n`);
    
    // 2. 블록체인에서 해당 주소의 NFT 개수 조회
    const balance = await nftContract.methods.balanceOf(targetAddress).call();
    console.log(`📊 블록체인 NFT 개수: ${balance}개\n`);
    
    if (balance === '0') {
      console.log('ℹ️  이 주소는 NFT를 보유하고 있지 않습니다.');
      await db.close();
      process.exit(0);
    }
    
    // 3. Transfer 이벤트를 통해 Token ID 찾기
    console.log('🔍 블록체인에서 NFT 검색 중...\n');
    
    // 블록 범위 설정
    const CONTRACT_DEPLOY_BLOCK = 9619320n; // NFT 컨트랙트 배포 블록
    const currentBlock = await blockchain.web3.eth.getBlockNumber();
    const startBlock = CONTRACT_DEPLOY_BLOCK;
    const totalRange = Number(currentBlock - startBlock);
    
    console.log(`📦 블록 범위: ${startBlock} ~ ${currentBlock} (${totalRange.toLocaleString()} 블록)`);
    console.log(`   ℹ️  컨트랙트 배포 블록부터 스캔\n`);
    
    // Transfer 이벤트 조회 (10,000 블록씩 청크 처리)
    const CHUNK_SIZE = 10000;
    const allEvents = [];
    let processedBlocks = 0;
    
    console.log(`🔄 청크 단위 스캔 시작 (${CHUNK_SIZE.toLocaleString()} 블록씩)...\n`);
    
    for (let from = startBlock; from <= currentBlock; from += BigInt(CHUNK_SIZE)) {
      const to = from + BigInt(CHUNK_SIZE) - 1n < currentBlock 
        ? from + BigInt(CHUNK_SIZE) - 1n 
        : currentBlock;
      
      try {
        console.log(`   📦 스캔 중: ${from} ~ ${to}`);
        
        // 필터 없이 모든 Transfer 이벤트 조회 (민팅 포함)
        const events = await nftContract.getPastEvents('Transfer', {
          fromBlock: from.toString(),
          toBlock: to.toString()
        });
        
        if (events.length > 0) {
          console.log(`      ✅ ${events.length}개 이벤트 발견`);
          allEvents.push(...events);
        }
        
        processedBlocks += Number(to - from + 1n);
        const progress = ((processedBlocks / totalRange) * 100).toFixed(1);
        console.log(`      진행률: ${progress}%\n`);
        
      } catch (error) {
        console.log(`      ⚠️  청크 스캔 실패: ${error.message}`);
        console.log(`      계속 진행...\n`);
      }
    }
    
    console.log(`📨 총 발견된 Transfer 이벤트: ${allEvents.length}개`);
    
    // 4. 대상 주소와 관련된 Token ID만 추출
    const tokenIds = new Set();
    
    for (const event of allEvents) {
      const { from, to, tokenId } = event.returnValues;
      
      // 대상 주소로 전송된 NFT (민팅 포함) 또는 대상 주소에서 전송한 NFT
      if (to.toLowerCase() === targetAddress.toLowerCase() || 
          from.toLowerCase() === targetAddress.toLowerCase()) {
        tokenIds.add(tokenId);
      }
    }
    
    console.log('='.repeat(80));
    
    for (const tokenId of tokenIds) {
      try {
        // 현재 소유자 확인 (NFT가 소각되었을 수 있음)
        let owner;
        try {
          owner = await nftContract.methods.ownerOf(tokenId).call();
        } catch (ownerError) {
          // NFT가 존재하지 않거나 소각됨
          console.log(`⏭️  Token ID ${tokenId}: 소각되었거나 존재하지 않음`);
          
          // DB에 있다면 상태 업데이트
          const dbRecord = await db.queryOne(
            'SELECT * FROM nft_records WHERE token_id = ?',
            [tokenId]
          );
          
          if (dbRecord && dbRecord.status === 'active') {
            await db.query(
              'UPDATE nft_records SET status = ? WHERE token_id = ?',
              ['burned', tokenId]
            );
            console.log(`   ✅ DB 상태 업데이트: burned`);
            syncedCount++;
          }
          
          continue;
        }
        
        // 대상 주소가 소유자인지 확인
        if (owner.toLowerCase() !== targetAddress.toLowerCase()) {
          console.log(`⏭️  Token ID ${tokenId}: 다른 주소가 소유 중 (${owner})`);
          continue;
        }
        
        // DB에 있는지 확인
        const dbRecord = await db.queryOne(
          'SELECT * FROM nft_records WHERE token_id = ?',
          [tokenId]
        );
        
        if (dbRecord) {
          // DB에 있지만 소유자가 다른 경우 업데이트
          if (dbRecord.owner_address.toLowerCase() !== owner.toLowerCase()) {
            await db.query(
              'UPDATE nft_records SET owner_address = ?, status = ? WHERE token_id = ?',
              [owner.toLowerCase(), 'active', tokenId]
            );
            console.log(`✅ Token ID ${tokenId}: 소유자 업데이트 (${owner})`);
            syncedCount++;
          } else {
            console.log(`✓  Token ID ${tokenId}: 이미 동기화됨`);
          }
        } else {
          // DB에 없으면 추가
          console.log(`🆕 Token ID ${tokenId}: DB에 없음, 추가 중...`);
          
          // 메타데이터 URI 조회
          let ipfsCID = null;
          try {
            const tokenURI = await nftContract.methods.tokenURI(tokenId).call();
            // ipfs://QmXXX 또는 https://gateway.../ipfs/QmXXX 형식에서 CID 추출
            if (tokenURI.includes('ipfs://')) {
              ipfsCID = tokenURI.replace('ipfs://', '');
            } else if (tokenURI.includes('/ipfs/')) {
              ipfsCID = tokenURI.split('/ipfs/')[1];
            }
          } catch (e) {
            console.log(`   ⚠️  메타데이터 URI 조회 실패: ${e.message}`);
          }
          
          // DB에 추가 (mint_tx_hash는 알 수 없으므로 NULL)
          await db.insert('nft_records', {
            token_id: tokenId,
            owner_address: owner.toLowerCase(),
            status: 'active',
            ipfs_cid: ipfsCID,
            mint_tx_hash: null,
            created_at: new Date()
          });
          
          console.log(`   ✅ DB에 추가 완료 (IPFS CID: ${ipfsCID || 'N/A'})`);
          syncedCount++;
        }
        
      } catch (error) {
        console.log(`❌ Token ID ${tokenId}: 오류 - ${error.message}`);
        errorCount++;
      }
    }
    
    console.log('='.repeat(80));
    console.log(`\n📊 동기화 결과:`);
    console.log(`   ✅ 동기화됨: ${syncedCount}개`);
    console.log(`   ❌ 오류: ${errorCount}개`);
    console.log(`   📋 총 처리: ${tokenIds.size}개`);
    
    console.log('\n✅ 동기화 완료\n');
    
    await db.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ 동기화 실패:', error);
    console.error('상세:', error.stack);
    
    try {
      await db.close();
    } catch (e) {
      // 무시
    }
    
    process.exit(1);
  }
}

syncNFTs();
