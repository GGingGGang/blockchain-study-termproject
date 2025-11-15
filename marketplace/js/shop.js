/**
 * 서버 상점 페이지 (shop.html) 스크립트
 */

let currentAddress = null;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('서버 상점 페이지 초기화...');

    // 지갑 연결 설정
    setupWalletConnection();

    // 모달 초기화
    ui.initModal('purchaseModal');

    // 새로고침 버튼 설정
    setupRefreshButton();

    // 저장된 세션 확인
    await checkSavedSession();

    // 상점 아이템 로드
    await loadShopItems();
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
        } catch (error) {
            console.error('세션 복원 실패:', error);
            metamask.disconnect();
        }
    }
}

/**
 * 새로고침 버튼 설정
 */
function setupRefreshButton() {
    const refreshBtn = document.getElementById('refreshShop');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadShopItems();
            Utils.showNotification('상점 아이템을 새로고침했습니다.', 'success');
        });
    }
}

/**
 * 상점 아이템 로드
 */
async function loadShopItems() {
    try {
        Utils.showLoading('loadingSpinner');

        const response = await api.getShopItems();
        const container = document.getElementById('shopGrid');

        if (response.items && response.items.length > 0) {
            // 상점 아이템 카드 렌더링
            ui.renderShopItems(container, response.items, showPurchaseModal);
        } else {
            const emptyState = document.getElementById('emptyState');
            if (emptyState) {
                emptyState.style.display = 'block';
            }
        }

        Utils.hideLoading('loadingSpinner');
    } catch (error) {
        console.error('상점 아이템 로드 실패:', error);
        Utils.hideLoading('loadingSpinner');
        Utils.showNotification('상점 아이템을 불러올 수 없습니다.', 'error');
    }
}

/**
 * 구매 확인 모달 표시
 */
async function showPurchaseModal(item) {
    if (!currentAddress) {
        Utils.showNotification('먼저 지갑을 연결해주세요.', 'warning');
        return;
    }

    const modal = document.getElementById('purchaseModal');
    const preview = document.getElementById('purchaseItemPreview');
    const itemPrice = document.getElementById('itemPrice');
    const itemStock = document.getElementById('itemStock');
    const myBalance = document.getElementById('myBalance');
    const confirmBtn = document.getElementById('confirmPurchase');
    const cancelBtn = document.getElementById('cancelPurchase');

    // 아이템 미리보기
    const imageUrl = item.image_url || '/assets/placeholder.png';
    preview.innerHTML = `
        <div style="text-align: center; margin-bottom: 1rem;">
            <img src="${imageUrl}" alt="${item.name}" style="max-width: 200px; border-radius: 0.5rem;" onerror="this.src='/assets/placeholder.png'">
            <h4>${item.name}</h4>
            <p>${item.description}</p>
        </div>
    `;

    // 정보 표시
    itemPrice.textContent = item.price;
    itemStock.textContent = item.stock;

    // 내 잔액 조회
    const balance = await web3Helper.getTokenBalance(currentAddress);
    myBalance.textContent = parseFloat(balance).toFixed(2);

    // 잔액 부족 확인
    if (parseFloat(balance) < parseFloat(item.price)) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = '잔액 부족';
        Utils.showNotification('토큰 잔액이 부족합니다.', 'warning');
    } else if (item.stock <= 0) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = '품절';
    } else {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '구매 확인';
    }

    // 구매 확인 버튼
    confirmBtn.onclick = async () => {
        await purchaseShopItem(item);
    };

    // 취소 버튼
    cancelBtn.onclick = () => {
        ui.closeModal('purchaseModal');
    };

    ui.openModal('purchaseModal');
}

/**
 * 상점 아이템 구매
 */
async function purchaseShopItem(item) {
    try {
        Utils.showNotification('구매 처리 중... (토큰 결제 + NFT 민팅)', 'info');

        const response = await api.purchaseShopItem(item.itemId, currentAddress);

        Utils.showNotification('구매 완료! NFT가 발급되었습니다.', 'success');
        ui.closeModal('purchaseModal');
        
        // 상점 아이템 목록 새로고침 (재고 업데이트)
        setTimeout(async () => {
            await loadShopItems();
        }, 1000);

        // NFT 정보 표시
        if (response.tokenId) {
            setTimeout(() => {
                Utils.showNotification(
                    `발급된 NFT Token ID: ${response.tokenId}`,
                    'info'
                );
            }, 2000);
        }

        // 트랜잭션 링크 표시
        if (response.txHash) {
            setTimeout(() => {
                Utils.showNotification(
                    `트랜잭션: ${Utils.shortenAddress(response.txHash)}`,
                    'info'
                );
            }, 4000);
        }
    } catch (error) {
        console.error('구매 실패:', error);
        Utils.showNotification('구매 실패: ' + error.message, 'error');
    }
}
