import { Web3Provider } from './context/Web3Context'
import { WalletConnect } from './WalletConnect'
import './App.css'

function AppContent() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🎴 Collection de Cartes Web3</h1>
        <WalletConnect />
      </header>

      <main className="app-main">
        <section className="hero">
          <h2>Bienvenue dans votre galerie de cartes</h2>
          <p>Connectez votre portefeuille pour commencer à collectionner et échanger des cartes NFT</p>
        </section>

        <section className="features">
          <div className="feature-card">
            <h3>🏆 Collectionnez</h3>
            <p>Accumulez jusqu'à 4 cartes uniques avec différents niveaux de rareté</p>
          </div>
          <div className="feature-card">
            <h3>🔄 Échangez</h3>
            <p>Échangez vos cartes avec d'autres utilisateurs de manière sécurisée</p>
          </div>
          <div className="feature-card">
            <h3>📊 Suivez</h3>
            <p>Consultez l'historique complet de vos transactions et propriétaires</p>
          </div>
        </section>
      </main>
    </div>
  )
}

function App() {
  return (
    <Web3Provider>
      <AppContent />
    </Web3Provider>
  )
}

export default App
