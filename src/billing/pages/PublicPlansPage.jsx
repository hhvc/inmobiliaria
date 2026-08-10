import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import {
    createCommercialLead,
    getPublicBillingCatalog,
} from "../services/billing.service";
import { getCatalogPricingSummary } from "../utils/billing.helpers";
import {
    buildCommercialSource,
    COMMERCIAL_PROPERTY_VOLUME_OPTIONS,
} from "../utils/commercial.helpers";

const INITIAL_FORM = {
    agencyName: "",
    contactName: "",
    email: "",
    phone: "",
    city: "",
    countryCode: "AR",
    propertyVolume: "1-20",
    preferredContact: "whatsapp",
    interestIds: [],
    primaryCatalogItemId: "",
    promotionCode: "",
    message: "",
    website: "",
    consentAccepted: false,
};

const MODULE_LABELS = {
    alquileres: "Administración de alquileres",
    consorcios: "Administración de consorcios",
    branding: "Personalización",
    consultas: "Consultas",
    dominios: "Dominio propio",
    inmuebles: "Publicación de inmuebles",
    instagram: "Instagram",
    mercadolibre: "Mercado Libre",
    parcelas: "Parcelas y normativa",
    tasaciones: "Tasaciones",
    tributos: "Control tributario",
    usuarios: "Usuarios internos",
};

const PublicPlansPage = () => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const formRef = useRef(null);
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sending, setSending] = useState(false);
    const [successId, setSuccessId] = useState("");
    const [startedAtMs, setStartedAtMs] = useState(Date.now());
    const [form, setForm] = useState(() => ({
        ...INITIAL_FORM,
        contactName: user?.displayName || "",
        email: user?.email || "",
    }));
    const hasAgency = Array.isArray(user?.inmobiliarias) &&
        user.inmobiliarias.length > 0;

    useEffect(() => {
        let active = true;
        getPublicBillingCatalog()
            .then((result) => {
                if (!active) return;
                const items = Array.isArray(result?.catalog) ? result.catalog : [];
                setCatalog(items);
                const requestedId = new URLSearchParams(location.search).get("servicio");
                if (requestedId && items.some((item) => item.id === requestedId)) {
                    setForm((current) => ({
                        ...current,
                        interestIds: [requestedId],
                        primaryCatalogItemId: requestedId,
                    }));
                }
            })
            .catch((loadError) => {
                if (active) {
                    setError(loadError.message || "No se pudieron cargar los planes.");
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [location.search]);

    useEffect(() => {
        if (!user) return;
        setForm((current) => ({
            ...current,
            contactName: current.contactName || user.displayName || "",
            email: current.email || user.email || "",
        }));
    }, [user]);

    const selectedItem = useMemo(() => catalog.find(
        (item) => item.id === form.primaryCatalogItemId,
    ) || null, [catalog, form.primaryCatalogItemId]);

    const jsonLd = useMemo(() => ({
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Planes y servicios de ONO Prop",
        itemListElement: catalog.map((item, index) => ({
            "@type": "Offer",
            position: index + 1,
            name: item.name,
            description: item.description,
            url: `https://onoprop.com/planes?servicio=${encodeURIComponent(item.id)}`,
        })),
    }), [catalog]);

    const scrollToForm = () => {
        window.setTimeout(() => formRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        }), 0);
    };

    const selectItem = (item) => {
        if (hasAgency) {
            navigate(`/admin/inmobiliaria/cuenta-corriente?contratar=${encodeURIComponent(item.id)}`);
            return;
        }
        setSuccessId("");
        setError("");
        setStartedAtMs(Date.now());
        setForm((current) => ({
            ...current,
            interestIds: current.interestIds.includes(item.id)
                ? current.interestIds
                : [...current.interestIds, item.id],
            primaryCatalogItemId: item.id,
        }));
        scrollToForm();
    };

    const requestDemo = () => {
        setSuccessId("");
        setError("");
        setStartedAtMs(Date.now());
        setForm((current) => ({ ...current, primaryCatalogItemId: "" }));
        scrollToForm();
    };

    const toggleInterest = (itemId) => {
        setForm((current) => ({
            ...current,
            interestIds: current.interestIds.includes(itemId)
                ? current.interestIds.filter((id) => id !== itemId)
                : [...current.interestIds, itemId],
        }));
    };

    const submitLead = async (event) => {
        event.preventDefault();
        try {
            setSending(true);
            setError("");
            const result = await createCommercialLead({
                ...form,
                startedAtMs,
                source: buildCommercialSource({
                    href: window.location.href,
                    pathname: location.pathname,
                    search: location.search,
                    referrer: document.referrer,
                }),
            });
            setSuccessId(result?.leadId || "recibida");
            setForm((current) => ({
                ...INITIAL_FORM,
                contactName: user?.displayName || current.contactName,
                email: user?.email || current.email,
            }));
            setStartedAtMs(Date.now());
        } catch (submitError) {
            setError(submitError.message || "No se pudo enviar la solicitud.");
        } finally {
            setSending(false);
        }
    };

    return (
        <main className="plans-page">
            <SEO
                title="Planes para inmobiliarias | ONO Prop"
                description="Elegí herramientas para publicar inmuebles, gestionar tasaciones, alquileres, parcelas, dominios e integraciones desde ONO Prop."
                url={`${window.location.origin}/planes`}
                jsonLd={jsonLd}
            />

            <section className="plans-hero">
                <div className="container py-5">
                    <div className="row align-items-center g-4 py-lg-4">
                        <div className="col-lg-7">
                            <p className="plans-eyebrow">Servicios para inmobiliarias</p>
                            <h1 className="display-4 fw-bold mb-3">
                                Empezá con lo que necesitás. Sumá herramientas al crecer.
                            </h1>
                            <p className="lead mb-4">
                                ONO Prop combina portal, gestión, difusión y servicios profesionales
                                sin franquicias ni paquetes rígidos.
                            </p>
                            <div className="d-flex flex-wrap gap-2">
                                <button className="btn btn-light btn-lg" type="button" onClick={requestDemo}>
                                    Pedir una demostración
                                </button>
                                <Link className="btn btn-outline-light btn-lg" to="/inmobiliarias/alta">
                                    Crear mi inmobiliaria
                                </Link>
                            </div>
                        </div>
                        <div className="col-lg-5">
                            <div className="plans-hero-card">
                                <span>Modelo flexible</span>
                                <strong>Configuración inicial + abonos claros</strong>
                                <p className="mb-0">
                                    Los importes a convenir se cotizan antes de generar cualquier cargo.
                                    Podés aplicar promociones y bonificaciones acordadas.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="container py-5" id="catalogo-planes">
                <div className="text-center mx-auto plans-section-heading mb-5">
                    <p className="text-uppercase text-primary fw-semibold small mb-2">Catálogo dinámico</p>
                    <h2 className="display-6 fw-bold">Productos y servicios disponibles</h2>
                    <p className="text-muted mb-0">
                        Los precios publicados provienen del catálogo comercial vigente de ONO Prop.
                    </p>
                </div>

                {loading && <div className="text-center py-5">Cargando planes...</div>}
                {!loading && error && !catalog.length && (
                    <div className="alert alert-danger">{error}</div>
                )}
                {!loading && !error && !catalog.length && (
                    <div className="alert alert-light border text-center">
                        Estamos actualizando el catálogo. Podés pedir una demostración igualmente.
                    </div>
                )}

                <div className="row g-4 align-items-stretch">
                    {catalog.map((item) => (
                        <article className="col-md-6 col-xl-4" key={item.id}>
                            <div className={`plan-card h-100 ${item.featured ? "plan-card--featured" : ""}`}>
                                {item.featured && <div className="plan-card-ribbon">Recomendado</div>}
                                <div className="d-flex justify-content-between gap-2 align-items-start mb-3">
                                    <h3 className="h4 mb-0">{item.name}</h3>
                                    <span className="badge rounded-pill text-bg-light border">
                                        {item.itemType === "product" ? "Producto" : "Servicio"}
                                    </span>
                                </div>
                                <p className="text-muted">{item.description}</p>
                                <div className="plan-pricing mb-3">
                                    {getCatalogPricingSummary(item).map((line) => (
                                        <div key={line}>{line}</div>
                                    ))}
                                </div>
                                {item.inclusions?.length > 0 && (
                                    <ul className="plan-inclusions">
                                        {item.inclusions.map((entry) => <li key={entry}>{entry}</li>)}
                                    </ul>
                                )}
                                {item.moduleGrants?.length > 0 && (
                                    <div className="d-flex flex-wrap gap-1 mb-3">
                                        {item.moduleGrants.map((moduleId) => (
                                            <span className="badge text-bg-primary-subtle text-primary-emphasis" key={moduleId}>
                                                {MODULE_LABELS[moduleId] || moduleId}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {item.requirements?.length > 0 && (
                                    <p className="small text-muted">
                                        <strong>Requiere:</strong>{" "}
                                        {item.requirements.map((entry) => entry.label).join(" · ")}
                                    </p>
                                )}
                                <div className="mt-auto d-grid">
                                    <button className="btn btn-primary" type="button" onClick={() => selectItem(item)}>
                                        {hasAgency ? "Contratar desde mi cuenta" : "Solicitar contratación"}
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section className="plans-contact-section py-5" ref={formRef}>
                <div className="container py-lg-4">
                    <div className="row g-4 align-items-start">
                        <div className="col-lg-5">
                            <p className="plans-eyebrow text-primary">Contacto comercial</p>
                            <h2 className="display-6 fw-bold">
                                {selectedItem ? `Consultá por ${selectedItem.name}` : "Armemos el plan adecuado"}
                            </h2>
                            <p className="lead text-muted">
                                Contanos cómo trabaja tu inmobiliaria. Vamos a responderte con una
                                demostración o una propuesta concreta, sin generar cargos automáticos.
                            </p>
                            {hasAgency && (
                                <div className="alert alert-primary">
                                    Ya tenés una inmobiliaria vinculada. Podés contratar directamente
                                    desde tu <Link to="/admin/inmobiliaria/cuenta-corriente">cuenta corriente</Link>.
                                </div>
                            )}
                        </div>
                        <div className="col-lg-7">
                            <div className="card border-0 shadow-sm">
                                <div className="card-body p-4 p-lg-5">
                                    {successId ? (
                                        <div className="text-center py-4">
                                            <div className="plans-success-mark" aria-hidden="true">✓</div>
                                            <h3 className="h4">Solicitud recibida</h3>
                                            <p className="text-muted">
                                                Te contactaremos para conocer tu operación y confirmar condiciones.
                                            </p>
                                            <p className="small mb-0">Referencia: {successId}</p>
                                        </div>
                                    ) : (
                                        <form className="row g-3" onSubmit={submitLead}>
                                            <div className="col-md-6">
                                                <label className="form-label" htmlFor="planAgency">Inmobiliaria</label>
                                                <input id="planAgency" className="form-control" value={form.agencyName} onChange={(event) => setForm({ ...form, agencyName: event.target.value })} required />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label" htmlFor="planContact">Persona de contacto</label>
                                                <input id="planContact" className="form-control" autoComplete="name" value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} required />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label" htmlFor="planEmail">Email</label>
                                                <input id="planEmail" className="form-control" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label" htmlFor="planPhone">Teléfono / WhatsApp</label>
                                                <input id="planPhone" className="form-control" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label" htmlFor="planCity">Ciudad</label>
                                                <input id="planCity" className="form-control" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label" htmlFor="planVolume">Propiedades administradas</label>
                                                <select id="planVolume" className="form-select" value={form.propertyVolume} onChange={(event) => setForm({ ...form, propertyVolume: event.target.value })}>
                                                    {COMMERCIAL_PROPERTY_VOLUME_OPTIONS.map((option) => (
                                                        <option value={option.value} key={option.value}>{option.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <fieldset className="col-12">
                                                <legend className="form-label">Servicios de interés</legend>
                                                <div className="row g-2">
                                                    {catalog.map((item) => (
                                                        <div className="col-md-6" key={item.id}>
                                                            <label className="plans-interest-option">
                                                                <input type="checkbox" checked={form.interestIds.includes(item.id)} onChange={() => toggleInterest(item.id)} />
                                                                <span>{item.name}</span>
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </fieldset>
                                            <div className="col-md-6">
                                                <label className="form-label" htmlFor="planPreferred">Contacto preferido</label>
                                                <select id="planPreferred" className="form-select" value={form.preferredContact} onChange={(event) => setForm({ ...form, preferredContact: event.target.value })}>
                                                    <option value="whatsapp">WhatsApp</option>
                                                    <option value="email">Email</option>
                                                    <option value="phone">Llamada</option>
                                                </select>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label" htmlFor="planPromo">Código promocional</label>
                                                <input id="planPromo" className="form-control text-uppercase" value={form.promotionCode} onChange={(event) => setForm({ ...form, promotionCode: event.target.value })} />
                                            </div>
                                            <div className="col-12">
                                                <label className="form-label" htmlFor="planMessage">Qué necesitás resolver</label>
                                                <textarea id="planMessage" className="form-control" rows="4" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
                                            </div>
                                            <div className="visually-hidden" aria-hidden="true">
                                                <label htmlFor="planWebsite">Sitio web</label>
                                                <input id="planWebsite" tabIndex="-1" autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
                                            </div>
                                            <div className="col-12">
                                                <div className="form-check">
                                                    <input id="planConsent" className="form-check-input" type="checkbox" checked={form.consentAccepted} onChange={(event) => setForm({ ...form, consentAccepted: event.target.checked })} required />
                                                    <label className="form-check-label small" htmlFor="planConsent">
                                                        Acepto que ONO Prop me contacte por esta solicitud y la{" "}
                                                        <Link to="/privacidad" target="_blank">Política de privacidad</Link>.
                                                    </label>
                                                </div>
                                            </div>
                                            {error && <div className="col-12"><div className="alert alert-danger mb-0">{error}</div></div>}
                                            <div className="col-12 d-grid d-md-flex justify-content-md-end">
                                                <button className="btn btn-primary btn-lg px-5" type="submit" disabled={sending}>
                                                    {sending ? "Enviando..." : "Enviar solicitud"}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default PublicPlansPage;
