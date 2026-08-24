import { useCallback, useEffect, useState } from "react";

import {
    PORTAL_FAVORITES_CHANGED_EVENT,
    PORTAL_FAVORITES_STORAGE_KEY,
    getPortalFavoriteKey,
    parsePortalFavorites,
    togglePortalFavorite,
} from "../utils/portalFavorites.helpers";

const readFavorites = () => {
    if (typeof window === "undefined") return [];

    return parsePortalFavorites(window.localStorage.getItem(PORTAL_FAVORITES_STORAGE_KEY));
};

const writeFavorites = (favorites) => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
        PORTAL_FAVORITES_STORAGE_KEY,
        JSON.stringify(favorites),
    );
    window.dispatchEvent(new CustomEvent(PORTAL_FAVORITES_CHANGED_EVENT));
};

export const usePortalFavorites = () => {
    const [favorites, setFavorites] = useState(readFavorites);

    useEffect(() => {
        const refresh = () => setFavorites(readFavorites());

        window.addEventListener("storage", refresh);
        window.addEventListener(PORTAL_FAVORITES_CHANGED_EVENT, refresh);

        return () => {
            window.removeEventListener("storage", refresh);
            window.removeEventListener(PORTAL_FAVORITES_CHANGED_EVENT, refresh);
        };
    }, []);

    const isFavorite = useCallback((item) => {
        const key = getPortalFavoriteKey(item);

        return Boolean(key && favorites.some((favorite) => favorite.key === key));
    }, [favorites]);

    const toggleFavorite = useCallback((item) => {
        const result = togglePortalFavorite(readFavorites(), item);
        writeFavorites(result.favorites);
        return result.added;
    }, []);

    const removeFavorite = useCallback((key) => {
        const nextFavorites = readFavorites().filter((favorite) => favorite.key !== key);
        writeFavorites(nextFavorites);
    }, []);

    return {
        favorites,
        count: favorites.length,
        isFavorite,
        toggleFavorite,
        removeFavorite,
    };
};
