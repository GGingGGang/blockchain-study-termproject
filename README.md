# 블록체인 게임 자산 시스템

Unreal Engine 5 게임의 자산 시스템에 블록체인 기술을 통합하여, 게임 내 아이템과 화폐를 디지털 자산으로 전환하는 프로젝트입니다.

## 프로젝트 구조

```
blockchain-game-assets/
├── contracts/              # 스마트 컨트랙트
│   ├── GameToken.sol      # ERC-20 게임 토큰
│   └── GameAssetNFT.sol   # ERC-721 게임 자산 NFT
├── scripts/               # 배포 스크립트
│   └── deploy.js          # 컨트랙트 배포 스크립트
├── test/                  # 테스트 파일
├── deployments/           # 배포 기록
├── hardhat.config.js      # Hardhat 설정
├── package.json           # 프로젝트 의존성
└── .env.example           # 환경 변수 예시
```

## 설치 및 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 필요한 값을 입력합니다:

```bash
cp .env.example .env
```

`.env` 파일 내용:
```
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key_here
```

**주의사항:**
- `PRIVATE_KEY`는 테스트넷 전용 지갑의 개인키를 사용하세요
- 실제 자산이 있는 지갑의 개인키는 절대 사용하지 마세요
- Sepolia 테스트넷 ETH는 [Sepolia Faucet](https://sepoliafaucet.com/)에서 받을 수 있습니다

## 스마트 컨트랙트

### GameToken (ERC-20)

게임 내 화폐로 사용되는 ERC-20 토큰입니다.

**주요 기능:**
- 초기 공급량: 1,000,000 KQTP
- `mint()`: 관리자가 새로운 토큰 발행
- `burn()`: 토큰 소각

### GameAssetNFT (ERC-721)

게임 내 아이템을 NFT로 변환하는 ERC-721 컨트랙트입니다.

**주요 기능:**
- `mint()`: 관리자가 NFT 발행 (IPFS 메타데이터 URI 포함)
- `burn()`: 관리자가 NFT 소각
- `tokenURI()`: NFT 메타데이터 URI 조회

## 사용 방법

### 컨트랙트 컴파일

```bash
npm run compile
```

### 로컬 네트워크에서 테스트

1. 로컬 Hardhat 노드 실행:
```bash
npm run node
```

2. 다른 터미널에서 배포:
```bash
npm run deploy:local
```

### Sepolia 테스트넷에 배포

```bash
npm run deploy:sepolia
```

배포가 완료되면 `deployments/` 디렉토리에 배포 정보가 저장됩니다.

### 컨트랙트 검증 (선택사항)

Etherscan에서 컨트랙트 소스 코드를 검증하려면:

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## 배포 후 작업

1. `deployments/sepolia-latest.json` 파일에서 배포된 컨트랙트 주소 확인
2. 브릿지 서버의 환경 변수에 컨트랙트 주소 추가
3. 컨트랙트 ABI를 브릿지 서버에 복사 (`artifacts/contracts/` 디렉토리)

## 테스트

```bash
npm test
```

## 보안 고려사항

- 이 프로젝트는 학습 목적의 테스트넷 배포용입니다
- 프로덕션 환경에서는 추가적인 보안 감사가 필요합니다
- 개인키는 절대 Git에 커밋하지 마세요 (`.gitignore`에 `.env` 포함됨)

## 라이선스

MIT
