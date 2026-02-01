# 🎴 Arena Cards - NFT Trading Card Game

Un jeu de cartes à collectionner basé sur la blockchain avec des mécaniques de combat automatique et un système de fusion de cartes.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-green)
![React](https://img.shields.io/badge/React-18.x-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)

---

## 📋 Table des matières

- [À propos](#-à-propos)
- [Fonctionnalités](#-fonctionnalités)
- [Technologies](#-technologies)
- [Installation](#-installation)
- [Structure du projet](#-structure-du-projet)
- [Smart Contracts](#-smart-contracts)
- [Frontend](#-frontend)
- [Guide d'utilisation](#-guide-dutilisation)

---

## 🎯 À propos

**Arena Cards** est un jeu de cartes NFT où chaque carte est un token ERC-721 unique avec des statistiques d'attaque. Les joueurs peuvent :

- 🎁 Ouvrir des boosters pour obtenir des cartes
- ⚔️ Composer une équipe de 5 cartes
- 🎮 Faire combattre leur équipe en mode AFK contre des monstres
- 🔄 Fusionner des cartes pour les améliorer
- 💰 Acheter et vendre des cartes sur la marketplace

---

## ✨ Fonctionnalités

### 🎴 Système de Cartes
- **NFT ERC-721** : Chaque carte est unique et possédée par le joueur
- **4 Raretés** : Commune, Rare, Épique, Légendaire
- **Statistiques** : Chaque carte a une attaque (10-150)
- **Verrouillage temporaire** : Anti-spam lors de l'ouverture de boosters

### 🎁 Boosters
- **Free Booster** : 2 carte commune/rare gratuite (cooldown 10min)
- **Premium Booster** : 4 cartes de toutes raretés sauf commune (0.0001 ETH)
- **Distribution aléatoire** : Système de probabilités on-chain

### 🛒 Boutique Exclusive (Shop)
- **Cartes Légendaires** : Stock illimité
  - Dragon Doré (ATK 150) - 1,000,000 wei
  - Phoenix Immortel (ATK 140) - 1,000,000 wei
- **Cartes Secrètes** : Édition limitée (50 exemplaires chacune)
  - Brice : Le divin suprême (ATK 500) - 5,000,000 wei
  - Paul : Le malicieux (ATK 500) - 5,000,000 wei
  - Flavien : Le bienfaiteur (ATK 500) - 5,000,000 wei
- **Cooldown 24h** : Une carte achetable par jour
- **Achat unique** : Chaque carte ne peut être achetée qu'une seule fois par joueur

###  AFK Arena (Jeu de Combat)
- **Combat automatique** : Toutes les 5 secondes
- **Vagues infinies** : Difficulté croissante
- **Système de points** : Accumulation progressive
- **Équipe de 5 cartes** : Synchronisée avec TeamBuilder
- **Popup overlay** : Interface de combat immersive

### 👥 Team Builder
- **Drag & Drop** : Interface intuitive
- **Auto-sauvegarde** : localStorage synchronisé
- **5 slots d'équipe** : Composition stratégique
- **Synchronisation bidirectionnelle** : Modifiable depuis AFK Arena ou TeamBuilder
- **Pas de blockchain** : Sauvegarde locale uniquement (pas de gas fees)

### 🔄 Card Fusion
- **Fusion de cartes** : 2 cartes identiques → 1 carte level supérieur
- **Amélioration permanente** : L'attaque augmente avec le level
- **Cartes consumées** : Brûlées lors de la fusion

### 🏪 Marketplace
- **Acheter/Vendre** : Peer-to-peer décentralisé
- **Prix libre** : Fixé par le vendeur
- **Frais de plateforme** : 2.5% sur chaque vente
- **Annulation** : Retrait des listings à tout moment

---

## 🛠 Technologies

### Backend (Smart Contracts)
```
Solidity 0.8.20
Hardhat
OpenZeppelin Contracts
- ERC-721 (NFT)
- Ownable
- ReentrancyGuard
Sepolia Testnet
```

### Frontend
```
React 18
TypeScript
Ethers.js v6
Vite
CSS3 (Dark Fantasy Theme)
```

### Outils
```
MetaMask
Hardhat
Node.js
npm
```

---

## 🚀 Installation

### Prérequis
```bash
Node.js >= 18.x
npm >= 9.x
MetaMask extension
Sepolia ETH (testnet)
```

### 1. Cloner le repo
```bash
git clone https://github.com/votre-username/arena-cards.git
cd arena-cards
```

### 2. Smart Contracts (blockchain/)
```bash
cd blockchain

# Installer les dépendances
npm install

# Créer .env
touch .env

# Configurer .env
API_KEY="votre api key sur INFURA"
PASS_PHRASE="La passphrase du compte METAMASK qui déploie"

# Compiler les contrats
npx hardhat compile

# Déployer sur Sepolia
npx hardhat run scripts/deploy.js --network sepolia

Les adresses des contrats vont être directement installées dans le .env pour votre frontend 

# Copier les ABIs depuis blockchain/
cp ../blockchain/artifacts/contracts/ArenaCards.sol/ArenaCards.json src/abis/
cp ../blockchain/artifacts/contracts/FreeBooster.sol/FreeBooster.json src/abis/
cp ../blockchain/artifacts/contracts/PremiumBooster.sol/PremiumBooster.json src/abis/
cp ../blockchain/artifacts/contracts/Marketplace.sol/Marketplace.json src/abis/
cp ../blockchain/artifacts/contracts/CardFusion.sol/CardFusion.json src/abis/

# Collez les à cet emplacement :

/frontend/ArenaCards/src/abis/ ->
```


### 3. Frontend ()
```bash
cd ../frontend/ArenaCards/

# Installer les dépendances
npm install

# Lancer en dev
npm run dev
```

### 4. Ouvrir l'application
```
http://localhost:5173
```

---

## 📁 Structure du projet

```
arena-cards/
├── blockchain/                    # Smart contracts (Hardhat)
│   ├── artifacts/                # Compiled contracts
│   ├── cache/                    # Build cache
│   ├── contracts/
│   │   ├── ArenaCards.sol        # NFT principal
│   │   ├── CardFusion.sol        # Fusion de cartes
│   │   ├── FreeBooster.sol       # Booster gratuit
│   │   ├── Marketplace.sol       # Marketplace P2P
│   │   ├── PremiumBooster.sol    # Booster premium
│   │   └── Shop.sol              # Boutique exclusive
│   ├── scripts/
│   │   └── deploy.js             # Script de déploiement
│   ├── test/
│   │   ├── ArenaCards.test.js
│   │   ├── CardFusion.test.js
│   │   ├── FreeBooster.test.js
│   │   ├── Marketplace.test.js
│   │   ├── PremiumBooster.test.js
│   │   └── Shop.test.js
│   ├── .env                      # Config (PRIVATE_KEY, RPC)
│   ├── hardhat.config.js
│   ├── package.json
│   └── README.md
│
└────── frontend/ ArenaCards/
                        └────── public/
                            │      └── assets/
                            │            └── boosters /
                            │                    ├── booster-2-stars.png
                            │                    └── booster-3-stars.png
                            └── src/
                                ├── abis/                  
                                │   ├── ArenaCards.json
                                │   ├── CardFusion.json
                                │   ├── FreeBooster.json
                                │   ├── Marketplace.json
                                │   ├── PremiumBooster.json
                                │   └── Shop.json
                                ├── components/
                                │   ├── AFKArena.css
                                │   ├── AFKArena.tsx       # Jeu de combat
                                │   ├── BoosterOpener.css
                                │   ├── BoosterOpener.tsx  # Ouverture boosters
                                │   ├── CardSlot.css
                                │   ├── CardSlot.tsx       # Slot d'équipe
                                │   ├── Fusion.css
                                │   ├── Fusion.tsx         # Fusion de cartes
                                │   ├── Header.css
                                │   ├── Header.tsx         # Header de l'app
                                │   ├── InventoryCard.css
                                │   ├── InventoryCard.tsx  # Carte inventaire
                                │   ├── Marketplace.css
                                │   ├── Marketplace.tsx    # Marketplace
                                │   ├── Shop.css
                                │   ├── Shop.tsx           # Boutique exclusive
                                │   ├── TeamBuilder.css
                                │   └── TeamBuilder.tsx    # Composition d'équipe
                                ├── hooks/
                                │   └── useWeb3.tsx        # Hook Web3/MetaMask
                                ├── types/
                                │   ├── AFKArena.ts        # Types jeu
                                │   └── ArenaCard.ts       # Types cartes
                                ├── utils/
                                │   ├── afkArenaLogic.ts   # Logique jeu
                                │   ├── contractHelpers.ts # Helpers contrats
                                │   └── teamHelpers.ts     # Helpers équipe
                                ├── App.css
                                ├── App.tsx                # App principale
                                ├── index.css
                                ├── main.tsx
                                └── vite-env.d.ts
```

---

## 📜 Smart Contracts

### ArenaCards.sol
**NFT principal ERC-721**
```solidity
- mint() : Créer une nouvelle carte
- getCard() : Récupérer les infos d'une carte
- lockCard() : Verrouiller temporairement
- upgradeCard() : Améliorer une carte (fusion)
```

### FreeBooster.sol
```solidity
- claimFreeBooster() : Ouvrir booster gratuit (10 min cooldown)
- Génération aléatoire on-chain
- 2 cartes par boosters 
```

### PremiumBooster.sol
```solidity
- buyPremiumBooster() : Acheter booster (0.001 ETH)
- 4 cartes par booster
```

### Marketplace.sol
```solidity
- listCard() : Mettre en vente
- buyCard() : Acheter une carte
- cancelListing() : Annuler une vente
- Frais de 2.5%
```

### CardFusion.sol
```solidity
- fuseCards() : Fusionner 2 cartes identiques
- Vérifie ownership + level
- Brûle les 2 cartes sources
- Crée 1 carte level supérieur
```

### Shop.sol
```solidity
- buyLegendaryCard() : Acheter une carte légendaire (stock illimité)
- buySecretCard() : Acheter une carte secrète (édition limitée)
- getShopCards() : Récupérer la liste des cartes disponibles
- Cooldown de 24h par joueur
- Système d'achat unique (une seule fois par carte)
```

---

## 🧪 Tests

### Exécuter les tests

Les smart contracts sont testés avec Hardhat. Tous les contrats disposent de tests complets.

```bash
cd blockchain

# Exécuter tous les tests
npm run test

# Exécuter un test spécifique
npx hardhat test test/ArenaCards.test.js
npx hardhat test test/FreeBooster.test.js
npx hardhat test test/PremiumBooster.test.js
npx hardhat test test/Marketplace.test.js
npx hardhat test test/CardFusion.test.js
npx hardhat test test/Shop.test.js

# Exécuter les tests avec rapport de couverture
npx hardhat coverage
```

### Tests disponibles

#### ArenaCards.test.js
```
✓ Mint de cartes NFT
✓ Récupération des informations de carte
✓ Verrouillage temporaire des cartes
✓ Upgrade de cartes (level up)
✓ Gestion des permissions
```

#### FreeBooster.test.js
```
✓ Ouverture de booster gratuit
✓ Cooldown de 10 minutes
✓ Génération aléatoire de 2 cartes
✓ Distribution par rareté (Commune/Rare)
```

#### PremiumBooster.test.js
```
✓ Achat de booster premium (0.0001 ETH)
✓ Génération aléatoire de 4 cartes
✓ Distribution par rareté (Rare/Épique/Légendaire)
✓ Retrait des fonds par l'owner
```

#### Marketplace.test.js
```
✓ Mise en vente d'une carte
✓ Achat d'une carte listée
✓ Annulation d'une vente
✓ Frais de plateforme (2.5%)
✓ Transfert de propriété
```

#### CardFusion.test.js
```
✓ Fusion de 2 cartes identiques
✓ Vérification du ownership
✓ Amélioration du level et de l'attaque
✓ Brûlage des cartes sources
✓ Gestion des erreurs (cartes différentes)
```

#### Shop.test.js
```
✓ Achat de carte légendaire
✓ Achat de carte secrète
✓ Vérification du cooldown 24h
✓ Achat unique par carte
✓ Gestion du stock limité (cartes secrètes)
✓ Ajout de nouvelles cartes (owner only)
✓ Vérification d'éligibilité d'achat
```

---

## 💻 Frontend

### Composants Principaux

#### AFKArena
Mode de jeu AFK (auto-battle)
```typescript
- Combat toutes les 5 secondes
- Popup overlay pendant le jeu
- Système de vagues infinies
- Accumulation de points
- Synchronisation avec TeamBuilder
```

#### TeamBuilder
Composition d'équipe
```typescript
- Drag & Drop intuitif
- 5 slots d'équipe
- Auto-sauvegarde localStorage
- Synchronisation bidirectionnelle
```

#### Marketplace
Place de marché
```typescript
- Filtres par rareté
- Tri par prix/level
- Achat instantané
- Gestion des listings
```

### Hooks

#### useWeb3
```typescript
const { account, signer, connect } = useWeb3();
```
Gère la connexion MetaMask et l'état Web3.

### Utils

#### contractHelpers.ts
```typescript
loadUserCards()      // Charger les cartes d'un joueur
loadMarketplace()    // Charger les listings
```

#### afkArenaLogic.ts
```typescript
generateMonster()    // Générer un monstre
simulateBattle()     // Simuler un combat
```

---

## 📖 Guide d'utilisation

### 1. Connexion
1. Installer MetaMask
2. Se connecter au réseau Sepolia
3. Obtenir du Sepolia ETH (faucet)
4. Cliquer "Connecter Wallet"

### 2. Obtenir des cartes
**Free Booster :**
```
1. Va dans "🎁 Boosters"
2. Clique "Ouvrir le Free Booster"
3. Attends 10min pour le prochain
```

**Premium Booster :**
```
1. Va dans "🎁 Boosters"
2. Clique "Acheter Premium Booster" (0.001 ETH)
3. Reçois 4 cartes instantanément
```

### 3. Composer une équipe
```
1. Va dans "👥 Mon Équipe"
2. Glisse-dépose 5 cartes dans les slots
3. Auto-sauvegarde automatique
```

### 4. Jouer à AFK Arena
```
1. Va dans "🎮 AFK Arena"
2. Vérifie ton équipe (5 cartes requises)
3. Clique "▶️ DÉMARRER"
4. Popup overlay s'affiche
5. Combat automatique toutes les 5s
6. Accumule des points !
```

### 5. Fusionner des cartes
```
1. Va dans "🔄 Fusion"
2. Sélectionne 2 cartes identiques
3. Clique "Fusionner"
4. Reçois 1 carte level supérieur
```

### 6. Boutique Exclusive
**Acheter une carte légendaire :**
```
1. Va dans "🛒 Boutique"
2. Section "Cartes Légendaires"
3. Choisis Dragon Doré ou Phoenix Immortel
4. Clique "Acheter" (1,000,000 wei)
5. Confirme la transaction
6. Stock illimité, achetable 1x par jour
```

**Acheter une carte secrète :**
```
1. Va dans "🛒 Boutique"
2. Section "Cartes Secrètes"
3. Choisis Brice, Paul ou Flavien
4. Clique "Acheter" (5,000,000 wei)
5. Confirme la transaction
6. Édition limitée (50 exemplaires max par carte)
7. Une seule fois par joueur par carte
```

### 7. Marketplace
**Vendre :**
```
1. Va dans "🏪 Marketplace"
2. Onglet "Mes Cartes"
3. Clique "Vendre" sur une carte
4. Entre le prix
5. Confirme la transaction
```

**Acheter :**
```
1. Va dans "🏪 Marketplace"
2. Parcours les listings
3. Clique "Acheter"
4. Confirme la transaction
```

---

<div align="center">

**Fait avec ❤️ et ⚔️**

[⬆ Retour en haut](#-arena-cards---nft-trading-card-game)

</div>
