import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import { getInmobiliariaBySlug } from "../services/inmobiliaria.service";
import { getPublicInmueblesByInmobiliaria } from "../../inmueble/services/inmueble.service";
import { getAgencySlugFromDomain } from "../utils/domainRouting";
import { useDomainAgency } from "../context/useDomainAgency";

import SEO from "../../components/SEO";

const INITIAL_FILTERS = {
  search: "",
  operacion: "",
  tipo: "",
};

const DEFAULT_SEO_IMAGE = "/assets/img/Logo.png";

const VERIFICATION_STATUS_CONFIG = {
  pendiente_documentacion: {
    label: "Pendiente de documentación para validar",
    cardLabel: "Perfil activo · Pendiente de documentación",
    alertClass: "alert-warning",
    title: "Inmobiliaria pendiente de documentación",
    description:
      "Esta inmobiliaria se encuentra activa en ONO Prop y puede operar, pero todavía debe presentar documentación legal y fiscal para completar su validación.",
  },
  pendiente_revision: {
    label: "Documentación en revisión",
    cardLabel: "Perfil activo · Documentación en revisión",
    alertClass: "alert-info",
    title: "Documentación en revisión",
    description:
      "Esta inmobiliaria ya presentó documentación y se encuentra en proceso de revisión por parte del equipo de ONO Prop.",
  },
  verificada: {
    label: "Inmobiliaria verificada",
    cardLabel: "Perfil comercial verificado",
    alertClass: "alert-success",
    title: "",
    description: "",
  },
  observada: {
    label: "Documentación observada",
    cardLabel: "Perfil activo · Documentación observada",
    alertClass: "alert-warning",
    title: "Documentación observada",
    description:
      "La documentación presentada por esta inmobiliaria requiere correcciones o información adicional para completar la validación.",
  },
  rechazada: {
    label: "Verificación rechazada",
    cardLabel: "Perfil no verificado",
    alertClass: "alert-danger",
    title: "Inmobiliaria no verificada",
    description:
      "Esta inmobiliaria no cuenta actualmente con validación aprobada en ONO Prop.",
  },
};

const getVerificationStatus = (inmobiliaria) => {
  const estado =
    inmobiliaria?.verificacion?.estado || "pendiente_documentacion";

  const config =
    VERIFICATION_STATUS_CONFIG[estado] ||
    VERIFICATION_STATUS_CONFIG.pendiente_documentacion;

  return {
    estado,
    ...config,
    label: inmobiliaria?.verificacion?.estadoLabel || config.label,
    showPublicAlert: estado !== "verificada",
  };
};

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

const buildAddress = (direccion = {}) => {
  return [direccion.barrio, direccion.ciudad].filter(Boolean).join(", ");
};

const getCoverImage = (inmueble) => {
  if (!Array.isArray(inmueble?.images)) return null;

  return [...inmueble.images]
    .filter((img) => img?.url)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
};

const normalizeText = (value = "") => {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const getUniqueOptions = (items, getter) => {
  const values = items
    .map(getter)
    .filter(Boolean)
    .map((value) => value.toString().trim())
    .filter(Boolean);

  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
};

const getCurrentInmobiliariaUrl = (slug) => {
  if (!slug) return "";

  if (typeof window === "undefined") {
    return `/inmobiliaria/${slug}`;
  }

  return `${window.location.origin}/inmobiliaria/${slug}`;
};

const buildWhatsappUrl = ({ whatsapp, inmobiliaria, slug }) => {
  if (!whatsapp) return null;

  const cleanNumber = whatsapp.toString().replace(/\D/g, "");

  if (!cleanNumber) return null;

  const pageUrl = getCurrentInmobiliariaUrl(slug);

  const message = [
    `Hola, quiero consultar por las propiedades de ${inmobiliaria?.nombre || "la inmobiliaria"
    }.`,
    pageUrl ? `Link: ${pageUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
};

const inmuebleMatchesFilters = (inmueble, filters) => {
  const normalizedSearch = normalizeText(filters.search);

  if (normalizedSearch) {
    const searchableText = [
      inmueble.titulo,
      inmueble.descripcion,
      inmueble.operacion,
      inmueble.tipo,
      inmueble.direccion?.barrio,
      inmueble.direccion?.ciudad,
    ]
      .filter(Boolean)
      .join(" ");

    if (!normalizeText(searchableText).includes(normalizedSearch)) {
      return false;
    }
  }

  if (filters.operacion && inmueble.operacion !== filters.operacion) {
    return false;
  }

  if (filters.tipo && inmueble.tipo !== filters.tipo) {
    return false;
  }

  return true;
};

const getFeaturedInmuebles = (inmuebles) => {
  const destacados = inmuebles.filter((inmueble) => inmueble.destacado);

  if (destacados.length > 0) {
    return destacados.slice(0, 3);
  }

  return inmuebles.slice(0, 3);
};

const buildSeoDescription = ({ inmobiliaria, contacto }) => {
  if (!inmobiliaria) {
    return "Sitio público de inmobiliaria en ONO Prop.";
  }

  return [
    inmobiliaria.razonSocial,
    `Conocé las propiedades publicadas por ${inmobiliaria.nombre}.`,
    contacto.telefono ? `Teléfono: ${contacto.telefono}.` : "",
    contacto.whatsapp ? `WhatsApp: ${contacto.whatsapp}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
};

const buildInmobiliariaJsonLd = ({
  inmobiliaria,
  contacto,
  seoUrl,
  seoImage,
}) => {
  if (!inmobiliaria) return null;

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: inmobiliaria.nombre,
    url: seoUrl,
    image: seoImage,
    telephone: contacto.telefono || contacto.whatsapp || undefined,
    email: contacto.email || undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality:
        inmobiliaria.configuracion?.ubicacion?.ciudad ||
        contacto.ciudad ||
        undefined,
      addressRegion:
        inmobiliaria.configuracion?.ubicacion?.provincia ||
        contacto.provincia ||
        undefined,
      addressCountry: "AR",
    },
  };
};

export default function InmobiliariaPublicPage({ forcedSlug = null }) {
  const { slug: routeSlug } = useParams();
  const { slug: contextDomainSlug } = useDomainAgency();

  const domainSlug = getAgencySlugFromDomain();
  const slug = routeSlug || forcedSlug || contextDomainSlug || domainSlug;

  const [inmobiliaria, setInmobiliaria] = useState(null);
  const [inmuebles, setInmuebles] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const [loading, setLoading] = useState(true);
  const [inmueblesLoading, setInmueblesLoading] = useState(false);

  const [error, setError] = useState(null);
  const [inmueblesError, setInmueblesError] = useState(null);

  const loadInmobiliaria = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setInmueblesError(null);

      if (!slug) {
        throw new Error("No se recibió el identificador de la inmobiliaria");
      }

      const data = await getInmobiliariaBySlug(slug);

      if (!data) {
        setError("Inmobiliaria no encontrada");
        return;
      }

      setInmobiliaria(data);

      const inmobiliariaId = data.id || data.inmobiliariaId;

      if (!inmobiliariaId) {
        setInmuebles([]);
        setInmueblesError(
          "No se pudo determinar el ID de la inmobiliaria para cargar sus inmuebles.",
        );
        return;
      }

      try {
        setInmueblesLoading(true);

        const result = await getPublicInmueblesByInmobiliaria(inmobiliariaId, {
          pageSize: 48,
        });

        setInmuebles(Array.isArray(result?.data) ? result.data : []);
      } catch (err) {
        console.error("Error cargando inmuebles de la inmobiliaria:", err);

        if (err.code === "permission-denied") {
          setInmueblesError(
            "No se pudieron cargar los inmuebles publicados de esta inmobiliaria.",
          );
        } else {
          setInmueblesError(
            err.message || "Error al cargar los inmuebles publicados.",
          );
        }
      } finally {
        setInmueblesLoading(false);
      }
    } catch (err) {
      console.error("Error cargando inmobiliaria:", err);

      if (err.code === "permission-denied") {
        setError("No se pudo acceder a la inmobiliaria");
      } else {
        setError(err.message || "Error al cargar la inmobiliaria");
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadInmobiliaria();
  }, [loadInmobiliaria]);

  const contacto = useMemo(() => {
    return inmobiliaria?.configuracion?.contacto || {};
  }, [inmobiliaria]);

  const whatsappUrl = useMemo(() => {
    return buildWhatsappUrl({
      whatsapp: contacto.whatsapp,
      inmobiliaria,
      slug,
    });
  }, [contacto.whatsapp, inmobiliaria, slug]);

  const seoTitle = useMemo(() => {
    return inmobiliaria?.nombre
      ? `${inmobiliaria.nombre} | Propiedades publicadas`
      : "Inmobiliaria | ONO Prop";
  }, [inmobiliaria]);

  const seoDescription = useMemo(() => {
    return buildSeoDescription({
      inmobiliaria,
      contacto,
    });
  }, [contacto, inmobiliaria]);

  const seoImage = useMemo(() => {
    return (
      inmobiliaria?.branding?.logo?.url ||
      inmobiliaria?.branding?.backgrounds?.hero?.url ||
      DEFAULT_SEO_IMAGE
    );
  }, [inmobiliaria]);

  const seoUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return window.location.href;
    }

    return slug ? `/inmobiliaria/${slug}` : "/";
  }, [slug]);

  const inmobiliariaJsonLd = useMemo(() => {
    return buildInmobiliariaJsonLd({
      inmobiliaria,
      contacto,
      seoUrl,
      seoImage,
    });
  }, [contacto, inmobiliaria, seoImage, seoUrl]);

  const shouldNoIndexInmobiliaria =
    inmobiliaria?.noIndex === true || inmobiliaria?.seo?.noIndex === true;

  const verificationStatus = useMemo(() => {
    return getVerificationStatus(inmobiliaria);
  }, [inmobiliaria]);

  const operacionesPermitidas =
    inmobiliaria?.configuracion?.operacionesPermitidas || [];

  const tiposPermitidos =
    inmobiliaria?.configuracion?.tiposInmueblePermitidos || [];

  const operacionesDisponibles = useMemo(() => {
    return getUniqueOptions(inmuebles, (inmueble) => inmueble.operacion);
  }, [inmuebles]);

  const tiposDisponibles = useMemo(() => {
    return getUniqueOptions(inmuebles, (inmueble) => inmueble.tipo);
  }, [inmuebles]);

  const filteredInmuebles = useMemo(() => {
    return inmuebles.filter((inmueble) =>
      inmuebleMatchesFilters(inmueble, filters),
    );
  }, [inmuebles, filters]);

  const featuredInmuebles = useMemo(() => {
    return getFeaturedInmuebles(inmuebles);
  }, [inmuebles]);

  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(Boolean).length;
  }, [filters]);

  const totalDestacados = useMemo(() => {
    return inmuebles.filter((inmueble) => inmueble.destacado).length;
  }, [inmuebles]);

  const operacionesTexto =
    operacionesPermitidas.length > 0
      ? operacionesPermitidas.join(", ")
      : "venta, alquiler y tasaciones";

  const tiposTexto =
    tiposPermitidos.length > 0
      ? tiposPermitidos.slice(0, 4).join(", ")
      : "casas, departamentos, terrenos y locales";

  const heroBackground =
    inmobiliaria?.branding?.backgrounds?.hero?.url ||
    inmobiliaria?.branding?.backgrounds?.principal?.url ||
    inmobiliaria?.branding?.backgrounds?.home?.url ||
    null;

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  if (loading) {
    return (
      <main className="portal-home">
        <SEO
          title="Cargando inmobiliaria | ONO Prop"
          description="Cargando sitio público de inmobiliaria."
          image={DEFAULT_SEO_IMAGE}
          url={seoUrl}
          noIndex
        />

        <div className="container py-5">
          <div className="alert alert-light border">Cargando inmobiliaria...</div>
        </div>
      </main>
    );
  }

  if (error || !inmobiliaria) {
    return (
      <main className="portal-home">
        <SEO
          title="Inmobiliaria no disponible | ONO Prop"
          description="La inmobiliaria solicitada no existe o no se encuentra disponible."
          image={DEFAULT_SEO_IMAGE}
          url={seoUrl}
          noIndex
        />

        <div className="container py-5">
          <div className="alert alert-danger">
            {error || "Inmobiliaria no encontrada"}
          </div>

          <Link to="/inmuebles" className="btn btn-primary">
            Ver portal de inmuebles
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="portal-home">
      <SEO
        title={seoTitle}
        description={seoDescription}
        image={seoImage}
        url={seoUrl}
        type="website"
        siteName={inmobiliaria?.nombre || "ONO Prop"}
        jsonLd={inmobiliariaJsonLd}
        noIndex={shouldNoIndexInmobiliaria}
      />

      {verificationStatus.showPublicAlert && (
        <section className="pt-4">
          <div className="container">
            <div
              className={`alert ${verificationStatus.alertClass} border shadow-sm mb-0`}
              role="alert"
            >
              <div className="d-flex flex-column flex-md-row gap-2 justify-content-between">
                <div>
                  <strong>{verificationStatus.title}</strong>

                  <p className="mb-0 mt-1">
                    {verificationStatus.description}
                  </p>
                </div>

                <span className="badge text-bg-light align-self-start">
                  {verificationStatus.label}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =========================
          Hero sitio inmobiliaria
         ========================= */}
      <section className="py-5">
        <div className="container">
          <div
            className="card border-0 shadow-sm overflow-hidden"
            style={{
              background: heroBackground
                ? `linear-gradient(90deg, rgba(17,24,39,0.92), rgba(17,24,39,0.62)), url(${heroBackground}) center/cover`
                : "linear-gradient(135deg, #111827, #0d6efd)",
              color: "#fff",
            }}
          >
            <div className="card-body p-4 p-lg-5">
              <div className="row align-items-center g-5">
                <div className="col-lg-8">
                  <div className="portal-eyebrow mb-3">
                    Sitio oficial de inmobiliaria
                  </div>

                  <h1 className="display-4 fw-bold mb-3">
                    {inmobiliaria.nombre}
                  </h1>

                  <p
                    className="lead mb-4"
                    style={{ color: "rgba(255,255,255,0.82)" }}
                  >
                    Propiedades seleccionadas, contacto directo y atención
                    personalizada. Encontrá opciones de {tiposTexto} para{" "}
                    {operacionesTexto}.
                  </p>

                  {inmobiliaria.razonSocial && (
                    <p
                      className="mb-4"
                      style={{ color: "rgba(255,255,255,0.72)" }}
                    >
                      {inmobiliaria.razonSocial}
                    </p>
                  )}

                  <div className="d-flex flex-wrap gap-2">
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

                    <a href="#inmuebles-publicados" className="btn btn-light btn-lg">
                      Ver inmuebles
                    </a>

                    <a href="#contacto" className="btn btn-outline-light btn-lg">
                      Contacto
                    </a>
                  </div>
                </div>

                <div className="col-lg-4">
                  <div className="bg-white text-dark rounded-4 p-4 shadow-sm">
                    <div className="d-flex align-items-center gap-3 mb-4">
                      {inmobiliaria.branding?.logo?.url ? (
                        <img
                          src={inmobiliaria.branding.logo.url}
                          alt={`Logo ${inmobiliaria.nombre}`}
                          className="rounded border"
                          style={{
                            width: 76,
                            height: 76,
                            objectFit: "contain",
                            background: "#fff",
                          }}
                        />
                      ) : (
                        <div
                          className="rounded border d-flex align-items-center justify-content-center bg-light"
                          style={{ width: 76, height: 76 }}
                        >
                          {inmobiliaria.nombre?.slice(0, 2)?.toUpperCase()}
                        </div>
                      )}

                      <div>
                        <div className="fw-bold">{inmobiliaria.nombre}</div>
                        <div className="small text-muted">
                          {verificationStatus.cardLabel}
                        </div>
                      </div>
                    </div>

                    <div className="row g-2">
                      <div className="col-6">
                        <div className="border rounded-3 p-3">
                          <div className="h4 mb-0">{inmuebles.length}</div>
                          <div className="small text-muted">Publicaciones</div>
                        </div>
                      </div>

                      <div className="col-6">
                        <div className="border rounded-3 p-3">
                          <div className="h4 mb-0">{totalDestacados}</div>
                          <div className="small text-muted">Destacadas</div>
                        </div>
                      </div>

                      <div className="col-12">
                        <div className="border rounded-3 p-3">
                          <div className="small text-muted mb-1">
                            Contacto directo
                          </div>

                          {contacto.whatsapp ? (
                            <div className="fw-semibold">{contacto.whatsapp}</div>
                          ) : contacto.telefono ? (
                            <div className="fw-semibold">{contacto.telefono}</div>
                          ) : contacto.email ? (
                            <div className="fw-semibold">{contacto.email}</div>
                          ) : (
                            <div className="text-muted">Consultar publicación</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          Destacados
         ========================= */}
      {featuredInmuebles.length > 0 && (
        <section className="pb-5">
          <div className="container">
            <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
              <div>
                <p className="text-uppercase text-muted small mb-1">
                  Selección destacada
                </p>

                <h2 className="portal-section-title mb-0">
                  Propiedades recomendadas
                </h2>
              </div>

              <a href="#inmuebles-publicados" className="btn btn-outline-primary">
                Ver todas
              </a>
            </div>

            <div className="row g-4">
              {featuredInmuebles.map((inmueble) => {
                const coverImage = getCoverImage(inmueble);
                const address = buildAddress(inmueble.direccion);
                const detailUrl = inmueble.slug
                  ? `/inmueble/${inmueble.slug}`
                  : null;

                return (
                  <article className="col-12 col-md-6 col-xl-4" key={inmueble.id}>
                    <div className="card h-100 border-0 shadow-sm overflow-hidden">
                      {coverImage ? (
                        <img
                          src={coverImage.url}
                          alt={inmueble.titulo}
                          className="card-img-top"
                          style={{
                            height: 250,
                            objectFit: "cover",
                          }}
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="bg-light d-flex align-items-center justify-content-center text-muted"
                          style={{ height: 250 }}
                        >
                          Sin imagen
                        </div>
                      )}

                      <div className="card-body p-4 d-flex flex-column">
                        <div className="d-flex flex-wrap gap-2 mb-2">
                          {inmueble.operacion && (
                            <span className="badge text-bg-primary">
                              {inmueble.operacion}
                            </span>
                          )}

                          {inmueble.tipo && (
                            <span className="badge text-bg-dark">
                              {inmueble.tipo}
                            </span>
                          )}

                          {inmueble.destacado && (
                            <span className="badge text-bg-warning">
                              Destacado
                            </span>
                          )}
                        </div>

                        <h3 className="h5">{inmueble.titulo}</h3>

                        {address && (
                          <p className="text-muted small mb-2">{address}</p>
                        )}

                        <div className="h4 mb-3">{formatPrice(inmueble)}</div>

                        <div className="small text-muted mb-3">
                          {inmueble.ambientes && (
                            <span>{inmueble.ambientes} amb.</span>
                          )}

                          {inmueble.dormitorios && (
                            <span> · {inmueble.dormitorios} dorm.</span>
                          )}

                          {inmueble.superficie?.total && (
                            <span>
                              {" "}
                              · {formatNumber(inmueble.superficie.total)} m²
                            </span>
                          )}
                        </div>

                        <div className="mt-auto d-grid">
                          {detailUrl ? (
                            <Link to={detailUrl} className="btn btn-primary">
                              Ver inmueble
                            </Link>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              disabled
                            >
                              Sin enlace público
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* =========================
          Contacto y especialidades
         ========================= */}
      <section id="contacto" className="pb-5">
        <div className="container">
          <div className="row g-4">
            <div className="col-lg-5">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body p-4">
                  <h2 className="h4 mb-3">Contacto directo</h2>

                  <p className="text-muted">
                    Comunicate con {inmobiliaria.nombre} para coordinar una
                    visita, consultar disponibilidad o pedir más información.
                  </p>

                  {contacto.email && (
                    <p className="mb-2">
                      <strong>Email:</strong>{" "}
                      <a href={`mailto:${contacto.email}`}>{contacto.email}</a>
                    </p>
                  )}

                  {contacto.telefono && (
                    <p className="mb-2">
                      <strong>Teléfono:</strong>{" "}
                      <a href={`tel:${contacto.telefono}`}>{contacto.telefono}</a>
                    </p>
                  )}

                  {contacto.whatsapp && (
                    <p className="mb-3">
                      <strong>WhatsApp:</strong>{" "}
                      {whatsappUrl ? (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {contacto.whatsapp}
                        </a>
                      ) : (
                        contacto.whatsapp
                      )}
                    </p>
                  )}

                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-success w-100"
                    >
                      Escribir por WhatsApp
                    </a>
                  )}

                  {!contacto.email && !contacto.telefono && !contacto.whatsapp && (
                    <p className="text-muted mb-0">
                      Esta inmobiliaria todavía no cargó datos de contacto
                      públicos.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="col-lg-7">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-body p-4">
                  <h2 className="h4 mb-3">Qué podés encontrar</h2>

                  {operacionesPermitidas.length > 0 && (
                    <div className="mb-3">
                      <div className="small text-muted mb-2">Operaciones</div>

                      <div className="d-flex flex-wrap gap-2">
                        {operacionesPermitidas.map((op, index) => (
                          <span
                            key={`${op}-${index}`}
                            className="badge text-bg-primary"
                          >
                            {op}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {tiposPermitidos.length > 0 && (
                    <div>
                      <div className="small text-muted mb-2">
                        Tipos de inmuebles
                      </div>

                      <div className="d-flex flex-wrap gap-2">
                        {tiposPermitidos.map((tipo, index) => (
                          <span
                            key={`${tipo}-${index}`}
                            className="badge text-bg-success"
                          >
                            {tipo}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {operacionesPermitidas.length === 0 &&
                    tiposPermitidos.length === 0 && (
                      <p className="text-muted mb-0">
                        Consultá las propiedades disponibles y las oportunidades
                        activas de esta inmobiliaria.
                      </p>
                    )}

                  {inmobiliaria.cuit && (
                    <p className="text-muted small mb-0 mt-4 pt-3 border-top">
                      <strong>CUIT:</strong> {inmobiliaria.cuit}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          Inmuebles publicados
         ========================= */}
      <section id="inmuebles-publicados" className="pb-5">
        <div className="container">
          <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
            <div>
              <p className="text-uppercase text-muted small mb-1">
                Propiedades publicadas
              </p>

              <h2 className="portal-section-title mb-1">
                Inmuebles de {inmobiliaria.nombre}
              </h2>

              <p className="text-muted mb-0">
                {filteredInmuebles.length} resultado
                {filteredInmuebles.length === 1 ? "" : "s"} disponible
                {filteredInmuebles.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="portal-search-card card mb-4">
            <div className="card-body p-3 p-lg-4">
              <div className="row g-3 align-items-end">
                <div className="col-12 col-lg-5">
                  <label className="form-label">
                    Buscar dentro de esta inmobiliaria
                  </label>
                  <input
                    type="search"
                    name="search"
                    className="form-control form-control-lg"
                    placeholder="Título, barrio, ciudad, tipo..."
                    value={filters.search}
                    onChange={handleFilterChange}
                  />
                </div>

                <div className="col-6 col-lg-3">
                  <label className="form-label">Operación</label>
                  <select
                    name="operacion"
                    className="form-select"
                    value={filters.operacion}
                    onChange={handleFilterChange}
                  >
                    <option value="">Todas</option>
                    {operacionesDisponibles.map((operacion) => (
                      <option key={operacion} value={operacion}>
                        {operacion}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-6 col-lg-3">
                  <label className="form-label">Tipo</label>
                  <select
                    name="tipo"
                    className="form-select"
                    value={filters.tipo}
                    onChange={handleFilterChange}
                  >
                    <option value="">Todos</option>
                    {tiposDisponibles.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-lg-1 d-grid">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={handleClearFilters}
                    disabled={activeFiltersCount === 0}
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {inmueblesLoading && (
            <div className="alert alert-light border">
              Cargando inmuebles publicados...
            </div>
          )}

          {inmueblesError && (
            <div className="alert alert-warning">{inmueblesError}</div>
          )}

          {!inmueblesLoading && !inmueblesError && inmuebles.length === 0 && (
            <div className="alert alert-info">
              Esta inmobiliaria todavía no tiene inmuebles publicados en el
              portal.
            </div>
          )}

          {!inmueblesLoading &&
            !inmueblesError &&
            inmuebles.length > 0 &&
            filteredInmuebles.length === 0 && (
              <div className="alert alert-info">
                No encontramos inmuebles con esos filtros dentro de esta
                inmobiliaria.
              </div>
            )}

          {!inmueblesLoading && !inmueblesError && filteredInmuebles.length > 0 && (
            <div className="row g-4">
              {filteredInmuebles.map((inmueble) => {
                const coverImage = getCoverImage(inmueble);
                const address = buildAddress(inmueble.direccion);
                const detailUrl = inmueble.slug
                  ? `/inmueble/${inmueble.slug}`
                  : null;

                return (
                  <article
                    className="col-12 col-md-6 col-xl-4"
                    key={inmueble.id}
                  >
                    <div className="card h-100 border-0 shadow-sm overflow-hidden">
                      <div className="position-relative">
                        {coverImage ? (
                          <img
                            src={coverImage.url}
                            alt={inmueble.titulo}
                            className="card-img-top"
                            style={{
                              height: 240,
                              objectFit: "cover",
                            }}
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="bg-light d-flex align-items-center justify-content-center text-muted"
                            style={{ height: 240 }}
                          >
                            Sin imagen
                          </div>
                        )}

                        <div className="position-absolute top-0 start-0 p-3 d-flex flex-wrap gap-2">
                          {inmueble.operacion && (
                            <span className="badge text-bg-primary">
                              {inmueble.operacion}
                            </span>
                          )}

                          {inmueble.tipo && (
                            <span className="badge text-bg-dark">
                              {inmueble.tipo}
                            </span>
                          )}
                        </div>

                        {inmueble.destacado && (
                          <div className="position-absolute top-0 end-0 p-3">
                            <span className="badge text-bg-warning">
                              Destacado
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="card-body d-flex flex-column p-4">
                        <h3 className="h5 card-title">{inmueble.titulo}</h3>

                        {address && (
                          <p className="text-muted small mb-2">{address}</p>
                        )}

                        <p className="h4 mb-3">{formatPrice(inmueble)}</p>

                        <div className="small text-muted mb-3">
                          {inmueble.ambientes && (
                            <span>{inmueble.ambientes} amb.</span>
                          )}

                          {inmueble.dormitorios && (
                            <span> · {inmueble.dormitorios} dorm.</span>
                          )}

                          {inmueble.superficie?.total && (
                            <span>
                              {" "}
                              · {formatNumber(inmueble.superficie.total)} m²
                            </span>
                          )}
                        </div>

                        <div className="mt-auto d-grid">
                          {detailUrl ? (
                            <Link
                              to={detailUrl}
                              className="btn btn-primary"
                              onClick={() => {
                                if (typeof window !== "undefined") {
                                  window.sessionStorage.setItem(
                                    "lastInmuebleSearchUrl",
                                    window.location.href,
                                  );
                                }
                              }}
                            >
                              Ver inmueble
                            </Link>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              disabled
                            >
                              Sin enlace público
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}