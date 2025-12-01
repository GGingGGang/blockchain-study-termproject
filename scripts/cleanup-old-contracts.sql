-- 이전 컨트랙트 주소 관련 데이터 정리
-- 주의: 실행 전 백업 필수!

-- 이전 GameToken 주소
SET @OLD_TOKEN = '0xb0d279Ed4eA4C1564b6b4d2D02CE16aEd64Bf8AA';
-- 이전 GameAssetNFT 주소  
SET @OLD_NFT = '0x3Db5276c83a7494E0177c525Ccf9781741A1dD67';

-- 1. 이전 토큰 관련 트랜잭션 로그 확인
SELECT COUNT(*) as old_token_transactions 
FROM transaction_log 
WHERE from_address = @OLD_TOKEN OR to_address = @OLD_TOKEN;

-- 2. 이전 NFT 관련 레코드 확인
SELECT COUNT(*) as old_nft_records 
FROM nft_records 
WHERE mint_tx_hash IN (
  SELECT tx_hash FROM transaction_log 
  WHERE to_address = @OLD_NFT
);

-- 3. (선택) 이전 데이터 아카이브 테이블로 이동
-- CREATE TABLE IF NOT EXISTS archived_transactions LIKE transaction_log;
-- INSERT INTO archived_transactions 
-- SELECT * FROM transaction_log 
-- WHERE from_address = @OLD_TOKEN OR to_address = @OLD_TOKEN;

-- 4. (선택) 이전 데이터 삭제 - 주의: 복구 불가!
-- DELETE FROM transaction_log 
-- WHERE from_address = @OLD_TOKEN OR to_address = @OLD_TOKEN;

-- 5. 새 컨트랙트 주소 확인
SELECT 
  'MINIMAL_FORWARDER' as contract_type,
  '0xB8C14cA694f0212b94DACFFDD31344Ec1dAC66d6' as address
UNION ALL
SELECT 
  'GAME_TOKEN',
  '0x7032C50EcD4ceE0d5127Ac3aF55e6200b5efC802'
UNION ALL
SELECT 
  'GAME_ASSET_NFT',
  '0x792CD029D3E6BF7312e7E5f5C84B83eAee9B0328';
