import { useEffect, useMemo, useState } from "react";

import { getPublicInmobiliariaByDomain } from "../services/inmobiliaria.service";
import {
    getAgencySlugFromDomain,
    getHostname,
    shouldResolveDomainFromFirestore,
} from "../utils/domainRouting";
import { DomainAgencyContext } from "./useDomainAgency";

export const DomainAgencyProvider = ({ children }) => {
    const [loading, setLoading] = useState(false);
    const [inmobiliaria, setInmobiliaria] = useState(null);
    const [error, setError] = useState(null);

    const hostname = getHostname();
    const fallbackSlug = getAgencySlugFromDomain();

    useEffect(() => {
        let active = true;

        const resolveDomain = async () => {
            try {
                setError(null);
                setInmobiliaria(null);

                if (!shouldResolveDomainFromFirestore(hostname)) {
                    return;
                }

                setLoading(true);

                const data = await getPublicInmobiliariaByDomain(hostname);

                if (!active) return;

                setInmobiliaria(data);
            } catch (err) {
                console.error("Error resolviendo dominio público:", err);

                if (active) {
                    setError(err.message || "No se pudo resolver el dominio público.");
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        resolveDomain();

        return () => {
            active = false;
        };
    }, [hostname]);

    const value = useMemo(() => {
        const resolvedSlug = inmobiliaria?.slug || fallbackSlug || null;

        return {
            hostname,
            loading,
            error,
            inmobiliaria,
            slug: resolvedSlug,
            isAgencyDomain: Boolean(resolvedSlug),
        };
    }, [error, fallbackSlug, hostname, inmobiliaria, loading]);

    return (
        <DomainAgencyContext.Provider value={value}>
            {children}
        </DomainAgencyContext.Provider>
    );
};