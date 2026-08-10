import { useMemo, useState } from "react";

import {
    formatMoneyMinor,
    majorAmountToMinor,
    minorAmountToMajorInput,
    percentToBasisPoints,
} from "../utils/billing.helpers";

const todayDateKey = () => new Date().toISOString().slice(0, 10);

const BillingContractApprovalForm = ({ contract, operation, onApprove, onCancel }) => {
    const promotionDiscount = contract.promotion?.discount || {};
    const initialStart = todayDateKey();
    const [form, setForm] = useState({
        serviceStartDate: initialStart,
        serviceEndDate: "",
        paymentTermDays: String(contract.paymentTermDays || 15),
        percentage: String(Number(promotionDiscount.percentageBasisPoints || 0) / 100),
        fixedAmount: promotionDiscount.fixedAmountMinor
            ? minorAmountToMajorInput(promotionDiscount.fixedAmountMinor)
            : "0",
        fixedCurrency: promotionDiscount.fixedCurrency || contract.pricing?.[0]?.currency || "ARS",
        discountStartsOn: initialStart,
        discountEndsOn: "",
        adminNote: "",
    });
    const [error, setError] = useState("");

    const preview = useMemo(() => {
        const percentageBasisPoints = percentToBasisPoints(form.percentage || 0) || 0;
        const fixedAmountMinor = majorAmountToMinor(form.fixedAmount || 0) || 0;
        return (contract.pricing || []).map((component) => {
            if (component.amountMinor === null) return { ...component, quotePending: true };
            const grossAmountMinor = Number(component.amountMinor || 0) *
                Math.max(1, Number(contract.quantity || 1));
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
    }, [contract, form.fixedAmount, form.fixedCurrency, form.percentage]);

    const change = (field) => (event) => {
        const value = event.target.value;
        setForm((current) => ({ ...current, [field]: value }));
    };

    const submit = (event) => {
        event.preventDefault();
        const percentageBasisPoints = percentToBasisPoints(form.percentage || 0);
        const fixedAmountMinor = majorAmountToMinor(form.fixedAmount || 0);
        const paymentTermDays = Math.trunc(Number(form.paymentTermDays));
        if (!form.serviceStartDate) {
            setError("Ingresá la fecha de inicio del servicio.");
            return;
        }
        if (form.serviceEndDate && form.serviceEndDate < form.serviceStartDate) {
            setError("La finalización no puede ser anterior al inicio.");
            return;
        }
        if (!Number.isSafeInteger(paymentTermDays) || paymentTermDays < 1 || paymentTermDays > 365) {
            setError("El plazo de pago debe estar entre 1 y 365 días.");
            return;
        }
        if (percentageBasisPoints === null || fixedAmountMinor === null) {
            setError("Revisá los valores de la bonificación.");
            return;
        }
        if (
            form.discountStartsOn &&
            form.discountEndsOn &&
            form.discountEndsOn < form.discountStartsOn
        ) {
            setError("La vigencia de la bonificación no es válida.");
            return;
        }

        setError("");
        onApprove({
            contractId: contract.id,
            serviceStartAt: new Date(`${form.serviceStartDate}T12:00:00-03:00`).getTime(),
            serviceEndAt: form.serviceEndDate
                ? new Date(`${form.serviceEndDate}T12:00:00-03:00`).getTime()
                : 0,
            paymentTermDays,
            discount: {
                percentageBasisPoints,
                fixedAmountMinor,
                fixedCurrency: form.fixedCurrency.toUpperCase(),
                startsOn: percentageBasisPoints > 0 || fixedAmountMinor > 0
                    ? form.discountStartsOn || form.serviceStartDate
                    : "",
                endsOn: form.discountEndsOn,
            },
            adminNote: form.adminNote,
        });
    };

    return (
        <section className="card border-primary shadow-sm mb-4" id="contract-approval-form">
            <div className="card-body p-4">
                <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                    <div>
                        <p className="text-primary text-uppercase small mb-1">Aprobación contractual</p>
                        <h2 className="h4 mb-1">{contract.catalogName}</h2>
                        <p className="text-muted mb-0">{contract.inmobiliariaNombre}</p>
                    </div>
                    <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCancel} />
                </div>

                {contract.promotion?.code && (
                    <div className="alert alert-success">
                        Código <strong>{contract.promotion.code}</strong> reservado.
                        La bonificación prometida puede aumentarse, pero no reducirse.
                    </div>
                )}
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={submit}>
                    <div className="row g-3">
                        <div className="col-sm-6 col-lg-3">
                            <label className="form-label" htmlFor="approval-start">Inicio del servicio</label>
                            <input
                                id="approval-start"
                                type="date"
                                className="form-control"
                                value={form.serviceStartDate}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    serviceStartDate: event.target.value,
                                    discountStartsOn:
                                        current.discountStartsOn === current.serviceStartDate
                                            ? event.target.value
                                            : current.discountStartsOn,
                                }))}
                                required
                            />
                        </div>
                        <div className="col-sm-6 col-lg-3">
                            <label className="form-label" htmlFor="approval-end">Finalización</label>
                            <input id="approval-end" type="date" className="form-control" value={form.serviceEndDate} onChange={change("serviceEndDate")} />
                            <div className="form-text">Vacío: duración indefinida.</div>
                        </div>
                        <div className="col-sm-6 col-lg-3">
                            <label className="form-label" htmlFor="approval-term">Plazo de pago</label>
                            <div className="input-group">
                                <input id="approval-term" type="number" min="1" max="365" className="form-control" value={form.paymentTermDays} onChange={change("paymentTermDays")} required />
                                <span className="input-group-text">días</span>
                            </div>
                        </div>
                        <div className="col-sm-6 col-lg-3">
                            <label className="form-label" htmlFor="approval-percentage">Bonificación porcentual</label>
                            <div className="input-group">
                                <input
                                    id="approval-percentage"
                                    type="number"
                                    min={Number(promotionDiscount.percentageBasisPoints || 0) / 100}
                                    max="100"
                                    step="0.01"
                                    className="form-control"
                                    value={form.percentage}
                                    onChange={change("percentage")}
                                />
                                <span className="input-group-text">%</span>
                            </div>
                        </div>
                        <div className="col-sm-6 col-lg-3">
                            <label className="form-label" htmlFor="approval-fixed">Bonificación fija por obligación</label>
                            <input
                                id="approval-fixed"
                                type="number"
                                min={Number(promotionDiscount.fixedAmountMinor || 0) / 100}
                                step="0.01"
                                className="form-control"
                                value={form.fixedAmount}
                                onChange={change("fixedAmount")}
                            />
                        </div>
                        <div className="col-sm-6 col-lg-3">
                            <label className="form-label" htmlFor="approval-currency">Moneda del monto fijo</label>
                            <input
                                id="approval-currency"
                                className="form-control text-uppercase"
                                maxLength={3}
                                value={form.fixedCurrency}
                                disabled={Number(promotionDiscount.fixedAmountMinor || 0) > 0}
                                onChange={change("fixedCurrency")}
                            />
                        </div>
                        <div className="col-sm-6 col-lg-3">
                            <label className="form-label" htmlFor="approval-discount-start">Inicio de bonificación</label>
                            <input id="approval-discount-start" type="date" className="form-control" value={form.discountStartsOn} onChange={change("discountStartsOn")} />
                        </div>
                        <div className="col-sm-6 col-lg-3">
                            <label className="form-label" htmlFor="approval-discount-end">Fin de bonificación</label>
                            <input id="approval-discount-end" type="date" className="form-control" value={form.discountEndsOn} onChange={change("discountEndsOn")} />
                            <div className="form-text">Vacío: bonificación indefinida.</div>
                        </div>
                        <div className="col-12">
                            <label className="form-label" htmlFor="approval-note">Nota interna</label>
                            <textarea id="approval-note" className="form-control" rows="2" value={form.adminNote} onChange={change("adminNote")} />
                        </div>
                    </div>

                    <div className="table-responsive mt-4">
                        <table className="table table-sm align-middle">
                            <thead><tr><th>Concepto</th><th>Bruto</th><th>Bonificación</th><th>Neto</th></tr></thead>
                            <tbody>
                                {preview.map((component) => (
                                    <tr key={component.id}>
                                        <td>{component.label}</td>
                                        {component.quotePending ? (
                                            <td colSpan="3">Pendiente de cotización</td>
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

                    <div className="alert alert-warning small">
                        El monto fijo se aplica a cada obligación de la misma moneda. Los importes nunca pueden quedar por debajo de cero.
                    </div>
                    <div className="d-flex flex-wrap justify-content-end gap-2">
                        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={Boolean(operation)}>
                            {operation ? "Generando cargos…" : "Aprobar y generar cargos"}
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
};

export default BillingContractApprovalForm;
