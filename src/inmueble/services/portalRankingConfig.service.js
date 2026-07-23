import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../../firebase/config";
import {
    DEFAULT_PORTAL_RANKING_CONFIG,
    mergePortalRankingConfig,
} from "../utils/portalRanking.helpers";

const PORTAL_CONFIG_COLLECTION = "portal_config";
const RANKING_CONFIG_DOC_ID = "ranking";

const rankingConfigRef = doc(
    db,
    PORTAL_CONFIG_COLLECTION,
    RANKING_CONFIG_DOC_ID,
);

export const getPortalRankingConfig = async () => {
    try {
        const snap = await getDoc(rankingConfigRef);

        if (!snap.exists()) {
            return DEFAULT_PORTAL_RANKING_CONFIG;
        }

        return mergePortalRankingConfig(snap.data());
    } catch (err) {
        console.warn("No se pudo cargar configuración de ranking:", err);

        return DEFAULT_PORTAL_RANKING_CONFIG;
    }
};

export const savePortalRankingConfig = async (config = {}) => {
    const payload = mergePortalRankingConfig(config);

    await setDoc(
        rankingConfigRef,
        {
            ...payload,
            updatedAt: serverTimestamp(),
        },
        { merge: true },
    );

    return payload;
};