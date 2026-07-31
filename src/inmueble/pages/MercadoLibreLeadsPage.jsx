import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/auth/useAuth";
import {
    answerMercadoLibreQuestion,
    getMercadoLibreConnectionStatus,
    getMercadoLibreLeads,
    syncMercadoLibreLeads,
    updateMercadoLibreLeadStatus,
} from "../services/mercadoLibre.service";

const MANAGEMENT_STATUSES = [
    { id: "nuevo", label: "Nuevo" },
    { id: "contactado", label: "Contactado" },
    { id: "cerrado", label: "Cerrado" },
];

const CONTACT_TYPE_LABELS = {
    whatsapp: "WhatsApp",
    call: "Llamada",
    question: "Pregunta",
    schedule: "Solicitud de visita",
    visit_request: "Solicitud de visita",
    quotation: "Cotización",
    quotations: "Cotización",
};

const formatDate = (value) => {
    if (!value) return "Fecha no informada";

    return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
};

const getContactTypeLabel = (lead) => {
    return (
        CONTACT_TYPE_LABELS[lead.contactType] ||
        CONTACT_TYPE_LABELS[lead.actions?.[0]] ||
        lead.contactType ||
        "Contacto"
    );
};

const buildWhatsAppUrl = (phone = "") => {
    const normalized = phone.replace(/\D/g, "");
    return normalized ? `https://wa.me/${normalized}` : "";
};

const MercadoLibreLeadsPage = () => {
    const { user, activeInmobiliariaId } = useAuth();
    const [connection, setConnection] = useState({ connected: false });
    const [leads, setLeads] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [answerDrafts, setAnswerDrafts] = useState({});
    const [statusFilter, setStatusFilter] = useState("");
    const [contactFilter, setContactFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [savingLeadId, setSavingLeadId] = useState("");
    const [savingAnswerId, setSavingAnswerId] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadLeads = async () => {
        if (!user?.uid || !activeInmobiliariaId) {
            setLeads([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const [connectionResult, leadsResult] = await Promise.all([
                getMercadoLibreConnectionStatus(activeInmobiliariaId),
                getMercadoLibreLeads({
                    inmobiliariaId: activeInmobiliariaId,
                    limit: 200,
                }),
            ]);
            const nextLeads = Array.isArray(leadsResult?.leads)
                ? leadsResult.leads
                : [];

            setConnection(connectionResult || { connected: false });
            setLeads(nextLeads);
            setDrafts(
                Object.fromEntries(
                    nextLeads.map((lead) => [
                        lead.leadId,
                        {
                            managementStatus:
                                lead.managementStatus || "nuevo",
                            managementNote: lead.managementNote || "",
                        },
                    ]),
                ),
            );
        } catch (loadError) {
            setError(loadError.message || "No se pudieron cargar los leads.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLeads();
        // La carga depende únicamente del usuario y la inmobiliaria activa.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid, activeInmobiliariaId]);

    const filteredLeads = useMemo(() => {
        return leads.filter((lead) => {
            if (
                statusFilter &&
                lead.managementStatus !== statusFilter
            ) {
                return false;
            }
            if (contactFilter && lead.contactType !== contactFilter) {
                return false;
            }
            return true;
        });
    }, [contactFilter, leads, statusFilter]);

    const contactTypes = useMemo(() => {
        return [...new Set(leads.map((lead) => lead.contactType).filter(Boolean))]
            .sort();
    }, [leads]);

    const newLeadCount = useMemo(() => {
        return leads.filter((lead) => lead.managementStatus === "nuevo").length;
    }, [leads]);

    const handleDraftChange = (leadId, field, value) => {
        setDrafts((current) => ({
            ...current,
            [leadId]: {
                managementStatus:
                    current[leadId]?.managementStatus || "nuevo",
                managementNote: current[leadId]?.managementNote || "",
                [field]: value,
            },
        }));
    };

    const handleSaveLead = async (lead) => {
        const draft = drafts[lead.leadId] || {
            managementStatus: "nuevo",
            managementNote: "",
        };

        setSavingLeadId(lead.leadId);
        setError("");
        setSuccess("");

        try {
            const result = await updateMercadoLibreLeadStatus({
                inmobiliariaId: activeInmobiliariaId,
                leadId: lead.leadId,
                managementStatus: draft.managementStatus,
                managementNote: draft.managementNote,
            });

            setLeads((current) =>
                current.map((item) =>
                    item.leadId === lead.leadId
                        ? {
                            ...item,
                            managementStatus: result.managementStatus,
                            managementNote: result.managementNote,
                        }
                        : item,
                ),
            );
            setSuccess("Seguimiento actualizado.");
        } catch (saveError) {
            setError(saveError.message || "No se pudo actualizar el lead.");
        } finally {
            setSavingLeadId("");
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setError("");
        setSuccess("");

        try {
            const result = await syncMercadoLibreLeads(
                activeInmobiliariaId,
            );
            setSuccess(
                `Sincronización completada: ${result.count || 0} leads procesados.`,
            );
            await loadLeads();
        } catch (syncError) {
            setError(
                syncError.message ||
                "No se pudieron sincronizar los leads con Mercado Libre.",
            );
        } finally {
            setSyncing(false);
        }
    };

    const handleAnswerQuestion = async (lead) => {
        const answerText = (answerDrafts[lead.leadId] || "").trim();
        if (!answerText) {
            setError("Escribí una respuesta antes de enviarla.");
            return;
        }

        setSavingAnswerId(lead.leadId);
        setError("");
        setSuccess("");

        try {
            const result = await answerMercadoLibreQuestion({
                inmobiliariaId: activeInmobiliariaId,
                leadId: lead.leadId,
                answerText,
            });

            setLeads((current) =>
                current.map((item) =>
                    item.leadId === lead.leadId
                        ? {
                            ...item,
                            questionStatus: result.questionStatus,
                            answerText: result.answerText,
                            answerStatus: result.answerStatus,
                            managementStatus: result.managementStatus,
                        }
                        : item,
                ),
            );
            setDrafts((current) => ({
                ...current,
                [lead.leadId]: {
                    managementStatus: "contactado",
                    managementNote:
                        current[lead.leadId]?.managementNote || "",
                },
            }));
            setAnswerDrafts((current) => ({
                ...current,
                [lead.leadId]: "",
            }));
            setSuccess("La pregunta fue respondida en Mercado Libre.");
        } catch (answerError) {
            setError(
                answerError.message ||
                "No se pudo responder la pregunta en Mercado Libre.",
            );
        } finally {
            setSavingAnswerId("");
        }
    };

    if (!activeInmobiliariaId) {
        return (
            <main className="container py-4">
                <div className="alert alert-warning mb-0">
                    Seleccioná una inmobiliaria para consultar sus leads.
                </div>
            </main>
        );
    }

    return (
        <main className="container py-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                <div>
                    <Link to="/admin/inmuebles" className="small">
                        ← Volver a inmuebles
                    </Link>
                    <h1 className="h3 mt-2 mb-1">Leads de Mercado Libre</h1>
                    <p className="text-muted mb-0">
                        Contactos recibidos en las publicaciones de la cuenta conectada.
                    </p>
                </div>

                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSync}
                    disabled={!connection.connected || syncing || loading}
                >
                    {syncing ? "Sincronizando..." : "Sincronizar últimos 30 días"}
                </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {!loading && !connection.connected && (
                <div className="alert alert-warning">
                    La inmobiliaria todavía no conectó su cuenta de Mercado Libre.{" "}
                    <Link to="/admin/inmuebles">
                        Abrí la difusión de un inmueble para conectarla.
                    </Link>
                </div>
            )}

            <section className="card border-0 shadow-sm mb-4">
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-12 col-md-4">
                            <label className="form-label" htmlFor="lead-status-filter">
                                Estado de seguimiento
                            </label>
                            <select
                                id="lead-status-filter"
                                className="form-select"
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value)
                                }
                            >
                                <option value="">Todos</option>
                                {MANAGEMENT_STATUSES.map((status) => (
                                    <option key={status.id} value={status.id}>
                                        {status.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-12 col-md-4">
                            <label className="form-label" htmlFor="lead-contact-filter">
                                Tipo de contacto
                            </label>
                            <select
                                id="lead-contact-filter"
                                className="form-select"
                                value={contactFilter}
                                onChange={(event) =>
                                    setContactFilter(event.target.value)
                                }
                            >
                                <option value="">Todos</option>
                                {contactTypes.map((contactType) => (
                                    <option key={contactType} value={contactType}>
                                        {CONTACT_TYPE_LABELS[contactType] || contactType}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-12 col-md-4">
                            <div className="small text-muted">Total</div>
                            <div className="fs-5">
                                {leads.length} leads · {newLeadCount} nuevos
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {loading ? (
                <div className="text-center py-5">Cargando leads...</div>
            ) : filteredLeads.length === 0 ? (
                <div className="card border-0 shadow-sm">
                    <div className="card-body text-center py-5">
                        <h2 className="h5">Todavía no hay leads para mostrar</h2>
                        <p className="text-muted mb-0">
                            Las nuevas interacciones llegarán mediante VIS Leads.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="d-grid gap-3">
                    {filteredLeads.map((lead) => {
                        const draft = drafts[lead.leadId] || {
                            managementStatus: lead.managementStatus || "nuevo",
                            managementNote: lead.managementNote || "",
                        };
                        const whatsappUrl = buildWhatsAppUrl(lead.phone);

                        return (
                            <article
                                key={lead.leadId}
                                className="card border-0 shadow-sm"
                            >
                                <div className="card-body">
                                    <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                                        <div>
                                            <div className="d-flex flex-wrap gap-2 align-items-center mb-1">
                                                <span className="badge text-bg-primary">
                                                    {getContactTypeLabel(lead)}
                                                </span>
                                                <span className="small text-muted">
                                                    {formatDate(lead.createdAtMs)}
                                                </span>
                                            </div>
                                            <h2 className="h5 mb-1">
                                                {lead.name || "Interesado sin nombre informado"}
                                            </h2>
                                            <div className="small text-muted">
                                                {lead.inmuebleTitle ||
                                                    (lead.itemId
                                                        ? `Publicación ${lead.itemId}`
                                                        : "Publicación no vinculada")}
                                            </div>
                                        </div>

                                        {lead.inmuebleId && (
                                            <Link
                                                className="btn btn-outline-primary btn-sm align-self-start"
                                                to={`/admin/inmuebles/${lead.inmuebleId}/difusion`}
                                            >
                                                Ver inmueble
                                            </Link>
                                        )}
                                    </div>

                                    <div className="d-flex flex-wrap gap-2 mb-3">
                                        {lead.phone && (
                                            <a
                                                className="btn btn-outline-secondary btn-sm"
                                                href={`tel:${lead.phone}`}
                                            >
                                                Llamar: {lead.phone}
                                            </a>
                                        )}
                                        {whatsappUrl && (
                                            <a
                                                className="btn btn-outline-success btn-sm"
                                                href={whatsappUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Abrir WhatsApp
                                            </a>
                                        )}
                                        {lead.email && (
                                            <a
                                                className="btn btn-outline-secondary btn-sm"
                                                href={`mailto:${lead.email}`}
                                            >
                                                {lead.email}
                                            </a>
                                        )}
                                    </div>

                                    {lead.questionText && (
                                        <div className="alert alert-light border">
                                            <strong>Pregunta:</strong>{" "}
                                            {lead.questionText}
                                            {lead.answerText && (
                                                <div className="mt-2">
                                                    <strong>Respuesta:</strong>{" "}
                                                    {lead.answerText}
                                                </div>
                                            )}

                                            {!lead.answerText && (
                                                <div className="mt-3">
                                                    <label
                                                        className="form-label"
                                                        htmlFor={`lead-answer-${lead.leadId}`}
                                                    >
                                                        Responder en Mercado Libre
                                                    </label>
                                                    <textarea
                                                        id={`lead-answer-${lead.leadId}`}
                                                        className="form-control"
                                                        rows="2"
                                                        maxLength="2000"
                                                        value={
                                                            answerDrafts[lead.leadId] ||
                                                            ""
                                                        }
                                                        onChange={(event) =>
                                                            setAnswerDrafts(
                                                                (current) => ({
                                                                    ...current,
                                                                    [lead.leadId]:
                                                                        event.target
                                                                            .value,
                                                                }),
                                                            )
                                                        }
                                                    />
                                                    <div className="d-flex justify-content-end mt-2">
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-primary btn-sm"
                                                            disabled={
                                                                savingAnswerId ===
                                                                lead.leadId
                                                            }
                                                            onClick={() =>
                                                                handleAnswerQuestion(
                                                                    lead,
                                                                )
                                                            }
                                                        >
                                                            {savingAnswerId ===
                                                            lead.leadId
                                                                ? "Enviando..."
                                                                : "Enviar respuesta"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="row g-3">
                                        <div className="col-12 col-md-4">
                                            <label
                                                className="form-label"
                                                htmlFor={`lead-status-${lead.leadId}`}
                                            >
                                                Seguimiento
                                            </label>
                                            <select
                                                id={`lead-status-${lead.leadId}`}
                                                className="form-select"
                                                value={draft.managementStatus}
                                                onChange={(event) =>
                                                    handleDraftChange(
                                                        lead.leadId,
                                                        "managementStatus",
                                                        event.target.value,
                                                    )
                                                }
                                            >
                                                {MANAGEMENT_STATUSES.map((status) => (
                                                    <option
                                                        key={status.id}
                                                        value={status.id}
                                                    >
                                                        {status.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="col-12 col-md-8">
                                            <label
                                                className="form-label"
                                                htmlFor={`lead-note-${lead.leadId}`}
                                            >
                                                Nota interna
                                            </label>
                                            <textarea
                                                id={`lead-note-${lead.leadId}`}
                                                className="form-control"
                                                rows="2"
                                                maxLength="2000"
                                                value={draft.managementNote}
                                                onChange={(event) =>
                                                    handleDraftChange(
                                                        lead.leadId,
                                                        "managementNote",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Ej: Se llamó y solicitó una visita para el viernes."
                                            />
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-end mt-3">
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            disabled={savingLeadId === lead.leadId}
                                            onClick={() => handleSaveLead(lead)}
                                        >
                                            {savingLeadId === lead.leadId
                                                ? "Guardando..."
                                                : "Guardar seguimiento"}
                                        </button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </main>
    );
};

export default MercadoLibreLeadsPage;
