// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title GameAssetNFT
 * @dev ERC-721 게임 자산 NFT 컨트랙트 (EIP-2771 메타 트랜잭션 지원)
 * 게임 내 아이템을 NFT로 변환하여 블록체인에 기록합니다.
 * 가스리스 트랜잭션을 지원하여 사용자는 서명만으로 NFT를 전송할 수 있습니다.
 */
contract GameAssetNFT is ERC721, ERC721URIStorage, Ownable, ERC2771Context {
    // 이벤트
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event NFTBurned(uint256 indexed tokenId, address indexed owner);
    
    /**
     * @dev 컨트랙트 생성자
     * @param trustedForwarder EIP-2771 Trusted Forwarder 컨트랙트 주소
     */
    constructor(address trustedForwarder) 
        ERC721("GameAsset", "GASSET") 
        Ownable(msg.sender) 
        ERC2771Context(trustedForwarder) 
    {}
    
    /**
     * @dev NFT 민팅 (관리자만 호출 가능)
     * @param to 수신자 주소
     * @param tokenId 토큰 ID
     * @param uri IPFS 메타데이터 URI
     */
    function mint(address to, uint256 tokenId, string memory uri) 
        public 
        onlyOwner 
    {
        require(to != address(0), "Cannot mint to zero address");
        require(!_exists(tokenId), "Token already exists");
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit NFTMinted(to, tokenId, uri);
    }
    
    /**
     * @dev NFT 소각 (관리자만 호출 가능)
     * @param tokenId 소각할 토큰 ID
     */
    function burn(uint256 tokenId) public onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        address owner = ownerOf(tokenId);
        
        _burn(tokenId);
        
        emit NFTBurned(tokenId, owner);
    }
    
    /**
     * @dev 토큰 존재 여부 확인
     * @param tokenId 확인할 토큰 ID
     * @return bool 토큰 존재 여부
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
    
    /**
     * @dev 필수 오버라이드: tokenURI
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    /**
     * @dev 필수 오버라이드: supportsInterface
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
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
