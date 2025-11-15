/**
 * MetaMask 연동 및 EIP-4361 인증 처리
 */
class MetaMaskConnector {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.isConnected = false;
        
        console.log('MetaMaskConnector 초기화');
        console.log('window.ethereum 존재:', typeof window.ethereum !== 'undefined');
        console.log('ethers 존재:', typeof ethers !== 'undefined');
    }

    /**
     * MetaMask 설치 확인
     */
    isMetaMaskInstalled() {
        const installed = typeof window.ethereum !== 'undefined';
        console.log('MetaMask 설치 확인:', installed);
        return installed;
    }

    /**
     * 지갑 연결
     */
    async connect() {
        try {
            if (!this.isMetaMaskInstalled()) {
                throw new Error('MetaMask가 설치되어 있지 않습니다. https://metamask.io 에서 설치해주세요.');
            }

            // 계정 요청 (직접 window.ethereum 사용)
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            
            if (!accounts || accounts.length === 0) {
                throw new Error('계정을 가져올 수 없습니다.');
            }

            this.address = accounts[0];

            // Ethers.js provider 생성
            if (typeof ethers !== 'undefined') {
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
                this.signer = this.provider.getSigner();
            } else {
                console.warn('Ethers.js가 로드되지 않았습니다. 기본 기능만 사용합니다.');
            }

            // 네트워크 확인
            await this.checkNetwork();

            this.isConnected = true;
            console.log('MetaMask 연결 성공:', this.address);
            
            return this.address;
        } catch (error) {
            console.error('MetaMask 연결 실패:', error);
            throw error;
        }
    }

    /**
     * 네트워크 확인 및 전환
     */
    async checkNetwork() {
        try {
            // 현재 네트워크 확인
            const chainId = await window.ethereum.request({ 
                method: 'eth_chainId' 
            });
            
            const targetChainId = CONFIG.NETWORK.chainId;

            if (chainId !== targetChainId) {
                console.log(`네트워크 전환 요청... (현재: ${chainId}, 목표: ${targetChainId})`);
                await this.switchNetwork();
            } else {
                console.log('올바른 네트워크에 연결됨:', chainId);
            }
        } catch (error) {
            console.error('네트워크 확인 실패:', error);
            // 네트워크 확인 실패해도 계속 진행
            console.warn('네트워크 확인을 건너뜁니다.');
        }
    }

    /**
     * Sepolia 네트워크로 전환
     */
    async switchNetwork() {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: CONFIG.NETWORK.chainId }]
            });
        } catch (error) {
            // 네트워크가 추가되지 않은 경우
            if (error.code === 4902) {
                await this.addNetwork();
            } else {
                throw error;
            }
        }
    }

    /**
     * Sepolia 네트워크 추가
     */
    async addNetwork() {
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: CONFIG.NETWORK.chainId,
                    chainName: CONFIG.NETWORK.chainName,
                    rpcUrls: [CONFIG.NETWORK.rpcUrl],
                    blockExplorerUrls: [CONFIG.NETWORK.blockExplorerUrl],
                    nativeCurrency: {
                        name: 'Sepolia ETH',
                        symbol: 'ETH',
                        decimals: 18
                    }
                }]
            });
        } catch (error) {
            console.error('네트워크 추가 실패:', error);
            throw error;
        }
    }

    /**
     * 메시지 서명
     */
    async signMessage(message) {
        try {
            if (!this.signer) {
                throw new Error('지갑이 연결되어 있지 않습니다.');
            }

            const signature = await this.signer.signMessage(message);
            return signature;
        } catch (error) {
            console.error('서명 실패:', error);
            throw error;
        }
    }

    /**
     * EIP-4361 인증 플로우
     */
    async authenticate() {
        try {
            // 1. 지갑 연결
            if (!this.isConnected) {
                await this.connect();
            }

            // 2. 서버에서 인증 메시지 요청
            const messageResponse = await fetch(`${CONFIG.API_BASE_URL}/api/marketplace/auth/request-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ address: this.address })
            });

            if (!messageResponse.ok) {
                throw new Error('인증 메시지 요청 실패');
            }

            const { message, nonce, timestamp } = await messageResponse.json();

            // 3. MetaMask로 메시지 서명
            const signature = await this.signMessage(message);

            // 4. 서버에 서명 검증 요청
            const verifyResponse = await fetch(`${CONFIG.API_BASE_URL}/api/marketplace/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    address: this.address,
                    signature: signature,
                    message: message
                })
            });

            if (!verifyResponse.ok) {
                throw new Error('서명 검증 실패');
            }

            const { sessionToken, expiresIn } = await verifyResponse.json();

            // 5. 세션 토큰 저장
            localStorage.setItem(CONFIG.STORAGE_KEYS.sessionToken, sessionToken);
            localStorage.setItem(CONFIG.STORAGE_KEYS.walletAddress, this.address);

            console.log('인증 성공');
            return { sessionToken, address: this.address };
        } catch (error) {
            console.error('인증 실패:', error);
            throw error;
        }
    }

    /**
     * 현재 연결된 주소 반환
     */
    getAddress() {
        return this.address;
    }

    /**
     * 연결 상태 확인
     */
    getConnectionStatus() {
        return this.isConnected;
    }

    /**
     * 세션 토큰 가져오기
     */
    getSessionToken() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.sessionToken);
    }

    /**
     * 저장된 지갑 주소 가져오기
     */
    getSavedAddress() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.walletAddress);
    }

    /**
     * 연결 해제
     */
    disconnect() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.isConnected = false;
        
        // 로컬 스토리지 정리
        localStorage.removeItem(CONFIG.STORAGE_KEYS.sessionToken);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.walletAddress);
        
        console.log('MetaMask 연결 해제');
    }

    /**
     * 계정 변경 이벤트 리스너
     */
    onAccountsChanged(callback) {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnect();
                } else {
                    this.address = accounts[0];
                    callback(accounts[0]);
                }
            });
        }
    }

    /**
     * 네트워크 변경 이벤트 리스너
     */
    onChainChanged(callback) {
        if (window.ethereum) {
            window.ethereum.on('chainChanged', (chainId) => {
                callback(chainId);
                // 페이지 새로고침 권장
                window.location.reload();
            });
        }
    }
}

// 전역 인스턴스 생성
const metamask = new MetaMaskConnector();
