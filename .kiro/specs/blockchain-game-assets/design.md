# 설계 문서

## 개요

블록체인 게임 자산 시스템은 Unreal Engine 5 게임 클라이언트, Node.js 브릿지 서버, 이더리움 블록체인(Sepolia 테스트넷)의 3계층 아키텍처로 구성됩니다. 이 시스템은 게임 내 아이템을 ERC-721 NFT로 변환하고, IPFS를 통해 메타데이터를 분산 저장하며, 플레이어에게 진정한 디지털 자산 소유권을 제공합니다.

## 아키텍처

### 시스템 구성도

```
┌─────────────────────┐       ┌─────────────────────┐
│   Unreal Engine 5   │       │   Web Marketplace   │
│   Game Client       │       │   (Static Site)     │
│                     │       │                     │
│  - MetaMask Login   │       │  - MetaMask Login   │
│  - Item Events      │       │  - NFT Trading      │
│  - UI/UX            │       │  - Shop UI          │
└──────────┬──────────┘       └──────────┬──────────┘
           │                             │
           │ HTTPS/REST API              │ HTTPS/REST API
           │                             │
           └─────────────┬───────────────┘
                         │
                ┌────────▼──────────┐
                │   Node.js Bridge  │
                │   Server          │
                │                   │
                │  - API Gateway    │
                │  - IPFS Client    │
                │  - Web3.js        │
                │  - Queue Manager  │
                │  - Marketplace    │
                │    Logic          │
                └─────┬────────┬────┘
                      │        │
                      │        └─────────────┐
                      │                      │
                ┌─────▼──────┐      ┌────────▼────────┐
                │  MariaDB   │      │  IPFS Storage   │
                │  Database  │      │  (Pinata/Web3)  │
                │            │      │                 │
                │  - NFT     │      │  - Metadata     │
                │    Records │      │  - Images       │
                │  - Tx Log  │      │                 │
                │  - Market  │      └─────────────────┘
                │    Listing │
                │  - Shop    │
                │    Items   │
                └────────────┘
                             
      ┌──────────────────────┐
      │  Ethereum Sepolia    │
      │  Testnet             │
      │                      │
      │  - ERC-721 Contract  │
      │  - ERC-20 Token      │
      │  - NFT Ownership     │
      │  - Transaction Log   │
      └──────────────────────┘
```

### 데이터 흐름

#### 민팅 프로세스
```
1. Player acquires item in UE5
2. UE5 → Bridge: POST /api/nft/mint { itemData, walletAddress }
3. Bridge → IPFS: Upload metadata + image
4. IPFS → Bridge: Return CID
5. Bridge → Blockchain: Call mint(to, tokenId, tokenURI)
6. Blockchain → Bridge: Transaction hash
7. Bridge → Database: Store NFT record
8. Bridge → UE5: Return { tokenId, txHash, status }
9. UE5 → Player: Display success notification
```

#### 소각 프로세스
```
1. Player destroys item in UE5
2. UE5 → Bridge: POST /api/nft/burn { tokenId, walletAddress }
3. Bridge → Database: Verify ownership
4. Bridge → Blockchain: Call burn(tokenId)
5. Blockchain → Bridge: Transaction hash
6. Bridge → Database: Update NFT record (mark as burned)
7. Bridge → UE5: Return { txHash, status }
8. UE5 → Player: Display confirmation
```

#### 웹 마켓플레이스 로그인 프로세스
```
1. Player clicks "Connect Wallet" on Web Marketplace
2. Web → MetaMask: Request account access
3. MetaMask → Web: Return wallet address
4. Web → Bridge: POST /api/marketplace/auth/request-message { address }
5. Bridge → Web: Return { message, nonce, timestamp }
6. Web → MetaMask: Request signature for message
7. MetaMask → Web: Return signed message
8. Web → Bridge: POST /api/marketplace/auth/verify { address, signature, message }
9. Bridge: Verify signature
10. Bridge → Web: Return { sessionToken, expiresIn }
11. Web: Store sessionToken in localStorage
12. Web: Display user dashboard
```

#### P2P NFT 거래 프로세스
```
[판매 등록]
1. Player selects NFT to sell on Web Marketplace
2. Web → Bridge: POST /api/marketplace/listings { tokenId, price }
3. Bridge → Database: Verify ownership
4. Bridge → Database: Insert into marketplace_listings
5. Bridge → Web: Return { listingId, status }
6. Web: Display listing in marketplace

[구매]
1. Buyer clicks "Buy" on NFT listing
2. Web → MetaMask: Request approval for token transfer
3. MetaMask → Web: Signed approval transaction
4. Web → Bridge: POST /api/marketplace/purchase { listingId, buyerAddress }
5. Bridge → Database: Verify listing exists and is active
6. Bridge → Blockchain: Call transferFrom(seller, buyer, tokenId)
7. Bridge → Blockchain: Transfer payment tokens to seller
8. Blockchain → Bridge: Transaction receipts
9. Bridge → Database: Update listing status to 'sold'
10. Bridge → Database: Record purchase in purchase_history
11. Bridge → Web: Return { txHash, status }
12. Web: Display purchase confirmation
```

#### 서버 상점 구매 프로세스
```
1. Player browses server shop on Web Marketplace
2. Web → Bridge: GET /api/marketplace/shop/items
3. Bridge → Database: Query available items from server_shop
4. Bridge → Web: Return { items: [...] }
5. Player clicks "Buy" on monster summon ticket
6. Web → MetaMask: Request approval for token payment
7. MetaMask → Web: Signed payment transaction
8. Web → Bridge: POST /api/marketplace/shop/purchase { itemId, buyerAddress }
9. Bridge → Database: Verify item stock > 0
10. Bridge → Blockchain: Transfer tokens from buyer to server wallet
11. Bridge → IPFS: Upload summon ticket metadata
12. Bridge → Blockchain: Call mint(buyer, tokenId, tokenURI)
13. Blockchain → Bridge: Transaction receipt
14. Bridge → Database: Decrease item stock
15. Bridge → Database: Record purchase in purchase_history
16. Bridge → Web: Return { tokenId, txHash, metadata }
17. Web: Display purchase success and NFT details
```

## 컴포넌트 및 인터페이스

### 1. 웹 마켓플레이스 클라이언트

#### 주요 컴포넌트

**MetaMaskConnector (JavaScript)**
- 역할: MetaMask 지갑 연결 및 EIP-4361 인증 처리
- 기능:
  - MetaMask 설치 확인
  - 지갑 연결 요청
  - 서명 메시지 생성 및 서명 요청
  - 세션 토큰 관리
- 인터페이스:
```javascript
class MetaMaskConnector {
  async connect() {
    // MetaMask 연결 및 주소 반환
  }
  
  async signMessage(message) {
    // 메시지 서명 요청
  }
  
  async authenticate() {
    // 전체 인증 플로우 실행
    // 1. 서버에서 메시지 요청
    // 2. MetaMask로 서명
    // 3. 서버에 검증 요청
    // 4. 세션 토큰 저장
  }
  
  getAddress() {
    // 현재 연결된 지갑 주소 반환
  }
  
  isConnected() {
    // 연결 상태 확인
  }
  
  disconnect() {
    // 세션 종료 및 토큰 삭제
  }
}
```

**MarketplaceUI (HTML/CSS/JavaScript)**
- 역할: NFT 마켓플레이스 UI 렌더링
- 페이지 구성:
  - 홈: 최신 등록 NFT 목록
  - 내 NFT: 소유한 NFT 목록 및 판매 등록
  - 마켓: 판매 중인 NFT 검색 및 구매
  - 서버 상점: 몬스터 소환권 구매
  - 거래 내역: 구매/판매 기록
- 기능:
```javascript
class MarketplaceUI {
  renderNFTList(nfts) {
    // NFT 카드 목록 렌더링
  }
  
  renderNFTDetail(nft) {
    // NFT 상세 정보 표시
  }
  
  showListingForm(tokenId) {
    // 판매 등록 폼 표시
  }
  
  showPurchaseConfirm(listing) {
    // 구매 확인 모달 표시
  }
  
  updateWalletInfo(address, balance) {
    // 지갑 정보 업데이트
  }
}
```

**MarketplaceAPI (JavaScript)**
- 역할: 브릿지 서버와의 HTTP 통신
- 기능:
```javascript
class MarketplaceAPI {
  constructor(baseURL, sessionToken) {
    this.baseURL = baseURL;
    this.sessionToken = sessionToken;
  }
  
  // 인증
  async requestAuthMessage(address) {
    return await fetch(`${this.baseURL}/api/marketplace/auth/request-message`, {
      method: 'POST',
      body: JSON.stringify({ address })
    });
  }
  
  async verifySignature(address, signature, message) {
    return await fetch(`${this.baseURL}/api/marketplace/auth/verify`, {
      method: 'POST',
      body: JSON.stringify({ address, signature, message })
    });
  }
  
  // NFT 조회
  async getMyNFTs(address) {
    return await fetch(`${this.baseURL}/api/marketplace/nfts/${address}`, {
      headers: { 'Authorization': `Bearer ${this.sessionToken}` }
    });
  }
  
  async getMarketListings(filters) {
    const query = new URLSearchParams(filters);
    return await fetch(`${this.baseURL}/api/marketplace/listings?${query}`, {
      headers: { 'Authorization': `Bearer ${this.sessionToken}` }
    });
  }
  
  // 판매 등록
  async createListing(tokenId, price) {
    return await fetch(`${this.baseURL}/api/marketplace/listings`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.sessionToken}` },
      body: JSON.stringify({ tokenId, price })
    });
  }
  
  async cancelListing(listingId) {
    return await fetch(`${this.baseURL}/api/marketplace/listings/${listingId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${this.sessionToken}` }
    });
  }
  
  // 구매
  async purchaseNFT(listingId, buyerAddress) {
    return await fetch(`${this.baseURL}/api/marketplace/purchase`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.sessionToken}` },
      body: JSON.stringify({ listingId, buyerAddress })
    });
  }
  
  // 서버 상점
  async getShopItems() {
    return await fetch(`${this.baseURL}/api/marketplace/shop/items`, {
      headers: { 'Authorization': `Bearer ${this.sessionToken}` }
    });
  }
  
  async purchaseShopItem(itemId, buyerAddress) {
    return await fetch(`${this.baseURL}/api/marketplace/shop/purchase`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.sessionToken}` },
      body: JSON.stringify({ itemId, buyerAddress })
    });
  }
  
  // 거래 내역
  async getPurchaseHistory(address) {
    return await fetch(`${this.baseURL}/api/marketplace/history/${address}`, {
      headers: { 'Authorization': `Bearer ${this.sessionToken}` }
    });
  }
}
```

**Web3Helper (JavaScript)**
- 역할: 블록체인 직접 조회 및 트랜잭션 헬퍼
- 기능:
```javascript
class Web3Helper {
  constructor(provider) {
    this.web3 = new Web3(provider);
  }
  
  async getTokenBalance(address, tokenContractAddress) {
    // ERC-20 토큰 잔액 조회
  }
  
  async getNFTMetadata(contractAddress, tokenId) {
    // NFT 메타데이터 조회
  }
  
  async approveTokenSpending(tokenAddress, spenderAddress, amount) {
    // 토큰 사용 승인
  }
  
  async getTransactionStatus(txHash) {
    // 트랜잭션 상태 조회
  }
}
```

### 2. Unreal Engine 5 클라이언트

#### 주요 컴포넌트

**MetaMaskAuthenticator**
- 역할: EIP-4361 기반 지갑 인증 처리
- 기능:
  - MetaMask 확장 프로그램 감지
  - 서명 요청 생성 및 전송
  - 인증 토큰 저장 및 관리
- 인터페이스:
```cpp
class UMetaMaskAuthenticator : public UObject
{
public:
    UFUNCTION(BlueprintCallable)
    void RequestLogin();
    
    UFUNCTION(BlueprintCallable)
    bool IsAuthenticated();
    
    UFUNCTION(BlueprintCallable)
    FString GetWalletAddress();
    
private:
    FString AuthToken;
    FString WalletAddress;
    void OnSignatureReceived(FString Signature);
};
```

**NFTItemManager**
- 역할: 게임 아이템과 NFT 간 매핑 관리
- 기능:
  - 민팅 가능 아이템 식별
  - 민팅/소각 요청 생성
  - NFT 상태 추적
- 인터페이스:
```cpp
class UNFTItemManager : public UObject
{
public:
    UFUNCTION(BlueprintCallable)
    void RequestMintNFT(FItemData ItemData);
    
    UFUNCTION(BlueprintCallable)
    void RequestBurnNFT(int32 TokenId);
    
    UFUNCTION(BlueprintCallable)
    TArray<FNFTInfo> GetPlayerNFTs();
    
private:
    TMap<int32, FNFTInfo> NFTCache;
    void OnMintComplete(FMintResponse Response);
    void OnBurnComplete(FBurnResponse Response);
};
```

**BridgeAPIClient**
- 역할: 브릿지 서버와의 HTTP 통신
- 기능:
  - REST API 호출
  - 응답 파싱
  - 오류 처리 및 재시도
- 인터페이스:
```cpp
class UBridgeAPIClient : public UObject
{
public:
    void PostMintRequest(FMintRequest Request, TFunction<void(FMintResponse)> Callback);
    void PostBurnRequest(FBurnRequest Request, TFunction<void(FBurnResponse)> Callback);
    void GetTransactionStatus(FString TxHash, TFunction<void(FTxStatus)> Callback);
    
private:
    FString BaseURL;
    FString AuthToken;
    void HandleHTTPResponse(FHttpResponsePtr Response);
};
```

### 2. Node.js 브릿지 서버

#### 주요 컴포넌트

**API Gateway (Express.js)**
- 역할: RESTful API 엔드포인트 제공
- 엔드포인트:
```typescript
// ===== 게임 클라이언트 API =====

// 인증
POST   /api/auth/verify-signature
  Body: { message: string, signature: string, address: string }
  Response: { token: string, expiresIn: number }

// NFT 민팅
POST   /api/nft/mint
  Headers: { Authorization: Bearer <token> }
  Body: { 
    walletAddress: string,
    itemData: {
      name: string,
      description: string,
      imageBase64: string,
      attributes: Array<{ trait_type: string, value: string }>
    }
  }
  Response: { 
    tokenId: number,
    txHash: string,
    status: 'pending' | 'confirmed',
    ipfsCID: string
  }

// NFT 소각
POST   /api/nft/burn
  Headers: { Authorization: Bearer <token> }
  Body: { tokenId: number, walletAddress: string }
  Response: { txHash: string, status: 'pending' | 'confirmed' }

// 트랜잭션 상태 조회
GET    /api/transaction/:txHash
  Response: { 
    status: 'pending' | 'confirmed' | 'failed',
    blockNumber: number,
    confirmations: number
  }

// 플레이어 NFT 목록
GET    /api/nft/player/:address
  Response: { 
    nfts: Array<{
      tokenId: number,
      metadata: object,
      mintedAt: string
    }>
  }

// ===== 마켓플레이스 API =====

// 마켓플레이스 인증 - 메시지 요청
POST   /api/marketplace/auth/request-message
  Body: { address: string }
  Response: { 
    message: string,
    nonce: string,
    timestamp: number
  }

// 마켓플레이스 인증 - 서명 검증
POST   /api/marketplace/auth/verify
  Body: { 
    address: string,
    signature: string,
    message: string
  }
  Response: { 
    sessionToken: string,
    expiresIn: number
  }

// 내 NFT 목록 조회
GET    /api/marketplace/nfts/:address
  Headers: { Authorization: Bearer <sessionToken> }
  Response: { 
    nfts: Array<{
      tokenId: number,
      name: string,
      image: string,
      attributes: Array<object>,
      isListed: boolean,
      listingPrice?: number
    }>
  }

// 마켓 판매 목록 조회
GET    /api/marketplace/listings
  Headers: { Authorization: Bearer <sessionToken> }
  Query: { 
    sortBy?: 'price' | 'latest',
    minPrice?: number,
    maxPrice?: number,
    page?: number,
    limit?: number
  }
  Response: { 
    listings: Array<{
      listingId: number,
      tokenId: number,
      seller: string,
      price: number,
      listedAt: string,
      nftMetadata: object
    }>,
    total: number,
    page: number
  }

// NFT 판매 등록
POST   /api/marketplace/listings
  Headers: { Authorization: Bearer <sessionToken> }
  Body: { 
    tokenId: number,
    price: number
  }
  Response: { 
    listingId: number,
    status: 'active'
  }

// 판매 등록 취소
DELETE /api/marketplace/listings/:listingId
  Headers: { Authorization: Bearer <sessionToken> }
  Response: { 
    success: boolean
  }

// NFT 구매
POST   /api/marketplace/purchase
  Headers: { Authorization: Bearer <sessionToken> }
  Body: { 
    listingId: number,
    buyerAddress: string
  }
  Response: { 
    txHash: string,
    status: 'pending' | 'confirmed',
    tokenId: number
  }

// 서버 상점 아이템 목록
GET    /api/marketplace/shop/items
  Headers: { Authorization: Bearer <sessionToken> }
  Response: { 
    items: Array<{
      itemId: number,
      name: string,
      description: string,
      price: number,
      stock: number,
      image: string,
      itemType: 'summon_ticket' | 'other'
    }>
  }

// 서버 상점 아이템 구매
POST   /api/marketplace/shop/purchase
  Headers: { Authorization: Bearer <sessionToken> }
  Body: { 
    itemId: number,
    buyerAddress: string
  }
  Response: { 
    tokenId: number,
    txHash: string,
    status: 'pending' | 'confirmed',
    metadata: object
  }

// 거래 내역 조회
GET    /api/marketplace/history/:address
  Headers: { Authorization: Bearer <sessionToken> }
  Query: { 
    type?: 'buy' | 'sell' | 'all',
    page?: number,
    limit?: number
  }
  Response: { 
    history: Array<{
      id: number,
      type: 'buy' | 'sell',
      tokenId: number,
      price: number,
      counterparty: string,
      timestamp: string,
      txHash: string
    }>,
    total: number
  }
```

**IPFS Manager**
- 역할: IPFS 업로드 및 CID 관리
- 구현:
```typescript
class IPFSManager {
  private pinataApiKey: string;
  private pinataSecretKey: string;
  
  async uploadMetadata(metadata: NFTMetadata): Promise<string> {
    // Pinata API를 통해 JSON 업로드
    // CID 반환
  }
  
  async uploadImage(imageBuffer: Buffer): Promise<string> {
    // 이미지를 IPFS에 업로드
    // 이미지 CID 반환
  }
  
  async uploadWithRetry(data: any, maxRetries: number = 3): Promise<string> {
    // 재시도 로직 포함
  }
}
```

**Blockchain Service (Web3.js)**
- 역할: 스마트 컨트랙트 상호작용
- 구현:
```typescript
class BlockchainService {
  private web3: Web3;
  private contract: Contract;
  private adminAccount: Account;
  
  async mintNFT(
    toAddress: string, 
    tokenId: number, 
    tokenURI: string
  ): Promise<TransactionReceipt> {
    const tx = this.contract.methods.mint(toAddress, tokenId, tokenURI);
    const gas = await tx.estimateGas({ from: this.adminAccount.address });
    const gasPrice = await this.web3.eth.getGasPrice();
    
    const signedTx = await this.adminAccount.signTransaction({
      to: this.contract.options.address,
      data: tx.encodeABI(),
      gas,
      gasPrice
    });
    
    const receipt = await this.web3.eth.sendSignedTransaction(
      signedTx.rawTransaction
    );
    
    return receipt;
  }
  
  async burnNFT(tokenId: number): Promise<TransactionReceipt> {
    // burn() 호출 로직
  }
  
  async getTransactionStatus(txHash: string): Promise<TxStatus> {
    const receipt = await this.web3.eth.getTransactionReceipt(txHash);
    // 상태 파싱 및 반환
  }
  
  async verifyOwnership(tokenId: number, address: string): Promise<boolean> {
    const owner = await this.contract.methods.ownerOf(tokenId).call();
    return owner.toLowerCase() === address.toLowerCase();
  }
}
```

**Queue Manager (Bull)**
- 역할: 민팅/소각 요청 큐 관리
- 구현:
```typescript
class QueueManager {
  private mintQueue: Queue;
  private burnQueue: Queue;
  
  constructor() {
    this.mintQueue = new Bull('mint-queue', {
      redis: { host: 'localhost', port: 6379 }
    });
    
    this.mintQueue.process(async (job) => {
      return await this.processMintJob(job.data);
    });
  }
  
  async addMintJob(data: MintJobData): Promise<Job> {
    return await this.mintQueue.add(data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
  }
  
  private async processMintJob(data: MintJobData): Promise<MintResult> {
    // 1. IPFS 업로드
    // 2. 블록체인 민팅
    // 3. DB 저장
  }
}
```

**MarketplaceService**
- 역할: 마켓플레이스 비즈니스 로직 처리
- 구현:
```typescript
class MarketplaceService {
  private db: DatabaseService;
  private blockchain: BlockchainService;
  
  async createListing(
    tokenId: number,
    sellerAddress: string,
    price: number
  ): Promise<Listing> {
    // 1. 소유권 검증
    const isOwner = await this.blockchain.verifyOwnership(tokenId, sellerAddress);
    if (!isOwner) throw new Error('Not the owner');
    
    // 2. 중복 등록 확인
    const existingListing = await this.db.query(
      'SELECT * FROM marketplace_listings WHERE token_id = ? AND status = "active"',
      [tokenId]
    );
    if (existingListing.length > 0) throw new Error('Already listed');
    
    // 3. 판매 등록
    const listing = await this.db.insert('marketplace_listings', {
      token_id: tokenId,
      seller_address: sellerAddress,
      price: price,
      status: 'active'
    });
    
    return listing;
  }
  
  async purchaseNFT(
    listingId: number,
    buyerAddress: string
  ): Promise<PurchaseResult> {
    // 1. 판매 정보 조회
    const listing = await this.db.findById('marketplace_listings', listingId);
    if (!listing || listing.status !== 'active') {
      throw new Error('Listing not available');
    }
    
    // 2. 토큰 잔액 확인
    const balance = await this.blockchain.getTokenBalance(buyerAddress);
    if (balance < listing.price) {
      throw new Error('Insufficient balance');
    }
    
    // 3. NFT 소유권 이전
    const transferTx = await this.blockchain.transferNFT(
      listing.seller_address,
      buyerAddress,
      listing.token_id
    );
    
    // 4. 토큰 결제
    const paymentTx = await this.blockchain.transferTokens(
      buyerAddress,
      listing.seller_address,
      listing.price
    );
    
    // 5. 판매 상태 업데이트
    await this.db.update('marketplace_listings', listingId, {
      status: 'sold',
      buyer_address: buyerAddress,
      sold_at: new Date()
    });
    
    // 6. 거래 내역 기록
    await this.db.insert('purchase_history', {
      listing_id: listingId,
      token_id: listing.token_id,
      seller_address: listing.seller_address,
      buyer_address: buyerAddress,
      price: listing.price,
      transfer_tx_hash: transferTx.hash,
      payment_tx_hash: paymentTx.hash
    });
    
    return {
      txHash: transferTx.hash,
      tokenId: listing.token_id,
      status: 'confirmed'
    };
  }
  
  async getMarketListings(filters: ListingFilters): Promise<Listing[]> {
    // 필터링 및 정렬된 판매 목록 반환
  }
  
  async cancelListing(listingId: number, sellerAddress: string): Promise<void> {
    // 판매 취소
  }
}
```

**ShopService**
- 역할: 서버 상점 관리
- 구현:
```typescript
class ShopService {
  private db: DatabaseService;
  private blockchain: BlockchainService;
  private ipfs: IPFSManager;
  
  async getShopItems(): Promise<ShopItem[]> {
    return await this.db.query(
      'SELECT * FROM server_shop WHERE stock > 0 AND active = 1'
    );
  }
  
  async purchaseShopItem(
    itemId: number,
    buyerAddress: string
  ): Promise<PurchaseResult> {
    // 1. 아이템 정보 조회
    const item = await this.db.findById('server_shop', itemId);
    if (!item || item.stock <= 0) {
      throw new Error('Item not available');
    }
    
    // 2. 토큰 잔액 확인
    const balance = await this.blockchain.getTokenBalance(buyerAddress);
    if (balance < item.price) {
      throw new Error('Insufficient balance');
    }
    
    // 3. 토큰 결제 (구매자 → 서버 지갑)
    const paymentTx = await this.blockchain.transferTokens(
      buyerAddress,
      process.env.SERVER_WALLET_ADDRESS,
      item.price
    );
    
    // 4. NFT 메타데이터 생성
    const metadata = this.generateItemMetadata(item);
    const metadataCID = await this.ipfs.uploadMetadata(metadata);
    
    // 5. NFT 민팅
    const tokenId = await this.generateTokenId();
    const mintTx = await this.blockchain.mintNFT(
      buyerAddress,
      tokenId,
      `ipfs://${metadataCID}`
    );
    
    // 6. 재고 감소
    await this.db.update('server_shop', itemId, {
      stock: item.stock - 1
    });
    
    // 7. 구매 기록
    await this.db.insert('purchase_history', {
      item_id: itemId,
      token_id: tokenId,
      buyer_address: buyerAddress,
      price: item.price,
      payment_tx_hash: paymentTx.hash,
      mint_tx_hash: mintTx.hash,
      purchase_type: 'server_shop'
    });
    
    return {
      tokenId,
      txHash: mintTx.hash,
      metadata,
      status: 'confirmed'
    };
  }
  
  private generateItemMetadata(item: ShopItem): NFTMetadata {
    return {
      name: item.name,
      description: item.description,
      image: item.image_url,
      attributes: [
        { trait_type: 'Type', value: item.item_type },
        { trait_type: 'Rarity', value: item.rarity },
        { trait_type: 'Source', value: 'Server Shop' }
      ],
      game_data: {
        item_id: item.id,
        summon_uses: item.summon_uses || 1
      }
    };
  }
}
```

**Database Service**
- 역할: MariaDB 데이터 관리
- 스키마:
```sql
CREATE TABLE nft_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token_id INT UNIQUE NOT NULL,
  owner_address VARCHAR(42) NOT NULL,
  ipfs_cid VARCHAR(100) NOT NULL,
  mint_tx_hash VARCHAR(66) NOT NULL,
  burn_tx_hash VARCHAR(66),
  status ENUM('active', 'burned') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_owner (owner_address),
  INDEX idx_status (status)
);

CREATE TABLE transaction_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tx_hash VARCHAR(66) UNIQUE NOT NULL,
  tx_type ENUM('mint', 'burn', 'transfer', 'payment') NOT NULL,
  token_id INT,
  from_address VARCHAR(42),
  to_address VARCHAR(42),
  status ENUM('pending', 'confirmed', 'failed') NOT NULL,
  block_number INT,
  gas_used INT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tx_hash (tx_hash),
  INDEX idx_status (status)
);

CREATE TABLE auth_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  session_type ENUM('game', 'marketplace') NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token),
  INDEX idx_wallet (wallet_address)
);

CREATE TABLE marketplace_listings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token_id INT UNIQUE NOT NULL,
  seller_address VARCHAR(42) NOT NULL,
  buyer_address VARCHAR(42),
  price DECIMAL(20, 8) NOT NULL,
  status ENUM('active', 'sold', 'cancelled') DEFAULT 'active',
  listed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sold_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_seller (seller_address),
  INDEX idx_price (price),
  FOREIGN KEY (token_id) REFERENCES nft_records(token_id)
);

CREATE TABLE server_shop (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  item_type ENUM('summon_ticket', 'consumable', 'equipment') NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  image_url VARCHAR(255),
  rarity VARCHAR(20),
  summon_uses INT DEFAULT 1,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (item_type),
  INDEX idx_active (active)
);

CREATE TABLE purchase_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  listing_id INT,
  item_id INT,
  token_id INT NOT NULL,
  seller_address VARCHAR(42),
  buyer_address VARCHAR(42) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  purchase_type ENUM('p2p', 'server_shop') NOT NULL,
  transfer_tx_hash VARCHAR(66),
  payment_tx_hash VARCHAR(66),
  mint_tx_hash VARCHAR(66),
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_buyer (buyer_address),
  INDEX idx_seller (seller_address),
  INDEX idx_type (purchase_type),
  INDEX idx_date (purchased_at)
);

CREATE TABLE auth_nonces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  nonce VARCHAR(64) UNIQUE NOT NULL,
  message TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_nonce (nonce),
  INDEX idx_wallet (wallet_address)
);
```

### 3. 스마트 컨트랙트 (Solidity)

**GameToken.sol (ERC-20)**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameToken is ERC20, Ownable {
    constructor() ERC20("Game Token", "KQTP") Ownable(msg.sender) {
        // 초기 공급량 발행 (예: 1,000,000 토큰)
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
    
    /**
     * @dev 토큰 발행 (관리자만 가능)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev 토큰 소각
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}
```

**GameAssetNFT.sol (ERC-721)**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameAssetNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    
    // 이벤트
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event NFTBurned(uint256 indexed tokenId, address indexed owner);
    
    constructor() ERC721("GameAsset", "GASSET") Ownable(msg.sender) {}
    
    /**
     * @dev NFT 민팅 (관리자만 호출 가능)
     * @param to 수신자 주소
     * @param tokenId 토큰 ID
     * @param uri IPFS 메타데이터 URI
     */
    function mint(address to, uint256 tokenId, string memory uri) 
        public 
        onlyOwner 
    {
        require(to != address(0), "Cannot mint to zero address");
        require(!_exists(tokenId), "Token already exists");
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit NFTMinted(to, tokenId, uri);
    }
    
    /**
     * @dev NFT 소각 (관리자만 호출 가능)
     * @param tokenId 소각할 토큰 ID
     */
    function burn(uint256 tokenId) public onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        address owner = ownerOf(tokenId);
        
        _burn(tokenId);
        
        emit NFTBurned(tokenId, owner);
    }
    
    /**
     * @dev 토큰 존재 여부 확인
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
    
    /**
     * @dev 필수 오버라이드
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

## 웹 마켓플레이스 페이지 구조

### 정적 파일 구조
```
marketplace/
├── index.html              # 홈페이지 (최신 NFT 목록)
├── my-nfts.html           # 내 NFT 목록
├── market.html            # 마켓 (판매 중인 NFT)
├── shop.html              # 서버 상점
├── history.html           # 거래 내역
├── css/
│   ├── main.css           # 공통 스타일
│   ├── components.css     # 컴포넌트 스타일
│   └── responsive.css     # 반응형 스타일
├── js/
│   ├── main.js            # 메인 앱 로직
│   ├── metamask.js        # MetaMask 연동
│   ├── api.js             # API 클라이언트
│   ├── web3-helper.js     # Web3 헬퍼
│   └── ui.js              # UI 렌더링
├── assets/
│   ├── images/            # 이미지 파일
│   └── icons/             # 아이콘 파일
└── lib/
    ├── web3.min.js        # Web3.js 라이브러리
    └── ethers.min.js      # Ethers.js 라이브러리 (선택)
```

### 주요 페이지 레이아웃

**index.html (홈페이지)**
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>NFT 마켓플레이스</title>
  <link rel="stylesheet" href="css/main.css">
</head>
<body>
  <header>
    <nav>
      <div class="logo">Game NFT Marketplace</div>
      <ul class="nav-menu">
        <li><a href="index.html">홈</a></li>
        <li><a href="my-nfts.html">내 NFT</a></li>
        <li><a href="market.html">마켓</a></li>
        <li><a href="shop.html">서버 상점</a></li>
        <li><a href="history.html">거래 내역</a></li>
      </ul>
      <div class="wallet-info">
        <button id="connectWallet">지갑 연결</button>
        <div id="walletAddress" style="display:none;"></div>
        <div id="tokenBalance" style="display:none;"></div>
      </div>
    </nav>
  </header>
  
  <main>
    <section class="hero">
      <h1>게임 아이템을 NFT로 거래하세요</h1>
      <p>블록체인 기반 투명한 거래 시스템</p>
    </section>
    
    <section class="featured-nfts">
      <h2>최신 등록 NFT</h2>
      <div id="nftGrid" class="nft-grid">
        <!-- NFT 카드들이 동적으로 렌더링됨 -->
      </div>
    </section>
  </main>
  
  <footer>
    <p>&copy; 2025 Game NFT Marketplace</p>
  </footer>
  
  <script src="lib/web3.min.js"></script>
  <script src="js/metamask.js"></script>
  <script src="js/api.js"></script>
  <script src="js/ui.js"></script>
  <script src="js/main.js"></script>
</body>
</html>
```

**my-nfts.html (내 NFT)**
- 소유한 NFT 목록 표시
- 각 NFT에 "판매 등록" 버튼
- 이미 등록된 NFT는 "판매 취소" 버튼

**market.html (마켓)**
- 판매 중인 NFT 목록
- 가격순/최신순 정렬
- 가격 필터링
- "구매" 버튼

**shop.html (서버 상점)**
- 서버가 판매하는 아이템 목록
- 몬스터 소환권 등
- 재고 표시
- "구매" 버튼

**history.html (거래 내역)**
- 구매/판매 내역
- 트랜잭션 해시 링크 (Etherscan)
- 날짜별 필터링

## 데이터 모델

### NFT 메타데이터 (JSON)
```json
{
  "name": "Legendary Sword of Fire",
  "description": "A powerful sword forged in the flames of Mount Doom",
  "image": "ipfs://QmX7Y8Z9...",
  "attributes": [
    {
      "trait_type": "Rarity",
      "value": "Legendary"
    },
    {
      "trait_type": "Attack Power",
      "value": 150
    },
    {
      "trait_type": "Element",
      "value": "Fire"
    },
    {
      "trait_type": "Durability",
      "value": 100
    }
  ],
  "game_data": {
    "item_id": "sword_fire_001",
    "level_requirement": 50,
    "class_restriction": ["Warrior", "Paladin"]
  }
}
```

### 마켓플레이스 데이터 모델

**Listing (판매 등록)**
```typescript
interface Listing {
  listingId: number;
  tokenId: number;
  seller: string;
  buyer?: string;
  price: number;
  status: 'active' | 'sold' | 'cancelled';
  listedAt: Date;
  soldAt?: Date;
  nftMetadata: {
    name: string;
    image: string;
    attributes: Array<{ trait_type: string; value: string | number }>;
  };
}
```

**ShopItem (서버 상점 아이템)**
```typescript
interface ShopItem {
  itemId: number;
  name: string;
  description: string;
  itemType: 'summon_ticket' | 'consumable' | 'equipment';
  price: number;
  stock: number;
  imageUrl: string;
  rarity: string;
  summonUses?: number;
  active: boolean;
}
```

**PurchaseHistory (구매 내역)**
```typescript
interface PurchaseHistory {
  id: number;
  type: 'p2p' | 'server_shop';
  tokenId: number;
  seller?: string;
  buyer: string;
  price: number;
  txHash: string;
  purchasedAt: Date;
}
```

**AuthNonce (인증 논스)**
```typescript
interface AuthNonce {
  walletAddress: string;
  nonce: string;
  message: string;
  expiresAt: Date;
  used: boolean;
}
```

### API 요청/응답 모델

**MintRequest**
```typescript
interface MintRequest {
  walletAddress: string;
  itemData: {
    name: string;
    description: string;
    imageBase64: string;
    attributes: Array<{
      trait_type: string;
      value: string | number;
    }>;
    gameData?: object;
  };
}
```

**MintResponse**
```typescript
interface MintResponse {
  success: boolean;
  tokenId: number;
  txHash: string;
  status: 'pending' | 'confirmed';
  ipfsCID: string;
  metadataURI: string;
  error?: string;
}
```

**BurnRequest**
```typescript
interface BurnRequest {
  tokenId: number;
  walletAddress: string;
}
```

**BurnResponse**
```typescript
interface BurnResponse {
  success: boolean;
  txHash: string;
  status: 'pending' | 'confirmed';
  error?: string;
}
```

**AuthMessageRequest**
```typescript
interface AuthMessageRequest {
  address: string;
}
```

**AuthMessageResponse**
```typescript
interface AuthMessageResponse {
  message: string;
  nonce: string;
  timestamp: number;
}
```

**AuthVerifyRequest**
```typescript
interface AuthVerifyRequest {
  address: string;
  signature: string;
  message: string;
}
```

**AuthVerifyResponse**
```typescript
interface AuthVerifyResponse {
  sessionToken: string;
  expiresIn: number;
}
```

**CreateListingRequest**
```typescript
interface CreateListingRequest {
  tokenId: number;
  price: number;
}
```

**CreateListingResponse**
```typescript
interface CreateListingResponse {
  listingId: number;
  status: 'active';
}
```

**PurchaseNFTRequest**
```typescript
interface PurchaseNFTRequest {
  listingId: number;
  buyerAddress: string;
}
```

**PurchaseNFTResponse**
```typescript
interface PurchaseNFTResponse {
  txHash: string;
  status: 'pending' | 'confirmed';
  tokenId: number;
}
```

**PurchaseShopItemRequest**
```typescript
interface PurchaseShopItemRequest {
  itemId: number;
  buyerAddress: string;
}
```

**PurchaseShopItemResponse**
```typescript
interface PurchaseShopItemResponse {
  tokenId: number;
  txHash: string;
  status: 'pending' | 'confirmed';
  metadata: NFTMetadata;
}
```

## 오류 처리

### 오류 코드 체계

```typescript
enum ErrorCode {
  // 인증 오류 (1000번대)
  AUTH_INVALID_SIGNATURE = 1001,
  AUTH_TOKEN_EXPIRED = 1002,
  AUTH_WALLET_NOT_FOUND = 1003,
  
  // IPFS 오류 (2000번대)
  IPFS_UPLOAD_FAILED = 2001,
  IPFS_CONNECTION_ERROR = 2002,
  IPFS_INVALID_CID = 2003,
  
  // 블록체인 오류 (3000번대)
  BLOCKCHAIN_TX_FAILED = 3001,
  BLOCKCHAIN_INSUFFICIENT_GAS = 3002,
  BLOCKCHAIN_NETWORK_ERROR = 3003,
  BLOCKCHAIN_CONTRACT_ERROR = 3004,
  
  // NFT 오류 (4000번대)
  NFT_ALREADY_EXISTS = 4001,
  NFT_NOT_FOUND = 4002,
  NFT_OWNERSHIP_MISMATCH = 4003,
  NFT_ALREADY_BURNED = 4004,
  
  // 시스템 오류 (5000번대)
  SYSTEM_DATABASE_ERROR = 5001,
  SYSTEM_QUEUE_FULL = 5002,
  SYSTEM_TIMEOUT = 5003,
}
```

### 오류 처리 전략

**재시도 정책**
```typescript
const retryConfig = {
  ipfsUpload: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000,
  },
  blockchainTx: {
    maxAttempts: 2,
    backoff: 'fixed',
    initialDelay: 5000,
  },
  databaseQuery: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 500,
  },
};
```

**폴백 메커니즘**
- IPFS: Pinata 실패 시 Web3.Storage로 전환
- RPC: 주 엔드포인트 실패 시 백업 엔드포인트 사용
- 데이터베이스: 읽기 전용 복제본으로 폴백

**로깅 전략**
```typescript
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  action: string;
  details: object;
  errorCode?: ErrorCode;
  stackTrace?: string;
}
```

## 테스팅 전략

### 단위 테스트

**스마트 컨트랙트 (Hardhat)**
```javascript
describe("GameAssetNFT", function () {
  it("Should mint NFT with correct metadata", async function () {
    const [owner, player] = await ethers.getSigners();
    const GameAssetNFT = await ethers.getContractFactory("GameAssetNFT");
    const nft = await GameAssetNFT.deploy();
    
    const tokenId = 1;
    const tokenURI = "ipfs://QmTest123";
    
    await nft.mint(player.address, tokenId, tokenURI);
    
    expect(await nft.ownerOf(tokenId)).to.equal(player.address);
    expect(await nft.tokenURI(tokenId)).to.equal(tokenURI);
  });
  
  it("Should burn NFT and emit event", async function () {
    // 소각 테스트
  });
  
  it("Should reject minting duplicate token ID", async function () {
    // 중복 민팅 방지 테스트
  });
});
```

**브릿지 서버 (Jest)**
```typescript
describe('BlockchainService', () => {
  let service: BlockchainService;
  
  beforeEach(() => {
    service = new BlockchainService(mockWeb3, mockContract);
  });
  
  test('mintNFT should return transaction receipt', async () => {
    const receipt = await service.mintNFT(
      '0x123...',
      1,
      'ipfs://QmTest'
    );
    
    expect(receipt.status).toBe(true);
    expect(receipt.transactionHash).toBeDefined();
  });
  
  test('verifyOwnership should return true for valid owner', async () => {
    const isOwner = await service.verifyOwnership(1, '0x123...');
    expect(isOwner).toBe(true);
  });
});
```

### 통합 테스트

**엔드투엔드 민팅 플로우**
```typescript
describe('E2E: NFT Minting Flow', () => {
  test('Complete minting process from API to blockchain', async () => {
    // 1. 인증 토큰 획득
    const authResponse = await request(app)
      .post('/api/auth/verify-signature')
      .send({ message, signature, address });
    
    const token = authResponse.body.token;
    
    // 2. 민팅 요청
    const mintResponse = await request(app)
      .post('/api/nft/mint')
      .set('Authorization', `Bearer ${token}`)
      .send(mintRequest);
    
    expect(mintResponse.status).toBe(200);
    expect(mintResponse.body.tokenId).toBeDefined();
    
    // 3. 트랜잭션 확인 대기
    await waitForConfirmation(mintResponse.body.txHash);
    
    // 4. 블록체인에서 소유권 확인
    const owner = await contract.ownerOf(mintResponse.body.tokenId);
    expect(owner).toBe(address);
    
    // 5. 데이터베이스 확인
    const dbRecord = await db.query(
      'SELECT * FROM nft_records WHERE token_id = ?',
      [mintResponse.body.tokenId]
    );
    expect(dbRecord).toBeDefined();
  });
});
```

### 성능 테스트

**부하 테스트 (Artillery)**
```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
scenarios:
  - name: "Mint NFT"
    flow:
      - post:
          url: "/api/nft/mint"
          headers:
            Authorization: "Bearer {{ token }}"
          json:
            walletAddress: "{{ address }}"
            itemData: "{{ itemData }}"
```

### 보안 테스트

**취약점 점검 항목**
- 스마트 컨트랙트: Slither, Mythril 정적 분석
- API: OWASP Top 10 점검
- 인증: JWT 토큰 만료 및 검증
- 권한: 소유권 검증 우회 시도
- 입력 검증: SQL 인젝션, XSS 방어

## 인프라 구성

### 서버 환경
- **가상화 플랫폼**: VMware
- **운영체제**: Rocky Linux
- **서버 구성**:
  - Bridge Server (Node.js): Rocky Linux VM
  - MariaDB: Rocky Linux VM에 네이티브 설치 (비컨테이너)

### 서버 아키텍처
```
┌─────────────────────────────────────────┐
│         VMware Infrastructure           │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Rocky Linux VM #1               │ │
│  │   (Bridge Server)                 │ │
│  │                                   │ │
│  │   - Node.js Runtime               │ │
│  │   - PM2 Process Manager           │ │
│  │   - Nginx Reverse Proxy           │ │
│  │   - Redis (Queue)                 │ │
│  └───────────────┬───────────────────┘ │
│                  │                      │
│  ┌───────────────▼───────────────────┐ │
│  │   Rocky Linux VM #2               │ │
│  │   (Database Server)               │ │
│  │                                   │ │
│  │   - MariaDB 10.11+                │ │
│  │   - Native Installation           │ │
│  │   - Systemd Service               │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Rocky Linux 서버 설정

**Bridge Server VM 사양**
- CPU: 4 vCPU
- RAM: 8GB
- Disk: 100GB SSD
- Network: 1Gbps

**Database Server VM 사양**
- CPU: 4 vCPU
- RAM: 16GB
- Disk: 200GB SSD (데이터 증가 고려)
- Network: 1Gbps

### MariaDB 네이티브 설치

**설치 단계**
```bash
# Rocky Linux에 MariaDB 저장소 추가
sudo dnf install -y mariadb-server mariadb

# MariaDB 서비스 시작 및 자동 시작 설정
sudo systemctl start mariadb
sudo systemctl enable mariadb

# 보안 설정
sudo mysql_secure_installation

# 방화벽 설정
sudo firewall-cmd --permanent --add-service=mysql
sudo firewall-cmd --reload
```

**MariaDB 설정 파일** (`/etc/my.cnf.d/server.cnf`)
```ini
[mysqld]
# 기본 설정
bind-address = 0.0.0.0
port = 3306
max_connections = 200

# 성능 최적화
innodb_buffer_pool_size = 8G
innodb_log_file_size = 512M
innodb_flush_log_at_trx_commit = 2

# 문자셋
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# 로깅
log_error = /var/log/mariadb/error.log
slow_query_log = 1
slow_query_log_file = /var/log/mariadb/slow-query.log
long_query_time = 2

# 보안
local_infile = 0
```

### Node.js Bridge Server 설정

**설치 및 구성**
```bash
# Node.js 18 LTS 설치
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# PM2 글로벌 설치
sudo npm install -g pm2

# Redis 설치 (큐 관리용)
sudo dnf install -y redis
sudo systemctl start redis
sudo systemctl enable redis

# Nginx 설치 (리버스 프록시)
sudo dnf install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

**PM2 프로세스 설정** (`ecosystem.config.js`)
```javascript
module.exports = {
  apps: [{
    name: 'bridge-server',
    script: './dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DB_HOST: '192.168.1.101', // Database VM IP
      DB_PORT: 3306,
      DB_NAME: 'blockchain_game',
      DB_USER: 'bridge_user',
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379
    },
    error_file: '/var/log/bridge-server/error.log',
    out_file: '/var/log/bridge-server/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G'
  }]
};
```

**Nginx 리버스 프록시 설정** (`/etc/nginx/conf.d/bridge.conf`)
```nginx
upstream bridge_backend {
    least_conn;
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name bridge.yourgame.com;

    # HTTPS로 리다이렉트
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bridge.yourgame.com;

    ssl_certificate /etc/ssl/certs/bridge.crt;
    ssl_certificate_key /etc/ssl/private/bridge.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 10M;

    location / {
        proxy_pass http://bridge_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        
        # 타임아웃 설정
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=60r/m;
    limit_req zone=api_limit burst=10 nodelay;
}
```

### 네트워크 구성

**방화벽 규칙 (firewalld)**

Bridge Server:
```bash
# HTTP/HTTPS 허용
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# SSH 허용
sudo firewall-cmd --permanent --add-service=ssh

# 적용
sudo firewall-cmd --reload
```

Database Server:
```bash
# MySQL 포트는 Bridge Server IP에서만 허용
sudo firewall-cmd --permanent --add-rich-rule='
  rule family="ipv4"
  source address="192.168.1.100/32"
  port protocol="tcp" port="3306" accept'

# SSH 허용
sudo firewall-cmd --permanent --add-service=ssh

# 적용
sudo firewall-cmd --reload
```

### 백업 전략

**MariaDB 자동 백업**
```bash
#!/bin/bash
# /usr/local/bin/backup-mariadb.sh

BACKUP_DIR="/backup/mariadb"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="blockchain_game"

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

# 덤프 생성
mysqldump -u backup_user -p'password' \
  --single-transaction \
  --routines \
  --triggers \
  $DB_NAME | gzip > $BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz

# 7일 이상 된 백업 삭제
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${DB_NAME}_${DATE}.sql.gz"
```

**Cron 설정**
```bash
# 매일 새벽 2시에 백업 실행
0 2 * * * /usr/local/bin/backup-mariadb.sh >> /var/log/mariadb-backup.log 2>&1
```

## 배포 전략

### 개발 환경
- 로컬 Hardhat 네트워크
- 로컬 IPFS 노드 또는 테스트 Pinata 계정
- 로컬 MariaDB

### 테스트 환경
- VMware Rocky Linux VM (Bridge Server)
- VMware Rocky Linux VM (MariaDB 네이티브 설치)
- Sepolia 테스트넷
- Pinata 테스트 계정

### 프로덕션 고려사항
- 메인넷 배포 (Ethereum 또는 Polygon)
- 프로덕션 IPFS 서비스 (Pinata Pro)
- 고가용성을 위한 추가 VM 구성
- 로드 밸런서 (Nginx 또는 HAProxy)
- 모니터링 및 알림 시스템 (Prometheus, Grafana)

## 보안 고려사항

**참고**: 이 프로젝트는 스터디 목적의 팀 프로젝트이므로, 프로덕션 수준의 완벽한 보안은 요구되지 않습니다. 기본적인 보안 원칙만 적용합니다.

### 개인키 관리
- 브릿지 서버의 관리자 개인키는 환경 변수 또는 `.env` 파일로 관리
- `.env` 파일은 `.gitignore`에 추가하여 Git에 커밋되지 않도록 설정
- 테스트넷 전용 지갑 사용 (실제 자산 없음)

### API 보안
- 기본적인 JWT 토큰 인증 (선택적)
- 간단한 CORS 설정 (개발 중에는 모든 origin 허용 가능)
- HTTP 사용 가능 (HTTPS는 선택사항)

### 스마트 컨트랙트 보안
- OpenZeppelin 검증된 라이브러리 사용
- onlyOwner 수정자로 관리자 함수 보호
- 테스트넷 배포이므로 감사(audit) 불필요

### 데이터 보안
- 기본 MariaDB 인증 (사용자명/비밀번호)
- 정기적인 백업 (선택사항)
- 개발/학습 목적이므로 암호화는 선택사항

### 마켓플레이스 보안
- **재생 공격 방지**: EIP-4361 서명 메시지에 nonce와 타임스탬프 포함
- **세션 관리**: 세션 토큰 24시간 유효, 만료 시 재인증 필요
- **소유권 검증**: 모든 판매/구매 전 NFT 소유권 확인
- **이중 지불 방지**: 트랜잭션 처리 중 판매 상태 잠금
- **프론트러닝 방지**: 기본적인 타임스탬프 검증 (선택사항)
- **XSS 방지**: 사용자 입력 데이터 이스케이프 처리
- **CSRF 방지**: 세션 토큰 기반 인증

## 모니터링 및 유지보수

### 메트릭 수집
- API 응답 시간
- 민팅/소각 성공률
- IPFS 업로드 시간
- 블록체인 트랜잭션 가스 비용
- 큐 대기 시간
- 데이터베이스 쿼리 성능

### 알림 설정
- 트랜잭션 실패율 > 5%
- API 응답 시간 > 10초
- 큐 크기 > 100
- 데이터베이스 연결 실패
- 스마트 컨트랙트 오류 이벤트

### 로그 관리
- 중앙화된 로그 수집 (ELK Stack)
- 로그 레벨별 분류
- 민감 정보 마스킹
- 30일 보관 정책
