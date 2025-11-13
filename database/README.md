# 데이터베이스 설정 가이드

블록체인 게임 자산 시스템의 MariaDB 데이터베이스 설정 방법입니다.

## 📋 요구사항

- MariaDB 10.11 이상
- 충분한 디스크 공간 (최소 1GB 권장)

## 🚀 빠른 시작

### 1. MariaDB 설치 (Rocky Linux)

```bash
# MariaDB 설치
sudo dnf install -y mariadb-server mariadb

# 서비스 시작
sudo systemctl start mariadb
sudo systemctl enable mariadb

# 보안 설정
sudo mysql_secure_installation
```

### 2. 데이터베이스 초기화

```bash
# root 계정으로 MariaDB 접속
mysql -u root -p

# 초기화 스크립트 실행
source /path/to/database/init.sql

# 스키마 생성
source /path/to/database/schema.sql

# 샘플 데이터 삽입 (선택사항)
source /path/to/database/seed.sql
```

### 3. 연결 테스트

```bash
# bridge_user로 접속 테스트
mysql -u bridge_user -p blockchain_game

# 테이블 확인
SHOW TABLES;

# 서버 상점 데이터 확인
SELECT * FROM server_shop;
```

## 📁 파일 설명

### `init.sql`
- 데이터베이스 생성
- 사용자 계정 생성 (`bridge_user`)
- 권한 설정

### `schema.sql`
- 전체 테이블 스키마 정의
- 인덱스 및 외래키 설정
- 뷰 및 저장 프로시저 생성

### `seed.sql`
- 서버 상점 샘플 데이터
- 테스트용 데이터 (주석 처리됨)

## 🗂️ 테이블 구조

### 기본 NFT 관리
- `nft_records` - NFT 소유권 및 상태
- `transaction_log` - 블록체인 트랜잭션 로그
- `auth_sessions` - 사용자 인증 세션

### 마켓플레이스
- `marketplace_listings` - P2P NFT 판매 목록
- `server_shop` - 서버 운영 상점
- `purchase_history` - 구매 거래 내역
- `auth_nonces` - 인증 논스 (재생 공격 방지)

## 🔧 환경 변수 설정

`.env` 파일에 데이터베이스 연결 정보를 추가하세요:

```env
# 데이터베이스 설정
DB_HOST=localhost
DB_PORT=3306
DB_NAME=blockchain_game
DB_USER=bridge_user
DB_PASSWORD=bridge_password_2024
```

## 📊 유용한 쿼리

### 활성 NFT 목록 조회
```sql
SELECT * FROM active_nfts;
```

### 마켓플레이스 판매 목록
```sql
SELECT * FROM active_marketplace_listings;
```

### 최근 거래 내역
```sql
SELECT * FROM purchase_history 
ORDER BY purchased_at DESC 
LIMIT 10;
```

### 서버 상점 재고 확인
```sql
SELECT name, stock, price 
FROM server_shop 
WHERE active = TRUE AND stock > 0;
```

## 🔒 보안 권장사항

1. **프로덕션 환경에서는 강력한 비밀번호 사용**
   ```sql
   ALTER USER 'bridge_user'@'%' IDENTIFIED BY 'strong_password_here';
   ```

2. **특정 IP에서만 접근 허용**
   ```sql
   CREATE USER 'bridge_user'@'192.168.1.100' IDENTIFIED BY 'password';
   ```

3. **정기적인 백업**
   ```bash
   mysqldump -u bridge_user -p blockchain_game > backup.sql
   ```

## 🐛 문제 해결

### 연결 오류
```bash
# MariaDB 상태 확인
sudo systemctl status mariadb

# 방화벽 설정 확인
sudo firewall-cmd --list-all
```

### 권한 오류
```sql
-- 권한 재설정
GRANT ALL PRIVILEGES ON blockchain_game.* TO 'bridge_user'@'%';
FLUSH PRIVILEGES;
```

### 테이블 초기화
```sql
-- 모든 테이블 삭제 후 재생성
DROP DATABASE blockchain_game;
source init.sql
source schema.sql
```

## 📈 성능 최적화

### 인덱스 확인
```sql
SHOW INDEX FROM nft_records;
```

### 쿼리 성능 분석
```sql
EXPLAIN SELECT * FROM marketplace_listings WHERE status = 'active';
```

### 느린 쿼리 로그 활성화
```ini
# /etc/my.cnf.d/server.cnf
[mysqld]
slow_query_log = 1
slow_query_log_file = /var/log/mariadb/slow-query.log
long_query_time = 2
```

## 📞 지원

문제가 발생하면 프로젝트 이슈 트래커에 문의하세요.
