import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { Web3Provider } from './hooks/useWeb3.ts';
import TeamBuilder from './components/TeamBuilder.tsx';
import Header from './components/Header.tsx';
import BoosterOpener from "./components/BoosterOpener.tsx";
import Marketplace from './components/Marketplace.tsx';
import './App.css';
import Fusion from "./components/Fusion.tsx";
import AFKArena from './components/AFKArena.tsx';
import Shop from "./components/Shop.tsx";

type View = 'team' | 'booster' | 'marketplace' | 'fusion' | 'arena' | 'shop';


function App() {
  const [currentView, setCurrentView] = useState<View>('team');

  return (
      <Web3Provider>
        <Toaster />
        <div className="app">
          <Header />
          {/* Navigation */}
          <nav className="main-nav">
            <button
                className={`nav-btn ${currentView === 'team' ? 'active' : ''}`}
                onClick={() => setCurrentView('team')}
            >
              ⚔️ Mon Équipe
            </button>
            <button
                className={`nav-btn ${currentView === 'booster' ? 'active' : ''}`}
                onClick={() => setCurrentView('booster')}
            >
              🎁 Boosters
            </button>
            <button
                className={`nav-btn ${currentView === 'marketplace' ? 'active' : ''}`}
                onClick={() => setCurrentView('marketplace')}
            >
              🏪 Marketplace
            </button>
            <button
              className={`nav-btn ${currentView === 'fusion' ? 'active' : ''}`}
              onClick={() => setCurrentView('fusion')}
          >
            🏪 Fusion
          </button>
            <button
                className={`nav-btn ${currentView === 'arena' ? 'active' : ''}`}
                onClick={() => setCurrentView('arena')}>
              🎮 AFK Arena
            </button>
            <button
                className={`nav-btn ${currentView === 'shop' ? 'active' : ''}`}
                onClick={() => setCurrentView('shop')}
            >
              🛒 Boutique
            </button>
          </nav>

          {/* Main Content */}
          <main className="main-content">
            {currentView === 'team' && <TeamBuilder />}
            {currentView === 'booster' && <BoosterOpener />}
            {currentView === 'marketplace' && <Marketplace />}
            {currentView === 'fusion' && <Fusion />}
            {currentView === 'arena' && <AFKArena />}
            {currentView === 'shop' && <Shop />}

          </main>

          <footer className="app-footer">
            <p>Arena Cards - Draft League Fantasy</p>
            <p>Powered by Ethereum • Sepolia Testnet</p>
          </footer>
        </div>
      </Web3Provider>
  );
}

export default App;
