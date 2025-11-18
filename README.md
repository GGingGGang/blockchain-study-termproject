# 🎮 블록체인 게임 자산 시스템 & NFT 마켓플레이스

Unreal Engine 5 게임의 자산 시스템에 블록체인 기술을 통합하고, 플레이어 간 NFT 거래가 가능한 웹 마켓플레이스를 제공하는 프로젝트입니다.

## 📋 프로젝트 개요

게임 내 아이템을 ERC-721 NFT로 변환하고, ERC-20 토큰을 사용하여 P2P 거래 및 서버 상점 구매가 가능한 통합 시스템입니다.

### 주요 기능
- ✅ **NFT 민팅/소각**: 게임 아이템을 블록체인 NFT로 변환
- ✅ **P2P 마켓플레이스**: 플레이어 간 NFT 거래
- ✅ **서버 상점**: 몬스터 소환권 등 특별 아이템 판매
- ✅ **EIP-4361 인증**: Sign-In with Ethereum 표준 지갑 로그인
- ✅ **IPFS 저장**: 분산 파일 시스템을 통한 메타데이터 저장

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐       ┌─────────────────┐
│  Unreal Engine  │       │  Web Marketplace│
│  Game Client    │       │  (HTML/JS)      │
└────────┬────────┘       └────────┬────────┘
         │                         │
         └──────────┬──────────────┘
                    │ REST API
         ┌──────────▼──────────┐
         │  Node.js Bridge     │
         │  Server             │
         │  - Express.js       │
         │  - Web3.js          │
         │  - IPFS (Pinata)    │
         └──┬──────────────┬───┘
            │              │
    ┌───────▼────┐    ┌────▼─────────┐
    │  MariaDB   │    │  Ethereum    │
    │  Database  │    │  Sepolia     │
    │            │    │  Testnet     │
    └────────────┘    └──────────────┘
```

## 🚀 빠른 시작

### 1. 저장소 클론

```bash
git clone https://github.com/GGingGGang/blockchain-study-termproject.git
cd blockchain-study-termproject
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

`.env.example`을 복사하여 `.env` 파일 생성:

```bash
cp .env.example .env
```

필수 환경 변수:
```env
# 블록체인
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=your_private_key_here

# 배포된 컨트랙트 주소
GAME_TOKEN_ADDRESS=0xb0d279Ed4eA4C1564b6b4d2D02CE16aEd64Bf8AA
GAME_ASSET_NFT_ADDRESS=0x3Db5276c83a7494E0177c525Ccf9781741A1dD67

# 데이터베이스
DB_HOST=localhost
DB_PORT=3306
DB_NAME=blockchain_game
DB_USER=bridge_user
DB_PASSWORD=your_password

# IPFS
PINATA_JWT=your_pinata_jwt_token

# 서버
PORT=3000
JWT_SECRET=your_jwt_secret
```

### 4. 데이터베이스 설정

#### Rocky Linux (자동 설치):
```bash
cd database
chmod +x install-mariadb.sh
sudo ./install-mariadb.sh
```

#### 수동 설치:
```bash
# MariaDB 설치
sudo dnf install -y mariadb-server mariadb
sudo systemctl start mariadb

# 데이터베이스 초기화
mysql -u root -p < database/init.sql
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

### 5. 브릿지 서버 실행

```bash
npm run server
```

서버가 `http://localhost:3000`에서 실행됩니다.

## 📦 스마트 컨트랙트

### 배포된 컨트랙트 (Sepolia 테스트넷)

- **GameToken (ERC-20)**: `0xb0d279Ed4eA4C1564b6b4d2D02CE16aEd64Bf8AA`
  - 이름: Game Token
  - 심볼: KQTP
  - 초기 공급량: 1,000,000 KQTP

- **GameAssetNFT (ERC-721)**: `0x3Db5276c83a7494E0177c525Ccf9781741A1dD67`
  - 이름: GameAsset
  - 심볼: GASSET

### 컨트랙트 재배포

```bash
# 로컬 네트워크
npm run deploy:local

# Sepolia 테스트넷
npm run deploy:sepolia
```

## 🔌 API 엔드포인트

### 인증 API

```
POST   /api/auth/verify-signature
GET    /api/auth/verify-token
POST   /api/auth/logout
```

### NFT API (게임 클라이언트용)

```
POST   /api/nft/mint              # NFT 민팅
POST   /api/nft/burn              # NFT 소각
GET    /api/nft/player/:address   # 플레이어 NFT 목록
GET    /api/transaction/:txHash   # 트랜잭션 상태
```

### 마켓플레이스 API

```
# 인증
POST   /api/marketplace/auth/request-message
POST   /api/marketplace/auth/verify

# NFT 조회
GET    /api/marketplace/nfts/:address
GET    /api/marketplace/listings

# 판매 관리
POST   /api/marketplace/listings
DELETE /api/marketplace/listings/:listingId

# 구매
POST   /api/marketplace/purchase

# 서버 상점
GET    /api/marketplace/shop/items
POST   /api/marketplace/shop/purchase

# 거래 내역
GET    /api/marketplace/history/:address
```

## 🧪 테스트

### IPFS 업로드 테스트
```bash
npm run test:ipfs
```

### 블록체인 민팅/소각 테스트
```bash
npm run test:blockchain
```

### API 엔드포인트 테스트
```bash
# 서버가 실행 중이어야 함
npm run test:api
```

## 📁 프로젝트 구조

```
blockchain-study-termproject/
├── contracts/                    # 스마트 컨트랙트
│   ├── GameToken.sol            # ERC-20 토큰
│   └── GameAssetNFT.sol         # ERC-721 NFT
├── server/                       # Node.js 브릿지 서버
│   ├── config/                  # 설정 파일
│   │   ├── database.js          # MariaDB 연결
│   │   └── web3.js              # Web3 설정
│   ├── routes/                  # API 라우트
│   │   ├── auth.js              # 인증 API
│   │   ├── nft.js               # NFT API
│   │   └── marketplace.js       # 마켓플레이스 API
│   ├── services/                # 비즈니스 로직
│   │   ├── BlockchainService.js # 블록체인 상호작용
│   │   └── IPFSManager.js       # IPFS 업로드
│   ├── middleware/              # 미들웨어
│   │   └── auth.js              # JWT 인증
│   ├── utils/                   # 유틸리티
│   │   └── metadataHelper.js    # 메타데이터 생성
│   └── index.js                 # 서버 엔트리포인트
├── database/                     # 데이터베이스
│   ├── schema.sql               # 테이블 스키마
│   ├── init.sql                 # 초기화 스크립트
│   ├── seed.sql                 # 샘플 데이터
│   ├── install-mariadb.sh       # 자동 설치 스크립트
│   └── README.md                # DB 설정 가이드
├── scripts/                      # 유틸리티 스크립트
│   └── deploy.js                # 컨트랙트 배포
├── test-ipfs.js                 # IPFS 테스트
├── test-blockchain.js           # 블록체인 테스트
├── test-api.js                  # API 테스트
└── .kiro/specs/                 # 프로젝트 스펙 문서
    └── blockchain-game-assets/
        ├── requirements.md      # 요구사항
        ├── design.md            # 설계
        └── tasks.md             # 작업 목록
```

## 🔧 기술 스택

### 블록체인
- **Solidity** ^0.8.20
- **Hardhat** - 스마트 컨트랙트 개발 프레임워크
- **OpenZeppelin** - 검증된 컨트랙트 라이브러리
- **Sepolia Testnet** - 이더리움 테스트 네트워크

### 백엔드
- **Node.js** 18+
- **Express.js** - REST API 서버
- **Web3.js** - 블록체인 상호작용
- **Ethers.js** - 서명 검증
- **MariaDB** - 오프체인 데이터 저장
- **Pinata** - IPFS 파일 저장

### 인증
- **JWT** - 세션 토큰
- **EIP-4361** - Sign-In with Ethereum

## 🎯 주요 기능

### 1. NFT 민팅
게임에서 획득한 아이템을 NFT로 변환:
1. 아이템 이미지 → IPFS 업로드
2. 메타데이터 생성 → IPFS 업로드
3. 스마트 컨트랙트 mint() 호출
4. 데이터베이스에 기록

### 2. NFT 소각
게임에서 아이템 파괴 시 NFT 소각:
1. 소유권 검증
2. 스마트 컨트랙트 burn() 호출
3. 데이터베이스 상태 업데이트

### 3. P2P NFT 거래
플레이어 간 NFT 거래:
1. 판매자가 NFT 판매 등록 (가격 설정)
2. 구매자가 토큰으로 구매
3. NFT 소유권 이전 + 토큰 결제
4. 거래 내역 기록

### 4. 서버 상점
서버가 판매하는 특별 아이템:
1. 몬스터 소환권 등 아이템 구매
2. 토큰 결제 (구매자 → 서버)
3. NFT 자동 민팅
4. 재고 관리

## 💰 KQTP 토큰을 MetaMask에 추가하는 방법

웹 마켓플레이스에서 KQTP 토큰 잔액을 확인하려면 MetaMask에 토큰을 추가해야 합니다.

### 방법 1: 마켓플레이스에서 자동 추가 (권장)

1. 웹 마켓플레이스 접속 (`http://localhost:3000`)
2. MetaMask 지갑 연결
3. 상단 네비게이션 바에서 **"KQTP 추가"** 버튼 클릭
4. MetaMask 팝업에서 **"토큰 추가"** 확인

### 방법 2: MetaMask에서 수동 추가

1. MetaMask 확장 프로그램 열기
2. **"토큰 가져오기"** 클릭
3. **"맞춤형 토큰"** 탭 선택
4. 다음 정보 입력:
   - **토큰 컨트랙트 주소**: `0xb0d279Ed4eA4C1564b6b4d2D02CE16aEd64Bf8AA`
   - **토큰 심볼**: `KQTP` (자동 입력됨)
   - **토큰 소수 자릿수**: `18` (자동 입력됨)
5. **"맞춤형 토큰 추가"** 클릭
6. **"토큰 가져오기"** 확인

### 토큰 정보
- **이름**: Game Token
- **심볼**: KQTP
- **네트워크**: Sepolia Testnet
- **컨트랙트 주소**: `0xb0d279Ed4eA4C1564b6b4d2D02CE16aEd64Bf8AA`
- **소수점**: 18
- **Etherscan**: [컨트랙트 보기](https://sepolia.etherscan.io/address/0xb0d279Ed4eA4C1564b6b4d2D02CE16aEd64Bf8AA)

### 테스트 토큰 받기

개발/테스트 목적으로 KQTP 토큰이 필요한 경우:
1. Sepolia ETH를 먼저 받으세요: [Sepolia Faucet](https://sepoliafaucet.com/)
2. 프로젝트 관리자에게 KQTP 토큰 전송 요청

## 📊 데이터베이스 스키마

### 주요 테이블
- `nft_records` - NFT 소유권 및 상태
- `transaction_log` - 블록체인 트랜잭션 로그
- `marketplace_listings` - P2P NFT 판매 목록
- `server_shop` - 서버 상점 아이템
- `purchase_history` - 구매 거래 내역
- `auth_sessions` - 인증 세션
- `auth_nonces` - EIP-4361 논스 (재생 공격 방지)

자세한 내용은 `database/README.md` 참조

## 🔐 보안

### 구현된 보안 기능
- ✅ EIP-4361 표준 인증 (nonce + 타임스탬프)
- ✅ JWT 세션 토큰 (24시간 유효)
- ✅ 소유권 검증 (모든 거래 전)
- ✅ 재생 공격 방지 (nonce 재사용 차단)
- ✅ 개인키 환경 변수 관리
- ✅ CORS 설정

### 보안 권장사항
- 프로덕션 환경에서는 강력한 JWT_SECRET 사용
- HTTPS 사용 (현재는 HTTP)
- Rate limiting 추가 권장
- 스마트 컨트랙트 감사 권장

## 🌐 배포된 컨트랙트

### Sepolia 테스트넷
- **GameToken**: [0xb0d279Ed4eA4C1564b6b4d2D02CE16aEd64Bf8AA](https://sepolia.etherscan.io/address/0xb0d279Ed4eA4C1564b6b4d2D02CE16aEd64Bf8AA)
- **GameAssetNFT**: [0x3Db5276c83a7494E0177c525Ccf9781741A1dD67](https://sepolia.etherscan.io/address/0x3Db5276c83a7494E0177c525Ccf9781741A1dD67)

## 📖 사용 가이드

### 개발 환경 설정

1. **Node.js 설치** (18 이상)
2. **MariaDB 설치** (10.11 이상)
3. **Sepolia 테스트넷 ETH 받기**: [Sepolia Faucet](https://sepoliafaucet.com/)
4. **Pinata 계정 생성**: [Pinata](https://pinata.cloud/)

### 서버 실행

```bash
# 개발 모드
npm run server

# 또는 nodemon으로 자동 재시작
npm run server:dev
```

### 스마트 컨트랙트 작업

```bash
# 컴파일
npm run compile

# 로컬 네트워크 실행
npm run node

# 배포
npm run deploy:local      # 로컬
npm run deploy:sepolia    # Sepolia 테스트넷
```

### 테스트 실행

```bash
# IPFS 업로드 테스트
npm run test:ipfs

# 블록체인 민팅/소각 테스트
npm run test:blockchain

# API 엔드포인트 테스트 (서버 실행 필요)
npm run test:api

# 스마트 컨트랙트 테스트
npm test
```

## 📚 API 문서

### 인증 예시

```javascript
// 1. 서명 메시지 생성
const message = `Sign in to Blockchain Game\nTimestamp: ${Date.now()}`;

// 2. MetaMask로 서명
const signature = await ethereum.request({
  method: 'personal_sign',
  params: [message, address]
});

// 3. 서버에 검증 요청
const response = await fetch('http://localhost:3000/api/auth/verify-signature', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, signature, address })
});

const { token } = await response.json();
```

### NFT 민팅 예시

```javascript
const response = await fetch('http://localhost:3000/api/nft/mint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    walletAddress: '0x...',
    itemData: {
      name: 'Legendary Sword',
      description: 'A powerful sword',
      imageBase64: 'data:image/png;base64,...',
      attributes: [
        { trait_type: 'Rarity', value: 'Legendary' },
        { trait_type: 'Attack Power', value: 150 }
      ]
    }
  })
});

const { tokenId, txHash } = await response.json();
```

## 🛠️ 개발 도구

### 유용한 명령어

```bash
# 서버 로그 확인
npm run server

# 데이터베이스 접속
mysql -u bridge_user -p blockchain_game

# 컨트랙트 검증
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>

# 가스 리포트
REPORT_GAS=true npm test
```

### 디버깅

```bash
# 서버 로그 레벨 설정
NODE_ENV=development npm run server

# 데이터베이스 쿼리 로그
# server/config/database.js에서 console.log 추가
```

## 📈 프로젝트 진행 상황

### ✅ 완료된 작업 (64%)
- [x] 스마트 컨트랙트 개발 및 배포
- [x] 데이터베이스 스키마 구축
- [x] Node.js 브릿지 서버 구조
- [x] IPFS 통합 (Pinata)
- [x] 블록체인 서비스
- [x] 게임 클라이언트 API
- [x] 마켓플레이스 인증 (EIP-4361)
- [x] 마켓플레이스 서비스 로직
- [x] 마켓플레이스 API 엔드포인트

### 🚧 진행 중
- [ ] 웹 마켓플레이스 프론트엔드
- [ ] UE5 게임 클라이언트 연동
- [ ] 통합 테스트 및 배포

## 🤝 기여

이 프로젝트는 학습 목적의 팀 프로젝트입니다.

## 📄 라이선스

MIT License

## 🔗 참고 자료

- [Hardhat 문서](https://hardhat.org/docs)
- [OpenZeppelin 컨트랙트](https://docs.openzeppelin.com/contracts)
- [EIP-4361 (Sign-In with Ethereum)](https://eips.ethereum.org/EIPS/eip-4361)
- [ERC-721 NFT 표준](https://eips.ethereum.org/EIPS/eip-721)
- [ERC-20 토큰 표준](https://eips.ethereum.org/EIPS/eip-20)
- [Pinata IPFS 문서](https://docs.pinata.cloud/)
- [Web3.js 문서](https://web3js.readthedocs.io/)

## 📞 문제 해결

### 일반적인 문제

**Q: 서버가 시작되지 않습니다**
- MariaDB가 실행 중인지 확인: `systemctl status mariadb`
- 환경 변수가 올바른지 확인: `.env` 파일 체크
- 포트 3000이 사용 중인지 확인: `netstat -ano | findstr :3000`

**Q: 블록체인 트랜잭션이 실패합니다**
- Sepolia ETH 잔액 확인
- RPC URL이 올바른지 확인
- 가스 가격 확인

**Q: IPFS 업로드가 실패합니다**
- Pinata JWT 토큰 확인
- API 권한 확인 (pinFileToIPFS, pinJSONToIPFS)
- 네트워크 연결 확인

**Q: 데이터베이스 연결 오류**
- MariaDB 서비스 상태 확인
- DB 사용자 권한 확인
- 방화벽 설정 확인

## 👥 팀

블록체인 스터디 텀 프로젝트

---

**⭐ 이 프로젝트가 도움이 되었다면 Star를 눌러주세요!**
