// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title MinimalForwarder
 * @dev EIP-2771 메타 트랜잭션 포워더
 * 사용자는 서명만 하고, 서버가 가스비를 대납하여 트랜잭션 실행
 */
contract MinimalForwarder is EIP712 {
    using ECDSA for bytes32;

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    bytes32 private constant TYPEHASH =
        keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)");

    mapping(address => uint256) private _nonces;

    event MetaTransactionExecuted(
        address indexed from,
        address indexed to,
        bytes data,
        bool success
    );

    constructor() EIP712("MinimalForwarder", "1.0.0") {}

    /**
     * @dev 주소의 현재 nonce 조회
     */
    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    /**
     * @dev ForwardRequest 구조체 검증 및 실행
     */
    function verify(ForwardRequest calldata req, bytes calldata signature) 
        public 
        view 
        returns (bool) 
    {
        address signer = _hashTypedDataV4(
            keccak256(abi.encode(
                TYPEHASH,
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                keccak256(req.data)
            ))
        ).recover(signature);

        return _nonces[req.from] == req.nonce && signer == req.from;
    }

    /**
     * @dev 메타 트랜잭션 실행
     */
    function execute(ForwardRequest calldata req, bytes calldata signature)
        public
        payable
        returns (bool, bytes memory)
    {
        require(verify(req, signature), "MinimalForwarder: signature does not match request");

        _nonces[req.from] = req.nonce + 1;

        (bool success, bytes memory returndata) = req.to.call{gas: req.gas, value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        // 가스 환불 검증
        require(gasleft() > req.gas / 63, "MinimalForwarder: insufficient gas");

        emit MetaTransactionExecuted(req.from, req.to, req.data, success);

        return (success, returndata);
    }
}
