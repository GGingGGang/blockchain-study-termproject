/**
 * 게임 로그인 전용 스크립트
 * UE5 게임 클라이언트를 위한 간소화된 로그인 플로우
 */

class GameLogin {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.jwtToken = null;
        
        this.statusText = document.getElementById('statusText');
        this.connectBtn = document.getElementById('connectBtn');
        this.btnText = document.getElementById('btnText');
        this.addressDisplay = document.getElementById('addressDisplay');
        this.jwtDisplay = document.getElementById('jwtDisplay');
        this.copyJwtBtn = document.getElementById('copyJwtBtn');
        
        this.init();
    }

    init() {
        this.connectBtn.addEventListener('click', () => this.handleLogin());
        this.copyJwtBtn.addEventListener('click', () => this.copyJWT());
        
        // URL 파라미터에서 자동 로그인 확인
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('auto') === 'true') {
            setTimeout(() => this.handleLogin(), 500);
        }
    }

    updateStatus(message, type = 'normal') {
        this.statusText.textContent = message;
        this.statusText.className = 'status-text';
        if (type === 'success') {
            this.statusText.classList.add('success');
        } else if (type === 'error') {
            this.statusText.classList.add('error');
        }
    }

    setLoading(isLoading) {
        this.connectBtn.disabled = isLoading;
        if (isLoading) {
            this.btnText.innerHTML = '<span class="loading"></span>';
        } else {
            this.btnText.textContent = 'MetaMask 연결';
        }
    }

    async handleLogin() {
        try {
            this.setLoading(true);
            
            // 모바일 감지
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            
            if (isMobile) {
                // 모바일: MetaMask 앱으로 리다이렉트
                this.updateStatus('모바일 MetaMask로 연결 중...');
                const currentUrl = window.location.href;
                const metamaskDeepLink = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
                window.location.href = metamaskDeepLink;
                return;
            }
            
            // 1. MetaMask 확인 (PC)
            if (typeof window.ethereum === 'undefined') {
                // MetaMask 없으면 WalletConnect 사용
                this.updateStatus('WalletConnect로 연결 중... (QR 코드 스캔)');
                await this.connectWalletConnect();
                return;
            }
            
            this.updateStatus('MetaMask 연결 중...');
            
            // 2. 계정 연결
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            
            if (!accounts || accounts.length === 0) {
                throw new Error('계정을 가져올 수 없습니다.');
            }
            
            this.address = accounts[0];
            this.updateStatus('지갑 연결 성공! 서명 요청 중...');
            
            // 주소 표시
            this.addressDisplay.className = 'address-display';
            this.addressDisplay.textContent = `연결된 주소: ${this.address}`;
            this.addressDisplay.style.display = 'block';
            
            // 3. Ethers.js provider 생성
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            
            // 4. 서버에서 인증 메시지 요청
            this.updateStatus('인증 메시지 요청 중...');
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
            
            const { message } = await messageResponse.json();
            
            // 5. MetaMask로 메시지 서명
            this.updateStatus('MetaMask에서 서명을 확인해주세요...');
            const signature = await this.signer.signMessage(message);
            
            // 6. 서버에 서명 검증 요청
            this.updateStatus('서명 검증 중...');
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
            
            const { sessionToken } = await verifyResponse.json();
            this.jwtToken = sessionToken;
            
            // 7. JWT 표시
            this.jwtDisplay.className = 'jwt-display';
            this.jwtDisplay.textContent = `JWT: ${this.jwtToken}`;
            this.jwtDisplay.style.display = 'block';
            
            this.copyJwtBtn.style.display = 'block';
            
            this.updateStatus('✅ 로그인 성공! JWT 토큰이 발급되었습니다.', 'success');
            this.connectBtn.style.display = 'none';
            
            // 8. UE5로 JWT 전달 (URL 파라미터 방식)
            this.sendJWTToGame();
            
        } catch (error) {
            console.error('로그인 실패:', error);
            this.updateStatus(`❌ 로그인 실패: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    sendJWTToGame() {
        console.log('JWT 토큰:', this.jwtToken);
        console.log('지갑 주소:', this.address);
        
        // UE5 Web Browser Widget에서 실행 중인지 확인
        if (typeof ue !== 'undefined' && typeof ue.interface !== 'undefined') {
            console.log('✅ UE5 Web Browser 감지됨 - 자동 전송');
            
            try {
                // UE5 Blueprint 함수 호출
                ue.interface.receivejwt(this.jwtToken, this.address);
                
                this.updateStatus('✅ 로그인 완료! 게임으로 돌아갑니다...', 'success');
                
                // 1초 후 메시지 업데이트
                setTimeout(() => {
                    this.updateStatus('✅ 게임에서 로그인 처리 중...', 'success');
                }, 1000);
                
                return;
            } catch (err) {
                console.error('❌ UE5 함수 호출 실패:', err);
                this.updateStatus('❌ 게임 연결 실패. 파일 다운로드 방식으로 전환합니다.', 'error');
            }
        }
        
        // 폴백: 일반 브라우저에서 실행 중 (개발/테스트용)
        console.log('⚠️ 일반 브라우저 감지됨 - 파일 다운로드 방식');
        this.downloadJWTFile();
        this.updateStatus('✅ JWT 파일 다운로드됨. 게임 폴더에 넣어주세요.', 'success');
    }

    downloadJWTFile() {
        const data = {
            jwt: this.jwtToken,
            address: this.address,
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'game-login.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('JWT 파일 다운로드 완료');
    }

    async connectWalletConnect() {
        try {
            // WalletConnect v2 사용
            const WalletConnectProvider = window.WalletConnectProvider?.default;
            
            if (!WalletConnectProvider) {
                throw new Error('WalletConnect를 로드할 수 없습니다. 페이지를 새로고침하세요.');
            }
            
            const provider = new WalletConnectProvider({
                rpc: {
                    11155111: "https://eth-sepolia.g.alchemy.com/v2/demo" // Sepolia
                },
                qrcode: true, // QR 코드 자동 표시
            });
            
            // 연결
            await provider.enable();
            
            this.provider = new ethers.providers.Web3Provider(provider);
            this.signer = this.provider.getSigner();
            this.address = await this.signer.getAddress();
            
            this.updateStatus('WalletConnect 연결 성공! 서명 요청 중...');
            
            // 주소 표시
            this.addressDisplay.className = 'address-display';
            this.addressDisplay.textContent = `연결된 주소: ${this.address}`;
            this.addressDisplay.style.display = 'block';
            
            // 서명 진행
            await this.proceedWithSignature();
            
        } catch (error) {
            console.error('WalletConnect 연결 실패:', error);
            throw new Error('WalletConnect 연결 실패: ' + error.message);
        }
    }
    
    async proceedWithSignature() {
        // 4. 서버에서 인증 메시지 요청
        this.updateStatus('인증 메시지 요청 중...');
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
        
        const { message } = await messageResponse.json();
        
        // 5. 메시지 서명
        this.updateStatus('서명을 확인해주세요...');
        const signature = await this.signer.signMessage(message);
        
        // 6. 서버에 서명 검증 요청
        this.updateStatus('서명 검증 중...');
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
        
        const { sessionToken } = await verifyResponse.json();
        this.jwtToken = sessionToken;
        
        // 7. JWT 표시
        this.jwtDisplay.className = 'jwt-display';
        this.jwtDisplay.textContent = `JWT: ${this.jwtToken}`;
        this.jwtDisplay.style.display = 'block';
        
        this.copyJwtBtn.style.display = 'block';
        
        this.updateStatus('✅ 로그인 성공! JWT 토큰이 발급되었습니다.', 'success');
        this.connectBtn.style.display = 'none';
        
        // 8. UE5로 JWT 전달
        this.sendJWTToGame();
    }

    copyJWT() {
        if (!this.jwtToken) return;
        
        navigator.clipboard.writeText(this.jwtToken).then(() => {
            const originalText = this.copyJwtBtn.textContent;
            this.copyJwtBtn.textContent = '✅ 복사됨!';
            setTimeout(() => {
                this.copyJwtBtn.textContent = originalText;
            }, 2000);
        }).catch(err => {
            console.error('복사 실패:', err);
            alert('JWT 복사 실패');
        });
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    new GameLogin();
});
