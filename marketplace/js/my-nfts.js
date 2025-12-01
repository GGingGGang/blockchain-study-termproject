/**
 * 내 NFT 페이지 (my-nfts.html) 스크립트
 */

let currentAddress = null;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('내 NFT 페이지 초기화...');

    // 지갑 연결 설정
    setupWalletConnection();

    // 모달 초기화
    ui.initModal('listingModal');

    // 새로고침 버튼
    setupRefreshButton();

    // 저장된 세션 확인 및 NFT 로드
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
                
                // NFT 목록 로드
                await loadMyNFTs();
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
        document.getElementById('myNFTsGrid').innerHTML = '';
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
            
            await loadMyNFTs();
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
    const refreshBtn = document.getElementById('refreshNFTs');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            if (currentAddress) {
                await loadMyNFTs();
            } else {
                Utils.showNotification('먼저 지갑을 연결해주세요.', 'warning');
            }
        });
    }
}

/**
 * 내 NFT 목록 로드
 */
async function loadMyNFTs() {
    try {
        Utils.showLoading('loadingSpinner');

        const response = await api.getMyNFTs(currentAddress);
        const container = document.getElementById('myNFTsGrid');

        if (response.nfts && response.nfts.length > 0) {
            // NFT 카드 렌더링
            response.nfts.forEach(nft => {
                const actions = [];
                
                if (nft.isListed) {
                    actions.push({
                        name: 'cancel',
                        label: '판매 취소',
                        type: 'danger',
                        handler: () => cancelListing(nft)
                    });
                } else {
                    actions.push({
                        name: 'list',
                        label: '판매 등록',
                        type: 'primary',
                        handler: () => showListingModal(nft)
                    });
                }
                
                const card = ui.renderNFTCard(nft, {
                    showStatus: true,
                    actions: actions
                });
                container.appendChild(card);
            });
        } else {
            const emptyState = document.getElementById('emptyState');
            if (emptyState) {
                emptyState.style.display = 'block';
            }
        }

        Utils.hideLoading('loadingSpinner');
    } catch (error) {
        console.error('NFT 목록 로드 실패:', error);
        Utils.hideLoading('loadingSpinner');
        Utils.showNotification('NFT 목록을 불러올 수 없습니다.', 'error');
    }
}

/**
 * 판매 등록 모달 표시
 */
function showListingModal(nft) {
    const modal = document.getElementById('listingModal');
    const preview = document.getElementById('listingNFTPreview');
    const form = document.getElementById('listingForm');

    // NFT 미리보기
    const imageUrl = nft.image ? Utils.getIPFSUrl(nft.image) : '/assets/placeholder.png';
    preview.innerHTML = `
        <div style="text-align: center; margin-bottom: 1rem;">
            <img src="${imageUrl}" alt="${nft.name}" style="max-width: 200px; border-radius: 0.5rem;" onerror="this.src='/assets/placeholder.png'">
            <h4>${nft.name}</h4>
            <p>Token ID: ${nft.tokenId}</p>
        </div>
    `;

    // 폼 제출 이벤트
    form.onsubmit = async (e) => {
        e.preventDefault();
        const price = document.getElementById('listingPrice').value;
        await createListing(nft.tokenId, price);
    };

    ui.openModal('listingModal');
}

/**
 * 판매 등록
 */
async function createListing(tokenId, price) {
    try {
        // 1단계: 승인 상태 확인
        Utils.showNotification('NFT 승인 상태 확인 중...', 'info');
        
        const approvalResponse = await api.checkApproval(currentAddress);
        
        if (!approvalResponse.isApproved) {
            // ETH 잔액 확인
            const ethBalance = await web3Helper.getETHBalance(currentAddress);
            
            if (parseFloat(ethBalance) < 0.001) {
                Utils.showNotification(
                    'Sepolia ETH가 부족합니다!\n\n승인 트랜잭션을 위해 최소 0.001 ETH가 필요합니다.\n\nFaucet에서 받으세요:\n• https://sepoliafaucet.com\n• https://faucet.quicknode.com/ethereum/sepolia',
                    'error'
                );
                return;
            }
            
            // 승인이 안 되어 있으면 승인 요청
            Utils.showNotification(
                '마켓플레이스가 NFT를 전송할 수 있도록 승인이 필요합니다.\nMetaMask에서 승인을 확인해주세요.',
                'info'
            );
            
            try {
                await web3Helper.setApprovalForAll(approvalResponse.operatorAddress, true);
            } catch (approvalError) {
                console.error('승인 실패:', approvalError);
                
                if (approvalError.code === 4001) {
                    Utils.showNotification('승인이 취소되었습니다. 판매 등록을 위해서는 승인이 필요합니다.', 'warning');
                } else if (approvalError.code === 'INSUFFICIENT_FUNDS') {
                    Utils.showNotification(
                        'Sepolia ETH가 부족합니다!\n\n가스비를 지불하기 위해 Sepolia ETH가 필요합니다.\nFaucet에서 받으세요: https://sepoliafaucet.com',
                        'error'
                    );
                } else {
                    Utils.showNotification('승인 실패: ' + approvalError.message, 'error');
                }
                return;
            }
        }
        
        // 2단계: 판매 등록
        Utils.showNotification('판매 등록 중...', 'info');

        const response = await api.createListing(tokenId, parseFloat(price));

        Utils.showNotification('판매 등록 완료!', 'success');
        ui.closeModal('listingModal');
        
        // NFT 목록 새로고침
        await loadMyNFTs();
    } catch (error) {
        console.error('판매 등록 실패:', error);
        Utils.showNotification('판매 등록 실패: ' + error.message, 'error');
    }
}

/**
 * 판매 취소
 */
async function cancelListing(nft) {
    if (!confirm(`"${nft.name}" 판매를 취소하시겠습니까?`)) {
        return;
    }

    try {
        Utils.showNotification('판매 취소 중...', 'info');

        await api.cancelListing(nft.listingId);

        Utils.showNotification('판매 취소 완료!', 'success');
        
        // NFT 목록 새로고침
        await loadMyNFTs();
    } catch (error) {
        console.error('판매 취소 실패:', error);
        Utils.showNotification('판매 취소 실패: ' + error.message, 'error');
    }
}
