# 5BLOCK
Project BlockChain for Supinfo

# 🃏 Arena Cards — Guide de lancement en local




Ouvre un terminal dans le dossier **blockchain** :

```bash
npm install
npx hardhat compile
npx hardhat node
```

➡️ Laisse ce terminal ouvert.  
Hardhat démarre une blockchain locale sur :

- RPC : http://127.0.0.1:8545  
- Chain ID : 31337  

Il affiche aussi plusieurs **comptes de test** avec 10 000 ETH chacun.

---

## 🚀 2. Déployer les smart contracts en local

Ouvre un **second terminal** (toujours dans `blockchain/`) :

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Tu dois voir quelque chose comme :

```text
ArenaCards deployed to: 0x...
Booster deployed to: 0x...
Authorized minter set to Booster: 0x...
```

➡️ Copie les adresses affichées, surtout celle du **Booster**.

---

## 🦊 3. Configurer MetaMask (réseau local)

### Ajouter le réseau Localhost

Dans MetaMask :
- Network name : Localhost 8545
- RPC URL : http://127.0.0.1:8545
- Chain ID : 31337
- Currency symbol : ETH

---

### Importer un compte Hardhat

Dans MetaMask :
1. Clique sur l’avatar (en haut à droite)
2. **Import account**
3. **Private key**
4. Colle une des clés privées affichées par Hardhat (Account #0 par exemple)

➡️ Sur le réseau Localhost, le compte doit afficher **~10 000 ETH**.

---

## ⚙️ 4. Configurer les adresses des contrats (dotenv)

Dans le dossier **frontend**, crée un fichier `.env` :

```env
VITE_BOOSTER_ADDRESS=0xADRESSE_DU_BOOSTER
VITE_ARENA_CARDS_ADDRESS=0xADRESSE_ARENACARDS
```

⚠️ Important :
- le préfixe `VITE_` est obligatoire
- après modification du `.env`, il faut **redémarrer le front**

---

## 🖥️ 5. Lancer le frontend

Dans le dossier **frontend** :

```bash
npm install
npm run dev
```

Ouvre ensuite l’URL indiquée (généralement `http://localhost:5173`).

---

## 🎮 6. Tester l’application

1. Clique sur **Connecter MetaMask**
2. Vérifie que le réseau est **Localhost 8545**
3. Clique sur **Ouvrir un booster**
4. Deux cartes sont mintées et affichées dans l’inventaire

---

