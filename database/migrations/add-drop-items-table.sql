-- ============================================================
-- 게임 드랍 아이템 테이블 추가
-- UE5 게임 클라이언트 연동용
-- ============================================================

USE blockchain_game;

-- 게임 드랍 아이템 테이블
CREATE TABLE IF NOT EXISTS drop_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_address VARCHAR(42) NOT NULL,
  monster_type VARCHAR(50) NOT NULL,
  monster_level INT DEFAULT 1,
  item_name VARCHAR(100) NOT NULL,
  item_grade ENUM('Common', 'Rare', 'Epic', 'Legendary') DEFAULT 'Common',
  status ENUM('pending', 'minted', 'claimed') DEFAULT 'pending',
  dropped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  minted_token_id BIGINT NULL,
  INDEX idx_user_address (user_address),
  INDEX idx_status (status),
  INDEX idx_dropped_at (dropped_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='게임 내 몬스터 드랍 아이템 기록';

SELECT 'drop_items 테이블 생성 완료!' AS message;
