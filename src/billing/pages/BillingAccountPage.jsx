import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import BillingContractAmendmentForm from "../components/BillingContractAmendmentForm";
import BillingPaymentProofLink from "../components/BillingPaymentProofLink";
import BillingContractRequestForm from "../components/BillingContractRequestForm";
import {
    acceptBillingContractQuote,
    amendBillingContractFinancialTerms,
    applyBillingHighlightCredits,
    createBillingManualEntry,
    createBillingPaymentReport,
    getBillingAgencyOverview,
    requestBillingCancellation,
    requestBillingContract,
    reverseBillingLedgerEntry,
} from "../services/billing.service";
import {
    BILLING_ENTRY_LABELS,
    catalogItemRequiresQuote,
    formatBillingDate,
    formatBillingPercent,
    formatMoneyMinor,
    getCatalogPricingSummary,
    getContractBadgeClass,
    getContractStatusLabel,
    majorAmountToMinor,
    tnaMillionthsToPercent,
} from "../utils/billing.helpers";

const PAYMENT_METHODS = [
    { value: "transferencia", label: "Transferencia bancaria" },
    { value: "mercadopago", label: "Mercado Pago" },
    { value: "efectivo", label: "Efectivo" },
    { value: "otro", label: "Otro" },
];

const INITIAL_PAYMENT = {
    amount: "",
    currency: "ARS",
    paidAt: new Date().toISOString().slice(0, 10),
    paymentMethod: "transferencia",
    reference: "",
    note: "",
    file: null,
};

const CATALOG_MODULE_LABELS = {
    tasaciones: "Expedientes de tasación",
    alquileres: "Administración de alquileres",
    consorcios: "Administración de consorcios",
    tributos: "Control tributario inmobiliario",
    parcelas: "Parcelas y normativa urbana",
    inmuebles: "Administración de inmuebles",
    instagram: "Instagram",
    mercadolibre: "Mercado Libre",
};

const getBalanceClass = (amountMinor) => {
    if (Number(amountMinor || 0) > 0) return "text-danger";
    if (Number(amountMinor || 0) < 0) return "text-success";
    return "text-body";
};

const getObligationStatus = (status) => ({
    open: { label: "Pendiente", badge: "text-bg-warning" },
    overdue: { label: "En mora", badge: "text-bg-danger" },
    paid: { label: "Pagada", badge: "text-bg-success" },
    void: { label: "Anulada", badge: "text-bg-secondary" },
}[status] || { label: status || "Pendiente", badge: "text-bg-secondary" });

const BillingAccountPage = () => {
    const [searchParams] = useSearchParams();
    const {
        activeInmobiliariaId,
        isRoot,
        loading: contextLoading,
    } = useActiveInmobiliariaModules();
    const requestedInmobiliariaId = searchParams.get("inmobiliariaId") || "";
    const requestedCatalogItemId = searchParams.get("contratar") || "";
    const inmobiliariaId = isRoot && requestedInmobiliariaId
        ? requestedInmobiliariaId
        : activeInmobiliariaId;
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [operation, setOperation] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [requestItem, setRequestItem] = useState(null);
    const [amendmentContract, setAmendmentContract] = useState(null);
    const [payment, setPayment] = useState(INITIAL_PAYMENT);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [highlight, setHighlight] = useState({ inmuebleId: "", days: 1 });
    const [manualEntry, setManualEntry] = useState({
        type: "manual_charge",
        amount: "",
        currency: "ARS",
        description: "",
    });
    const openedCatalogItemRef = useRef("");

    const loadOverview = useCallback(async () => {
        if (!inmobiliariaId) {
            setOverview(null);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError("");
            setOverview(await getBillingAgencyOverview(inmobiliariaId));
        } catch (loadError) {
            console.error("Error cargando cuenta corriente:", loadError);
            setError(loadError.message || "No se pudo cargar la cuenta corriente.");
        } finally {
            setLoading(false);
        }
    }, [inmobiliariaId]);

    useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    const runOperation = async (name, callback, message) => {
        try {
            setOperation(name);
            setError("");
            setSuccess("");
            await callback();
            if (message) setSuccess(message);
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

    const balances = useMemo(() => Object.entries(
        overview?.account?.balanceByCurrency || {},
    ).sort(([a], [b]) => a.localeCompare(b)), [overview]);
    const currentArsRate = useMemo(() => {
        const todayDateKey = new Date().toISOString().slice(0, 10);
        return (overview?.interestRates || []).find((rate) => (
            rate.currency === "ARS" && rate.effectiveDateKey <= todayDateKey
        )) || null;
    }, [overview]);

    const openContractsByCatalog = useMemo(() => {
        const finalStatuses = new Set(["cancelled", "rejected"]);
        return new Map((overview?.contracts || [])
            .filter((contract) => !finalStatuses.has(contract.status))
            .map((contract) => [contract.catalogItemId, contract]));
    }, [overview]);

    const handleRequest = (item) => {
        setRequestItem(item);
        setError("");
        setSuccess("");
        window.setTimeout(() => {
            document.getElementById("contract-request-form")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 0);
    };

    useEffect(() => {
        if (
            !requestedCatalogItemId ||
            openedCatalogItemRef.current === requestedCatalogItemId ||
            !overview?.catalog?.length
        ) return;
        const item = overview.catalog.find(
            (catalogItem) => catalogItem.id === requestedCatalogItemId,
        );
        if (!item) return;
        openedCatalogItemRef.current = requestedCatalogItemId;
        setRequestItem(item);
        window.setTimeout(() => {
            document.getElementById("contract-request-form")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 0);
    }, [overview, requestedCatalogItemId]);

    const handleRequestSubmit = (payload) => {
        runOperation(`request-${payload.catalogItemId}`, () => requestBillingContract({
            ...payload,
            inmobiliariaId,
        }), payload.promotionCode
            ? `Solicitud enviada. Código ${payload.promotionCode} reservado.`
            : "Solicitud enviada a ONO Prop.").then((done) => {
            if (done) setRequestItem(null);
        });
    };

    const handleAmendment = (contract) => {
        setAmendmentContract(contract);
        setError("");
        setSuccess("");
        window.setTimeout(() => {
            document.getElementById("contract-amendment-form")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 0);
    };

    const handleAmendmentSubmit = (payload) => {
        runOperation(
            `amend-${payload.contractId}`,
            () => amendBillingContractFinancialTerms(payload),
            "Condiciones futuras actualizadas sin modificar obligaciones existentes.",
        ).then((done) => {
            if (done) setAmendmentContract(null);
        });
    };

    const handleAcceptQuote = (contract) => {
        if (!window.confirm(
            `¿Aceptar la cotización de “${contract.catalogName}” y sus condiciones?`,
        )) return;
        runOperation(`accept-${contract.id}`, () => (
            acceptBillingContractQuote(contract.id)
        ), "Cotización aceptada. ONO Prop continuará con el alta.");
    };

    const handleCancellation = (contract) => {
        const reason = window.prompt("Motivo de la solicitud de baja:", "");
        if (reason === null) return;
        runOperation(`cancel-${contract.id}`, () => requestBillingCancellation({
            contractId: contract.id,
            reason,
        }), "Solicitud de baja enviada.");
    };

    const handlePaymentSubmit = (event) => {
        event.preventDefault();
        const amountMinor = majorAmountToMinor(payment.amount);
        if (!amountMinor || amountMinor <= 0) {
            setError("Ingresá un importe de pago válido.");
            return;
        }
        runOperation("payment", () => createBillingPaymentReport({
            inmobiliariaId,
            amountMinor,
            currency: payment.currency,
            paidAt: payment.paidAt,
            paymentMethod: payment.paymentMethod,
            reference: payment.reference,
            note: payment.note,
            file: payment.file,
            onProgress: setUploadProgress,
        }), "Pago informado. Se acreditará cuando ONO Prop lo confirme.").then((done) => {
            if (done) {
                setPayment(INITIAL_PAYMENT);
                setUploadProgress(0);
            }
        });
    };

    const handleHighlightSubmit = (event) => {
        event.preventDefault();
        if (!highlight.inmuebleId || Number(highlight.days) < 1) {
            setError("Seleccioná un inmueble y la cantidad de días.");
            return;
        }
        runOperation("highlight", () => applyBillingHighlightCredits({
            inmobiliariaId,
            inmuebleId: highlight.inmuebleId,
            days: Number(highlight.days),
        }), "El aviso quedó destacado por el período solicitado.");
    };

    const handleManualEntry = (event) => {
        event.preventDefault();
        const amountMinor = majorAmountToMinor(manualEntry.amount);
        if (!amountMinor || !manualEntry.description.trim()) {
            setError("Completá el importe y el concepto del movimiento.");
            return;
        }
        runOperation("manual-entry", () => createBillingManualEntry({
            inmobiliariaId,
            type: manualEntry.type,
            amountMinor,
            currency: manualEntry.currency,
            description: manualEntry.description,
        }), "Movimiento registrado.").then((done) => {
            if (done) {
                setManualEntry((current) => ({
                    ...current,
                    amount: "",
                    description: "",
                }));
            }
        });
    };

    const handleReverse = (entry) => {
        const reason = window.prompt(
            `Motivo de la reversión de “${entry.description}”:`,
            "",
        );
        if (reason === null) return;
        runOperation(`reverse-${entry.id}`, () => reverseBillingLedgerEntry({
            inmobiliariaId,
            entryId: entry.id,
            reason,
        }), "Movimiento revertido mediante un contramovimiento.");
    };

    if (contextLoading || loading) {
        return <main className="container py-5 text-center">Cargando cuenta corriente...</main>;
    }

    if (!inmobiliariaId) {
        return (
            <main className="container py-5">
                <div className="alert alert-warning">
                    Seleccioná una inmobiliaria para consultar su cuenta corriente.
                </div>
            </main>
        );
    }

    return (
        <main className="container py-4">
            <SEO
                title="Cuenta corriente | ONO Prop"
                description="Servicios contratados, movimientos y saldo de la inmobiliaria."
                url={`${window.location.origin}/admin/inmobiliaria/cuenta-corriente`}
                noIndex
            />

            <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                <div>
                    <p className="text-uppercase text-muted small mb-1">Servicios ONO Prop</p>
                    <h1 className="h3 mb-1">Cuenta corriente</h1>
                    <p className="text-muted mb-0">
                        {overview?.inmobiliaria?.nombre || inmobiliariaId}
                    </p>
                </div>
                <div className="d-flex flex-wrap gap-2">
                    {isRoot && (
                        <Link to="/admin/facturacion" className="btn btn-outline-primary">
                            Administración comercial
                        </Link>
                    )}
                    <Link to="/admin/inmobiliaria" className="btn btn-outline-secondary">
                        Volver al panel
                    </Link>
                    <button type="button" className="btn btn-primary" onClick={loadOverview}>
                        Actualizar
                    </button>
                </div>
            </header>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <section className="row g-3 mb-4">
                {balances.length === 0 ? (
                    <div className="col-md-6 col-xl-3">
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-body">
                                <div className="small text-muted">Saldo</div>
                                <div className="h4 mb-0">Sin movimientos</div>
                            </div>
                        </div>
                    </div>
                ) : balances.map(([currency, amountMinor]) => (
                    <div className="col-md-6 col-xl-3" key={currency}>
                        <div className="card border-0 shadow-sm h-100">
                            <div className="card-body">
                                <div className="small text-muted">Saldo en {currency}</div>
                                <div className={`h4 mb-0 ${getBalanceClass(amountMinor)}`}>
                                    {formatMoneyMinor(amountMinor, currency)}
                                </div>
                                <div className="small text-muted mt-1">
                                    {Number(amountMinor) > 0
                                        ? "Importe pendiente"
                                        : Number(amountMinor) < 0
                                            ? "Saldo a favor"
                                            : "Cuenta al día"}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                <div className="col-md-6 col-xl-3">
                    <div className="card border-0 shadow-sm h-100 text-bg-warning">
                        <div className="card-body">
                            <div className="small">Créditos disponibles</div>
                            <div className="h4 mb-0">
                                {overview?.highlightCreditsAvailable || 0}
                            </div>
                            <div className="small">días de avisos destacados</div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="alert alert-light border mb-4">
                <strong>Interés moratorio:</strong>{" "}
                {currentArsRate ? (
                    <>
                        TNA ARS vigente {
                            formatBillingPercent(
                                tnaMillionthsToPercent(currentArsRate.tnaMillionths),
                            )
                        }% desde {currentArsRate.effectiveDateKey}.
                    </>
                ) : "TNA ARS todavía no configurada."}{" "}
                Conversión diaria sobre base 365; primera liquidación al día siguiente
                del vencimiento y luego capitalización diaria.
            </div>

            {requestItem && (
                <BillingContractRequestForm
                    key={requestItem.id}
                    item={requestItem}
                    operation={operation}
                    onSubmit={handleRequestSubmit}
                    onCancel={() => setRequestItem(null)}
                />
            )}

            {amendmentContract && (
                <BillingContractAmendmentForm
                    key={amendmentContract.id}
                    contract={amendmentContract}
                    catalogItem={(overview?.catalog || []).find(
                        (item) => item.id === amendmentContract.catalogItemId,
                    )}
                    operation={operation}
                    onSubmit={handleAmendmentSubmit}
                    onCancel={() => setAmendmentContract(null)}
                />
            )}

            <section className="card border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                    <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                        <div>
                            <h2 className="h4 mb-1">Catálogo de productos y servicios</h2>
                            <p className="text-muted mb-0">
                                Los precios cotizables se confirman antes de generar cargos. Al
                                solicitar una contratación aceptás los{" "}
                                <Link to="/terminos" target="_blank">términos vigentes</Link>.
                            </p>
                        </div>
                    </div>
                    {overview?.catalog?.length ? (
                        <div className="row g-3">
                            {overview.catalog.map((item) => {
                                const currentContract = item.allowQuantity
                                    ? null
                                    : openContractsByCatalog.get(item.id);
                                return (
                                    <article className="col-md-6 col-xl-4" key={item.id}>
                                        <div className="card h-100 border">
                                            <div className="card-body d-flex flex-column">
                                                <div className="d-flex justify-content-between gap-2 mb-2">
                                                    <h3 className="h5 mb-0">{item.name}</h3>
                                                    <span className="badge text-bg-light border">
                                                        {item.itemType === "product" ? "Producto" : "Servicio"}
                                                    </span>
                                                </div>
                                                <p className="text-muted small">{item.description}</p>
                                                {item.moduleGrants?.length > 0 && (
                                                    <div className="d-flex flex-wrap gap-1 mb-2">
                                                        {item.moduleGrants.map((moduleId) => (
                                                            <span
                                                                className="badge text-bg-primary-subtle border border-primary-subtle text-primary-emphasis"
                                                                key={moduleId}
                                                            >
                                                                {CATALOG_MODULE_LABELS[moduleId] || moduleId}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                <ul className="small ps-3">
                                                    {getCatalogPricingSummary(item).map((line) => (
                                                        <li key={line}>{line}</li>
                                                    ))}
                                                </ul>
                                                {item.requirements?.length > 0 && (
                                                    <div className="small mb-2">
                                                        <strong>Requiere:</strong>{" "}
                                                        {item.requirements.map((entry) => entry.label).join(" · ")}
                                                    </div>
                                                )}
                                                {item.inclusions?.length > 0 && (
                                                    <div className="small mb-3">
                                                        <strong>Incluye:</strong>{" "}
                                                        {item.inclusions.join(" · ")}
                                                    </div>
                                                )}
                                                <div className="mt-auto d-grid">
                                                    {currentContract ? (
                                                        <span className={getContractBadgeClass(currentContract.status)}>
                                                            {getContractStatusLabel(currentContract.status)}
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="btn btn-primary"
                                                            onClick={() => handleRequest(item)}
                                                            disabled={Boolean(operation)}
                                                        >
                                                            {catalogItemRequiresQuote(item)
                                                                ? "Solicitar cotización"
                                                                : item.allowQuantity
                                                                    ? "Comprar créditos"
                                                                    : "Solicitar contratación"}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="alert alert-light border mb-0">
                            ONO Prop todavía no publicó productos en el catálogo.
                        </div>
                    )}
                </div>
            </section>

            <section className="row g-4 mb-4">
                <div className="col-xl-7">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body p-4">
                            <h2 className="h4 mb-3">Contrataciones</h2>
                            {overview?.contracts?.length ? (
                                <div className="d-flex flex-column gap-3">
                                    {overview.contracts.map((contract) => (
                                        <article className="border rounded p-3" key={contract.id}>
                                            <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                                                <div>
                                                    <h3 className="h6 mb-1">{contract.catalogName}</h3>
                                                    <div className="small text-muted">
                                                        Cantidad: {contract.quantity || 1} · Solicitado {formatBillingDate(contract.requestedAt)}
                                                    </div>
                                                </div>
                                                <span className={getContractBadgeClass(contract.status)}>
                                                    {getContractStatusLabel(contract.status)}
                                                </span>
                                            </div>
                                            <ul className="small mb-2 ps-3">
                                                {(contract.pricing || []).map((component) => (
                                                    <li key={component.id}>
                                                        {component.label}: {component.amountMinor === null
                                                            ? "A convenir"
                                                            : formatMoneyMinor(
                                                                component.amountMinor * (contract.quantity || 1),
                                                                component.currency,
                                                            )}
                                                    </li>
                                                ))}
                                            </ul>
                                            {contract.serviceStartDateKey && (
                                                <div className="small text-muted mb-2">
                                                    Servicio: {contract.serviceStartDateKey}
                                                    {contract.serviceEndDateKey
                                                        ? ` al ${contract.serviceEndDateKey}`
                                                        : " · duración indefinida"}
                                                    {` · vencimiento a ${contract.paymentTermDays || 15} días`}
                                                </div>
                                            )}
                                            {(contract.discount?.percentageBasisPoints > 0 ||
                                                contract.discount?.fixedAmountMinor > 0) && (
                                                <div className="small text-success mb-2">
                                                    Bonificación: {
                                                        Number(contract.discount.percentageBasisPoints || 0) / 100
                                                    }%
                                                    {contract.discount.fixedAmountMinor > 0
                                                        ? ` + ${formatMoneyMinor(
                                                            contract.discount.fixedAmountMinor,
                                                            contract.discount.fixedCurrency,
                                                        )}`
                                                        : ""}
                                                    {contract.discount.endsOn
                                                        ? ` hasta ${contract.discount.endsOn}`
                                                        : " sin fecha de finalización"}
                                                </div>
                                            )}
                                            {contract.promotion?.code && (
                                                <div className="small text-primary mb-2">
                                                    Código aplicado: <strong>{contract.promotion.code}</strong>
                                                    {contract.promotion.discount?.percentageBasisPoints > 0
                                                        ? ` · ${formatBillingPercent(
                                                            contract.promotion.discount.percentageBasisPoints / 100,
                                                        )}%`
                                                        : ""}
                                                    {contract.promotion.discount?.fixedAmountMinor > 0
                                                        ? ` + ${formatMoneyMinor(
                                                            contract.promotion.discount.fixedAmountMinor,
                                                            contract.promotion.discount.fixedCurrency,
                                                        )} por obligación`
                                                        : ""}
                                                    {contract.promotionReservationStatus === "reserved"
                                                        ? " · reservado"
                                                        : contract.promotionReservationStatus === "redeemed"
                                                            ? " · confirmado"
                                                            : ""}
                                                </div>
                                            )}
                                            {contract.financialAmendments?.length > 0 && (
                                                <div className="small text-warning-emphasis mb-2">
                                                    Enmienda financiera registrada desde {
                                                        contract.latestFinancialAmendmentEffectiveDateKey ||
                                                        contract.financialAmendments.at(-1)?.effectiveDateKey
                                                    }.
                                                </div>
                                            )}
                                            {contract.quoteNote && (
                                                <p className="small bg-light border rounded p-2">
                                                    {contract.quoteNote}
                                                </p>
                                            )}
                                            <div className="d-flex flex-wrap gap-2">
                                                {contract.status === "quoted" && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => handleAcceptQuote(contract)}
                                                        disabled={Boolean(operation)}
                                                    >
                                                        Aceptar cotización
                                                    </button>
                                                )}
                                                {isRoot && [
                                                    "active",
                                                    "pending_payment",
                                                    "pending_setup",
                                                    "suspended",
                                                ].includes(contract.status) && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-warning btn-sm"
                                                        onClick={() => handleAmendment(contract)}
                                                        disabled={Boolean(operation)}
                                                    >
                                                        Modificar condiciones futuras
                                                    </button>
                                                )}
                                                {["active", "pending_payment", "pending_setup", "suspended"].includes(contract.status) && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger btn-sm"
                                                        onClick={() => handleCancellation(contract)}
                                                        disabled={Boolean(operation)}
                                                    >
                                                        Solicitar baja
                                                    </button>
                                                )}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted mb-0">Todavía no hay contrataciones.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-xl-5">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body p-4">
                            <h2 className="h4 mb-1">Informar un pago</h2>
                            <p className="text-muted small">
                                Se acreditará cuando ONO Prop confirme el comprobante. El pago se
                                aplica primero a la obligación más antigua, intereses y luego capital.
                            </p>
                            <form onSubmit={handlePaymentSubmit} className="row g-3">
                                <div className="col-8">
                                    <label className="form-label">Importe</label>
                                    <input
                                        className="form-control"
                                        inputMode="decimal"
                                        value={payment.amount}
                                        onChange={(event) => setPayment((current) => ({
                                            ...current,
                                            amount: event.target.value,
                                        }))}
                                        required
                                    />
                                </div>
                                <div className="col-4">
                                    <label className="form-label">Moneda</label>
                                    <input
                                        className="form-control text-uppercase"
                                        maxLength={3}
                                        value={payment.currency}
                                        onChange={(event) => setPayment((current) => ({
                                            ...current,
                                            currency: event.target.value.toUpperCase(),
                                        }))}
                                        required
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label">Fecha del pago</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={payment.paidAt}
                                        onChange={(event) => setPayment((current) => ({
                                            ...current,
                                            paidAt: event.target.value,
                                        }))}
                                        required
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label">Medio</label>
                                    <select
                                        className="form-select"
                                        value={payment.paymentMethod}
                                        onChange={(event) => setPayment((current) => ({
                                            ...current,
                                            paymentMethod: event.target.value,
                                        }))}
                                    >
                                        {PAYMENT_METHODS.map((item) => (
                                            <option value={item.value} key={item.value}>{item.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-12">
                                    <label className="form-label">Referencia</label>
                                    <input
                                        className="form-control"
                                        value={payment.reference}
                                        onChange={(event) => setPayment((current) => ({
                                            ...current,
                                            reference: event.target.value,
                                        }))}
                                        placeholder="Número de operación o referencia"
                                    />
                                </div>
                                <div className="col-12">
                                    <label className="form-label">Comprobante</label>
                                    <input
                                        type="file"
                                        className="form-control"
                                        accept="image/*,application/pdf"
                                        onChange={(event) => setPayment((current) => ({
                                            ...current,
                                            file: event.target.files?.[0] || null,
                                        }))}
                                    />
                                    <div className="form-text">Imagen o PDF de hasta 10 MB.</div>
                                </div>
                                {operation === "payment" && uploadProgress > 0 && (
                                    <div className="col-12">
                                        <div className="progress" role="progressbar" aria-valuenow={uploadProgress}>
                                            <div className="progress-bar" style={{ width: `${uploadProgress}%` }}>
                                                {uploadProgress}%
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="col-12 d-grid">
                                    <button type="submit" className="btn btn-success" disabled={Boolean(operation)}>
                                        {operation === "payment" ? "Enviando..." : "Informar pago"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            <section className="card border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                    <h2 className="h4 mb-1">Obligaciones y vencimientos</h2>
                    <p className="text-muted small">
                        Cada cargo conserva su período, descuentos, capital e intereses moratorios.
                    </p>
                    <div className="table-responsive">
                        <table className="table align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Concepto</th>
                                    <th>Período</th>
                                    <th>Vencimiento</th>
                                    <th>Importe</th>
                                    <th>Capital pendiente</th>
                                    <th>Interés pendiente</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(overview?.obligations || []).map((obligation) => {
                                    const status = getObligationStatus(obligation.status);
                                    return (
                                        <tr key={obligation.id}>
                                            <td>
                                                <strong>{obligation.componentLabel}</strong>
                                                <div className="small text-muted">
                                                    {obligation.catalogName}
                                                </div>
                                                {(obligation.percentageDiscountMinor > 0 ||
                                                    obligation.fixedDiscountMinor > 0) && (
                                                    <div className="small text-success">
                                                        Bonificación aplicada: {formatMoneyMinor(
                                                            Number(obligation.percentageDiscountMinor || 0) +
                                                            Number(obligation.fixedDiscountMinor || 0),
                                                            obligation.currency,
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="small">
                                                {obligation.periodStartDateKey}
                                                {obligation.periodEndDateKey &&
                                                    obligation.periodEndDateKey !==
                                                        obligation.periodStartDateKey
                                                    ? ` al ${obligation.periodEndDateKey}`
                                                    : ""}
                                            </td>
                                            <td>{obligation.dueDateKey || "-"}</td>
                                            <td>
                                                {formatMoneyMinor(
                                                    obligation.principalOriginalMinor,
                                                    obligation.currency,
                                                )}
                                            </td>
                                            <td>
                                                {formatMoneyMinor(
                                                    obligation.principalOutstandingMinor,
                                                    obligation.currency,
                                                )}
                                            </td>
                                            <td>
                                                {formatMoneyMinor(
                                                    obligation.interestOutstandingMinor,
                                                    obligation.currency,
                                                )}
                                            </td>
                                            <td>
                                                <span className={`badge ${status.badge}`}>
                                                    {status.label}
                                                </span>
                                                {obligation.interestPendingRateDateKey && (
                                                    <div className="small text-danger mt-1">
                                                        Falta TNA desde {
                                                            obligation.interestPendingRateDateKey
                                                        }
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!overview?.obligations?.length && (
                                    <tr>
                                        <td colSpan="7" className="text-center text-muted py-4">
                                            Todavía no hay obligaciones generadas.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {Number(overview?.highlightCreditsAvailable || 0) > 0 && (
                <section className="card border-0 shadow-sm mb-4">
                    <div className="card-body p-4">
                        <h2 className="h4 mb-1">Usar créditos de destaque</h2>
                        <p className="text-muted">
                            Cada crédito agrega 24 horas. Si el aviso ya está destacado, el tiempo se acumula.
                        </p>
                        <form className="row g-3 align-items-end" onSubmit={handleHighlightSubmit}>
                            <div className="col-md-7">
                                <label className="form-label">Inmueble publicado</label>
                                <select
                                    className="form-select"
                                    value={highlight.inmuebleId}
                                    onChange={(event) => setHighlight((current) => ({
                                        ...current,
                                        inmuebleId: event.target.value,
                                    }))}
                                    required
                                >
                                    <option value="">Seleccionar inmueble</option>
                                    {(overview?.inmuebles || [])
                                        .filter((item) => item.publicarEnPortal)
                                        .map((item) => (
                                            <option value={item.id} key={item.id}>
                                                {item.titulo}{item.destacado ? " · destacado" : ""}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Días</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    min="1"
                                    max={overview.highlightCreditsAvailable}
                                    value={highlight.days}
                                    onChange={(event) => setHighlight((current) => ({
                                        ...current,
                                        days: event.target.value,
                                    }))}
                                />
                            </div>
                            <div className="col-md-3 d-grid">
                                <button type="submit" className="btn btn-warning" disabled={Boolean(operation)}>
                                    Aplicar destaque
                                </button>
                            </div>
                        </form>
                    </div>
                </section>
            )}

            {isRoot && (
                <section className="card border-0 shadow-sm mb-4">
                    <div className="card-body p-4">
                        <h2 className="h4 mb-3">Registrar movimiento manual</h2>
                        <form className="row g-3 align-items-end" onSubmit={handleManualEntry}>
                            <div className="col-md-3">
                                <label className="form-label">Tipo</label>
                                <select
                                    className="form-select"
                                    value={manualEntry.type}
                                    onChange={(event) => setManualEntry((current) => ({
                                        ...current,
                                        type: event.target.value,
                                    }))}
                                >
                                    <option value="manual_charge">Cargo</option>
                                    <option value="manual_credit">Crédito</option>
                                    <option value="adjustment_debit">Ajuste débito</option>
                                    <option value="adjustment_credit">Ajuste crédito</option>
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Importe</label>
                                <input
                                    className="form-control"
                                    inputMode="decimal"
                                    value={manualEntry.amount}
                                    onChange={(event) => setManualEntry((current) => ({
                                        ...current,
                                        amount: event.target.value,
                                    }))}
                                />
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Moneda</label>
                                <input
                                    className="form-control text-uppercase"
                                    maxLength={3}
                                    value={manualEntry.currency}
                                    onChange={(event) => setManualEntry((current) => ({
                                        ...current,
                                        currency: event.target.value.toUpperCase(),
                                    }))}
                                />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label">Concepto</label>
                                <input
                                    className="form-control"
                                    value={manualEntry.description}
                                    onChange={(event) => setManualEntry((current) => ({
                                        ...current,
                                        description: event.target.value,
                                    }))}
                                />
                            </div>
                            <div className="col-md-1 d-grid">
                                <button type="submit" className="btn btn-primary" disabled={Boolean(operation)}>
                                    Crear
                                </button>
                            </div>
                        </form>
                    </div>
                </section>
            )}

            <section className="card border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                    <h2 className="h4 mb-3">Movimientos</h2>
                    <div className="table-responsive">
                        <table className="table align-middle">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Concepto</th>
                                    <th>Tipo</th>
                                    <th className="text-end">Importe</th>
                                    <th className="text-end">Saldo</th>
                                    {isRoot && <th>Acciones</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {(overview?.entries || []).map((entry) => (
                                    <tr key={entry.id}>
                                        <td>{formatBillingDate(entry.createdAt, { withTime: true })}</td>
                                        <td>
                                            {entry.description}
                                            {entry.reversedByEntryId && (
                                                <span className="badge text-bg-secondary ms-2">Revertido</span>
                                            )}
                                        </td>
                                        <td>{BILLING_ENTRY_LABELS[entry.type] || entry.type}</td>
                                        <td className={`text-end ${entry.direction === "credit" ? "text-success" : "text-danger"}`}>
                                            {entry.direction === "credit" ? "− " : "+ "}
                                            {formatMoneyMinor(entry.amountMinor, entry.currency)}
                                        </td>
                                        <td className="text-end">
                                            {formatMoneyMinor(entry.balanceAfterMinor, entry.currency)}
                                        </td>
                                        {isRoot && (
                                            <td>
                                                {!entry.reversedByEntryId &&
                                                    entry.type !== "reversal" &&
                                                    !entry.obligationId &&
                                                    !entry.paymentReportId && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger btn-sm"
                                                        onClick={() => handleReverse(entry)}
                                                        disabled={Boolean(operation)}
                                                    >
                                                        Revertir
                                                    </button>
                                                )}
                                                {(entry.obligationId || entry.paymentReportId) && (
                                                    <span className="small text-muted">
                                                        Movimiento imputado
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {!overview?.entries?.length && (
                                    <tr><td colSpan={isRoot ? 6 : 5} className="text-muted text-center py-4">Sin movimientos.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="card border-0 shadow-sm">
                <div className="card-body p-4">
                    <h2 className="h4 mb-3">Pagos informados</h2>
                    <div className="table-responsive">
                        <table className="table align-middle mb-0">
                            <thead><tr><th>Fecha</th><th>Importe</th><th>Referencia</th><th>Estado</th><th>Imputación</th><th>Comprobante</th></tr></thead>
                            <tbody>
                                {(overview?.paymentReports || []).map((report) => (
                                    <tr key={report.id}>
                                        <td>{report.paidDateKey || formatBillingDate(report.paidAt)}</td>
                                        <td>{formatMoneyMinor(report.amountMinor, report.currency)}</td>
                                        <td>{report.reference || "-"}</td>
                                        <td>
                                            <span className={`badge ${report.status === "confirmed" ? "text-bg-success" : report.status === "rejected" ? "text-bg-danger" : "text-bg-warning"}`}>
                                                {report.status === "confirmed" ? "Confirmado" : report.status === "rejected" ? "Rechazado" : "Pendiente"}
                                            </span>
                                        </td>
                                        <td className="small">
                                            {report.status === "confirmed" ? (
                                                <>
                                                    Aplicado: {formatMoneyMinor(
                                                        report.allocatedMinor,
                                                        report.currency,
                                                    )}
                                                    {report.unallocatedMinor > 0 && (
                                                        <div className="text-success">
                                                            A favor: {formatMoneyMinor(
                                                                report.unallocatedMinor,
                                                                report.currency,
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            ) : "-"}
                                        </td>
                                        <td>
                                            <BillingPaymentProofLink
                                                proofPath={report.proofPath}
                                                legacyProofUrl={report.proofUrl}
                                            />
                                        </td>
                                    </tr>
                                ))}
                                {!overview?.paymentReports?.length && (
                                    <tr><td colSpan="6" className="text-muted text-center py-4">Sin pagos informados.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default BillingAccountPage;
