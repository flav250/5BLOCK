import React, { createContext, useContext, type ReactNode, useCallback, useState } from 'react';
import { BrowserProvider, Contract, ZeroAddress } from 'ethers';

// Déclaration de type pour window.ethereum
declare global {
    interface Window {
        ethereum?: any;
    }
}

// Types
export interface CardMetadata {
    name: string;
    type: string;
    value: string;
    hash: string;
    previousOwners: string[];
    createdAt: number;
    lastTransferAt: number;
}

export interface Card {
    id: number;
    metadata: CardMetadata;
    owner: string;
}

// Context
interface Web3ContextType {
    account: string | null;
    provider: BrowserProvider | null;
    cardContract: Contract | null;
    exchangeContract: Contract | null;
    isConnected: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export const Web3Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [account, setAccount] = useState<string | null>(null);
    const [provider, setProvider] = useState<BrowserProvider | null>(null);
    const [cardContract, setCardContract] = useState<Contract | null>(null);
    const [exchangeContract, setExchangeContract] = useState<Contract | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const CARD_CONTRACT_ADDRESS = import.meta.env.VITE_CARD_CONTRACT_ADDRESS || ZeroAddress;
    const EXCHANGE_CONTRACT_ADDRESS = import.meta.env.VITE_EXCHANGE_CONTRACT_ADDRESS || ZeroAddress;

    const CARD_ABI = [
        'function totalSupply() public view returns (uint256)',
        'function ownerOf(uint256 tokenId) public view returns (address)',
        'function balanceOf(address owner) public view returns (uint256)',
        'function tokenURI(uint256 tokenId) public view returns (string memory)',
        'function getCardCount(address user) public view returns (uint256)',
    ];

    const EXCHANGE_ABI = [
        'function createExchangeOffer(address receiver, uint256[] memory offeredTokenIds, uint256[] memory requestedTokenIds) public returns (uint256)',
        'function acceptExchangeOffer(uint256 offerId) public',
        'function getExchangeOffer(uint256 offerId) public view returns (tuple(address offerer, uint256[] offeredTokenIds, address receiver, uint256[] requestedTokenIds, uint256 createdAt, bool isActive))',
        'function getCooldownRemaining(address user) public view returns (uint256)',
        'function getLockRemaining(address user) public view returns (uint256)',
        'function canTransaction(address user) public view returns (bool)',
    ];

    const connect = useCallback(async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
            alert('Veuillez installer MetaMask');
            return;
        }

        try {
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts',
            });

            const newProvider = new BrowserProvider(window.ethereum);
            setProvider(newProvider);
            setAccount(accounts[0]);
            setIsConnected(true);

            if (CARD_CONTRACT_ADDRESS !== ZeroAddress) {
                const signer = await newProvider.getSigner();
                const card = new Contract(CARD_CONTRACT_ADDRESS, CARD_ABI, signer);
                setCardContract(card);

                const exchange = new Contract(EXCHANGE_CONTRACT_ADDRESS, EXCHANGE_ABI, signer);
                setExchangeContract(exchange);
            }
        } catch (error) {
            console.error('Erreur de connexion:', error);
        }
    }, [CARD_CONTRACT_ADDRESS, EXCHANGE_CONTRACT_ADDRESS]);

    const disconnect = useCallback(() => {
        setAccount(null);
        setProvider(null);
        setCardContract(null);
        setExchangeContract(null);
        setIsConnected(false);
    }, []);

    const value: Web3ContextType = {
        account,
        provider,
        cardContract,
        exchangeContract,
        isConnected,
        connect,
        disconnect,
    };

    return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};

export const useWeb3 = () => {
    const context = useContext(Web3Context);
    if (!context) {
        throw new Error('useWeb3 doit être utilisé dans un Web3Provider');
    }
    return context;
};
