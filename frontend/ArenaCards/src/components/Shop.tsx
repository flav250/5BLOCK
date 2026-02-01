import { useEffect, useMemo, useState } from "react";

function readArenaPointsFromLocalStorage(): number {
    const keys = Object.keys(localStorage);

    const ordered = [
        ...keys.filter((k) => /afk.*arena.*progress/i.test(k)),
        ...keys.filter((k) => /afk.*arena/i.test(k)),
        ...keys.filter((k) => /progress/i.test(k)),
        ...keys,
    ];

    for (const key of ordered) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;

            const data = JSON.parse(raw);

            if (data && typeof data.totalPoints === "number") {
                return data.totalPoints;
            }
            if (data && typeof data.points === "number") {
                return data.points;
            }
        } catch {
            //  -> ignore
        }
    }

    return 0;
}

export default function Shop() {
    const [arenaPoints, setArenaPoints] = useState<number>(0);

    // petit badge texte
    const pointsLabel = useMemo(() => {
        return `⭐ Points: ${arenaPoints.toLocaleString("fr-FR")}`;
    }, [arenaPoints]);

    useEffect(() => {
        setArenaPoints(readArenaPointsFromLocalStorage());
        const onStorage = () => setArenaPoints(readArenaPointsFromLocalStorage());
        window.addEventListener("storage", onStorage);

        return () => window.removeEventListener("storage", onStorage);
    }, []);

    return (
        <div
            style={{
                minHeight: "60vh",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                position: "relative",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    color: "#fff",
                    background: "rgba(0,0,0,0.45)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontWeight: 700,
                    backdropFilter: "blur(8px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                }}
                title="Points gagnés dans AFK Arena"
            >
                <span>{pointsLabel}</span>
            </div>

            {/* Contenu centre */}
            <div
                style={{
                    textAlign: "center",
                    background: "rgba(0,0,0,0.35)",
                    padding: 24,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.15)",
                }}
            >
                <div style={{ fontSize: 80, lineHeight: 1 }}>🚧</div>
                <h2 style={{ marginTop: 12, color: "#fff" }}>Boutique</h2>
                <p style={{ opacity: 0.85, color: "#fff" }}>
                    En construction… bientôt disponible !
                </p>
            </div>
        </div>
    );
}
