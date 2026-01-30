// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ArenaCards.sol";

/**
 * @title Team
 * @dev Contrat pour gérer les équipes de cartes des joueurs
 * Permet de sauvegarder, charger et valider les compositions d'équipe
 */
contract Team is Ownable {
    uint256 public constant MAX_TEAM_SIZE = 5;
    
    // Référence au contrat ArenaCards
    ArenaCards public arenaCardsContract;
    
    // Mapping des équipes: address du joueur => tableau de tokenIds
    mapping(address => uint256[]) private playerTeams;
    
    // Mapping pour vérifier si une équipe a été sauvegardée
    mapping(address => bool) public hasTeam;
    
    // Événements
    event TeamSaved(address indexed player, uint256[] cardIds, uint256 timestamp);
    event TeamCleared(address indexed player, uint256 timestamp);
    event TeamLoaded(address indexed player, uint256[] cardIds);
    
    constructor(address _arenaCardsAddress) Ownable(msg.sender) {
        require(_arenaCardsAddress != address(0), "Invalid ArenaCards address");
        arenaCardsContract = ArenaCards(_arenaCardsAddress);
    }
    
    /**
     * @dev Sauvegarde l'équipe d'un joueur
     * @param cardIds Tableau des tokenIds des cartes (max 5)
     */
    function saveTeam(uint256[] memory cardIds) external {
        require(cardIds.length <= MAX_TEAM_SIZE, "Team size exceeds maximum");
        
        // Vérifier que le joueur possède toutes les cartes
        for (uint256 i = 0; i < cardIds.length; i++) {
            require(
                arenaCardsContract.ownerOf(cardIds[i]) == msg.sender,
                "You don't own this card"
            );
        }
        
        // Sauvegarder l'équipe
        playerTeams[msg.sender] = cardIds;
        hasTeam[msg.sender] = true;
        
        emit TeamSaved(msg.sender, cardIds, block.timestamp);
    }
    
    /**
     * @dev Récupère l'équipe d'un joueur
     * @param player Adresse du joueur
     * @return Tableau des tokenIds de l'équipe
     */
    function getTeam(address player) external view returns (uint256[] memory) {
        return playerTeams[player];
    }
    
    /**
     * @dev Récupère l'équipe du msg.sender
     * @return Tableau des tokenIds de l'équipe
     */
    function getMyTeam() external view returns (uint256[] memory) {
        return playerTeams[msg.sender];
    }
    
    /**
     * @dev Efface l'équipe d'un joueur
     */
    function clearTeam() external {
        delete playerTeams[msg.sender];
        hasTeam[msg.sender] = false;
        
        emit TeamCleared(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Valide que l'équipe d'un joueur est toujours valide
     * (vérifie que le joueur possède encore toutes les cartes)
     * @param player Adresse du joueur
     * @return true si l'équipe est valide, false sinon
     */
    function isTeamValid(address player) external view returns (bool) {
        uint256[] memory team = playerTeams[player];
        
        if (team.length == 0) {
            return false;
        }
        
        for (uint256 i = 0; i < team.length; i++) {
            try arenaCardsContract.ownerOf(team[i]) returns (address owner) {
                if (owner != player) {
                    return false;
                }
            } catch {
                // Si la carte n'existe plus, l'équipe n'est pas valide
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * @dev Retourne la taille de l'équipe d'un joueur
     * @param player Adresse du joueur
     * @return Nombre de cartes dans l'équipe
     */
    function getTeamSize(address player) external view returns (uint256) {
        return playerTeams[player].length;
    }
    
    /**
     * @dev Permet au owner de mettre à jour l'adresse du contrat ArenaCards
     * @param _arenaCardsAddress Nouvelle adresse du contrat
     */
    function updateArenaCardsContract(address _arenaCardsAddress) external onlyOwner {
        require(_arenaCardsAddress != address(0), "Invalid address");
        arenaCardsContract = ArenaCards(_arenaCardsAddress);
    }
    
    /**
     * @dev Retourne des informations détaillées sur l'équipe d'un joueur
     * @param player Adresse du joueur
     * @return cardIds Tableau des tokenIds
     * @return isValid Si l'équipe est toujours valide
     * @return teamSize Taille de l'équipe
     */
    function getTeamInfo(address player) 
        external 
        view 
        returns (
            uint256[] memory cardIds,
            bool isValid,
            uint256 teamSize
        ) 
    {
        cardIds = playerTeams[player];
        teamSize = cardIds.length;
        
        isValid = true;
        for (uint256 i = 0; i < cardIds.length; i++) {
            try arenaCardsContract.ownerOf(cardIds[i]) returns (address owner) {
                if (owner != player) {
                    isValid = false;
                    break;
                }
            } catch {
                isValid = false;
                break;
            }
        }
        
        return (cardIds, isValid, teamSize);
    }
}
