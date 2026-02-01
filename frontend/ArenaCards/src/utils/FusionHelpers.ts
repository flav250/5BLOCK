import { ethers } from 'ethers';
import { notifyError, notifySuccess } from './notificationService';

const CARD_FUSION_ADDRESS = import.meta.env.VITE_CARDFUSION_ADDRESS as string;

const CARD_FUSION_ABI = [
    'function fuseCards(uint256,uint256) external returns (uint256)',
    'function lastFusion(address) view returns (uint256)',
    'event CardsFused(address indexed player,uint256,uint256,uint256,string)',
];

export async function fuseCards(
    signer: ethers.Signer,
    tokenId1: number,
    tokenId2: number
): Promise<boolean> {
    try {
        const contract = new ethers.Contract(
            CARD_FUSION_ADDRESS,
            CARD_FUSION_ABI,
            signer
        );

        const tx = await contract.fuseCards(tokenId1, tokenId2);
        const receipt = await tx.wait();

        // Extraire le niveau de la nouvelle carte fusionnée depuis les events
        let newLevel = 0;
        for (const log of receipt.logs) {
            try {
                const parsed = contract.interface.parseLog({
                    topics: log.topics as string[],
                    data: log.data,
                });
                if (parsed?.name === 'CardsFused') {
                    // L'event contient le nouveau token ID et potentiellement d'autres infos
                    newLevel = Number(parsed.args[2] || 0) + 1; // Approximation du niveau
                }
            } catch {}
        }

        if (newLevel > 0) {
            notifySuccess(`Fusion réussie ! Nouvelle carte niveau ${newLevel}`);
        } else {
            notifySuccess('Fusion réussie !');
        }

        console.log('✅ Fusion effectuée avec succès');
        return true;
    } catch (error) {
        console.error('❌ Erreur lors de la fusion:', error);
        notifyError(error);
        return false;
    }
}

export async function getFusionCooldown(
    signer: ethers.Signer,
    player: string
): Promise<number> {
    try {
        const contract = new ethers.Contract(
            CARD_FUSION_ADDRESS,
            CARD_FUSION_ABI,
            signer
        );

        const last = await contract.lastFusion(player);
        const COOLDOWN = 0;

        const now = Math.floor(Date.now() / 1000);
        const remaining = Number(last) + COOLDOWN - now;

        return remaining > 0 ? remaining : 0;
    } catch (error) {
        console.error('Erreur lors de la récupération du cooldown fusion:', error);
        return 0;
    }
}
