/**
 * 브릿지 서버 API 클라이언트
 */
class MarketplaceAPI {
    constructor() {
        this.baseURL = CONFIG.API_BASE_URL;
    }

    /**
     * 세션 토큰 가져오기
     */
    getSessionToken() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.sessionToken);
    }

    /**
     * 인증 헤더 생성
     */
    getAuthHeaders() {
        const token = this.getSessionToken();
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // 토큰이 있을 때만 Authorization 헤더 추가
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }

    /**
     * HTTP 요청 헬퍼
     */
    async request(endpoint, options = {}) {
        try {
            const url = `${this.baseURL}${endpoint}`;
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...this.getAuthHeaders(),
                    ...options.headers
                }
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Unknown error' }));
                console.error(`❌ API 에러 [${endpoint}]:`, error);
                throw new Error(error.error || error.message || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API 요청 실패 [${endpoint}]:`, error);
            throw error;
        }
    }

    // ===== 인증 API =====

    /**
     * 인증 메시지 요청
     */
    async requestAuthMessage(address) {
        return await this.request('/api/marketplace/auth/request-message', {
            method: 'POST',
            body: JSON.stringify({ address })
        });
    }

    /**
     * 서명 검증
     */
    async verifySignature(address, signature, message) {
        return await this.request('/api/marketplace/auth/verify', {
            method: 'POST',
            body: JSON.stringify({ address, signature, message })
        });
    }

    // ===== NFT 조회 API =====

    /**
     * 내 NFT 목록 조회
     */
    async getMyNFTs(address) {
        return await this.request(`/api/marketplace/nfts/${address}`);
    }

    /**
     * 마켓 판매 목록 조회
     */
    async getMarketListings(filters = {}) {
        const params = new URLSearchParams();
        
        if (filters.sortBy) params.append('sortBy', filters.sortBy);
        if (filters.minPrice) params.append('minPrice', filters.minPrice);
        if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
        if (filters.page) params.append('page', filters.page);
        if (filters.limit) params.append('limit', filters.limit);

        const query = params.toString();
        const endpoint = query ? `/api/marketplace/listings?${query}` : '/api/marketplace/listings';
        
        return await this.request(endpoint);
    }

    // ===== 판매 관리 API =====

    /**
     * NFT 판매 등록
     */
    async createListing(tokenId, price) {
        return await this.request('/api/marketplace/listings', {
            method: 'POST',
            body: JSON.stringify({ tokenId, price })
        });
    }

    /**
     * 판매 등록 취소
     */
    async cancelListing(listingId) {
        return await this.request(`/api/marketplace/listings/${listingId}`, {
            method: 'DELETE'
        });
    }

    // ===== 메타 트랜잭션 API =====

    /**
     * 메타 트랜잭션 준비 (EIP-712 서명 데이터 생성)
     */
    async prepareMetaTransaction(fromAddress, toAddress, amount) {
        return await this.request('/api/marketplace/meta-tx/prepare', {
            method: 'POST',
            body: JSON.stringify({ fromAddress, toAddress, amount })
        });
    }

    // ===== 구매 API =====

    /**
     * NFT 구매 (메타 트랜잭션 사용)
     */
    async purchaseNFT(listingId, buyerAddress, paymentSignature) {
        return await this.request('/api/marketplace/purchase', {
            method: 'POST',
            body: JSON.stringify({ listingId, buyerAddress, paymentSignature })
        });
    }

    // ===== 서버 상점 API =====

    /**
     * 서버 상점 아이템 목록
     */
    async getShopItems() {
        return await this.request('/api/marketplace/shop/items');
    }

    /**
     * 서버 상점 아이템 구매 (메타 트랜잭션 사용)
     */
    async purchaseShopItem(itemId, buyerAddress, paymentSignature) {
        return await this.request('/api/marketplace/shop/purchase', {
            method: 'POST',
            body: JSON.stringify({ itemId, buyerAddress, paymentSignature })
        });
    }

    // ===== 거래 내역 API =====

    /**
     * 거래 내역 조회
     */
    async getPurchaseHistory(address, filters = {}) {
        const params = new URLSearchParams();
        
        if (filters.type) params.append('type', filters.type);
        if (filters.page) params.append('page', filters.page);
        if (filters.limit) params.append('limit', filters.limit);

        const query = params.toString();
        const endpoint = query 
            ? `/api/marketplace/history/${address}?${query}` 
            : `/api/marketplace/history/${address}`;
        
        return await this.request(endpoint);
    }

    // ===== 통계 API (추가) =====

    /**
     * 마켓플레이스 통계
     */
    async getMarketStats() {
        try {
            // 활성 판매 목록 수
            const listings = await this.getMarketListings({ limit: 1 });
            const activeListings = listings.total || 0;

            // 간단한 통계 반환
            return {
                totalVolume: '-',
                activeListings: activeListings,
                totalNFTs: '-'
            };
        } catch (error) {
            console.error('통계 조회 실패:', error);
            return {
                totalVolume: '-',
                activeListings: '-',
                totalNFTs: '-'
            };
        }
    }
}

// 전역 인스턴스 생성
const api = new MarketplaceAPI();
