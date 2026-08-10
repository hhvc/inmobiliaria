import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import BillingCatalogEditor from "../components/BillingCatalogEditor";
import BillingCommercialLeadsPanel from "../components/BillingCommercialLeadsPanel";
import BillingContractApprovalForm from "../components/BillingContractApprovalForm";
import BillingPaymentProofLink from "../components/BillingPaymentProofLink";
import BillingPromotionEditor from "../components/BillingPromotionEditor";
import {
    activateBillingContract,
    approveBillingContract,
    getBillingAdminOverview,
    quoteBillingContract,
    rejectBillingContract,
    resolveBillingCancellation,
    resolveBillingPaymentReport,
    runBillingMaintenance,
    updateCommercialLead,
    upsertBillingInterestRate,
} from "../services/billing.service";
import {
    formatBillingPercent,
    formatBillingDate,
    formatMoneyMinor,
    getContractBadgeClass,
    getContractStatusLabel,
    getRecurrenceLabel,
    majorAmountToMinor,
    tnaMillionthsToPercent,
    tnaPercentToMillionths,
} from "../utils/billing.helpers";

const PENDING_CONTRACT_STATUSES = new Set([
    "requested",
    "quoted",
    "accepted",
    "pending_payment",
    "pending_setup",
    "cancel_requested",
    "suspended",
]);

const buildQuoteAmounts = (contract) => {
    const quoteAmounts = {};
    for (const component of contract.pricing || []) {
        if (!component.quoteRequired) continue;
        const amount = window.prompt(
            `Importe para “${component.label}” (${getRecurrenceLabel(component.recurrence)}):`,
            "",
        );
        if (amount === null) return null;
        const amountMinor = majorAmountToMinor(amount);
        if (amountMinor === null) {
            window.alert(`El importe de “${component.label}” no es válido.`);
            return null;
        }
        const currency = window.prompt(
            `Moneda ISO para “${component.label}”:`,
            component.currency || "ARS",
        );
        if (currency === null) return null;
        quoteAmounts[component.id] = {
            amountMinor,
            currency: currency.trim().toUpperCase(),
        };
    }
    return quoteAmounts;
};

const BillingAdminPage = () => {
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [operation, setOperation] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [approvalContract, setApprovalContract] = useState(null);
    const [rateForm, setRateForm] = useState({
        effectiveDateKey: new Date().toISOString().slice(0, 10),
        currency: "ARS",
        tnaPercent: "",
        note: "",
    });

    const loadOverview = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            setOverview(await getBillingAdminOverview());
        } catch (loadError) {
            console.error("Error cargando gestión comercial:", loadError);
            setError(loadError.message || "No se pudo cargar la gestión comercial.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    const runOperation = async (name, callback, message) => {
        try {
            setOperation(name);
            setError("");
            setSuccess("");
            await callback();
            setSuccess(message);
            await loadOverview();
            return true;
        } catch (operationError) {
            console.error(`Error en operación ${name}:`, operationError);
            setError(operationError.message || "No se pudo completar la operación.");
            return false;
        } finally {
            setOperation("");
        }
    };

    const pendingContracts = useMemo(() => (overview?.contracts || []).filter(
        (contract) => PENDING_CONTRACT_STATUSES.has(contract.status),
    ), [overview]);
    const pendingPayments = useMemo(() => (overview?.paymentReports || []).filter(
        (report) => report.status === "pending",
    ), [overview]);
    const openCommercialLeads = useMemo(() => (
        overview?.commercialLeads || []
    ).filter((lead) => !["won", "lost"].includes(lead.status)), [overview]);
    const accountsByAgency = useMemo(() => new Map(
        (overview?.accounts || []).map((account) => [account.id, account]),
    ), [overview]);
    const currentArsRate = useMemo(() => {
        const todayDateKey = new Date().toISOString().slice(0, 10);
        return (overview?.interestRates || []).find((rate) => (
            rate.currency === "ARS" && rate.effectiveDateKey <= todayDateKey
        )) || null;
    }, [overview]);

    const handleQuote = (contract) => {
        const quoteAmounts = buildQuoteAmounts(contract);
        if (!quoteAmounts) return;
        const quoteNote = window.prompt("Nota para la cotización (opcional):", "");
        if (quoteNote === null) return;
        runOperation(`quote-${contract.id}`, () => quoteBillingContract({
            contractId: contract.id,
            quoteAmounts,
            quoteNote,
        }), "Cotización enviada a la inmobiliaria.");
    };

    const handleApprove = (contract) => {
        setApprovalContract(contract);
        setError("");
        setSuccess("");
        window.setTimeout(() => {
            document.getElementById("contract-approval-form")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 0);
    };

    const handleApprovalSubmit = (payload) => {
        runOperation(
            `approve-${payload.contractId}`,
            () => approveBillingContract(payload),
            "Contratación aprobada y cargos generados.",
        ).then((done) => {
            if (done) setApprovalContract(null);
        });
    };

    const handleRateSubmit = (event) => {
        event.preventDefault();
        const tnaMillionths = tnaPercentToMillionths(rateForm.tnaPercent);
        if (tnaMillionths === null) {
            setError("Ingresá una TNA válida.");
            return;
        }
        runOperation("interest-rate", () => upsertBillingInterestRate({
            effectiveDateKey: rateForm.effectiveDateKey,
            currency: rateForm.currency,
            tnaMillionths,
            note: rateForm.note,
        }), "TNA general actualizada.");
    };

    const handleCommercialLeadUpdate = (payload) => runOperation(
        `lead-${payload.leadId}`,
        () => updateCommercialLead(payload),
        "Seguimiento comercial actualizado.",
    );

    const handleReject = (contract) => {
        const note = window.prompt("Motivo del rechazo:", "");
        if (note === null || !note.trim()) return;
        if (!window.confirm("¿Rechazar definitivamente esta solicitud?")) return;
        runOperation(`reject-${contract.id}`, () => rejectBillingContract({
            contractId: contract.id,
            note,
        }), "Solicitud rechazada.");
    };

    const handleActivate = (contract) => {
        const adminNote = window.prompt("Nota de activación (opcional):", "");
        if (adminNote === null) return;
        if (!window.confirm(
            "Se habilitarán los módulos y beneficios asociados. ¿Activar el servicio?",
        )) return;
        runOperation(`activate-${contract.id}`, () => activateBillingContract({
            contractId: contract.id,
            adminNote,
        }), "Servicio activado.");
    };

    const handleCancellation = (contract, approve) => {
        const note = window.prompt(
            approve ? "Nota de baja (opcional):" : "Motivo del rechazo de la baja:",
            "",
        );
        if (note === null) return;
        if (!window.confirm(
            approve
                ? "Se cancelará el contrato y sus beneficios recurrentes. ¿Continuar?"
                : "¿Rechazar la solicitud y restaurar el estado anterior?",
        )) return;
        runOperation(`cancel-${contract.id}`, () => resolveBillingCancellation({
            contractId: contract.id,
            approve,
            note,
        }), approve ? "Contrato cancelado." : "Solicitud de baja rechazada.");
    };

    const handlePayment = (report, approve) => {
        const note = window.prompt(
            approve ? "Nota de acreditación (opcional):" : "Motivo del rechazo:",
            "",
        );
        if (note === null) return;
        if (!window.confirm(
            approve
                ? "Se registrará un crédito inmutable en la cuenta corriente. ¿Confirmar?"
                : "¿Rechazar este pago informado?",
        )) return;
        runOperation(`payment-${report.id}`, () => resolveBillingPaymentReport({
            reportId: report.id,
            approve,
            note,
        }), approve ? "Pago acreditado." : "Pago rechazado.");
    };

    const renderContractActions = (contract) => {
        if (contract.status === "requested" && contract.requiresQuote) {
            return (
                <div className="d-flex flex-wrap gap-2">
                    <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => handleQuote(contract)}
                        disabled={Boolean(operation)}
                    >
                        Cotizar
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleReject(contract)}
                        disabled={Boolean(operation)}
                    >
                        Rechazar
                    </button>
                </div>
            );
        }
        if (
            (contract.status === "requested" && !contract.requiresQuote) ||
            contract.status === "accepted"
        ) {
            return (
                <div className="d-flex flex-wrap gap-2">
                    <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => handleApprove(contract)}
                        disabled={Boolean(operation)}
                    >
                        Aprobar y generar cargos
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleReject(contract)}
                        disabled={Boolean(operation)}
                    >
                        Rechazar
                    </button>
                </div>
            );
        }
        if (["pending_payment", "pending_setup", "suspended"].includes(contract.status)) {
            return (
                <button
                    type="button"
                    className="btn btn-sm btn-success"
                    onClick={() => handleActivate(contract)}
                    disabled={Boolean(operation)}
                >
                    Activar
                </button>
            );
        }
        if (contract.status === "cancel_requested") {
            return (
                <div className="d-flex flex-wrap gap-2">
                    <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleCancellation(contract, true)}
                        disabled={Boolean(operation)}
                    >
                        Aprobar baja
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => handleCancellation(contract, false)}
                        disabled={Boolean(operation)}
                    >
                        Rechazar baja
                    </button>
                </div>
            );
        }
        return <span className="small text-muted">Sin acción pendiente</span>;
    };

    if (loading && !overview) {
        return <main className="container py-5 text-center">Cargando gestión comercial...</main>;
    }

    return (
        <main className="container py-5">
            <SEO
                title="Gestión comercial | ONO Prop"
                description="Catálogo, contrataciones, pagos y cuentas corrientes."
                url={`${window.location.origin}/admin/facturacion`}
            />

            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                <div>
                    <p className="text-uppercase text-muted small mb-1">Administración ONO Prop</p>
                    <h1 className="display-6 mb-2">Gestión comercial</h1>
                    <p className="text-muted mb-0">
                        Catálogo, cotizaciones, contratos, pagos y saldos por inmobiliaria.
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={loadOverview}
                    disabled={loading || Boolean(operation)}
                >
                    Actualizar
                </button>
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => runOperation(
                        "maintenance",
                        runBillingMaintenance,
                        "Mantenimiento de cargos e intereses ejecutado.",
                    )}
                    disabled={loading || Boolean(operation)}
                >
                    Ejecutar mantenimiento
                </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <section className="row g-3 mb-4">
                <div className="col-md-6 col-xl-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="text-muted small">Contrataciones pendientes</div>
                            <div className="display-6">{pendingContracts.length}</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-xl-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="text-muted small">Pagos por revisar</div>
                            <div className="display-6">{pendingPayments.length}</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-xl-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="text-muted small">Inmobiliarias</div>
                            <div className="display-6">{overview?.agencies?.length || 0}</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-xl-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="text-muted small">Oportunidades abiertas</div>
                            <div className="display-6">{openCommercialLeads.length}</div>
                        </div>
                    </div>
                </div>
            </section>

            <BillingCommercialLeadsPanel
                leads={overview?.commercialLeads || []}
                agencies={overview?.agencies || []}
                operation={operation}
                onUpdate={handleCommercialLeadUpdate}
            />

            {approvalContract && (
                <BillingContractApprovalForm
                    key={approvalContract.id}
                    contract={approvalContract}
                    operation={operation}
                    onApprove={handleApprovalSubmit}
                    onCancel={() => setApprovalContract(null)}
                />
            )}

            <section className="card border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                    <div className="row g-4 align-items-start">
                        <div className="col-lg-5">
                            <p className="text-uppercase text-muted small mb-1">
                                Configuración general
                            </p>
                            <h2 className="h4 mb-2">TNA para intereses moratorios</h2>
                            <p className="text-muted small">
                                La tasa rige desde la fecha indicada. Si no se carga una nueva,
                                el sistema continúa usando la última vigente. La tasa diaria se
                                calcula sobre base 365.
                            </p>
                            <div className="border rounded p-3 mb-3">
                                <div className="small text-muted">Última TNA ARS cargada</div>
                                <div className="h3 mb-1">
                                    {currentArsRate
                                        ? `${formatBillingPercent(tnaMillionthsToPercent(currentArsRate.tnaMillionths))}%`
                                        : "Sin configurar"}
                                </div>
                                <div className="small text-muted">
                                    {currentArsRate
                                        ? `Vigente desde ${currentArsRate.effectiveDateKey}`
                                        : "Debe cargarse antes de aprobar contratos en ARS."}
                                </div>
                            </div>
                            <a
                                href="https://www.bcra.gob.ar/principales-variables-datos/?serie=8886"
                                target="_blank"
                                rel="noreferrer"
                                className="small"
                            >
                                Consultar TIM publicada por el BCRA
                            </a>
                            <div className="small text-muted mt-1">
                                La TIM es una serie acumulativa: no copies su valor directamente
                                como TNA. La conversión automática se incorporará después.
                            </div>
                        </div>
                        <div className="col-lg-7">
                            <form className="row g-3" onSubmit={handleRateSubmit}>
                                <div className="col-md-4">
                                    <label className="form-label">Fecha de vigencia</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={rateForm.effectiveDateKey}
                                        onChange={(event) => setRateForm((current) => ({
                                            ...current,
                                            effectiveDateKey: event.target.value,
                                        }))}
                                        required
                                    />
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label">Moneda</label>
                                    <input
                                        className="form-control text-uppercase"
                                        maxLength="3"
                                        value={rateForm.currency}
                                        onChange={(event) => setRateForm((current) => ({
                                            ...current,
                                            currency: event.target.value.toUpperCase(),
                                        }))}
                                        required
                                    />
                                </div>
                                <div className="col-md-3">
                                    <label className="form-label">TNA (%)</label>
                                    <input
                                        className="form-control"
                                        inputMode="decimal"
                                        placeholder="Ej.: 65,50"
                                        value={rateForm.tnaPercent}
                                        onChange={(event) => setRateForm((current) => ({
                                            ...current,
                                            tnaPercent: event.target.value,
                                        }))}
                                        required
                                    />
                                </div>
                                <div className="col-md-3 d-flex align-items-end">
                                    <button
                                        type="submit"
                                        className="btn btn-primary w-100"
                                        disabled={Boolean(operation)}
                                    >
                                        Guardar TNA
                                    </button>
                                </div>
                                <div className="col-12">
                                    <label className="form-label">Nota o fuente</label>
                                    <input
                                        className="form-control"
                                        value={rateForm.note}
                                        onChange={(event) => setRateForm((current) => ({
                                            ...current,
                                            note: event.target.value,
                                        }))}
                                    />
                                </div>
                            </form>

                            <div className="table-responsive mt-4">
                                <table className="table table-sm align-middle mb-0">
                                    <thead>
                                        <tr><th>Vigencia</th><th>Moneda</th><th>TNA</th><th>Fuente</th></tr>
                                    </thead>
                                    <tbody>
                                        {(overview?.interestRates || []).slice(0, 12).map((rate) => (
                                            <tr key={rate.id}>
                                                <td>{rate.effectiveDateKey}</td>
                                                <td>{rate.currency}</td>
                                                <td>
                                                    {formatBillingPercent(
                                                        tnaMillionthsToPercent(rate.tnaMillionths),
                                                    )}%
                                                </td>
                                                <td>{rate.note || rate.source || "Manual"}</td>
                                            </tr>
                                        ))}
                                        {!overview?.interestRates?.length && (
                                            <tr>
                                                <td colSpan="4" className="text-muted text-center py-3">
                                                    No hay tasas cargadas.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="card border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                    <h2 className="h4 mb-3">Contrataciones que requieren atención</h2>
                    <div className="table-responsive">
                        <table className="table align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Inmobiliaria</th>
                                    <th>Producto o servicio</th>
                                    <th>Estado</th>
                                    <th>Actualización</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingContracts.map((contract) => (
                                    <tr key={contract.id}>
                                        <td>
                                            <Link to={`/admin/inmobiliaria/cuenta-corriente?inmobiliariaId=${contract.inmobiliariaId}`}>
                                                {contract.inmobiliariaNombre}
                                            </Link>
                                        </td>
                                        <td>
                                            <strong>{contract.catalogName}</strong>
                                            {Number(contract.quantity || 1) > 1 && (
                                                <div className="small text-muted">
                                                    {contract.quantity} {contract.unitLabel}
                                                </div>
                                            )}
                                            {contract.serviceStartDateKey && (
                                                <div className="small text-muted">
                                                    {contract.serviceStartDateKey}
                                                    {contract.serviceEndDateKey
                                                        ? ` al ${contract.serviceEndDateKey}`
                                                        : " · indefinido"}
                                                    {` · vence a ${contract.paymentTermDays || 15} días`}
                                                </div>
                                            )}
                                            {contract.promotion?.code && (
                                                <div className="small text-success">
                                                    Código: <strong>{contract.promotion.code}</strong>
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className={getContractBadgeClass(contract.status)}>
                                                {getContractStatusLabel(contract.status)}
                                            </span>
                                        </td>
                                        <td>{formatBillingDate(contract.updatedAt, { withTime: true })}</td>
                                        <td>{renderContractActions(contract)}</td>
                                    </tr>
                                ))}
                                {!pendingContracts.length && (
                                    <tr>
                                        <td colSpan="5" className="text-center text-muted py-4">
                                            No hay contrataciones pendientes.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="card border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                    <h2 className="h4 mb-3">Pagos informados pendientes</h2>
                    <div className="table-responsive">
                        <table className="table align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Inmobiliaria</th>
                                    <th>Fecha de pago</th>
                                    <th>Importe</th>
                                    <th>Referencia</th>
                                    <th>Comprobante</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingPayments.map((report) => (
                                    <tr key={report.id}>
                                        <td>{report.inmobiliariaNombre}</td>
                                        <td>{report.paidDateKey || formatBillingDate(report.paidAt)}</td>
                                        <td>{formatMoneyMinor(report.amountMinor, report.currency)}</td>
                                        <td>{report.reference || "-"}</td>
                                        <td>
                                            <BillingPaymentProofLink
                                                proofPath={report.proofPath}
                                                legacyProofUrl={report.proofUrl}
                                            />
                                        </td>
                                        <td>
                                            <div className="d-flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-success"
                                                    onClick={() => handlePayment(report, true)}
                                                    disabled={Boolean(operation)}
                                                >
                                                    Acreditar
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => handlePayment(report, false)}
                                                    disabled={Boolean(operation)}
                                                >
                                                    Rechazar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!pendingPayments.length && (
                                    <tr>
                                        <td colSpan="6" className="text-center text-muted py-4">
                                            No hay pagos pendientes de revisión.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="card border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                    <h2 className="h4 mb-3">Cuentas por inmobiliaria</h2>
                    <div className="row g-3">
                        {(overview?.agencies || []).map((agency) => {
                            const account = accountsByAgency.get(agency.id);
                            const balances = Object.entries(account?.balanceByCurrency || {});
                            return (
                                <article className="col-md-6 col-xl-4" key={agency.id}>
                                    <div className="border rounded p-3 h-100 d-flex flex-column">
                                        <h3 className="h6">{agency.nombre}</h3>
                                        <div className="small text-muted mb-2">
                                            {agency.cuit ? `CUIT ${agency.cuit}` : "CUIT no informado"}
                                        </div>
                                        <div className="mb-3">
                                            {balances.map(([currency, amount]) => (
                                                <div key={currency}>
                                                    {formatMoneyMinor(amount, currency)}
                                                    <span className="small text-muted">
                                                        {Number(amount) > 0 ? " adeudado" : ""}
                                                    </span>
                                                </div>
                                            ))}
                                            {!balances.length && (
                                                <span className="small text-muted">Sin movimientos</span>
                                            )}
                                        </div>
                                        <Link
                                            className="btn btn-sm btn-outline-primary mt-auto"
                                            to={`/admin/inmobiliaria/cuenta-corriente?inmobiliariaId=${agency.id}`}
                                        >
                                            Abrir cuenta
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <BillingPromotionEditor
                promotions={overview?.promotions || []}
                catalog={overview?.catalog || []}
                onChanged={loadOverview}
            />

            <BillingCatalogEditor
                catalog={overview?.catalog || []}
                onChanged={loadOverview}
            />
        </main>
    );
};

export default BillingAdminPage;
