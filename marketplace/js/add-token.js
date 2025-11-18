/**
 * MetaMask에 KQTP 토큰 추가
 */
async function addKQTPToken() {
    try {
        if (!window.ethereum) {
            throw new Error('MetaMask가 설치되어 있지 않습니다.');
        }

        const tokenAddress = CONFIG.CONTRACTS.gameToken;
        const tokenSymbol = 'KQTP';
        const tokenDecimals = 18;
        const tokenImage = 'https://raw.githubusercontent.com/GGingGGang/blockchain-study-termproject/main/assets/kqtp-logo.png';

        const wasAdded = await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: tokenAddress,
                    symbol: tokenSymbol,
                    decimals: tokenDecimals,
                    image: tokenImage,
                },
            },
        });

        if (wasAdded) {
            Utils.showNotification('KQTP 토큰이 MetaMask에 추가되었습니다!', 'success');
            console.log('✅ KQTP 토큰 추가 성공');
        } else {
            Utils.showNotification('토큰 추가가 취소되었습니다.', 'info');
        }
    } catch (error) {
        console.error('토큰 추가 실패:', error);
        throw error;
    }
}
