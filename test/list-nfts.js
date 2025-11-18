/**
 * 데이터베이스의 모든 NFT 목록 조회
 */

require('dotenv').config();
const db = require('./server/config/database');

async function listNFTs() {
  try {
    console.log('\n📋 NFT 목록 조회 중...\n');
    
    // 모든 NFT 레코드 조회
    const nfts = await db.query(
      `SELECT 
        token_id,
        owner_address,
        status,
        ipfs_cid,
        created_at
      FROM nft_records
      ORDER BY token_id ASC`
    );
    
    if (nfts.length === 0) {
      console.log('❌ 데이터베이스에 NFT가 없습니다.');
      console.log('\nNFT를 민팅하려면:');
      console.log('  node test-blockchain.js');
      console.log('  또는 서버 상점에서 아이템을 구매하세요.');
    } else {
      console.log(`✅ 총 ${nfts.length}개의 NFT 발견\n`);
      console.log('='.repeat(80));
      
      for (const nft of nfts) {
        console.log(`Token ID: ${nft.token_id}`);
        console.log(`  소유자:   ${nft.owner_address}`);
        console.log(`  상태:     ${nft.status}`);
        console.log(`  IPFS CID: ${nft.ipfs_cid}`);
        console.log(`  생성일:   ${nft.created_at}`);
        
        // 판매 등록 확인
        const listing = await db.queryOne(
          'SELECT * FROM marketplace_listings WHERE token_id = ? AND status = "active"',
          [nft.token_id]
        );
        
        if (listing) {
          console.log(`  📋 판매중: ${listing.price} KQTP`);
        }
        
        console.log('-'.repeat(80));
      }
      
      console.log('\n💡 소유권 테스트 예시:');
      console.log(`  node test-ownership.js ${nfts[0].token_id}`);
      console.log(`  node test-ownership.js ${nfts[0].token_id} ${nfts[0].owner_address}`);
    }
    
    // 판매 목록 통계
    const listings = await db.query(
      'SELECT COUNT(*) as count FROM marketplace_listings WHERE status = "active"'
    );
    console.log(`\n📊 활성 판매 등록: ${listings[0].count}개`);
    
    // 거래 내역 통계
    const purchases = await db.query(
      'SELECT COUNT(*) as count FROM purchase_history'
    );
    console.log(`📊 총 거래 내역: ${purchases[0].count}개`);
    
    console.log('\n');
    
    await db.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    console.error('상세:', error.stack);
    
    try {
      await db.close();
    } catch (e) {
      // 무시
    }
    
    process.exit(1);
  }
}

listNFTs();
