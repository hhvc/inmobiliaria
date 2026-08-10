import { useMemo, useState } from "react";

import {
    formatMoneyMinor,
    majorAmountToMinor,
    minorAmountToMajorInput,
    percentToBasisPoints,
} from "../utils/billing.helpers";

const dateKeyFromValue = (value) => {
    const date = new Date(Number(value || 0));
    return Number.isNaN(date.getTime())
        ? new Date().toISOString().slice(0, 10)
        : date.toISOString().slice(0, 10);
};

const getLatestTerms = (contract, dateKey) => {
    let pricing = contract.pricing || [];
    let discount = contract.discount || {};
    let applied = null;
    (contract.financialAmendments || []).forEach((amendment) => {
        if (!amendment.effectiveDateKey || amendment.effectiveDateKey > dateKey) return;
        if (applied && applied.effectiveDateKey > amendment.effectiveDateKey) return;
        pricing = amendment.pricing || pricing;
        discount = amendment.discount || discount;
        applied = amendment;
    });
    return { pricing, discount, applied };
};

const BillingContractAmendmentForm = ({
    contract,
    catalogItem,
    operation,
    onSubmit,
    onCancel,
}) => {
    const defaultEffectiveDate = dateKeyFromValue(contract.nextBillingAt);
    const currentTerms = getLatestTerms(contract, defaultEffectiveDate);
    const recurringPricing = currentTerms.pricing.filter(
        (component) => component.recurrence !== "once",
    );
    const [form, setForm] = useState({
        effectiveDateKey: defaultEffectiveDate,
        pricing: Object.fromEntries(recurringPricing.map((component) => [
            component.id,
            minorAmountToMajorInput(component.amountMinor),
        ])),
        percentage: String(Number(currentTerms.discount.percentageBasisPoints || 0) / 100),
        fixedAmount: minorAmountToMajorInput(currentTerms.discount.fixedAmountMinor || 0),
        fixedCurrency: currentTerms.discount.fixedCurrency || recurringPricing[0]?.currency || "ARS",
        discountEndsOn: currentTerms.discount.endsOn || "",
        note: "",
    });
    const [error, setError] = useState("");

    const preview = useMemo(() => {
        const percentageBasisPoints = percentToBasisPoints(form.percentage || 0) || 0;
        const fixedAmountMinor = majorAmountToMinor(form.fixedAmount || 0) || 0;
        return recurringPricing.map((component) => {
            const grossAmountMinor = majorAmountToMinor(form.pricing[component.id]);
            if (grossAmountMinor === null) return { ...component, invalid: true };
            const percentageDiscountMinor = Math.min(
                grossAmountMinor,
                Math.round(grossAmountMinor * percentageBasisPoints / 10000),
            );
            const afterPercentage = grossAmountMinor - percentageDiscountMinor;
            const fixedDiscountMinor = component.currency === form.fixedCurrency.toUpperCase()
                ? Math.min(afterPercentage, fixedAmountMinor)
                : 0;
            return {
                ...component,
                grossAmountMinor,
                discountMinor: percentageDiscountMinor + fixedDiscountMinor,
                netAmountMinor: Math.max(0, afterPercentage - fixedDiscountMinor),
            };
        });
    }, [form.fixedAmount, form.fixedCurrency, form.percentage, form.pricing, recurringPricing]);

    const copyCatalogPrices = () => {
        const catalogById = new Map((catalogItem?.pricing || [])
            .map((component) => [component.id, component]));
        setForm((current) => ({
            ...current,
            pricing: Object.fromEntries(recurringPricing.map((component) => {
                const catalogComponent = catalogById.get(component.id);
                return [
                    component.id,
                    catalogComponent?.amountMinor !== null &&
                        catalogComponent?.amountMinor !== undefined
                        ? minorAmountToMajorInput(catalogComponent.amountMinor)
                        : current.pricing[component.id],
                ];
            })),
        }));
    };

    const submit = (event) => {
        event.preventDefault();
        const percentageBasisPoints = percentToBasisPoints(form.percentage || 0);
        const fixedAmountMinor = majorAmountToMinor(form.fixedAmount || 0);
        const pricingAmounts = {};
        for (const component of recurringPricing) {
            const amountMinor = majorAmountToMinor(form.pricing[component.id]);
            if (amountMinor === null) {
                setError(`Revisá el importe de ${component.label}.`);
                return;
            }
            pricingAmounts[component.id] = { amountMinor };
        }
        if (!form.effectiveDateKey || percentageBasisPoints === null || fixedAmountMinor === null) {
            setError("Revisá la vigencia y los valores de la bonificación.");
            return;
        }
        if (form.discountEndsOn && form.discountEndsOn < form.effectiveDateKey) {
            setError("La bonificación no puede finalizar antes de la enmienda.");
            return;
        }
        setError("");
        onSubmit({
            contractId: contract.id,
            effectiveDateKey: form.effectiveDateKey,
            pricingAmounts,
            discount: {
                percentageBasisPoints,
                fixedAmountMinor,
                fixedCurrency: form.fixedCurrency.toUpperCase(),
                startsOn: form.effectiveDateKey,
                endsOn: form.discountEndsOn,
            },
            note: form.note,
        });
    };

    return (
        <section className="card border-warning shadow-sm mb-4" id="contract-amendment-form">
            <div className="card-body p-4">
                <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                    <div>
                        <p className="text-uppercase text-warning-emphasis small mb-1">Enmienda financiera</p>
                        <h2 className="h4 mb-1">{contract.catalogName}</h2>
                        <p className="text-muted mb-0">
                            Los cambios se aplicarán únicamente a obligaciones todavía no generadas.
                        </p>
                    </div>
                    <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCancel} />
                </div>
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={submit}>
                    <div className="row g-3">
                        <div className="col-md-4">
                            <label className="form-label" htmlFor="amendment-effective">Vigencia desde</label>
                            <input
                                id="amendment-effective"
                                type="date"
                                className="form-control"
                                value={form.effectiveDateKey}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    effectiveDateKey: event.target.value,
                                }))}
                                required
                            />
                        </div>
                        <div className="col-md-8 d-flex align-items-end">
                            <button type="button" className="btn btn-outline-primary" onClick={copyCatalogPrices}>
                                Copiar precios actuales del catálogo
                            </button>
                        </div>
                        {recurringPricing.map((component) => (
                            <div className="col-md-4" key={component.id}>
                                <label className="form-label" htmlFor={`amendment-${component.id}`}>
                                    {component.label} ({component.currency})
                                </label>
                                <input
                                    id={`amendment-${component.id}`}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-control"
                                    value={form.pricing[component.id] || ""}
                                    onChange={(event) => setForm((current) => ({
                                        ...current,
                                        pricing: {
                                            ...current.pricing,
                                            [component.id]: event.target.value,
                                        },
                                    }))}
                                    required
                                />
                            </div>
                        ))}
                        <div className="col-sm-6 col-md-3">
                            <label className="form-label" htmlFor="amendment-percentage">Bonificación</label>
                            <div className="input-group">
                                <input id="amendment-percentage" type="number" min="0" max="100" step="0.01" className="form-control" value={form.percentage} onChange={(event) => setForm((current) => ({ ...current, percentage: event.target.value }))} />
                                <span className="input-group-text">%</span>
                            </div>
                        </div>
                        <div className="col-sm-6 col-md-3">
                            <label className="form-label" htmlFor="amendment-fixed">Monto fijo por obligación</label>
                            <input id="amendment-fixed" type="number" min="0" step="0.01" className="form-control" value={form.fixedAmount} onChange={(event) => setForm((current) => ({ ...current, fixedAmount: event.target.value }))} />
                        </div>
                        <div className="col-sm-6 col-md-2">
                            <label className="form-label" htmlFor="amendment-currency">Moneda</label>
                            <input id="amendment-currency" className="form-control text-uppercase" maxLength={3} value={form.fixedCurrency} onChange={(event) => setForm((current) => ({ ...current, fixedCurrency: event.target.value.toUpperCase() }))} />
                        </div>
                        <div className="col-sm-6 col-md-4">
                            <label className="form-label" htmlFor="amendment-discount-end">Fin de la bonificación</label>
                            <input id="amendment-discount-end" type="date" className="form-control" value={form.discountEndsOn} onChange={(event) => setForm((current) => ({ ...current, discountEndsOn: event.target.value }))} />
                            <div className="form-text">Vacío: bonificación por tiempo indefinido.</div>
                        </div>
                        <div className="col-12">
                            <label className="form-label" htmlFor="amendment-note">Motivo de la modificación</label>
                            <textarea id="amendment-note" className="form-control" rows="2" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} required />
                        </div>
                    </div>

                    <div className="table-responsive mt-4">
                        <table className="table table-sm align-middle">
                            <thead><tr><th>Concepto</th><th>Nuevo bruto</th><th>Bonificación</th><th>Neto</th></tr></thead>
                            <tbody>
                                {preview.map((component) => (
                                    <tr key={component.id}>
                                        <td>{component.label}</td>
                                        {component.invalid ? (
                                            <td colSpan="3" className="text-danger">Importe inválido</td>
                                        ) : (
                                            <>
                                                <td>{formatMoneyMinor(component.grossAmountMinor, component.currency)}</td>
                                                <td>{formatMoneyMinor(component.discountMinor, component.currency)}</td>
                                                <td><strong>{formatMoneyMinor(component.netAmountMinor, component.currency)}</strong></td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="d-flex flex-wrap justify-content-end gap-2">
                        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancelar</button>
                        <button type="submit" className="btn btn-warning" disabled={Boolean(operation)}>
                            {operation ? "Guardando…" : "Guardar enmienda"}
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
};

export default BillingContractAmendmentForm;
