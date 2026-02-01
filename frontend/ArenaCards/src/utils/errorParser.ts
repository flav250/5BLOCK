// utils/errorParser.ts - Parser d'erreurs pour les contrats smart contracts

/**
 * Parse les erreurs Ethereum et retourne un message user-friendly en français
 */
export const parseContractError = (error: unknown): string => {
  if (!error) {
    return "Une erreur inconnue s'est produite";
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('user rejected') || errorMessage.includes('User denied')) {
    return 'Transaction annulée par l\'utilisateur';
  }

  if (errorMessage.includes('insufficient funds')) {
    return 'Fonds insuffisants pour cette transaction';
  }

  if (errorMessage.includes('network') || errorMessage.includes('NETWORK_ERROR')) {
    return 'Erreur de connexion au réseau blockchain';
  }

  if (errorMessage.includes('timeout')) {
    return 'La transaction a expiré, veuillez réessayer';
  }

  if (errorMessage.includes('Booster cooldown active')) {
    return 'Tu dois attendre avant d\'ouvrir un nouveau booster gratuit';
  }

  if (errorMessage.includes('Not enough space')) {
    return 'Tu as atteint la limite maximale de cartes';
  }

  if (errorMessage.includes('Insufficient payment')) {
    return 'Le paiement est insuffisant pour ce booster';
  }

  if (errorMessage.includes('Max cards reached')) {
    return 'Tu as déjà le maximum de cartes autorisées';
  }

  if (errorMessage.includes('Action on cooldown')) {
    return 'Tu dois attendre 5 minutes entre chaque action';
  }

  if (errorMessage.includes('Card is locked')) {
    return 'Cette carte est verrouillée et ne peut pas être utilisée';
  }

  if (errorMessage.includes('Must own both cards')) {
    return 'Tu dois posséder les deux cartes pour les fusionner';
  }

  if (errorMessage.includes('Cannot fuse same card')) {
    return 'Tu ne peux pas fusionner une carte avec elle-même';
  }

  if (errorMessage.includes('Cards must have same rarity')) {
    return 'Les cartes doivent avoir la même rareté pour être fusionnées';
  }

  if (errorMessage.includes('Fusion cooldown')) {
    return 'Tu dois attendre avant de fusionner à nouveau';
  }

  if (errorMessage.includes('Max level reached')) {
    return 'Cette carte a atteint le niveau maximum';
  }

  // Erreurs de contrat - Marketplace
  if (errorMessage.includes('Not owner')) {
    return 'Tu ne possèdes pas cette carte';
  }

  if (errorMessage.includes('already in active trade')) {
    return 'Cette carte est déjà dans un échange actif';
  }

  if (errorMessage.includes('not approved')) {
    return 'Tu dois d\'abord approuver le marketplace pour utiliser tes cartes';
  }

  if (errorMessage.includes('rarity must match')) {
    return 'La rareté de la carte offerte doit correspondre à celle demandée';
  }

  if (errorMessage.includes('level must match')) {
    return 'Le niveau de la carte offerte doit correspondre à celui demandé';
  }

  if (errorMessage.includes('does not match')) {
    return 'La carte ne correspond pas aux critères demandés';
  }

  if (errorMessage.includes('not active')) {
    return 'Cet échange n\'est plus actif';
  }

  if (errorMessage.includes('Invalid target')) {
    return 'Adresse invalide pour l\'échange';
  }

  if (errorMessage.includes('Cannot trade with yourself')) {
    return 'Tu ne peux pas échanger avec toi-même';
  }

  if (errorMessage.includes('does not own requested')) {
    return 'Le destinataire ne possède pas la carte demandée';
  }

  if (errorMessage.includes('Not the target')) {
    return 'Cet échange ne t\'est pas destiné';
  }

  if (errorMessage.includes('no longer own')) {
    return 'Une des cartes n\'est plus possédée par son propriétaire';
  }

  if (errorMessage.includes('execution reverted')) {
    const match = errorMessage.match(/execution reverted:?\s*(.+?)(?:\n|$)/i);
    if (match && match[1]) {
      return `Transaction échouée: ${match[1].trim()}`;
    }
    return 'La transaction a été rejetée par le contrat';
  }

  if (errorMessage.includes('gas required exceeds')) {
    return 'Cette transaction nécessite trop de gas, elle ne peut pas être exécutée';
  }

  if (errorMessage.includes('nonce too low')) {
    return 'Erreur de nonce, rafraîchis la page et réessaye';
  }

  const shortError = errorMessage.substring(0, 100);
  return `Erreur: ${shortError}${errorMessage.length > 100 ? '...' : ''}`;
};

/**
 * Détermine le type d'erreur pour afficher le bon style de notification
 */
export type ErrorType = 'error' | 'warning' | 'info';

export const getErrorType = (error: unknown): ErrorType => {
  if (!error) return 'error';

  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('user rejected') || errorMessage.includes('User denied')) {
    return 'warning';
  }

  if (errorMessage.includes('cooldown') || errorMessage.includes('wait')) {
    return 'info';
  }

  return 'error';
};
