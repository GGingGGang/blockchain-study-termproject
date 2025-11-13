/**
 * Web3 및 스마트 컨트랙트 설정
 */

const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');

// Web3 인스턴스 생성
const web3 = new Web3(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com');

// 관리자 계정 설정
const adminAccount = web3.eth.accounts.privateKeyToAccount(
  '0x' + process.env.PRIVATE_KEY
);
web3.eth.accounts.wallet.add(adminAccount);

// 컨트랙트 ABI 로드
function loadContractABI(contractName) {
  const artifactPath = path.join(__dirname, '../../artifacts/contracts', `${contractName}.sol`, `${contractName}.json`);
  
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Contract artifact not found: ${artifactPath}`);
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return artifact.abi;
}

// GameToken 컨트랙트 인스턴스
const gameTokenABI = loadContractABI('GameToken');
const gameTokenContract = new web3.eth.Contract(
  gameTokenABI,
  process.env.GAME_TOKEN_ADDRESS
);

// GameAssetNFT 컨트랙트 인스턴스
const gameAssetNFTABI = loadContractABI('GameAssetNFT');
const gameAssetNFTContract = new web3.eth.Contract(
  gameAssetNFTABI,
  process.env.GAME_ASSET_NFT_ADDRESS
);

/**
 * 가스 가격 추정
 * @returns {Promise<bigint>} 가스 가격
 */
async function estimateGasPrice() {
  const gasPrice = await web3.eth.getGasPrice();
  // 10% 추가 여유
  return gasPrice * 110n / 100n;
}

/**
 * 트랜잭션 전송 및 영수증 대기
 * @param {Object} tx - 트랜잭션 객체
 * @returns {Promise<Object>} 트랜잭션 영수증
 */
async function sendTransaction(tx) {
  const gas = await tx.estimateGas({ from: adminAccount.address });
  const gasPrice = await estimateGasPrice();
  
  const signedTx = await adminAccount.signTransaction({
    to: tx._parent._address,
    data: tx.encodeABI(),
    gas: gas,
    gasPrice: gasPrice
  });
  
  const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  return receipt;
}

/**
 * 트랜잭션 상태 조회
 * @param {string} txHash - 트랜잭션 해시
 * @returns {Promise<Object>} 트랜잭션 상태
 */
async function getTransactionStatus(txHash) {
  const receipt = await web3.eth.getTransactionReceipt(txHash);
  
  if (!receipt) {
    return { status: 'pending' };
  }
  
  const currentBlock = await web3.eth.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber;
  
  return {
    status: receipt.status ? 'confirmed' : 'failed',
    blockNumber: receipt.blockNumber,
    confirmations: confirmations,
    gasUsed: receipt.gasUsed
  };
}

module.exports = {
  web3,
  adminAccount,
  gameTokenContract,
  gameAssetNFTContract,
  estimateGasPrice,
  sendTransaction,
  getTransactionStatus
};
