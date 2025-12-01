/**
 * 마켓 페이지 (market.html) 스크립트
 */

let currentAddress = null;
let currentSort = 'latest';

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('마켓 페이지 초기화...');

    // 지갑 연결 설정
    setupWalletConnection();

    // 모달 초기화
    ui.initModal('purchaseModal');

    // 정렬 및 새로고침 버튼
    setupControls();

    // 저장된 세션 확인
    await checkSavedSession();

    // 판매 목록 로드
    await loadMarketListings();
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
 * 컨트롤 설정
 */
function setupControls() {
    // 정렬 선택
    const sortBy = document.getElementById('sortBy');
    if (sortBy) {
        sortBy.addEventListener('change', async (e) => {
            currentSort = e.target.value;
            await loadMarketListings();
        });
    }

    // 새로고침 버튼
    const refreshBtn = document.getElementById('refreshMarket');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadMarketListings();
        });
    }
}

/**
 * 판매 목록 로드
 */
async function loadMarketListings() {
    try {
        Utils.showLoading('loadingSpinner');

        const response = await api.getMarketListings({
            sortBy: currentSort
        });

        const container = document.getElementById('marketGrid');

        if (response.listings && response.listings.length > 0) {
            // NFT 카드 렌더링
            ui.renderNFTList(container, response.listings.map(listing => ({
                tokenId: listing.tokenId,
                name: listing.nftMetadata?.name || `NFT #${listing.tokenId}`,
                description: listing.nftMetadata?.description || '',
                image: listing.nftMetadata?.image || '',
                attributes: listing.nftMetadata?.attributes || [],
                price: listing.price,
                seller: listing.seller,
                listingId: listing.listingId
            })), {
                showPrice: true,
                actions: [{
                    name: 'buy',
                    label: '구매하기',
                    type: 'primary',
                    handler: (nft) => showPurchaseModal(nft)
                }]
            });
        } else {
            const emptyState = document.getElementById('emptyState');
            if (emptyState) {
                emptyState.style.display = 'block';
            }
        }

        Utils.hideLoading('loadingSpinner');
    } catch (error) {
        console.error('판매 목록 로드 실패:', error);
        Utils.hideLoading('loadingSpinner');
        Utils.showNotification('판매 목록을 불러올 수 없습니다.', 'error');
    }
}

/**
 * 구매 확인 모달 표시
 */
async function showPurchaseModal(nft) {
    if (!currentAddress) {
        Utils.showNotification('먼저 지갑을 연결해주세요.', 'warning');
        return;
    }

    const modal = document.getElementById('purchaseModal');
    const preview = document.getElementById('purchaseNFTPreview');
    const sellerAddress = document.getElementById('sellerAddress');
    const purchasePrice = document.getElementById('purchasePrice');
    const myBalance = document.getElementById('myBalance');
    const confirmBtn = document.getElementById('confirmPurchase');
    const cancelBtn = document.getElementById('cancelPurchase');

    // NFT 미리보기
    const imageUrl = nft.image ? Utils.getIPFSUrl(nft.image) : '/assets/placeholder.png';
    preview.innerHTML = `
        <div style="text-align: center; margin-bottom: 1rem;">
            <img src="${imageUrl}" alt="${nft.name}" style="max-width: 200px; border-radius: 0.5rem;" onerror="this.src='/assets/placeholder.png'">
            <h4>${nft.name}</h4>
            <p>Token ID: ${nft.tokenId}</p>
        </div>
    `;

    // 정보 표시
    sellerAddress.textContent = Utils.shortenAddress(nft.seller);
    purchasePrice.textContent = nft.price;

    // 내 잔액 조회
    const balance = await web3Helper.getTokenBalance(currentAddress);
    myBalance.textContent = parseFloat(balance).toFixed(2);

    // 잔액 부족 확인
    if (parseFloat(balance) < parseFloat(nft.price)) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = '잔액 부족';
        Utils.showNotification('토큰 잔액이 부족합니다.', 'warning');
    } else {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '구매 확인';
    }

    // 구매 확인 버튼
    confirmBtn.onclick = async () => {
        await purchaseNFT(nft);
    };

    // 취소 버튼
    cancelBtn.onclick = () => {
        ui.closeModal('purchaseModal');
    };

    ui.openModal('purchaseModal');
}

/**
 * NFT 구매 (메타 트랜잭션 사용)
 */
async function purchaseNFT(nft) {
    try {
        Utils.showNotification('메타 트랜잭션 준비 중...', 'info');

        // 1단계: 메타 트랜잭션 준비 (서명 데이터 생성)
        const prepareData = await api.prepareMetaTransaction(
            currentAddress,
            nft.seller,
            nft.price
        );

        console.log('메타 트랜잭션 데이터:', prepareData);
        console.log('서명할 domain:', prepareData.domain);
        console.log('서명할 message:', prepareData.request);

        // 2단계: EIP-712 서명 요청
        Utils.showNotification('MetaMask에서 서명을 확인해주세요...', 'info');
        
        const typedData = {
            domain: prepareData.domain,
            types: prepareData.types,
            primaryType: prepareData.primaryType,
            message: prepareData.request
        };
        
        console.log('전체 typedData:', JSON.stringify(typedData, null, 2));
        
        const signature = await ethereum.request({
            method: 'eth_signTypedData_v4',
            params: [
                currentAddress,
                JSON.stringify(typedData)
            ]
        });

        console.log('서명 완료:', signature);

        // 3단계: 구매 요청 (서명 및 request 객체 포함)
        Utils.showNotification('구매 처리 중...', 'info');
        
        const response = await api.purchaseNFT(
            nft.listingId, 
            currentAddress,
            signature,
            prepareData.request
        );

        Utils.showNotification('구매 완료!', 'success');
        ui.closeModal('purchaseModal');
        
        // 판매 목록 새로고침
        await loadMarketListings();

        // 트랜잭션 링크 표시
        if (response.paymentTxHash) {
            setTimeout(() => {
                Utils.showNotification(
                    `결제 트랜잭션: ${Utils.shortenAddress(response.paymentTxHash)}`,
                    'info'
                );
            }, 2000);
        }
        
        if (response.transferTxHash) {
            setTimeout(() => {
                Utils.showNotification(
                    `NFT 전송: ${Utils.shortenAddress(response.transferTxHash)}`,
                    'info'
                );
            }, 3000);
        }
    } catch (error) {
        console.error('구매 실패:', error);
        
        // 사용자가 서명을 거부한 경우
        if (error.code === 4001) {
            Utils.showNotification('서명이 취소되었습니다.', 'warning');
        } else {
            Utils.showNotification('구매 실패: ' + error.message, 'error');
        }
    }
}
