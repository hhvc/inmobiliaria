import { useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { useAuth } from "../../context/auth/useAuth";
import { db } from "../../firebase/config";
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

const normalizeDomain = (value = "") => {
    return value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");
};

const parseDomainsInput = (value = "") => {
    return Array.from(
        new Set(
            value
                .split(/[\n,;]/)
                .map(normalizeDomain)
                .filter(Boolean),
        ),
    );
};

const formatDomainsInput = (domains = []) => {
    if (!Array.isArray(domains)) return "";

    return domains.map(normalizeDomain).filter(Boolean).join("\n");
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

const getInitialInmobiliariaId = ({ user, inmobiliarias, isRoot }) => {
    const storedId = getStoredActiveInmobiliariaId();

    if (storedId && inmobiliarias.some((inmo) => inmo.id === storedId)) {
        return storedId;
    }

    if (!isRoot && Array.isArray(user?.inmobiliarias)) {
        const firstAllowed = user.inmobiliarias.find((id) =>
            inmobiliarias.some((inmo) => inmo.id === id),
        );

        if (firstAllowed) return firstAllowed;
    }

    return inmobiliarias[0]?.id || "";
};

const hasDomainModule = (inmobiliaria) => {
    const modules = Array.isArray(inmobiliaria?.modulosSuscriptos)
        ? inmobiliaria.modulosSuscriptos
        : DEFAULT_MODULES;

    return modules.includes("dominios");
};

const InmobiliariaDomainsPage = () => {
    const { user } = useAuth();

    const [inmobiliarias, setInmobiliarias] = useState([]);
    const [activeInmobiliariaId, setActiveInmobiliariaId] = useState("");
    const [domainsInput, setDomainsInput] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const { isRoot, isAdmin } = getRoleFlags(user);

    const activeInmobiliaria = useMemo(() => {
        return inmobiliarias.find((inmo) => inmo.id === activeInmobiliariaId) || null;
    }, [activeInmobiliariaId, inmobiliarias]);

    const parsedDomains = useMemo(() => {
        return parseDomainsInput(domainsInput);
    }, [domainsInput]);

    const canUseDomainModule = useMemo(() => {
        if (!activeInmobiliaria) return false;
        if (isRoot) return true;

        return hasDomainModule(activeInmobiliaria);
    }, [activeInmobiliaria, isRoot]);

    useEffect(() => {
        const loadInmobiliarias = async () => {
            try {
                setLoading(true);
                setError(null);

                if (!user?.uid) {
                    setInmobiliarias([]);
                    return;
                }

                const data = isRoot
                    ? await getAllInmobiliarias()
                    : await getInmobiliariasByRole(user);

                setInmobiliarias(data);

                const initialId = getInitialInmobiliariaId({
                    user,
                    inmobiliarias: data,
                    isRoot,
                });

                setActiveInmobiliariaId(initialId);

                const initialInmobiliaria =
                    data.find((inmo) => inmo.id === initialId) || null;

                setDomainsInput(formatDomainsInput(initialInmobiliaria?.dominiosPublicos));
            } catch (err) {
                console.error("Error cargando dominios de inmobiliaria:", err);
                setError("No se pudieron cargar las inmobiliarias.");
            } finally {
                setLoading(false);
            }
        };

        if (isRoot || isAdmin) {
            loadInmobiliarias();
        } else {
            setLoading(false);
        }
    }, [isAdmin, isRoot, user]);

    const handleActiveInmobiliariaChange = (e) => {
        const nextId = e.target.value;
        const nextInmobiliaria =
            inmobiliarias.find((inmo) => inmo.id === nextId) || null;

        setActiveInmobiliariaId(nextId);
        setDomainsInput(formatDomainsInput(nextInmobiliaria?.dominiosPublicos));
        setError(null);
        setSuccessMessage(null);

        if (typeof window !== "undefined") {
            window.localStorage.setItem("activeInmobiliariaId", nextId);
        }
    };

    const handleSave = async () => {
        if (!activeInmobiliaria) return;

        try {
            setSaving(true);
            setError(null);
            setSuccessMessage(null);

            if (!canUseDomainModule) {
                throw new Error(
                    "Esta inmobiliaria no tiene habilitado el módulo de dominios.",
                );
            }

            const ref = doc(db, "inmobiliarias", activeInmobiliaria.id);

            await updateDoc(ref, {
                dominiosPublicos: parsedDomains,
                updatedAt: serverTimestamp(),
            });

            setInmobiliarias((prev) =>
                prev.map((inmo) =>
                    inmo.id === activeInmobiliaria.id
                        ? { ...inmo, dominiosPublicos: parsedDomains }
                        : inmo,
                ),
            );

            setDomainsInput(formatDomainsInput(parsedDomains));
            setSuccessMessage("Dominios actualizados correctamente.");
        } catch (err) {
            console.error("Error guardando dominios:", err);

            if (err.code === "permission-denied") {
                setError(
                    "No tenés permisos suficientes para actualizar los dominios de esta inmobiliaria.",
                );
            } else {
                setError(err.message || "No se pudieron guardar los dominios.");
            }
        } finally {
            setSaving(false);
        }
    };

    if (!isRoot && !isAdmin) {
        return (
            <main className="container py-5">
                <div className="alert alert-warning">
                    Esta sección está disponible para usuarios administradores.
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="container py-5 text-center">
                <div className="spinner-border" />
                <p className="text-muted mt-3">Cargando dominios...</p>
            </main>
        );
    }

    return (
        <main className="container py-4">
            <header className="mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                    <div>
                        <p className="text-uppercase text-muted small mb-1">
                            Panel de inmobiliaria
                        </p>

                        <h1 className="h3 mb-1">Administración de dominios</h1>

                        <p className="text-muted mb-0">
                            Definí qué dominios públicos resuelven automáticamente hacia la
                            landing de cada inmobiliaria.
                        </p>
                    </div>

                    {isRoot && <span className="badge text-bg-dark">ROOT</span>}
                </div>
            </header>

            {error && <div className="alert alert-danger">{error}</div>}

            {successMessage && (
                <div className="alert alert-success">{successMessage}</div>
            )}

            {inmobiliarias.length === 0 && (
                <div className="alert alert-info">
                    No hay inmobiliarias disponibles para este usuario.
                </div>
            )}

            {inmobiliarias.length > 0 && (
                <div className="row g-4">
                    <section className="col-lg-8">
                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4">
                                <div className="mb-4">
                                    <label className="form-label">Inmobiliaria</label>
                                    <select
                                        className="form-select form-select-lg"
                                        value={activeInmobiliariaId}
                                        onChange={handleActiveInmobiliariaChange}
                                    >
                                        {inmobiliarias.map((inmobiliaria) => (
                                            <option key={inmobiliaria.id} value={inmobiliaria.id}>
                                                {inmobiliaria.nombre}
                                                {inmobiliaria.slug ? ` /${inmobiliaria.slug}` : ""}
                                            </option>
                                        ))}
                                    </select>

                                    {!isRoot && (
                                        <div className="form-text">
                                            Solo ves inmobiliarias asignadas a tu usuario.
                                        </div>
                                    )}
                                </div>

                                {activeInmobiliaria && !canUseDomainModule && (
                                    <div className="alert alert-warning">
                                        Esta inmobiliaria no tiene habilitado el módulo{" "}
                                        <strong>Dominios propios</strong>. Un usuario root debe
                                        habilitarlo desde Administración de usuarios y suscripciones.
                                    </div>
                                )}

                                <div className="mb-3">
                                    <label className="form-label">Dominios públicos</label>

                                    <textarea
                                        className="form-control"
                                        rows={7}
                                        placeholder={[
                                            "ladoctaprop.com.ar",
                                            "www.ladoctaprop.com.ar",
                                        ].join("\n")}
                                        value={domainsInput}
                                        onChange={(e) => {
                                            setDomainsInput(e.target.value);
                                            setError(null);
                                            setSuccessMessage(null);
                                        }}
                                        disabled={!canUseDomainModule || saving}
                                    />

                                    <div className="form-text">
                                        Ingresá un dominio por línea. También acepta dominios
                                        separados por coma o punto y coma.
                                    </div>
                                </div>

                                <div className="border rounded-3 p-3 bg-light mb-4">
                                    <div className="small text-muted mb-2">
                                        Dominios normalizados que se guardarán
                                    </div>

                                    {parsedDomains.length > 0 ? (
                                        <div className="d-flex flex-wrap gap-2">
                                            {parsedDomains.map((domain) => (
                                                <span key={domain} className="badge text-bg-primary">
                                                    {domain}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-muted">
                                            No hay dominios cargados.
                                        </span>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleSave}
                                    disabled={!canUseDomainModule || saving}
                                >
                                    {saving ? "Guardando..." : "Guardar dominios"}
                                </button>
                            </div>
                        </div>
                    </section>

                    <aside className="col-lg-4">
                        <div className="card border-0 shadow-sm mb-4">
                            <div className="card-body p-4">
                                <h2 className="h5 mb-3">Cómo funciona</h2>

                                <ol className="text-muted ps-3 mb-0">
                                    <li>Primero se da de alta el dominio en Firebase Hosting.</li>
                                    <li>Luego se configuran los DNS del dominio.</li>
                                    <li>
                                        Finalmente se carga el dominio en esta pantalla para que la
                                        app sepa qué inmobiliaria debe mostrar.
                                    </li>
                                </ol>
                            </div>
                        </div>

                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4">
                                <h2 className="h5 mb-3">Landing pública</h2>

                                {activeInmobiliaria?.slug ? (
                                    <>
                                        <p className="text-muted">
                                            Ruta pública interna de esta inmobiliaria:
                                        </p>

                                        <a
                                            href={`/inmobiliaria/${activeInmobiliaria.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-outline-primary w-100"
                                        >
                                            Abrir /inmobiliaria/{activeInmobiliaria.slug}
                                        </a>
                                    </>
                                ) : (
                                    <p className="text-muted mb-0">
                                        Esta inmobiliaria todavía no tiene slug público.
                                    </p>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            )}
        </main>
    );
};

export default InmobiliariaDomainsPage;