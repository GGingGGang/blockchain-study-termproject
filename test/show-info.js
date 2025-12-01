/**
 * 프로젝트 정보 요약 표시
 * - 스마트 컨트랙트 주소
 * - NFT 목록
 * - 유용한 링크
 */

require('dotenv').config();
const db = require('../server/config/database');

async function showInfo() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🎮 블록체인 게임 NFT 마켓플레이스 - 프로젝트 정보');
    console.log('='.repeat(80));
    
    // 1. 네트워크 정보
    console.log('\n📡 네트워크 정보');
    console.log('-'.repeat(80));
    console.log(`네트워크:     Sepolia Testnet`);
    console.log(`Chain ID:     11155111`);
    console.log(`RPC URL:      ${process.env.SEPOLIA_RPC_URL}`);
    console.log(`Explorer:     https://sepolia.etherscan.io`);
    
    // 2. 스마트 컨트랙트 주소
    console.log('\n📜 스마트 컨트랙트 주소');
    console.log('-'.repeat(80));
    
    const gameTokenAddress = process.env.GAME_TOKEN_ADDRESS;
    const nftAddress = process.env.GAME_ASSET_NFT_ADDRESS;
    const serverWallet = process.env.SERVER_WALLET_ADDRESS;
    
    console.log(`\n🪙 KQTP 토큰 (ERC-20):`);
    console.log(`   주소:      ${gameTokenAddress}`);
    console.log(`   심볼:      KQTP`);
    console.log(`   이름:      Game Token`);
    console.log(`   소수점:    18`);
    console.log(`   Etherscan: https://sepolia.etherscan.io/address/${gameTokenAddress}`);
    
    console.log(`\n🎨 NFT 컨트랙트 (ERC-721):`);
    console.log(`   주소:      ${nftAddress}`);
    console.log(`   심볼:      GASSET`);
    console.log(`   이름:      GameAsset`);
    console.log(`   Etherscan: https://sepolia.etherscan.io/address/${nftAddress}`);
    
    console.log(`\n💼 서버 지갑:`);
    console.log(`   주소:      ${serverWallet}`);
    console.log(`   Etherscan: https://sepolia.etherscan.io/address/${serverWallet}`);
    
    // 3. NFT 목록
    console.log('\n\n📋 NFT 목록');
    console.log('-'.repeat(80));
    
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
      console.log('❌ NFT가 없습니다.');
    } else {
      console.log(`총 ${nfts.length}개의 NFT\n`);
      
      for (const nft of nfts) {
        console.log(`Token ID: ${nft.token_id}`);
        console.log(`  소유자:     ${nft.owner_address}`);
        console.log(`  상태:       ${nft.status}`);
        console.log(`  메타데이터: https://gateway.pinata.cloud/ipfs/${nft.ipfs_cid}`);
        console.log(`  OpenSea:    https://testnets.opensea.io/assets/sepolia/${nftAddress}/${nft.token_id}`);
        console.log(`  생성일:     ${nft.created_at}`);
        
        // 판매 등록 확인
        const listing = await db.queryOne(
          'SELECT * FROM marketplace_listings WHERE token_id = ? AND status = "active"',
          [nft.token_id]
        );
        
        if (listing) {
          console.log(`  💰 판매중:   ${listing.price} KQTP`);
        }
        
        console.log('');
      }
    }
    
    // 4. 통계
    console.log('\n📊 통계');
    console.log('-'.repeat(80));
    
    const listings = await db.queryOne(
      'SELECT COUNT(*) as count FROM marketplace_listings WHERE status = "active"'
    );
    console.log(`활성 판매 등록: ${listings.count}개`);
    
    const purchases = await db.queryOne(
      'SELECT COUNT(*) as count FROM purchase_history'
    );
    console.log(`총 거래 내역:   ${purchases.count}개`);
    
    const shopItems = await db.queryOne(
      'SELECT COUNT(*) as count FROM server_shop WHERE available = TRUE'
    );
    console.log(`상점 아이템:    ${shopItems.count}개`);
    
    // 5. 유용한 링크
    console.log('\n\n🔗 유용한 링크');
    console.log('-'.repeat(80));
    console.log(`마켓플레이스:     http://bridge:${process.env.PORT || 3000}`);
    console.log(`Sepolia Faucet:   https://sepoliafaucet.com`);
    console.log(`Sepolia Explorer: https://sepolia.etherscan.io`);
    console.log(`OpenSea Testnet:  https://testnets.opensea.io`);
    console.log(`Pinata Gateway:   https://gateway.pinata.cloud`);
    
    // 6. 빠른 명령어
    console.log('\n\n⚡ 빠른 명령어');
    console.log('-'.repeat(80));
    console.log(`NFT 목록 보기:        node list-nfts.js`);
    console.log(`소유권 확인:          node test-ownership.js <tokenId>`);
    console.log(`블록체인 테스트:      node test-blockchain.js`);
    console.log(`서버 실행:            npm run server`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ 정보 조회 완료\n');
    
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

showInfo();
