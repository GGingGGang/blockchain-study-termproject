const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 스마트 컨트랙트 배포 시작...\n");

  // 배포자 계정 정보
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 배포자 주소:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 배포자 잔액:", hre.ethers.formatEther(balance), "ETH\n");

  // 1. GameToken (ERC-20) 배포
  console.log("📦 GameToken 컨트랙트 배포 중...");
  const GameToken = await hre.ethers.getContractFactory("GameToken");
  const gameToken = await GameToken.deploy();
  await gameToken.waitForDeployment();
  const gameTokenAddress = await gameToken.getAddress();
  
  console.log("✅ GameToken 배포 완료!");
  console.log("   주소:", gameTokenAddress);
  console.log("   이름:", await gameToken.name());
  console.log("   심볼:", await gameToken.symbol());
  console.log("   초기 공급량:", hre.ethers.formatEther(await gameToken.totalSupply()), "KQTP\n");

  // 2. GameAssetNFT (ERC-721) 배포
  console.log("📦 GameAssetNFT 컨트랙트 배포 중...");
  const GameAssetNFT = await hre.ethers.getContractFactory("GameAssetNFT");
  const gameAssetNFT = await GameAssetNFT.deploy();
  await gameAssetNFT.waitForDeployment();
  const gameAssetNFTAddress = await gameAssetNFT.getAddress();
  
  console.log("✅ GameAssetNFT 배포 완료!");
  console.log("   주소:", gameAssetNFTAddress);
  console.log("   이름:", await gameAssetNFT.name());
  console.log("   심볼:", await gameAssetNFT.symbol());
  console.log();

  // 배포 정보 저장
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      GameToken: {
        address: gameTokenAddress,
        name: await gameToken.name(),
        symbol: await gameToken.symbol(),
        totalSupply: hre.ethers.formatEther(await gameToken.totalSupply())
      },
      GameAssetNFT: {
        address: gameAssetNFTAddress,
        name: await gameAssetNFT.name(),
        symbol: await gameAssetNFT.symbol()
      }
    }
  };

  // deployments 디렉토리 생성
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // 배포 정보를 JSON 파일로 저장
  const filename = `${hre.network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  // 최신 배포 정보도 별도로 저장
  const latestFilepath = path.join(deploymentsDir, `${hre.network.name}-latest.json`);
  fs.writeFileSync(latestFilepath, JSON.stringify(deploymentInfo, null, 2));

  console.log("📄 배포 정보 저장 완료:");
  console.log("   파일:", filepath);
  console.log();

  // 배포 요약
  console.log("=".repeat(60));
  console.log("🎉 배포 완료!");
  console.log("=".repeat(60));
  console.log("\n📋 배포된 컨트랙트 주소:");
  console.log("   GameToken (ERC-20):", gameTokenAddress);
  console.log("   GameAssetNFT (ERC-721):", gameAssetNFTAddress);
  console.log();
  console.log("💡 다음 단계:");
  console.log("   1. .env 파일에 컨트랙트 주소 추가");
  console.log("   2. 브릿지 서버 설정 파일 업데이트");
  console.log("   3. 컨트랙트 검증 (선택사항):");
  console.log(`      npx hardhat verify --network ${hre.network.name} ${gameTokenAddress}`);
  console.log(`      npx hardhat verify --network ${hre.network.name} ${gameAssetNFTAddress}`);
  console.log();
}

// 에러 처리
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 배포 실패:", error);
    process.exit(1);
  });
