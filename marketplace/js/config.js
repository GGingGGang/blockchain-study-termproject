// API 및 블록체인 설정
const CONFIG = {
    // 브릿지 서버 API URL
    API_BASE_URL: 'http://localhost:3000',
    
    // 블록체인 설정
    NETWORK: {
        chainId: '0xaa36a7', // Sepolia testnet (11155111)
        chainName: 'Sepolia Testnet',
        rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
        blockExplorerUrl: 'https://sepolia.etherscan.io'
    },
    
    // 컨트랙트 주소
    CONTRACTS: {
        gameToken: '0xb0d279Ed4eA4C1564b6b4d2D02CE16aEd64Bf8AA',
        gameAssetNFT: '0x3Db5276c83a7494E0177c525Ccf9781741A1dD67'
    },
    
    // 컨트랙트 ABI (간소화 버전)
    ABI: {
        ERC20: [
            'function balanceOf(address owner) view returns (uint256)',
            'function transfer(address to, uint256 amount) returns (bool)',
            'function approve(address spender, uint256 amount) returns (bool)',
            'function allowance(address owner, address spender) view returns (uint256)'
        ],
        ERC721: [
            'function balanceOf(address owner) view returns (uint256)',
            'function ownerOf(uint256 tokenId) view returns (address)',
            'function tokenURI(uint256 tokenId) view returns (string)',
            'function transferFrom(address from, address to, uint256 tokenId)',
            'function approve(address to, uint256 tokenId)',
            'function setApprovalForAll(address operator, bool approved)'
        ]
    },
    
    // IPFS 게이트웨이
    IPFS_GATEWAY: 'https://gateway.pinata.cloud/ipfs/',
    
    // 로컬 스토리지 키
    STORAGE_KEYS: {
        sessionToken: 'marketplace_session_token',
        walletAddress: 'marketplace_wallet_address'
    }
};

// 유틸리티 함수
const Utils = {
    // 주소 축약 (0x1234...5678)
    shortenAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    },
    
    // IPFS URL 변환
    getIPFSUrl(cid) {
        if (!cid) return '';
        if (cid.startsWith('ipfs://')) {
            cid = cid.replace('ipfs://', '');
        }
        return `${CONFIG.IPFS_GATEWAY}${cid}`;
    },
    
    // 날짜 포맷팅
    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('ko-KR');
    },
    
    // 토큰 금액 포맷팅
    formatTokenAmount(amount, decimals = 18) {
        return (Number(amount) / Math.pow(10, decimals)).toFixed(2);
    },
    
    // Wei to Ether
    weiToEther(wei) {
        return ethers.utils.formatEther(wei);
    },
    
    // Ether to Wei
    etherToWei(ether) {
        return ethers.utils.parseEther(ether.toString());
    },
    
    // 트랜잭션 링크
    getTxLink(txHash) {
        return `${CONFIG.NETWORK.blockExplorerUrl}/tx/${txHash}`;
    },
    
    // 알림 표시
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    },
    
    // 로딩 표시
    showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = 'block';
        }
    },
    
    hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = 'none';
        }
    }
};
