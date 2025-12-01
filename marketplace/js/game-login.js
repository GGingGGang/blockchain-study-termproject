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
            
            // 1. MetaMask 확인
            if (typeof window.ethereum === 'undefined') {
                throw new Error('MetaMask가 설치되어 있지 않습니다.');
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
        // 방법 1: URL 파라미터로 전달 (UE5가 URL을 파싱)
        const gameCallbackUrl = `ue5game://login?jwt=${encodeURIComponent(this.jwtToken)}&address=${encodeURIComponent(this.address)}`;
        
        // 방법 2: 로컬 파일로 저장 (UE5가 파일을 읽음)
        // 브라우저에서는 직접 파일 쓰기 불가능하므로, 다운로드 방식 사용
        
        console.log('JWT 토큰:', this.jwtToken);
        console.log('게임 콜백 URL:', gameCallbackUrl);
        
        // 자동으로 파일 다운로드 (UE5가 특정 폴더를 모니터링)
        this.downloadJWTFile();
        
        // 3초 후 창 닫기 안내
        setTimeout(() => {
            this.updateStatus('✅ 로그인 완료! 이 창을 닫고 게임으로 돌아가세요.', 'success');
        }, 1000);
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
