-- 서버 상점 아이템 업데이트
-- 기존 아이템 삭제 및 새로운 아이템 추가

USE blockchain_game;

-- 기존 상점 아이템 삭제
DELETE FROM server_shop;

-- Item 1 - 150 KQTP, 10개 재고
INSERT INTO server_shop (name, description, item_type, price, stock, image_url, rarity, summon_uses) VALUES
('Item 1', 'Simple test item for marketplace', 'summon_ticket', 150.00000000, 10, 'https://via.placeholder.com/200', 'Common', 1);

SELECT 'Shop items updated successfully!' AS message;
