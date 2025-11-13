-- ============================================================
-- 데이터베이스 초기화 스크립트
-- 개발 환경용 빠른 설정
-- ============================================================

-- 기존 데이터베이스 삭제 (주의: 모든 데이터 삭제됨)
DROP DATABASE IF EXISTS blockchain_game;

-- 데이터베이스 생성
CREATE DATABASE blockchain_game
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 사용자 생성 및 권한 부여
CREATE USER IF NOT EXISTS 'bridge_user'@'%' IDENTIFIED BY 'bridge_password_2024';
GRANT ALL PRIVILEGES ON blockchain_game.* TO 'bridge_user'@'%';
FLUSH PRIVILEGES;

-- 데이터베이스 선택
USE blockchain_game;

-- 메시지 출력
SELECT 'Database initialized successfully!' AS message;
SELECT 'User: bridge_user' AS user_info;
SELECT 'Password: bridge_password_2024' AS password_info;
SELECT 'Next step: Run schema.sql to create tables' AS next_step;
