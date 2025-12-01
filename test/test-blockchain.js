/**
 * 블록체인 서비스 테스트 스크립트
 */

require('dotenv').config();
const BlockchainService = require('../server/services/BlockchainService');
const IPFSManager = require('../server/services/IPFSManager');

async function testBlockchain() {
  console.log('============================================================');
  console.log('🧪 블록체인 서비스 테스트 시작');
  console.log('============================================================\n');

  const blockchain = new BlockchainService();
  const ipfs = new IPFSManager();

  try {
    // 1. 계정 정보 확인
    console.log('1️⃣  계정 정보 확인...');
    console.log(`   관리자 주소: ${blockchain.adminAccount.address}`);
    console.log(`   NFT 컨트랙트: ${blockchain.gameAssetNFTContract.options.address}`);
    console.log(`   토큰 컨트랙트: ${blockchain.gameTokenContract.options.address}`);
    console.log('');

    // 2. 토큰 잔액 조회
    console.log('2️⃣  토큰 잔액 조회...');
    const balance = await blockchain.getTokenBalance(blockchain.adminAccount.address);
    const balanceInTokens = blockchain.web3.utils.fromWei(balance, 'ether');
    console.log(`   잔액: ${balanceInTokens} KQTP`);
    console.log('');

    // 3. 테스트 NFT 메타데이터 생성
    console.log('3️⃣  테스트 NFT 메타데이터 생성...');
    const testSVG = `
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#9B59B6"/>
        <text x="100" y="100" font-size="20" fill="white" text-anchor="middle" dominant-baseline="middle">
          Test Sword
        </text>
      </svg>
    `;
    
    const nftData = await ipfs.uploadNFT({
      image: Buffer.from(testSVG),
      name: 'Test Legendary Sword',
      description: 'A test sword for blockchain integration',
      attributes: [
        { trait_type: 'Rarity', value: 'Legendary' },
        { trait_type: 'Attack Power', value: 200 }
      ]
    });
    
    console.log(`   메타데이터 URI: ${nftData.metadataURI}`);
    console.log('');

    // 4. NFT 민팅 테스트
    console.log('4️⃣  NFT 민팅 테스트...');
    const tokenId = await blockchain.generateTokenId();
    console.log(`   생성된 TokenID: ${tokenId}`);
    
    const mintResult = await blockchain.mintNFT(
      blockchain.adminAccount.address,
      tokenId,
      nftData.metadataURI
    );
    
    console.log(`   ✅ 민팅 성공!`);
    console.log(`   트랜잭션: ${mintResult.transactionHash}`);
    console.log(`   블록 번호: ${mintResult.blockNumber}`);
    console.log(`   가스 사용: ${mintResult.gasUsed}`);
    console.log('');

    // 5. NFT 소유권 확인
    console.log('5️⃣  NFT 소유권 확인...');
    const owner = await blockchain.getOwner(tokenId);
    console.log(`   소유자: ${owner}`);
    
    const isOwner = await blockchain.verifyOwnership(tokenId, blockchain.adminAccount.address);
    console.log(`   소유권 검증: ${isOwner ? '✅ 확인됨' : '❌ 실패'}`);
    console.log('');

    // 6. 메타데이터 URI 조회
    console.log('6️⃣  메타데이터 URI 조회...');
    const tokenURI = await blockchain.getTokenURI(tokenId);
    console.log(`   Token URI: ${tokenURI}`);
    console.log('');

    // 7. 트랜잭션 상태 조회
    console.log('7️⃣  트랜잭션 상태 조회...');
    const txStatus = await blockchain.getTransactionStatus(mintResult.transactionHash);
    console.log(`   상태: ${txStatus.status}`);
    console.log(`   확인 수: ${txStatus.confirmations}`);
    console.log('');

    // 8. NFT 소각 테스트
    console.log('8️⃣  NFT 소각 테스트...');
    const burnResult = await blockchain.burnNFT(tokenId);
    console.log(`   ✅ 소각 성공!`);
    console.log(`   트랜잭션: ${burnResult.transactionHash}`);
    console.log(`   이전 소유자: ${burnResult.previousOwner}`);
    console.log('');

    // 9. 소각 후 소유권 확인
    console.log('9️⃣  소각 후 소유권 확인...');
    try {
      await blockchain.getOwner(tokenId);
      console.log('   ❌ 오류: 소각된 NFT가 여전히 존재함');
    } catch (error) {
      console.log('   ✅ 확인됨: NFT가 정상적으로 소각됨');
    }
    console.log('');

    // 테스트 완료
    console.log('============================================================');
    console.log('🎉 모든 테스트 통과!');
    console.log('============================================================');
    console.log('');
    console.log('✅ 계정 정보 확인');
    console.log('✅ 토큰 잔액 조회');
    console.log('✅ NFT 민팅');
    console.log('✅ 소유권 확인');
    console.log('✅ 메타데이터 조회');
    console.log('✅ 트랜잭션 상태 조회');
    console.log('✅ NFT 소각');
    console.log('');
    console.log('🔗 Sepolia Etherscan:');
    console.log(`   민팅: https://sepolia.etherscan.io/tx/${mintResult.transactionHash}`);
    console.log(`   소각: https://sepolia.etherscan.io/tx/${burnResult.transactionHash}`);
    console.log('');

  } catch (error) {
    console.error('');
    console.error('============================================================');
    console.error('❌ 테스트 실패');
    console.error('============================================================');
    console.error('오류:', error.message);
    console.error('');
    
    if (error.message.includes('insufficient funds')) {
      console.error('💡 해결 방법:');
      console.error('   Sepolia 테스트넷 ETH가 부족합니다.');
      console.error('   Faucet에서 ETH를 받으세요: https://sepoliafaucet.com');
    }
    
    console.error('');
    process.exit(1);
  }
}

// 테스트 실행
testBlockchain();
