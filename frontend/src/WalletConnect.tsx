import React from 'react';
import { useWeb3 } from './context/Web3Context';
import './WalletConnect.css';

export const WalletConnect: React.FC = () => {
  const { account, isConnected, connect, disconnect } = useWeb3();

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Erreur de connexion:', error);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="wallet-connect">
      {!isConnected ? (
        <button onClick={handleConnect} className="connect-btn">
          Connecter le portefeuille
        </button>
      ) : (
        <div className="wallet-info">
          <span className="wallet-address">{formatAddress(account!)}</span>
          <button onClick={disconnect} className="disconnect-btn">
            Déconnecter
          </button>
        </div>
      )}
    </div>
  );
};
