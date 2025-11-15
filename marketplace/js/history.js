/**
 * 거래 내역 페이지 (history.html) 스크립트
 */

let currentAddress = null;
let currentFilter = 'all';

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('거래 내역 페이지 초기화...');

    // 지갑 연결 설정
    setupWalletConnection();

    // 필터 및 새로고침 버튼
    setupControls();

    // 저장된 세션 확인
    await checkSavedSession();
});

/**
 * 지갑 연결 설정
 */
function setupWalletConnection() {
    const connectBtn = document.getElementById('connectWallet');
    
    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            try {
                Utils.showNotification('지갑 연결 중...', 'info');
                
                const { sessionToken, address } = await metamask.authenticate();
                currentAddress = address;
                
                const balance = await web3Helper.getTokenBalance(address);
                ui.updateWalletInfo(address, balance);
                
                Utils.showNotification('지갑 연결 성공!', 'success');
                
                // 거래 내역 로드
                await loadHistory();
            } catch (error) {
                console.error('지갑 연결 실패:', error);
                Utils.showNotification('지갑 연결 실패: ' + error.message, 'error');
            }
        });
    }

    metamask.onAccountsChanged(async (newAddress) => {
        console.log('계정 변경됨:', newAddress);
        Utils.showNotification('계정이 변경되었습니다. 다시 로그인해주세요.', 'info');
        metamask.disconnect();
        ui.resetWalletUI();
        currentAddress = null;
        document.getElementById('historyTableBody').innerHTML = '';
    });
}

/**
 * 저장된 세션 확인
 */
async function checkSavedSession() {
    const savedToken = metamask.getSessionToken();
    const savedAddress = metamask.getSavedAddress();

    if (savedToken && savedAddress) {
        try {
            await metamask.connect();
            currentAddress = savedAddress;
            
            const balance = await web3Helper.getTokenBalance(savedAddress);
            ui.updateWalletInfo(savedAddress, balance);
            
            await loadHistory();
        } catch (error) {
            console.error('세션 복원 실패:', error);
            metamask.disconnect();
        }
    }
}

/**
 * 컨트롤 설정
 */
function setupControls() {
    // 필터 선택
    const filterType = document.getElementById('filterType');
    if (filterType) {
        filterType.addEventListener('change', async (e) => {
            currentFilter = e.target.value;
            if (currentAddress) {
                await loadHistory();
            }
        });
    }

    // 새로고침 버튼
    const refreshBtn = document.getElementById('refreshHistory');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            if (currentAddress) {
                await loadHistory();
            } else {
                Utils.showNotification('먼저 지갑을 연결해주세요.', 'warning');
            }
        });
    }
}

/**
 * 거래 내역 로드
 */
async function loadHistory() {
    try {
        Utils.showLoading('loadingSpinner');

        const filters = {};
        if (currentFilter !== 'all') {
            filters.type = currentFilter;
        }

        const response = await api.getPurchaseHistory(currentAddress, filters);
        const tbody = document.getElementById('historyTableBody');

        if (response.history && response.history.length > 0) {
            // 거래 내역 렌더링
            ui.renderHistory(tbody, response.history);
        } else {
            const emptyState = document.getElementById('emptyState');
            if (emptyState) {
                emptyState.style.display = 'block';
            }
            tbody.innerHTML = '';
        }

        Utils.hideLoading('loadingSpinner');
    } catch (error) {
        console.error('거래 내역 로드 실패:', error);
        Utils.hideLoading('loadingSpinner');
        Utils.showNotification('거래 내역을 불러올 수 없습니다.', 'error');
    }
}
