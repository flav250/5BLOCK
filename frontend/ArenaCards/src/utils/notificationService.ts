// utils/notificationService.ts - Service de notifications avec react-hot-toast

import toast from 'react-hot-toast';
import { parseContractError, getErrorType } from './errorParser';

/**
 * Configuration des notifications
 */
const TOAST_CONFIG = {
  duration: 4000,
  position: 'top-right' as const,
  style: {
    borderRadius: '10px',
    background: '#333',
    color: '#fff',
    padding: '16px',
    fontSize: '14px',
    maxWidth: '400px',
  },
};

/**
 * Affiche une notification de succès
 */
export const notifySuccess = (message: string): void => {
  toast.success(message, {
    ...TOAST_CONFIG,
    icon: '✅',
    style: {
      ...TOAST_CONFIG.style,
      background: '#10b981',
    },
  });
};

/**
 * Affiche une notification d'erreur
 */
export const notifyError = (error: unknown): void => {
  const message = parseContractError(error);
  const errorType = getErrorType(error);

  if (errorType === 'warning') {
    toast(message, {
      ...TOAST_CONFIG,
      icon: '⚠️',
      style: {
        ...TOAST_CONFIG.style,
        background: '#f59e0b',
      },
    });
  } else if (errorType === 'info') {
    toast(message, {
      ...TOAST_CONFIG,
      icon: 'ℹ️',
      style: {
        ...TOAST_CONFIG.style,
        background: '#3b82f6',
      },
    });
  } else {
    toast.error(message, {
      ...TOAST_CONFIG,
      icon: '❌',
      style: {
        ...TOAST_CONFIG.style,
        background: '#ef4444',
      },
    });
  }

  // Log l'erreur complète dans la console pour debug
  console.error('❌ Erreur complète:', error);
};

/**
 * Affiche une notification d'info
 */
export const notifyInfo = (message: string): void => {
  toast(message, {
    ...TOAST_CONFIG,
    icon: 'ℹ️',
    style: {
      ...TOAST_CONFIG.style,
      background: '#3b82f6',
    },
  });
};

/**
 * Affiche une notification d'avertissement
 */
export const notifyWarning = (message: string): void => {
  toast(message, {
    ...TOAST_CONFIG,
    icon: '⚠️',
    style: {
      ...TOAST_CONFIG.style,
      background: '#f59e0b',
    },
  });
};

/**
 * Affiche une notification de chargement
 * Retourne l'ID du toast pour pouvoir le fermer plus tard
 */
export const notifyLoading = (message: string): string => {
  return toast.loading(message, {
    ...TOAST_CONFIG,
    style: {
      ...TOAST_CONFIG.style,
      background: '#6366f1',
    },
  });
};

/**
 * Met à jour une notification de chargement en succès
 */
export const notifyLoadingSuccess = (toastId: string, message: string): void => {
  toast.success(message, {
    id: toastId,
    ...TOAST_CONFIG,
    icon: '✅',
    style: {
      ...TOAST_CONFIG.style,
      background: '#10b981',
    },
  });
};

/**
 * Met à jour une notification de chargement en erreur
 */
export const notifyLoadingError = (toastId: string, error: unknown): void => {
  const message = parseContractError(error);
  toast.error(message, {
    id: toastId,
    ...TOAST_CONFIG,
    icon: '❌',
    style: {
      ...TOAST_CONFIG.style,
      background: '#ef4444',
    },
  });

  console.error('❌ Erreur complète:', error);
};

/**
 * Ferme toutes les notifications
 */
export const dismissAll = (): void => {
  toast.dismiss();
};

/**
 * Notifications spécifiques au contexte blockchain
 */
export const blockchainNotifications = {
  transactionPending: () => notifyLoading('Transaction en cours...'),
  transactionSuccess: (message: string) => notifySuccess(message),
  transactionError: (error: unknown) => notifyError(error),
  
  walletConnecting: () => notifyLoading('Connexion au wallet...'),
  walletConnected: (address: string) => {
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    notifySuccess(`Wallet connecté: ${shortAddress}`);
  },
  walletDisconnected: () => notifyInfo('Wallet déconnecté'),
  
  approvalNeeded: () => notifyWarning('Approbation nécessaire pour continuer'),
  approvalSuccess: () => notifySuccess('Contrat approuvé avec succès'),
  
  cardMinted: (cardName: string) => notifySuccess(`Carte "${cardName}" obtenue !`),
  cardsFused: (newLevel: number) => notifySuccess(`Fusion réussie ! Nouvelle carte niveau ${newLevel}`),
  
  tradeCreated: () => notifySuccess('Offre d\'échange créée avec succès'),
  tradeAccepted: () => notifySuccess('Échange effectué avec succès !'),
  tradeCancelled: () => notifyInfo('Échange annulé'),
};
