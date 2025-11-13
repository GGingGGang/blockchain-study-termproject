# 요구사항 문서

## 소개

이 시스템은 Unreal Engine 5 기반 게임의 자산 시스템에 블록체인 기술을 통합하여, 게임 내 아이템과 화폐를 디지털 자산으로 전환합니다. 운영자 중심 구조에서 플레이어 중심 구조로 전환하고, 게임 자산의 투명한 관리를 통해 조작이나 부패를 방지하는 것을 목표로 합니다.

## 용어집

- **UE5_Client**: Unreal Engine 5로 구현된 게임 클라이언트 애플리케이션
- **Web_Client**: HTML/CSS/JavaScript로 구현된 웹 마켓플레이스 클라이언트
- **Bridge_Server**: Node.js 기반의 게임 클라이언트와 블록체인 네트워크 간 중개 서버
- **NFT_Contract**: ERC-721 표준을 따르는 Solidity 스마트 컨트랙트
- **Player_Wallet**: MetaMask를 통해 관리되는 플레이어의 블록체인 지갑
- **IPFS_Storage**: 분산 파일 저장 시스템 (InterPlanetary File System)
- **Sepolia_Network**: 이더리움 테스트넷 블록체인 네트워크
- **Token_Metadata**: NFT의 속성 정보를 담은 JSON 형식 데이터
- **CID**: IPFS에서 파일을 식별하는 고유 콘텐츠 식별자 (Content Identifier)
- **Database_System**: MariaDB 기반의 오프체인 기록 관리 시스템
- **Marketplace_Table**: 플레이어 간 NFT 거래 정보를 저장하는 데이터베이스 테이블
- **Server_Shop_Table**: 서버가 판매하는 아이템 정보를 저장하는 데이터베이스 테이블
- **Purchase_History_Table**: 모든 구매 기록을 저장하는 데이터베이스 테이블

## 요구사항

### 요구사항 1: 탈중앙화 인증

**사용자 스토리:** 플레이어로서, 중앙화된 계정 시스템 없이 내 블록체인 지갑으로 게임에 로그인하고 싶습니다. 그래야 내 디지털 자산에 대한 완전한 소유권을 가질 수 있습니다.

#### 승인 기준

1. WHEN 플레이어가 로그인 버튼을 클릭할 때, THE UE5_Client SHALL MetaMask 확장 프로그램을 통해 EIP-4361 표준 서명 요청을 생성한다
2. THE Player_Wallet SHALL 플레이어의 개인키로 서명된 메시지를 UE5_Client에게 반환한다
3. THE Bridge_Server SHALL 서명된 메시지를 검증하고 5초 이내에 인증 토큰을 발급한다
4. IF 서명 검증이 실패할 경우, THEN THE Bridge_Server SHALL 명확한 오류 메시지와 함께 인증을 거부한다
5. THE UE5_Client SHALL 인증 성공 시 플레이어의 지갑 주소를 게임 세션에 연결한다

### 요구사항 2: NFT 민팅 (아이템 생성)

**사용자 스토리:** 플레이어로서, 게임 내에서 특별한 아이템을 획득했을 때 그것이 자동으로 내 소유의 NFT로 변환되기를 원합니다. 그래야 게임 밖에서도 내 자산을 확인하고 거래할 수 있습니다.

#### 승인 기준

1. WHEN 플레이어가 게임 내에서 민팅 가능한 아이템을 획득할 때, THE UE5_Client SHALL 아이템 데이터와 함께 민팅 요청을 Bridge_Server에게 전송한다
2. THE Bridge_Server SHALL 아이템 이미지와 메타데이터를 IPFS_Storage에 업로드하고 CID를 10초 이내에 획득한다
3. THE Bridge_Server SHALL NFT_Contract의 mint() 함수를 호출하여 TokenID, CID, 소유자 주소를 Sepolia_Network에 기록한다
4. THE NFT_Contract SHALL 고유한 TokenID를 생성하고 Player_Wallet 주소에 소유권을 할당한다
5. THE Bridge_Server SHALL 민팅 트랜잭션 해시와 TokenID를 Database_System에 기록한다
6. THE UE5_Client SHALL 민팅 완료 알림을 플레이어에게 표시한다
7. IF IPFS 업로드가 3회 연속 실패할 경우, THEN THE Bridge_Server SHALL 민팅 프로세스를 중단하고 오류를 로깅한다

### 요구사항 3: NFT 소각 (아이템 파괴)

**사용자 스토리:** 플레이어로서, 게임 내에서 아이템을 소비하거나 파괴했을 때 해당 NFT도 블록체인에서 제거되기를 원합니다. 그래야 실제 게임 상태와 블록체인 기록이 일치합니다.

#### 승인 기준

1. WHEN 플레이어가 게임 내에서 NFT 연결 아이템을 파괴할 때, THE UE5_Client SHALL TokenID와 함께 소각 요청을 Bridge_Server에게 전송한다
2. THE Bridge_Server SHALL Database_System에서 TokenID의 소유권을 검증한다
3. IF 요청한 플레이어가 TokenID의 소유자가 아닐 경우, THEN THE Bridge_Server SHALL 소각 요청을 거부하고 권한 오류를 반환한다
4. THE Bridge_Server SHALL NFT_Contract의 burn() 함수를 호출하여 해당 TokenID를 Sepolia_Network에서 제거한다
5. THE NFT_Contract SHALL TokenID의 소유권 기록을 삭제하고 총 공급량을 1 감소시킨다
6. THE Bridge_Server SHALL 소각 트랜잭션을 Database_System에 기록한다
7. THE UE5_Client SHALL 소각 완료 확인을 플레이어에게 표시한다

### 요구사항 4: NFT 메타데이터 관리

**사용자 스토리:** 플레이어로서, 내 NFT의 상세 정보(이미지, 속성, 설명)를 MetaMask나 OpenSea 같은 외부 플랫폼에서도 볼 수 있기를 원합니다. 그래야 내 자산의 가치를 확인할 수 있습니다.

#### 승인 기준

1. THE Token_Metadata SHALL JSON 형식으로 name, description, image, attributes 필드를 포함한다
2. THE Bridge_Server SHALL Token_Metadata를 생성할 때 ERC-721 메타데이터 표준을 준수한다
3. THE Token_Metadata의 image 필드 SHALL IPFS_Storage에 저장된 이미지의 CID를 "ipfs://{CID}" 형식으로 참조한다
4. THE NFT_Contract SHALL tokenURI() 함수를 구현하여 TokenID에 해당하는 메타데이터 URI를 반환한다
5. WHEN 외부 플랫폼이 tokenURI()를 호출할 때, THE NFT_Contract SHALL 2초 이내에 IPFS 메타데이터 경로를 반환한다
6. THE IPFS_Storage SHALL 업로드된 메타데이터와 이미지를 영구적으로 보존한다

### 요구사항 5: 트랜잭션 상태 추적

**사용자 스토리:** 플레이어로서, 내 민팅이나 소각 요청이 블록체인에서 처리되는 과정을 실시간으로 확인하고 싶습니다. 그래야 트랜잭션이 성공했는지 실패했는지 알 수 있습니다.

#### 승인 기준

1. WHEN Bridge_Server가 블록체인 트랜잭션을 제출할 때, THE Bridge_Server SHALL 트랜잭션 해시를 즉시 UE5_Client에게 반환한다
2. THE Bridge_Server SHALL 트랜잭션 상태를 5초 간격으로 Sepolia_Network에서 조회한다
3. WHILE 트랜잭션이 pending 상태일 때, THE UE5_Client SHALL 진행 중 표시를 플레이어에게 보여준다
4. WHEN 트랜잭션이 confirmed 상태가 될 때, THE Bridge_Server SHALL 최종 상태를 UE5_Client에게 전송한다
5. IF 트랜잭션이 5분 이내에 confirmed 되지 않을 경우, THEN THE Bridge_Server SHALL 타임아웃 경고를 발생시킨다
6. THE Database_System SHALL 모든 트랜잭션의 해시, 상태, 타임스탬프를 기록한다

### 요구사항 6: 오류 처리 및 복구

**사용자 스토리:** 플레이어로서, 네트워크 오류나 가스 부족 같은 문제가 발생했을 때 명확한 안내를 받고 싶습니다. 그래야 문제를 해결하고 다시 시도할 수 있습니다.

#### 승인 기준

1. IF 블록체인 트랜잭션이 가스 부족으로 실패할 경우, THEN THE Bridge_Server SHALL 권장 가스 가격과 함께 오류 메시지를 반환한다
2. IF IPFS_Storage 연결이 실패할 경우, THEN THE Bridge_Server SHALL 3회까지 재시도를 수행한다
3. IF Sepolia_Network 연결이 끊어질 경우, THEN THE Bridge_Server SHALL 대체 RPC 엔드포인트로 자동 전환한다
4. THE Bridge_Server SHALL 모든 오류를 심각도 수준(critical, warning, info)과 함께 로깅한다
5. THE UE5_Client SHALL 사용자 친화적인 오류 메시지를 한국어로 표시한다
6. THE Bridge_Server SHALL 실패한 트랜잭션을 Database_System에 기록하고 수동 복구를 위한 관리자 인터페이스를 제공한다

### 요구사항 7: 보안 및 권한 관리

**사용자 스토리:** 플레이어로서, 내 개인키가 안전하게 보호되고 권한 없는 사람이 내 NFT를 조작할 수 없기를 원합니다. 그래야 내 자산이 안전합니다.

#### 승인 기준

1. THE Bridge_Server SHALL 플레이어의 개인키를 저장하거나 전송하지 않는다
2. THE Bridge_Server SHALL 환경 변수를 통해 관리자 개인키를 안전하게 관리한다
3. WHEN Bridge_Server가 민팅이나 소각을 수행할 때, THE Bridge_Server SHALL 요청한 플레이어의 지갑 주소를 검증한다
4. THE NFT_Contract SHALL onlyOwner 수정자를 사용하여 관리자 전용 함수를 보호한다
5. THE Bridge_Server SHALL 모든 API 요청에 대해 JWT 토큰 기반 인증을 수행한다
6. THE Bridge_Server SHALL 비정상적인 요청 패턴(예: 1분에 100회 이상)을 감지하고 차단한다

### 요구사항 8: 스마트 컨트랙트 표준 준수

**사용자 스토리:** 플레이어로서, 내 NFT가 MetaMask, OpenSea 같은 표준 플랫폼에서 자동으로 인식되기를 원합니다. 그래야 별도 설정 없이 내 자산을 관리할 수 있습니다.

#### 승인 기준

1. THE NFT_Contract SHALL ERC-721 표준의 모든 필수 함수(balanceOf, ownerOf, transferFrom, approve, setApprovalForAll)를 구현한다
2. THE NFT_Contract SHALL ERC-721 Metadata 확장을 구현하여 name(), symbol(), tokenURI() 함수를 제공한다
3. THE NFT_Contract SHALL ERC-165 인터페이스 감지를 지원한다
4. THE NFT_Contract SHALL Transfer 이벤트를 표준 형식으로 발생시킨다
5. WHEN NFT가 민팅될 때, THE NFT_Contract SHALL Transfer 이벤트를 address(0)에서 소유자 주소로 발생시킨다
6. WHEN NFT가 소각될 때, THE NFT_Contract SHALL Transfer 이벤트를 소유자 주소에서 address(0)로 발생시킨다

### 요구사항 9: 오프체인 데이터 동기화

**사용자 스토리:** 개발자로서, 게임 서버에서 빠른 조회를 위해 블록체인 데이터의 복사본을 데이터베이스에 유지하고 싶습니다. 그래야 매번 블록체인을 조회하지 않고도 플레이어 자산을 확인할 수 있습니다.

#### 승인 기준

1. THE Database_System SHALL TokenID, 소유자 주소, CID, 민팅 시간, 트랜잭션 해시를 저장한다
2. WHEN NFT가 민팅될 때, THE Bridge_Server SHALL 트랜잭션 확인 후 1초 이내에 Database_System을 업데이트한다
3. WHEN NFT가 소각될 때, THE Bridge_Server SHALL Database_System에서 해당 레코드를 삭제하거나 비활성화 표시를 한다
4. THE Bridge_Server SHALL 매 시간마다 Database_System과 Sepolia_Network의 데이터 일관성을 검증한다
5. IF 불일치가 발견될 경우, THEN THE Bridge_Server SHALL 경고를 로깅하고 관리자에게 알림을 전송한다
6. THE Database_System SHALL 모든 변경 사항에 대한 감사 로그를 유지한다

### 요구사항 10: 성능 및 확장성

**사용자 스토리:** 플레이어로서, 많은 사용자가 동시에 NFT를 민팅하더라도 빠르고 안정적인 서비스를 경험하고 싶습니다. 그래야 게임 플레이가 중단되지 않습니다.

#### 승인 기준

1. THE Bridge_Server SHALL 동시에 최소 50개의 민팅 요청을 처리할 수 있다
2. THE Bridge_Server SHALL 민팅 요청을 큐에 저장하고 순차적으로 처리한다
3. WHEN 큐에 100개 이상의 요청이 대기 중일 때, THE Bridge_Server SHALL 새로운 요청을 거부하고 재시도 안내를 제공한다
4. THE Bridge_Server SHALL 각 민팅 작업을 15초 이내에 완료한다 (IPFS 업로드 + 블록체인 트랜잭션)
5. THE IPFS_Storage SHALL Pinata 또는 Web3.Storage API를 사용하여 업로드 속도를 최적화한다
6. THE Bridge_Server SHALL 응답 시간과 처리량을 모니터링하고 메트릭을 로깅한다

### 요구사항 11: 웹 마켓플레이스 인증

**사용자 스토리:** 플레이어로서, 웹 브라우저에서 MetaMask 지갑으로 마켓플레이스에 로그인하고 싶습니다. 그래야 내 NFT를 거래하고 아이템을 구매할 수 있습니다.

#### 승인 기준

1. WHEN 플레이어가 웹 마켓플레이스에서 로그인 버튼을 클릭할 때, THE Web_Client SHALL MetaMask 확장 프로그램을 통해 EIP-4361 표준 서명 요청을 생성한다
2. THE Web_Client SHALL 서명 요청 메시지에 타임스탬프와 nonce를 포함하여 재생 공격을 방지한다
3. THE Player_Wallet SHALL 플레이어의 개인키로 서명된 메시지를 Web_Client에게 반환한다
4. THE Bridge_Server SHALL 서명된 메시지를 검증하고 3초 이내에 세션 토큰을 발급한다
5. THE Web_Client SHALL 세션 토큰을 브라우저 로컬 스토리지에 저장한다
6. IF 서명 검증이 실패할 경우, THEN THE Bridge_Server SHALL 명확한 오류 메시지와 함께 인증을 거부한다
7. THE Bridge_Server SHALL 세션 토큰의 유효 기간을 24시간으로 설정한다

### 요구사항 12: P2P NFT 거래 마켓플레이스

**사용자 스토리:** 플레이어로서, 웹 마켓플레이스에서 내가 소유한 NFT 아이템을 다른 플레이어에게 판매하고 싶습니다. 그래야 게임 내 자산으로 수익을 얻을 수 있습니다.

#### 승인 기준

1. WHEN 플레이어가 NFT를 판매 등록할 때, THE Web_Client SHALL TokenID와 판매 가격(토큰 단위)을 Bridge_Server에게 전송한다
2. THE Bridge_Server SHALL Database_System에서 플레이어의 NFT 소유권을 검증한다
3. IF 플레이어가 TokenID의 소유자가 아닐 경우, THEN THE Bridge_Server SHALL 판매 등록을 거부하고 권한 오류를 반환한다
4. THE Bridge_Server SHALL 판매 정보(TokenID, 판매자 주소, 가격, 등록 시간)를 Marketplace_Table에 저장한다
5. THE Web_Client SHALL 등록된 판매 NFT 목록을 가격순, 최신순으로 정렬하여 표시한다
6. WHEN 구매자가 NFT 구매 버튼을 클릭할 때, THE Web_Client SHALL 구매 트랜잭션을 생성하고 MetaMask를 통해 서명을 요청한다
7. THE Bridge_Server SHALL 구매자의 토큰 잔액이 판매 가격 이상인지 검증한다
8. THE Bridge_Server SHALL NFT_Contract의 transferFrom() 함수를 호출하여 소유권을 구매자에게 이전한다
9. THE Bridge_Server SHALL 판매 대금을 판매자 지갑으로 전송한다
10. THE Bridge_Server SHALL 거래 완료 후 Marketplace_Table에서 해당 판매 항목을 제거한다
11. THE Web_Client SHALL 거래 완료 알림을 구매자와 판매자에게 표시한다
12. IF 거래 중 오류가 발생할 경우, THEN THE Bridge_Server SHALL 트랜잭션을 롤백하고 오류를 로깅한다

### 요구사항 13: 서버 판매 몬스터 소환권

**사용자 스토리:** 플레이어로서, 웹 마켓플레이스에서 서버가 판매하는 몬스터 소환권을 구매하고 싶습니다. 그래야 게임에서 특별한 몬스터를 소환할 수 있습니다.

#### 승인 기준

1. THE Bridge_Server SHALL 몬스터 소환권 정보(종류, 가격, 재고)를 Server_Shop_Table에 저장한다
2. THE Web_Client SHALL 서버 상점 페이지에서 구매 가능한 몬스터 소환권 목록을 표시한다
3. WHEN 플레이어가 소환권 구매 버튼을 클릭할 때, THE Web_Client SHALL 구매 요청을 Bridge_Server에게 전송한다
4. THE Bridge_Server SHALL 플레이어의 토큰 잔액이 소환권 가격 이상인지 검증한다
5. THE Bridge_Server SHALL 소환권의 재고가 1개 이상인지 확인한다
6. IF 재고가 없을 경우, THEN THE Bridge_Server SHALL 품절 메시지를 반환한다
7. THE Bridge_Server SHALL 플레이어 지갑에서 서버 지갑으로 토큰을 전송한다
8. THE Bridge_Server SHALL NFT_Contract의 mint() 함수를 호출하여 소환권 NFT를 플레이어에게 발급한다
9. THE Bridge_Server SHALL Server_Shop_Table에서 해당 소환권의 재고를 1 감소시킨다
10. THE Bridge_Server SHALL 구매 기록을 Purchase_History_Table에 저장한다
11. THE Web_Client SHALL 구매 완료 알림과 함께 발급된 NFT 정보를 표시한다
12. THE Bridge_Server SHALL 소환권 NFT 메타데이터에 몬스터 종류와 소환 가능 횟수를 포함한다
