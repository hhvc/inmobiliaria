import { useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { useAuth } from "../../context/auth/useAuth";
import { db } from "../../firebase/config";
import {
    getAllInmobiliarias,
    getInmobiliariasByRole,
} from "../services/inmobiliaria.service";

const DEFAULT_MODULES = ["inmuebles", "consultas"];

const INITIAL_FORM = {
    nombre: "",
    razonSocial: "",
    email: "",
    telefono: "",
    whatsapp: "",
    logoUrl: "",
    heroUrl: "",
};

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

const hasBrandingModule = (inmobiliaria) => {
    const modules = Array.isArray(inmobiliaria?.modulosSuscriptos)
        ? inmobiliaria.modulosSuscriptos
        : DEFAULT_MODULES;

    return modules.includes("branding");
};

const getFormFromInmobiliaria = (inmobiliaria) => {
    if (!inmobiliaria) return INITIAL_FORM;

    const contacto = inmobiliaria.configuracion?.contacto || {};
    const branding = inmobiliaria.branding || {};
    const backgrounds = branding.backgrounds || {};

    return {
        nombre: inmobiliaria.nombre || "",
        razonSocial: inmobiliaria.razonSocial || "",
        email: contacto.email || "",
        telefono: contacto.telefono || "",
        whatsapp: contacto.whatsapp || "",
        logoUrl: branding.logo?.url || "",
        heroUrl:
            backgrounds.hero?.url ||
            backgrounds.principal?.url ||
            backgrounds.home?.url ||
            "",
    };
};

const cleanUrl = (value = "") => value.toString().trim();

const InmobiliariaBrandingPage = () => {
    const { user } = useAuth();

    const [inmobiliarias, setInmobiliarias] = useState([]);
    const [activeInmobiliariaId, setActiveInmobiliariaId] = useState("");
    const [form, setForm] = useState(INITIAL_FORM);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const { isRoot, isAdmin } = getRoleFlags(user);

    const activeInmobiliaria = useMemo(() => {
        return inmobiliarias.find((inmo) => inmo.id === activeInmobiliariaId) || null;
    }, [activeInmobiliariaId, inmobiliarias]);

    const canUseBrandingModule = useMemo(() => {
        if (!activeInmobiliaria) return false;
        if (isRoot) return true;

        return hasBrandingModule(activeInmobiliaria);
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

                const initialInmobiliaria =
                    data.find((inmo) => inmo.id === initialId) || null;

                setActiveInmobiliariaId(initialId);
                setForm(getFormFromInmobiliaria(initialInmobiliaria));
            } catch (err) {
                console.error("Error cargando branding de inmobiliaria:", err);
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
        setForm(getFormFromInmobiliaria(nextInmobiliaria));
        setError(null);
        setSuccessMessage(null);

        if (typeof window !== "undefined") {
            window.localStorage.setItem("activeInmobiliariaId", nextId);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));

        setError(null);
        setSuccessMessage(null);
    };

    const handleSave = async () => {
        if (!activeInmobiliaria) return;

        try {
            setSaving(true);
            setError(null);
            setSuccessMessage(null);

            if (!canUseBrandingModule) {
                throw new Error(
                    "Esta inmobiliaria no tiene habilitado el módulo de branding.",
                );
            }

            if (!form.nombre.trim()) {
                throw new Error("El nombre público es obligatorio.");
            }

            const currentConfiguracion = activeInmobiliaria.configuracion || {};
            const currentContacto = currentConfiguracion.contacto || {};
            const currentBranding = activeInmobiliaria.branding || {};
            const currentBackgrounds = currentBranding.backgrounds || {};

            const nextConfiguracion = {
                ...currentConfiguracion,
                contacto: {
                    ...currentContacto,
                    email: form.email.trim(),
                    telefono: form.telefono.trim(),
                    whatsapp: form.whatsapp.trim(),
                },
            };

            const nextBranding = {
                ...currentBranding,
                logo: {
                    ...(currentBranding.logo || {}),
                    url: cleanUrl(form.logoUrl),
                },
                backgrounds: {
                    ...currentBackgrounds,
                    hero: {
                        ...(currentBackgrounds.hero || {}),
                        url: cleanUrl(form.heroUrl),
                    },
                },
            };

            const ref = doc(db, "inmobiliarias", activeInmobiliaria.id);

            await updateDoc(ref, {
                nombre: form.nombre.trim(),
                razonSocial: form.razonSocial.trim(),
                configuracion: nextConfiguracion,
                branding: nextBranding,
                updatedAt: serverTimestamp(),
            });

            const updatedInmobiliaria = {
                ...activeInmobiliaria,
                nombre: form.nombre.trim(),
                razonSocial: form.razonSocial.trim(),
                configuracion: nextConfiguracion,
                branding: nextBranding,
            };

            setInmobiliarias((prev) =>
                prev.map((inmo) =>
                    inmo.id === activeInmobiliaria.id ? updatedInmobiliaria : inmo,
                ),
            );

            setForm(getFormFromInmobiliaria(updatedInmobiliaria));
            setSuccessMessage("Branding actualizado correctamente.");
        } catch (err) {
            console.error("Error guardando branding:", err);

            if (err.code === "permission-denied") {
                setError(
                    "No tenés permisos suficientes para actualizar el branding de esta inmobiliaria.",
                );
            } else {
                setError(err.message || "No se pudo guardar el branding.");
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
                <p className="text-muted mt-3">Cargando branding...</p>
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

                        <h1 className="h3 mb-1">Branding y datos públicos</h1>

                        <p className="text-muted mb-0">
                            Editá la identidad pública, datos de contacto, logo y portada de
                            la inmobiliaria.
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

                                {activeInmobiliaria && !canUseBrandingModule && (
                                    <div className="alert alert-warning">
                                        Esta inmobiliaria no tiene habilitado el módulo{" "}
                                        <strong>Branding</strong>. Un usuario root debe habilitarlo
                                        desde Administración global.
                                    </div>
                                )}

                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label">Nombre público *</label>
                                        <input
                                            type="text"
                                            name="nombre"
                                            className="form-control"
                                            value={form.nombre}
                                            onChange={handleChange}
                                            disabled={!canUseBrandingModule || saving}
                                        />
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label">Razón social</label>
                                        <input
                                            type="text"
                                            name="razonSocial"
                                            className="form-control"
                                            value={form.razonSocial}
                                            onChange={handleChange}
                                            disabled={!canUseBrandingModule || saving}
                                        />
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label">Email público</label>
                                        <input
                                            type="email"
                                            name="email"
                                            className="form-control"
                                            value={form.email}
                                            onChange={handleChange}
                                            disabled={!canUseBrandingModule || saving}
                                        />
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label">Teléfono público</label>
                                        <input
                                            type="tel"
                                            name="telefono"
                                            className="form-control"
                                            value={form.telefono}
                                            onChange={handleChange}
                                            disabled={!canUseBrandingModule || saving}
                                        />
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label">WhatsApp público</label>
                                        <input
                                            type="tel"
                                            name="whatsapp"
                                            className="form-control"
                                            value={form.whatsapp}
                                            onChange={handleChange}
                                            disabled={!canUseBrandingModule || saving}
                                            placeholder="+54 9 351..."
                                        />
                                        <div className="form-text">
                                            Se usa para los botones de consulta por WhatsApp.
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label">Logo URL</label>
                                        <input
                                            type="url"
                                            name="logoUrl"
                                            className="form-control"
                                            value={form.logoUrl}
                                            onChange={handleChange}
                                            disabled={!canUseBrandingModule || saving}
                                            placeholder="https://..."
                                        />
                                    </div>

                                    <div className="col-12">
                                        <label className="form-label">Imagen de portada URL</label>
                                        <input
                                            type="url"
                                            name="heroUrl"
                                            className="form-control"
                                            value={form.heroUrl}
                                            onChange={handleChange}
                                            disabled={!canUseBrandingModule || saving}
                                            placeholder="https://..."
                                        />
                                        <div className="form-text">
                                            Esta imagen se usa como fondo del hero de la landing
                                            pública.
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleSave}
                                        disabled={!canUseBrandingModule || saving}
                                    >
                                        {saving ? "Guardando..." : "Guardar branding"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <aside className="col-lg-4">
                        <div className="card border-0 shadow-sm mb-4">
                            <div className="card-body p-4">
                                <h2 className="h5 mb-3">Vista previa</h2>

                                <div className="border rounded-4 overflow-hidden bg-white">
                                    <div
                                        className="d-flex align-items-center justify-content-center text-white text-center p-4"
                                        style={{
                                            minHeight: 180,
                                            background: form.heroUrl
                                                ? `linear-gradient(rgba(17,24,39,0.72), rgba(17,24,39,0.72)), url(${form.heroUrl}) center/cover`
                                                : "linear-gradient(135deg, #111827, #0d6efd)",
                                        }}
                                    >
                                        <div>
                                            {form.logoUrl && (
                                                <img
                                                    src={form.logoUrl}
                                                    alt="Logo"
                                                    className="rounded bg-white p-2 mb-3"
                                                    style={{
                                                        width: 84,
                                                        height: 84,
                                                        objectFit: "contain",
                                                    }}
                                                />
                                            )}

                                            <h3 className="h5 mb-1">
                                                {form.nombre || "Nombre inmobiliaria"}
                                            </h3>

                                            {form.razonSocial && (
                                                <div style={{ opacity: 0.82 }}>{form.razonSocial}</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-3">
                                        <div className="small text-muted mb-1">Contacto público</div>

                                        <div className="small">
                                            {form.email || form.telefono || form.whatsapp ? (
                                                <>
                                                    {form.email && <div>Email: {form.email}</div>}
                                                    {form.telefono && (
                                                        <div>Teléfono: {form.telefono}</div>
                                                    )}
                                                    {form.whatsapp && (
                                                        <div>WhatsApp: {form.whatsapp}</div>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-muted">
                                                    Sin datos de contacto cargados.
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4">
                                <h2 className="h5 mb-3">Landing pública</h2>

                                {activeInmobiliaria?.slug ? (
                                    <a
                                        href={`/inmobiliaria/${activeInmobiliaria.slug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-outline-primary w-100"
                                    >
                                        Abrir /inmobiliaria/{activeInmobiliaria.slug}
                                    </a>
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

export default InmobiliariaBrandingPage;