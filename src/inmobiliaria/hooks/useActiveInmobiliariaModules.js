import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../context/auth/useAuth";
import {
    getAllInmobiliarias,
    getInmobiliariasByRole,
} from "../services/inmobiliaria.service";

const DEFAULT_MODULES = ["inmuebles", "consultas"];

const getRoleFlags = (user) => {
    const roles = user?.roles || [];
    const primaryRole = user?.primaryRole || user?.role || "";

    return {
        isRoot:
            primaryRole === "root" ||
            user?.role === "root" ||
            roles.includes("root"),
        isAdmin:
            primaryRole === "admin" ||
            user?.role === "admin" ||
            roles.includes("admin"),
    };
};

const getStoredActiveInmobiliariaId = () => {
    if (typeof window === "undefined") return null;

    return (
        window.localStorage.getItem("activeInmobiliariaId") ||
        window.localStorage.getItem("inmobiliariaActivaId") ||
        window.localStorage.getItem("activeInmobiliaria") ||
        null
    );
};

export const useActiveInmobiliariaModules = () => {
    const { user } = useAuth();

    const [inmobiliarias, setInmobiliarias] = useState([]);
    const [activeInmobiliariaId, setActiveInmobiliariaId] = useState("");
    const [loading, setLoading] = useState(false);

    const { isRoot, isAdmin } = getRoleFlags(user);

    useEffect(() => {
        const loadInmobiliarias = async () => {
            try {
                if (!user?.uid || (!isRoot && !isAdmin)) {
                    setInmobiliarias([]);
                    setActiveInmobiliariaId("");
                    return;
                }

                setLoading(true);

                const data = isRoot
                    ? await getAllInmobiliarias()
                    : await getInmobiliariasByRole(user);

                const storedId = getStoredActiveInmobiliariaId();

                const initialId =
                    storedId && data.some((inmo) => inmo.id === storedId)
                        ? storedId
                        : data[0]?.id || "";

                setInmobiliarias(data);
                setActiveInmobiliariaId(initialId);
            } catch (error) {
                console.warn("No se pudieron cargar módulos de inmobiliaria:", error);
                setInmobiliarias([]);
                setActiveInmobiliariaId("");
            } finally {
                setLoading(false);
            }
        };

        loadInmobiliarias();
    }, [isAdmin, isRoot, user]);

    const activeInmobiliaria = useMemo(() => {
        return inmobiliarias.find((inmo) => inmo.id === activeInmobiliariaId) || null;
    }, [activeInmobiliariaId, inmobiliarias]);

    const modules = useMemo(() => {
        if (isRoot) {
            return ["inmuebles", "consultas", "dominios", "branding", "usuarios", "reportes"];
        }

        if (!activeInmobiliaria) return DEFAULT_MODULES;

        return Array.isArray(activeInmobiliaria.modulosSuscriptos)
            ? activeInmobiliaria.modulosSuscriptos
            : DEFAULT_MODULES;
    }, [activeInmobiliaria, isRoot]);

    const hasModule = (moduleId) => {
        if (isRoot) return true;

        return modules.includes(moduleId);
    };

    return {
        loading,
        isRoot,
        isAdmin,
        inmobiliarias,
        activeInmobiliaria,
        activeInmobiliariaId,
        modules,
        hasModule,
    };
};