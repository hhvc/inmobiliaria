import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import BillingCatalogEditor from "../components/BillingCatalogEditor";
import BillingPaymentProofLink from "../components/BillingPaymentProofLink";
import {
    activateBillingContract,
    approveBillingContract,
    getBillingAdminOverview,
    quoteBillingContract,
    rejectBillingContract,
    resolveBillingCancellation,
    resolveBillingPaymentReport,
} from "../services/billing.service";
import {
    formatBillingDate,
    formatMoneyMinor,
    getContractBadgeClass,
    getContractStatusLabel,
    getRecurrenceLabel,
    majorAmountToMinor,
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
        } catch (operationError) {
            console.error(`Error en operación ${name}:`, operationError);
            setError(operationError.message || "No se pudo completar la operación.");
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
    const accountsByAgency = useMemo(() => new Map(
        (overview?.accounts || []).map((account) => [account.id, account]),
    ), [overview]);

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
        const defaultDate = new Date().toISOString().slice(0, 10);
        const serviceDate = window.prompt(
            "Fecha de inicio del servicio (AAAA-MM-DD):",
            defaultDate,
        );
        if (serviceDate === null) return;
        const parsed = new Date(`${serviceDate}T12:00:00-03:00`);
        if (Number.isNaN(parsed.getTime())) {
            window.alert("La fecha ingresada no es válida.");
            return;
        }
        const adminNote = window.prompt("Nota interna o de configuración (opcional):", "");
        if (adminNote === null) return;
        if (!window.confirm(
            "Esto generará los cargos iniciales y recurrentes de la contratación. ¿Continuar?",
        )) return;
        runOperation(`approve-${contract.id}`, () => approveBillingContract({
            contractId: contract.id,
            serviceStartAt: parsed.getTime(),
            adminNote,
        }), "Contratación aprobada y cargos generados.");
    };

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
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <section className="row g-3 mb-4">
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="text-muted small">Contrataciones pendientes</div>
                            <div className="display-6">{pendingContracts.length}</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="text-muted small">Pagos por revisar</div>
                            <div className="display-6">{pendingPayments.length}</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="text-muted small">Inmobiliarias</div>
                            <div className="display-6">{overview?.agencies?.length || 0}</div>
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
                                        <td>{formatBillingDate(report.paidAt)}</td>
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

            <BillingCatalogEditor
                catalog={overview?.catalog || []}
                onChanged={loadOverview}
            />
        </main>
    );
};

export default BillingAdminPage;
