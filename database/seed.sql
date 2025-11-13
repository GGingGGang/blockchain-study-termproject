-- ============================================================
-- 샘플 데이터 삽입 스크립트
-- 개발 및 테스트용
-- ============================================================

USE blockchain_game;

-- ============================================================
-- 1. 서버 상점 추가 아이템
-- ============================================================

INSERT INTO server_shop (name, description, item_type, price, stock, image_url, rarity, summon_uses) VALUES
('타이탄 소환권', '고대 타이탄을 소환할 수 있는 희귀한 티켓입니다.', 'summon_ticket', 200.00000000, 10, 'https://example.com/titan.png', 'Mythic', 1),
('요정 여왕 소환권', '요정 여왕과 그녀의 수행원들을 소환합니다.', 'summon_ticket', 150.00000000, 15, 'https://example.com/fairy-queen.png', 'Legendary', 1),
('늑대 무리 소환권', '늑대 무리를 소환할 수 있는 티켓입니다.', 'summon_ticket', 30.00000000, 80, 'https://example.com/wolf-pack.png', 'Uncommon', 5),
('골렘 소환권', '강력한 돌 골렘을 소환합니다.', 'summon_ticket', 70.00000000, 40, 'https://example.com/golem.png', 'Rare', 1),
('스켈레톤 워리어 소환권', '스켈레톤 전사들을 소환합니다.', 'summon_ticket', 20.00000000, 90, 'https://example.com/skeleton.png', 'Common', 3);

-- ============================================================
-- 2. 테스트용 NFT 레코드 (선택사항)
-- ============================================================

-- 주의: 실제 블록체인 트랜잭션 없이 테스트용으로만 사용
-- INSERT INTO nft_records (token_id, owner_address, ipfs_cid, mint_tx_hash, status) VALUES
-- (1, '0xa5ab6C8C0560d51Db844182e286a380916Eb1487', 'QmTest123', '0xtest123', 'active'),
-- (2, '0xa5ab6C8C0560d51Db844182e286a380916Eb1487', 'QmTest456', '0xtest456', 'active');

-- ============================================================
-- 3. 테스트용 마켓플레이스 판매 목록 (선택사항)
-- ============================================================

-- INSERT INTO marketplace_listings (token_id, seller_address, price, status) VALUES
-- (1, '0xa5ab6C8C0560d51Db844182e286a380916Eb1487', 50.00000000, 'active');

-- ============================================================
-- 완료 메시지
-- ============================================================

SELECT 'Sample data inserted successfully!' AS message;
SELECT COUNT(*) AS total_shop_items FROM server_shop;
