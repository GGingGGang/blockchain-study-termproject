/**
 * 홈페이지 (index.html) 스크립트
 */

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('홈페이지 초기화...');

    // 닉네임 모달 초기화
    initNicknameModal();

    // 지갑 연결 버튼 이벤트
    setupWalletConnection();

    // 닉네임 버튼 이벤트
    setupNicknameButton();

    // 저장된 세션 확인
    await checkSavedSession();

    // 최신 NFT 목록 로드
    await loadFeaturedNFTs();

    // 통계 로드
    await loadStats();
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
                
                // MetaMask 연결 및 인증
                const { sessionToken, address } = await metamask.authenticate();
                
                // 토큰 잔액 조회
                const balance = await web3Helper.getTokenBalance(address);
                
                // UI 업데이트
                ui.updateWalletInfo(address, balance);
                
                // 닉네임 로드 및 표시
                await loadAndDisplayNickname(address);
                
                // 닉네임 버튼 표시
                const nicknameBtn = document.getElementById('nicknameBtn');
                if (nicknameBtn) nicknameBtn.style.display = 'inline-block';
                
                Utils.showNotification('지갑 연결 성공!', 'success');
            } catch (error) {
                console.error('지갑 연결 실패:', error);
                Utils.showNotification('지갑 연결 실패: ' + error.message, 'error');
            }
        });
    }

    // 계정 변경 이벤트
    metamask.onAccountsChanged(async (newAddress) => {
        console.log('계정 변경됨:', newAddress);
        Utils.showNotification('계정이 변경되었습니다. 다시 로그인해주세요.', 'info');
        metamask.disconnect();
        ui.resetWalletUI();
    });

    // 네트워크 변경 이벤트
    metamask.onChainChanged((chainId) => {
        console.log('네트워크 변경됨:', chainId);
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
            // 지갑 재연결
            await metamask.connect();
            
            // 토큰 잔액 조회
            const balance = await web3Helper.getTokenBalance(savedAddress);
            
            // UI 업데이트
            ui.updateWalletInfo(savedAddress, balance);
            
            // 닉네임 로드 및 표시
            await loadAndDisplayNickname(savedAddress);
            
            // 닉네임 버튼 표시
            const nicknameBtn = document.getElementById('nicknameBtn');
            if (nicknameBtn) nicknameBtn.style.display = 'inline-block';
            
            console.log('세션 복원 완료');
        } catch (error) {
            console.error('세션 복원 실패:', error);
            metamask.disconnect();
        }
    }
}

/**
 * 최신 등록 NFT 로드
 */
async function loadFeaturedNFTs() {
    try {
        Utils.showLoading('loadingSpinner');

        // 최신 판매 목록 조회 (최대 6개)
        const response = await api.getMarketListings({
            sortBy: 'latest',
            limit: 6
        });

        const container = document.getElementById('featuredNFTs');
        
        if (response.listings && response.listings.length > 0) {
            // NFT 카드 렌더링
            ui.renderNFTList(container, response.listings.map(listing => ({
                tokenId: listing.tokenId,
                name: listing.nftMetadata?.name || `NFT #${listing.tokenId}`,
                description: listing.nftMetadata?.description || '',
                image: listing.nftMetadata?.image || '',
                attributes: listing.nftMetadata?.attributes || [],
                price: listing.price
            })), {
                showPrice: true,
                onClick: (nft) => {
                    // 마켓 페이지로 이동
                    window.location.href = 'market.html';
                }
            });
        } else {
            container.innerHTML = '<p class="empty-state">현재 판매 중인 NFT가 없습니다.</p>';
        }

        Utils.hideLoading('loadingSpinner');
    } catch (error) {
        console.error('NFT 목록 로드 실패:', error);
        Utils.hideLoading('loadingSpinner');
        Utils.showNotification('NFT 목록을 불러올 수 없습니다.', 'error');
    }
}

/**
 * 닉네임 버튼 설정
 */
function setupNicknameButton() {
    const nicknameBtn = document.getElementById('nicknameBtn');
    
    if (nicknameBtn) {
        nicknameBtn.addEventListener('click', () => {
            const savedAddress = metamask.getSavedAddress();
            if (savedAddress) {
                openNicknameModal(savedAddress);
            } else {
                Utils.showNotification('먼저 지갑을 연결해주세요.', 'warning');
            }
        });
    }
}

/**
 * 통계 로드
 */
async function loadStats() {
    try {
        const stats = await api.getMarketStats();

        // 통계 업데이트
        const totalVolume = document.getElementById('totalVolume');
        const activeListings = document.getElementById('activeListings');
        const totalNFTs = document.getElementById('totalNFTs');

        if (totalVolume) totalVolume.textContent = stats.totalVolume;
        if (activeListings) activeListings.textContent = stats.activeListings;
        if (totalNFTs) totalNFTs.textContent = stats.totalNFTs;
    } catch (error) {
        console.error('통계 로드 실패:', error);
    }
}
