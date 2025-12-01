/**
 * 이전 GameToken에서 새 GameToken으로 마이그레이션
 * 사용자의 이전 토큰 잔액을 확인하고 새 토큰을 발행
 */

const hre = require("hardhat");

async function main() {
  console.log("🔄 토큰 마이그레이션 시작...\n");

  const [deployer] = await hre.ethers.getSigners();
  
  // 이전 토큰 주소
  const OLD_TOKEN_ADDRESS = "0xb0d279Ed4eA4C1564b6b4d2D02CE16aEd64Bf8AA";
  // 새 토큰 주소
  const NEW_TOKEN_ADDRESS = "0x7032C50EcD4ceE0d5127Ac3aF55e6200b5efC802";
  
  // 마이그레이션할 주소 목록 (실제 사용자 주소로 교체)
  const usersToMigrate = [
    deployer.address,
    // 다른 사용자 주소 추가...
  ];
  
  // 컨트랙트 연결
  const oldToken = await hre.ethers.getContractAt("GameToken", OLD_TOKEN_ADDRESS);
  const newToken = await hre.ethers.getContractAt("GameToken", NEW_TOKEN_ADDRESS);
  
  console.log("📋 이전 토큰:", OLD_TOKEN_ADDRESS);
  console.log("📋 새 토큰:", NEW_TOKEN_ADDRESS);
  console.log();
  
  for (const userAddress of usersToMigrate) {
    console.log(`👤 처리 중: ${userAddress}`);
    
    // 이전 토큰 잔액 확인
    const oldBalance = await oldToken.balanceOf(userAddress);
    
    if (oldBalance > 0) {
      console.log(`   이전 잔액: ${hre.ethers.formatEther(oldBalance)} KQTP`);
      
      // 새 토큰 발행
      const tx = await newToken.mint(userAddress, oldBalance);
      await tx.wait();
      
      console.log(`   ✅ 새 토큰 발행 완료`);
      console.log(`   트랜잭션: ${tx.hash}`);
    } else {
      console.log(`   잔액 없음, 스킵`);
    }
    console.log();
  }
  
  console.log("✅ 마이그레이션 완료!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 마이그레이션 실패:", error);
    process.exit(1);
  });
