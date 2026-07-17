import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";

import {
    getInmobiliariasForVerificationReview,
    updateInmobiliariaVerificationReview,
} from "../services/inmobiliaria.service";
import { getInmobiliariaVerificationFileUrl } from "../helpers/getInmobiliariaVerificationFileUrl";

const DOCUMENT_LABELS = {
    constanciaArca: "Constancia ARCA",
    dniTitular: "DNI titular / representante",
    estatutoContratoSocial: "Estatuto o contrato social",
    dniApoderado: "Poder del apoderado",
    poderApoderado: "Poder del apoderado",
};

const STATUS_OPTIONS = [
    { id: "", label: "Todos los estados" },
    { id: "pendiente_revision", label: "Documentación en revisión" },
    { id: "observada", label: "Observadas" },
    { id: "pendiente_documentacion", label: "Pendientes de documentación" },
    { id: "rechazada", label: "Rechazadas" },
    { id: "verificada", label: "Verificadas" },
];

const STATUS_BADGE = {
    pendiente_documentacion: "text-bg-warning",
    pendiente_revision: "text-bg-info",
    observada: "text-bg-warning",
    rechazada: "text-bg-danger",
    verificada: "text-bg-success",
};

const getVerificationEstado = (inmobiliaria) => {
    return inmobiliaria?.verificacion?.estado || "pendiente_documentacion";
};

const getVerificationLabel = (inmobiliaria) => {
    return (
        inmobiliaria?.verificacion?.estadoLabel ||
        inmobiliaria?.verificacion?.estado ||
        "Pendiente de documentación"
    );
};

const hasDocument = (documentData) => {
    return Boolean(documentData?.path);
};

const formatDate = (value) => {
    if (!value) return "Sin fecha";

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return "Sin fecha";

    return date.toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
    });
};

const InmobiliariasVerificationReviewPage = () => {
    const [items, setItems] = useState([]);
    const [statusFilter, setStatusFilter] = useState("pendiente_revision");
    const [notesById, setNotesById] = useState({});
    const [loading, setLoading] = useState(true);
    const [reviewingId, setReviewingId] = useState("");
    const [openingFile, setOpeningFile] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const siteUrl =
        import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const filteredItems = useMemo(() => {
        if (!statusFilter) return items;

        return items.filter(
            (inmobiliaria) => getVerificationEstado(inmobiliaria) === statusFilter,
        );
    }, [items, statusFilter]);

    const counters = useMemo(() => {
        return items.reduce(
            (acc, inmobiliaria) => {
                const estado = getVerificationEstado(inmobiliaria);
                acc[estado] = (acc[estado] || 0) + 1;
                acc.total += 1;
                return acc;
            },
            { total: 0 },
        );
    }, [items]);

    const fetchItems = async () => {
        try {
            setLoading(true);
            setError("");

            const data = await getInmobiliariasForVerificationReview();
            setItems(data);
        } catch (err) {
            console.error("Error cargando inmobiliarias para verificación:", err);
            setError(err.message || "No se pudieron cargar las inmobiliarias");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const handleOpenDocument = async (documentData) => {
        try {
            setOpeningFile(documentData.path);
            setError("");

            const url = await getInmobiliariaVerificationFileUrl(documentData.path);
            window.open(url, "_blank", "noopener,noreferrer");
        } catch (err) {
            console.error("Error abriendo documento:", err);
            setError(err.message || "No se pudo abrir el documento");
        } finally {
            setOpeningFile("");
        }
    };

    const handleNoteChange = (inmobiliariaId, value) => {
        setNotesById((prev) => ({
            ...prev,
            [inmobiliariaId]: value,
        }));

        setSuccess("");
        setError("");
    };

    const handleReview = async (inmobiliaria, estado) => {
        try {
            const estadoTexto = {
                verificada: "verificar",
                observada: "observar",
                rechazada: "rechazar",
            }[estado];

            const confirmed = window.confirm(
                `¿Confirmás ${estadoTexto} la inmobiliaria "${inmobiliaria.nombre}"?`,
            );

            if (!confirmed) return;

            setReviewingId(inmobiliaria.id);
            setSuccess("");
            setError("");

            await updateInmobiliariaVerificationReview(inmobiliaria.id, {
                estado,
                observaciones: notesById[inmobiliaria.id] || "",
            });

            setSuccess("Estado de verificación actualizado correctamente.");
            await fetchItems();
        } catch (err) {
            console.error("Error actualizando verificación:", err);
            setError(err.message || "No se pudo actualizar la verificación");
        } finally {
            setReviewingId("");
        }
    };

    return (
        <main className="portal-home">
            <SEO
                title="Revisión de inmobiliarias | ONO Prop"
                description="Panel root para revisar documentación y verificar inmobiliarias en ONO Prop."
                url={`${siteUrl}/admin/inmobiliarias/verificacion`}
                type="website"
                siteName="ONO Prop"
                noIndex
            />

            <section className="portal-section">
                <div className="container">
                    <div className="mb-4">
                        <Link to="/admin/inmobiliarias" className="btn btn-outline-secondary">
                            ← Volver a inmobiliarias
                        </Link>
                    </div>

                    <div className="row align-items-end g-3 mb-4">
                        <div className="col-lg-8">
                            <p className="text-uppercase text-muted small mb-1">
                                Validación documental
                            </p>

                            <h1 className="portal-section-title mb-2">
                                Revisar inmobiliarias
                            </h1>

                            <p className="lead text-muted mb-0">
                                Revisá documentación legal y fiscal cargada por inmobiliarias.
                                Al verificar una inmobiliaria, desaparece el aviso público de
                                pendiente de validación.
                            </p>
                        </div>

                        <div className="col-lg-4">
                            <label className="form-label">Filtrar por estado</label>

                            <select
                                className="form-select"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                {STATUS_OPTIONS.map((option) => (
                                    <option key={option.id || "all"} value={option.id}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="row g-3 mb-4">
                        <div className="col-6 col-md-2">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body">
                                    <div className="h4 mb-0">{counters.total}</div>
                                    <div className="small text-muted">Total</div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-md-2">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body">
                                    <div className="h4 mb-0">
                                        {counters.pendiente_revision || 0}
                                    </div>
                                    <div className="small text-muted">En revisión</div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-md-2">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body">
                                    <div className="h4 mb-0">
                                        {counters.pendiente_documentacion || 0}
                                    </div>
                                    <div className="small text-muted">Pendientes</div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-md-2">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body">
                                    <div className="h4 mb-0">{counters.observada || 0}</div>
                                    <div className="small text-muted">Observadas</div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-md-2">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body">
                                    <div className="h4 mb-0">{counters.verificada || 0}</div>
                                    <div className="small text-muted">Verificadas</div>
                                </div>
                            </div>
                        </div>

                        <div className="col-6 col-md-2">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body">
                                    <div className="h4 mb-0">{counters.rechazada || 0}</div>
                                    <div className="small text-muted">Rechazadas</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && <div className="alert alert-danger">{error}</div>}

                    {success && <div className="alert alert-success">{success}</div>}

                    {loading && (
                        <div className="alert alert-light border">
                            Cargando inmobiliarias...
                        </div>
                    )}

                    {!loading && filteredItems.length === 0 && (
                        <div className="alert alert-info">
                            No hay inmobiliarias para mostrar con este filtro.
                        </div>
                    )}

                    {!loading && filteredItems.length > 0 && (
                        <div className="d-flex flex-column gap-4">
                            {filteredItems.map((inmobiliaria) => {
                                const estado = getVerificationEstado(inmobiliaria);
                                const documentacion =
                                    inmobiliaria.documentacionVerificacion || {};
                                const verificacion = inmobiliaria.verificacion || {};
                                const noteValue = notesById[inmobiliaria.id] || "";

                                return (
                                    <article
                                        className="card border-0 shadow-sm"
                                        key={inmobiliaria.id}
                                    >
                                        <div className="card-body p-4">
                                            <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
                                                <div>
                                                    <div className="d-flex flex-wrap gap-2 mb-2">
                                                        <span
                                                            className={`badge ${STATUS_BADGE[estado] || "text-bg-secondary"
                                                                }`}
                                                        >
                                                            {getVerificationLabel(inmobiliaria)}
                                                        </span>

                                                        {verificacion.tipoPersona && (
                                                            <span className="badge text-bg-light border">
                                                                {verificacion.tipoPersona}
                                                            </span>
                                                        )}

                                                        {verificacion.actuaPorPoder && (
                                                            <span className="badge text-bg-light border">
                                                                Apoderado
                                                            </span>
                                                        )}
                                                    </div>

                                                    <h2 className="h4 mb-1">{inmobiliaria.nombre}</h2>

                                                    <p className="text-muted mb-0">
                                                        {inmobiliaria.razonSocial || "Sin razón social"} ·
                                                        CUIT {inmobiliaria.cuit || "sin informar"}
                                                    </p>
                                                </div>

                                                <div className="text-lg-end small text-muted">
                                                    <div>ID: {inmobiliaria.id}</div>
                                                    <div>
                                                        Enviado: {formatDate(verificacion.submittedAt)}
                                                    </div>
                                                    <div>
                                                        Revisado: {formatDate(verificacion.reviewedAt)}
                                                    </div>
                                                </div>
                                            </div>

                                            {verificacion.observaciones && (
                                                <div className="alert alert-light border small">
                                                    <strong>Observaciones actuales:</strong>{" "}
                                                    {verificacion.observaciones}
                                                </div>
                                            )}

                                            {verificacion.reviewNote && (
                                                <div className="alert alert-light border small">
                                                    <strong>Nota de revisión:</strong>{" "}
                                                    {verificacion.reviewNote}
                                                </div>
                                            )}

                                            <div className="row g-3 mb-4">
                                                {Object.entries(DOCUMENT_LABELS).map(
                                                    ([documentKey, label]) => {
                                                        const documentData = documentacion[documentKey];

                                                        return (
                                                            <div className="col-md-6" key={documentKey}>
                                                                <div className="border rounded-3 p-3 h-100">
                                                                    <div className="fw-semibold mb-2">
                                                                        {label}
                                                                    </div>

                                                                    {hasDocument(documentData) ? (
                                                                        <>
                                                                            <div className="small text-muted mb-2">
                                                                                {documentData.filename || "Archivo"}{" "}
                                                                                {documentData.uploadedAt
                                                                                    ? `· ${formatDate(
                                                                                        documentData.uploadedAt,
                                                                                    )}`
                                                                                    : ""}
                                                                            </div>

                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-sm btn-outline-primary"
                                                                                onClick={() =>
                                                                                    handleOpenDocument(documentData)
                                                                                }
                                                                                disabled={
                                                                                    openingFile === documentData.path
                                                                                }
                                                                            >
                                                                                {openingFile === documentData.path
                                                                                    ? "Abriendo..."
                                                                                    : "Abrir documento"}
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <div className="text-muted small">
                                                                            No cargado
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    },
                                                )}
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label">
                                                    Nota para la inmobiliaria
                                                </label>

                                                <textarea
                                                    className="form-control"
                                                    rows={3}
                                                    value={noteValue}
                                                    placeholder="Ej: Falta poder del apoderado / documentación ilegible / verificación aprobada."
                                                    onChange={(e) =>
                                                        handleNoteChange(inmobiliaria.id, e.target.value)
                                                    }
                                                />
                                            </div>

                                            <div className="d-flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-success"
                                                    disabled={reviewingId === inmobiliaria.id}
                                                    onClick={() =>
                                                        handleReview(inmobiliaria, "verificada")
                                                    }
                                                >
                                                    Aprobar verificación
                                                </button>

                                                <button
                                                    type="button"
                                                    className="btn btn-warning"
                                                    disabled={reviewingId === inmobiliaria.id}
                                                    onClick={() =>
                                                        handleReview(inmobiliaria, "observada")
                                                    }
                                                >
                                                    Observar
                                                </button>

                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger"
                                                    disabled={reviewingId === inmobiliaria.id}
                                                    onClick={() =>
                                                        handleReview(inmobiliaria, "rechazada")
                                                    }
                                                >
                                                    Rechazar
                                                </button>

                                                <Link
                                                    to={`/inmobiliaria/${inmobiliaria.slug}`}
                                                    className="btn btn-outline-secondary"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    Ver página pública
                                                </Link>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
};

export default InmobiliariasVerificationReviewPage;