/**
 * API 엔드포인트 테스트 스크립트
 */

const axios = require('axios');
const { ethers } = require('ethers');

const BASE_URL = 'http://bridge:3000';
const TEST_WALLET = '0xa5ab6C8C0560d51Db844182e286a380916Eb1487';
const PRIVATE_KEY = '2c91b315b64cea81b83fb7376ee145b151041c8b5928d4cb4fa6ff24d01bdac6';

let authToken = null;
let sessionToken = null;

async function testAPI() {
  console.log('============================================================');
  console.log('🧪 API 엔드포인트 테스트 시작');
  console.log('============================================================\n');

  try {
    // 1. 헬스 체크
    console.log('1️⃣  헬스 체크...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log(`   ✅ 서버 상태: ${health.data.status}`);
    console.log('');

    // 2. 게임 클라이언트 인증 테스트
    console.log('2️⃣  게임 클라이언트 인증 테스트...');
    const message = `Sign in to Blockchain Game\nTimestamp: ${Date.now()}`;
    const wallet = new ethers.Wallet(PRIVATE_KEY);
    const signature = await wallet.signMessage(message);
    
    const authResponse = await axios.post(`${BASE_URL}/api/auth/verify-signature`, {
      message,
      signature,
      address: TEST_WALLET
    });
    
    authToken = authResponse.data.token;
    console.log(`   ✅ 인증 성공`);
    console.log(`   토큰: ${authToken.substring(0, 20)}...`);
    console.log('');

    // 3. 토큰 검증
    console.log('3️⃣  토큰 검증...');
    const verifyResponse = await axios.get(`${BASE_URL}/api/auth/verify-token`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log(`   ✅ 토큰 유효: ${verifyResponse.data.valid}`);
    console.log('');

    // 4. 플레이어 NFT 목록 조회
    console.log('4️⃣  플레이어 NFT 목록 조회...');
    const nftsResponse = await axios.get(`${BASE_URL}/api/nft/player/${TEST_WALLET}`);
    console.log(`   ✅ NFT 개수: ${nftsResponse.data.count}`);
    if (nftsResponse.data.nfts.length > 0) {
      console.log(`   첫 번째 NFT: TokenID ${nftsResponse.data.nfts[0].token_id}`);
    }
    console.log('');

    // 5. 마켓플레이스 인증 테스트
    console.log('5️⃣  마켓플레이스 인증 테스트...');
    
    // 5-1. 메시지 요청
    const messageResponse = await axios.post(`${BASE_URL}/api/marketplace/auth/request-message`, {
      address: TEST_WALLET
    });
    const authMessage = messageResponse.data.message;
    console.log(`   ✅ 인증 메시지 생성`);
    
    // 5-2. 서명 및 검증
    const marketplaceSignature = await wallet.signMessage(authMessage);
    const marketplaceAuthResponse = await axios.post(`${BASE_URL}/api/marketplace/auth/verify`, {
      address: TEST_WALLET,
      signature: marketplaceSignature,
      message: authMessage
    });
    
    sessionToken = marketplaceAuthResponse.data.sessionToken;
    console.log(`   ✅ 마켓플레이스 인증 성공`);
    console.log(`   세션 토큰: ${sessionToken.substring(0, 20)}...`);
    console.log('');

    // 6. 마켓플레이스 NFT 목록 조회
    console.log('6️⃣  마켓플레이스 NFT 목록 조회...');
    const marketplaceNFTs = await axios.get(
      `${BASE_URL}/api/marketplace/nfts/${TEST_WALLET}`,
      { headers: { Authorization: `Bearer ${sessionToken}` } }
    );
    console.log(`   ✅ NFT 개수: ${marketplaceNFTs.data.count}`);
    console.log('');

    // 7. 마켓플레이스 판매 목록 조회
    console.log('7️⃣  마켓플레이스 판매 목록 조회...');
    const listings = await axios.get(`${BASE_URL}/api/marketplace/listings`);
    console.log(`   ✅ 판매 중인 NFT: ${listings.data.listings.length}개`);
    console.log('');

    // 8. 서버 상점 아이템 조회
    console.log('8️⃣  서버 상점 아이템 조회...');
    const shopItems = await axios.get(
      `${BASE_URL}/api/marketplace/shop/items`,
      { headers: { Authorization: `Bearer ${sessionToken}` } }
    );
    console.log(`   ✅ 상점 아이템: ${shopItems.data.items.length}개`);
    if (shopItems.data.items.length > 0) {
      const item = shopItems.data.items[0];
      console.log(`   첫 번째 아이템: ${item.name} (${item.price} KQTP)`);
    }
    console.log('');

    // 9. 거래 내역 조회
    console.log('9️⃣  거래 내역 조회...');
    const history = await axios.get(
      `${BASE_URL}/api/marketplace/history/${TEST_WALLET}`,
      { headers: { Authorization: `Bearer ${sessionToken}` } }
    );
    console.log(`   ✅ 거래 내역: ${history.data.total}건`);
    console.log('');

    // 테스트 완료
    console.log('============================================================');
    console.log('🎉 모든 API 테스트 통과!');
    console.log('============================================================');
    console.log('');
    console.log('✅ 헬스 체크');
    console.log('✅ 게임 클라이언트 인증');
    console.log('✅ 토큰 검증');
    console.log('✅ NFT 목록 조회');
    console.log('✅ 마켓플레이스 인증 (EIP-4361)');
    console.log('✅ 마켓플레이스 NFT 조회');
    console.log('✅ 판매 목록 조회');
    console.log('✅ 서버 상점 조회');
    console.log('✅ 거래 내역 조회');
    console.log('');
    console.log('💡 다음 단계:');
    console.log('   1. 웹 프론트엔드 구현');
    console.log('   2. NFT 민팅/구매 플로우 테스트');
    console.log('   3. 전체 시스템 통합 테스트');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('============================================================');
    console.error('❌ API 테스트 실패');
    console.error('============================================================');
    console.error('오류:', error.message);
    
    if (error.response) {
      console.error('상태 코드:', error.response.status);
      console.error('응답:', error.response.data);
    }
    
    console.error('');
    process.exit(1);
  }
}

// 테스트 실행
testAPI();
