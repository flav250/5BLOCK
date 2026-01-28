// hooks/useWeb3.tsx - VERSION ABSOLUMENT FINALE ✅

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ethers } from 'ethers';
import type { BrowserProvider, Signer } from 'ethers';

interface Web3ContextType {
  account: string | null;
  provider: BrowserProvider | null;
  signer: Signer | null;
  isConnecting: boolean;
  chainId: number | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

interface Web3ProviderProps {
  children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps): React.ReactNode {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);

  // Détecter les changements de compte et de réseau
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown): void => {
      const accountsArray = accounts as string[];
      if (accountsArray.length === 0) {
        disconnectWallet();
      } else {
        setAccount(accountsArray[0]);
      }
    };

    const handleChainChanged = (): void => {
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Vérifier si déjà connecté au chargement
    checkIfConnected();

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkIfConnected = async (): Promise<void> => {
    if (!window.ethereum) return;

    try {
      const accounts = (await window.ethereum.request({
        method: 'eth_accounts',
      })) as string[];

      if (accounts.length > 0) {
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const web3Signer = await web3Provider.getSigner();
        const network = await web3Provider.getNetwork();

        setProvider(web3Provider);
        setSigner(web3Signer);
        setAccount(accounts[0]);
        setChainId(Number(network.chainId));
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de connexion:', error);
    }
  };

  const disconnectWallet = (): void => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    console.log('👋 Wallet déconnecté');
  };

  const connectWallet = async (): Promise<void> => {
    if (!window.ethereum) {
      alert("MetaMask n'est pas installé ! Installe-le sur metamask.io");
      return;
    }

    setIsConnecting(true);

    try {
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];

      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const web3Signer = await web3Provider.getSigner();
      const network = await web3Provider.getNetwork();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));

      console.log('✅ Wallet connecté:', accounts[0]);
      console.log('🌐 Réseau:', network.name, '(Chain ID:', network.chainId, ')');

      if (Number(network.chainId) !== 11155111) {
        console.warn("⚠️ Tu n'es pas sur Sepolia testnet!");
        alert('Attention: Tu n\'es pas sur le réseau Sepolia. Change de réseau dans MetaMask.');
      }
    } catch (error) {
      console.error('❌ Erreur de connexion:', error);
      if (error && typeof error === 'object' && 'code' in error && error.code === 4001) {
        alert('Connexion refusée. Clique sur "Suivant" puis "Connecter" dans MetaMask.');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        alert('Erreur lors de la connexion au wallet: ' + errorMessage);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const value: Web3ContextType = {
    account,
    provider,
    signer,
    isConnecting,
    chainId,
    connectWallet,
    disconnectWallet,
  };

  return React.createElement(Web3Context.Provider, { value }, children);
}

export function useWeb3(): Web3ContextType {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 doit être utilisé dans un Web3Provider');
  }
  return context;
}

// Type global pour window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}