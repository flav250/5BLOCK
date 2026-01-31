import { ethers } from 'ethers';

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
): Promise<void> {

    const contract = new ethers.Contract(
        CARD_FUSION_ADDRESS,
        CARD_FUSION_ABI,
        signer
    );

    const tx = await contract.fuseCards(tokenId1, tokenId2);
    await tx.wait();
}

export async function getFusionCooldown(
    signer: ethers.Signer,
    player: string
): Promise<number> {
    const contract = new ethers.Contract(
        CARD_FUSION_ADDRESS,
        CARD_FUSION_ABI,
        signer
    );

    const last = await contract.lastFusion(player);
    const COOLDOWN = 300;

    const now = Math.floor(Date.now() / 1000);
    const remaining = Number(last) + COOLDOWN - now;

    return remaining > 0 ? remaining : 0;
}
