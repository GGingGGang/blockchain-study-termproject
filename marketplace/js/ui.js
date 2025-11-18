/**
 * UI 렌더링 모듈
 */
class MarketplaceUI {
    /**
     * NFT 카드 렌더링
     */
    renderNFTCard(nft, options = {}) {
        const card = document.createElement('div');
        card.className = 'nft-card';
        card.dataset.tokenId = nft.tokenId;

        // 이미지 URL 처리
        const imageUrl = nft.image ? Utils.getIPFSUrl(nft.image) : '/assets/placeholder.png';

        // 가격 표시
        let priceHTML = '';
        if (options.showPrice && nft.price) {
            priceHTML = `<div class="nft-price">${nft.price} KQTP</div>`;
        }

        // 상태 표시
        let statusHTML = '';
        if (options.showStatus) {
            const statusClass = nft.isListed ? 'listed' : 'owned';
            const statusText = nft.isListed ? '판매중' : '보유중';
            statusHTML = `<span class="nft-status ${statusClass}">${statusText}</span>`;
        }

        // 속성 표시
        let attributesHTML = '';
        if (nft.attributes && nft.attributes.length > 0) {
            const attrs = nft.attributes.slice(0, 3).map(attr => 
                `<span class="attribute-badge">${attr.trait_type}: ${attr.value}</span>`
            ).join('');
            attributesHTML = `<div class="nft-card-attributes">${attrs}</div>`;
        }

        // 액션 버튼
        let actionsHTML = '';
        if (options.actions && options.actions.length > 0) {
            const buttons = options.actions.map(action => 
                `<button class="btn btn-${action.type}" data-action="${action.name}">${action.label}</button>`
            ).join('');
            actionsHTML = `<div class="nft-card-actions">${buttons}</div>`;
        }

        card.innerHTML = `
            <img src="${imageUrl}" alt="${nft.name}" class="nft-card-image" onerror="this.src='/assets/placeholder.png'">
            <div class="nft-card-content">
                <h3 class="nft-card-title">${nft.name || 'Unnamed NFT'}</h3>
                <p class="nft-card-description">${nft.description || ''}</p>
                ${attributesHTML}
                <div class="nft-card-footer">
                    <div>
                        ${priceHTML}
                        <div class="nft-token-id">Token ID: ${nft.tokenId}</div>
                    </div>
                    ${statusHTML}
                </div>
                ${actionsHTML}
            </div>
        `;

        // 이벤트 리스너 추가
        if (options.onClick) {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    options.onClick(nft);
                }
            });
        }

        // 액션 버튼 이벤트
        if (options.actions) {
            options.actions.forEach(action => {
                const btn = card.querySelector(`[data-action="${action.name}"]`);
                if (btn && action.handler) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        action.handler(nft);
                    });
                }
            });
        }

        return card;
    }

    /**
     * 상점 아이템 카드 렌더링
     */
    renderShopItemCard(item, onPurchase) {
        const card = document.createElement('div');
        card.className = 'shop-item-card';
        card.dataset.itemId = item.itemId;

        const imageUrl = item.image || '/assets/placeholder.png';
        const stockClass = item.stock < 10 ? 'low' : '';

        card.innerHTML = `
            <img src="${imageUrl}" alt="${item.name}" class="shop-item-image" onerror="this.src='/assets/placeholder.png'">
            <div class="shop-item-content">
                <div class="shop-item-header">
                    <h3 class="shop-item-title">${item.name}</h3>
                    <span class="shop-item-stock ${stockClass}">재고: ${item.stock}</span>
                </div>
                <p class="shop-item-description">${item.description}</p>
                <div class="shop-item-footer">
                    <div class="shop-item-price">${item.price} KQTP</div>
                    <button class="btn btn-primary" ${item.stock <= 0 ? 'disabled' : ''}>
                        ${item.stock <= 0 ? '품절' : '구매하기'}
                    </button>
                </div>
            </div>
        `;

        // 구매 버튼 이벤트
        const purchaseBtn = card.querySelector('.btn');
        if (purchaseBtn && item.stock > 0) {
            purchaseBtn.addEventListener('click', () => onPurchase(item));
        }

        return card;
    }

    /**
     * 거래 내역 행 렌더링
     */
    renderHistoryRow(record) {
        const row = document.createElement('tr');
        
        const typeClass = record.type === 'buy' ? 'buy' : 'sell';
        const typeText = record.type === 'buy' ? '구매' : '판매';
        
        row.innerHTML = `
            <td>${Utils.formatDate(record.timestamp)}</td>
            <td><span class="history-type ${typeClass}">${typeText}</span></td>
            <td>#${record.tokenId}</td>
            <td>${record.price} KQTP</td>
            <td>${Utils.shortenAddress(record.counterparty)}</td>
            <td><a href="${Utils.getTxLink(record.txHash)}" target="_blank" class="tx-link">보기</a></td>
        `;

        return row;
    }

    /**
     * 지갑 정보 업데이트
     */
    updateWalletInfo(address, balance) {
        const walletInfo = document.getElementById('walletInfo');
        const walletAddress = document.getElementById('walletAddress');
        const tokenBalance = document.getElementById('tokenBalance');
        const connectBtn = document.getElementById('connectWallet');
        const addTokenBtn = document.getElementById('addTokenBtn');

        if (address && walletInfo && walletAddress && tokenBalance && connectBtn) {
            walletInfo.style.display = 'flex';
            connectBtn.style.display = 'none';
            walletAddress.textContent = Utils.shortenAddress(address);
            tokenBalance.textContent = `${parseFloat(balance).toFixed(2)} KQTP`;
            
            // KQTP 추가 버튼 표시
            if (addTokenBtn) {
                addTokenBtn.style.display = 'inline-block';
            }
        }
    }

    /**
     * 지갑 연결 해제 UI
     */
    resetWalletUI() {
        const walletInfo = document.getElementById('walletInfo');
        const connectBtn = document.getElementById('connectWallet');

        if (walletInfo && connectBtn) {
            walletInfo.style.display = 'none';
            connectBtn.style.display = 'block';
        }
    }

    /**
     * NFT 목록 렌더링
     */
    renderNFTList(container, nfts, options = {}) {
        container.innerHTML = '';

        if (!nfts || nfts.length === 0) {
            const emptyState = document.getElementById('emptyState');
            if (emptyState) {
                emptyState.style.display = 'block';
            }
            return;
        }

        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        nfts.forEach(nft => {
            const card = this.renderNFTCard(nft, options);
            container.appendChild(card);
        });
    }

    /**
     * 상점 아이템 목록 렌더링
     */
    renderShopItems(container, items, onPurchase) {
        container.innerHTML = '';

        if (!items || items.length === 0) {
            const emptyState = document.getElementById('emptyState');
            if (emptyState) {
                emptyState.style.display = 'block';
            }
            return;
        }

        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        items.forEach(item => {
            const card = this.renderShopItemCard(item, onPurchase);
            container.appendChild(card);
        });
    }

    /**
     * 거래 내역 렌더링
     */
    renderHistory(tbody, records) {
        tbody.innerHTML = '';

        if (!records || records.length === 0) {
            const emptyState = document.getElementById('emptyState');
            if (emptyState) {
                emptyState.style.display = 'block';
            }
            return;
        }

        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        records.forEach(record => {
            const row = this.renderHistoryRow(record);
            tbody.appendChild(row);
        });
    }

    /**
     * 모달 열기
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }

    /**
     * 모달 닫기
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 모달 초기화
     */
    initModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        // X 버튼 클릭
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal(modalId));
        }

        // 모달 외부 클릭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modalId);
            }
        });
    }
}

// 전역 인스턴스 생성
const ui = new MarketplaceUI();
