import { useState } from "react";
import { Link } from "react-router-dom";

import { formatMoneyMinor, getRecurrenceLabel } from "../utils/billing.helpers";

const BillingContractRequestForm = ({ item, operation, onSubmit, onCancel }) => {
    const [form, setForm] = useState({
        quantity: "1",
        promotionCode: "",
        note: "",
        termsAccepted: false,
    });
    const [error, setError] = useState("");

    const submit = (event) => {
        event.preventDefault();
        const quantity = item.allowQuantity ? Math.trunc(Number(form.quantity)) : 1;
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) {
            setError("La cantidad debe estar entre 1 y 1000.");
            return;
        }
        if (!form.termsAccepted) {
            setError("Debés aceptar las condiciones de contratación.");
            return;
        }
        setError("");
        onSubmit({
            catalogItemId: item.id,
            countryCode: "AR",
            quantity,
            promotionCode: form.promotionCode.trim().toUpperCase(),
            note: form.note,
            termsAccepted: true,
        });
    };

    return (
        <section className="card border-primary shadow-sm mb-4" id="contract-request-form">
            <div className="card-body p-4">
                <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                    <div>
                        <p className="text-primary text-uppercase small mb-1">Nueva contratación</p>
                        <h2 className="h4 mb-1">{item.name}</h2>
                        <p className="text-muted mb-0">{item.description}</p>
                    </div>
                    <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCancel} />
                </div>
                {error && <div className="alert alert-danger">{error}</div>}

                <div className="border rounded p-3 mb-3">
                    <h3 className="h6">Precio publicado</h3>
                    <ul className="mb-0 ps-3">
                        {(item.pricing || []).map((component) => (
                            <li key={component.id}>
                                {component.label}: {component.quoteRequired
                                    ? "A convenir"
                                    : formatMoneyMinor(component.amountMinor, component.currency)}
                                {` · ${getRecurrenceLabel(component.recurrence)}`}
                            </li>
                        ))}
                    </ul>
                </div>

                <form onSubmit={submit}>
                    <div className="row g-3">
                        {item.allowQuantity && (
                            <div className="col-md-4">
                                <label className="form-label" htmlFor="request-quantity">
                                    Cantidad de {item.unitLabel || "unidades"}
                                </label>
                                <input
                                    id="request-quantity"
                                    type="number"
                                    min="1"
                                    max="1000"
                                    className="form-control"
                                    value={form.quantity}
                                    onChange={(event) => setForm((current) => ({
                                        ...current,
                                        quantity: event.target.value,
                                    }))}
                                    required
                                />
                            </div>
                        )}
                        <div className="col-md-4">
                            <label className="form-label" htmlFor="request-promotion">Código de bonificación</label>
                            <input
                                id="request-promotion"
                                className="form-control text-uppercase"
                                maxLength={40}
                                value={form.promotionCode}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    promotionCode: event.target.value.toUpperCase(),
                                }))}
                                placeholder="Opcional"
                            />
                            <div className="form-text">
                                Se validará al enviar y quedará reservado para esta solicitud.
                            </div>
                        </div>
                        <div className="col-md-8">
                            <label className="form-label" htmlFor="request-note">Comentario</label>
                            <textarea
                                id="request-note"
                                className="form-control"
                                rows="2"
                                value={form.note}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    note: event.target.value,
                                }))}
                                placeholder="Opcional"
                            />
                        </div>
                        <div className="col-12">
                            <div className="form-check">
                                <input
                                    id="request-terms"
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={form.termsAccepted}
                                    onChange={(event) => setForm((current) => ({
                                        ...current,
                                        termsAccepted: event.target.checked,
                                    }))}
                                />
                                <label className="form-check-label" htmlFor="request-terms">
                                    Acepto los <Link to="/terminos" target="_blank">términos vigentes</Link>.
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="d-flex flex-wrap justify-content-end gap-2 mt-4">
                        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={Boolean(operation)}>
                            {operation
                                ? "Enviando…"
                                : item.pricing?.some((component) => component.quoteRequired)
                                    ? "Solicitar cotización"
                                    : "Solicitar contratación"}
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
};

export default BillingContractRequestForm;
