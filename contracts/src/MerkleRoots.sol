// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// Merkle root registry. Live submit is v1.1; the port exists so the host can land later.
/// DESIGN.md §6.2, §10.
contract MerkleRoots {
    address public immutable attestor;
    mapping(bytes32 => bytes32) public roots;

    constructor(address attestor_) {
        require(attestor_ != address(0), "attestor");
        attestor = attestor_;
    }

    function putRoot(string calldata cityId, uint256 cityDay, bytes32 root) external {
        require(msg.sender == attestor, "attestor");
        require(bytes(cityId).length > 0 && root != bytes32(0), "root");
        roots[_key(cityId, cityDay)] = root;
    }

    function getRoot(string calldata cityId, uint256 cityDay) external view returns (bytes32) {
        bytes32 stored = roots[_key(cityId, cityDay)];
        require(stored != bytes32(0), "missing");
        return stored;
    }

    function _key(string calldata cityId, uint256 cityDay) internal pure returns (bytes32) {
        return keccak256(abi.encode(cityId, cityDay));
    }
}
