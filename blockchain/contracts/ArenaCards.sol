// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ArenaCards is ERC721URIStorage, Ownable {

    uint256 public tokenCounter;

    uint256 public constant MAX_CARDS = 4;
    uint256 public constant COOLDOWN = 5 minutes;
    uint256 public constant LOCK_TIME = 10 minutes;

    struct CardData {
        uint256 level;  
        string rarity;
        string name;
        uint256 createdAt;
        uint256 lastTransferAt;
    }

    mapping(uint256 => CardData) public cardDetails;
    mapping(uint256 => address[]) public previousOwners;

    mapping(address => uint256) public lastAction;
    mapping(uint256 => uint256) public lockUntil;

    constructor() ERC721("Arena Cards", "ACARD") Ownable(msg.sender){}

    modifier cooldown(address user) {
        require(lastAction[user] == 0 || block.timestamp >= lastAction[user] + COOLDOWN,"Action on cooldown");
        _;
    }

    modifier notLocked(uint256 tokenId) {
        require(block.timestamp >= lockUntil[tokenId], "Card is temporarily locked");
        _;
    }   

    modifier maxCards(address user) {
        require(balanceOf(user) < MAX_CARDS, "Max cards reached");
        _;
    }   

    function mintCard(string memory tokenURI, string memory name, string memory rarity) 
        external 
        onlyOwner 
        maxCards(msg.sender) 
        cooldown(msg.sender) 
    {
        uint256 tokenId = tokenCounter;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI);

        cardDetails[tokenId] = CardData({
            level: 1,
            rarity: rarity,
            name: name,
            createdAt: block.timestamp,
            lastTransferAt: block.timestamp
        });

        lockUntil[tokenId] = block.timestamp + LOCK_TIME;
        lastAction[msg.sender] = block.timestamp;

        tokenCounter++;
    }   

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {

        address from = ownerOf(tokenId);
        
        if (from != address(0)) {
            require(block.timestamp >= lockUntil[tokenId], "Card locked");

            previousOwners[tokenId].push(from);
            cardDetails[tokenId].lastTransferAt = block.timestamp;
        }

        return super._update(to, tokenId, auth);
    }

    function fusecards(uint256 tokenId1, uint256 tokenId2, string memory newTokenURI) 
        external 
        cooldown(msg.sender) 
        maxCards(msg.sender) 
    {
        require(ownerOf(tokenId1) == msg.sender, "Not owner of tokenId1");
        require(ownerOf(tokenId2) == msg.sender, "Not owner of tokenId2");
        require(tokenId1 != tokenId2, "Cannot fuse same card");

        CardData storage card1 = cardDetails[tokenId1];
        CardData storage card2 = cardDetails[tokenId2];

        require(keccak256(bytes(card1.rarity)) == keccak256(bytes(card2.rarity)), "Rarities must match");

        uint256 newLevel = card1.level + card2.level;

        _burn(tokenId1);
        _burn(tokenId2);

        delete cardDetails[tokenId1];
        delete cardDetails[tokenId2];

        uint256 newTokenId = tokenCounter;
        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, newTokenURI);

        cardDetails[newTokenId] = CardData({
            level: newLevel,
            rarity: card1.rarity,
            name: string(abi.encodePacked(card1.name, "-", card2.name)),
            createdAt: block.timestamp,
            lastTransferAt: block.timestamp
        });

        lockUntil[newTokenId] = block.timestamp + LOCK_TIME;
        lastAction[msg.sender] = block.timestamp;

        tokenCounter++;
    }

    function getPreviousOwners(uint256 tokenId) external view returns (address[] memory) {
        return previousOwners[tokenId];
    }
}