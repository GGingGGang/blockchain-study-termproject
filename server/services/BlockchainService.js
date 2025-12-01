/**
 * 블록체인 서비스
 * 스마트 컨트랙트와의 상호작용 처리
 */

const { web3, adminAccount, gameTokenContract, gameAssetNFTContract, minimalForwarderContract } = require('../config/web3');

class BlockchainService {
  constructor() {
    this.web3 = web3;
    this.adminAccount = adminAccount;
    this.gameTokenContract = gameTokenContract;
    this.gameAssetNFTContract = gameAssetNFTContract;
    this.minimalForwarderContract = minimalForwarderContract;
  }

  /**
   * 가스 가격 추정 (10% 여유)
   * @returns {Promise<bigint>} 가스 가격
   */
  async estimateGasPrice() {
    const gasPrice = await this.web3.eth.getGasPrice();
    return gasPrice * 110n / 100n;
  }

  /**
   * NFT 민팅 (관리자 → 사용자 2단계 방식)
   * @param {string} toAddress - 최종 수신자 주소
   * @param {number} tokenId - 토큰 ID
   * @param {string} tokenURI - IPFS 메타데이터 URI
   * @returns {Promise<Object>} 트랜잭션 영수증
   */
  async mintNFT(toAddress, tokenId, tokenURI) {
    try {
      console.log(`🔨 NFT 민팅 시작 (2단계 방식)`);
      console.log(`   1단계: 관리자로 민팅 (TokenID ${tokenId})`);
      console.log(`   2단계: 관리자 → ${toAddress} 전송`);
      
      // 1단계: 관리자 주소로 민팅
      const mintTx = this.gameAssetNFTContract.methods.mint(
        this.adminAccount.address,  // 관리자로 먼저 민팅
        tokenId, 
        tokenURI
      );
      
      const mintGas = await mintTx.estimateGas({ from: this.adminAccount.address });
      const gasPrice = await this.estimateGasPrice();
      let nonce = await this.web3.eth.getTransactionCount(this.adminAccount.address, 'pending');
      
      console.log(`   ⛽ 민팅 가스: ${mintGas}, 가스 가격: ${gasPrice}, nonce: ${nonce}`);
      
      const signedMintTx = await this.adminAccount.signTransaction({
        to: this.gameAssetNFTContract.options.address,
        data: mintTx.encodeABI(),
        gas: mintGas,
        gasPrice: gasPrice,
        nonce: nonce
      });
      
      const mintReceipt = await this.web3.eth.sendSignedTransaction(signedMintTx.rawTransaction);
      console.log(`   ✅ 1단계 완료: ${mintReceipt.transactionHash}`);
      
      // 2단계: 관리자 → 사용자로 전송
      const transferTx = this.gameAssetNFTContract.methods.transferFrom(
        this.adminAccount.address,
        toAddress,
        tokenId
      );
      
      const transferGas = await transferTx.estimateGas({ from: this.adminAccount.address });
      nonce = await this.web3.eth.getTransactionCount(this.adminAccount.address, 'pending');
      
      console.log(`   ⛽ 전송 가스: ${transferGas}, nonce: ${nonce}`);
      
      const signedTransferTx = await this.adminAccount.signTransaction({
        to: this.gameAssetNFTContract.options.address,
        data: transferTx.encodeABI(),
        gas: transferGas,
        gasPrice: gasPrice,
        nonce: nonce
      });
      
      const transferReceipt = await this.web3.eth.sendSignedTransaction(signedTransferTx.rawTransaction);
      console.log(`   ✅ 2단계 완료: ${transferReceipt.transactionHash}`);
      
      console.log(`✅ NFT 민팅 및 전송 완료`);
      
      return {
        success: true,
        mintTransactionHash: mintReceipt.transactionHash,
        transferTransactionHash: transferReceipt.transactionHash,
        blockNumber: transferReceipt.blockNumber,
        gasUsed: (BigInt(mintReceipt.gasUsed) + BigInt(transferReceipt.gasUsed)).toString(),
        tokenId,
        toAddress,
        tokenURI
      };
    } catch (error) {
      console.error(`❌ NFT 민팅 실패:`, error.message);
      throw new Error(`NFT minting failed: ${error.message}`);
    }
  }

  /**
   * NFT 소각
   * @param {number} tokenId - 토큰 ID
   * @returns {Promise<Object>} 트랜잭션 영수증
   */
  async burnNFT(tokenId) {
    try {
      console.log(`🔥 NFT 소각 시작: TokenID ${tokenId}`);
      
      // 소유자 확인
      const owner = await this.gameAssetNFTContract.methods.ownerOf(tokenId).call();
      console.log(`   소유자: ${owner}`);
      
      // 트랜잭션 준비
      const tx = this.gameAssetNFTContract.methods.burn(tokenId);
      
      // 가스 추정
      const gas = await tx.estimateGas({ from: this.adminAccount.address });
      const gasPrice = await this.estimateGasPrice();
      
      // nonce 가져오기
      const nonce = await this.web3.eth.getTransactionCount(this.adminAccount.address, 'pending');
      
      // 트랜잭션 서명
      const signedTx = await this.adminAccount.signTransaction({
        to: this.gameAssetNFTContract.options.address,
        data: tx.encodeABI(),
        gas: gas,
        gasPrice: gasPrice,
        nonce: nonce
      });
      
      // 트랜잭션 전송
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      console.log(`✅ NFT 소각 완료: ${receipt.transactionHash}`);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        tokenId,
        previousOwner: owner
      };
    } catch (error) {
      console.error(`❌ NFT 소각 실패:`, error.message);
      throw new Error(`NFT burning failed: ${error.message}`);
    }
  }

  /**
   * NFT 소유권 확인
   * @param {number} tokenId - 토큰 ID
   * @param {string} address - 확인할 주소
   * @returns {Promise<boolean>} 소유 여부
   */
  async verifyOwnership(tokenId, address) {
    try {
      const owner = await this.gameAssetNFTContract.methods.ownerOf(tokenId).call();
      return owner.toLowerCase() === address.toLowerCase();
    } catch (error) {
      // 토큰이 존재하지 않거나 소각된 경우
      return false;
    }
  }

  /**
   * NFT 소유자 조회
   * @param {number} tokenId - 토큰 ID
   * @returns {Promise<string>} 소유자 주소
   */
  async getOwner(tokenId) {
    try {
      return await this.gameAssetNFTContract.methods.ownerOf(tokenId).call();
    } catch (error) {
      throw new Error(`Token ${tokenId} does not exist or has been burned`);
    }
  }

  /**
   * NFT 메타데이터 URI 조회
   * @param {number} tokenId - 토큰 ID
   * @returns {Promise<string>} 메타데이터 URI
   */
  async getTokenURI(tokenId) {
    try {
      return await this.gameAssetNFTContract.methods.tokenURI(tokenId).call();
    } catch (error) {
      throw new Error(`Failed to get token URI: ${error.message}`);
    }
  }

  /**
   * ERC-20 토큰 전송 (관리자 계정에서만 가능)
   * @param {string} fromAddress - 송신자 주소 (무시됨, 항상 관리자 계정 사용)
   * @param {string} toAddress - 수신자 주소
   * @param {string} amount - 전송 금액 (wei 단위)
   * @returns {Promise<Object>} 트랜잭션 영수증
   */
  async transferTokens(fromAddress, toAddress, amount) {
    try {
      console.log(`💰 토큰 전송: ${this.web3.utils.fromWei(amount, 'ether')} KQTP (관리자 → ${toAddress})`);
      console.log(`🔑 서명자: ${this.adminAccount.address}`);
      
      // 관리자 계정에서 transfer 사용
      const tx = this.gameTokenContract.methods.transfer(toAddress, amount);
      
      // 가스 추정
      const gas = await tx.estimateGas({ from: this.adminAccount.address });
      const gasPrice = await this.estimateGasPrice();
      
      // nonce 가져오기 (관리자 계정의 nonce)
      const nonce = await this.web3.eth.getTransactionCount(this.adminAccount.address, 'pending');
      
      console.log(`⛽ 가스: ${gas}, 가스 가격: ${gasPrice}, nonce: ${nonce}`);
      
      // 트랜잭션 서명 및 전송
      const signedTx = await this.adminAccount.signTransaction({
        to: this.gameTokenContract.options.address,
        data: tx.encodeABI(),
        gas: gas,
        gasPrice: gasPrice,
        nonce: nonce
      });
      
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      console.log(`✅ 토큰 전송 완료: ${receipt.transactionHash}`);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error(`❌ 토큰 전송 실패:`, error.message);
      throw new Error(`Token transfer failed: ${error.message}`);
    }
  }

  /**
   * ERC-20 토큰 잔액 조회
   * @param {string} address - 조회할 주소
   * @returns {Promise<string>} 토큰 잔액 (wei 단위)
   */
  async getTokenBalance(address) {
    try {
      const balance = await this.gameTokenContract.methods.balanceOf(address).call();
      return balance.toString();
    } catch (error) {
      throw new Error(`Failed to get token balance: ${error.message}`);
    }
  }

  /**
   * NFT 소유권 이전
   * @param {string} fromAddress - 발신자 주소
   * @param {string} toAddress - 수신자 주소
   * @param {number} tokenId - 토큰 ID
   * @returns {Promise<Object>} 트랜잭션 영수증
   */
  async transferNFT(fromAddress, toAddress, tokenId) {
    try {
      console.log(`🔄 NFT 전송: TokenID ${tokenId} (${fromAddress} → ${toAddress})`);
      
      // transferFrom 호출 (관리자 권한으로)
      const tx = this.gameAssetNFTContract.methods.transferFrom(fromAddress, toAddress, tokenId);
      
      const gas = await tx.estimateGas({ from: this.adminAccount.address });
      const gasPrice = await this.estimateGasPrice();
      
      // nonce 가져오기
      const nonce = await this.web3.eth.getTransactionCount(this.adminAccount.address, 'pending');
      
      console.log(`⛽ 가스: ${gas}, 가스 가격: ${gasPrice}, nonce: ${nonce}`);
      
      const signedTx = await this.adminAccount.signTransaction({
        to: this.gameAssetNFTContract.options.address,
        data: tx.encodeABI(),
        gas: gas,
        gasPrice: gasPrice,
        nonce: nonce
      });
      
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      console.log(`✅ NFT 전송 완료: ${receipt.transactionHash}`);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        tokenId,
        fromAddress,
        toAddress
      };
    } catch (error) {
      console.error(`❌ NFT 전송 실패:`, error.message);
      throw new Error(`NFT transfer failed: ${error.message}`);
    }
  }

  /**
   * 트랜잭션 상태 조회
   * @param {string} txHash - 트랜잭션 해시
   * @returns {Promise<Object>} 트랜잭션 상태
   */
  async getTransactionStatus(txHash) {
    try {
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return {
          status: 'pending',
          transactionHash: txHash
        };
      }
      
      const currentBlock = await this.web3.eth.getBlockNumber();
      const confirmations = Number(currentBlock) - Number(receipt.blockNumber);
      
      return {
        status: receipt.status ? 'confirmed' : 'failed',
        transactionHash: txHash,
        blockNumber: receipt.blockNumber.toString(),
        confirmations: confirmations,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      throw new Error(`Failed to get transaction status: ${error.message}`);
    }
  }

  /**
   * 다음 사용 가능한 토큰 ID 생성 (랜덤 방식)
   * @returns {Promise<number>} 토큰 ID
   */
  async generateTokenId() {
    const maxAttempts = 10;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // 랜덤 Token ID 생성 (1 ~ 999999999)
        const tokenId = Math.floor(Math.random() * 999999999) + 1;
        
        // 블록체인에서 이미 존재하는지 확인
        try {
          await this.gameAssetNFTContract.methods.ownerOf(tokenId).call();
          // 소유자가 있으면 이미 존재하는 Token ID
          console.log(`⚠️  Token ID ${tokenId} 이미 존재, 재시도...`);
          continue;
        } catch (error) {
          // ownerOf가 실패하면 존재하지 않는 Token ID (사용 가능)
          console.log(`🔢 새 Token ID 생성: ${tokenId}`);
          return tokenId;
        }
      } catch (error) {
        console.error(`Token ID 생성 시도 ${attempt + 1} 실패:`, error.message);
      }
    }
    
    // 모든 시도 실패 시 타임스탬프 기반 폴백
    console.warn('⚠️  폴백: 타임스탬프 기반 Token ID 사용');
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  /**
   * 메타 트랜잭션 실행 (EIP-2771)
   * @param {Object} request - ForwardRequest 객체
   * @param {string} signature - 사용자 서명
   * @returns {Promise<Object>} 트랜잭션 영수증
   */
  async executeMetaTransaction(request, signature) {
    try {
      console.log(`🔐 메타 트랜잭션 실행 시작`);
      console.log(`   From: ${request.from}`);
      console.log(`   To: ${request.to}`);
      console.log(`   Nonce: ${request.nonce}`);
      console.log(`   Signature: ${signature}`);
      
      // ForwardRequest 구조체를 Solidity가 기대하는 형식으로 변환
      const formattedRequest = {
        from: request.from,
        to: request.to,
        value: request.value.toString(),
        gas: request.gas.toString(),
        nonce: request.nonce.toString(),
        data: request.data
      };
      
      console.log(`   Formatted Request:`, JSON.stringify(formattedRequest, null, 2));
      
      // ethers.js로 서명 검증 (디버깅용)
      const ethers = require('ethers');
      const domain = {
        name: 'MinimalForwarder',
        version: '1.0.0',
        chainId: 11155111, // Sepolia
        verifyingContract: process.env.MINIMAL_FORWARDER_ADDRESS.toLowerCase()
      };
      
      console.log(`   🔍 서버 검증용 domain:`, JSON.stringify(domain, null, 2));
      
      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'data', type: 'bytes' }
        ]
      };
      
      try {
        const recoveredAddress = ethers.verifyTypedData(domain, types, formattedRequest, signature);
        console.log(`   🔍 복원된 서명자: ${recoveredAddress}`);
        console.log(`   🔍 예상 서명자: ${request.from}`);
        console.log(`   🔍 주소 일치: ${recoveredAddress.toLowerCase() === request.from.toLowerCase()}`);
      } catch (ethersError) {
        console.error(`   ❌ ethers.js 서명 검증 실패:`, ethersError.message);
      }
      
      // 컨트랙트로 서명 검증
      const isValid = await this.minimalForwarderContract.methods
        .verify(formattedRequest, signature)
        .call();
      
      console.log(`   📋 컨트랙트 서명 검증 결과: ${isValid}`);
      
      if (!isValid) {
        throw new Error('Invalid signature for meta-transaction');
      }
      
      console.log(`✅ 서명 검증 완료`);
      
      // 메타 트랜잭션 실행 (formatted request 사용)
      const tx = this.minimalForwarderContract.methods.execute(formattedRequest, signature);
      
      const gas = await tx.estimateGas({ from: this.adminAccount.address });
      const gasPrice = await this.estimateGasPrice();
      const nonce = await this.web3.eth.getTransactionCount(this.adminAccount.address, 'pending');
      
      console.log(`⛽ 가스: ${gas}, 가스 가격: ${gasPrice}, nonce: ${nonce}`);
      
      const signedTx = await this.adminAccount.signTransaction({
        to: this.minimalForwarderContract.options.address,
        data: tx.encodeABI(),
        gas: gas,
        gasPrice: gasPrice,
        nonce: nonce
      });
      
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      console.log(`✅ 메타 트랜잭션 실행 완료: ${receipt.transactionHash}`);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error(`❌ 메타 트랜잭션 실패:`, error.message);
      throw new Error(`Meta-transaction failed: ${error.message}`);
    }
  }

  /**
   * 사용자의 현재 nonce 조회 (메타 트랜잭션용)
   * @param {string} address - 사용자 주소
   * @returns {Promise<string>} nonce
   */
  async getMetaTxNonce(address) {
    try {
      const nonce = await this.minimalForwarderContract.methods.getNonce(address).call();
      return nonce.toString();
    } catch (error) {
      throw new Error(`Failed to get nonce: ${error.message}`);
    }
  }

  /**
   * 메타 트랜잭션으로 토큰 전송 (사용자 서명 필요)
   * @param {string} fromAddress - 송신자 주소 (사용자)
   * @param {string} toAddress - 수신자 주소
   * @param {string} amount - 전송 금액 (wei 단위)
   * @param {string} signature - 사용자 서명
   * @returns {Promise<Object>} 트랜잭션 영수증
   */
  async transferTokensViaMetaTx(fromAddress, toAddress, amount, signature) {
    try {
      console.log(`💰 메타 트랜잭션 토큰 전송: ${this.web3.utils.fromWei(amount, 'ether')} KQTP`);
      console.log(`   ${fromAddress} → ${toAddress}`);
      
      // transfer 함수 호출 데이터 생성
      const transferData = this.gameTokenContract.methods.transfer(toAddress, amount).encodeABI();
      
      // 현재 nonce 조회
      const nonce = await this.getMetaTxNonce(fromAddress);
      
      // ForwardRequest 생성
      const request = {
        from: fromAddress,
        to: this.gameTokenContract.options.address,
        value: '0',
        gas: '100000', // 충분한 가스 제공
        nonce: nonce,
        data: transferData
      };
      
      // 메타 트랜잭션 실행
      const result = await this.executeMetaTransaction(request, signature);
      
      console.log(`✅ 메타 트랜잭션 토큰 전송 완료`);
      
      return result;
    } catch (error) {
      console.error(`❌ 메타 트랜잭션 토큰 전송 실패:`, error.message);
      throw new Error(`Meta-transaction token transfer failed: ${error.message}`);
    }
  }

  /**
   * 블록체인에서 주소의 NFT를 스캔하여 DB와 동기화
   * @param {string} address - 스캔할 주소
   * @returns {Promise<Object>} 동기화 결과
   */
  async syncNFTsForAddress(address) {
    const db = require('../config/database');
    let syncedCount = 0;
    let updatedCount = 0;
    
    try {
      console.log(`🔄 NFT 동기화 시작: ${address}`);
      
      // 블록체인에서 NFT 개수 조회
      const balance = await this.gameAssetNFTContract.methods.balanceOf(address).call();
      
      if (balance === '0') {
        console.log(`ℹ️  NFT 없음: ${address}`);
        return { synced: 0, updated: 0, total: 0 };
      }
      
      // Transfer 이벤트로 Token ID 찾기 (컨트랙트 배포 블록부터)
      const CONTRACT_DEPLOY_BLOCK = BigInt(process.env.CONTRACT_DEPLOY_BLOCK || 9619320);
      const currentBlock = await this.web3.eth.getBlockNumber();
      const CHUNK_SIZE = 10000n;
      
      console.log(`📦 블록 스캔: ${CONTRACT_DEPLOY_BLOCK} ~ ${currentBlock} (청크: ${CHUNK_SIZE})`);
      
      // 청크 단위로 이벤트 조회
      const allEvents = [];
      for (let from = CONTRACT_DEPLOY_BLOCK; from <= currentBlock; from += CHUNK_SIZE) {
        const to = from + CHUNK_SIZE - 1n < currentBlock ? from + CHUNK_SIZE - 1n : currentBlock;
        
        try {
          // 필터 없이 모든 Transfer 이벤트 조회
          const events = await this.gameAssetNFTContract.getPastEvents('Transfer', {
            fromBlock: from.toString(),
            toBlock: to.toString()
          });
          
          // 대상 주소와 관련된 이벤트만 필터링
          const relevantEvents = events.filter(e => {
            const { from, to } = e.returnValues;
            return to.toLowerCase() === address.toLowerCase() || 
                   from.toLowerCase() === address.toLowerCase();
          });
          
          if (relevantEvents.length > 0) {
            allEvents.push(...relevantEvents);
          }
        } catch (error) {
          console.warn(`청크 스캔 실패 (${from}-${to}):`, error.message);
        }
      }
      
      const events = allEvents;
      
      const tokenIds = new Set(events.map(e => e.returnValues.tokenId));
      
      for (const tokenId of tokenIds) {
        try {
          // 현재 소유자 확인 (NFT가 소각되었을 수 있음)
          let owner;
          try {
            owner = await this.gameAssetNFTContract.methods.ownerOf(tokenId).call();
          } catch (ownerError) {
            // NFT가 존재하지 않거나 소각됨
            console.log(`Token ${tokenId}: 소각됨 또는 존재하지 않음`);
            
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
              updatedCount++;
            }
            
            continue;
          }
          
          if (owner.toLowerCase() !== address.toLowerCase()) {
            continue; // 다른 사람 소유
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
              updatedCount++;
            }
          } else {
            // 새로 추가
            let ipfsCID = null;
            try {
              const tokenURI = await this.gameAssetNFTContract.methods.tokenURI(tokenId).call();
              if (tokenURI.includes('ipfs://')) {
                ipfsCID = tokenURI.replace('ipfs://', '');
              } else if (tokenURI.includes('/ipfs/')) {
                ipfsCID = tokenURI.split('/ipfs/')[1];
              }
            } catch (e) {
              console.warn(`메타데이터 조회 실패 (Token ${tokenId}):`, e.message);
            }
            
            await db.insert('nft_records', {
              token_id: tokenId,
              owner_address: owner.toLowerCase(),
              status: 'active',
              ipfs_cid: ipfsCID,
              mint_tx_hash: null,
              created_at: new Date()
            });
            
            syncedCount++;
          }
        } catch (error) {
          console.error(`Token ${tokenId} 동기화 오류:`, error.message);
        }
      }
      
      console.log(`✅ 동기화 완료: 추가 ${syncedCount}개, 업데이트 ${updatedCount}개`);
      
      return {
        synced: syncedCount,
        updated: updatedCount,
        total: tokenIds.size
      };
      
    } catch (error) {
      console.error('NFT 동기화 오류:', error);
      throw error;
    }
  }
}

module.exports = BlockchainService;
