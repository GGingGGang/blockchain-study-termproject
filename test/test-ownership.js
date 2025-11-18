/**
 * NFT 소유권 확인 테스트
 */

require('dotenv').config();
const BlockchainService = require('./server/services/BlockchainService');
const db = require('./server/config/database');

async function testOwnership() {
  let actualOwner = null;
  
  try {
    console.log('🔧 초기화 중...');
    const blockchain = new BlockchainService();
    
    // 테스트할 토큰 ID 입력
    const tokenId = process.argv[2];
    let testAddress = process.argv[3];
    
    // 주소가 제공되지 않으면 .env에서 읽기
    if (!testAddress) {
      testAddress = process.env.TEST_WALLET_ADDRESS || process.env.SERVER_WALLET_ADDRESS;
      if (testAddress) {
        console.log(`ℹ️  주소가 제공되지 않아 .env에서 읽었습니다: ${testAddress}`);
      }
    }
    
    if (!tokenId || !testAddress) {
      console.log('\n❌ 사용법이 올바르지 않습니다.');
      console.log('사용법: node test-ownership.js <tokenId> [address]');
      console.log('');
      console.log('예시:');
      console.log('  node test-ownership.js 1');
      console.log('  node test-ownership.js 1 0x1234567890abcdef1234567890abcdef12345678');
      console.log('');
      console.log('주소를 생략하면 .env의 TEST_WALLET_ADDRESS를 사용합니다.');
      await db.close();
      process.exit(1);
    }
    
    // 주소 형식 검증
    if (!testAddress.startsWith('0x') || testAddress.length !== 42) {
      console.log('\n❌ 잘못된 주소 형식입니다.');
      console.log('주소는 0x로 시작하고 42자여야 합니다.');
      console.log(`현재 주소: ${testAddress} (길이: ${testAddress.length})`);
      await db.close();
      process.exit(1);
    }
    
    console.log('\n🔍 NFT 소유권 확인 테스트');
    console.log('='.repeat(50));
    console.log(`Token ID: ${tokenId}`);
    console.log(`Test Address: ${testAddress}`);
    console.log('='.repeat(50));
    
    // 1. 블록체인에서 실제 소유자 확인
    console.log('\n1️⃣ 블록체인에서 소유자 조회...');
    try {
      actualOwner = await blockchain.getOwner(tokenId);
      console.log(`✅ 실제 소유자: ${actualOwner}`);
      console.log(`   소문자: ${actualOwner.toLowerCase()}`);
    } catch (error) {
      console.log(`❌ 소유자 조회 실패: ${error.message}`);
      console.log('   (토큰이 존재하지 않거나 소각되었을 수 있습니다)');
      console.log('   블록체인 연결을 확인하세요.');
    }
    
    // 2. 소유권 검증
    console.log('\n2️⃣ 소유권 검증...');
    const isOwner = await blockchain.verifyOwnership(tokenId, testAddress);
    console.log(`결과: ${isOwner ? '✅ 소유자 맞음' : '❌ 소유자 아님'}`);
    
    // 3. 데이터베이스에서 NFT 레코드 확인
    console.log('\n3️⃣ 데이터베이스 레코드 확인...');
    const dbRecord = await db.queryOne(
      'SELECT * FROM nft_records WHERE token_id = ?',
      [tokenId]
    );
    
    if (dbRecord) {
      console.log('✅ DB 레코드 존재:');
      console.log(`   소유자: ${dbRecord.owner_address}`);
      console.log(`   상태: ${dbRecord.status}`);
      console.log(`   생성일: ${dbRecord.created_at}`);
    } else {
      console.log('❌ DB 레코드 없음');
    }
    
    // 4. 주소 비교
    console.log('\n4️⃣ 주소 비교:');
    console.log(`   테스트 주소:     ${testAddress.toLowerCase()}`);
    if (actualOwner) {
      console.log(`   블록체인 주소:   ${actualOwner.toLowerCase()}`);
      console.log(`   일치 여부:       ${testAddress.toLowerCase() === actualOwner.toLowerCase() ? '✅ 일치' : '❌ 불일치'}`);
    }
    if (dbRecord) {
      console.log(`   DB 주소:         ${dbRecord.owner_address.toLowerCase()}`);
      console.log(`   DB 일치 여부:    ${testAddress.toLowerCase() === dbRecord.owner_address.toLowerCase() ? '✅ 일치' : '❌ 불일치'}`);
      
      if (actualOwner && actualOwner.toLowerCase() !== dbRecord.owner_address.toLowerCase()) {
        console.log(`   ⚠️  경고: 블록체인과 DB의 소유자가 다릅니다!`);
        console.log(`   → 판매 등록 시 DB가 자동으로 업데이트됩니다.`);
      }
    }
    
    // 5. 판매 등록 상태 확인
    console.log('\n5️⃣ 판매 등록 상태 확인...');
    const listing = await db.queryOne(
      'SELECT * FROM marketplace_listings WHERE token_id = ? AND status = "active"',
      [tokenId]
    );
    
    if (listing) {
      console.log('✅ 판매 등록 존재:');
      console.log(`   판매자: ${listing.seller_address}`);
      console.log(`   가격: ${listing.price} KQTP`);
      console.log(`   등록일: ${listing.listed_at}`);
    } else {
      console.log('ℹ️  판매 등록 없음 (등록 가능)');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('테스트 완료\n');
    
    // 데이터베이스 연결 종료
    await db.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error);
    console.error('오류 상세:', error.stack);
    
    // 데이터베이스 연결 종료
    try {
      await db.close();
    } catch (e) {
      // 무시
    }
    
    process.exit(1);
  }
}

testOwnership();
