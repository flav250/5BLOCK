// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./ArenaCards.sol";

contract CardFusion {

    event CardsFused(
        address indexed player,
        uint256 tokenId1,
        uint256 tokenId2,
        uint256 newTokenId,
        uint256 newLevel
    );

    ArenaCards public arena;

    mapping(address => uint256) public lastFusion;
    uint256 public constant COOLDOWN = 5 minutes;

    constructor(address arenaAddress) {
        arena = ArenaCards(arenaAddress);
    }

    function fuseCards(uint256 id1, uint256 id2) external returns (uint256) {

        require(block.timestamp >= lastFusion[msg.sender] + COOLDOWN, "Fusion cooldown active");
        require(id1 != id2, "Same card");

        require(arena.ownerOf(id1) == msg.sender, "Not owner");
        require(arena.ownerOf(id2) == msg.sender, "Not owner");

        (
            uint256 level1,
            string memory rarity1,
            string memory name1,
            ,

        ) = arena.cardDetails(id1);

        (
            uint256 level2,
            string memory rarity2,
            string memory name2,
            ,

        ) = arena.cardDetails(id2);

        require(
            keccak256(bytes(name1)) == keccak256(bytes(name2)),
            "Cards must have same name"
        );

        require(
            keccak256(bytes(rarity1)) == keccak256(bytes(rarity2)),
            "Cards must have same rarity"
        );

        require(level1 == level2, "Cards must have same level");
        require(level1 < 5, "Max level reached");

        uint256 newLevel = level1 + 1;

        arena.burnFromFusion(id1);
        arena.burnFromFusion(id2);

        uint256 newTokenId = arena.mintFusion(
            msg.sender,
            name1,
            rarity1,
            newLevel
        );

        lastFusion[msg.sender] = block.timestamp;

        emit CardsFused(
            msg.sender,
            id1,
            id2,
            newTokenId,
            newLevel
        );

        return newTokenId;
    }
}
