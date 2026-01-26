import { useState, useCallback } from 'react';
import { useWeb3 } from './context/Web3Context';

interface TransactionState {
  hash: string | null;
  status: 'idle' | 'pending' | 'success' | 'error';
  error: string | null;
  blockNumber: number | null;
}

export const useTransaction = () => {
  const { exchangeContract } = useWeb3();
  const [state, setState] = useState<TransactionState>({
    hash: null,
    status: 'idle',
    error: null,
    blockNumber: null,
  });

  const createExchangeOffer = useCallback(
    async (receiver: string, offeredTokenIds: number[], requestedTokenIds: number[]) => {
      if (!exchangeContract) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Exchange contract non initialisé',
        }));
        return;
      }

      setState((prev) => ({ ...prev, status: 'pending', error: null }));

      try {
        const tx = await exchangeContract.createExchangeOffer(
          receiver,
          offeredTokenIds,
          requestedTokenIds
        );

        setState((prev) => ({ ...prev, hash: tx.hash }));

        const receipt = await tx.wait();
        setState((prev) => ({
          ...prev,
          status: 'success',
          blockNumber: receipt.blockNumber,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        }));
      }
    },
    [exchangeContract]
  );

  const acceptExchangeOffer = useCallback(
    async (offerId: number) => {
      if (!exchangeContract) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Exchange contract non initialisé',
        }));
        return;
      }

      setState((prev) => ({ ...prev, status: 'pending', error: null }));

      try {
        const tx = await exchangeContract.acceptExchangeOffer(offerId);
        setState((prev) => ({ ...prev, hash: tx.hash }));

        const receipt = await tx.wait();
        setState((prev) => ({
          ...prev,
          status: 'success',
          blockNumber: receipt.blockNumber,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        }));
      }
    },
    [exchangeContract]
  );

  const reset = useCallback(() => {
    setState({
      hash: null,
      status: 'idle',
      error: null,
      blockNumber: null,
    });
  }, []);

  return {
    ...state,
    createExchangeOffer,
    acceptExchangeOffer,
    reset,
  };
};
