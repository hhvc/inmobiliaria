import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../../context/auth/useAuth";
import {
    getInmuebleById,
    updateInmuebleDistributionChannel,
} from "../services/inmueble.service";
import {
    changeMercadoLibreItemStatus,
    disconnectMercadoLibre,
    getMercadoLibreCategoryDetails,
    getMercadoLibreConnectionStatus,
    getMercadoLibreDistribution,
    getMercadoLibreLocationOptions,
    publishMercadoLibreItem,
    saveMercadoLibreSettings,
    startMercadoLibreAuthorization,
    syncMercadoLibreItemStatus,
    updateMercadoLibreItem,
    validateMercadoLibreItem,
} from "../services/mercadoLibre.service";
import {
    disconnectInstagram,
    getInstagramConnectionStatus,
    getInstagramDistribution,
    publishInstagramAgencyMedia,
    startInstagramAuthorization,
    submitOnopropInstagramPublication,
    validateInstagramConnection,
} from "../services/instagram.service";
import {
    buildMercadoLibreLocationDefaults,
    buildMercadoLibreDraftPayload,
    findMercadoLibreOptionByName,
    validateMercadoLibreDraft,
} from "../utils/mercadoLibreDistribution.helpers";

const CHANNELS = [
    {
        id: "mercadolibre",
        label: "Mercado Libre",
        description: "Preparación para publicación vía API o carga asistida.",
    },
    {
        id: "zonaprop",
        label: "ZonaProp",
        description: "Preparación para feed, API o carga asistida según convenio.",
    },
    {
        id: "instagram",
        label: "Instagram",
        description: "Control de difusión en redes sociales.",
    },
];

const INSTAGRAM_OAUTH_CALLBACK_ORIGIN =
    "https://southamerica-east1-inmobiliaria-bcc63.cloudfunctions.net";

const STATUS_OPTIONS = [
    { value: "no_preparado", label: "No preparado" },
    { value: "listo", label: "Listo para publicar" },
    { value: "enviado", label: "Enviado" },
    { value: "publicado", label: "Publicado" },
    { value: "error", label: "Error" },
    { value: "pausado", label: "Pausado" },
    { value: "cerrado", label: "Cerrado" },
];

const getStatusBadgeClass = (status = "no_preparado") => {
    const classes = {
        no_preparado: "text-bg-secondary",
        listo: "text-bg-primary",
        enviado: "text-bg-info",
        publicado: "text-bg-success",
        error: "text-bg-danger",
        pausado: "text-bg-warning",
        cerrado: "text-bg-dark",
    };

    return `badge ${classes[status] || "text-bg-secondary"}`;
};

const getStatusLabel = (status = "no_preparado") => {
    return (
        STATUS_OPTIONS.find((item) => item.value === status)?.label ||
        "No preparado"
    );
};

const getInstagramPublicationStatusLabel = (status = "not_started") => {
    const labels = {
        not_started: "Sin enviar",
        pending: "Pendiente de aprobación",
        publishing: "Publicando",
        published: "Publicada",
        rejected: "Rechazada",
        error: "Con error",
    };

    return labels[status] || status;
};

const getInstagramPublicationBadgeClass = (status = "not_started") => {
    const classes = {
        not_started: "text-bg-secondary",
        pending: "text-bg-warning",
        publishing: "text-bg-info",
        published: "text-bg-success",
        rejected: "text-bg-dark",
        error: "text-bg-danger",
    };

    return `badge ${classes[status] || "text-bg-secondary"}`;
};

const formatInstagramVerificationDate = (value) => {
    const date = new Date(Number(value || 0));
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(date);
};

const getInstagramChannelStatus = (distribution = {}, fallback = "") => {
    const statuses = [
        distribution.agency?.status,
        distribution.onoprop?.status,
    ];

    if (statuses.includes("published")) return "publicado";
    if (statuses.includes("pending") || statuses.includes("publishing")) {
        return "enviado";
    }
    if (statuses.includes("error")) return "error";
    if (statuses.includes("rejected")) return "cerrado";

    return fallback || "no_preparado";
};

const normalizeText = (value = "") => {
    return value.toString().trim().replace(/\s+/g, " ");
};

const formatPrice = (inmueble = {}) => {
    if (!inmueble.precio) return "Consultar precio";

    const moneda = inmueble.moneda || "USD";
    const precio = Number(inmueble.precio);

    if (!Number.isFinite(precio)) {
        return `${moneda} ${inmueble.precio}`;
    }

    return `${moneda} ${precio.toLocaleString("es-AR")}`;
};

const getImageUrls = (inmueble = {}) => {
    if (!Array.isArray(inmueble.images)) return [];

    return [...inmueble.images]
        .filter((image) => image?.url)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((image) => image.url);
};

const getVideos = (inmueble = {}) => {
    if (!Array.isArray(inmueble.videos)) return [];

    return inmueble.videos
        .map((video) => video?.url || video)
        .filter(Boolean);
};

const getLocationParts = (inmueble = {}) => {
    const direccion = inmueble.direccion || {};

    return {
        provincia: inmueble.provincia || direccion.provincia || "",
        ciudad: inmueble.ciudad || direccion.ciudad || "",
        barrio: inmueble.barrio || direccion.barrio || "",
        calle: direccion.calle || inmueble.calle || "",
        numero: direccion.numero || inmueble.numero || "",
    };
};

const getLocationLabel = (inmueble = {}) => {
    const location = getLocationParts(inmueble);

    return [location.barrio, location.ciudad, location.provincia]
        .filter(Boolean)
        .join(", ");
};

const getFeatures = (inmueble = {}) => {
    const caracteristicas =
        inmueble.caracteristicas && typeof inmueble.caracteristicas === "object"
            ? inmueble.caracteristicas
            : {};

    const superficie =
        inmueble.superficie && typeof inmueble.superficie === "object"
            ? inmueble.superficie
            : {};

    return {
        dormitorios:
            caracteristicas.dormitorios || inmueble.dormitorios || "",
        banos:
            caracteristicas.banos || inmueble.banos || inmueble.banios || "",
        ambientes:
            caracteristicas.ambientes || inmueble.ambientes || "",
        cocheras:
            caracteristicas.cocherasCantidad || inmueble.cocheras || "",
        superficieCubierta:
            superficie.cubierta || inmueble.superficieCubierta || "",
        superficieTotal:
            superficie.total || inmueble.superficieTotal || "",
    };
};

const getPublicUrl = (inmueble = {}) => {
    if (typeof window === "undefined" || !inmueble.slug) return "";

    return `${window.location.origin}/inmueble/${inmueble.slug}`;
};

const buildMercadoLibreSettings = (form = {}, inmueble = {}) => {
    const location = getLocationParts(inmueble);

    return {
        categoryId: form.categoryId || "",
        listingTypeId: form.listingTypeId || "silver",
        publicUrl: getPublicUrl(inmueble),
        internalNote: form.note || "",
        location: {
            addressLine:
                form.addressLine ||
                [location.calle, location.numero].filter(Boolean).join(" "),
            zipCode: form.zipCode || "",
            stateId: form.stateId || "",
            cityId: form.cityId || "",
            neighborhoodId: form.neighborhoodId || "",
            latitude: form.latitude || "",
            longitude: form.longitude || "",
        },
        contact: {
            name: form.contactName || "",
            email: form.contactEmail || "",
            areaCode: form.areaCode || "",
            phone: form.contactPhone || "",
        },
        videoId: form.videoId || "",
    };
};

const loadMercadoLibreCategorySetup = async ({
    inmobiliariaId,
    categoryId = "",
}) => {
    try {
        return await getMercadoLibreCategoryDetails({
            inmobiliariaId,
            categoryId,
        });
    } catch (error) {
        if (!categoryId) throw error;

        return getMercadoLibreCategoryDetails({
            inmobiliariaId,
            categoryId: "",
        });
    }
};

const loadMercadoLibreLocationSetup = async ({
    inmobiliariaId,
    inmueble,
    form,
}) => {
    const location = getLocationParts(inmueble);
    const country = await getMercadoLibreLocationOptions({
        inmobiliariaId,
        level: "country",
        locationId: "AR",
    });
    const states = country.options || [];
    const suggestedState =
        findMercadoLibreOptionByName(states, location.provincia) ||
        findMercadoLibreOptionByName(states, location.ciudad);
    const stateId = form.stateId || suggestedState?.id || "";
    let cities = [];
    let neighborhoods = [];
    let cityId = form.cityId || "";
    let neighborhoodId = form.neighborhoodId || "";

    if (stateId) {
        const state = await getMercadoLibreLocationOptions({
            inmobiliariaId,
            level: "state",
            locationId: stateId,
        });
        cities = state.options || [];
        cityId =
            cityId ||
            findMercadoLibreOptionByName(cities, location.ciudad)?.id ||
            "";
    }

    if (cityId) {
        const city = await getMercadoLibreLocationOptions({
            inmobiliariaId,
            level: "city",
            locationId: cityId,
        });
        neighborhoods = city.options || [];
        neighborhoodId =
            neighborhoodId ||
            findMercadoLibreOptionByName(
                neighborhoods,
                location.barrio,
            )?.id ||
            "";
    }

    return {
        form: {
            ...form,
            stateId,
            cityId,
            neighborhoodId,
        },
        options: {
            states,
            cities,
            neighborhoods,
        },
    };
};

const loadMercadoLibreFormSetup = async ({
    inmobiliariaId,
    inmueble,
    form,
}) => {
    const [categoryResult, locationResult] = await Promise.allSettled([
        loadMercadoLibreCategorySetup({
            inmobiliariaId,
            categoryId: form.categoryId,
        }),
        loadMercadoLibreLocationSetup({
            inmobiliariaId,
            inmueble,
            form,
        }),
    ]);
    const errors = [];
    let nextForm = { ...form };
    let category = null;
    let locationOptions = {
        states: [],
        cities: [],
        neighborhoods: [],
    };

    if (categoryResult.status === "fulfilled") {
        category = categoryResult.value;
        nextForm.categoryId = category.isLeaf ? category.id : "";

        if (
            Array.isArray(category.listingTypes) &&
            !category.listingTypes.includes(nextForm.listingTypeId)
        ) {
            nextForm.listingTypeId = category.listingTypes[0] || "silver";
        }
    } else {
        errors.push(categoryResult.reason);
    }

    if (locationResult.status === "fulfilled") {
        nextForm = {
            ...nextForm,
            ...locationResult.value.form,
        };
        locationOptions = locationResult.value.options;
    } else {
        errors.push(locationResult.reason);
    }

    return {
        category,
        form: nextForm,
        locationOptions,
        errors,
    };
};

const waitForMercadoLibreOAuth = (popup) => {
    return new Promise((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
            window.removeEventListener("message", handleMessage);
            window.clearInterval(closeWatcher);
            window.clearTimeout(timeout);
        };

        const finish = (callback) => {
            if (settled) return;
            settled = true;
            cleanup();
            callback();
        };

        const handleMessage = (event) => {
            if (event.data?.type === "mercadolibre-oauth-success") {
                finish(resolve);
            }
        };

        const closeWatcher = window.setInterval(() => {
            if (popup.closed) finish(resolve);
        }, 700);

        const timeout = window.setTimeout(() => {
            finish(() => reject(new Error("La autorización tardó demasiado.")));
        }, 2 * 60 * 1000);

        window.addEventListener("message", handleMessage);
    });
};

const waitForInstagramOAuth = (popup, expectedTarget) => {
    return new Promise((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
            window.removeEventListener("message", handleMessage);
            window.clearInterval(closeWatcher);
            window.clearTimeout(timeout);
        };

        const finish = (callback) => {
            if (settled) return;
            settled = true;
            cleanup();
            callback();
        };

        const handleMessage = (event) => {
            if (
                event.source === popup &&
                event.origin === INSTAGRAM_OAUTH_CALLBACK_ORIGIN &&
                event.data?.type === "instagram-oauth-success" &&
                event.data?.target === expectedTarget
            ) {
                finish(resolve);
            }
        };

        const closeWatcher = window.setInterval(() => {
            if (popup.closed) finish(resolve);
        }, 700);

        const timeout = window.setTimeout(() => {
            finish(() => reject(new Error("La autorización tardó demasiado.")));
        }, 2 * 60 * 1000);

        window.addEventListener("message", handleMessage);
    });
};

const buildCommonPayload = (inmueble = {}) => {
    const location = getLocationParts(inmueble);
    const features = getFeatures(inmueble);
    const imageUrls = getImageUrls(inmueble);
    const videos = getVideos(inmueble);
    const publicUrl = getPublicUrl(inmueble);

    return {
        internalId: inmueble.id || "",
        title: normalizeText(inmueble.titulo || ""),
        operation: inmueble.operacion || "",
        propertyType: inmueble.tipo || "",
        currency: inmueble.moneda || "USD",
        price: inmueble.precio || "",
        formattedPrice: formatPrice(inmueble),
        location,
        locationLabel: getLocationLabel(inmueble),
        description: normalizeText(inmueble.descripcion || ""),
        features,
        images: imageUrls,
        videos,
        publicUrl,
    };
};

const validateChannel = (channelId, inmueble = {}, channelForm = {}) => {
    const payload = buildCommonPayload(inmueble);
    if (channelId === "mercadolibre") {
        return validateMercadoLibreDraft({
            inmueble,
            categoryId: channelForm.categoryId || "",
        });
    }
    const errors = [];
    const warnings = [];

    if (!payload.title || payload.title.length < 8) {
        errors.push("Falta un título suficientemente descriptivo.");
    }

    if (!payload.operation) {
        errors.push("Falta operación.");
    }

    if (!payload.propertyType) {
        errors.push("Falta tipo de inmueble.");
    }

    if (!payload.description || payload.description.length < 40) {
        errors.push("La descripción es demasiado corta.");
    }

    if (!payload.location.ciudad && !payload.location.barrio) {
        errors.push("Falta ubicación mínima.");
    }

    if (payload.images.length === 0) {
        errors.push("Debe tener al menos una imagen.");
    }

    if (!payload.price) {
        warnings.push("No tiene precio cargado.");
    }

    if (channelId === "mercadolibre") {
        if (payload.images.length < 3) {
            warnings.push("Para Mercado Libre conviene tener al menos 3 imágenes.");
        }

        if (!payload.location.provincia) {
            warnings.push("Para Mercado Libre puede hacer falta provincia.");
        }
    }

    if (channelId === "zonaprop") {
        if (payload.images.length < 5) {
            warnings.push("Para ZonaProp conviene tener al menos 5 imágenes.");
        }

        if (!payload.features.superficieTotal && !payload.features.superficieCubierta) {
            warnings.push("Conviene cargar superficie para portales inmobiliarios.");
        }
    }

    if (channelId === "instagram") {
        const selectedImageUrls = Array.isArray(channelForm.selectedImageUrls)
            ? channelForm.selectedImageUrls
            : payload.images.slice(0, 10);

        if (selectedImageUrls.length === 0) {
            errors.push("Instagram necesita una imagen principal.");
        }
        if (selectedImageUrls.length > 10) {
            errors.push("Instagram admite hasta 10 imágenes por publicación.");
        }

        if (!payload.publicUrl) {
            warnings.push("No hay link público para agregar al copy.");
        }
    }

    return {
        isReady: errors.length === 0,
        errors,
        warnings,
    };
};

const buildDefaultInstagramCaption = (common) => {
    return [
        `🏡 ${common.title}`,
        "",
        common.locationLabel ? `📍 ${common.locationLabel}` : "",
        `💰 ${common.formattedPrice}`,
        common.features.dormitorios
            ? `🛏️ ${common.features.dormitorios} dormitorio(s)`
            : "",
        common.features.banos ? `🛁 ${common.features.banos} baño(s)` : "",
        common.publicUrl ? `🔗 ${common.publicUrl}` : "",
        "",
        "#inmuebles #inmobiliaria #propiedades #realestate",
    ]
        .filter(Boolean)
        .join("\n");
};

const buildChannelPayload = (channelId, inmueble = {}, channelForm = {}) => {
    const common = buildCommonPayload(inmueble);

    if (channelId === "mercadolibre") {
        const settings = buildMercadoLibreSettings(channelForm, inmueble);
        return buildMercadoLibreDraftPayload({
            inmueble,
            categoryId: channelForm.categoryId || "",
            listingTypeId: channelForm.listingTypeId || "silver",
            publicUrl: common.publicUrl,
            mercadoLibreLocation: settings.location,
            mercadoLibreContact: settings.contact,
            videoId: settings.videoId,
        });
    }

    if (channelId === "instagram") {
        const selectedImageUrls = Array.isArray(channelForm.selectedImageUrls)
            ? channelForm.selectedImageUrls
            : common.images.slice(0, 10);

        return {
            caption:
                channelForm.caption ||
                buildDefaultInstagramCaption(common),
            imageUrl: selectedImageUrls[0] || "",
            imageUrls: selectedImageUrls,
            publicUrl: common.publicUrl,
        };
    }

    return {
        ...common,
        channel: channelId,
    };
};

const formatJson = (value) => {
    return JSON.stringify(value, null, 2);
};

const InmuebleDistributionPage = () => {
    const { id } = useParams();
    const { user, activeInmobiliariaId } = useAuth();
    const userRoles = Array.isArray(user?.roles) ? user.roles : [];
    const isRoot =
        user?.role === "root" ||
        user?.primaryRole === "root" ||
        userRoles.includes("root");

    const [inmueble, setInmueble] = useState(null);
    const [channelForms, setChannelForms] = useState({});
    const [savingChannelId, setSavingChannelId] = useState(null);
    const [copySuccess, setCopySuccess] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mercadoLibreConnection, setMercadoLibreConnection] = useState({
        connected: false,
        requiresReconnect: false,
    });
    const [mercadoLibrePublication, setMercadoLibrePublication] = useState(null);
    const [mercadoLibreCategory, setMercadoLibreCategory] = useState(null);
    const [mercadoLibreLocationOptions, setMercadoLibreLocationOptions] =
        useState({
            states: [],
            cities: [],
            neighborhoods: [],
        });
    const [mercadoLibreValidation, setMercadoLibreValidation] = useState(null);
    const [mercadoLibreError, setMercadoLibreError] = useState("");
    const [mercadoLibreOperation, setMercadoLibreOperation] = useState("");
    const [instagramConnections, setInstagramConnections] = useState({
        agency: { connected: false, requiresReconnect: false },
        onoprop: { connected: false, requiresReconnect: false },
        eligibility: {
            agency: false,
            onoprop: false,
            canManageOnoprop: false,
        },
    });
    const [instagramDistribution, setInstagramDistribution] = useState({
        agency: { status: "not_started" },
        onoprop: { status: "not_started" },
    });
    const [instagramError, setInstagramError] = useState("");
    const [instagramSuccess, setInstagramSuccess] = useState("");
    const [instagramOperation, setInstagramOperation] = useState("");

    const channelsState = {
        ...(inmueble?.distribution || {}),
        ...(mercadoLibrePublication
            ? { mercadolibre: mercadoLibrePublication }
            : {}),
    };

    useEffect(() => {
        const loadInmueble = async () => {
            try {
                setLoading(true);
                setError(null);
                setInstagramError("");

                if (!activeInmobiliariaId) {
                    throw new Error("No hay inmobiliaria activa seleccionada.");
                }

                const data = await getInmuebleById(activeInmobiliariaId, id);

                if (!data) {
                    throw new Error("No se encontró el inmueble.");
                }

                let remoteConnection = {
                    connected: false,
                    requiresReconnect: false,
                };
                let remotePublication = null;
                let remoteInstagramConnections = {
                    agency: { connected: false, requiresReconnect: false },
                    onoprop: { connected: false, requiresReconnect: false },
                    eligibility: {
                        agency: false,
                        onoprop: false,
                        canManageOnoprop: false,
                    },
                };
                let remoteInstagramDistribution = {
                    agency: { status: "not_started" },
                    onoprop: { status: "not_started" },
                };
                const [
                    connectionResult,
                    publicationResult,
                    instagramConnectionResult,
                    instagramDistributionResult,
                ] = await Promise.allSettled([
                    getMercadoLibreConnectionStatus(activeInmobiliariaId),
                    getMercadoLibreDistribution(activeInmobiliariaId, id),
                    getInstagramConnectionStatus(activeInmobiliariaId),
                    getInstagramDistribution({
                        inmobiliariaId: activeInmobiliariaId,
                        inmuebleId: id,
                    }),
                ]);

                if (connectionResult.status === "fulfilled") {
                    remoteConnection = connectionResult.value;
                } else {
                    setMercadoLibreError(
                        connectionResult.reason?.message ||
                        "No se pudo consultar la conexión de Mercado Libre.",
                    );
                }

                if (publicationResult.status === "fulfilled") {
                    remotePublication = publicationResult.value;
                }

                if (instagramConnectionResult.status === "fulfilled") {
                    remoteInstagramConnections =
                        instagramConnectionResult.value;
                } else {
                    setInstagramError(
                        instagramConnectionResult.reason?.message ||
                        "No se pudo consultar la conexión de Instagram.",
                    );
                }

                if (instagramDistributionResult.status === "fulfilled") {
                    remoteInstagramDistribution =
                        instagramDistributionResult.value;
                }

                setMercadoLibreConnection(remoteConnection);
                setMercadoLibrePublication(remotePublication);
                setInstagramConnections(remoteInstagramConnections);
                setInstagramDistribution(remoteInstagramDistribution);
                setInmueble(data);

                const initialForms = CHANNELS.reduce((acc, channel) => {
                    const legacy = data.distribution?.[channel.id] || {};
                    const remote =
                        channel.id === "mercadolibre" && remotePublication
                            ? remotePublication
                            : {};
                    const settings =
                        channel.id === "mercadolibre"
                            ? remotePublication?.settings || legacy
                            : legacy;
                    const location = settings.location || {};
                    const locationDefaults =
                        channel.id === "mercadolibre"
                            ? buildMercadoLibreLocationDefaults(data, location)
                            : {};
                    const contact = settings.contact || {};
                    const existing = { ...legacy, ...remote };

                    acc[channel.id] = {
                        status:
                            channel.id === "instagram"
                                ? getInstagramChannelStatus(
                                    remoteInstagramDistribution,
                                    existing.status,
                                )
                                : existing.status || "no_preparado",
                        externalId: existing.externalId || "",
                        note: settings.internalNote || existing.note || "",
                        categoryId: settings.categoryId || "",
                        listingTypeId: settings.listingTypeId || "silver",
                        addressLine: locationDefaults.addressLine || "",
                        zipCode: locationDefaults.zipCode || "",
                        stateId: locationDefaults.stateId || "",
                        cityId: locationDefaults.cityId || "",
                        neighborhoodId:
                            locationDefaults.neighborhoodId || "",
                        latitude: locationDefaults.latitude ?? "",
                        longitude: locationDefaults.longitude ?? "",
                        contactName: contact.name || "",
                        contactEmail: contact.email || "",
                        areaCode: contact.areaCode || "",
                        contactPhone: contact.phone || "",
                        videoId: settings.videoId || "",
                        caption:
                            legacy.caption ||
                            legacy.payloadPreview?.caption ||
                            remoteInstagramDistribution.agency?.caption ||
                            remoteInstagramDistribution.onoprop?.caption ||
                            "",
                        selectedImageUrls:
                            legacy.selectedImageUrls ||
                            legacy.payloadPreview?.imageUrls ||
                            remoteInstagramDistribution.agency?.imageUrls ||
                            remoteInstagramDistribution.onoprop?.imageUrls ||
                            getImageUrls(data).slice(0, 10),
                    };

                    return acc;
                }, {});

                if (remoteConnection.connected) {
                    const setup = await loadMercadoLibreFormSetup({
                        inmobiliariaId: activeInmobiliariaId,
                        inmueble: data,
                        form: initialForms.mercadolibre,
                    });

                    initialForms.mercadolibre = setup.form;
                    setMercadoLibreCategory(setup.category);
                    setMercadoLibreLocationOptions(setup.locationOptions);

                    if (setup.errors.length > 0) {
                        setMercadoLibreError(
                            setup.errors
                                .map(
                                    (setupError) =>
                                        setupError?.message ||
                                        "No se pudo cargar una opción de Mercado Libre.",
                                )
                                .join(" "),
                        );
                    }
                }

                setChannelForms(initialForms);
            } catch (err) {
                console.error("Error cargando difusión:", err);
                setError(err.message || "No se pudo cargar la difusión del inmueble.");
            } finally {
                setLoading(false);
            }
        };

        loadInmueble();
    }, [activeInmobiliariaId, id]);

    const channelPayloads = useMemo(() => {
        if (!inmueble) return {};

        return CHANNELS.reduce((acc, channel) => {
            acc[channel.id] = buildChannelPayload(
                channel.id,
                inmueble,
                channelForms[channel.id] || {},
            );
            return acc;
        }, {});
    }, [channelForms, inmueble]);

    const channelValidations = useMemo(() => {
        if (!inmueble) return {};

        return CHANNELS.reduce((acc, channel) => {
            acc[channel.id] = validateChannel(
                channel.id,
                inmueble,
                channelForms[channel.id] || {},
            );
            return acc;
        }, {});
    }, [channelForms, inmueble]);

    const handleChannelFormChange = (channelId, field, value) => {
        if (channelId === "mercadolibre" && field !== "status") {
            setMercadoLibreValidation(null);
        }

        setChannelForms((prev) => ({
            ...prev,
            [channelId]: {
                ...(prev[channelId] || {}),
                [field]: value,
            },
        }));
    };

    const refreshMercadoLibreConnection = async () => {
        const status = await getMercadoLibreConnectionStatus(
            activeInmobiliariaId,
        );
        setMercadoLibreConnection(status);
        return status;
    };

    const runMercadoLibreOperation = async (operationName, operation) => {
        try {
            setMercadoLibreOperation(operationName);
            setMercadoLibreError("");
            return await operation();
        } catch (err) {
            console.error(`Error en Mercado Libre (${operationName}):`, err);
            setMercadoLibreError(
                err.message || "No se pudo completar la operación.",
            );
            throw err;
        } finally {
            setMercadoLibreOperation("");
        }
    };

    const handleMercadoLibreConnect = async () => {
        try {
            await runMercadoLibreOperation("connect", async () => {
                const authorization = await startMercadoLibreAuthorization(
                    activeInmobiliariaId,
                );
                const popup = window.open(
                    authorization.authUrl,
                    "mercadolibre-oauth",
                    "popup=yes,width=720,height=760",
                );

                if (!popup) {
                    throw new Error(
                        "El navegador bloqueó la ventana de Mercado Libre.",
                    );
                }

                await waitForMercadoLibreOAuth(popup);
                const status = await refreshMercadoLibreConnection();

                if (!status.connected) {
                    throw new Error(
                        "Mercado Libre no confirmó la conexión. Intentá nuevamente.",
                    );
                }

                const setup = await loadMercadoLibreFormSetup({
                    inmobiliariaId: activeInmobiliariaId,
                    inmueble,
                    form: channelForms.mercadolibre || {},
                });
                setMercadoLibreCategory(setup.category);
                setMercadoLibreLocationOptions(setup.locationOptions);
                setChannelForms((prev) => ({
                    ...prev,
                    mercadolibre: setup.form,
                }));

                if (setup.errors.length > 0) {
                    setMercadoLibreError(
                        setup.errors
                            .map(
                                (setupError) =>
                                    setupError?.message ||
                                    "No se pudo cargar una opción de Mercado Libre.",
                            )
                            .join(" "),
                    );
                }
            });
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const handleMercadoLibreConnectionCheck = async () => {
        try {
            await runMercadoLibreOperation("connection-check", async () => {
                await refreshMercadoLibreConnection();
            });
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const handleMercadoLibreDisconnect = async () => {
        if (
            !window.confirm(
                "¿Desconectar la cuenta de Mercado Libre de esta inmobiliaria?",
            )
        ) {
            return;
        }

        try {
            await runMercadoLibreOperation("disconnect", async () => {
                await disconnectMercadoLibre(activeInmobiliariaId);
                setMercadoLibreConnection({
                    connected: false,
                    requiresReconnect: false,
                });
                setMercadoLibreCategory(null);
                setMercadoLibreLocationOptions({
                    states: [],
                    cities: [],
                    neighborhoods: [],
                });
            });
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const refreshInstagramConnections = async () => {
        const status = await getInstagramConnectionStatus(
            activeInmobiliariaId,
        );
        setInstagramConnections(status);
        return status;
    };

    const runInstagramOperation = async (operationName, operation) => {
        try {
            setInstagramOperation(operationName);
            setInstagramError("");
            setInstagramSuccess("");
            return await operation();
        } catch (err) {
            console.error(`Error en Instagram (${operationName}):`, err);
            setInstagramError(
                err.message || "No se pudo completar la operación.",
            );
            throw err;
        } finally {
            setInstagramOperation("");
        }
    };

    const handleInstagramConnect = async (target) => {
        try {
            await runInstagramOperation(`connect-${target}`, async () => {
                const authorization = await startInstagramAuthorization({
                    inmobiliariaId: activeInmobiliariaId,
                    target,
                    openerOrigin: window.location.origin,
                });
                const popup = window.open(
                    authorization.authUrl,
                    `instagram-oauth-${target}`,
                    "popup=yes,width=720,height=760",
                );

                if (!popup) {
                    throw new Error(
                        "El navegador bloqueó la ventana de Instagram.",
                    );
                }

                await waitForInstagramOAuth(popup, target);
                const status = await refreshInstagramConnections();

                if (!status[target]?.connected) {
                    throw new Error(
                        "Instagram no confirmó la conexión. Intentá nuevamente.",
                    );
                }
            });
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const handleInstagramValidate = async (target) => {
        try {
            await runInstagramOperation(`validate-${target}`, async () => {
                const result = await validateInstagramConnection({
                    inmobiliariaId: activeInmobiliariaId,
                    target,
                });
                await refreshInstagramConnections();
                setInstagramSuccess(
                    `Instagram confirmó la conexión de @${result.username || "la cuenta"}.`,
                );
            });
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const handleInstagramDisconnect = async (target) => {
        const accountLabel =
            target === "onoprop"
                ? "la cuenta central de Onoprop"
                : "la cuenta propia de esta inmobiliaria";

        if (!window.confirm(`¿Desconectar ${accountLabel}?`)) return;

        try {
            await runInstagramOperation(`disconnect-${target}`, async () => {
                await disconnectInstagram({
                    inmobiliariaId: activeInmobiliariaId,
                    target,
                });
                await refreshInstagramConnections();
            });
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const handleInstagramImageToggle = (imageUrl) => {
        setChannelForms((prev) => {
            const current = prev.instagram || {};
            const selected = Array.isArray(current.selectedImageUrls)
                ? current.selectedImageUrls
                : [];
            const isSelected = selected.includes(imageUrl);
            const nextSelected = isSelected
                ? selected.filter((url) => url !== imageUrl)
                : selected.length < 10
                    ? [...selected, imageUrl]
                    : selected;

            if (!isSelected && selected.length >= 10) {
                window.alert("Instagram admite hasta 10 imágenes por publicación.");
            }

            return {
                ...prev,
                instagram: {
                    ...current,
                    selectedImageUrls: nextSelected,
                },
            };
        });
    };

    const mergeInstagramDestination = (destination, result = {}) => {
        setInstagramDistribution((prev) => ({
            ...prev,
            [destination]: {
                ...(prev[destination] || {}),
                ...result,
            },
        }));
        setChannelForms((prev) => ({
            ...prev,
            instagram: {
                ...(prev.instagram || {}),
                status:
                    destination === "agency" && result.published
                        ? "publicado"
                        : destination === "onoprop" && result.submitted
                            ? "enviado"
                            : prev.instagram?.status || "listo",
                externalId:
                    result.externalId ||
                    prev.instagram?.externalId ||
                    "",
            },
        }));
    };

    const handleInstagramAgencyPublish = async () => {
        const validation = channelValidations.instagram;
        if (!validation?.isReady) {
            setInstagramError(
                validation?.errors?.join(" · ") ||
                "Completá los datos requeridos para Instagram.",
            );
            return;
        }

        if (
            !window.confirm(
                "¿Publicar ahora este inmueble en la cuenta de Instagram de la inmobiliaria?",
            )
        ) {
            return;
        }

        try {
            await runInstagramOperation("publish-agency", async () => {
                const payload = channelPayloads.instagram || {};
                const result = await publishInstagramAgencyMedia({
                    inmobiliariaId: activeInmobiliariaId,
                    inmuebleId: inmueble.id,
                    caption: payload.caption,
                    imageUrls: payload.imageUrls,
                });
                mergeInstagramDestination("agency", {
                    ...result,
                    status: "published",
                });
            });
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const handleInstagramOnopropSubmit = async () => {
        const validation = channelValidations.instagram;
        if (!validation?.isReady) {
            setInstagramError(
                validation?.errors?.join(" · ") ||
                "Completá los datos requeridos para Instagram.",
            );
            return;
        }

        if (
            !window.confirm(
                "¿Enviar este inmueble a la cola de publicaciones de Onoprop?",
            )
        ) {
            return;
        }

        try {
            await runInstagramOperation("submit-onoprop", async () => {
                const payload = channelPayloads.instagram || {};
                const result = await submitOnopropInstagramPublication({
                    inmobiliariaId: activeInmobiliariaId,
                    inmuebleId: inmueble.id,
                    caption: payload.caption,
                    imageUrls: payload.imageUrls,
                });
                mergeInstagramDestination("onoprop", {
                    ...result,
                    status: "pending",
                    caption: payload.caption,
                    imageUrls: payload.imageUrls,
                });
            });
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const handleMercadoLibreCategorySelect = async (categoryId = "") => {
        try {
            await runMercadoLibreOperation("category", async () => {
                const category = await getMercadoLibreCategoryDetails({
                    inmobiliariaId: activeInmobiliariaId,
                    categoryId,
                });
                setMercadoLibreCategory(category);
                setMercadoLibreValidation(null);
                setChannelForms((prev) => {
                    const current = prev.mercadolibre || {};
                    const listingTypeId =
                        Array.isArray(category.listingTypes) &&
                        !category.listingTypes.includes(current.listingTypeId)
                            ? category.listingTypes[0] || "silver"
                            : current.listingTypeId || "silver";

                    return {
                        ...prev,
                        mercadolibre: {
                            ...current,
                            categoryId: category.isLeaf ? category.id : "",
                            listingTypeId,
                        },
                    };
                });
            });
        } catch {
            // Se conserva la ruta anterior para que el usuario pueda reintentar.
        }
    };

    const loadMercadoLibreLocations = async (level, locationId = "") => {
        return runMercadoLibreOperation(`location-${level}`, async () => {
            const result = await getMercadoLibreLocationOptions({
                inmobiliariaId: activeInmobiliariaId,
                level,
                locationId,
            });
            const targetField =
                level === "country"
                    ? "states"
                    : level === "state"
                        ? "cities"
                        : "neighborhoods";

            setMercadoLibreLocationOptions((prev) => ({
                ...prev,
                [targetField]: result.options || [],
                ...(level === "country"
                    ? { cities: [], neighborhoods: [] }
                    : level === "state"
                        ? { neighborhoods: [] }
                        : {}),
            }));
            return result;
        });
    };

    const handleMercadoLibreStateSelect = async (stateId) => {
        handleChannelFormChange("mercadolibre", "stateId", stateId);
        handleChannelFormChange("mercadolibre", "cityId", "");
        handleChannelFormChange("mercadolibre", "neighborhoodId", "");
        if (!stateId) return;

        try {
            const state = await loadMercadoLibreLocations("state", stateId);
            const suggestedCity = findMercadoLibreOptionByName(
                state.options,
                getLocationParts(inmueble).ciudad,
            );

            if (suggestedCity) {
                handleChannelFormChange(
                    "mercadolibre",
                    "cityId",
                    suggestedCity.id,
                );
                const city = await loadMercadoLibreLocations(
                    "city",
                    suggestedCity.id,
                );
                const suggestedNeighborhood = findMercadoLibreOptionByName(
                    city.options,
                    getLocationParts(inmueble).barrio,
                );

                if (suggestedNeighborhood) {
                    handleChannelFormChange(
                        "mercadolibre",
                        "neighborhoodId",
                        suggestedNeighborhood.id,
                    );
                }
            }
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const handleMercadoLibreCitySelect = async (cityId) => {
        handleChannelFormChange("mercadolibre", "cityId", cityId);
        handleChannelFormChange("mercadolibre", "neighborhoodId", "");
        if (!cityId) return;

        try {
            const city = await loadMercadoLibreLocations("city", cityId);
            const suggestedNeighborhood = findMercadoLibreOptionByName(
                city.options,
                getLocationParts(inmueble).barrio,
            );

            if (suggestedNeighborhood) {
                handleChannelFormChange(
                    "mercadolibre",
                    "neighborhoodId",
                    suggestedNeighborhood.id,
                );
            }
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const handleMercadoLibreLocationsReload = async () => {
        try {
            await runMercadoLibreOperation("location-country", async () => {
                const setup = await loadMercadoLibreLocationSetup({
                    inmobiliariaId: activeInmobiliariaId,
                    inmueble,
                    form: channelForms.mercadolibre || {},
                });
                setMercadoLibreLocationOptions(setup.options);
                setChannelForms((prev) => ({
                    ...prev,
                    mercadolibre: setup.form,
                }));
                setMercadoLibreValidation(null);
            });
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const mergeMercadoLibreResult = (result = {}) => {
        setMercadoLibrePublication((prev) => ({
            ...(prev || {}),
            ...result,
            status:
                result.mlStatus === "active"
                    ? "publicado"
                    : result.mlStatus === "paused"
                        ? "pausado"
                        : result.mlStatus === "closed"
                            ? "cerrado"
                            : prev?.status || "listo",
        }));
        setChannelForms((prev) => ({
            ...prev,
            mercadolibre: {
                ...(prev.mercadolibre || {}),
                externalId:
                    result.externalId ||
                    prev.mercadolibre?.externalId ||
                    "",
                status:
                    result.mlStatus === "active"
                        ? "publicado"
                        : result.mlStatus === "paused"
                            ? "pausado"
                            : result.mlStatus === "closed"
                                ? "cerrado"
                                : prev.mercadolibre?.status || "listo",
            },
        }));
    };

    const handleMercadoLibreValidate = async () => {
        if (
            !mercadoLibreCategory?.isLeaf ||
            mercadoLibreCategory.id !==
                channelForms.mercadolibre?.categoryId
        ) {
            setMercadoLibreError(
                "Elegí una categoría final de inmuebles antes de validar.",
            );
            return;
        }

        try {
            await runMercadoLibreOperation("validate", async () => {
                const result = await validateMercadoLibreItem({
                    inmobiliariaId: activeInmobiliariaId,
                    inmuebleId: inmueble.id,
                    settings: buildMercadoLibreSettings(
                        channelForms.mercadolibre,
                        inmueble,
                    ),
                });
                setMercadoLibreValidation(result);

                if (result.valid) {
                    handleChannelFormChange(
                        "mercadolibre",
                        "status",
                        "listo",
                    );
                }
            });
        } catch {
            setMercadoLibreValidation(null);
        }
    };

    const handleMercadoLibrePublish = async () => {
        if (
            !mercadoLibreCategory?.isLeaf ||
            mercadoLibreCategory.id !==
                channelForms.mercadolibre?.categoryId
        ) {
            setMercadoLibreError(
                "Elegí una categoría final de inmuebles antes de publicar.",
            );
            return;
        }

        if (
            !window.confirm(
                "Esto creará una publicación real y puede consumir un cupo del paquete contratado. ¿Continuar?",
            )
        ) {
            return;
        }

        try {
            await runMercadoLibreOperation("publish", async () => {
                const result = await publishMercadoLibreItem({
                    inmobiliariaId: activeInmobiliariaId,
                    inmuebleId: inmueble.id,
                    settings: buildMercadoLibreSettings(
                        channelForms.mercadolibre,
                        inmueble,
                    ),
                });
                mergeMercadoLibreResult(result);
                setMercadoLibreValidation({
                    valid: true,
                    errors: [],
                    payload: channelPayloads.mercadolibre,
                });
            });
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const handleMercadoLibreUpdate = async () => {
        try {
            await runMercadoLibreOperation("update", async () => {
                const result = await updateMercadoLibreItem({
                    inmobiliariaId: activeInmobiliariaId,
                    inmuebleId: inmueble.id,
                    settings: buildMercadoLibreSettings(
                        channelForms.mercadolibre,
                        inmueble,
                    ),
                });
                mergeMercadoLibreResult(result);
            });
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const handleMercadoLibreStatusChange = async (status) => {
        const actionLabel =
            status === "closed"
                ? "cerrar definitivamente"
                : status === "paused"
                    ? "pausar"
                    : "reactivar";

        if (
            !window.confirm(
                `¿Querés ${actionLabel} la publicación de Mercado Libre?`,
            )
        ) {
            return;
        }

        try {
            await runMercadoLibreOperation(`status-${status}`, async () => {
                const result = await changeMercadoLibreItemStatus({
                    inmobiliariaId: activeInmobiliariaId,
                    inmuebleId: inmueble.id,
                    status,
                });
                mergeMercadoLibreResult(result);
            });
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const handleMercadoLibreSync = async () => {
        try {
            await runMercadoLibreOperation("sync", async () => {
                const result = await syncMercadoLibreItemStatus({
                    inmobiliariaId: activeInmobiliariaId,
                    inmuebleId: inmueble.id,
                });
                mergeMercadoLibreResult(result);
            });
        } catch {
            // El mensaje ya se muestra dentro de la pantalla.
        }
    };

    const handleSaveChannel = async (channelId) => {
        if (!activeInmobiliariaId || !inmueble?.id) {
            window.alert("No se pudo determinar la inmobiliaria o el inmueble.");
            return;
        }

        try {
            setSavingChannelId(channelId);

            const form = channelForms[channelId] || {};

            if (channelId === "mercadolibre") {
                const result = await saveMercadoLibreSettings({
                    inmobiliariaId: activeInmobiliariaId,
                    inmuebleId: inmueble.id,
                    settings: buildMercadoLibreSettings(form, inmueble),
                });
                setMercadoLibrePublication((prev) => ({
                    ...(prev || {}),
                    settings: result.settings,
                    status: prev?.status || form.status || "no_preparado",
                }));
                return;
            }

            const validation = channelValidations[channelId] || {
                errors: [],
                warnings: [],
                isReady: false,
            };

            const payload = channelPayloads[channelId] || {};

            const channelData = {
                status: form.status || "no_preparado",
                externalId: form.externalId || "",
                note: form.note || "",
                categoryId: form.categoryId || "",
                listingTypeId: form.listingTypeId || "silver",
                ...(channelId === "instagram"
                    ? {
                        caption: payload.caption || "",
                        selectedImageUrls: payload.imageUrls || [],
                    }
                    : {}),
                isReady: validation.isReady,
                errors: validation.errors,
                warnings: validation.warnings,
                payloadPreview: payload,
            };

            await updateInmuebleDistributionChannel(
                activeInmobiliariaId,
                inmueble.id,
                channelId,
                channelData,
            );

            setInmueble((prev) => ({
                ...prev,
                distribution: {
                    ...(prev.distribution || {}),
                    [channelId]: {
                        ...channelData,
                        channelId,
                        updatedBy: user?.uid || null,
                        updatedAt: new Date(),
                    },
                },
            }));
        } catch (err) {
            console.error("Error guardando canal de difusión:", err);
            window.alert(err.message || "No se pudo guardar el canal de difusión.");
        } finally {
            setSavingChannelId(null);
        }
    };

    const handleCopyPayload = async (channelId) => {
        try {
            const payload =
                channelId === "mercadolibre" &&
                mercadoLibreValidation?.payload
                    ? mercadoLibreValidation.payload
                    : channelPayloads[channelId] || {};
            await navigator.clipboard.writeText(
                formatJson(payload),
            );

            setCopySuccess(`Payload de ${channelId} copiado.`);

            window.setTimeout(() => {
                setCopySuccess("");
            }, 1800);
        } catch (err) {
            console.error("Error copiando payload:", err);
            window.alert("No se pudo copiar el payload.");
        }
    };

    const handleCopyInstagramCaption = async () => {
        try {
            await navigator.clipboard.writeText(
                channelPayloads.instagram?.caption || "",
            );

            setCopySuccess("Caption de Instagram copiado.");

            window.setTimeout(() => {
                setCopySuccess("");
            }, 1800);
        } catch (err) {
            console.error("Error copiando caption:", err);
            window.alert("No se pudo copiar el caption.");
        }
    };

    if (loading) {
        return (
            <main className="container py-5 text-center">
                <div className="spinner-border" />
                <p className="text-muted mt-3">Cargando difusión...</p>
            </main>
        );
    }

    if (error) {
        return (
            <main className="container py-5">
                <div className="alert alert-danger">{error}</div>

                <Link to="/admin/inmuebles/listado" className="btn btn-primary">
                    Volver al listado
                </Link>
            </main>
        );
    }

    return (
        <main className="container py-4">
            <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                <div>
                    <p className="text-uppercase text-muted small mb-1">
                        Difusión externa
                    </p>

                    <h1 className="h3 mb-1">
                        {inmueble?.titulo || "Inmueble sin título"}
                    </h1>

                    <p className="text-muted mb-0">
                        Preparación y control de publicación en portales externos y redes.
                    </p>
                </div>

                <div className="d-flex flex-wrap gap-2">
                    {isRoot && (
                        <Link
                            to="/admin/inmuebles/instagram-onoprop"
                            className="btn btn-outline-primary"
                        >
                            Cola Instagram Onoprop
                        </Link>
                    )}

                    <Link
                        to={`/admin/inmuebles/${id}/marketing`}
                        className="btn btn-outline-success"
                    >
                        Kit marketing
                    </Link>

                    <Link to="/admin/inmuebles/listado" className="btn btn-outline-secondary">
                        Volver al listado
                    </Link>
                </div>
            </header>

            {copySuccess && <div className="alert alert-success">{copySuccess}</div>}

            <section className="card border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                        <div>
                            <div className="d-flex align-items-center gap-2 mb-1">
                                <h2 className="h5 mb-0">Cuenta de Mercado Libre</h2>
                                <span
                                    className={`badge ${
                                        mercadoLibreConnection.connected
                                            ? "text-bg-success"
                                            : "text-bg-secondary"
                                    }`}
                                >
                                    {mercadoLibreConnection.connected
                                        ? "Conectada"
                                        : mercadoLibreConnection.requiresReconnect
                                            ? "Requiere reconexión"
                                            : "Sin conectar"}
                                </span>
                            </div>

                            {mercadoLibreConnection.connected ? (
                                <p className="text-muted mb-0">
                                    {mercadoLibreConnection.sellerNickname ||
                                        mercadoLibreConnection.sellerEmail ||
                                        `Seller ${mercadoLibreConnection.sellerId}`}
                                    {" · "}
                                    {mercadoLibreConnection.siteId || "MLA"}
                                </p>
                            ) : (
                                <p className="text-muted mb-0">
                                    Conectá la cuenta administradora que tiene contratado el
                                    paquete de publicaciones inmobiliarias.
                                </p>
                            )}
                        </div>

                        <div className="d-flex flex-wrap gap-2">
                            {!mercadoLibreConnection.connected ? (
                                <button
                                    type="button"
                                    className="btn btn-warning"
                                    onClick={handleMercadoLibreConnect}
                                    disabled={Boolean(mercadoLibreOperation)}
                                >
                                    {mercadoLibreOperation === "connect"
                                        ? "Conectando..."
                                        : "Conectar Mercado Libre"}
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="btn btn-outline-primary"
                                        onClick={handleMercadoLibreConnectionCheck}
                                        disabled={Boolean(mercadoLibreOperation)}
                                    >
                                        Verificar conexión
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline-danger"
                                        onClick={handleMercadoLibreDisconnect}
                                        disabled={Boolean(mercadoLibreOperation)}
                                    >
                                        Desconectar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {mercadoLibreError && (
                        <div className="alert alert-danger mt-3 mb-0">
                            {mercadoLibreError}
                        </div>
                    )}
                </div>
            </section>

            <section className="card border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                        <div>
                            <h2 className="h5 mb-1">Cuentas de Instagram</h2>
                            <p className="text-muted mb-0">
                                La cuenta propia y la cuenta central de Onoprop se
                                administran por separado.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() =>
                                runInstagramOperation(
                                    "connection-check",
                                    refreshInstagramConnections,
                                ).catch(() => {})
                            }
                            disabled={Boolean(instagramOperation)}
                        >
                            Actualizar estado
                        </button>
                    </div>

                    <div className="row g-3">
                        <div className="col-lg-6">
                            <div className="border rounded p-3 h-100">
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <h3 className="h6 mb-0">
                                        Instagram de la inmobiliaria
                                    </h3>
                                    <span
                                        className={`badge ${
                                            instagramConnections.agency?.connected
                                                ? "text-bg-success"
                                                : "text-bg-secondary"
                                        }`}
                                    >
                                        {instagramConnections.agency?.connected
                                            ? "Conectada"
                                            : instagramConnections.agency
                                                ?.requiresReconnect
                                                ? "Requiere reconexión"
                                                : "Sin conectar"}
                                    </span>
                                </div>

                                {instagramConnections.agency?.connected ? (
                                    <div className="text-muted mb-3">
                                        <p className="mb-1">
                                            @
                                            {instagramConnections.agency
                                                .username ||
                                                instagramConnections.agency
                                                    .instagramUserId}
                                        </p>
                                        {instagramConnections.agency
                                            .lastVerifiedAt && (
                                            <small>
                                                Última comprobación: {" "}
                                                {formatInstagramVerificationDate(
                                                    instagramConnections.agency
                                                        .lastVerifiedAt,
                                                )}
                                            </small>
                                        )}
                                    </div>
                                ) : instagramConnections.eligibility?.agency ? (
                                    <p className="text-muted mb-3">
                                        Conectá una cuenta profesional Business o
                                        Creator.
                                    </p>
                                ) : (
                                    <div className="alert alert-warning py-2 mb-3">
                                        Esta inmobiliaria no tiene contratado el
                                        módulo Instagram propio.
                                    </div>
                                )}

                                {instagramConnections.agency?.connected ? (
                                    <div className="d-flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary btn-sm"
                                            onClick={() =>
                                                handleInstagramValidate("agency")
                                            }
                                            disabled={Boolean(instagramOperation)}
                                        >
                                            {instagramOperation === "validate-agency"
                                                ? "Comprobando..."
                                                : "Probar con Meta"}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-outline-danger btn-sm"
                                            onClick={() =>
                                                handleInstagramDisconnect("agency")
                                            }
                                            disabled={Boolean(instagramOperation)}
                                        >
                                            Desconectar
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        className="btn btn-danger btn-sm"
                                        onClick={() =>
                                            handleInstagramConnect("agency")
                                        }
                                        disabled={
                                            Boolean(instagramOperation) ||
                                            !instagramConnections.eligibility
                                                ?.agency
                                        }
                                    >
                                        {instagramOperation === "connect-agency"
                                            ? "Conectando..."
                                            : "Conectar Instagram propio"}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="col-lg-6">
                            <div className="border rounded p-3 h-100">
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <h3 className="h6 mb-0">
                                        Instagram central de Onoprop
                                    </h3>
                                    <span
                                        className={`badge ${
                                            instagramConnections.onoprop?.connected
                                                ? "text-bg-success"
                                                : "text-bg-secondary"
                                        }`}
                                    >
                                        {instagramConnections.onoprop?.connected
                                            ? "Conectada"
                                            : instagramConnections.onoprop
                                                ?.requiresReconnect
                                                ? "Requiere reconexión"
                                                : "Sin conectar"}
                                    </span>
                                </div>

                                <p className="text-muted mb-3">
                                    {instagramConnections.onoprop?.connected
                                        ? `@${
                                            instagramConnections.onoprop
                                                .username ||
                                            instagramConnections.onoprop
                                                .instagramUserId
                                        }`
                                        : "Las publicaciones se envían a una cola administrada por Onoprop."}
                                </p>
                                {instagramConnections.onoprop?.connected &&
                                    instagramConnections.onoprop
                                        .lastVerifiedAt && (
                                    <p className="text-muted small mb-3">
                                        Última comprobación: {" "}
                                        {formatInstagramVerificationDate(
                                            instagramConnections.onoprop
                                                .lastVerifiedAt,
                                        )}
                                    </p>
                                )}

                                {instagramConnections.eligibility
                                    ?.canManageOnoprop && (
                                    <>
                                        {instagramConnections.onoprop
                                            ?.connected ? (
                                            <div className="d-flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary btn-sm"
                                                    onClick={() =>
                                                        handleInstagramValidate(
                                                            "onoprop",
                                                        )
                                                    }
                                                    disabled={Boolean(
                                                        instagramOperation,
                                                    )}
                                                >
                                                    {instagramOperation ===
                                                    "validate-onoprop"
                                                        ? "Comprobando..."
                                                        : "Probar con Meta"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger btn-sm"
                                                    onClick={() =>
                                                        handleInstagramDisconnect(
                                                            "onoprop",
                                                        )
                                                    }
                                                    disabled={Boolean(
                                                        instagramOperation,
                                                    )}
                                                >
                                                    Desconectar cuenta central
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className="btn btn-danger btn-sm"
                                                onClick={() =>
                                                    handleInstagramConnect(
                                                        "onoprop",
                                                    )
                                                }
                                                disabled={Boolean(
                                                    instagramOperation,
                                                )}
                                            >
                                                {instagramOperation ===
                                                "connect-onoprop"
                                                    ? "Conectando..."
                                                    : "Conectar cuenta de Onoprop"}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {instagramError && (
                        <div className="alert alert-danger mt-3 mb-0">
                            {instagramError}
                        </div>
                    )}
                    {instagramSuccess && (
                        <div className="alert alert-success mt-3 mb-0">
                            {instagramSuccess}
                        </div>
                    )}
                </div>
            </section>

            <section className="card border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                    <div className="row g-3">
                        <div className="col-md-3">
                            <div className="small text-muted">Operación</div>
                            <div className="fw-semibold">{inmueble.operacion || "-"}</div>
                        </div>

                        <div className="col-md-3">
                            <div className="small text-muted">Tipo</div>
                            <div className="fw-semibold">{inmueble.tipo || "-"}</div>
                        </div>

                        <div className="col-md-3">
                            <div className="small text-muted">Precio</div>
                            <div className="fw-semibold">{formatPrice(inmueble)}</div>
                        </div>

                        <div className="col-md-3">
                            <div className="small text-muted">Ubicación</div>
                            <div className="fw-semibold">
                                {getLocationLabel(inmueble) || "Sin ubicación"}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="row g-4">
                {CHANNELS.map((channel) => {
                    const form = channelForms[channel.id] || {};
                    const stored = channelsState[channel.id] || {};
                    const validation = channelValidations[channel.id] || {
                        isReady: false,
                        errors: [],
                        warnings: [],
                    };
                    const saving = savingChannelId === channel.id;
                    const isMercadoLibre = channel.id === "mercadolibre";
                    const isInstagram = channel.id === "instagram";
                    const payload =
                        isMercadoLibre && mercadoLibreValidation?.payload
                            ? mercadoLibreValidation.payload
                            : channelPayloads[channel.id] || {};
                    const mercadoLibreBusy =
                        isMercadoLibre && Boolean(mercadoLibreOperation);
                    const mercadoLibreCategoryReady =
                        !isMercadoLibre ||
                        (
                            mercadoLibreCategory?.isLeaf === true &&
                            mercadoLibreCategory.id === form.categoryId
                        );
                    const mercadoLibreExternalId =
                        mercadoLibrePublication?.externalId ||
                        form.externalId ||
                        "";
                    const mercadoLibreStatus =
                        mercadoLibrePublication?.mlStatus || "";
                    const instagramAgencyPublication =
                        instagramDistribution.agency || {};
                    const instagramOnopropPublication =
                        instagramDistribution.onoprop || {};
                    const instagramBusy =
                        isInstagram && Boolean(instagramOperation);

                    return (
                        <article className="col-12" key={channel.id}>
                            <div className="card border-0 shadow-sm">
                                <div className="card-body p-4">
                                    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                                        <div>
                                            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                                                <h2 className="h4 mb-0">{channel.label}</h2>

                                                <span className={getStatusBadgeClass(form.status)}>
                                                    {getStatusLabel(form.status)}
                                                </span>

                                                {isMercadoLibre &&
                                                    mercadoLibreValidation?.valid ? (
                                                    <span className="badge text-bg-success">
                                                        Validado por Mercado Libre
                                                    </span>
                                                ) : validation.isReady ? (
                                                    <span className="badge text-bg-success">
                                                        Datos suficientes
                                                    </span>
                                                ) : (
                                                    <span className="badge text-bg-danger">
                                                        Requiere ajustes
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-muted mb-0">{channel.description}</p>
                                        </div>

                                        <div className="d-flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-outline-primary btn-sm"
                                                onClick={() => handleCopyPayload(channel.id)}
                                            >
                                                Copiar payload
                                            </button>

                                            {channel.id === "instagram" && (
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-success btn-sm"
                                                    onClick={handleCopyInstagramCaption}
                                                >
                                                    Copiar caption
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {isMercadoLibre && (
                                        <div className="border rounded p-3 mb-4 bg-light">
                                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                                                <div>
                                                    <div className="fw-semibold">
                                                        Publicación real vía API
                                                    </div>
                                                    {mercadoLibreExternalId ? (
                                                        <div className="small text-muted">
                                                            ID: {mercadoLibreExternalId}
                                                            {mercadoLibrePublication?.permalink && (
                                                                <>
                                                                    {" · "}
                                                                    <a
                                                                        href={
                                                                            mercadoLibrePublication.permalink
                                                                        }
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                    >
                                                                        Ver en Mercado Libre
                                                                    </a>
                                                                </>
                                                            )}
                                                            {mercadoLibreStatus &&
                                                                ` · Estado: ${mercadoLibreStatus}`}
                                                        </div>
                                                    ) : (
                                                        <div className="small text-muted">
                                                            Primero validá el borrador contra la API;
                                                            publicar puede consumir un cupo contratado.
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="d-flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-primary btn-sm"
                                                        onClick={handleMercadoLibreValidate}
                                                        disabled={
                                                            !mercadoLibreConnection.connected ||
                                                            mercadoLibreBusy ||
                                                            !mercadoLibreCategoryReady
                                                        }
                                                    >
                                                        {mercadoLibreOperation === "validate"
                                                            ? "Validando..."
                                                            : "Validar con Mercado Libre"}
                                                    </button>

                                                    {!mercadoLibreExternalId ? (
                                                        <button
                                                            type="button"
                                                            className="btn btn-warning btn-sm"
                                                            onClick={handleMercadoLibrePublish}
                                                            disabled={
                                                                !mercadoLibreConnection.connected ||
                                                                mercadoLibreBusy ||
                                                                !mercadoLibreCategoryReady ||
                                                                mercadoLibreValidation?.valid !== true
                                                            }
                                                        >
                                                            {mercadoLibreOperation === "publish"
                                                                ? "Publicando..."
                                                                : "Publicar ahora"}
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="btn btn-primary btn-sm"
                                                                onClick={handleMercadoLibreUpdate}
                                                                disabled={mercadoLibreBusy}
                                                            >
                                                                {mercadoLibreOperation === "update"
                                                                    ? "Actualizando..."
                                                                    : "Actualizar publicación"}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-secondary btn-sm"
                                                                onClick={handleMercadoLibreSync}
                                                                disabled={mercadoLibreBusy}
                                                            >
                                                                Sincronizar
                                                            </button>
                                                            {mercadoLibreStatus === "active" && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-warning btn-sm"
                                                                    onClick={() =>
                                                                        handleMercadoLibreStatusChange(
                                                                            "paused",
                                                                        )
                                                                    }
                                                                    disabled={mercadoLibreBusy}
                                                                >
                                                                    Pausar
                                                                </button>
                                                            )}
                                                            {mercadoLibreStatus === "paused" && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-success btn-sm"
                                                                    onClick={() =>
                                                                        handleMercadoLibreStatusChange(
                                                                            "active",
                                                                        )
                                                                    }
                                                                    disabled={mercadoLibreBusy}
                                                                >
                                                                    Reactivar
                                                                </button>
                                                            )}
                                                            {mercadoLibreStatus !== "closed" && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-danger btn-sm"
                                                                    onClick={() =>
                                                                        handleMercadoLibreStatusChange(
                                                                            "closed",
                                                                        )
                                                                    }
                                                                    disabled={mercadoLibreBusy}
                                                                >
                                                                    Cerrar
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {!mercadoLibreConnection.connected && (
                                                <div className="alert alert-warning py-2 mt-3 mb-0">
                                                    Conectá una cuenta de Mercado Libre para
                                                    validar o publicar.
                                                </div>
                                            )}

                                            {mercadoLibreValidation &&
                                                !mercadoLibreValidation.valid && (
                                                    <div className="alert alert-danger py-2 mt-3 mb-0">
                                                        <strong>
                                                            Mercado Libre rechazó el borrador:
                                                        </strong>
                                                        <ul className="mb-0 mt-1">
                                                            {mercadoLibreValidation.errors?.map(
                                                                (validationError) => (
                                                                    <li key={validationError}>
                                                                        {validationError}
                                                                    </li>
                                                                ),
                                                            )}
                                                        </ul>
                                                    </div>
                                                )}
                                        </div>
                                    )}

                                    {isInstagram && (
                                        <div className="border rounded p-3 mb-4 bg-light">
                                            <div className="row g-3 mb-4">
                                                <div className="col-lg-6">
                                                    <div className="bg-white border rounded p-3 h-100">
                                                        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                                                            <strong>
                                                                Cuenta propia
                                                            </strong>
                                                            <span
                                                                className={getInstagramPublicationBadgeClass(
                                                                    instagramAgencyPublication.status,
                                                                )}
                                                            >
                                                                {getInstagramPublicationStatusLabel(
                                                                    instagramAgencyPublication.status,
                                                                )}
                                                            </span>
                                                        </div>

                                                        {instagramAgencyPublication
                                                            .permalink && (
                                                            <a
                                                                href={
                                                                    instagramAgencyPublication.permalink
                                                                }
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="small"
                                                            >
                                                                Ver publicación
                                                            </a>
                                                        )}

                                                        {instagramAgencyPublication
                                                            .lastError && (
                                                            <div className="text-danger small mt-2">
                                                                {
                                                                    instagramAgencyPublication.lastError
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="col-lg-6">
                                                    <div className="bg-white border rounded p-3 h-100">
                                                        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                                                            <strong>
                                                                Portal Onoprop
                                                            </strong>
                                                            <span
                                                                className={getInstagramPublicationBadgeClass(
                                                                    instagramOnopropPublication.status,
                                                                )}
                                                            >
                                                                {getInstagramPublicationStatusLabel(
                                                                    instagramOnopropPublication.status,
                                                                )}
                                                            </span>
                                                        </div>

                                                        {instagramOnopropPublication
                                                            .permalink && (
                                                            <a
                                                                href={
                                                                    instagramOnopropPublication.permalink
                                                                }
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="small"
                                                            >
                                                                Ver publicación
                                                            </a>
                                                        )}

                                                        {instagramOnopropPublication
                                                            .lastError && (
                                                            <div className="text-danger small mt-2">
                                                                {
                                                                    instagramOnopropPublication.lastError
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <label className="form-label fw-semibold">
                                                    Texto de la publicación
                                                </label>
                                                <textarea
                                                    className="form-control"
                                                    rows={9}
                                                    maxLength={2200}
                                                    value={payload.caption || ""}
                                                    onChange={(event) =>
                                                        handleChannelFormChange(
                                                            "instagram",
                                                            "caption",
                                                            event.target.value,
                                                        )
                                                    }
                                                    disabled={instagramBusy}
                                                />
                                                <div className="form-text text-end">
                                                    {(payload.caption || "").length}
                                                    /2200
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                                                    <label className="form-label fw-semibold mb-0">
                                                        Imágenes seleccionadas
                                                    </label>
                                                    <span className="small text-muted">
                                                        {payload.imageUrls?.length ||
                                                            0}
                                                        /10
                                                    </span>
                                                </div>

                                                <div className="row g-2">
                                                    {getImageUrls(inmueble).map(
                                                        (imageUrl, imageIndex) => {
                                                            const selected =
                                                                payload.imageUrls?.includes(
                                                                    imageUrl,
                                                                );

                                                            return (
                                                                <div
                                                                    className="col-6 col-md-3 col-xl-2"
                                                                    key={imageUrl}
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        className={`btn p-1 w-100 border ${
                                                                            selected
                                                                                ? "border-primary border-3"
                                                                                : "border-secondary-subtle"
                                                                        }`}
                                                                        onClick={() =>
                                                                            handleInstagramImageToggle(
                                                                                imageUrl,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            instagramBusy
                                                                        }
                                                                        aria-pressed={
                                                                            selected
                                                                        }
                                                                    >
                                                                        <img
                                                                            src={
                                                                                imageUrl
                                                                            }
                                                                            alt={`Imagen ${
                                                                                imageIndex +
                                                                                1
                                                                            }`}
                                                                            className="w-100 rounded"
                                                                            style={{
                                                                                aspectRatio:
                                                                                    "1 / 1",
                                                                                objectFit:
                                                                                    "cover",
                                                                            }}
                                                                        />
                                                                        <span
                                                                            className={`d-block small py-1 ${
                                                                                selected
                                                                                    ? "text-primary fw-semibold"
                                                                                    : "text-muted"
                                                                            }`}
                                                                        >
                                                                            {selected
                                                                                ? "Seleccionada"
                                                                                : "Seleccionar"}
                                                                        </span>
                                                                    </button>
                                                                </div>
                                                            );
                                                        },
                                                    )}
                                                </div>
                                            </div>

                                            <div className="d-flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-danger"
                                                    onClick={
                                                        handleInstagramAgencyPublish
                                                    }
                                                    disabled={
                                                        instagramBusy ||
                                                        !instagramConnections
                                                            .eligibility?.agency ||
                                                        !instagramConnections
                                                            .agency?.connected ||
                                                        !validation.isReady
                                                    }
                                                >
                                                    {instagramOperation ===
                                                    "publish-agency"
                                                        ? "Publicando..."
                                                        : "Publicar en mi Instagram"}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="btn btn-primary"
                                                    onClick={
                                                        handleInstagramOnopropSubmit
                                                    }
                                                    disabled={
                                                        instagramBusy ||
                                                        !instagramConnections
                                                            .eligibility
                                                            ?.onoprop ||
                                                        !instagramConnections
                                                            .onoprop?.connected ||
                                                        !validation.isReady ||
                                                        instagramOnopropPublication.status ===
                                                            "pending"
                                                    }
                                                >
                                                    {instagramOperation ===
                                                    "submit-onoprop"
                                                        ? "Enviando..."
                                                        : instagramOnopropPublication.status ===
                                                            "pending"
                                                            ? "Pendiente de aprobación"
                                                            : "Enviar a Onoprop"}
                                                </button>

                                                {isRoot && (
                                                    <Link
                                                        to="/admin/inmuebles/instagram-onoprop"
                                                        className="btn btn-outline-primary"
                                                    >
                                                        Revisar cola
                                                    </Link>
                                                )}
                                            </div>

                                            {!instagramConnections.eligibility
                                                ?.agency && (
                                                <div className="alert alert-warning py-2 mt-3 mb-0">
                                                    Para publicar en la cuenta
                                                    propia, habilitá el módulo
                                                    Instagram propio en la
                                                    suscripción.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="row g-4">
                                        <div className="col-lg-5">
                                            <div className="mb-3">
                                                <label className="form-label">Estado del canal</label>

                                                {isMercadoLibre ? (
                                                    <input
                                                        className="form-control"
                                                        value={getStatusLabel(
                                                            form.status || "no_preparado",
                                                        )}
                                                        readOnly
                                                    />
                                                ) : (
                                                    <select
                                                        className="form-select"
                                                        value={form.status || "no_preparado"}
                                                        onChange={(event) =>
                                                            handleChannelFormChange(
                                                                channel.id,
                                                                "status",
                                                                event.target.value,
                                                            )
                                                        }
                                                        disabled={saving}
                                                    >
                                                        {STATUS_OPTIONS.map((option) => (
                                                            <option
                                                                value={option.value}
                                                                key={option.value}
                                                            >
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>

                                            {channel.id === "mercadolibre" && (
                                                <>
                                                    <div className="row g-3 mb-3">
                                                        <div className="col-md-7">
                                                            <label className="form-label">
                                                                Categoría final de Mercado Libre
                                                            </label>
                                                            {mercadoLibreCategory ? (
                                                                <>
                                                                    <nav
                                                                        className="small mb-2"
                                                                        aria-label="Ruta de categoría de Mercado Libre"
                                                                    >
                                                                        {mercadoLibreCategory.path?.map(
                                                                            (segment, index) => (
                                                                                <span
                                                                                    key={segment.id}
                                                                                >
                                                                                    {index > 0 &&
                                                                                        " / "}
                                                                                    <button
                                                                                        type="button"
                                                                                        className="btn btn-link btn-sm p-0 align-baseline"
                                                                                        onClick={() =>
                                                                                            handleMercadoLibreCategorySelect(
                                                                                                segment.id,
                                                                                            )
                                                                                        }
                                                                                        disabled={
                                                                                            mercadoLibreBusy ||
                                                                                            segment.id ===
                                                                                                mercadoLibreCategory.id
                                                                                        }
                                                                                    >
                                                                                        {
                                                                                            segment.name
                                                                                        }
                                                                                    </button>
                                                                                </span>
                                                                            ),
                                                                        )}
                                                                    </nav>

                                                                    {mercadoLibreCategory.isLeaf ? (
                                                                        <div className="form-control bg-light">
                                                                            {
                                                                                mercadoLibreCategory.name
                                                                            }
                                                                            <span className="text-muted ms-2">
                                                                                (
                                                                                {
                                                                                    mercadoLibreCategory.id
                                                                                }
                                                                                )
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <select
                                                                            className="form-select"
                                                                            value=""
                                                                            onChange={(event) => {
                                                                                if (
                                                                                    event.target
                                                                                        .value
                                                                                ) {
                                                                                    handleMercadoLibreCategorySelect(
                                                                                        event.target
                                                                                            .value,
                                                                                    );
                                                                                }
                                                                            }}
                                                                            disabled={
                                                                                saving ||
                                                                                mercadoLibreBusy
                                                                            }
                                                                        >
                                                                            <option value="">
                                                                                Elegir siguiente
                                                                                categoría...
                                                                            </option>
                                                                            {mercadoLibreCategory.children?.map(
                                                                                (child) => (
                                                                                    <option
                                                                                        value={
                                                                                            child.id
                                                                                        }
                                                                                        key={
                                                                                            child.id
                                                                                        }
                                                                                    >
                                                                                        {
                                                                                            child.name
                                                                                        }
                                                                                    </option>
                                                                                ),
                                                                            )}
                                                                        </select>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-secondary w-100"
                                                                    onClick={() =>
                                                                        handleMercadoLibreCategorySelect(
                                                                            "",
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        !mercadoLibreConnection.connected ||
                                                                        mercadoLibreBusy
                                                                    }
                                                                >
                                                                    Cargar categorías de inmuebles
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="col-md-5">
                                                            <label className="form-label">
                                                                Paquete / tipo de publicación
                                                            </label>
                                                            <select
                                                                className="form-select"
                                                                value={
                                                                    form.listingTypeId || "silver"
                                                                }
                                                                onChange={(event) =>
                                                                    handleChannelFormChange(
                                                                        channel.id,
                                                                        "listingTypeId",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                                disabled={
                                                                    saving || mercadoLibreBusy
                                                                }
                                                            >
                                                                {(
                                                                    mercadoLibreCategory?.listingTypes ||
                                                                    [
                                                                        "silver",
                                                                        "gold",
                                                                        "gold_premium",
                                                                    ]
                                                                ).map((listingType) => (
                                                                    <option
                                                                        value={listingType}
                                                                        key={listingType}
                                                                    >
                                                                        {listingType === "silver"
                                                                            ? "Silver"
                                                                            : listingType === "gold"
                                                                                ? "Gold"
                                                                                : "Gold premium"}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {mercadoLibreCategory && (
                                                        <div
                                                            className={`alert py-2 ${
                                                                mercadoLibreCategory.isLeaf
                                                                    ? "alert-success"
                                                                    : "alert-warning"
                                                            }`}
                                                        >
                                                            <strong>
                                                                {mercadoLibreCategory.name}
                                                            </strong>
                                                            {!mercadoLibreCategory.isLeaf && (
                                                                <div className="small mt-1">
                                                                    Seguí eligiendo hasta definir tipo
                                                                    de propiedad, operación y subtipo.
                                                                    Solo una categoría final habilita
                                                                    la validación.
                                                                </div>
                                                            )}
                                                            {mercadoLibreCategory.isLeaf && (
                                                                <div className="small mt-1">
                                                                    Categoría final seleccionada y
                                                                    válida para{" "}
                                                                    {
                                                                        mercadoLibreCategory.siteId
                                                                    }
                                                                    .
                                                                </div>
                                                            )}
                                                            {mercadoLibreCategory
                                                                .requiredAttributes?.length > 0 && (
                                                                <div className="small mt-1">
                                                                    Atributos obligatorios:{" "}
                                                                    {mercadoLibreCategory.requiredAttributes
                                                                        .map(
                                                                            (attribute) =>
                                                                                attribute.name,
                                                                        )
                                                                        .join(", ")}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="d-flex justify-content-between align-items-center gap-2 mt-4">
                                                        <h3 className="h6 mb-0">
                                                            Ubicación Mercado Libre
                                                        </h3>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary btn-sm"
                                                            onClick={
                                                                handleMercadoLibreLocationsReload
                                                            }
                                                            disabled={
                                                                !mercadoLibreConnection.connected ||
                                                                mercadoLibreBusy
                                                            }
                                                        >
                                                            Recargar ubicaciones
                                                        </button>
                                                    </div>
                                                    <div className="row g-3 mb-3">
                                                        <div className="col-md-8">
                                                            <label className="form-label">
                                                                Dirección
                                                            </label>
                                                            <input
                                                                className="form-control"
                                                                value={form.addressLine || ""}
                                                                onChange={(event) =>
                                                                    handleChannelFormChange(
                                                                        channel.id,
                                                                        "addressLine",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                                placeholder="Se completa con calle y número del inmueble"
                                                            />
                                                            {form.addressLine &&
                                                                getLocationParts(inmueble).calle && (
                                                                    <div className="form-text">
                                                                        Precargada desde la ficha del
                                                                        inmueble.
                                                                    </div>
                                                                )}
                                                        </div>
                                                        <div className="col-md-4">
                                                            <label className="form-label">
                                                                Código postal
                                                            </label>
                                                            <input
                                                                className="form-control"
                                                                value={form.zipCode || ""}
                                                                onChange={(event) =>
                                                                    handleChannelFormChange(
                                                                        channel.id,
                                                                        "zipCode",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                        <div className="col-md-4">
                                                            <label className="form-label">
                                                                Provincia / estado
                                                            </label>
                                                            <select
                                                                className="form-select"
                                                                value={form.stateId || ""}
                                                                onChange={(event) =>
                                                                    handleMercadoLibreStateSelect(
                                                                        event.target.value,
                                                                    )
                                                                }
                                                                disabled={
                                                                    mercadoLibreBusy ||
                                                                    mercadoLibreLocationOptions
                                                                        .states.length === 0
                                                                }
                                                            >
                                                                <option value="">
                                                                    Seleccionar...
                                                                </option>
                                                                {mercadoLibreLocationOptions.states.map(
                                                                    (option) => (
                                                                        <option
                                                                            value={option.id}
                                                                            key={option.id}
                                                                        >
                                                                            {option.name}
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </select>
                                                        </div>
                                                        <div className="col-md-4">
                                                            <label className="form-label">
                                                                Ciudad
                                                            </label>
                                                            <select
                                                                className="form-select"
                                                                value={form.cityId || ""}
                                                                onChange={(event) =>
                                                                    handleMercadoLibreCitySelect(
                                                                        event.target.value,
                                                                    )
                                                                }
                                                                disabled={
                                                                    mercadoLibreBusy ||
                                                                    !form.stateId ||
                                                                    mercadoLibreLocationOptions
                                                                        .cities.length === 0
                                                                }
                                                            >
                                                                <option value="">
                                                                    Seleccionar...
                                                                </option>
                                                                {mercadoLibreLocationOptions.cities.map(
                                                                    (option) => (
                                                                        <option
                                                                            value={option.id}
                                                                            key={option.id}
                                                                        >
                                                                            {option.name}
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </select>
                                                            {!form.cityId &&
                                                                getLocationParts(inmueble).ciudad && (
                                                                    <div className="form-text">
                                                                        En la ficha:{" "}
                                                                        {
                                                                            getLocationParts(
                                                                                inmueble,
                                                                            ).ciudad
                                                                        }
                                                                    </div>
                                                                )}
                                                        </div>
                                                        <div className="col-md-4">
                                                            <label className="form-label">
                                                                Barrio
                                                            </label>
                                                            <select
                                                                className="form-select"
                                                                value={
                                                                    form.neighborhoodId || ""
                                                                }
                                                                onChange={(event) =>
                                                                    handleChannelFormChange(
                                                                        channel.id,
                                                                        "neighborhoodId",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                                disabled={
                                                                    mercadoLibreBusy ||
                                                                    !form.cityId ||
                                                                    mercadoLibreLocationOptions
                                                                        .neighborhoods.length === 0
                                                                }
                                                            >
                                                                <option value="">
                                                                    Seleccionar...
                                                                </option>
                                                                {mercadoLibreLocationOptions.neighborhoods.map(
                                                                    (option) => (
                                                                        <option
                                                                            value={option.id}
                                                                            key={option.id}
                                                                        >
                                                                            {option.name}
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </select>
                                                            {!form.neighborhoodId &&
                                                                getLocationParts(inmueble).barrio && (
                                                                    <div className="form-text">
                                                                        En la ficha:{" "}
                                                                        {
                                                                            getLocationParts(
                                                                                inmueble,
                                                                            ).barrio
                                                                        }
                                                                    </div>
                                                                )}
                                                        </div>
                                                        <div className="col-md-6">
                                                            <label className="form-label">
                                                                Latitud
                                                            </label>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                className="form-control"
                                                                value={form.latitude ?? ""}
                                                                onChange={(event) =>
                                                                    handleChannelFormChange(
                                                                        channel.id,
                                                                        "latitude",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                        <div className="col-md-6">
                                                            <label className="form-label">
                                                                Longitud
                                                            </label>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                className="form-control"
                                                                value={form.longitude ?? ""}
                                                                onChange={(event) =>
                                                                    handleChannelFormChange(
                                                                        channel.id,
                                                                        "longitude",
                                                                        event.target.value,
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                    </div>

                                                    <details className="mb-3">
                                                        <summary className="fw-semibold">
                                                            Sobrescribir contacto o video
                                                        </summary>
                                                        <div className="row g-3 mt-1">
                                                            <div className="col-md-6">
                                                                <label className="form-label">
                                                                    Nombre de contacto
                                                                </label>
                                                                <input
                                                                    className="form-control"
                                                                    value={form.contactName || ""}
                                                                    onChange={(event) =>
                                                                        handleChannelFormChange(
                                                                            channel.id,
                                                                            "contactName",
                                                                            event.target.value,
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                            <div className="col-md-6">
                                                                <label className="form-label">
                                                                    Email
                                                                </label>
                                                                <input
                                                                    type="email"
                                                                    className="form-control"
                                                                    value={form.contactEmail || ""}
                                                                    onChange={(event) =>
                                                                        handleChannelFormChange(
                                                                            channel.id,
                                                                            "contactEmail",
                                                                            event.target.value,
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                            <div className="col-md-4">
                                                                <label className="form-label">
                                                                    Código de área
                                                                </label>
                                                                <input
                                                                    className="form-control"
                                                                    value={form.areaCode || ""}
                                                                    onChange={(event) =>
                                                                        handleChannelFormChange(
                                                                            channel.id,
                                                                            "areaCode",
                                                                            event.target.value,
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                            <div className="col-md-8">
                                                                <label className="form-label">
                                                                    Teléfono
                                                                </label>
                                                                <input
                                                                    className="form-control"
                                                                    value={
                                                                        form.contactPhone || ""
                                                                    }
                                                                    onChange={(event) =>
                                                                        handleChannelFormChange(
                                                                            channel.id,
                                                                            "contactPhone",
                                                                            event.target.value,
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                            <div className="col-12">
                                                                <label className="form-label">
                                                                    Video ID
                                                                </label>
                                                                <input
                                                                    className="form-control"
                                                                    value={form.videoId || ""}
                                                                    onChange={(event) =>
                                                                        handleChannelFormChange(
                                                                            channel.id,
                                                                            "videoId",
                                                                            event.target.value,
                                                                        )
                                                                    }
                                                                    placeholder="ID;youtube o ID;matterport"
                                                                />
                                                            </div>
                                                        </div>
                                                    </details>
                                                </>
                                            )}

                                            <div className="mb-3">
                                                <label className="form-label">
                                                    ID externo / referencia
                                                </label>

                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={
                                                        isMercadoLibre
                                                            ? mercadoLibreExternalId
                                                            : form.externalId || ""
                                                    }
                                                    onChange={(event) =>
                                                        handleChannelFormChange(
                                                            channel.id,
                                                            "externalId",
                                                            event.target.value,
                                                        )
                                                    }
                                                    disabled={saving || isMercadoLibre}
                                                    placeholder="Ej: ID publicación Mercado Libre, ID feed, URL externa..."
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label">Nota interna</label>

                                                <textarea
                                                    className="form-control"
                                                    rows={4}
                                                    value={form.note || ""}
                                                    onChange={(event) =>
                                                        handleChannelFormChange(
                                                            channel.id,
                                                            "note",
                                                            event.target.value,
                                                        )
                                                    }
                                                    disabled={saving}
                                                    placeholder="Ej: Pendiente completar superficie. Enviado manualmente al ejecutivo del portal..."
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                disabled={saving || mercadoLibreBusy}
                                                onClick={() => handleSaveChannel(channel.id)}
                                            >
                                                {saving
                                                    ? "Guardando..."
                                                    : isMercadoLibre
                                                        ? "Guardar configuración"
                                                        : "Guardar canal"}
                                            </button>

                                            {stored.updatedAt && (
                                                <div className="small text-muted mt-2">
                                                    Última actualización registrada.
                                                </div>
                                            )}
                                        </div>

                                        <div className="col-lg-3">
                                            <h3 className="h6">Validación</h3>

                                            {validation.errors.length === 0 &&
                                                validation.warnings.length === 0 ? (
                                                <div className="alert alert-success small mb-0">
                                                    No se detectaron observaciones.
                                                </div>
                                            ) : (
                                                <>
                                                    {validation.errors.length > 0 && (
                                                        <div className="alert alert-danger small">
                                                            <strong>Errores</strong>
                                                            <ul className="mb-0 ps-3 mt-2">
                                                                {validation.errors.map((item) => (
                                                                    <li key={item}>{item}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {validation.warnings.length > 0 && (
                                                        <div className="alert alert-warning small mb-0">
                                                            <strong>Advertencias</strong>
                                                            <ul className="mb-0 ps-3 mt-2">
                                                                {validation.warnings.map((item) => (
                                                                    <li key={item}>{item}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        <div className="col-lg-4">
                                            <h3 className="h6">Preview técnico</h3>

                                            <textarea
                                                className="form-control font-monospace small"
                                                rows={14}
                                                value={formatJson(payload)}
                                                readOnly
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </section>
        </main>
    );
};

export default InmuebleDistributionPage;
