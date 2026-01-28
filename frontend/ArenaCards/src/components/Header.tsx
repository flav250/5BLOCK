// components/Header.tsx

import React from 'react';
import { useWeb3 } from '../hooks/useWeb3.ts';
import './Header.css';

const Header: React.FC = () => {
  const { account, chainId, connectWallet, disconnectWallet, isConnecting } = useWeb3();

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getNetworkName = (chainId: number): string => {
    const networks: Record<number, string> = {
      1: 'Ethereum Mainnet',
      11155111: 'Sepolia Testnet',
      5: 'Goerli Testnet',
      137: 'Polygon',
      80001: 'Mumbai Testnet',
    };
    return networks[chainId] || `Unknown (${chainId})`;
  };

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="header-left">
          <h1 className="app-title">
            <span className="title-icon">⚔️</span>
            Arena Cards
          </h1>
          <p className="app-subtitle">Draft League Fantasy</p>
        </div>

        <div className="header-right">
          {!account ? (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="connect-button"
            >
              {isConnecting ? (
                <>
                  <span className="button-spinner"></span>
                  Connexion...
                </>
              ) : (
                <>
                  <span className="wallet-icon">🦊</span>
                  Connecter MetaMask
                </>
              )}
            </button>
          ) : (
            <div className="wallet-info">
              <div className="network-badge">
                <span className="network-dot"></span>
                {chainId && getNetworkName(chainId)}
              </div>
              <div className="wallet-address">
                <span className="address-icon">👤</span>
                {formatAddress(account)}
              </div>
              <button
                onClick={disconnectWallet}
                className="disconnect-button"
                title="Déconnecter"
              >
                ⏏️
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
