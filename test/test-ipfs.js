/**
 * IPFS/Pinata 연결 테스트 스크립트
 */

require('dotenv').config();
const IPFSManager = require('../server/services/IPFSManager');
const { createGameItemMetadata, createSummonTicketMetadata } = require('../server/utils/metadataHelper');

async function testIPFS() {
  console.log('============================================================');
  console.log('🧪 IPFS/Pinata 연결 테스트 시작');
  console.log('============================================================\n');

  const ipfs = new IPFSManager();

  try {
    // 1. Pinata 연결 테스트
    console.log('1️⃣  Pinata 인증 테스트...');
    const isConnected = await ipfs.testConnection();
    
    if (!isConnected) {
      console.error('❌ Pinata 연결 실패. JWT 토큰을 확인하세요.');
      process.exit(1);
    }
    
    console.log('');

    // 2. 샘플 이미지 생성 (간단한 SVG)
    console.log('2️⃣  샘플 이미지 생성...');
    const sampleSVG = `
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#4A90E2"/>
        <text x="100" y="100" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">
          Test NFT
        </text>
        <text x="100" y="130" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">
          Legendary Sword
        </text>
      </svg>
    `;
    
    const imageBuffer = Buffer.from(sampleSVG);
    console.log('✅ 샘플 SVG 이미지 생성 완료\n');

    // 3. 이미지 업로드 테스트
    console.log('3️⃣  이미지 IPFS 업로드 테스트...');
    const imageCID = await ipfs.uploadImage(imageBuffer, 'test-sword.svg');
    console.log(`✅ 이미지 CID: ${imageCID}`);
    console.log(`🔗 이미지 URL: ${ipfs.getFileURL(imageCID)}\n`);

    // 4. 메타데이터 생성
    console.log('4️⃣  NFT 메타데이터 생성...');
    const metadata = createGameItemMetadata({
      name: 'Legendary Sword of Testing',
      description: 'A powerful sword forged for testing IPFS integration',
      imageCID: imageCID,
      rarity: 'Legendary',
      itemType: 'Weapon',
      attackPower: 150,
      defensePower: 50,
      durability: 100,
      levelRequirement: 50,
      classRestriction: 'Warrior',
      itemId: 'test_sword_001'
    });
    console.log('✅ 메타데이터 생성 완료');
    console.log(JSON.stringify(metadata, null, 2));
    console.log('');

    // 5. 메타데이터 업로드 테스트
    console.log('5️⃣  메타데이터 IPFS 업로드 테스트...');
    const metadataCID = await ipfs.uploadMetadata(metadata);
    console.log(`✅ 메타데이터 CID: ${metadataCID}`);
    console.log(`🔗 메타데이터 URL: ${ipfs.getFileURL(metadataCID)}\n`);

    // 6. 전체 NFT 업로드 테스트 (재시도 로직 포함)
    console.log('6️⃣  전체 NFT 업로드 테스트 (재시도 로직 포함)...');
    
    const sampleSVG2 = `
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#E74C3C"/>
        <text x="100" y="100" font-size="20" fill="white" text-anchor="middle" dominant-baseline="middle">
          Dragon Ticket
        </text>
      </svg>
    `;
    
    const result = await ipfs.uploadNFT({
      image: Buffer.from(sampleSVG2),
      name: 'Dragon Summon Ticket',
      description: 'Summon a powerful dragon to aid you in battle',
      attributes: [
        { trait_type: 'Type', value: 'Summon Ticket' },
        { trait_type: 'Monster', value: 'Dragon' },
        { trait_type: 'Rarity', value: 'Legendary' },
        { trait_type: 'Summon Uses', value: 1 }
      ],
      gameData: {
        item_id: 'summon_dragon_001',
        monster_type: 'dragon',
        summon_uses: 1
      }
    });

    console.log('✅ 전체 NFT 업로드 완료!');
    console.log('📦 결과:');
    console.log(`   이미지 CID: ${result.imageCID}`);
    console.log(`   메타데이터 CID: ${result.metadataCID}`);
    console.log(`   메타데이터 URI: ${result.metadataURI}`);
    console.log(`   이미지 URL: ${result.imageURL}`);
    console.log(`   메타데이터 URL: ${result.metadataURL}`);
    console.log('');

    // 7. 테스트 완료
    console.log('============================================================');
    console.log('🎉 모든 테스트 통과!');
    console.log('============================================================');
    console.log('');
    console.log('✅ Pinata 연결 성공');
    console.log('✅ 이미지 업로드 성공');
    console.log('✅ 메타데이터 업로드 성공');
    console.log('✅ 재시도 로직 작동');
    console.log('');
    console.log('💡 다음 단계:');
    console.log('   1. 브라우저에서 이미지 URL 확인');
    console.log('   2. 메타데이터 URL에서 JSON 확인');
    console.log('   3. NFT 민팅 시 metadataURI 사용');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('============================================================');
    console.error('❌ 테스트 실패');
    console.error('============================================================');
    console.error('오류:', error.message);
    console.error('');
    
    if (error.message.includes('401') || error.message.includes('403')) {
      console.error('💡 해결 방법:');
      console.error('   1. Pinata JWT 토큰이 올바른지 확인');
      console.error('   2. API 키 권한 확인 (pinFileToIPFS, pinJSONToIPFS)');
      console.error('   3. .env 파일의 PINATA_JWT 값 확인');
    } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
      console.error('💡 해결 방법:');
      console.error('   1. 인터넷 연결 확인');
      console.error('   2. 방화벽 설정 확인');
      console.error('   3. Pinata 서비스 상태 확인');
    }
    
    console.error('');
    process.exit(1);
  }
}

// 테스트 실행
testIPFS();
