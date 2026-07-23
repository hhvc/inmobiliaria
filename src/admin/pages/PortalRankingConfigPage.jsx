import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import {
    getPortalRankingConfig,
    savePortalRankingConfig,
} from "../../inmueble/services/portalRankingConfig.service";
import {
    DEFAULT_PORTAL_RANKING_CONFIG,
    mergePortalRankingConfig,
} from "../../inmueble/utils/portalRanking.helpers";

const getNestedValue = (obj, path, fallback = "") => {
    return path.split(".").reduce((acc, key) => {
        if (acc === null || acc === undefined) return fallback;
        return acc[key];
    }, obj) ?? fallback;
};

const setNestedValue = (obj, path, value) => {
    const keys = path.split(".");
    const next = { ...obj };
    let cursor = next;

    keys.forEach((key, index) => {
        const isLast = index === keys.length - 1;

        if (isLast) {
            cursor[key] = value;
            return;
        }

        cursor[key] = {
            ...(cursor[key] || {}),
        };

        cursor = cursor[key];
    });

    return next;
};

const toNumberOrZero = (value) => {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
};

const NumberField = ({
    label,
    help = "",
    value,
    onChange,
    min = 0,
    step = 1,
}) => {
    return (
        <div>
            <label className="form-label">{label}</label>

            <input
                type="number"
                className="form-control"
                value={value ?? ""}
                min={min}
                step={step}
                onChange={(e) => onChange(toNumberOrZero(e.target.value))}
            />

            {help && <div className="form-text">{help}</div>}
        </div>
    );
};

const SwitchField = ({ label, checked, onChange, help = "" }) => {
    return (
        <div className="form-check form-switch">
            <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                checked={Boolean(checked)}
                onChange={(e) => onChange(e.target.checked)}
            />

            <label className="form-check-label">{label}</label>

            {help && <div className="form-text">{help}</div>}
        </div>
    );
};

const PortalRankingConfigPage = () => {
    const [config, setConfig] = useState(DEFAULT_PORTAL_RANKING_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const qualityMaxScore = useMemo(() => {
        const quality = config.quality || {};

        if (quality.enabled === false) return 0;

        return [
            quality.photos?.enabled === false ? 0 : quality.photos?.maxScore,
            quality.video?.enabled === false ? 0 : quality.video?.maxScore,
            quality.price?.enabled === false ? 0 : quality.price?.maxScore,
            quality.location?.enabled === false ? 0 : quality.location?.maxScore,
            quality.features?.enabled === false ? 0 : quality.features?.maxScore,
            quality.description?.enabled === false
                ? 0
                : quality.description?.maxScore,
            quality.amenities?.enabled === false ? 0 : quality.amenities?.maxScore,
        ].reduce((acc, value) => acc + toNumberOrZero(value), 0);
    }, [config]);

    const handleChange = (path, value) => {
        setConfig((current) => {
            return setNestedValue(current, path, value);
        });

        setSuccess("");
        setError("");
    };

    const loadConfig = async () => {
        try {
            setLoading(true);
            setError("");
            setSuccess("");

            const data = await getPortalRankingConfig();

            setConfig(mergePortalRankingConfig(data));
        } catch (err) {
            console.error("Error cargando configuración de ranking:", err);
            setError(err.message || "No se pudo cargar la configuración.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const handleSave = async () => {
        try {
            setSaving(true);
            setError("");
            setSuccess("");

            const payload = mergePortalRankingConfig(config);

            await savePortalRankingConfig(payload);

            setConfig(payload);
            setSuccess("Configuración guardada correctamente.");
        } catch (err) {
            console.error("Error guardando configuración de ranking:", err);
            setError(
                err.message ||
                "No se pudo guardar la configuración. Verificá permisos root.",
            );
        } finally {
            setSaving(false);
        }
    };

    const handleResetDefaults = () => {
        const confirmed = window.confirm(
            "¿Querés volver los valores del formulario a la configuración por defecto? No se guarda hasta que presiones Guardar.",
        );

        if (!confirmed) return;

        setConfig(DEFAULT_PORTAL_RANKING_CONFIG);
        setSuccess("");
        setError("");
    };

    if (loading) {
        return (
            <main className="portal-home">
                <section className="portal-section">
                    <div className="container">
                        <div className="alert alert-light border">
                            Cargando configuración de relevancia...
                        </div>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="portal-home">
            <SEO
                title="Configuración de relevancia | ONO Prop"
                description="Panel root para configurar criterios de relevancia y calidad del portal ONO Prop."
                url={`${siteUrl}/admin/portal/ranking`}
                type="website"
                siteName="ONO Prop"
                noIndex
            />

            <section className="portal-section">
                <div className="container">
                    <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-4">
                        <div>
                            <p className="text-uppercase text-muted small mb-1">
                                Administración del portal
                            </p>

                            <h1 className="portal-section-title mb-2">
                                Configuración de relevancia
                            </h1>

                            <p className="lead text-muted mb-0">
                                Definí cómo se ordenan las publicaciones en el portal:
                                promociones pagas, prioridad de inmobiliarias, calidad de carga
                                y recencia.
                            </p>
                        </div>

                        <div className="d-flex flex-wrap gap-2 align-items-start">
                            <Link to="/admin" className="btn btn-outline-secondary">
                                Volver al admin
                            </Link>

                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                disabled={saving}
                                onClick={handleResetDefaults}
                            >
                                Restaurar defaults
                            </button>

                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={saving}
                                onClick={handleSave}
                            >
                                {saving ? "Guardando..." : "Guardar configuración"}
                            </button>
                        </div>
                    </div>

                    {error && <div className="alert alert-danger">{error}</div>}

                    {success && <div className="alert alert-success">{success}</div>}

                    <div className="alert alert-info">
                        Si el documento <code>portal_config/ranking</code> todavía no
                        existe, se crea automáticamente al guardar. Mientras no exista, el
                        portal usa la configuración por defecto.
                    </div>

                    <div className="row g-4">
                        <div className="col-lg-4">
                            <div className="card border-0 shadow-sm h-100">
                                <div className="card-body p-4">
                                    <h2 className="h5 mb-3">Resumen</h2>

                                    <div className="d-flex flex-column gap-3">
                                        <div className="border rounded-3 p-3">
                                            <div className="small text-muted">
                                                Prioridad premium
                                            </div>
                                            <div className="h5 mb-0">
                                                {getNestedValue(
                                                    config,
                                                    "paidPromotion.premium",
                                                    0,
                                                ).toLocaleString("es-AR")}
                                            </div>
                                        </div>

                                        <div className="border rounded-3 p-3">
                                            <div className="small text-muted">
                                                Prioridad inmobiliaria
                                            </div>
                                            <div className="h5 mb-0">
                                                {getNestedValue(
                                                    config,
                                                    "sourcePriority.inmobiliaria",
                                                    0,
                                                ).toLocaleString("es-AR")}
                                            </div>
                                        </div>

                                        <div className="border rounded-3 p-3">
                                            <div className="small text-muted">
                                                Prioridad particular
                                            </div>
                                            <div className="h5 mb-0">
                                                {getNestedValue(
                                                    config,
                                                    "sourcePriority.particular",
                                                    0,
                                                ).toLocaleString("es-AR")}
                                            </div>
                                        </div>

                                        <div className="border rounded-3 p-3">
                                            <div className="small text-muted">
                                                Puntaje máximo de calidad
                                            </div>
                                            <div className="h5 mb-0">
                                                {qualityMaxScore.toLocaleString("es-AR")}
                                            </div>
                                        </div>
                                    </div>

                                    <hr />

                                    <p className="small text-muted mb-0">
                                        Recomendación: mantené una diferencia fuerte entre
                                        promociones pagas y ranking orgánico para que el destaque
                                        tenga valor comercial real.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="col-lg-8">
                            <div className="d-flex flex-column gap-4">
                                <section className="card border-0 shadow-sm">
                                    <div className="card-body p-4">
                                        <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-4">
                                            <div>
                                                <h2 className="h4 mb-1">
                                                    Promociones pagas
                                                </h2>

                                                <p className="text-muted mb-0">
                                                    Pesos usados para destacar publicaciones por
                                                    plan pago o destaque manual heredado.
                                                </p>
                                            </div>

                                            <SwitchField
                                                label="Promociones activas"
                                                checked={getNestedValue(
                                                    config,
                                                    "paidPromotion.enabled",
                                                    true,
                                                )}
                                                onChange={(value) =>
                                                    handleChange(
                                                        "paidPromotion.enabled",
                                                        value,
                                                    )
                                                }
                                            />
                                        </div>

                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <NumberField
                                                    label="Plan premium"
                                                    value={getNestedValue(
                                                        config,
                                                        "paidPromotion.premium",
                                                        0,
                                                    )}
                                                    help="Máxima prioridad paga."
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "paidPromotion.premium",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <NumberField
                                                    label="Plan destacado"
                                                    value={getNestedValue(
                                                        config,
                                                        "paidPromotion.destacado",
                                                        0,
                                                    )}
                                                    help="Prioridad paga estándar."
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "paidPromotion.destacado",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <NumberField
                                                    label="Plan simple"
                                                    value={getNestedValue(
                                                        config,
                                                        "paidPromotion.simple",
                                                        0,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "paidPromotion.simple",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <NumberField
                                                    label="Destacado legacy"
                                                    value={getNestedValue(
                                                        config,
                                                        "paidPromotion.legacyDestacado",
                                                        0,
                                                    )}
                                                    help="Campo viejo destacado: true."
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "paidPromotion.legacyDestacado",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="card border-0 shadow-sm">
                                    <div className="card-body p-4">
                                        <h2 className="h4 mb-1">Prioridad por origen</h2>

                                        <p className="text-muted mb-4">
                                            Define la ventaja orgánica de inmobiliarias frente a
                                            particulares cuando no hay promoción paga.
                                        </p>

                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <NumberField
                                                    label="Inmobiliarias"
                                                    value={getNestedValue(
                                                        config,
                                                        "sourcePriority.inmobiliaria",
                                                        0,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "sourcePriority.inmobiliaria",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <NumberField
                                                    label="Particulares"
                                                    value={getNestedValue(
                                                        config,
                                                        "sourcePriority.particular",
                                                        0,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "sourcePriority.particular",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="card border-0 shadow-sm">
                                    <div className="card-body p-4">
                                        <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-4">
                                            <div>
                                                <h2 className="h4 mb-1">
                                                    Calidad de publicación
                                                </h2>

                                                <p className="text-muted mb-0">
                                                    Premia publicaciones completas: fotos, video,
                                                    precio, ubicación, características y descripción.
                                                </p>
                                            </div>

                                            <SwitchField
                                                label="Calidad activa"
                                                checked={getNestedValue(
                                                    config,
                                                    "quality.enabled",
                                                    true,
                                                )}
                                                onChange={(value) =>
                                                    handleChange("quality.enabled", value)
                                                }
                                            />
                                        </div>

                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <SwitchField
                                                    label="Puntuar fotos"
                                                    checked={getNestedValue(
                                                        config,
                                                        "quality.photos.enabled",
                                                        true,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.photos.enabled",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-3">
                                                <NumberField
                                                    label="Fotos ideales"
                                                    value={getNestedValue(
                                                        config,
                                                        "quality.photos.minCount",
                                                        8,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.photos.minCount",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-3">
                                                <NumberField
                                                    label="Puntos fotos"
                                                    value={getNestedValue(
                                                        config,
                                                        "quality.photos.maxScore",
                                                        0,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.photos.maxScore",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <SwitchField
                                                    label="Puntuar video"
                                                    checked={getNestedValue(
                                                        config,
                                                        "quality.video.enabled",
                                                        true,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.video.enabled",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <NumberField
                                                    label="Puntos video"
                                                    value={getNestedValue(
                                                        config,
                                                        "quality.video.maxScore",
                                                        0,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.video.maxScore",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <SwitchField
                                                    label="Puntuar precio"
                                                    checked={getNestedValue(
                                                        config,
                                                        "quality.price.enabled",
                                                        true,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.price.enabled",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <NumberField
                                                    label="Puntos precio"
                                                    value={getNestedValue(
                                                        config,
                                                        "quality.price.maxScore",
                                                        0,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.price.maxScore",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <SwitchField
                                                    label="Puntuar ubicación"
                                                    checked={getNestedValue(
                                                        config,
                                                        "quality.location.enabled",
                                                        true,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.location.enabled",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <NumberField
                                                    label="Puntos ubicación"
                                                    value={getNestedValue(
                                                        config,
                                                        "quality.location.maxScore",
                                                        0,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.location.maxScore",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <SwitchField
                                                    label="Puntuar características"
                                                    checked={getNestedValue(
                                                        config,
                                                        "quality.features.enabled",
                                                        true,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.features.enabled",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <NumberField
                                                    label="Puntos características"
                                                    value={getNestedValue(
                                                        config,
                                                        "quality.features.maxScore",
                                                        0,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.features.maxScore",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-4">
                                                <SwitchField
                                                    label="Puntuar descripción"
                                                    checked={getNestedValue(
                                                        config,
                                                        "quality.description.enabled",
                                                        true,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.description.enabled",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-4">
                                                <NumberField
                                                    label="Largo mínimo"
                                                    value={getNestedValue(
                                                        config,
                                                        "quality.description.minLength",
                                                        180,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.description.minLength",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-4">
                                                <NumberField
                                                    label="Puntos descripción"
                                                    value={getNestedValue(
                                                        config,
                                                        "quality.description.maxScore",
                                                        0,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.description.maxScore",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-4">
                                                <SwitchField
                                                    label="Puntuar amenities"
                                                    checked={getNestedValue(
                                                        config,
                                                        "quality.amenities.enabled",
                                                        true,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.amenities.enabled",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-4">
                                                <NumberField
                                                    label="Amenities ideales"
                                                    value={getNestedValue(
                                                        config,
                                                        "quality.amenities.minCount",
                                                        3,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.amenities.minCount",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-4">
                                                <NumberField
                                                    label="Puntos amenities"
                                                    value={getNestedValue(
                                                        config,
                                                        "quality.amenities.maxScore",
                                                        0,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "quality.amenities.maxScore",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="card border-0 shadow-sm">
                                    <div className="card-body p-4">
                                        <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-4">
                                            <div>
                                                <h2 className="h4 mb-1">
                                                    Recencia
                                                </h2>

                                                <p className="text-muted mb-0">
                                                    Premia publicaciones recientes o actualizadas
                                                    recientemente.
                                                </p>
                                            </div>

                                            <SwitchField
                                                label="Recencia activa"
                                                checked={getNestedValue(
                                                    config,
                                                    "recency.enabled",
                                                    true,
                                                )}
                                                onChange={(value) =>
                                                    handleChange("recency.enabled", value)
                                                }
                                            />
                                        </div>

                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <SwitchField
                                                    label="Puntuar actualización"
                                                    checked={getNestedValue(
                                                        config,
                                                        "recency.updatedAt.enabled",
                                                        true,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "recency.updatedAt.enabled",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-3">
                                                <NumberField
                                                    label="Puntos actualización"
                                                    value={getNestedValue(
                                                        config,
                                                        "recency.updatedAt.maxScore",
                                                        0,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "recency.updatedAt.maxScore",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-3">
                                                <NumberField
                                                    label="Ventana días"
                                                    value={getNestedValue(
                                                        config,
                                                        "recency.updatedAt.daysWindow",
                                                        90,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "recency.updatedAt.daysWindow",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <SwitchField
                                                    label="Puntuar publicación nueva"
                                                    checked={getNestedValue(
                                                        config,
                                                        "recency.createdAt.enabled",
                                                        true,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "recency.createdAt.enabled",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-3">
                                                <NumberField
                                                    label="Puntos publicación"
                                                    value={getNestedValue(
                                                        config,
                                                        "recency.createdAt.maxScore",
                                                        0,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "recency.createdAt.maxScore",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>

                                            <div className="col-md-3">
                                                <NumberField
                                                    label="Ventana días"
                                                    value={getNestedValue(
                                                        config,
                                                        "recency.createdAt.daysWindow",
                                                        120,
                                                    )}
                                                    onChange={(value) =>
                                                        handleChange(
                                                            "recency.createdAt.daysWindow",
                                                            value,
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <div className="d-flex justify-content-end gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        disabled={saving}
                                        onClick={handleResetDefaults}
                                    >
                                        Restaurar defaults
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        disabled={saving}
                                        onClick={handleSave}
                                    >
                                        {saving ? "Guardando..." : "Guardar configuración"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default PortalRankingConfigPage;