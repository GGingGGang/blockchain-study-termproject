// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GameAssetNFT
 * @dev ERC-721 게임 자산 NFT 컨트랙트
 * 게임 내 아이템을 NFT로 변환하여 블록체인에 기록합니다.
 */
contract GameAssetNFT is ERC721, ERC721URIStorage, Ownable {
    // 이벤트
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event NFTBurned(uint256 indexed tokenId, address indexed owner);
    
    /**
     * @dev 컨트랙트 생성자
     */
    constructor() ERC721("GameAsset", "GASSET") Ownable(msg.sender) {}
    
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
}
