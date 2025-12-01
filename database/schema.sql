-- ============================================================
-- 블록체인 게임 자산 시스템 데이터베이스 스키마
-- MariaDB 10.11+
-- ============================================================

-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS blockchain_game
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE blockchain_game;

-- ============================================================
-- 1. 기본 NFT 관리 테이블
-- ============================================================

-- NFT 레코드 테이블
CREATE TABLE IF NOT EXISTS nft_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token_id BIGINT UNIQUE NOT NULL,
  owner_address VARCHAR(42) NOT NULL,
  ipfs_cid VARCHAR(100) NOT NULL,
  mint_tx_hash VARCHAR(66) NULL COMMENT '민팅 트랜잭션 해시 (동기화 시 NULL 가능)',
  burn_tx_hash VARCHAR(66),
  status ENUM('active', 'burned') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_owner (owner_address),
  INDEX idx_status (status),
  INDEX idx_token_id (token_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='NFT 소유권 및 상태 기록';

-- 트랜잭션 로그 테이블
CREATE TABLE IF NOT EXISTS transaction_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tx_hash VARCHAR(66) UNIQUE NOT NULL,
  tx_type ENUM('mint', 'burn', 'transfer', 'payment') NOT NULL,
  token_id BIGINT,
  from_address VARCHAR(42),
  to_address VARCHAR(42),
  status ENUM('pending', 'confirmed', 'failed') NOT NULL,
  block_number INT,
  gas_used INT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tx_hash (tx_hash),
  INDEX idx_status (status),
  INDEX idx_tx_type (tx_type),
  INDEX idx_token_id (token_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='블록체인 트랜잭션 로그';

-- 인증 세션 테이블
CREATE TABLE IF NOT EXISTS auth_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  session_type ENUM('game', 'marketplace') NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token),
  INDEX idx_wallet (wallet_address),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='사용자 인증 세션 관리';

-- ============================================================
-- 2. 마켓플레이스 테이블
-- ============================================================

-- 마켓플레이스 판매 목록 테이블
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token_id BIGINT UNIQUE NOT NULL,
  seller_address VARCHAR(42) NOT NULL,
  buyer_address VARCHAR(42),
  price DECIMAL(20, 8) NOT NULL,
  status ENUM('active', 'sold', 'cancelled') DEFAULT 'active',
  listed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sold_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  INDEX idx_status (status),
  INDEX idx_seller (seller_address),
  INDEX idx_buyer (buyer_address),
  INDEX idx_price (price),
  INDEX idx_listed_at (listed_at),
  FOREIGN KEY (token_id) REFERENCES nft_records(token_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='P2P NFT 거래 판매 목록';

-- 서버 상점 테이블
CREATE TABLE IF NOT EXISTS server_shop (
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
  INDEX idx_active (active),
  INDEX idx_price (price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='서버 운영 상점 아이템';

-- 구매 내역 테이블
CREATE TABLE IF NOT EXISTS purchase_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  listing_id INT,
  item_id INT,
  token_id BIGINT NOT NULL,
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
  INDEX idx_date (purchased_at),
  INDEX idx_token_id (token_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='모든 구매 거래 내역';

-- 인증 논스 테이블 (재생 공격 방지)
CREATE TABLE IF NOT EXISTS auth_nonces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  nonce VARCHAR(64) UNIQUE NOT NULL,
  message TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_nonce (nonce),
  INDEX idx_wallet (wallet_address),
  INDEX idx_expires (expires_at),
  INDEX idx_used (used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='EIP-4361 인증 논스 관리';

-- ============================================================
-- 3. 초기 데이터 삽입
-- ============================================================

-- 서버 상점 샘플 데이터 (단순화)
-- 기존 데이터 삭제
DELETE FROM server_shop;

-- Item 1 - 150 KQTP, 10개 재고
INSERT INTO server_shop (name, description, item_type, price, stock, image_url, rarity, summon_uses) VALUES
('Item 1', 'Simple test item for marketplace', 'summon_ticket', 150.00000000, 10, 'https://via.placeholder.com/200', 'Common', 1);

-- ============================================================
-- 4. 뷰 생성 (선택사항)
-- ============================================================

-- 활성 NFT 목록 뷰
CREATE OR REPLACE VIEW active_nfts AS
SELECT 
  nr.token_id,
  nr.owner_address,
  nr.ipfs_cid,
  nr.created_at,
  ml.id AS listing_id,
  ml.price AS listing_price,
  ml.status AS listing_status
FROM nft_records nr
LEFT JOIN marketplace_listings ml ON nr.token_id = ml.token_id AND ml.status = 'active'
WHERE nr.status = 'active';

-- 마켓플레이스 활성 판매 목록 뷰
CREATE OR REPLACE VIEW active_marketplace_listings AS
SELECT 
  ml.id AS listing_id,
  ml.token_id,
  ml.seller_address,
  ml.price,
  ml.listed_at,
  nr.ipfs_cid,
  nr.owner_address
FROM marketplace_listings ml
INNER JOIN nft_records nr ON ml.token_id = nr.token_id
WHERE ml.status = 'active' AND nr.status = 'active';

-- ============================================================
-- 5. 저장 프로시저 (선택사항)
-- ============================================================

DELIMITER //

-- NFT 민팅 기록 프로시저
CREATE PROCEDURE IF NOT EXISTS record_nft_mint(
  IN p_token_id INT,
  IN p_owner_address VARCHAR(42),
  IN p_ipfs_cid VARCHAR(100),
  IN p_tx_hash VARCHAR(66)
)
BEGIN
  -- NFT 레코드 삽입
  INSERT INTO nft_records (token_id, owner_address, ipfs_cid, mint_tx_hash, status)
  VALUES (p_token_id, p_owner_address, p_ipfs_cid, p_tx_hash, 'active');
  
  -- 트랜잭션 로그 기록
  INSERT INTO transaction_log (tx_hash, tx_type, token_id, to_address, status)
  VALUES (p_tx_hash, 'mint', p_token_id, p_owner_address, 'confirmed');
END //

-- NFT 소각 기록 프로시저
CREATE PROCEDURE IF NOT EXISTS record_nft_burn(
  IN p_token_id INT,
  IN p_tx_hash VARCHAR(66)
)
BEGIN
  -- NFT 상태 업데이트
  UPDATE nft_records
  SET status = 'burned', burn_tx_hash = p_tx_hash
  WHERE token_id = p_token_id;
  
  -- 트랜잭션 로그 기록
  INSERT INTO transaction_log (tx_hash, tx_type, token_id, status)
  VALUES (p_tx_hash, 'burn', p_token_id, 'confirmed');
END //

DELIMITER ;

-- ============================================================
-- 완료 메시지
-- ============================================================

SELECT 'Database schema created successfully!' AS message;
