import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

import { db } from "../../firebase/config";
import { useAuth } from "../../context/auth/useAuth";

const ACTIVE_INMOBILIARIA_EVENT = "onoprop:activeInmobiliariaChanged";

const DEFAULT_MODULES = ["inmuebles", "consultas"];

const normalizeRole = (role = "") => {
    const value = role.toString().trim().toLowerCase();

    if (value === "user") return "usuario";

    return value;
};

const normalizeRoles = (roles = []) => {
    const source = Array.isArray(roles) ? roles : [];

    const normalized = source.map((role) => normalizeRole(role)).filter(Boolean);
    const unique = Array.from(new Set(normalized));

    return unique.length > 0 ? unique : ["usuario"];
};

const hasRole = (user, role) => {
    if (!user) return false;

    const normalizedRole = normalizeRole(role);

    const roles = normalizeRoles(
        Array.isArray(user.roles)
            ? user.roles
            : user.role
                ? [user.role]
                : [],
    );

    const primaryRole = normalizeRole(user.primaryRole || user.role || "");

    return roles.includes(normalizedRole) || primaryRole === normalizedRole;
};

const getUserInmobiliarias = (user) => {
    return Array.isArray(user?.inmobiliarias) ? user.inmobiliarias : [];
};

const getStoredActiveInmobiliariaId = (user) => {
    const inmobiliarias = getUserInmobiliarias(user);

    const stored =
        localStorage.getItem("activeInmobiliariaId") ||
        localStorage.getItem("onoprop.activeInmobiliariaId") ||
        "";

    if (stored && inmobiliarias.includes(stored)) {
        return stored;
    }

    return "";
};

const resolveActiveInmobiliariaId = (user) => {
    const inmobiliarias = getUserInmobiliarias(user);

    if (user?.activeInmobiliariaId && inmobiliarias.includes(user.activeInmobiliariaId)) {
        return user.activeInmobiliariaId;
    }

    const stored = getStoredActiveInmobiliariaId(user);

    if (stored) return stored;

    return inmobiliarias[0] || "";
};

const normalizeInmobiliaria = (docSnap) => {
    if (!docSnap?.exists?.()) return null;

    const data = docSnap.data();

    return {
        id: docSnap.id,
        ...data,
        nombre: data.nombre || data.razonSocial || docSnap.id,
        activa: data.activa !== false,
        modulosSuscriptos: Array.isArray(data.modulosSuscriptos)
            ? data.modulosSuscriptos
            : DEFAULT_MODULES,
    };
};

export const useActiveInmobiliariaModules = () => {
    const { user } = useAuth();

    const [activeInmobiliariaId, setActiveInmobiliariaId] = useState(() =>
        resolveActiveInmobiliariaId(user),
    );

    const [activeInmobiliaria, setActiveInmobiliaria] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const isRoot = hasRole(user, "root");
    const isAdmin = hasRole(user, "admin");

    useEffect(() => {
        setActiveInmobiliariaId(resolveActiveInmobiliariaId(user));
    }, [user]);

    useEffect(() => {
        const handleActiveChange = (event) => {
            const nextId = event?.detail?.inmobiliariaId || "";

            if (!nextId) return;

            const inmobiliarias = getUserInmobiliarias(user);

            if (inmobiliarias.includes(nextId) || isRoot) {
                setActiveInmobiliariaId(nextId);
            }
        };

        window.addEventListener(ACTIVE_INMOBILIARIA_EVENT, handleActiveChange);

        return () => {
            window.removeEventListener(ACTIVE_INMOBILIARIA_EVENT, handleActiveChange);
        };
    }, [isRoot, user]);

    useEffect(() => {
        let mounted = true;

        const fetchActiveInmobiliaria = async () => {
            if (!activeInmobiliariaId) {
                setActiveInmobiliaria(null);
                return;
            }

            try {
                setLoading(true);
                setError("");

                const ref = doc(db, "inmobiliarias", activeInmobiliariaId);
                const snap = await getDoc(ref);

                if (!mounted) return;

                setActiveInmobiliaria(normalizeInmobiliaria(snap));
            } catch (err) {
                console.error("Error cargando inmobiliaria activa:", err);

                if (mounted) {
                    setError(err.message || "No se pudo cargar la inmobiliaria activa.");
                    setActiveInmobiliaria(null);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        fetchActiveInmobiliaria();

        return () => {
            mounted = false;
        };
    }, [activeInmobiliariaId]);

    const modulosSuscriptos = useMemo(() => {
        return Array.isArray(activeInmobiliaria?.modulosSuscriptos)
            ? activeInmobiliaria.modulosSuscriptos
            : DEFAULT_MODULES;
    }, [activeInmobiliaria]);

    const hasModule = useCallback(
        (moduleId) => {
            if (isRoot) return true;
            if (!moduleId) return true;

            return modulosSuscriptos.includes(moduleId);
        },
        [isRoot, modulosSuscriptos],
    );

    return {
        loading,
        error,

        activeInmobiliaria,
        activeInmobiliariaId,
        modulosSuscriptos,

        isRoot,
        isAdmin,

        hasModule,
    };
};