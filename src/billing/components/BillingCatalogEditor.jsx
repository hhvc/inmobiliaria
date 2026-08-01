import { useMemo, useState } from "react";

import {
    seedInitialBillingCatalog,
    upsertBillingCatalogItem,
} from "../services/billing.service";
import {
    BILLING_RECURRENCE_OPTIONS,
    buildEmptyCatalogItem,
    catalogFormToPayload,
    catalogItemToForm,
    getCatalogPricingSummary,
} from "../utils/billing.helpers";

const textToLines = (value = "") => value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

const listToText = (value = []) => (Array.isArray(value) ? value.join("\n") : "");

const normalizeBenefitForm = (benefits = []) => {
    const benefit = benefits.find((item) => item.type === "highlight_credits");
    return {
        enabled: Boolean(benefit),
        id: benefit?.id || "creditos-destacados",
        label: benefit?.label || "Créditos de 24 horas para destacar avisos",
        quantity: benefit?.quantity ?? 1,
        grantMode: benefit?.grantMode || "per_quantity",
        recurrence: benefit?.recurrence || "monthly",
        rollover: benefit?.rollover === true,
    };
};

const CatalogSummaryCard = ({ item, onEdit }) => (
    <article className="col-md-6 col-xl-4">
        <div className={`card h-100 ${item.active === false ? "bg-light" : ""}`}>
            <div className="card-body d-flex flex-column">
                <div className="d-flex justify-content-between gap-2">
                    <h3 className="h6 mb-1">{item.name}</h3>
                    <span className={`badge ${item.active === false ? "text-bg-secondary" : "text-bg-success"}`}>
                        {item.active === false ? "Oculto" : "Publicado"}
                    </span>
                </div>
                <div className="small text-muted mb-2">{item.code}</div>
                <p className="small flex-grow-1">{item.description || "Sin descripción."}</p>
                <ul className="small ps-3">
                    {getCatalogPricingSummary(item).map((line) => (
                        <li key={line}>{line}</li>
                    ))}
                </ul>
                <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => onEdit(item)}
                >
                    Editar
                </button>
            </div>
        </div>
    </article>
);

const BillingCatalogEditor = ({ catalog = [], onChanged }) => {
    const [editingId, setEditingId] = useState("");
    const [form, setForm] = useState(buildEmptyCatalogItem());
    const [benefit, setBenefit] = useState(normalizeBenefitForm());
    const [inclusionsText, setInclusionsText] = useState("");
    const [modulesText, setModulesText] = useState("");
    const [operation, setOperation] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const catalogOptions = useMemo(() => catalog.filter(
        (item) => item.id !== editingId,
    ), [catalog, editingId]);

    const resetForm = () => {
        setEditingId("");
        setForm(buildEmptyCatalogItem());
        setBenefit(normalizeBenefitForm());
        setInclusionsText("");
        setModulesText("");
    };

    const editItem = (item) => {
        const next = catalogItemToForm(item);
        setEditingId(item.id);
        setForm(next);
        setBenefit(normalizeBenefitForm(item.benefits));
        setInclusionsText(listToText(item.inclusions));
        setModulesText(listToText(item.moduleGrants));
        setError("");
        setSuccess("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const updatePricing = (index, field, value) => {
        setForm((current) => ({
            ...current,
            pricing: current.pricing.map((component, position) => (
                position === index ? { ...component, [field]: value } : component
            )),
        }));
    };

    const addPricing = () => {
        setForm((current) => ({
            ...current,
            pricing: [
                ...current.pricing,
                {
                    id: `precio-${Date.now().toString(36)}`,
                    label: "Nuevo cargo",
                    recurrence: "monthly",
                    countryCode: "AR",
                    currency: "ARS",
                    quoteRequired: false,
                    amountMajor: "",
                },
            ],
        }));
    };

    const removePricing = (index) => {
        setForm((current) => ({
            ...current,
            pricing: current.pricing.filter((_, position) => position !== index),
        }));
    };

    const addRequirement = () => {
        setForm((current) => ({
            ...current,
            requirements: [
                ...current.requirements,
                { type: "external", label: "", catalogItemId: "" },
            ],
        }));
    };

    const updateRequirement = (index, field, value) => {
        setForm((current) => ({
            ...current,
            requirements: current.requirements.map((requirement, position) => (
                position === index ? { ...requirement, [field]: value } : requirement
            )),
        }));
    };

    const removeRequirement = (index) => {
        setForm((current) => ({
            ...current,
            requirements: current.requirements.filter((_, position) => position !== index),
        }));
    };

    const handleSeed = async () => {
        try {
            setOperation("seed");
            setError("");
            setSuccess("");
            const result = await seedInitialBillingCatalog();
            setSuccess(result.created
                ? `Se agregaron ${result.created} ítems iniciales.`
                : "El catálogo inicial ya estaba creado.");
            await onChanged?.();
        } catch (seedError) {
            setError(seedError.message || "No se pudo crear el catálogo inicial.");
        } finally {
            setOperation("");
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!form.name.trim() || !form.code.trim()) {
            setError("Completá el nombre y el código.");
            return;
        }
        if (!form.pricing.length) {
            setError("Agregá al menos un componente de precio.");
            return;
        }

        const benefits = benefit.enabled ? [{
            id: benefit.id,
            type: "highlight_credits",
            label: benefit.label,
            quantity: Number(benefit.quantity || 0),
            grantMode: benefit.grantMode,
            recurrence: benefit.grantMode === "recurring"
                ? benefit.recurrence
                : "once",
            rollover: benefit.rollover,
        }] : [];
        const payload = catalogFormToPayload({
            ...form,
            inclusions: textToLines(inclusionsText),
            moduleGrants: textToLines(modulesText.replace(/,/g, "\n")),
            benefits,
        });

        try {
            setOperation("save");
            setError("");
            setSuccess("");
            await upsertBillingCatalogItem({ itemId: editingId, item: payload });
            setSuccess(editingId ? "Ítem actualizado." : "Ítem creado.");
            resetForm();
            await onChanged?.();
        } catch (saveError) {
            setError(saveError.message || "No se pudo guardar el ítem.");
        } finally {
            setOperation("");
        }
    };

    return (
        <section>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div>
                    <h2 className="h4 mb-1">Catálogo comercial</h2>
                    <p className="text-muted mb-0">
                        Productos, servicios, abonos, monedas y beneficios contratables.
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={handleSeed}
                    disabled={Boolean(operation)}
                >
                    Cargar ejemplos iniciales
                </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <form className="card border-0 shadow-sm mb-4" onSubmit={handleSubmit}>
                <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h3 className="h5 mb-0">
                            {editingId ? "Editar ítem" : "Nuevo ítem"}
                        </h3>
                        {editingId && (
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={resetForm}
                            >
                                Cancelar edición
                            </button>
                        )}
                    </div>

                    <div className="row g-3">
                        <div className="col-md-6">
                            <label className="form-label">Nombre</label>
                            <input
                                className="form-control"
                                value={form.name}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    name: event.target.value,
                                }))}
                                required
                            />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Código estable</label>
                            <input
                                className="form-control"
                                value={form.code}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    code: event.target.value,
                                }))}
                                disabled={Boolean(editingId)}
                                placeholder="dominio-propio"
                                required
                            />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Orden</label>
                            <input
                                className="form-control"
                                type="number"
                                value={form.displayOrder}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    displayOrder: event.target.value,
                                }))}
                            />
                        </div>
                        <div className="col-12">
                            <label className="form-label">Descripción</label>
                            <textarea
                                className="form-control"
                                rows="3"
                                value={form.description}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    description: event.target.value,
                                }))}
                            />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Tipo</label>
                            <select
                                className="form-select"
                                value={form.itemType}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    itemType: event.target.value,
                                }))}
                            >
                                <option value="service">Servicio</option>
                                <option value="product">Producto</option>
                            </select>
                        </div>
                        <div className="col-md-3 d-flex align-items-end">
                            <div className="form-check mb-2">
                                <input
                                    id="catalog-active"
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={form.active}
                                    onChange={(event) => setForm((current) => ({
                                        ...current,
                                        active: event.target.checked,
                                    }))}
                                />
                                <label className="form-check-label" htmlFor="catalog-active">
                                    Visible y contratable
                                </label>
                            </div>
                        </div>
                        <div className="col-md-3 d-flex align-items-end">
                            <div className="form-check mb-2">
                                <input
                                    id="catalog-quantity"
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={form.allowQuantity}
                                    onChange={(event) => setForm((current) => ({
                                        ...current,
                                        allowQuantity: event.target.checked,
                                    }))}
                                />
                                <label className="form-check-label" htmlFor="catalog-quantity">
                                    Permite elegir cantidad
                                </label>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Nombre de unidad</label>
                            <input
                                className="form-control"
                                value={form.unitLabel}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    unitLabel: event.target.value,
                                }))}
                            />
                        </div>

                        <div className="col-md-6">
                            <label className="form-label">Incluye (una línea por concepto)</label>
                            <textarea
                                className="form-control"
                                rows="4"
                                value={inclusionsText}
                                onChange={(event) => setInclusionsText(event.target.value)}
                            />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label">
                                Módulos habilitados (uno por línea)
                            </label>
                            <textarea
                                className="form-control"
                                rows="4"
                                value={modulesText}
                                onChange={(event) => setModulesText(event.target.value)}
                                placeholder="dominios&#10;branding&#10;instagram"
                            />
                            <div className="form-text">
                                Se agregan al contrato activo sin quitar módulos heredados.
                            </div>
                        </div>
                    </div>

                    <hr className="my-4" />
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h4 className="h6 mb-0">Componentes del precio</h4>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={addPricing}
                        >
                            Agregar precio
                        </button>
                    </div>
                    <div className="vstack gap-3">
                        {form.pricing.map((price, index) => (
                            <div className="border rounded p-3" key={`${price.id}-${index}`}>
                                <div className="row g-2 align-items-end">
                                    <div className="col-md-3">
                                        <label className="form-label small">Concepto</label>
                                        <input
                                            className="form-control"
                                            value={price.label}
                                            onChange={(event) => updatePricing(
                                                index,
                                                "label",
                                                event.target.value,
                                            )}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label small">Periodicidad</label>
                                        <select
                                            className="form-select"
                                            value={price.recurrence}
                                            onChange={(event) => updatePricing(
                                                index,
                                                "recurrence",
                                                event.target.value,
                                            )}
                                        >
                                            {BILLING_RECURRENCE_OPTIONS.map((option) => (
                                                <option value={option.value} key={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-1">
                                        <label className="form-label small">País</label>
                                        <input
                                            className="form-control text-uppercase"
                                            maxLength="2"
                                            value={price.countryCode}
                                            onChange={(event) => updatePricing(
                                                index,
                                                "countryCode",
                                                event.target.value.toUpperCase(),
                                            )}
                                        />
                                    </div>
                                    <div className="col-md-1">
                                        <label className="form-label small">Moneda</label>
                                        <input
                                            className="form-control text-uppercase"
                                            maxLength="3"
                                            value={price.currency}
                                            onChange={(event) => updatePricing(
                                                index,
                                                "currency",
                                                event.target.value.toUpperCase(),
                                            )}
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label small">Importe</label>
                                        <input
                                            className="form-control"
                                            inputMode="decimal"
                                            value={price.amountMajor}
                                            onChange={(event) => updatePricing(
                                                index,
                                                "amountMajor",
                                                event.target.value,
                                            )}
                                            disabled={price.quoteRequired}
                                            required={!price.quoteRequired}
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <div className="form-check mb-2">
                                            <input
                                                id={`quote-${index}`}
                                                className="form-check-input"
                                                type="checkbox"
                                                checked={price.quoteRequired}
                                                onChange={(event) => updatePricing(
                                                    index,
                                                    "quoteRequired",
                                                    event.target.checked,
                                                )}
                                            />
                                            <label
                                                className="form-check-label"
                                                htmlFor={`quote-${index}`}
                                            >
                                                A convenir
                                            </label>
                                        </div>
                                    </div>
                                    <div className="col-md-1 d-grid">
                                        <button
                                            type="button"
                                            className="btn btn-outline-danger"
                                            onClick={() => removePricing(index)}
                                            disabled={form.pricing.length === 1}
                                            aria-label="Quitar componente de precio"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <hr className="my-4" />
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h4 className="h6 mb-0">Requisitos</h4>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={addRequirement}
                        >
                            Agregar requisito
                        </button>
                    </div>
                    <div className="vstack gap-2">
                        {form.requirements.map((requirement, index) => (
                            <div className="row g-2" key={`requirement-${index}`}>
                                <div className="col-md-3">
                                    <select
                                        className="form-select"
                                        value={requirement.type}
                                        onChange={(event) => updateRequirement(
                                            index,
                                            "type",
                                            event.target.value,
                                        )}
                                    >
                                        <option value="external">Requisito externo</option>
                                        <option value="catalog_item">Otro ítem contratado</option>
                                    </select>
                                </div>
                                <div className="col-md-5">
                                    <input
                                        className="form-control"
                                        placeholder="Descripción del requisito"
                                        value={requirement.label}
                                        onChange={(event) => updateRequirement(
                                            index,
                                            "label",
                                            event.target.value,
                                        )}
                                    />
                                </div>
                                <div className="col-md-3">
                                    {requirement.type === "catalog_item" && (
                                        <select
                                            className="form-select"
                                            value={requirement.catalogItemId}
                                            onChange={(event) => updateRequirement(
                                                index,
                                                "catalogItemId",
                                                event.target.value,
                                            )}
                                        >
                                            <option value="">Elegir ítem</option>
                                            {catalogOptions.map((item) => (
                                                <option value={item.id} key={item.id}>
                                                    {item.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <div className="col-md-1 d-grid">
                                    <button
                                        type="button"
                                        className="btn btn-outline-danger"
                                        onClick={() => removeRequirement(index)}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        ))}
                        {!form.requirements.length && (
                            <div className="small text-muted">Sin requisitos configurados.</div>
                        )}
                    </div>

                    <hr className="my-4" />
                    <div className="form-check mb-3">
                        <input
                            id="highlight-benefit"
                            className="form-check-input"
                            type="checkbox"
                            checked={benefit.enabled}
                            onChange={(event) => setBenefit((current) => ({
                                ...current,
                                enabled: event.target.checked,
                            }))}
                        />
                        <label className="form-check-label" htmlFor="highlight-benefit">
                            Otorga créditos de destacados de 24 horas
                        </label>
                    </div>
                    {benefit.enabled && (
                        <div className="row g-3 border rounded p-3 mx-0">
                            <div className="col-md-4">
                                <label className="form-label">Descripción del beneficio</label>
                                <input
                                    className="form-control"
                                    value={benefit.label}
                                    onChange={(event) => setBenefit((current) => ({
                                        ...current,
                                        label: event.target.value,
                                    }))}
                                />
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Créditos</label>
                                <input
                                    className="form-control"
                                    type="number"
                                    min="1"
                                    value={benefit.quantity}
                                    onChange={(event) => setBenefit((current) => ({
                                        ...current,
                                        quantity: event.target.value,
                                    }))}
                                />
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Modalidad</label>
                                <select
                                    className="form-select"
                                    value={benefit.grantMode}
                                    onChange={(event) => setBenefit((current) => ({
                                        ...current,
                                        grantMode: event.target.value,
                                    }))}
                                >
                                    <option value="per_quantity">Por cantidad contratada</option>
                                    <option value="recurring">Renovación periódica</option>
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Renovación</label>
                                <select
                                    className="form-select"
                                    value={benefit.recurrence}
                                    disabled={benefit.grantMode !== "recurring"}
                                    onChange={(event) => setBenefit((current) => ({
                                        ...current,
                                        recurrence: event.target.value,
                                    }))}
                                >
                                    {BILLING_RECURRENCE_OPTIONS
                                        .filter((option) => option.value !== "once")
                                        .map((option) => (
                                            <option value={option.value} key={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="col-md-2 d-flex align-items-end">
                                <div className="form-check mb-2">
                                    <input
                                        id="benefit-rollover"
                                        className="form-check-input"
                                        type="checkbox"
                                        checked={benefit.rollover}
                                        disabled={benefit.grantMode !== "recurring"}
                                        onChange={(event) => setBenefit((current) => ({
                                            ...current,
                                            rollover: event.target.checked,
                                        }))}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="benefit-rollover"
                                    >
                                        Acumula saldo
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="d-flex justify-content-end mt-4">
                        <button
                            type="submit"
                            className="btn btn-primary px-4"
                            disabled={Boolean(operation)}
                        >
                            {operation === "save" ? "Guardando..." : "Guardar ítem"}
                        </button>
                    </div>
                </div>
            </form>

            <div className="row g-3">
                {catalog.map((item) => (
                    <CatalogSummaryCard item={item} onEdit={editItem} key={item.id} />
                ))}
                {!catalog.length && (
                    <div className="col-12">
                        <div className="alert alert-info mb-0">
                            El catálogo todavía está vacío. Podés cargar los ejemplos iniciales.
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default BillingCatalogEditor;
