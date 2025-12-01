/**
 * 서버 상점 아이템 미리 민팅 스크립트
 * 관리자 주소로 NFT를 미리 생성해두고, 구매 시 전송만 함
 */

require('dotenv').config();
const BlockchainService = require('../server/services/BlockchainService');
const IPFSManager = require('../server/services/IPFSManager');
const db = require('../server/config/database');

async function preMintShopItems() {
  console.log('============================================================');
  console.log('🏪 서버 상점 아이템 미리 민팅 시작');
  console.log('============================================================\n');

  const blockchain = new BlockchainService();
  const ipfs = new IPFSManager();

  try {
    // 1. 상점 아이템 조회
    const shopItems = await db.query(
      'SELECT * FROM server_shop WHERE active = TRUE'
    );

    if (shopItems.length === 0) {
      console.log('❌ 상점 아이템이 없습니다.');
      await db.close();
      process.exit(1);
    }

    console.log(`📦 총 ${shopItems.length}개 아이템 발견\n`);

    for (const item of shopItems) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 아이템: ${item.name}`);
      console.log(`   가격: ${item.price} KQTP`);
      console.log(`   재고: ${item.stock}개`);
      console.log(`${'='.repeat(60)}\n`);

      // 2. 이미 민팅된 NFT 개수 확인
      const existingNFTs = await db.query(
        `SELECT COUNT(*) as count FROM nft_records 
         WHERE owner_address = ? AND status = 'active'
         AND ipfs_cid LIKE ?`,
        [
          process.env.SERVER_WALLET_ADDRESS.toLowerCase(),
          `%${item.name}%`
        ]
      );

      const alreadyMinted = existingNFTs[0].count;
      const needToMint = item.stock - alreadyMinted;

      console.log(`   ✅ 이미 민팅됨: ${alreadyMinted}개`);
      console.log(`   🔨 민팅 필요: ${needToMint}개\n`);

      if (needToMint <= 0) {
        console.log(`   ⏭️  민팅 불필요 (충분한 재고)\n`);
        continue;
      }

      // 3. 필요한 만큼 NFT 민팅
      for (let i = 0; i < needToMint; i++) {
        console.log(`   [${i + 1}/${needToMint}] 민팅 중...`);

        // 3-1. 이미지 생성 (간단한 SVG)
        const itemImage = `
          <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" fill="#4A90E2"/>
            <text x="100" y="100" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">
              ${item.name}
            </text>
            <text x="100" y="130" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">
              ${item.price} KQTP
            </text>
          </svg>
        `;

        // 3-2. IPFS 업로드
        const nftData = await ipfs.uploadNFT({
          image: Buffer.from(itemImage),
          name: item.name,
          description: item.description,
          attributes: [
            { trait_type: 'Type', value: item.item_type },
            { trait_type: 'Rarity', value: item.rarity },
            { trait_type: 'Source', value: 'Server Shop' },
            { trait_type: 'Price', value: item.price },
            { trait_type: 'Item ID', value: item.id }
          ],
          gameData: {
            item_id: item.id,
            item_type: item.item_type,
            price: item.price
          }
        });

        // 3-3. NFT 민팅 (관리자 주소로) - BlockchainService 사용
        const tokenId = await blockchain.generateTokenId();
        
        // 관리자 주소로 직접 민팅 (2단계 방식 사용 안 함)
        const tx = blockchain.gameAssetNFTContract.methods.mint(
          process.env.SERVER_WALLET_ADDRESS,
          tokenId,
          nftData.metadataURI
        );
        
        const gas = await tx.estimateGas({ from: blockchain.adminAccount.address });
        const gasPrice = await blockchain.estimateGasPrice();
        const nonce = await blockchain.web3.eth.getTransactionCount(
          blockchain.adminAccount.address,
          'pending'
        );
        
        const signedTx = await blockchain.adminAccount.signTransaction({
          to: blockchain.gameAssetNFTContract.options.address,
          data: tx.encodeABI(),
          gas: gas,
          gasPrice: gasPrice,
          nonce: nonce
        });
        
        const mintResult = await blockchain.web3.eth.sendSignedTransaction(
          signedTx.rawTransaction
        );

        // 3-4. DB에 저장
        await db.insert('nft_records', {
          token_id: tokenId,
          owner_address: process.env.SERVER_WALLET_ADDRESS.toLowerCase(),
          ipfs_cid: nftData.metadataCID,
          mint_tx_hash: mintResult.transactionHash,
          status: 'active'
        });

        console.log(`      ✅ TokenID ${tokenId} 민팅 완료`);
        console.log(`      📝 TX: ${mintResult.transactionHash}\n`);

        // 가스비 절약을 위해 약간의 딜레이
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log(`   ✅ ${item.name} 민팅 완료!\n`);
    }

    console.log('\n============================================================');
    console.log('🎉 모든 상점 아이템 민팅 완료!');
    console.log('============================================================\n');

    await db.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 민팅 실패:', error);
    console.error('상세:', error.stack);

    try {
      await db.close();
    } catch (e) {
      // 무시
    }

    process.exit(1);
  }
}

// 스크립트 실행
preMintShopItems();
