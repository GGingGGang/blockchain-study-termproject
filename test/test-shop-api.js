/**
 * 서버 상점 API 테스트
 */

const fetch = require('node-fetch');

const API_URL = 'http://bridge:3000';

async function testShopAPI() {
  console.log('🧪 서버 상점 API 테스트 시작\n');

  try {
    // 1. 상점 아이템 목록 조회 (인증 없이)
    console.log('1️⃣ 상점 아이템 목록 조회 (인증 없음)...');
    const response = await fetch(`${API_URL}/api/marketplace/shop/items`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`   상태 코드: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ 성공!`);
      console.log(`   아이템 개수: ${data.items?.length || 0}`);
      
      if (data.items && data.items.length > 0) {
        console.log('\n   📦 상점 아이템 목록:');
        data.items.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.name} - ${item.price} KQTP (재고: ${item.stock})`);
        });
      }
    } else {
      const error = await response.json();
      console.log(`   ❌ 실패: ${error.error || error.message}`);
      console.log(`   응답:`, error);
    }

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
  }

  console.log('\n✅ 테스트 완료');
}

// 테스트 실행
testShopAPI();
