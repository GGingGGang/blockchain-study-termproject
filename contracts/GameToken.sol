// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GameToken
 * @dev ERC-20 게임 토큰 컨트랙트
 * 게임 내 화폐로 사용되며, 마켓플레이스에서 NFT 거래 시 결제 수단으로 활용됩니다.
 */
contract GameToken is ERC20, Ownable {
    /**
     * @dev 컨트랙트 생성자
     * 초기 공급량 1,000,000 토큰을 배포자에게 발행합니다.
     */
    constructor() ERC20("Game Token", "KQTP") Ownable(msg.sender) {
        // 초기 공급량 발행 (1,000,000 토큰)
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
    
    /**
     * @dev 토큰 발행 (관리자만 가능)
     * @param to 토큰을 받을 주소
     * @param amount 발행할 토큰 수량 (wei 단위)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev 토큰 소각
     * @param amount 소각할 토큰 수량 (wei 단위)
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}
