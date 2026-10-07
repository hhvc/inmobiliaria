import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
    buildCommercialFunnelMetrics,
    buildCommercialWhatsappUrl,
    calculateCommercialUnitEconomics,
    commercialMoneyInputToMinor,
    COMMERCIAL_PILOT_CHECKLIST,
    COMMERCIAL_LEAD_STATUS_OPTIONS,
    getCommercialChecklistProgress,
    getCommercialOfferSummary,
    getCommercialInterestSummary,
    getCommercialQualification,
    getCommercialQualificationSummary,
    getCommercialLeadStatus,
    isConsortiumPilotLead,
} from "../utils/commercial.helpers";
import { formatBillingDate, formatMoneyMinor } from "../utils/billing.helpers";

const buildAgencyCreateUrl = (lead) => {
    const isPilot = isConsortiumPilotLead(lead);
    const params = new URLSearchParams({
        commercialLeadId: lead.id,
        commercialRequestType: isPilot ? "pilot" : "",
        nombre: lead.agencyName || "",
        email: lead.email || "",
        telefono: lead.phone || "",
        city: lead.city || "",
        catalogItemId: isPilot ? "" : lead.primaryCatalogItemId ||
            lead.commercialOffer?.catalogItemId || lead.interestIds?.[0] || "",
    });
    return `/admin/inmobiliarias/nueva?${params.toString()}`;
};

const buildInitialDraft = (lead = {}) => ({
    status: lead.status || "new",
    nextActionDateKey: lead.nextActionDateKey || "",
    linkedInmobiliariaId: lead.linkedInmobiliariaId || "",
    note: lead.lastNote || "",
    economics: {
        monthlyRevenue: Number(
            lead.commercialEconomics?.monthlyRevenueMinor ||
            lead.commercialOffer?.estimatedMonthlyAmountMinor || 0,
        ) / 100 || "",
        monthlyCost: Number(lead.commercialEconomics?.monthlyCostMinor || 0) / 100 || "",
        onboardingCost: Number(lead.commercialEconomics?.onboardingCostMinor || 0) / 100 || "",
        setupFee: Number(lead.commercialEconomics?.setupFeeMinor || 0) / 100 || "",
        acquisitionCost: Number(lead.commercialEconomics?.acquisitionCostMinor || 0) / 100 || "",
        onboardingHours: lead.commercialEconomics?.onboardingHours || "",
    },
    onboardingChecklist: Object.fromEntries(COMMERCIAL_PILOT_CHECKLIST.map((item) => [
        item.id,
        lead.onboardingChecklist?.[item.id] === true,
    ])),
});

const buildLeadUpdatePayload = (leadId, draft) => ({
    leadId,
    status: draft.status,
    nextActionDateKey: draft.nextActionDateKey,
    linkedInmobiliariaId: draft.linkedInmobiliariaId,
    note: draft.note,
    commercialEconomics: {
        monthlyRevenueMinor: commercialMoneyInputToMinor(draft.economics.monthlyRevenue),
        monthlyCostMinor: commercialMoneyInputToMinor(draft.economics.monthlyCost),
        onboardingCostMinor: commercialMoneyInputToMinor(draft.economics.onboardingCost),
        setupFeeMinor: commercialMoneyInputToMinor(draft.economics.setupFee),
        acquisitionCostMinor: commercialMoneyInputToMinor(draft.economics.acquisitionCost),
        onboardingHours: Math.max(0, Number(draft.economics.onboardingHours) || 0),
    },
    onboardingChecklist: draft.onboardingChecklist,
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
    const funnel = useMemo(() => buildCommercialFunnelMetrics(leads), [leads]);

    const updateDraft = (leadId, field, value) => {
        setDrafts((current) => ({
            ...current,
            [leadId]: { ...current[leadId], [field]: value },
        }));
    };

    const updateNestedDraft = (leadId, group, field, value) => {
        setDrafts((current) => ({
            ...current,
            [leadId]: {
                ...current[leadId],
                [group]: {
                    ...current[leadId]?.[group],
                    [field]: value,
                },
            },
        }));
    };

    return (
        <section className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                    <div>
                        <p className="text-uppercase text-muted small mb-1">Embudo comercial</p>
                        <h2 className="h4 mb-1">Oportunidades recibidas desde las páginas comerciales</h2>
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

                <div className="row g-2 mb-4">
                    <div className="col-6 col-lg-3">
                        <div className="border rounded-3 p-3 h-100">
                            <div className="small text-muted">Conversión a demo</div>
                            <div className="h4 mb-0">{funnel.leadToDemoPercent}%</div>
                            <div className="small">{funnel.demos} de {funnel.total}</div>
                        </div>
                    </div>
                    <div className="col-6 col-lg-3">
                        <div className="border rounded-3 p-3 h-100">
                            <div className="small text-muted">Conversión a piloto</div>
                            <div className="h4 mb-0">{funnel.leadToPilotPercent}%</div>
                            <div className="small">{funnel.pilots} pilotos</div>
                        </div>
                    </div>
                    <div className="col-6 col-lg-3">
                        <div className="border rounded-3 p-3 h-100">
                            <div className="small text-muted">MRR potencial abierto</div>
                            <div className="h4 mb-0">
                                {formatMoneyMinor(funnel.estimatedOpenMrrMinor, "ARS")}
                            </div>
                            <div className="small">{funnel.highPriority} de alta prioridad</div>
                        </div>
                    </div>
                    <div className="col-6 col-lg-3">
                        <div className="border rounded-3 p-3 h-100">
                            <div className="small text-muted">MRR ganado</div>
                            <div className="h4 mb-0">
                                {formatMoneyMinor(funnel.wonMrrMinor, "ARS")}
                            </div>
                            <div className="small">{funnel.leadToWonPercent}% de cierre</div>
                        </div>
                    </div>
                </div>

                <details className="border rounded-3 p-3 mb-4">
                    <summary className="fw-semibold">Guion sugerido para una demostración de 15 minutos</summary>
                    <div className="row g-3 pt-3 small">
                        <div className="col-md-6 col-xl-3">
                            <strong>1. Diagnóstico · 3 min</strong>
                            <p className="text-muted mb-0">
                                Confirmar cantidad de consorcios y unidades, herramienta actual y
                                principal tarea que consume tiempo.
                            </p>
                        </div>
                        <div className="col-md-6 col-xl-3">
                            <strong>2. Circuito mensual · 6 min</strong>
                            <p className="text-muted mb-0">
                                Mostrar gasto, liquidación, cuenta corriente, pago y recibo como un
                                único recorrido, no como funciones aisladas.
                            </p>
                        </div>
                        <div className="col-md-6 col-xl-3">
                            <strong>3. Experiencia del consorcista · 3 min</strong>
                            <p className="text-muted mb-0">
                                Ingresar al portal, informar un pago y enviar un mensaje a la
                                administración.
                            </p>
                        </div>
                        <div className="col-md-6 col-xl-3">
                            <strong>4. Cierre · 3 min</strong>
                            <p className="text-muted mb-0">
                                Elegir el consorcio piloto, acordar responsable y fecha del primer
                                cierre mensual.
                            </p>
                        </div>
                    </div>
                </details>

                <div className="d-grid gap-3">
                    {visibleLeads.map((lead) => {
                        const draft = drafts[lead.id] || buildInitialDraft(lead);
                        const status = getCommercialLeadStatus(lead.status);
                        const offerSummary = getCommercialOfferSummary(lead);
                        const isPilot = isConsortiumPilotLead(lead);
                        const qualification = getCommercialQualification(lead);
                        const qualificationSummary = getCommercialQualificationSummary(lead);
                        const economics = calculateCommercialUnitEconomics({
                            monthlyRevenueMinor: commercialMoneyInputToMinor(
                                draft.economics.monthlyRevenue,
                            ),
                            monthlyCostMinor: commercialMoneyInputToMinor(
                                draft.economics.monthlyCost,
                            ),
                            onboardingCostMinor: commercialMoneyInputToMinor(
                                draft.economics.onboardingCost,
                            ),
                            setupFeeMinor: commercialMoneyInputToMinor(
                                draft.economics.setupFee,
                            ),
                            acquisitionCostMinor: commercialMoneyInputToMinor(
                                draft.economics.acquisitionCost,
                            ),
                        });
                        const checklistProgress = getCommercialChecklistProgress(
                            draft.onboardingChecklist,
                        );
                        const whatsappUrl = buildCommercialWhatsappUrl(
                            lead.phone,
                            isPilot
                                ? `Hola ${lead.contactName || ""}, te contacto desde ONO Prop por tu solicitud del piloto de Administración de Consorcios.`
                                : `Hola ${lead.contactName || ""}, te contacto desde ONO Prop por tu consulta sobre ${getCommercialInterestSummary(lead)}.`,
                        );
                        const catalogItemId = lead.primaryCatalogItemId ||
                            lead.commercialOffer?.catalogItemId || lead.interestIds?.[0] || "";
                        const accountParams = new URLSearchParams({
                            inmobiliariaId: lead.linkedInmobiliariaId || "",
                            ...(!isPilot && catalogItemId ? { contratar: catalogItemId } : {}),
                        });

                        return (
                            <article className="border rounded-3 p-3 p-lg-4" key={lead.id}>
                                <div className="row g-3">
                                    <div className="col-lg-4">
                                        <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                                            <h3 className="h5 mb-0">{lead.agencyName}</h3>
                                            <span className={`badge ${status.badge}`}>{status.label}</span>
                                            {offerSummary && (
                                                <span className={`badge ${isPilot ? "text-bg-success" : "text-bg-light border text-dark"}`}>
                                                    {isPilot ? "Piloto Consorcios" : "Demo Consorcios"}
                                                </span>
                                            )}
                                            {lead.qualification && (
                                                <span className={`badge ${qualification.badge}`}>
                                                    {qualification.label} · {qualification.score}/100
                                                </span>
                                            )}
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
                                        {lead.source?.utmSource && (
                                            <div className="small text-muted mt-1">
                                                <strong>Origen:</strong> {lead.source.utmSource}
                                                {lead.source.utmMedium && ` · ${lead.source.utmMedium}`}
                                                {lead.source.utmCampaign && ` · ${lead.source.utmCampaign}`}
                                            </div>
                                        )}
                                        {lead.promotionCode && (
                                            <div className="small"><strong>Promoción:</strong> {lead.promotionCode}</div>
                                        )}
                                        {lead.message && <p className="small bg-light rounded p-2 mt-2 mb-0">{lead.message}</p>}
                                        {qualificationSummary && (
                                            <div className="small mt-2">
                                                <strong>Diagnóstico:</strong> {qualificationSummary}
                                            </div>
                                        )}
                                        {lead.commercialOffer && (
                                            <div className="small border border-success-subtle bg-success-subtle rounded p-2 mt-2">
                                                <strong>{offerSummary}</strong>
                                                <div>
                                                    Referencia mensual: {formatMoneyMinor(
                                                        lead.commercialOffer.estimatedMonthlyAmountMinor,
                                                        lead.commercialOffer.currency || "ARS",
                                                    )}
                                                    {lead.commercialOffer.minimumApplied && " · mínimo aplicado"}
                                                </div>
                                                <div>
                                                    {formatMoneyMinor(
                                                        lead.commercialOffer.unitPriceMinor,
                                                        lead.commercialOffer.currency || "ARS",
                                                    )} por unidad · {lead.commercialOffer.durationDays || 30} días
                                                </div>
                                                <div className="text-muted">
                                                    Sujeto a propuesta y disponibilidad. No genera cargos automáticos.
                                                </div>
                                            </div>
                                        )}
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
                                        <details className="border rounded-3 p-3 mt-3">
                                            <summary className="fw-semibold">
                                                Rentabilidad estimada
                                                {economics.monthlyRevenueMinor > 0 && (
                                                    <span className={`badge ms-2 ${
                                                        economics.grossMarginPercent >= 70
                                                            ? "text-bg-success"
                                                            : economics.grossMarginPercent >= 40
                                                                ? "text-bg-warning"
                                                                : "text-bg-danger"
                                                    }`}>
                                                        Margen {economics.grossMarginPercent}%
                                                    </span>
                                                )}
                                            </summary>
                                            <div className="row g-2 pt-3">
                                                <div className="col-sm-6 col-xl-4">
                                                    <label className="form-label small">Ingreso mensual esperado</label>
                                                    <div className="input-group input-group-sm">
                                                        <span className="input-group-text">$</span>
                                                        <input
                                                            className="form-control"
                                                            min="0"
                                                            onChange={(event) => updateNestedDraft(lead.id, "economics", "monthlyRevenue", event.target.value)}
                                                            step="0.01"
                                                            type="number"
                                                            value={draft.economics.monthlyRevenue}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="col-sm-6 col-xl-4">
                                                    <label className="form-label small">Costo mensual estimado</label>
                                                    <div className="input-group input-group-sm">
                                                        <span className="input-group-text">$</span>
                                                        <input
                                                            className="form-control"
                                                            min="0"
                                                            onChange={(event) => updateNestedDraft(lead.id, "economics", "monthlyCost", event.target.value)}
                                                            step="0.01"
                                                            type="number"
                                                            value={draft.economics.monthlyCost}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="col-sm-6 col-xl-4">
                                                    <label className="form-label small">Horas de puesta en marcha</label>
                                                    <input
                                                        className="form-control form-control-sm"
                                                        min="0"
                                                        onChange={(event) => updateNestedDraft(lead.id, "economics", "onboardingHours", event.target.value)}
                                                        step="0.5"
                                                        type="number"
                                                        value={draft.economics.onboardingHours}
                                                    />
                                                </div>
                                                <div className="col-sm-6 col-xl-4">
                                                    <label className="form-label small">Costo interno del alta</label>
                                                    <div className="input-group input-group-sm">
                                                        <span className="input-group-text">$</span>
                                                        <input
                                                            className="form-control"
                                                            min="0"
                                                            onChange={(event) => updateNestedDraft(lead.id, "economics", "onboardingCost", event.target.value)}
                                                            step="0.01"
                                                            type="number"
                                                            value={draft.economics.onboardingCost}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="col-sm-6 col-xl-4">
                                                    <label className="form-label small">Alta cobrada</label>
                                                    <div className="input-group input-group-sm">
                                                        <span className="input-group-text">$</span>
                                                        <input
                                                            className="form-control"
                                                            min="0"
                                                            onChange={(event) => updateNestedDraft(lead.id, "economics", "setupFee", event.target.value)}
                                                            step="0.01"
                                                            type="number"
                                                            value={draft.economics.setupFee}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="col-sm-6 col-xl-4">
                                                    <label className="form-label small">Costo de adquisición</label>
                                                    <div className="input-group input-group-sm">
                                                        <span className="input-group-text">$</span>
                                                        <input
                                                            className="form-control"
                                                            min="0"
                                                            onChange={(event) => updateNestedDraft(lead.id, "economics", "acquisitionCost", event.target.value)}
                                                            step="0.01"
                                                            type="number"
                                                            value={draft.economics.acquisitionCost}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="col-12 small text-muted">
                                                    Ganancia bruta mensual estimada: {formatMoneyMinor(
                                                        economics.monthlyGrossProfitMinor,
                                                        "ARS",
                                                    )}. Recuperación de alta y adquisición: {economics.paybackMonths === null
                                                        ? "sin calcular"
                                                        : `${economics.paybackMonths} meses`}.
                                                </div>
                                            </div>
                                        </details>
                                        {(isPilot || ["pilot", "won"].includes(draft.status)) && (
                                            <details className="border rounded-3 p-3 mt-3" open={draft.status === "pilot"}>
                                                <summary className="fw-semibold">
                                                    Puesta en marcha · {checklistProgress.completed}/{checklistProgress.total}
                                                    <span className="badge text-bg-light border text-dark ms-2">
                                                        {checklistProgress.percent}%
                                                    </span>
                                                </summary>
                                                <div className="row g-2 pt-3">
                                                    {COMMERCIAL_PILOT_CHECKLIST.map((item) => (
                                                        <div className="col-md-6" key={item.id}>
                                                            <div className="form-check">
                                                                <input
                                                                    checked={draft.onboardingChecklist[item.id] === true}
                                                                    className="form-check-input"
                                                                    id={`${lead.id}-${item.id}`}
                                                                    onChange={(event) => updateNestedDraft(
                                                                        lead.id,
                                                                        "onboardingChecklist",
                                                                        item.id,
                                                                        event.target.checked,
                                                                    )}
                                                                    type="checkbox"
                                                                />
                                                                <label className="form-check-label" htmlFor={`${lead.id}-${item.id}`}>
                                                                    {item.label}
                                                                </label>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        )}
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
                                                    {isPilot ? "Abrir cuenta y cotizar piloto" : "Abrir cuenta y contratar"}
                                                </Link>
                                            )}
                                            <button
                                                className="btn btn-sm btn-primary"
                                                type="button"
                                                disabled={Boolean(operation)}
                                                onClick={() => onUpdate(buildLeadUpdatePayload(lead.id, draft))}
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
