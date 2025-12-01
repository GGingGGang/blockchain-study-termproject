/**
 * Web3 헬퍼 - 블록체인 직접 조회 및 트랜잭션
 */
class Web3Helper {
    constructor() {
        this.provider = null;
        this.tokenContract = null;
        this.nftContract = null;
    }

    /**
     * 초기화
     */
    async initialize() {
        try {
            if (!metamask.isConnected) {
                throw new Error('MetaMask가 연결되어 있지 않습니다.');
            }

            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = this.provider.getSigner();

            // ERC-20 토큰 컨트랙트
            this.tokenContract = new ethers.Contract(
                CONFIG.CONTRACTS.gameToken,
                CONFIG.ABI.ERC20,
                signer
            );

            // ERC-721 NFT 컨트랙트
            this.nftContract = new ethers.Contract(
                CONFIG.CONTRACTS.gameAssetNFT,
                CONFIG.ABI.ERC721,
                signer
            );

            console.log('Web3Helper 초기화 완료');
        } catch (error) {
            console.error('Web3Helper 초기화 실패:', error);
            throw error;
        }
    }

    /**
     * ERC-20 토큰 잔액 조회
     */
    async getTokenBalance(address) {
        try {
            if (!this.tokenContract) {
                await this.initialize();
            }

            const balance = await this.tokenContract.balanceOf(address);
            return ethers.utils.formatEther(balance);
        } catch (error) {
            console.error('토큰 잔액 조회 실패:', error);
            return '0';
        }
    }

    /**
     * NFT 메타데이터 조회
     */
    async getNFTMetadata(tokenId) {
        try {
            if (!this.nftContract) {
                await this.initialize();
            }

            const tokenURI = await this.nftContract.tokenURI(tokenId);
            
            // IPFS URL을 HTTP URL로 변환
            const metadataUrl = Utils.getIPFSUrl(tokenURI);
            
            // 메타데이터 가져오기
            const response = await fetch(metadataUrl);
            const metadata = await response.json();
            
            return metadata;
        } catch (error) {
            console.error('NFT 메타데이터 조회 실패:', error);
            return null;
        }
    }

    /**
     * NFT 소유자 확인
     */
    async getNFTOwner(tokenId) {
        try {
            if (!this.nftContract) {
                await this.initialize();
            }

            const owner = await this.nftContract.ownerOf(tokenId);
            return owner;
        } catch (error) {
            console.error('NFT 소유자 조회 실패:', error);
            return null;
        }
    }

    /**
     * 토큰 사용 승인
     */
    async approveTokenSpending(spenderAddress, amount) {
        try {
            if (!this.tokenContract) {
                await this.initialize();
            }

            const amountWei = ethers.utils.parseEther(amount.toString());
            const tx = await this.tokenContract.approve(spenderAddress, amountWei);
            
            Utils.showNotification('토큰 승인 트랜잭션 전송 중...', 'info');
            
            const receipt = await tx.wait();
            
            Utils.showNotification('토큰 승인 완료!', 'success');
            
            return receipt;
        } catch (error) {
            console.error('토큰 승인 실패:', error);
            Utils.showNotification('토큰 승인 실패: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * NFT 전송 승인 (단일 NFT)
     */
    async approveNFT(tokenId, spenderAddress) {
        try {
            if (!this.nftContract) {
                await this.initialize();
            }

            const tx = await this.nftContract.approve(spenderAddress, tokenId);
            
            Utils.showNotification('NFT 승인 트랜잭션 전송 중...', 'info');
            
            const receipt = await tx.wait();
            
            Utils.showNotification('NFT 승인 완료!', 'success');
            
            return receipt;
        } catch (error) {
            console.error('NFT 승인 실패:', error);
            Utils.showNotification('NFT 승인 실패: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * NFT 전송 승인 (모든 NFT - setApprovalForAll)
     */
    async setApprovalForAll(operatorAddress, approved = true) {
        try {
            if (!this.nftContract) {
                await this.initialize();
            }

            const tx = await this.nftContract.setApprovalForAll(operatorAddress, approved);
            
            Utils.showNotification('NFT 승인 트랜잭션 전송 중...', 'info');
            
            const receipt = await tx.wait();
            
            Utils.showNotification('NFT 승인 완료! 이제 마켓에서 자유롭게 거래할 수 있습니다.', 'success');
            
            return receipt;
        } catch (error) {
            console.error('NFT 승인 실패:', error);
            
            if (error.code === 4001) {
                Utils.showNotification('승인이 취소되었습니다.', 'warning');
            } else {
                Utils.showNotification('NFT 승인 실패: ' + error.message, 'error');
            }
            
            throw error;
        }
    }

    /**
     * NFT 승인 상태 확인
     */
    async isApprovedForAll(ownerAddress, operatorAddress) {
        try {
            if (!this.nftContract) {
                await this.initialize();
            }

            return await this.nftContract.isApprovedForAll(ownerAddress, operatorAddress);
        } catch (error) {
            console.error('NFT 승인 상태 확인 실패:', error);
            return false;
        }
    }

    /**
     * 트랜잭션 상태 조회
     */
    async getTransactionStatus(txHash) {
        try {
            if (!this.provider) {
                await this.initialize();
            }

            const receipt = await this.provider.getTransactionReceipt(txHash);
            
            if (!receipt) {
                return {
                    status: 'pending',
                    confirmations: 0
                };
            }

            return {
                status: receipt.status === 1 ? 'confirmed' : 'failed',
                blockNumber: receipt.blockNumber,
                confirmations: receipt.confirmations
            };
        } catch (error) {
            console.error('트랜잭션 상태 조회 실패:', error);
            return {
                status: 'unknown',
                error: error.message
            };
        }
    }

    /**
     * 현재 가스 가격 조회
     */
    async getGasPrice() {
        try {
            if (!this.provider) {
                await this.initialize();
            }

            const gasPrice = await this.provider.getGasPrice();
            return ethers.utils.formatUnits(gasPrice, 'gwei');
        } catch (error) {
            console.error('가스 가격 조회 실패:', error);
            return '0';
        }
    }

    /**
     * ETH 잔액 조회
     */
    async getETHBalance(address) {
        try {
            if (!this.provider) {
                await this.initialize();
            }

            const balance = await this.provider.getBalance(address);
            return ethers.utils.formatEther(balance);
        } catch (error) {
            console.error('ETH 잔액 조회 실패:', error);
            return '0';
        }
    }

    /**
     * 블록 번호 조회
     */
    async getBlockNumber() {
        try {
            if (!this.provider) {
                await this.initialize();
            }

            return await this.provider.getBlockNumber();
        } catch (error) {
            console.error('블록 번호 조회 실패:', error);
            return 0;
        }
    }
}

// 전역 인스턴스 생성
const web3Helper = new Web3Helper();
