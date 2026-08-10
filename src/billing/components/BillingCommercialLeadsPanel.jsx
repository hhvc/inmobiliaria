import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
    buildCommercialWhatsappUrl,
    COMMERCIAL_LEAD_STATUS_OPTIONS,
    getCommercialInterestSummary,
    getCommercialLeadStatus,
} from "../utils/commercial.helpers";
import { formatBillingDate } from "../utils/billing.helpers";

const buildAgencyCreateUrl = (lead) => {
    const params = new URLSearchParams({
        commercialLeadId: lead.id,
        nombre: lead.agencyName || "",
        email: lead.email || "",
        telefono: lead.phone || "",
        city: lead.city || "",
        catalogItemId: lead.primaryCatalogItemId || lead.interestIds?.[0] || "",
    });
    return `/admin/inmobiliarias/nueva?${params.toString()}`;
};

const buildInitialDraft = (lead = {}) => ({
    status: lead.status || "new",
    nextActionDateKey: lead.nextActionDateKey || "",
    linkedInmobiliariaId: lead.linkedInmobiliariaId || "",
    note: lead.lastNote || "",
});

const BillingCommercialLeadsPanel = ({
    leads = [],
    agencies = [],
    operation = "",
    onUpdate,
}) => {
    const [statusFilter, setStatusFilter] = useState("open");
    const [drafts, setDrafts] = useState({});

    useEffect(() => {
        setDrafts((current) => Object.fromEntries(leads.map((lead) => [
            lead.id,
            current[lead.id] || buildInitialDraft(lead),
        ])));
    }, [leads]);

    const visibleLeads = useMemo(() => leads.filter((lead) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "open") return !["won", "lost"].includes(lead.status);
        return lead.status === statusFilter;
    }), [leads, statusFilter]);

    const openCount = leads.filter((lead) => !["won", "lost"].includes(lead.status)).length;

    const updateDraft = (leadId, field, value) => {
        setDrafts((current) => ({
            ...current,
            [leadId]: { ...current[leadId], [field]: value },
        }));
    };

    return (
        <section className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                    <div>
                        <p className="text-uppercase text-muted small mb-1">Embudo comercial</p>
                        <h2 className="h4 mb-1">Oportunidades recibidas desde /planes</h2>
                        <p className="text-muted mb-0">
                            Contactá, programá el seguimiento y vinculá cada oportunidad con una inmobiliaria.
                        </p>
                    </div>
                    <div className="d-flex gap-2 align-items-center">
                        <span className="badge text-bg-primary fs-6">{openCount} abiertas</span>
                        <select
                            className="form-select form-select-sm"
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            aria-label="Filtrar oportunidades"
                        >
                            <option value="open">Abiertas</option>
                            <option value="all">Todas</option>
                            {COMMERCIAL_LEAD_STATUS_OPTIONS.map((status) => (
                                <option value={status.id} key={status.id}>{status.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="d-grid gap-3">
                    {visibleLeads.map((lead) => {
                        const draft = drafts[lead.id] || buildInitialDraft(lead);
                        const status = getCommercialLeadStatus(lead.status);
                        const whatsappUrl = buildCommercialWhatsappUrl(
                            lead.phone,
                            `Hola ${lead.contactName || ""}, te contacto desde ONO Prop por tu consulta sobre ${getCommercialInterestSummary(lead)}.`,
                        );
                        const catalogItemId = lead.primaryCatalogItemId || lead.interestIds?.[0] || "";
                        const accountParams = new URLSearchParams({
                            inmobiliariaId: lead.linkedInmobiliariaId || "",
                            ...(catalogItemId ? { contratar: catalogItemId } : {}),
                        });

                        return (
                            <article className="border rounded-3 p-3 p-lg-4" key={lead.id}>
                                <div className="row g-3">
                                    <div className="col-lg-4">
                                        <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                                            <h3 className="h5 mb-0">{lead.agencyName}</h3>
                                            <span className={`badge ${status.badge}`}>{status.label}</span>
                                        </div>
                                        <div className="small text-muted mb-2">
                                            Recibida {formatBillingDate(lead.createdAt, { withTime: true })}
                                        </div>
                                        <div><strong>{lead.contactName}</strong></div>
                                        {lead.email && <div><a href={`mailto:${lead.email}`}>{lead.email}</a></div>}
                                        {lead.phone && <div>{lead.phone}</div>}
                                        <div className="small text-muted mt-2">
                                            {lead.city || "Ciudad no informada"} · {lead.propertyVolume || "Sin volumen"}
                                        </div>
                                        <div className="small mt-3">
                                            <strong>Interés:</strong> {getCommercialInterestSummary(lead)}
                                        </div>
                                        {lead.promotionCode && (
                                            <div className="small"><strong>Promoción:</strong> {lead.promotionCode}</div>
                                        )}
                                        {lead.message && <p className="small bg-light rounded p-2 mt-2 mb-0">{lead.message}</p>}
                                    </div>

                                    <div className="col-lg-8">
                                        <div className="row g-2">
                                            <div className="col-md-4">
                                                <label className="form-label small">Estado</label>
                                                <select className="form-select" value={draft.status} onChange={(event) => updateDraft(lead.id, "status", event.target.value)}>
                                                    {COMMERCIAL_LEAD_STATUS_OPTIONS.map((option) => (
                                                        <option value={option.id} key={option.id}>{option.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small">Próxima acción</label>
                                                <input className="form-control" type="date" value={draft.nextActionDateKey} onChange={(event) => updateDraft(lead.id, "nextActionDateKey", event.target.value)} />
                                            </div>
                                            <div className="col-md-4">
                                                <label className="form-label small">Inmobiliaria vinculada</label>
                                                <select className="form-select" value={draft.linkedInmobiliariaId} onChange={(event) => updateDraft(lead.id, "linkedInmobiliariaId", event.target.value)}>
                                                    <option value="">Sin vincular</option>
                                                    {agencies.map((agency) => (
                                                        <option value={agency.id} key={agency.id}>{agency.nombre}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-12">
                                                <label className="form-label small">Nota de seguimiento</label>
                                                <textarea className="form-control" rows="2" value={draft.note} onChange={(event) => updateDraft(lead.id, "note", event.target.value)} />
                                            </div>
                                        </div>
                                        <div className="d-flex flex-wrap gap-2 justify-content-end mt-3">
                                            {lead.email && <a className="btn btn-sm btn-outline-secondary" href={`mailto:${lead.email}`}>Enviar email</a>}
                                            {whatsappUrl && <a className="btn btn-sm btn-outline-success" href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>}
                                            {!lead.linkedInmobiliariaId && (
                                                <Link className="btn btn-sm btn-outline-primary" to={buildAgencyCreateUrl(lead)}>
                                                    Crear inmobiliaria
                                                </Link>
                                            )}
                                            {lead.linkedInmobiliariaId && (
                                                <Link className="btn btn-sm btn-outline-primary" to={`/admin/inmobiliaria/cuenta-corriente?${accountParams.toString()}`}>
                                                    Abrir cuenta y contratar
                                                </Link>
                                            )}
                                            <button
                                                className="btn btn-sm btn-primary"
                                                type="button"
                                                disabled={Boolean(operation)}
                                                onClick={() => onUpdate({ leadId: lead.id, ...draft })}
                                            >
                                                {operation === `lead-${lead.id}` ? "Guardando..." : "Guardar seguimiento"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                    {!visibleLeads.length && (
                        <div className="text-center text-muted border rounded py-5">
                            No hay oportunidades para este filtro.
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default BillingCommercialLeadsPanel;
