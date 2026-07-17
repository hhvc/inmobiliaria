import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import Login from "../../components/auth/Login";
import { useAuth } from "../../context/auth/useAuth";

import {
    createInmobiliariaLinkRequest,
    getActiveInmobiliariasForLinkRequest,
} from "../services/inmobiliaria.service";

const normalizeText = (value = "") => {
    return value
        .toString()
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
};

const InmobiliariaLinkRequestPage = () => {
    const { user, activeInmobiliariaId } = useAuth();

    const [inmobiliarias, setInmobiliarias] = useState([]);
    const [selectedInmobiliariaId, setSelectedInmobiliariaId] = useState("");
    const [search, setSearch] = useState("");
    const [requestedRole, setRequestedRole] = useState("admin");
    const [mensaje, setMensaje] = useState("");

    const [loading, setLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const siteUrl =
        import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const userInmobiliarias = useMemo(() => {
        return Array.isArray(user?.inmobiliarias) ? user.inmobiliarias : [];
    }, [user?.inmobiliarias]);

    const linkedInmobiliariaIds = useMemo(() => {
        return Array.from(
            new Set([activeInmobiliariaId, ...userInmobiliarias].filter(Boolean)),
        );
    }, [activeInmobiliariaId, userInmobiliarias]);

    const filteredInmobiliarias = useMemo(() => {
        const normalizedSearch = normalizeText(search);

        return inmobiliarias.filter((inmobiliaria) => {
            if (linkedInmobiliariaIds.includes(inmobiliaria.id)) {
                return false;
            }

            if (!normalizedSearch) return true;

            const searchableText = [
                inmobiliaria.nombre,
                inmobiliaria.razonSocial,
                inmobiliaria.cuit,
                inmobiliaria.slug,
            ]
                .filter(Boolean)
                .join(" ");

            return normalizeText(searchableText).includes(normalizedSearch);
        });
    }, [inmobiliarias, linkedInmobiliariaIds, search]);

    const selectedInmobiliaria = useMemo(() => {
        return inmobiliarias.find(
            (inmobiliaria) => inmobiliaria.id === selectedInmobiliariaId,
        );
    }, [inmobiliarias, selectedInmobiliariaId]);

    useEffect(() => {
        const fetchInmobiliarias = async () => {
            if (!user) return;

            try {
                setLoading(true);
                setError("");

                const data = await getActiveInmobiliariasForLinkRequest();
                setInmobiliarias(data);
            } catch (err) {
                console.error("Error cargando inmobiliarias:", err);
                setError(err.message || "No se pudieron cargar las inmobiliarias");
            } finally {
                setLoading(false);
            }
        };

        fetchInmobiliarias();
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setSubmitLoading(true);
            setError("");
            setSuccess("");

            if (!selectedInmobiliaria) {
                throw new Error("Seleccioná una inmobiliaria");
            }

            await createInmobiliariaLinkRequest({
                inmobiliaria: selectedInmobiliaria,
                requestedRole,
                mensaje,
            });

            setSuccess(
                "Solicitud enviada correctamente. La inmobiliaria podrá revisar tu pedido.",
            );
            setSelectedInmobiliariaId("");
            setMensaje("");
        } catch (err) {
            console.error("Error creando solicitud de vinculación:", err);
            setError(err.message || "No se pudo enviar la solicitud");
        } finally {
            setSubmitLoading(false);
        }
    };

    return (
        <main className="portal-home">
            <SEO
                title="Solicitar vinculación a inmobiliaria | ONO Prop"
                description="Solicitá vincular tu usuario a una inmobiliaria existente en ONO Prop."
                url={`${siteUrl}/inmobiliarias/vincular`}
                type="website"
                siteName="ONO Prop"
                noIndex
            />

            <section className="portal-section">
                <div className="container">
                    <div className="mb-4">
                        <Link to="/inmobiliarias" className="btn btn-outline-secondary">
                            ← Volver
                        </Link>
                    </div>

                    {!user && (
                        <div className="row justify-content-center">
                            <div className="col-lg-7">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-body p-4 p-lg-5">
                                        <p className="text-uppercase text-muted small mb-1">
                                            Vinculación de usuario
                                        </p>

                                        <h1 className="h3 mb-3">
                                            Primero iniciá sesión o registrate.
                                        </h1>

                                        <p className="text-muted">
                                            Para solicitar vinculación a una inmobiliaria existente,
                                            necesitamos identificar tu usuario.
                                        </p>

                                        <Login />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {user && (
                        <>
                            <div className="row mb-4">
                                <div className="col-lg-9">
                                    <p className="text-uppercase text-muted small mb-1">
                                        Solicitud de vinculación
                                    </p>

                                    <h1 className="portal-section-title">
                                        Vincular mi usuario a una inmobiliaria existente
                                    </h1>

                                    <p className="lead text-muted">
                                        Usá esta opción si la inmobiliaria ya existe en ONO Prop y
                                        necesitás que te habiliten para operar dentro de su panel.
                                    </p>
                                </div>
                            </div>

                            <div className="alert alert-info">
                                <strong>Importante.</strong> La solicitud no habilita el acceso
                                automáticamente. Un administrador de la inmobiliaria o un usuario
                                root deberá aprobarla.
                            </div>

                            {error && <div className="alert alert-danger">{error}</div>}

                            {success && (
                                <div className="alert alert-success">{success}</div>
                            )}

                            <div className="card border-0 shadow-sm">
                                <div className="card-body p-4">
                                    {loading ? (
                                        <p className="text-muted mb-0">
                                            Cargando inmobiliarias disponibles...
                                        </p>
                                    ) : (
                                        <form onSubmit={handleSubmit}>
                                            <div className="row g-3">
                                                <div className="col-12">
                                                    <label className="form-label">
                                                        Buscar inmobiliaria
                                                    </label>

                                                    <input
                                                        type="search"
                                                        className="form-control"
                                                        placeholder="Nombre, razón social, CUIT o slug..."
                                                        value={search}
                                                        onChange={(e) => setSearch(e.target.value)}
                                                    />
                                                </div>

                                                <div className="col-12">
                                                    <label className="form-label">
                                                        Inmobiliaria
                                                    </label>

                                                    <select
                                                        className="form-select"
                                                        value={selectedInmobiliariaId}
                                                        onChange={(e) =>
                                                            setSelectedInmobiliariaId(e.target.value)
                                                        }
                                                        required
                                                    >
                                                        <option value="">
                                                            Seleccionar inmobiliaria
                                                        </option>

                                                        {filteredInmobiliarias.map((inmobiliaria) => (
                                                            <option
                                                                key={inmobiliaria.id}
                                                                value={inmobiliaria.id}
                                                            >
                                                                {inmobiliaria.nombre}
                                                                {inmobiliaria.razonSocial
                                                                    ? ` · ${inmobiliaria.razonSocial}`
                                                                    : ""}
                                                                {inmobiliaria.cuit
                                                                    ? ` · CUIT ${inmobiliaria.cuit}`
                                                                    : ""}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    {filteredInmobiliarias.length === 0 && (
                                                        <div className="form-text text-warning">
                                                            No encontramos inmobiliarias disponibles con ese
                                                            criterio. También podés dar de alta una nueva.
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="col-md-6">
                                                    <label className="form-label">
                                                        Rol solicitado
                                                    </label>

                                                    <select
                                                        className="form-select"
                                                        value={requestedRole}
                                                        onChange={(e) => setRequestedRole(e.target.value)}
                                                    >
                                                        <option value="admin">
                                                            Administrador
                                                        </option>
                                                        <option value="editor">
                                                            Editor
                                                        </option>
                                                        <option value="viewer">
                                                            Solo lectura
                                                        </option>
                                                    </select>

                                                    <div className="form-text">
                                                        La inmobiliaria podrá aprobar o rechazar este rol.
                                                    </div>
                                                </div>

                                                <div className="col-12">
                                                    <label className="form-label">
                                                        Mensaje para la inmobiliaria
                                                    </label>

                                                    <textarea
                                                        className="form-control"
                                                        rows={4}
                                                        value={mensaje}
                                                        placeholder="Ej: Soy parte del equipo comercial y necesito acceso para cargar inmuebles."
                                                        onChange={(e) => setMensaje(e.target.value)}
                                                    />
                                                </div>

                                                <div className="col-12 d-flex flex-wrap gap-2">
                                                    <button
                                                        type="submit"
                                                        className="btn btn-primary"
                                                        disabled={submitLoading || Boolean(success)}
                                                    >
                                                        {submitLoading
                                                            ? "Enviando..."
                                                            : "Enviar solicitud"}
                                                    </button>

                                                    <Link
                                                        to="/inmobiliarias/alta"
                                                        className="btn btn-outline-secondary"
                                                    >
                                                        Dar de alta nueva inmobiliaria
                                                    </Link>
                                                </div>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </section>
        </main>
    );
};

export default InmobiliariaLinkRequestPage;