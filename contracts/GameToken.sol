// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title GameToken
 * @dev ERC-20 게임 토큰 컨트랙트 (EIP-2771 메타 트랜잭션 지원)
 * 게임 내 화폐로 사용되며, 마켓플레이스에서 NFT 거래 시 결제 수단으로 활용됩니다.
 * 가스리스 트랜잭션을 지원하여 사용자는 서명만으로 토큰을 전송할 수 있습니다.
 */
contract GameToken is ERC20, Ownable, ERC2771Context {
    /**
     * @dev 컨트랙트 생성자
     * 초기 공급량 1,000,000 토큰을 배포자에게 발행합니다.
     * @param trustedForwarder EIP-2771 Trusted Forwarder 컨트랙트 주소
     */
    constructor(address trustedForwarder) 
        ERC20("Game Token", "KQTP") 
        Ownable(msg.sender) 
        ERC2771Context(trustedForwarder) 
    {
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
        _burn(_msgSender(), amount);
    }
    
    /**
     * @dev ERC2771Context와 Context의 _msgSender 충돌 해결
     * 메타 트랜잭션을 통해 호출될 경우 실제 발신자 주소를 반환합니다.
     */
    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }
    
    /**
     * @dev ERC2771Context와 Context의 _msgData 충돌 해결
     * 메타 트랜잭션을 통해 호출될 경우 실제 calldata를 반환합니다.
     */
    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }
    
    /**
     * @dev ERC2771Context와 Context의 _contextSuffixLength 충돌 해결
     */
    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}
