// API 및 블록체인 설정
const CONFIG = {
    // 브릿지 서버 API URL
    API_BASE_URL: 'http://bridge:3000',
    
    // 블록체인 설정
    NETWORK: {
        chainId: '0xaa36a7', // Sepolia testnet (11155111)
        chainName: 'Sepolia Testnet',
        rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
        blockExplorerUrl: 'https://sepolia.etherscan.io'
    },
    
    // 컨트랙트 주소
    CONTRACTS: {
        gameToken: '0x7032C50EcD4ceE0d5127Ac3aF55e6200b5efC802',
        gameAssetNFT: '0x792CD029D3E6BF7312e7E5f5C84B83eAee9B0328',
        minimalForwarder: '0xB8C14cA694f0212b94DACFFDD31344Ec1dAC66d6'
    },
    
    // 서버 지갑 주소 (상점 판매 수익 수령용)
    SERVER_WALLET_ADDRESS: '0xa5ab6C8C0560d51Db844182e286a380916Eb1487',
    
    // IPFS 게이트웨이
    IPFS_GATEWAY: 'https://gateway.pinata.cloud/ipfs/',
    
    // 로컬 스토리지 키
    STORAGE_KEYS: {
        sessionToken: 'game_session_token',
        walletAddress: 'game_wallet_address'
    }
};
