// App.tsx

import { Web3Provider } from './hooks/useWeb3.ts';
import TeamBuilder from './components/TeamBuilder.tsx';
import Header from './components/Header.tsx';
import './App.css';

function App() {
  return (
    <Web3Provider>
      <div className="app">
        <Header />
        <main className="main-content">
          <TeamBuilder />
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
