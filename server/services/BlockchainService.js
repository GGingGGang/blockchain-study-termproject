/**
 * 블록체인 서비스
 * 스마트 컨트랙트와의 상호작용 처리
 */

const { web3, adminAccount, gameTokenContract, gameAssetNFTContract } = require('../config/web3');

class BlockchainService {
  constructor() {
    this.web3 = web3;
    this.adminAccount = adminAccount;
    this.gameTokenContract = gameTokenContract;
    this.gameAssetNFTContract = gameAssetNFTContract;
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
   * NFT 민팅
   * @param {string} toAddress - 수신자 주소
   * @param {number} tokenId - 토큰 ID
   * @param {string} tokenURI - IPFS 메타데이터 URI
   * @returns {Promise<Object>} 트랜잭션 영수증
   */
  async mintNFT(toAddress, tokenId, tokenURI) {
    try {
      console.log(`🔨 NFT 민팅 시작: TokenID ${tokenId} → ${toAddress}`);
      
      // 트랜잭션 준비
      const tx = this.gameAssetNFTContract.methods.mint(toAddress, tokenId, tokenURI);
      
      // 가스 추정
      const gas = await tx.estimateGas({ from: this.adminAccount.address });
      const gasPrice = await this.estimateGasPrice();
      
      // nonce 가져오기
      const nonce = await this.web3.eth.getTransactionCount(this.adminAccount.address, 'pending');
      
      console.log(`⛽ 가스: ${gas}, 가스 가격: ${gasPrice}, nonce: ${nonce}`);
      
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
      
      console.log(`✅ NFT 민팅 완료: ${receipt.transactionHash}`);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
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
   * ERC-20 토큰 전송
   * @param {string} fromAddress - 발신자 주소
   * @param {string} toAddress - 수신자 주소
   * @param {string} amount - 전송 금액 (wei 단위)
   * @returns {Promise<Object>} 트랜잭션 영수증
   */
  async transferTokens(fromAddress, toAddress, amount) {
    try {
      console.log(`💰 토큰 전송: ${amount} KQTP (${fromAddress} → ${toAddress})`);
      
      // 관리자 계정으로 전송 (실제로는 사용자가 서명해야 함)
      const tx = this.gameTokenContract.methods.transfer(toAddress, amount);
      
      const gas = await tx.estimateGas({ from: this.adminAccount.address });
      const gasPrice = await this.estimateGasPrice();
      
      const signedTx = await this.adminAccount.signTransaction({
        to: this.gameTokenContract.options.address,
        data: tx.encodeABI(),
        gas: gas,
        gasPrice: gasPrice
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
      
      const signedTx = await this.adminAccount.signTransaction({
        to: this.gameAssetNFTContract.options.address,
        data: tx.encodeABI(),
        gas: gas,
        gasPrice: gasPrice
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
   * 다음 사용 가능한 토큰 ID 생성
   * @returns {Promise<number>} 토큰 ID
   */
  async generateTokenId() {
    // 간단한 구현: 현재 타임스탬프 + 랜덤
    return Date.now() + Math.floor(Math.random() * 1000);
  }
}

module.exports = BlockchainService;
