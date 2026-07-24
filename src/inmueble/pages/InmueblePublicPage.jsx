import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { getPublicInmuebleBySlug } from "../services/inmueble.service";
import { createInmuebleConsulta } from "../services/inmuebleConsulta.service";
import { getPublicInmobiliariaById } from "../../inmobiliaria/services/inmobiliaria.service";
import InmuebleVideoSection from "../components/InmuebleVideoSection";
import InmuebleMediaGallery from "../components/InmuebleMediaGallery";
import { getVisibleInmuebleVideos } from "../utils/inmuebleVideos.helpers";


const INITIAL_CONSULTA = {
  nombre: "",
  email: "",
  telefono: "",
  mensaje: "",
};

const DEFAULT_SEO_IMAGE = "/assets/img/Logo.png";

const formatPrice = (inmueble) => {
  if (!inmueble?.precio) return "Consultar";

  const moneda = inmueble.moneda || "USD";
  const precio = Number(inmueble.precio);

  if (!Number.isFinite(precio)) {
    return `${moneda} ${inmueble.precio}`;
  }

  return `${moneda} ${precio.toLocaleString("es-AR")}`;
};

const formatNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) return value;

  return number.toLocaleString("es-AR");
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const normalizeSeoText = (value = "") => {
  return value
    .toString()
    .replace(/\s+/g, " ")
    .trim();
};

const truncateText = (value = "", maxLength = 155) => {
  const cleanValue = normalizeSeoText(value);

  if (cleanValue.length <= maxLength) return cleanValue;

  return `${cleanValue.slice(0, maxLength - 1).trim()}…`;
};

const capitalize = (value = "") => {
  const cleanValue = normalizeSeoText(value);

  if (!cleanValue) return "";

  return cleanValue.charAt(0).toUpperCase() + cleanValue.slice(1);
};

const getDireccionValue = (inmueble, key) => {
  return inmueble?.direccion?.[key] || inmueble?.[key] || "";
};

const buildAddress = (inmueble) => {
  return [
    getDireccionValue(inmueble, "calle"),
    getDireccionValue(inmueble, "numero"),
    getDireccionValue(inmueble, "barrio"),
    getDireccionValue(inmueble, "ciudad"),
  ]
    .filter(Boolean)
    .join(", ");
};

const getLocationParts = (inmueble) => {
  return {
    streetAddress: [
      getDireccionValue(inmueble, "calle"),
      getDireccionValue(inmueble, "numero"),
    ]
      .filter(Boolean)
      .join(" "),
    neighborhood: getDireccionValue(inmueble, "barrio"),
    city: getDireccionValue(inmueble, "ciudad"),
    province: getDireccionValue(inmueble, "provincia"),
  };
};

const getCurrentPageUrl = (slug) => {
  if (!slug) return "";

  if (typeof window === "undefined") {
    return `/inmueble/${slug}`;
  }

  return `${window.location.origin}/inmueble/${slug}`;
};

const getAgencyUrl = (inmobiliaria) => {
  if (!inmobiliaria?.slug) return undefined;

  if (typeof window === "undefined") {
    return `/inmobiliaria/${inmobiliaria.slug}`;
  }

  return `${window.location.origin}/inmobiliaria/${inmobiliaria.slug}`;
};

const normalizeWhatsappNumber = (value = "") => {
  return value.toString().replace(/\D/g, "");
};

const buildWhatsappMessage = (inmueble) => {
  const pageUrl = getCurrentPageUrl(inmueble?.slug);

  const parts = [
    "Hola, me interesa este inmueble publicado en LaDocTaProp.",
    inmueble?.titulo ? `Inmueble: ${inmueble.titulo}` : "",
    inmueble?.operacion ? `Operación: ${inmueble.operacion}` : "",
    inmueble?.tipo ? `Tipo: ${inmueble.tipo}` : "",
    inmueble?.precio ? `Precio: ${formatPrice(inmueble)}` : "",
    pageUrl ? `Link: ${pageUrl}` : "",
  ].filter(Boolean);

  return parts.join("\n");
};

const buildWhatsappUrl = ({ whatsapp, inmueble }) => {
  const cleanNumber = normalizeWhatsappNumber(whatsapp);

  if (!cleanNumber) return null;

  const message = encodeURIComponent(buildWhatsappMessage(inmueble));

  return `https://wa.me/${cleanNumber}?text=${message}`;
};

const getFeatureItems = (inmueble) => {
  const items = [];

  if (inmueble.superficie?.total) {
    items.push({
      label: "Superficie total",
      value: `${formatNumber(inmueble.superficie.total)} m²`,
    });
  }

  if (inmueble.superficie?.cubierta) {
    items.push({
      label: "Cubierta",
      value: `${formatNumber(inmueble.superficie.cubierta)} m²`,
    });
  }

  if (inmueble.ambientes) {
    items.push({
      label: "Ambientes",
      value: inmueble.ambientes,
    });
  }

  if (inmueble.dormitorios) {
    items.push({
      label: "Dormitorios",
      value: inmueble.dormitorios,
    });
  }

  if (inmueble.banos) {
    items.push({
      label: "Baños",
      value: inmueble.banos,
    });
  }

  if (inmueble.cocheras) {
    items.push({
      label: "Cocheras",
      value: inmueble.cocheras,
    });
  }

  return items;
};

const getCurrencyCode = (moneda) => {
  const value = (moneda || "USD").toString().trim().toUpperCase();

  if (value === "$" || value === "ARS" || value.includes("PESO")) {
    return "ARS";
  }

  if (value === "U$S" || value === "US$" || value === "USD") {
    return "USD";
  }

  return value || "USD";
};

const getPropertySchemaType = (tipo = "") => {
  const normalizedTipo = tipo
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalizedTipo.includes("departamento")) return "Apartment";
  if (normalizedTipo.includes("casa")) return "House";
  if (normalizedTipo.includes("quinta")) return "House";

  return "Place";
};

const buildSeoTitle = (inmueble, inmobiliaria) => {
  const title = normalizeSeoText(inmueble?.titulo);
  const operation = capitalize(inmueble?.operacion);
  const type = capitalize(inmueble?.tipo);
  const city = getDireccionValue(inmueble, "ciudad");
  const agencyName = inmobiliaria?.nombre || "LaDoctaProp";

  if (title) {
    return `${title} | ${agencyName}`;
  }

  return [operation, type, city ? `en ${city}` : "", agencyName]
    .filter(Boolean)
    .join(" ");
};

const buildSeoDescription = ({ inmueble, inmobiliaria, address, featureItems }) => {
  const operation = capitalize(inmueble?.operacion);
  const type = capitalize(inmueble?.tipo);
  const price = formatPrice(inmueble);
  const agencyName = inmobiliaria?.nombre || "LaDoctaProp";

  const featureText =
    featureItems.length > 0
      ? featureItems
        .slice(0, 4)
        .map((item) => `${item.value} ${item.label.toLowerCase()}`)
        .join(", ")
      : "";

  const descriptionParts = [
    operation && type ? `${type} en ${operation}.` : "",
    address ? `Ubicación: ${address}.` : "",
    price ? `Precio: ${price}.` : "",
    featureText ? `Características: ${featureText}.` : "",
    inmueble?.descripcion ? normalizeSeoText(inmueble.descripcion) : "",
    `Publicado por ${agencyName}.`,
  ].filter(Boolean);

  return truncateText(descriptionParts.join(" "), 165);
};

const buildPropertyJsonLd = ({
  inmueble,
  inmobiliaria,
  seoTitle,
  seoDescription,
  seoUrl,
  seoImage,
  address,
  contactoInmobiliaria,
}) => {
  const locationParts = getLocationParts(inmueble);
  const price = toNumber(inmueble?.precio);
  const propertySchemaType = getPropertySchemaType(inmueble?.tipo);
  const agencyUrl = getAgencyUrl(inmobiliaria);

  return {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: seoTitle,
    description: seoDescription,
    url: seoUrl,
    image: seoImage,
    price: price || undefined,
    priceCurrency: getCurrencyCode(inmueble?.moneda),
    availability: "https://schema.org/InStock",
    itemOffered: {
      "@type": propertySchemaType,
      name: inmueble?.titulo || seoTitle,
      description: normalizeSeoText(inmueble?.descripcion) || seoDescription,
      image: seoImage,
      url: seoUrl,
      address: address
        ? {
          "@type": "PostalAddress",
          streetAddress: locationParts.streetAddress || undefined,
          addressLocality: locationParts.city || undefined,
          addressRegion: locationParts.province || undefined,
          addressCountry: "AR",
        }
        : undefined,
      floorSize: inmueble?.superficie?.cubierta
        ? {
          "@type": "QuantitativeValue",
          value: Number(inmueble.superficie.cubierta),
          unitCode: "MTK",
        }
        : undefined,
    },
    seller: inmobiliaria?.nombre
      ? {
        "@type": "RealEstateAgent",
        name: inmobiliaria.nombre,
        url: agencyUrl,
        telephone:
          contactoInmobiliaria?.telefono ||
          contactoInmobiliaria?.whatsapp ||
          undefined,
        email: contactoInmobiliaria?.email || undefined,
      }
      : undefined,
  };
};

const InmueblePublicPage = () => {
  const { slug } = useParams();

  const [inmueble, setInmueble] = useState(null);
  const [inmobiliaria, setInmobiliaria] = useState(null);

  const [loading, setLoading] = useState(true);
  const [contactLoading, setContactLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const [consultaValues, setConsultaValues] = useState(INITIAL_CONSULTA);
  const [consultaLoading, setConsultaLoading] = useState(false);
  const [consultaError, setConsultaError] = useState(null);
  const [consultaSuccess, setConsultaSuccess] = useState(false);

  const [copySuccess, setCopySuccess] = useState(false);

  const lastSearchUrl = useMemo(() => {
    if (typeof window === "undefined") return "/inmuebles";

    const storedUrl = window.sessionStorage.getItem("lastInmuebleSearchUrl");

    if (!storedUrl) return "/inmuebles";

    try {
      const url = new URL(storedUrl);

      if (url.origin !== window.location.origin) {
        return "/inmuebles";
      }

      return `${url.pathname}${url.search}`;
    } catch {
      return storedUrl.startsWith("/") ? storedUrl : "/inmuebles";
    }
  }, []);

  const sortedImages = useMemo(() => {
    if (!Array.isArray(inmueble?.images)) return [];

    return [...inmueble.images]
      .filter((img) => img?.url)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [inmueble]);

  const selectedImage = sortedImages[selectedImageIndex] || sortedImages[0];
  const visibleVideos = getVisibleInmuebleVideos(inmueble?.videos || []);
  const hasVideos = visibleVideos.length > 0;
  const address = buildAddress(inmueble);
  const featureItems = getFeatureItems(inmueble || {});
  const contactoInmobiliaria = useMemo(() => {
    return inmobiliaria?.configuracion?.contacto || {};
  }, [inmobiliaria]);
  const expensas = toNumber(inmueble?.expensas);

  const seoUrl = useMemo(() => {
    return getCurrentPageUrl(inmueble?.slug || slug);
  }, [inmueble?.slug, slug]);

  const seoImage = useMemo(() => {
    return selectedImage?.url || sortedImages[0]?.url || DEFAULT_SEO_IMAGE;
  }, [selectedImage?.url, sortedImages]);

  const seoTitle = useMemo(() => {
    return buildSeoTitle(inmueble, inmobiliaria);
  }, [inmobiliaria, inmueble]);

  const seoDescription = useMemo(() => {
    return buildSeoDescription({
      inmueble,
      inmobiliaria,
      address,
      featureItems,
    });
  }, [address, featureItems, inmobiliaria, inmueble]);

  const inmuebleJsonLd = useMemo(() => {
    if (!inmueble) return null;

    return buildPropertyJsonLd({
      inmueble,
      inmobiliaria,
      seoTitle,
      seoDescription,
      seoUrl,
      seoImage,
      address,
      contactoInmobiliaria,
    });
  }, [
    address,
    contactoInmobiliaria,
    inmobiliaria,
    inmueble,
    seoDescription,
    seoImage,
    seoTitle,
    seoUrl,
  ]);

  const whatsappUrl = useMemo(() => {
    return buildWhatsappUrl({
      whatsapp: contactoInmobiliaria.whatsapp,
      inmueble,
    });
  }, [contactoInmobiliaria.whatsapp, inmueble]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [slug]);

  useEffect(() => {
    const fetchInmueble = async () => {
      try {
        setLoading(true);
        setError(null);
        setInmobiliaria(null);

        if (!slug) {
          throw new Error("No se recibió el identificador del inmueble");
        }

        const data = await getPublicInmuebleBySlug(slug);

        if (!data) {
          setError("El inmueble no existe o ya no está publicado");
          return;
        }

        setInmueble(data);

        if (data.inmobiliariaId) {
          try {
            setContactLoading(true);

            const inmobiliariaData = await getPublicInmobiliariaById(
              data.inmobiliariaId,
            );

            setInmobiliaria(inmobiliariaData);
          } catch (contactErr) {
            console.warn(
              "No se pudieron cargar los datos públicos de la inmobiliaria:",
              contactErr,
            );
          } finally {
            setContactLoading(false);
          }
        }
      } catch (err) {
        console.error("Error cargando inmueble público:", err);

        if (err.code === "permission-denied") {
          setError("No se pudo acceder a este inmueble");
        } else {
          setError(err.message || "No se pudo cargar el inmueble");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInmueble();
  }, [slug]);

  const handleConsultaChange = (e) => {
    const { name, value } = e.target;

    setConsultaValues((prev) => ({
      ...prev,
      [name]: value,
    }));

    setConsultaError(null);
    setConsultaSuccess(false);
  };

  const handleConsultaSubmit = async (e) => {
    e.preventDefault();

    try {
      setConsultaLoading(true);
      setConsultaError(null);
      setConsultaSuccess(false);

      await createInmuebleConsulta({
        inmueble,
        ...consultaValues,
      });

      setConsultaValues(INITIAL_CONSULTA);
      setConsultaSuccess(true);
    } catch (err) {
      console.error("Error enviando consulta:", err);

      if (err.code === "permission-denied") {
        setConsultaError(
          "No se pudo enviar la consulta por permisos de la base de datos.",
        );
      } else {
        setConsultaError(err.message || "No se pudo enviar la consulta");
      }
    } finally {
      setConsultaLoading(false);
    }
  };

  const handleCopyInmuebleLink = async () => {
    try {
      const currentUrl = getCurrentPageUrl(inmueble?.slug);

      if (!currentUrl) {
        throw new Error("No se pudo obtener el link del inmueble");
      }

      await navigator.clipboard.writeText(currentUrl);

      setCopySuccess(true);

      window.setTimeout(() => {
        setCopySuccess(false);
      }, 2500);
    } catch (err) {
      console.error("Error copiando link del inmueble:", err);
      setCopySuccess(false);
      alert("No se pudo copiar el link del inmueble.");
    }
  };

  const handleShareInmuebleByWhatsapp = () => {
    try {
      const currentUrl = getCurrentPageUrl(inmueble?.slug);

      if (!currentUrl) {
        throw new Error("No se pudo obtener el link del inmueble");
      }

      const message = [
        "Te comparto este inmueble publicado en LaDocTaProp:",
        inmueble?.titulo ? `Inmueble: ${inmueble.titulo}` : "",
        inmueble?.operacion ? `Operación: ${inmueble.operacion}` : "",
        inmueble?.tipo ? `Tipo: ${inmueble.tipo}` : "",
        inmueble?.precio ? `Precio: ${formatPrice(inmueble)}` : "",
        currentUrl,
      ]
        .filter(Boolean)
        .join("\n");

      const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
        message,
      )}`;

      window.open(whatsappShareUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Error compartiendo inmueble por WhatsApp:", err);
      alert("No se pudo abrir WhatsApp para compartir el inmueble.");
    }
  };

  if (loading) {
    return (
      <main className="portal-home">
        <SEO
          title="Cargando inmueble | LaDoctaProp"
          description="Cargando ficha pública del inmueble."
          image={DEFAULT_SEO_IMAGE}
          url={getCurrentPageUrl(slug)}
          noIndex
        />

        <div className="container py-5">
          <div className="alert alert-light border">
            Cargando inmueble publicado...
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="portal-home">
        <SEO
          title="Inmueble no disponible | LaDoctaProp"
          description="El inmueble solicitado no existe, no está publicado o no se encuentra disponible."
          image={DEFAULT_SEO_IMAGE}
          url={getCurrentPageUrl(slug)}
          noIndex
        />

        <div className="container py-5">
          <div className="alert alert-warning mb-3">{error}</div>

          <Link to="/inmuebles" className="btn btn-primary">
            Volver al portal
          </Link>
        </div>
      </main>
    );
  }

  if (!inmueble) {
    return null;
  }

  return (
    <main className="portal-home">
      <SEO
        title={seoTitle}
        description={seoDescription}
        image={seoImage}
        url={seoUrl}
        type="article"
        siteName={inmobiliaria?.nombre || "LaDoctaProp"}
        jsonLd={inmuebleJsonLd}
      />

      <section className="py-4 py-lg-5">
        <div className="container">
          <div className="mb-4">
            <Link to={lastSearchUrl} className="btn btn-outline-secondary btn-sm">
              ← Volver a la búsqueda
            </Link>
          </div>

          {/* =========================
              Header comercial
             ========================= */}
          <section className="card border-0 shadow-sm overflow-hidden mb-4">
            <div className="row g-0">
              <div className="col-lg-7">
                <div className="p-3 p-lg-4">
                  <InmuebleMediaGallery
                    images={sortedImages}
                    title={inmueble.titulo}
                    selectedIndex={selectedImageIndex}
                    onSelectedIndexChange={setSelectedImageIndex}
                    mainImageHeight={520}
                  />
                </div>
              </div>

              <div className="col-lg-5">
                <div className="p-4 p-lg-5 h-100 d-flex flex-column">
                  <div className="mb-3 d-flex flex-wrap gap-2">
                    {inmueble.operacion && (
                      <span className="badge text-bg-primary">
                        {inmueble.operacion}
                      </span>
                    )}

                    {inmueble.tipo && (
                      <span className="badge text-bg-dark">{inmueble.tipo}</span>
                    )}

                    {inmueble.destacado && (
                      <span className="badge text-bg-warning">Destacado</span>
                    )}
                    {hasVideos && (
                      <span className="badge text-bg-success">🎥 Tiene video</span>
                    )}
                  </div>

                  <h1 className="display-6 fw-bold mb-3">{inmueble.titulo}</h1>

                  {address && <p className="text-muted mb-3">{address}</p>}

                  {inmobiliaria?.nombre && (
                    <p className="text-muted mb-4">
                      Publicado por{" "}
                      {inmobiliaria.slug ? (
                        <Link to={`/inmobiliaria/${inmobiliaria.slug}`}>
                          <strong>{inmobiliaria.nombre}</strong>
                        </Link>
                      ) : (
                        <strong>{inmobiliaria.nombre}</strong>
                      )}
                    </p>
                  )}

                  <div className="mb-4">
                    <div className="text-muted small">Precio</div>
                    <div className="display-6 fw-bold">{formatPrice(inmueble)}</div>

                    {expensas > 0 && (
                      <div className="text-muted mt-1">
                        Expensas: ${formatNumber(expensas)}
                      </div>
                    )}
                  </div>

                  {featureItems.length > 0 && (
                    <div className="row g-2 mb-4">
                      {featureItems.slice(0, 4).map((item) => (
                        <div className="col-6" key={item.label}>
                          <div className="border rounded-3 p-3 h-100 bg-white">
                            <div className="fw-semibold">{item.value}</div>
                            <div className="small text-muted">{item.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="d-grid gap-2 mt-auto">
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-success btn-lg"
                      >
                        Consultar por WhatsApp
                      </a>
                    )}

                    {hasVideos && (
                      <a href="#videos" className="btn btn-outline-primary">
                        Ver videos
                      </a>
                    )}

                    <a href="#consulta" className="btn btn-primary">
                      Enviar consulta
                    </a>

                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-primary w-50"
                        onClick={handleCopyInmuebleLink}
                      >
                        {copySuccess ? "Link copiado" : "Copiar link"}
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-success w-50"
                        onClick={handleShareInmuebleByWhatsapp}
                      >
                        Compartir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="row g-4">
            {/* =========================
                Información principal
               ========================= */}
            <section className="col-lg-8">
              <InmuebleVideoSection videos={visibleVideos} />
              {featureItems.length > 0 && (
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h2 className="h4 mb-3">Características</h2>

                    <div className="row g-3">
                      {featureItems.map((item) => (
                        <div className="col-6 col-md-4" key={item.label}>
                          <div className="border rounded-3 p-3 h-100">
                            <div className="h5 mb-1">{item.value}</div>
                            <div className="small text-muted">{item.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {inmueble.descripcion && (
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-4">
                    <h2 className="h4 mb-3">Descripción</h2>

                    <p
                      className="mb-0 text-muted"
                      style={{
                        whiteSpace: "pre-line",
                        fontSize: "1.05rem",
                      }}
                    >
                      {inmueble.descripcion}
                    </p>
                  </div>
                </div>
              )}

              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <h2 className="h4 mb-3">Ubicación</h2>

                  {address ? (
                    <p className="text-muted mb-0">{address}</p>
                  ) : (
                    <p className="text-muted mb-0">
                      La ubicación se informará al contactar.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* =========================
                Contacto / consulta
               ========================= */}
            <aside className="col-lg-4" id="consulta">
              <div className="card border-0 shadow-sm sticky-top" style={{ top: 90 }}>
                <div className="card-body p-4">
                  <h2 className="h4 mb-2">Consultar inmueble</h2>

                  <p className="text-muted">
                    Dejá tus datos y la inmobiliaria se pondrá en contacto para
                    brindarte más información.
                  </p>

                  {contactLoading && (
                    <p className="small text-muted">Cargando contacto...</p>
                  )}

                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-success w-100 mb-3"
                    >
                      Consultar por WhatsApp
                    </a>
                  )}

                  {inmobiliaria?.nombre && (
                    <div className="small text-muted mb-2">
                      Inmobiliaria: <strong>{inmobiliaria.nombre}</strong>
                    </div>
                  )}

                  {contactoInmobiliaria.email && (
                    <div className="small text-muted mb-2">
                      Email:{" "}
                      <a href={`mailto:${contactoInmobiliaria.email}`}>
                        {contactoInmobiliaria.email}
                      </a>
                    </div>
                  )}

                  {contactoInmobiliaria.telefono && (
                    <div className="small text-muted mb-3">
                      Teléfono:{" "}
                      <a href={`tel:${contactoInmobiliaria.telefono}`}>
                        {contactoInmobiliaria.telefono}
                      </a>
                    </div>
                  )}

                  {consultaSuccess && (
                    <div className="alert alert-success">
                      Consulta enviada correctamente. Gracias por contactarte.
                    </div>
                  )}

                  {consultaError && (
                    <div className="alert alert-danger">{consultaError}</div>
                  )}

                  <form onSubmit={handleConsultaSubmit}>
                    <div className="mb-3">
                      <label className="form-label">Nombre *</label>
                      <input
                        type="text"
                        name="nombre"
                        className="form-control"
                        value={consultaValues.nombre}
                        onChange={handleConsultaChange}
                        disabled={consultaLoading}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        name="email"
                        className="form-control"
                        value={consultaValues.email}
                        onChange={handleConsultaChange}
                        disabled={consultaLoading}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Teléfono / WhatsApp</label>
                      <input
                        type="tel"
                        name="telefono"
                        className="form-control"
                        value={consultaValues.telefono}
                        onChange={handleConsultaChange}
                        disabled={consultaLoading}
                      />
                      <div className="form-text">
                        Ingresá al menos un email o teléfono.
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Mensaje</label>
                      <textarea
                        name="mensaje"
                        className="form-control"
                        rows={4}
                        value={consultaValues.mensaje}
                        onChange={handleConsultaChange}
                        disabled={consultaLoading}
                        placeholder="Hola, me interesa este inmueble..."
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary w-100"
                      disabled={consultaLoading}
                    >
                      {consultaLoading ? "Enviando..." : "Enviar consulta"}
                    </button>
                  </form>

                  <hr />

                  <div className="small text-muted">Código interno: {inmueble.id}</div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
};

export default InmueblePublicPage;