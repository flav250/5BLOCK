// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../node_modules/@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";

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
    mapping(uint256 => address[]) public playerCards;

    mapping(address => uint256) public lastAction;
    mapping(uint256 => uint256) public lockUntil;

    constructor() ERC721("Arena Cards", "ACARD") Ownable(msg.sender){}

    modifier cooldown(address user) {
        require(block.timestamp >= lastAction[user] + COOLDOWN, "Action on cooldown");
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

}