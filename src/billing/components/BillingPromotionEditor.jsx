import { useState } from "react";

import { upsertBillingPromotion } from "../services/billing.service";
import {
    formatBillingPercent,
    formatMoneyMinor,
    majorAmountToMinor,
    minorAmountToMajorInput,
    percentToBasisPoints,
} from "../utils/billing.helpers";

const EMPTY_FORM = {
    code: "",
    description: "",
    active: true,
    percentage: "",
    fixedAmount: "",
    fixedCurrency: "ARS",
    validFrom: "",
    validUntil: "",
    catalogItemIds: [],
    maxRedemptions: "0",
    maxRedemptionsPerAgency: "1",
};

const BillingPromotionEditor = ({ promotions = [], catalog = [], onChanged }) => {
    const [editingId, setEditingId] = useState("");
    const [form, setForm] = useState(EMPTY_FORM);
    const [operation, setOperation] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const reset = () => {
        setEditingId("");
        setForm(EMPTY_FORM);
        setError("");
    };

    const edit = (promotion) => {
        setEditingId(promotion.id || promotion.code);
        setForm({
            code: promotion.code || promotion.id || "",
            description: promotion.description || "",
            active: promotion.active !== false,
            percentage: Number(promotion.percentageBasisPoints || 0) / 100 || "",
            fixedAmount: promotion.fixedAmountMinor
                ? minorAmountToMajorInput(promotion.fixedAmountMinor)
                : "",
            fixedCurrency: promotion.fixedCurrency || "ARS",
            validFrom: promotion.validFrom || "",
            validUntil: promotion.validUntil || "",
            catalogItemIds: promotion.catalogItemIds || [],
            maxRedemptions: String(promotion.maxRedemptions || 0),
            maxRedemptionsPerAgency: String(
                promotion.maxRedemptionsPerAgency ?? 1,
            ),
        });
        setError("");
        setSuccess("");
    };

    const submit = async (event) => {
        event.preventDefault();
        const percentageBasisPoints = percentToBasisPoints(form.percentage || 0);
        const fixedAmountMinor = majorAmountToMinor(form.fixedAmount || 0);
        const maxRedemptions = Math.trunc(Number(form.maxRedemptions || 0));
        const maxRedemptionsPerAgency = Math.trunc(Number(
            form.maxRedemptionsPerAgency || 0,
        ));
        if (
            !form.code.trim() ||
            percentageBasisPoints === null ||
            fixedAmountMinor === null ||
            (percentageBasisPoints <= 0 && fixedAmountMinor <= 0) ||
            !Number.isSafeInteger(maxRedemptions) ||
            maxRedemptions < 0 ||
            !Number.isSafeInteger(maxRedemptionsPerAgency) ||
            maxRedemptionsPerAgency < 0
        ) {
            setError("Completá el código, la bonificación y límites válidos.");
            return;
        }
        try {
            setOperation(true);
            setError("");
            setSuccess("");
            await upsertBillingPromotion({
                promotionId: editingId,
                promotion: {
                    code: form.code,
                    description: form.description,
                    active: form.active,
                    percentageBasisPoints,
                    fixedAmountMinor,
                    fixedCurrency: form.fixedCurrency,
                    validFrom: form.validFrom,
                    validUntil: form.validUntil,
                    catalogItemIds: form.catalogItemIds,
                    maxRedemptions,
                    maxRedemptionsPerAgency,
                },
            });
            setSuccess(editingId ? "Promoción actualizada." : "Promoción creada.");
            reset();
            await onChanged?.();
        } catch (submitError) {
            setError(submitError.message || "No se pudo guardar la promoción.");
        } finally {
            setOperation(false);
        }
    };

    return (
        <section className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
                <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
                    <div>
                        <h2 className="h4 mb-1">Códigos de bonificación</h2>
                        <p className="text-muted mb-0">
                            Promociones canjeables al solicitar productos o servicios.
                        </p>
                    </div>
                    {editingId && (
                        <button type="button" className="btn btn-outline-secondary" onClick={reset}>
                            Nueva promoción
                        </button>
                    )}
                </div>

                {error && <div className="alert alert-danger">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                <form className="border rounded p-3 mb-4" onSubmit={submit}>
                    <div className="row g-3">
                        <div className="col-md-4">
                            <label className="form-label" htmlFor="promo-code">Código</label>
                            <input
                                id="promo-code"
                                className="form-control text-uppercase"
                                value={form.code}
                                disabled={Boolean(editingId)}
                                maxLength={40}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    code: event.target.value.toUpperCase(),
                                }))}
                                placeholder="LANZAMIENTO20"
                                required
                            />
                        </div>
                        <div className="col-md-8">
                            <label className="form-label" htmlFor="promo-description">Descripción interna</label>
                            <input
                                id="promo-description"
                                className="form-control"
                                value={form.description}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    description: event.target.value,
                                }))}
                            />
                        </div>
                        <div className="col-sm-6 col-lg-3">
                            <label className="form-label" htmlFor="promo-percentage">Bonificación %</label>
                            <input
                                id="promo-percentage"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                className="form-control"
                                value={form.percentage}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    percentage: event.target.value,
                                }))}
                            />
                        </div>
                        <div className="col-sm-6 col-lg-3">
                            <label className="form-label" htmlFor="promo-fixed">Monto fijo por obligación</label>
                            <input
                                id="promo-fixed"
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-control"
                                value={form.fixedAmount}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    fixedAmount: event.target.value,
                                }))}
                            />
                        </div>
                        <div className="col-sm-6 col-lg-2">
                            <label className="form-label" htmlFor="promo-currency">Moneda</label>
                            <input
                                id="promo-currency"
                                className="form-control text-uppercase"
                                maxLength={3}
                                value={form.fixedCurrency}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    fixedCurrency: event.target.value.toUpperCase(),
                                }))}
                            />
                        </div>
                        <div className="col-sm-6 col-lg-2">
                            <label className="form-label" htmlFor="promo-from">Válido desde</label>
                            <input
                                id="promo-from"
                                type="date"
                                className="form-control"
                                value={form.validFrom}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    validFrom: event.target.value,
                                }))}
                            />
                        </div>
                        <div className="col-sm-6 col-lg-2">
                            <label className="form-label" htmlFor="promo-until">Válido hasta</label>
                            <input
                                id="promo-until"
                                type="date"
                                className="form-control"
                                value={form.validUntil}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    validUntil: event.target.value,
                                }))}
                            />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label" htmlFor="promo-items">Servicios aplicables</label>
                            <select
                                id="promo-items"
                                multiple
                                className="form-select"
                                value={form.catalogItemIds}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    catalogItemIds: Array.from(
                                        event.target.selectedOptions,
                                        (option) => option.value,
                                    ),
                                }))}
                            >
                                {catalog.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                            <div className="form-text">Sin selección: válido para todo el catálogo.</div>
                        </div>
                        <div className="col-sm-6 col-md-3">
                            <label className="form-label" htmlFor="promo-max">Cupo total</label>
                            <input
                                id="promo-max"
                                type="number"
                                min="0"
                                className="form-control"
                                value={form.maxRedemptions}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    maxRedemptions: event.target.value,
                                }))}
                            />
                            <div className="form-text">0 significa ilimitado.</div>
                        </div>
                        <div className="col-sm-6 col-md-3">
                            <label className="form-label" htmlFor="promo-per-agency">Por inmobiliaria</label>
                            <input
                                id="promo-per-agency"
                                type="number"
                                min="0"
                                className="form-control"
                                value={form.maxRedemptionsPerAgency}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    maxRedemptionsPerAgency: event.target.value,
                                }))}
                            />
                            <div className="form-text">0 significa ilimitado.</div>
                        </div>
                        <div className="col-12 d-flex flex-wrap justify-content-between gap-3">
                            <div className="form-check">
                                <input
                                    id="promo-active"
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={form.active}
                                    onChange={(event) => setForm((current) => ({
                                        ...current,
                                        active: event.target.checked,
                                    }))}
                                />
                                <label className="form-check-label" htmlFor="promo-active">Código activo</label>
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={operation}>
                                {operation ? "Guardando…" : editingId ? "Guardar cambios" : "Crear código"}
                            </button>
                        </div>
                    </div>
                </form>

                <div className="table-responsive">
                    <table className="table align-middle mb-0">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Bonificación</th>
                                <th>Vigencia</th>
                                <th>Usos</th>
                                <th>Estado</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {promotions.map((promotion) => (
                                <tr key={promotion.id}>
                                    <td>
                                        <strong>{promotion.code}</strong>
                                        {promotion.description && (
                                            <div className="small text-muted">{promotion.description}</div>
                                        )}
                                    </td>
                                    <td>
                                        {promotion.percentageBasisPoints > 0 && (
                                            <span>{formatBillingPercent(promotion.percentageBasisPoints / 100)}%</span>
                                        )}
                                        {promotion.fixedAmountMinor > 0 && (
                                            <span>
                                                {promotion.percentageBasisPoints > 0 ? " + " : ""}
                                                {formatMoneyMinor(
                                                    promotion.fixedAmountMinor,
                                                    promotion.fixedCurrency,
                                                )}
                                            </span>
                                        )}
                                    </td>
                                    <td>{promotion.validFrom || "Sin inicio"} — {promotion.validUntil || "Sin fin"}</td>
                                    <td>
                                        {promotion.redeemedCount || 0} confirmados
                                        <div className="small text-muted">
                                            {promotion.reservedCount || 0} reservados
                                            {promotion.maxRedemptions > 0
                                                ? ` · cupo ${promotion.maxRedemptions}`
                                                : " · sin cupo máximo"}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${promotion.active ? "text-bg-success" : "text-bg-secondary"}`}>
                                            {promotion.active ? "Activo" : "Inactivo"}
                                        </span>
                                    </td>
                                    <td>
                                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => edit(promotion)}>
                                            Editar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!promotions.length && (
                                <tr><td colSpan="6" className="text-center text-muted py-4">Todavía no hay códigos.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
};

export default BillingPromotionEditor;
