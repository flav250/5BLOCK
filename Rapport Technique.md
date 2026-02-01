# Rapport Technique - Arena Cards DApp

## Projet Web3 – Développement d'une DApp basée sur la Blockchain

## Table des matières

1. [Cas d'usage et justification](#1-cas-dusage-et-justification)
2. [Architecture générale](#2-architecture-générale)
3. [Respect des contraintes techniques](#3-respect-des-contraintes-techniques)
4. [Choix de conception](#4-choix-de-conception)
5. [Smart Contracts](#5-smart-contracts)
6. [Tests unitaires](#6-tests-unitaires)
7. [Conclusion](#7-Conclusion)
---

## 1. Cas d'usage et justification

### 1.1 Description du projet

**Arena Cards** est un jeu de cartes à collectionner (Trading Card Game) décentralisé où chaque carte est un NFT ERC-721 unique. Le projet combine :

- **Collecte** : Obtention de cartes via des boosters (gratuits ou premium) et une boutique exclusive
- **Combat** : Système de jeu automatique (AFK Arena) avec mécaniques de vagues infinies
- **Amélioration** : Fusion de cartes pour monter en niveau
- **Économie** : Marketplace peer-to-peer pour échanger des cartes
- **Exclusivité** : Shop avec cartes légendaires et secrètes à stock limité

### 1.2 Justification de l'utilisation de la blockchain

La blockchain est pertinente pour ce projet car :

1. **Propriété vérifiable** : Chaque carte est un NFT unique possédé par le joueur
2. **Économie décentralisée** : Pas d'autorité centrale contrôlant les échanges
3. **Transparence** : Les probabilités de drop et les règles de jeu sont on-chain
4. **Rareté garantie** : Le stock de cartes secrètes (50 max) est immuable
5. **Interopérabilité** : Les NFTs peuvent être utilisés dans d'autres applications
6. **Collection limitée** : Maximum de 30 cartes par joueur

---

## 2. Architecture générale

### 2.1 Stack technique

```
┌─────────────────────────────────────┐
│         Frontend (React)            │
│  - TypeScript                       │
│  - Ethers.js v6                     │
│  - Vite                             │
└──────────────┬──────────────────────┘
               │
               │ (JSON-RPC)
               │
┌──────────────▼──────────────────────┐
│      Ethereum Blockchain            │
│  - Sepolia Testnet                  │
│  - Smart Contracts (Solidity 0.8.20)│
└──────────────┬──────────────────────┘
               │
               │
┌──────────────▼──────────────────────┐
│      IPFS (Pinata)                  │
│  - Images des cartes (18 cartes)    │
│  - Métadonnées décentralisées       │
└─────────────────────────────────────┘
```

### 2.2 Smart Contracts

Le projet utilise **6 smart contracts** interdépendants :

1. **ArenaCards.sol** : Contrat principal NFT (ERC-721)
2. **FreeBooster.sol** : Distribution gratuite avec cooldown
3. **PremiumBooster.sol** : Boosters payants
4. **Shop.sol** : Boutique exclusive (cartes légendaires + secrètes)
5. **Marketplace.sol** : Échanges peer-to-peer
6. **CardFusion.sol** : Amélioration de cartes

---

## 3. Respect des contraintes techniques

### 3.1 ✅ Tokenisation des ressources

**Contrainte** : Les ressources doivent être représentées sous forme de tokens avec différents niveaux.

**Implémentation** :

```solidity
// ArenaCards.sol
struct CardData {
    uint256 level;           // Niveau de la carte (1-5)
    string rarity;          // Commune, Peu commune, Rare, Épique, Légendaire, Secrète
    string name;            // Nom unique de la carte
    uint256 createdAt;      // Timestamp de création
    uint256 lastTransferAt; // Dernier transfert
    CardStats stats;        // Statistiques (attack)
}

struct CardStats {
    uint256 attack;  // Stat principale
}
```

**Raretés et niveaux d'attaque** :

| Rareté | Attack de base | Nombre de cartes |
|--------|---------------|------------------|
| Commune | 30-50 | 5 cartes |
| Peu commune | 45-55 | 3 cartes |
| Rare | 65-75 | 3 cartes |
| Épique | 90-100 | 3 cartes |
| Légendaire | 140-150 | 2 cartes |
| **Secrète** | **500** | **3 cartes (stock limité)** |

**Niveaux de carte** : 1 à 5 (progression via fusion)

**Calcul d'attaque après fusion** :
```solidity
stats: CardStats({
    attack: base.attack * level  // Level 2 = 2x attack, Level 5 = 5x attack
})
```

---

### 3.2 ✅ Échanges de tokens

**Contrainte** : Mécanisme d'échange avec règles de validation.

**Implémentation** : 2 types d'échanges dans `Marketplace.sol`

#### 3.2.1 Échange générique (Trade)

```solidity
struct Trade {
    uint256 tradeId;
    address creator;
    uint256 offeredTokenId;        // Carte proposée
    string requestedCardName;      // Nom demandé
    uint256 requestedLevel;        // Level minimum
    string requestedRarity;        // Rareté demandée
    bool isActive;
    uint256 createdAt;
}

function createTrade(
    uint256 _offeredTokenId,
    string memory _requestedCardName,
    uint256 _requestedLevel,
    string memory _requestedRarity
) external;
```

**Règles de validation** :
1. Le créateur doit posséder la carte
2. La carte ne doit pas être verrouillée
3. Vérification de la rareté et du level demandés
4. Approval NFT requis

#### 3.2.2 Échange direct (Direct Trade)

```solidity
struct DirectTrade {
    uint256 tradeId;
    address creator;
    address target;              // Utilisateur cible
    uint256 offeredTokenId;      // Carte proposée
    uint256 requestedTokenId;    // Carte spécifique demandée
    bool isActive;
    uint256 createdAt;
}

function createDirectTrade(
    uint256 _offeredTokenId,
    address _target,
    uint256 _requestedTokenId
) external;
```

**Règles de validation** :
1. Les deux parties doivent posséder leurs cartes respectives
2. Seul le `target` peut accepter
3. Vérification de l'ownership avant swap
4. Utilisation de ReentrancyGuard pour sécurité

---

### 3.3 ✅ Limites de possession

**Contrainte** : Maximum de ressources par utilisateur.

**Implémentation** :

```solidity
// ArenaCards.sol
uint256 public constant MAX_CARDS = 30;

modifier maxCards(address user) {
    require(balanceOf(user) < MAX_CARDS, "Max cards reached");
    _;
}

function mintCard(
    address to,
    string memory name,
    string memory rarity
) external maxCards(to) {
    // ...
}
```

**Justification du choix (30 cartes)** :
- Empêche l'accumulation excessive
- Force les joueurs à échanger/fusionner
- Crée une économie dynamique
- Limite le spam de minting

**Vérifications dans tous les contrats** :
- ✅ `FreeBooster.sol` : Check avant mint
- ✅ `PremiumBooster.sol` : Check avant mint
- ✅ `Shop.sol` : Utilise `mintCard()` avec modifier `maxCards`
- ✅ Impossible de recevoir des cartes si limite atteinte

---

### 3.4 ✅ Contraintes temporelles

**Contrainte** : Cooldown entre transactions + lock après action critique.

#### 3.4.1 Cooldown (5 minutes)

```solidity
// ArenaCards.sol
uint256 public constant COOLDOWN = 5 minutes;
mapping(address => uint256) public lastAction;

modifier cooldown(address user) {
    require(
        lastAction[user] == 0 || block.timestamp >= lastAction[user] + COOLDOWN,
        "Action on cooldown"
    );
    _;
}
```

**Appliqué sur** :
- Minting de cartes (sauf pour authorized minters)
- Ouverture de boosters gratuits (10 min pour FreeBooster)
- **Shop : cooldown de 24h entre achats**

#### 3.4.2 Lock temporaire (10 minutes)

```solidity
// ArenaCards.sol
uint256 public constant LOCK_TIME = 10 minutes;
mapping(uint256 => uint256) public lockUntil;

modifier notLocked(uint256 tokenId) {
    require(block.timestamp >= lockUntil[tokenId], "Card is temporarily locked");
    _;
}

function mintCard(...) external {
    uint256 tokenId = tokenCounter;
    lockUntil[tokenId] = block.timestamp + LOCK_TIME;
    emit CardLocked(tokenId, lockUntil[tokenId]);
    // ...
}
```

**Lock appliqué après** :
- Création d'une carte (minting)
- Fusion de cartes (nouvelle carte créée)
- Achat de carte sur marketplace
- **Achat dans le Shop**

**Raisons du lock** :
- Empêche le trading immédiat (anti-farming)
- Force une période de réflexion
- Prévient les attaques par bots

#### 3.4.3 Cooldown Shop (24 heures)

```solidity
// Shop.sol
uint256 public constant COOLDOWN = 24 hours;
mapping(address => uint256) public lastPurchase;

function buyCard(uint256 cardId) external {
    require(
        block.timestamp >= lastPurchase[msg.sender] + COOLDOWN,
        "Cooldown active - wait 24h between purchases"
    );
    
    lastPurchase[msg.sender] = block.timestamp;
    // ...
}
```

**Justification** :
- Évite l'achat massif de cartes secrètes
- Limite la vitesse d'acquisition
- Crée de la rareté artificielle

---

### 3.5 ✅ Utilisation d'IPFS

**Contrainte** : Métadonnées stockées sur IPFS.

**Implémentation** :

#### 3.5.1 Stockage des images

**18 cartes uniques** hébergées sur **Pinata (IPFS)** :

```solidity
// ArenaCards.sol - _initializeImageURIs()

// Légendaires (2)
imageURIs["legendaire"]["Dragon Dore"] = 
    "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeia43c7zri7...";
imageURIs["legendaire"]["Phoenix Immortel"] = 
    "https://red-ready-catfish-554.mypinata.cloud/ipfs/bafybeigsbr2x5mc...";

// Épiques (3)
imageURIs["epique"]["Chevalier Noir"] = "...";
imageURIs["epique"]["Mage des Glaces"] = "...";
imageURIs["epique"]["Assassin Fantome"] = "...";

// Rares (3)
imageURIs["rare"]["Archer Elfe"] = "...";
imageURIs["rare"]["Paladin Sacre"] = "...";
imageURIs["rare"]["Druide Ancien"] = "...";

// Peu communes (3)
imageURIs["peu commune"]["Guerrier Brave"] = "...";
imageURIs["peu commune"]["Voleur Agile"] = "...";
imageURIs["peu commune"]["Pretre Sage"] = "...";

// Communes (5)
imageURIs["commune"]["Gobelin Ruse"] = "...";
imageURIs["commune"]["Sorciere Noire"] = "...";
imageURIs["commune"]["Barbare Sauvage"] = "...";
imageURIs["commune"]["Squelette Soldat"] = "...";
imageURIs["commune"]["Slime Gluant"] = "...";

// 🔥 SECRÈTES (3) - Exclusives au Shop
imageURIs["secrete"]["Brice : Le divin supreme"] = "...";
imageURIs["secrete"]["Paul : Le malicieux"] = "...";
imageURIs["secrete"]["Flavien : Le bienfaiteur"] = "...";
```

**Avantages** :
- Images permanentes et décentralisées
- Pas de dépendance à un serveur centralisé
- Résistance à la censure
- Hash IPFS garantit l'intégrité

#### 3.5.2 Métadonnées on-chain avec référence IPFS

```solidity
function tokenURI(uint256 tokenId) public view override returns (string memory) {
    CardData memory card = cardDetails[tokenId];
    string memory imageURL = imageURIs[card.rarity][card.name];

    string memory json = string(abi.encodePacked(
        '{"name":"', card.name, ' #', tokenId.toString(),
        '","image":"', imageURL,  // ← URL IPFS
        '","attributes":[',
        '{"trait_type":"Rarity","value":"', card.rarity, '"},',
        '{"trait_type":"Level","value":', card.level.toString(), '},',
        '{"trait_type":"Attack","value":', card.stats.attack.toString(), '}',
        ']}'
    ));

    return string(abi.encodePacked('data:application/json;base64,', 
        Base64.encode(bytes(json))));
}
```

**Format de métadonnées (conforme ERC-721)** :
```json
{
  "name": "Brice : Le divin supreme #42",
  "image": "ipfs://bafybeiern4r6e2edw2zwosh63yyiujxvlr3j3o7cezqzwxtdubui4o2eca",
  "attributes": [
    {"trait_type": "Rarity", "value": "secrete"},
    {"trait_type": "Level", "value": 1},
    {"trait_type": "Attack", "value": 500}
  ]
}
```

---

### 3.6 ✅ Tests unitaires avec Hardhat

**Contrainte** : Couverture significative avec Hardhat.

**Structure des tests** :

```
blockchain/test/
├── ArenaCards.test.js      # Tests du contrat principal
├── CardFusion.test.js      # Tests fusion
├── FreeBooster.test.js     # Tests booster gratuit
├── Marketplace.test.js     # Tests marketplace
├── PremiumBooster.test.js  # Tests booster premium
└── Shop.test.js            # Tests boutique exclusive
```

**Couverture des tests** :

#### ArenaCards.test.js
- ✅ Déploiement correct
- ✅ Minting avec autorisation
- ✅ Limite MAX_CARDS (30 cartes)
- ✅ Cooldown de 5 minutes
- ✅ Lock de 10 minutes
- ✅ Upgrade de niveau (fusion)
- ✅ Métadonnées tokenURI
- ✅ Previous owners tracking
- ✅ Calcul attack × level

#### Shop.test.js (nouveau)
- ✅ Achat carte légendaire
- ✅ Achat carte secrète
- ✅ Limite stock secrètes (50)
- ✅ Cooldown 24h entre achats
- ✅ Une carte par type par personne
- ✅ Vérification MAX_CARDS
- ✅ canPurchase() helper
- ✅ getCooldownRemaining()

#### FreeBooster.test.js
- ✅ Ouverture booster gratuit
- ✅ Cooldown de 10 minutes
- ✅ Distribution 2 cartes
- ✅ Probabilités de rareté
- ✅ Vérification MAX_CARDS

#### PremiumBooster.test.js
- ✅ Achat avec ETH (0.001)
- ✅ Distribution 4 cartes
- ✅ Retrait des fonds (owner)
- ✅ Prix incorrect rejeté

#### Marketplace.test.js
- ✅ Création de trade générique
- ✅ Création de direct trade
- ✅ Acceptation de trade
- ✅ Annulation de trade
- ✅ Vérification ownership
- ✅ Protection contre reentrancy

#### CardFusion.test.js
- ✅ Fusion de 2 cartes identiques
- ✅ Vérification ownership
- ✅ Level +1 après fusion
- ✅ Attack × level après fusion
- ✅ Burn des cartes sources
- ✅ Lock de la nouvelle carte
- ✅ Rejet si cartes différentes

**Commande de test** :
```bash
npx hardhat test
npx hardhat coverage
```

---

## 4. Choix de conception

### 4.1 Architecture modulaire

**Choix** : Séparation en 6 contrats indépendants.

**Justification** :
1. **Séparation des responsabilités** : Chaque contrat a un rôle unique
2. **Maintenance facilitée** : Possibilité d'upgrade un contrat sans toucher aux autres
3. **Gas optimization** : Déploiement de contrats plus petits
4. **Sécurité** : Surface d'attaque réduite par contrat
5. **Testabilité** : Tests unitaires plus ciblés
6. **Extensibilité** : Ajout facile de nouvelles fonctionnalités (comme Shop)

### 4.2 Système d'autorisation

**Choix** : Modifier `onlyAuthorized` pour le minting.

```solidity
// ArenaCards.sol
mapping(address => bool) public authorizedMinters;

function setAuthorizedMinter(address _minter, bool _authorized) 
    external onlyOwner {
    authorizedMinters[_minter] = _authorized;
}

function mintCard(
    address to,
    string memory name,
    string memory rarity
) external maxCards(to) {
    bool isMinter = authorizedMinters[msg.sender];
    require(msg.sender == owner() || isMinter, "Not authorized to mint");

    // Cooldown skip pour les minters autorisés
    if (!isMinter) {
        require(
            lastAction[to] == 0 || block.timestamp >= lastAction[to] + COOLDOWN,
            "Action on cooldown"
        );
        lastAction[to] = block.timestamp;
    }
    // ...
}
```

**Contrats autorisés** :
- ✅ `FreeBooster.sol`
- ✅ `PremiumBooster.sol`
- ✅ `Shop.sol`

**Justification** :
- Owner peut révoquer l'autorisation à tout moment
- Flexibilité pour ajouter d'autres sources de minting
- Shop n'applique pas le cooldown de 5 min (il a son propre cooldown de 24h)

### 4.3 Métadonnées on-chain vs IPFS

**Choix** : Métadonnées générées on-chain, images sur IPFS.

**Pourquoi on-chain** :
1. **Dynamisme** : Les stats changent (level, attack)
2. **Coût** : Pas de stockage IPFS pour chaque NFT
3. **Rapidité** : Pas de fetch IPFS pour les métadonnées
4. **Fiabilité** : Toujours disponible avec la blockchain

**Pourquoi IPFS pour images** :
1. **Taille** : Images trop lourdes pour la blockchain
2. **Coût** : Stockage on-chain prohibitif
3. **Permanence** : IPFS garantit la disponibilité
4. **Standard** : Compatible avec OpenSea, Rarible, etc.

### 4.4 Système de rareté et probabilités

**Choix** : Probabilités différentes selon le type de booster.

#### Free Booster
```solidity
// FreeBooster.sol
// 0.1% legendaire
// 10% epique
// 20% rare
// 25% peu commune
// 44.9% commune

uint256 rand = uint256(keccak256(abi.encodePacked(
    block.timestamp,
    block.prevrandao,
    msg.sender,
    i
))) % 1000;

if (rand < 1) {
    // Légendaire (0.1%)
} else if (rand < 101) {
    // Épique (10%)
} else if (rand < 301) {
    // Rare (20%)
}
// ...
```

**Justification** :
- Gratuit = moins de chances de légendaires
- Encourage l'achat de premium boosters
- Économie équilibrée

#### Premium Booster
```solidity
// PremiumBooster.sol
// 5% legendaire
// 15% epique
// 30% rare
// 25% peu commune
// 25% commune

if (rand < 50) {
    // Légendaire (5%)
} else if (rand < 200) {
    // Épique (15%)
}
// ...
```

**Justification** :
- Payant (0.001 ETH) = meilleures chances
- 4 cartes au lieu de 2
- Meilleur ROI pour les joueurs

#### Shop : Pas de hasard

**Achat direct** :
- Choix précis de la carte
- Pas de probabilités
- Limites strictes :
  - ✅ Une carte par type par personne
  - ✅ Cooldown 24h
  - ✅ Stock limité (secrètes)

### 4.5 Système de fusion

**Choix** : 2 cartes identiques → 1 carte level+1 avec attack × level.

```solidity
// CardFusion.sol
function fuseCards(uint256 tokenId1, uint256 tokenId2) external {
    // Vérifications
    require(ownerOf(tokenId1) == msg.sender, "Not owner of card 1");
    require(ownerOf(tokenId2) == msg.sender, "Not owner of card 2");
    
    (string memory name1, string memory rarity1, uint256 level1,) = 
        arenaCards.getCardStats(tokenId1);
    (string memory name2, string memory rarity2, uint256 level2,) = 
        arenaCards.getCardStats(tokenId2);
    
    require(
        keccak256(bytes(name1)) == keccak256(bytes(name2)) &&
        keccak256(bytes(rarity1)) == keccak256(bytes(rarity2)) &&
        level1 == level2,
        "Cards must be identical"
    );
    
    // Burn
    arenaCards.burnFromFusion(tokenId1);
    arenaCards.burnFromFusion(tokenId2);
    
    // Create upgraded card avec attack × level
    uint256 newTokenId = arenaCards.mintFusion(
        msg.sender,
        name1,
        rarity1,
        level1 + 1
    );
    
    emit CardsFused(tokenId1, tokenId2, newTokenId, level1 + 1);
}
```

**Calcul de puissance** (exemple avec Dragon Doré - 150 ATK de base) :
- Level 1 : 150 ATK (base)
- Level 2 : 300 ATK (150 × 2)
- Level 5 : 750 ATK (150 × 5)

**Justification** :
1. **Simplicité** : Règle claire et compréhensible
2. **Sink** : Brûle 2 NFTs pour en créer 1 (déflationniste)
3. **Progression exponentielle** : Incentive forte pour fusionner
4. **Stratégie** : Choix entre fusion ou échange

---

## 5. Smart Contracts

### 5.1 ArenaCards.sol (NFT principal)

**Responsabilités** :
- Minting de cartes NFT (ERC-721)
- Gestion des niveaux et raretés (6 raretés)
- Cooldown et lock temporaire
- Métadonnées on-chain
- Upgrade de cartes (fusion)
- Support 18 cartes uniques

**Fonctions clés** :

```solidity
function mintCard(address to, string memory name, string memory rarity) 
    external maxCards(to);

function mintFusion(address to, string memory name, string memory rarity, uint256 level) 
    external onlyFusion returns (uint256);

function burnFromFusion(uint256 tokenId) 
    external onlyFusion;

function isCardLocked(uint256 tokenId) 
    public view returns (bool);

function getCardStats(uint256 tokenId) 
    external view returns (string memory, string memory, uint256, uint256);
```

**Modifiers** :
```solidity
modifier maxCards(address user);      // Limite 30 cartes
modifier cooldown(address user);      // 5 minutes
modifier notLocked(uint256 tokenId);  // 10 minutes lock
modifier onlyFusion();                // Seul CardFusion peut burn/upgrade
```

**Sécurité** :
- ✅ OpenZeppelin ERC-721
- ✅ Ownable
- ✅ Cooldown anti-spam
- ✅ Lock temporaire
- ✅ MAX_CARDS limite
- ✅ Separation Fusion contract

### 5.2 FreeBooster.sol

**Responsabilités** :
- Distribution gratuite de cartes
- Cooldown de 10 minutes
- 2 cartes par booster
- Probabilités définies

**Fonctions clés** :

```solidity
function claimFreeBooster() external;
```

**Sécurité** :
- ✅ Cooldown obligatoire
- ✅ Vérification MAX_CARDS
- ✅ Randomisation avec block.prevrandao

### 5.3 PremiumBooster.sol

**Responsabilités** :
- Vente de boosters premium (0.001 ETH)
- 4 cartes par booster
- Retrait des fonds (owner)

**Fonctions clés** :

```solidity
function buyPremiumBooster() external payable;
function withdraw() external onlyOwner;
```

**Sécurité** :
- ✅ Vérification du prix
- ✅ Retrait sécurisé
- ✅ Vérification MAX_CARDS

### 5.4 🆕 Shop.sol (Boutique exclusive)

**Responsabilités** :
- Vente de cartes légendaires (stock illimité)
- Vente de cartes secrètes (stock limité à 50)
- Gestion du catalogue
- Cooldown de 24h entre achats
- Une carte par type par personne

**Structure** :

```solidity
struct ShopCard {
    string name;
    string rarity;
    string imageURI;
    uint256 price;           // Prix informatif (non vérifié on-chain)
    bool isSecret;
    bool available;
    uint256 maxSupply;       // 0 = illimité, 50 pour secrètes
    uint256 minted;
}

ShopCard[] public shopCards;
mapping(address => mapping(uint256 => bool)) public hasPurchased;
mapping(address => uint256) public lastPurchase;
```

**Fonctions clés** :

```solidity
function buyCard(uint256 cardId) external;
function canPurchase(address user, uint256 cardId) external view returns (bool);
function getCooldownRemaining(address user) external view returns (uint256);
function getCard(uint256 cardId) external view returns (...);
function addCard(...) external onlyOwner;  // Ajouter carte au catalogue
function setCardAvailability(uint256 cardId, bool available) external onlyOwner;
```

**Catalogue initial** :

| ID | Nom | Rareté | Prix | Stock | Attack |
|----|-----|--------|------|-------|--------|
| 0 | Dragon Doré | Légendaire | 1M | Illimité | 150 |
| 1 | Phoenix Immortel | Légendaire | 1M | Illimité | 140 |
| 2 | Brice : Le divin supreme | Secrète | 5M | 50 | 500 |
| 3 | Paul : Le malicieux | Secrète | 5M | 50 | 500 |
| 4 | Flavien : Le bienfaiteur | Secrète | 5M | 50 | 500 |

**Règles strictes** :
```solidity
function buyCard(uint256 cardId) external {
    require(cardId < shopCards.length, "Invalid card ID");
    require(card.available, "Card not available");
    require(!hasPurchased[msg.sender][cardId], "Already purchased this card");
    require(
        block.timestamp >= lastPurchase[msg.sender] + COOLDOWN,
        "Cooldown active - wait 24h between purchases"
    );
    
    // Vérifier le stock
    if (card.maxSupply > 0) {
        require(card.minted < card.maxSupply, "Card sold out");
    }
    
    arenaCards.mintCard(msg.sender, card.name, card.rarity);
    hasPurchased[msg.sender][cardId] = true;
    lastPurchase[msg.sender] = block.timestamp;
    card.minted++;
}
```

**Sécurité** :
- ✅ Cooldown 24h
- ✅ Une carte par type par personne
- ✅ Stock limité pour secrètes
- ✅ Vérification MAX_CARDS via mintCard()
- ✅ Owner peut désactiver/activer cartes
- ✅ Owner peut ajouter nouvelles cartes

**Note importante** :
Le prix affiché (1M ou 5M points) est **informatif seulement**. Le véritable système de points est géré côté frontend (localStorage). Le contrat Shop vérifie uniquement les règles anti-abus (cooldown, stock, unicité).

### 5.5 Marketplace.sol

**Responsabilités** :
- Échanges peer-to-peer
- Trades génériques (demande carte)
- Direct trades (swap spécifique)

**Fonctions clés** :

```solidity
function createTrade(uint256 _offeredTokenId, string memory _requestedCardName, 
    uint256 _requestedLevel, string memory _requestedRarity) external;

function acceptTrade(uint256 _tradeId, uint256 _yourTokenId) external;

function createDirectTrade(uint256 _offeredTokenId, address _target, 
    uint256 _requestedTokenId) external;

function acceptDirectTrade(uint256 _directTradeId) external;
```

**Sécurité** :
- ✅ ReentrancyGuard
- ✅ Vérification ownership
- ✅ Protection cartes lockées
- ✅ Double vérification avant swap

### 5.6 CardFusion.sol

**Responsabilités** :
- Fusion de 2 cartes identiques
- Burn des cartes sources
- Création carte level+1 avec attack × level

**Fonctions clés** :

```solidity
function fuseCards(uint256 tokenId1, uint256 tokenId2) external;
```

**Sécurité** :
- ✅ Vérification ownership
- ✅ Vérification identité cartes (nom + rareté + level)
- ✅ Burn sécurisé via onlyFusion
- ✅ Lock nouvelle carte

---

## 6. Tests unitaires

### 6.1 Méthodologie

**Framework** : Hardhat + Chai  
**Couverture** : ~90% (objectif atteint)  
**Approche** : Test-Driven Development (TDD)

### 6.2 Scénarios testés

#### Scénarios positifs (happy path)
- ✅ Minting de cartes (tous types)
- ✅ Ouverture de boosters (free + premium)
- ✅ Achat dans le Shop (légendaires + secrètes)
- ✅ Création et acceptation de trades
- ✅ Fusion de cartes
- ✅ Upgrade de niveau avec attack × level

#### Scénarios négatifs (edge cases)
- ✅ Dépassement MAX_CARDS
- ✅ Cooldown non respecté (5 min, 10 min, 24h)
- ✅ Carte lockée non transférable
- ✅ Fusion de cartes différentes
- ✅ Trade sans approval
- ✅ Prix incorrect premium booster
- ✅ Stock épuisé cartes secrètes
- ✅ Double achat même carte Shop
- ✅ Achat Shop avant cooldown 24h

#### Scénarios de sécurité
- ✅ Reentrancy attack (marketplace)
- ✅ Unauthorized minting
- ✅ Unauthorized burning (fusion only)
- ✅ Double spend prevention
- ✅ Ownership verification

### 6.3 Exemples de tests

#### Test ArenaCards : Limite MAX_CARDS

```javascript
// ArenaCards.test.js (extrait réel)
describe("Minting", function () {
  it("Should not allow more than MAX_CARDS (30)", async function () {
    // Mint 30 cards
    for (let i = 0; i < 30; i++) {
      await arena.mintCard(owner.address, "Gobelin Ruse", "commune");
      await ethers.provider.send("evm_increaseTime", [300]);
      await ethers.provider.send("evm_mine");
    }

    expect(await arena.balanceOf(owner.address)).to.equal(30);

    // Try to mint 31st card
    await expect(
      arena.mintCard(owner.address, "Gobelin Ruse", "commune")
    ).to.be.revertedWith("Max cards reached");
  });
});
```

#### Test Marketplace : Création et acceptation de trade

```javascript
// Marketplace.test.js (extrait réel)
describe("Accepting Trades (Criteria-based)", function () {
  beforeEach(async function () {
    await arena.connect(player1).approve(await marketplace.getAddress(), 0);
    await marketplace.connect(player1).createTrade(0, "Chevalier Sacre", 1, "legendaire");
  });

  it("Should accept trade with matching card", async function () {
    await arena.connect(player2).approve(await marketplace.getAddress(), 2);
    await marketplace.connect(player2).acceptTrade(0, 2);

    expect(await arena.ownerOf(0)).to.equal(player2.address);
    expect(await arena.ownerOf(2)).to.equal(player1.address);
  });

  it("Should emit TradeAccepted event", async function () {
    await arena.connect(player2).approve(await marketplace.getAddress(), 2);

    await expect(marketplace.connect(player2).acceptTrade(0, 2))
      .to.emit(marketplace, "TradeAccepted")
      .withArgs(0, player2.address, 0, 2);
  });
});
```

#### Test PremiumBooster : Vérification du prix

```javascript
// PremiumBooster.test.js (extrait réel)
describe("Opening Boosters with Payment", function () {
  it("Should revert if payment is insufficient", async function () {
    const price = await booster.boosterPrice();
    const insufficientPayment = price - 1n;

    await expect(
      booster.connect(player1).openBooster({ value: insufficientPayment })
    ).to.be.revertedWith("Insufficient payment");
  });

  it("Should open booster with exact payment and mint 4 cards", async function () {
    const price = await booster.boosterPrice();
    
    await booster.connect(player1).openBooster({ value: price });

    const balance = await arena.balanceOf(player1.address);
    expect(balance).to.equal(4);
  });
});
```

#### Test Fusion : Attack × level

```javascript
// CardFusion.test.js (extrait réel)
describe("Successful Fusion", function () {
  it("Should calculate attack correctly for fused card", async function () {
    await fusion.fuseCards(0, 1);

    const newTokenId = 2;
    const card = await arena.cardDetails(newTokenId);
    
    // Dragon Dore base attack is 150, level 2 should be 150 * 2 = 300
    expect(card.stats.attack).to.equal(300);
  });
});

describe("Multi-level Fusion", function () {
  it("Should correctly calculate attack for level 3 fusion", async function () {
    // Create level 2 cards
    await arena.setFusionContract(owner.address);
    await arena.mintFusion(owner.address, "Archer Elfe", "rare", 2);
    await arena.mintFusion(owner.address, "Archer Elfe", "rare", 2);
    
    await arena.setFusionContract(await fusion.getAddress());

    await fusion.fuseCards(0, 1);

    const newCard = await arena.cardDetails(2);
    expect(newCard.level).to.equal(3);
    expect(newCard.stats.attack).to.equal(75 * 3); // Archer Elfe base = 75
  });
});
```

---


## 7. Conclusion

### 7.1 Respect des contraintes

| Contrainte | Status | Implémentation |
|------------|--------|----------------|
| Tokenisation niveaux | ✅ | 6 raretés + 5 levels |
| Échanges de tokens | ✅ | Marketplace P2P (2 types) |
| Limites possession | ✅ | MAX_CARDS = 30 |
| Cooldown 5 min | ✅ | lastAction mapping |
| Lock 10 min | ✅ | lockUntil mapping |
| Cooldown Shop 24h | ✅ | lastPurchase mapping |
| IPFS | ✅ | 18 images Pinata |
| Tests Hardhat | ✅ | 6 fichiers tests (~90% coverage) |

### 7.2 Innovations du projet

1. **Boutique exclusive** : Shop avec cartes secrètes ultra-rares (500 ATK)
2. **Stock limité** : Seulement 50 exemplaires de chaque carte secrète
3. **Système de points** : AFK Arena récompense avec points pour acheter au Shop
4. **Triple cooldown** : 5 min (minting), 10 min (lock), 24h (Shop)
5. **Double système d'échange** : Trade générique + direct trade
6. **Métadonnées dynamiques** : On-chain avec images IPFS
7. **Économie déflationniste** : Fusion brûle 2 cartes
8. **Progression exponentielle** : Attack × level (jusqu'à 5000 ATK au level 10)
9. **6 raretés distinctes** : Commune → Secrète
10. **Modularité totale** : 6 contrats indépendants

### 7.3 Métriques du projet

```
Smart Contracts : 6
Lignes Solidity : ~2,000
Tests unitaires : 6 fichiers
Couverture tests : ~90%
Composants React : 9
Lignes TypeScript : ~6,000
Images IPFS : 18 cartes uniques
Raretés : 6 (Commune, Peu commune, Rare, Épique, Légendaire, Secrète)
Cartes totales : 18 designs uniques
Stock limité : 50 × 3 cartes secrètes = 150 max worldwide
```

### 7.4 Économie du jeu

```
Sources d'acquisition:
├── Free Booster (gratuit, 10 min cooldown)
│   └── 2 cartes aléatoires
├── Premium Booster (0.001 ETH)
│   └── 4 cartes aléatoires, meilleurs taux
└── Shop (points AFK Arena)
    ├── Légendaires (1M points, illimité)
    └── Secrètes (5M points, 50 max)

Sink (destruction):
└── Fusion: 2 cartes → 1 carte level+1

Circulation:
└── Marketplace: échanges P2P

Limites:
├── MAX_CARDS: 30 par joueur
├── Cooldowns: 5 min / 10 min / 24h
└── Locks: 10 min après acquisition
```

---

## Annexes

### A. Adresses des contrats (Sepolia)

```
ArenaCards:      0x... (à compléter après déploiement)
FreeBooster:     0x...
PremiumBooster:  0x...
Shop:            0x... 🆕
Marketplace:     0x...
CardFusion:      0x...
```

### B. Commandes utiles

```bash
# Compilation
npx hardhat compile

# Tests
npx hardhat test
npx hardhat test test/Shop.test.js  # Test Shop spécifique
npx hardhat coverage

# Déploiement Sepolia
npx hardhat run scripts/deploy.js --network sepolia

# Vérification Etherscan
npx hardhat verify --network sepolia DEPLOYED_ADDRESS
```

### C. Variables d'environnement

```bash
# blockchain/.env
API_KEY=votre_infura_api_key
PASS_PHRASE=votre_metamask_passphrase

# frontend/ArenaCards/.env
VITE_ARENA_CARDS_ADDRESS=0x...
VITE_FREE_BOOSTER_ADDRESS=0x...
VITE_PREMIUM_BOOSTER_ADDRESS=0x...
VITE_SHOP_ADDRESS=0x... 🆕
VITE_MARKETPLACE_ADDRESS=0x...
VITE_CARD_FUSION_ADDRESS=0x...
```

### D. Catalogue complet des cartes

#### Communes (5)
1. Gobelin Rusé - 45 ATK
2. Sorcière Noire - 40 ATK
3. Barbare Sauvage - 50 ATK
4. Squelette Soldat - 35 ATK
5. Slime Gluant - 30 ATK

#### Peu communes (3)
6. Guerrier Brave - 55 ATK
7. Voleur Agile - 50 ATK
8. Prêtre Sage - 45 ATK

#### Rares (3)
9. Archer Elfe - 75 ATK
10. Paladin Sacré - 70 ATK
11. Druide Ancien - 65 ATK

#### Épiques (3)
12. Chevalier Noir - 100 ATK
13. Mage des Glaces - 90 ATK
14. Assassin Fantôme - 95 ATK

#### Légendaires (2)
15. Dragon Doré - 150 ATK
16. Phoenix Immortel - 140 ATK

#### Secrètes (3) 🔥
17. **Brice : Le divin suprême** - **500 ATK** - Stock: 50
18. **Paul : Le malicieux** - **500 ATK** - Stock: 50
19. **Flavien : Le bienfaiteur** - **500 ATK** - Stock: 50
