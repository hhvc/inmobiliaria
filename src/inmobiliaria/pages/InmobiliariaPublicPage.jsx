import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import {
  getInmobiliariaBySlug,
} from "../services/inmobiliaria.service";
import { getPublicInmueblesByInmobiliaria } from "../../inmueble/services/inmueble.service";
import { getVisibleInmuebleVideos } from "../../inmueble/utils/inmuebleVideos.helpers";
import { getAgencySlugFromDomain } from "../utils/domainRouting";
import { useDomainAgency } from "../context/useDomainAgency";
import {
  getInmuebleAmenityBadges,
  getInmuebleFeatureBadges,
  getBanos,
  getCocherasCantidad,
  getDormitorios,
  getSuperficiePrincipal,
  inmuebleHasAmenity,
} from "../../inmueble/utils/inmuebleDisplay.helpers";

const INITIAL_FILTERS = {
  search: "",
  operacion: "",
  tipo: "",
  ciudad: "",
  barrio: "",
  dormitoriosMin: "",
  banosMin: "",
  cocherasMin: "",
  superficieMin: "",
  piscina: false,
  patio: false,
  jardin: false,
  aptoCredito: false,
  sortBy: "destacados",
};

const DEFAULT_SEO_IMAGE = "/assets/img/Logo.png";

const SORT_OPTIONS = [
  { value: "destacados", label: "Destacados primero" },
  { value: "recientes", label: "Más recientes" },
  { value: "precio_asc", label: "Precio menor a mayor" },
  { value: "precio_desc", label: "Precio mayor a menor" },
  { value: "dormitorios_desc", label: "Más dormitorios" },
  { value: "superficie_desc", label: "Mayor superficie" },
];

const AMENITY_FILTERS = [
  { key: "piscina", label: "Piscina" },
  { key: "patio", label: "Patio" },
  { key: "jardin", label: "Jardín" },
  { key: "aptoCredito", label: "Apto crédito" },
];

const normalizeText = (value = "") => {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const normalizeSeoText = (value = "") => {
  return value.toString().replace(/\s+/g, " ").trim();
};

const truncateText = (value = "", maxLength = 165) => {
  const cleanValue = normalizeSeoText(value);

  if (cleanValue.length <= maxLength) return cleanValue;

  return `${cleanValue.slice(0, maxLength - 1).trim()}…`;
};

const capitalize = (value = "") => {
  const cleanValue = normalizeSeoText(value);

  if (!cleanValue) return "";

  return cleanValue.charAt(0).toUpperCase() + cleanValue.slice(1);
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;

  const cleanValue = value
    .toString()
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const number = Number(cleanValue);

  return Number.isFinite(number) ? number : null;
};

const formatPrice = (inmueble) => {
  if (inmueble?.precioLabel) return inmueble.precioLabel;
  if (!inmueble?.precio) return "Consultar";

  const moneda = inmueble.moneda || "USD";
  const precio = Number(inmueble.precio);

  if (!Number.isFinite(precio)) {
    return `${moneda} ${inmueble.precio}`;
  }

  return `${moneda} ${precio.toLocaleString("es-AR")}`;
};

const getDireccionValue = (inmueble, key) => {
  return inmueble?.direccion?.[key] || inmueble?.[key] || "";
};

const buildAddress = (inmueble = {}) => {
  return [
    getDireccionValue(inmueble, "barrio"),
    getDireccionValue(inmueble, "ciudad"),
  ]
    .filter(Boolean)
    .join(", ");
};

const getCoverImage = (inmueble) => {
  if (!Array.isArray(inmueble?.images)) return null;

  return [...inmueble.images]
    .filter((img) => img?.url)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
};

const getPhotoCount = (inmueble) => {
  if (!Array.isArray(inmueble?.images)) return 0;

  return inmueble.images.filter((image) => image?.url).length;
};

const getUniqueOptions = (items, getter) => {
  const values = items
    .map(getter)
    .filter(Boolean)
    .map((value) => value.toString().trim())
    .filter(Boolean);

  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
};

const getDateValue = (value) => {
  if (!value) return 0;

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
};

const getCurrentInmobiliariaUrl = (slug) => {
  if (!slug) return "";

  if (typeof window === "undefined") {
    return `/inmobiliaria/${slug}`;
  }

  return `${window.location.origin}/inmobiliaria/${slug}`;
};

const buildInmuebleUrl = (inmueble = {}) => {
  if (inmueble.publicPath) return inmueble.publicPath;

  const slugOrId = inmueble.slug || inmueble.id;

  return slugOrId ? `/inmueble/${slugOrId}` : "/inmuebles";
};

const normalizeWhatsappNumber = (value = "") => {
  return value.toString().replace(/\D/g, "");
};

const buildWhatsappUrl = ({ whatsapp, inmobiliaria, slug }) => {
  const cleanNumber = normalizeWhatsappNumber(whatsapp);

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

const getLogoUrl = (inmobiliaria = {}) => {
  const safeInmobiliaria = inmobiliaria || {};

  const branding =
    safeInmobiliaria.branding && typeof safeInmobiliaria.branding === "object"
      ? safeInmobiliaria.branding
      : {};

  return (
    safeInmobiliaria.logoUrl ||
    safeInmobiliaria.logo ||
    branding.logoUrl ||
    branding.logo?.url ||
    branding.logo ||
    branding.isologoUrl ||
    ""
  );
};

const getHeroBackgroundUrl = (inmobiliaria = {}) => {
  const safeInmobiliaria = inmobiliaria || {};

  const branding =
    safeInmobiliaria.branding && typeof safeInmobiliaria.branding === "object"
      ? safeInmobiliaria.branding
      : {};

  return (
    branding.backgrounds?.hero?.url ||
    branding.backgrounds?.principal?.url ||
    branding.backgrounds?.home?.url ||
    branding.heroUrl ||
    branding.coverUrl ||
    safeInmobiliaria.heroImageUrl ||
    safeInmobiliaria.coverUrl ||
    ""
  );
};

const isVerifiedAgency = (inmobiliaria = {}) => {
  return inmobiliaria?.verificacion?.estado === "verificada";
};

const getVerificationLabel = (inmobiliaria = {}) => {
  if (isVerifiedAgency(inmobiliaria)) return "Inmobiliaria verificada";

  return (
    inmobiliaria?.verificacion?.estadoLabel ||
    inmobiliaria?.verificacion?.estado ||
    "Pendiente de validación"
  );
};

const inmuebleMatchesFilters = (inmueble, filters) => {
  const normalizedSearch = normalizeText(filters.search);

  if (normalizedSearch) {
    const searchableText = [
      inmueble.titulo,
      inmueble.descripcion,
      inmueble.operacion,
      inmueble.tipo,
      inmueble.direccion?.calle,
      inmueble.direccion?.barrio,
      inmueble.direccion?.ciudad,
      inmueble.direccion?.provincia,
      inmueble.ubicacion,
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

  if (
    filters.ciudad &&
    normalizeText(getDireccionValue(inmueble, "ciudad")) !==
    normalizeText(filters.ciudad)
  ) {
    return false;
  }

  if (
    filters.barrio &&
    normalizeText(getDireccionValue(inmueble, "barrio")) !==
    normalizeText(filters.barrio)
  ) {
    return false;
  }

  const dormitoriosMin = toNumber(filters.dormitoriosMin);
  const banosMin = toNumber(filters.banosMin);
  const cocherasMin = toNumber(filters.cocherasMin);
  const superficieMin = toNumber(filters.superficieMin);

  const dormitorios = toNumber(getDormitorios(inmueble));
  const banos = toNumber(getBanos(inmueble));
  const cocheras = toNumber(getCocherasCantidad(inmueble));
  const superficie = toNumber(getSuperficiePrincipal(inmueble));

  if (
    dormitoriosMin !== null &&
    (dormitorios === null || dormitorios < dormitoriosMin)
  ) {
    return false;
  }

  if (banosMin !== null && (banos === null || banos < banosMin)) {
    return false;
  }

  if (cocherasMin !== null && (cocheras === null || cocheras < cocherasMin)) {
    return false;
  }

  if (
    superficieMin !== null &&
    (superficie === null || superficie < superficieMin)
  ) {
    return false;
  }

  if (filters.piscina && !inmuebleHasAmenity(inmueble, "piscina")) {
    return false;
  }

  if (filters.patio && !inmuebleHasAmenity(inmueble, "patio")) {
    return false;
  }

  if (filters.jardin && !inmuebleHasAmenity(inmueble, "jardin")) {
    return false;
  }

  if (filters.aptoCredito && !inmuebleHasAmenity(inmueble, "aptoCredito")) {
    return false;
  }

  return true;
};

const sortInmuebles = (items, sortBy) => {
  const sortedItems = [...items];

  sortedItems.sort((a, b) => {
    if (sortBy === "recientes") {
      return getDateValue(b.createdAt) - getDateValue(a.createdAt);
    }

    if (sortBy === "precio_asc") {
      const priceA = toNumber(a.precio);
      const priceB = toNumber(b.precio);

      if (priceA === null && priceB === null) return 0;
      if (priceA === null) return 1;
      if (priceB === null) return -1;

      return priceA - priceB;
    }

    if (sortBy === "precio_desc") {
      const priceA = toNumber(a.precio);
      const priceB = toNumber(b.precio);

      if (priceA === null && priceB === null) return 0;
      if (priceA === null) return 1;
      if (priceB === null) return -1;

      return priceB - priceA;
    }

    if (sortBy === "dormitorios_desc") {
      return (
        (toNumber(getDormitorios(b)) || 0) -
        (toNumber(getDormitorios(a)) || 0)
      );
    }

    if (sortBy === "superficie_desc") {
      return (
        (toNumber(getSuperficiePrincipal(b)) || 0) -
        (toNumber(getSuperficiePrincipal(a)) || 0)
      );
    }

    if (a.destacado !== b.destacado) {
      return Number(Boolean(b.destacado)) - Number(Boolean(a.destacado));
    }

    return getDateValue(b.createdAt) - getDateValue(a.createdAt);
  });

  return sortedItems;
};

const getFeaturedInmuebles = (inmuebles) => {
  const destacados = inmuebles.filter((inmueble) => inmueble.destacado);

  if (destacados.length > 0) {
    return destacados.slice(0, 3);
  }

  return inmuebles.slice(0, 3);
};

const getOperationTypeLabel = (inmueble = {}) => {
  return [capitalize(inmueble.operacion), capitalize(inmueble.tipo)]
    .filter(Boolean)
    .join(" · ");
};

const getActiveFilterBadges = (filters) => {
  const badges = [];

  if (filters.search) badges.push({ key: "search", label: filters.search });
  if (filters.operacion) badges.push({ key: "operacion", label: filters.operacion });
  if (filters.tipo) badges.push({ key: "tipo", label: filters.tipo });
  if (filters.ciudad) badges.push({ key: "ciudad", label: filters.ciudad });
  if (filters.barrio) badges.push({ key: "barrio", label: filters.barrio });
  if (filters.dormitoriosMin) {
    badges.push({ key: "dormitoriosMin", label: `${filters.dormitoriosMin}+ dorm.` });
  }
  if (filters.banosMin) {
    badges.push({ key: "banosMin", label: `${filters.banosMin}+ baños` });
  }
  if (filters.cocherasMin) {
    badges.push({ key: "cocherasMin", label: `${filters.cocherasMin}+ coch.` });
  }
  if (filters.superficieMin) {
    badges.push({ key: "superficieMin", label: `${filters.superficieMin}+ m²` });
  }

  AMENITY_FILTERS.forEach((filter) => {
    if (filters[filter.key]) {
      badges.push({ key: filter.key, label: filter.label });
    }
  });

  if (filters.sortBy && filters.sortBy !== INITIAL_FILTERS.sortBy) {
    badges.push({ key: "sortBy", label: `Orden: ${filters.sortBy}` });
  }

  return badges;
};

const buildSeoDescription = ({ inmobiliaria, contacto, inmueblesCount }) => {
  if (!inmobiliaria) {
    return "Sitio público de inmobiliaria en ONO Prop.";
  }

  return truncateText(
    [
      inmobiliaria.razonSocial,
      `Conocé ${inmueblesCount || "las"} propiedades publicadas por ${inmobiliaria?.nombre
      }.`,
      contacto.telefono ? `Teléfono: ${contacto.telefono}.` : "",
      contacto.whatsapp ? `WhatsApp: ${contacto.whatsapp}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    165,
  );
};

const buildInmobiliariaJsonLd = ({
  inmobiliaria,
  contacto,
  seoUrl,
  seoImage,
  inmuebles,
}) => {
  if (!inmobiliaria) return null;

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: inmobiliaria?.nombre,
    url: seoUrl,
    image: seoImage,
    telephone: contacto.telefono || contacto.whatsapp || undefined,
    email: contacto.email || undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality:
        inmobiliaria?.configuracion?.ubicacion?.ciudad ||
        contacto.ciudad ||
        undefined,
      addressRegion:
        inmobiliaria?.configuracion?.ubicacion?.provincia ||
        contacto.provincia ||
        undefined,
      addressCountry: "AR",
    },
    makesOffer: inmuebles.slice(0, 20).map((inmueble) => ({
      "@type": "Offer",
      name: inmueble.titulo || "Inmueble publicado",
      url:
        typeof window !== "undefined"
          ? `${window.location.origin}${buildInmuebleUrl(inmueble)}`
          : buildInmuebleUrl(inmueble),
      price: toNumber(inmueble.precio) || undefined,
      priceCurrency: inmueble.moneda || "USD",
      itemOffered: {
        "@type": "Place",
        name: inmueble.titulo || "Inmueble publicado",
        address: buildAddress(inmueble) || undefined,
      },
    })),
  };
};

const InmueblePublicCard = ({ inmueble }) => {
  const coverImage = getCoverImage(inmueble);
  const detailUrl = buildInmuebleUrl(inmueble);
  const featureItems = getInmuebleFeatureBadges(inmueble);
  const amenityItems = getInmuebleAmenityBadges(inmueble, 4);
  const address = buildAddress(inmueble);
  const photoCount = getPhotoCount(inmueble);

  const visibleVideos = getVisibleInmuebleVideos(inmueble?.videos || []);
  const videoCount = visibleVideos.length;
  const hasVideos = videoCount > 0;

  return (
    <article className="card h-100 shadow-sm border-0 overflow-hidden portal-listing-card">
      <div className="position-relative portal-listing-image-wrap">
        <Link to={detailUrl} className="text-decoration-none">
          {coverImage ? (
            <img
              src={coverImage.url}
              alt={inmueble.titulo || "Inmueble publicado"}
              className="card-img-top portal-listing-image"
              loading="lazy"
            />
          ) : (
            <div className="portal-listing-image-empty">Sin imagen</div>
          )}
        </Link>

        <div className="position-absolute top-0 start-0 p-3 d-flex flex-wrap gap-2">
          {inmueble.operacion && (
            <span className="badge text-bg-primary">
              {capitalize(inmueble.operacion)}
            </span>
          )}

          {inmueble.tipo && (
            <span className="badge text-bg-dark">
              {capitalize(inmueble.tipo)}
            </span>
          )}
        </div>

        {inmueble.destacado && (
          <div className="position-absolute top-0 end-0 p-3">
            <span className="badge text-bg-warning">★ Destacado</span>
          </div>
        )}

        {hasVideos && (
          <div className="position-absolute bottom-0 start-0 p-3">
            <span className="badge text-bg-danger shadow-sm">
              🎥 {videoCount} video{videoCount === 1 ? "" : "s"}
            </span>
          </div>
        )}

        {photoCount > 0 && (
          <div className="position-absolute bottom-0 end-0 p-3">
            <span className="badge text-bg-dark bg-opacity-75">
              {photoCount} foto{photoCount === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>

      <div className="card-body d-flex flex-column p-4">
        <div className="d-flex flex-wrap gap-2 mb-2">
          {hasVideos && (
            <span className="badge text-bg-danger">🎥 Tiene video</span>
          )}

          {inmueble.destacado && (
            <span className="badge text-bg-warning">Destacado</span>
          )}
        </div>

        <Link to={detailUrl} className="text-decoration-none text-dark">
          <h3 className="h5 mb-2 portal-listing-title">
            {inmueble.titulo || "Inmueble publicado"}
          </h3>
        </Link>

        {address && <p className="text-muted small mb-2">📍 {address}</p>}

        {getOperationTypeLabel(inmueble) && (
          <p className="text-muted small mb-2">
            {getOperationTypeLabel(inmueble)}
          </p>
        )}

        <div className="h4 mb-3 portal-listing-price">
          {formatPrice(inmueble)}
        </div>

        {featureItems.length > 0 && (
          <div className="d-flex flex-wrap gap-2 small text-muted mb-3">
            {featureItems.map((item) => (
              <span
                className="border rounded-pill px-2 py-1 bg-light"
                key={item.key}
              >
                {item.label}
              </span>
            ))}
          </div>
        )}

        {amenityItems.length > 0 && (
          <div className="d-flex flex-wrap gap-2 small mb-3">
            {amenityItems.map((item) => (
              <span
                className="badge text-bg-light border text-dark"
                key={item.key}
              >
                {item.label}
              </span>
            ))}
          </div>
        )}

        {inmueble.descripcion && (
          <p className="text-muted small mb-4">
            {truncateText(inmueble.descripcion, 110)}
          </p>
        )}

        <div className="mt-auto d-grid">
          <Link to={detailUrl} className="btn btn-primary">
            {hasVideos ? "Ver video y detalle" : "Ver inmueble"}
          </Link>
        </div>
      </div>
    </article>
  );
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
  const [copySuccess, setCopySuccess] = useState(false);

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
          pageSize: 72,
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

  const operacionesPermitidas =
    inmobiliaria?.configuracion?.operacionesPermitidas || [];

  const tiposPermitidos =
    inmobiliaria?.configuracion?.tiposInmueblePermitidos || [];

  const ciudades = useMemo(() => {
    return getUniqueOptions(inmuebles, (inmueble) =>
      getDireccionValue(inmueble, "ciudad"),
    );
  }, [inmuebles]);

  const barrios = useMemo(() => {
    const filteredByCiudad = filters.ciudad
      ? inmuebles.filter(
        (inmueble) =>
          normalizeText(getDireccionValue(inmueble, "ciudad")) ===
          normalizeText(filters.ciudad),
      )
      : inmuebles;

    return getUniqueOptions(filteredByCiudad, (inmueble) =>
      getDireccionValue(inmueble, "barrio"),
    );
  }, [filters.ciudad, inmuebles]);

  const operacionesDisponibles = useMemo(() => {
    return getUniqueOptions(inmuebles, (inmueble) => inmueble.operacion);
  }, [inmuebles]);

  const tiposDisponibles = useMemo(() => {
    return getUniqueOptions(inmuebles, (inmueble) => inmueble.tipo);
  }, [inmuebles]);

  const filteredInmuebles = useMemo(() => {
    const filteredItems = inmuebles.filter((inmueble) =>
      inmuebleMatchesFilters(inmueble, filters),
    );

    return sortInmuebles(filteredItems, filters.sortBy);
  }, [inmuebles, filters]);

  const featuredInmuebles = useMemo(() => {
    return getFeaturedInmuebles(inmuebles);
  }, [inmuebles]);

  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (!value) return false;

      if (key === "sortBy" && value === INITIAL_FILTERS.sortBy) {
        return false;
      }

      return true;
    }).length;
  }, [filters]);

  const activeFilterBadges = useMemo(() => {
    return getActiveFilterBadges(filters);
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

  const heroBackground = getHeroBackgroundUrl(inmobiliaria);
  const logoUrl = getLogoUrl(inmobiliaria);

  const seoUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return window.location.href;
    }

    return slug ? `/inmobiliaria/${slug}` : "/";
  }, [slug]);

  const seoImage = useMemo(() => {
    return logoUrl || heroBackground || DEFAULT_SEO_IMAGE;
  }, [heroBackground, logoUrl]);

  const seoTitle = useMemo(() => {
    return inmobiliaria?.nombre
      ? `${inmobiliaria?.nombre} | Propiedades publicadas`
      : "Inmobiliaria | ONO Prop";
  }, [inmobiliaria]);

  const seoDescription = useMemo(() => {
    return buildSeoDescription({
      inmobiliaria,
      contacto,
      inmueblesCount: inmuebles.length,
    });
  }, [contacto, inmobiliaria, inmuebles.length]);

  const inmobiliariaJsonLd = useMemo(() => {
    return buildInmobiliariaJsonLd({
      inmobiliaria,
      contacto,
      seoUrl,
      seoImage,
      inmuebles,
    });
  }, [contacto, inmobiliaria, inmuebles, seoImage, seoUrl]);

  const shouldNoIndexInmobiliaria =
    inmobiliaria?.noIndex === true || inmobiliaria?.seo?.noIndex === true;

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "ciudad" ? { barrio: "" } : {}),
    }));
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const handleRemoveFilter = (key) => {
    setFilters((prev) => ({
      ...prev,
      [key]: INITIAL_FILTERS[key] ?? "",
      ...(key === "ciudad" ? { barrio: "" } : {}),
    }));
  };

  const handleCopyProfileLink = async () => {
    try {
      const currentUrl = getCurrentInmobiliariaUrl(slug);

      if (!currentUrl) {
        throw new Error("No se pudo obtener el link de la inmobiliaria");
      }

      await navigator.clipboard.writeText(currentUrl);
      setCopySuccess(true);

      window.setTimeout(() => {
        setCopySuccess(false);
      }, 2500);
    } catch (err) {
      console.error("Error copiando link de inmobiliaria:", err);
      setCopySuccess(false);
      alert("No se pudo copiar el link de la inmobiliaria.");
    }
  };

  const handleShareProfileByWhatsapp = () => {
    try {
      const currentUrl = getCurrentInmobiliariaUrl(slug);

      if (!currentUrl) {
        throw new Error("No se pudo obtener el link de la inmobiliaria");
      }

      const message = [
        `Te comparto el perfil de ${inmobiliaria?.nombre || "esta inmobiliaria"}:`,
        currentUrl,
      ].join("\n");

      const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
        message,
      )}`;

      window.open(whatsappShareUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Error compartiendo inmobiliaria por WhatsApp:", err);
      alert("No se pudo abrir WhatsApp para compartir la inmobiliaria.");
    }
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
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <span className="badge text-bg-light text-dark">
                      Sitio oficial de inmobiliaria
                    </span>

                    <span
                      className={`badge ${isVerifiedAgency(inmobiliaria)
                        ? "text-bg-success"
                        : "text-bg-warning"
                        }`}
                    >
                      {getVerificationLabel(inmobiliaria)}
                    </span>
                  </div>

                  <h1 className="display-4 fw-bold mb-3">
                    {inmobiliaria?.nombre}
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
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={`Logo ${inmobiliaria?.nombre}`}
                          className="rounded border"
                          style={{
                            width: 88,
                            height: 88,
                            objectFit: "contain",
                            background: "#fff",
                          }}
                        />
                      ) : (
                        <div
                          className="rounded border bg-light d-flex align-items-center justify-content-center fw-bold"
                          style={{ width: 88, height: 88 }}
                        >
                          {inmobiliaria?.nombre?.slice(0, 1) || "I"}
                        </div>
                      )}

                      <div>
                        <div className="fw-bold">{inmobiliaria?.nombre}</div>
                        <div className="text-muted small">
                          {isVerifiedAgency(inmobiliaria)
                            ? "Perfil validado por ONO Prop"
                            : "Perfil pendiente de validación"}
                        </div>
                      </div>
                    </div>

                    <div className="row g-3 text-center">
                      <div className="col-4">
                        <div className="h3 mb-0">{inmuebles.length}</div>
                        <div className="small text-muted">Publicadas</div>
                      </div>

                      <div className="col-4">
                        <div className="h3 mb-0">{totalDestacados}</div>
                        <div className="small text-muted">Destacadas</div>
                      </div>

                      <div className="col-4">
                        <div className="h3 mb-0">{ciudades.length}</div>
                        <div className="small text-muted">Ciudades</div>
                      </div>
                    </div>

                    <hr />

                    <div className="d-grid gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={handleCopyProfileLink}
                      >
                        {copySuccess ? "Link copiado" : "Copiar perfil"}
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-success btn-sm"
                        onClick={handleShareProfileByWhatsapp}
                      >
                        Compartir por WhatsApp
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {featuredInmuebles.length > 0 && (
        <section className="pb-4">
          <div className="container">
            <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
              <div>
                <p className="text-uppercase text-muted small mb-1">
                  Selección de la inmobiliaria
                </p>
                <h2 className="h3 mb-0">Propiedades destacadas</h2>
              </div>

              <a href="#inmuebles-publicados" className="btn btn-outline-primary">
                Ver todas
              </a>
            </div>

            <div className="row g-4">
              {featuredInmuebles.map((inmueble) => (
                <div className="col-12 col-md-6 col-xl-4" key={inmueble.id}>
                  <InmueblePublicCard inmueble={inmueble} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-4" id="inmuebles-publicados">
        <div className="container">
          <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
            <div>
              <p className="text-uppercase text-muted small mb-1">
                Inmuebles publicados
              </p>
              <h2 className="h3 mb-1">Propiedades de {inmobiliaria?.nombre}</h2>
              <p className="text-muted mb-0">
                Filtrá dentro del catálogo público de esta inmobiliaria.
              </p>
            </div>

            <div className="text-muted small">
              {filteredInmuebles.length} resultado
              {filteredInmuebles.length === 1 ? "" : "s"}
            </div>
          </div>

          <section className="card border-0 shadow-sm mb-4">
            <div className="card-body p-3 p-lg-4">
              <div className="row g-3">
                <div className="col-12 col-lg-4">
                  <label className="form-label">Buscar</label>
                  <input
                    type="search"
                    name="search"
                    className="form-control"
                    placeholder="Título, barrio, ciudad, pileta..."
                    value={filters.search}
                    onChange={handleFilterChange}
                  />
                </div>

                <div className="col-6 col-lg-2">
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
                        {capitalize(operacion)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-6 col-lg-2">
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
                        {capitalize(tipo)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-6 col-lg-2">
                  <label className="form-label">Ciudad</label>
                  <select
                    name="ciudad"
                    className="form-select"
                    value={filters.ciudad}
                    onChange={handleFilterChange}
                  >
                    <option value="">Todas</option>
                    {ciudades.map((ciudad) => (
                      <option key={ciudad} value={ciudad}>
                        {ciudad}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-6 col-lg-2">
                  <label className="form-label">Barrio</label>
                  <select
                    name="barrio"
                    className="form-select"
                    value={filters.barrio}
                    onChange={handleFilterChange}
                    disabled={barrios.length === 0}
                  >
                    <option value="">Todos</option>
                    {barrios.map((barrio) => (
                      <option key={barrio} value={barrio}>
                        {barrio}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-6 col-lg-2">
                  <label className="form-label">Dormitorios</label>
                  <select
                    name="dormitoriosMin"
                    className="form-select"
                    value={filters.dormitoriosMin}
                    onChange={handleFilterChange}
                  >
                    <option value="">Cualquiera</option>
                    <option value="1">1+</option>
                    <option value="2">2+</option>
                    <option value="3">3+</option>
                    <option value="4">4+</option>
                    <option value="5">5+</option>
                  </select>
                </div>

                <div className="col-6 col-lg-2">
                  <label className="form-label">Baños</label>
                  <select
                    name="banosMin"
                    className="form-select"
                    value={filters.banosMin}
                    onChange={handleFilterChange}
                  >
                    <option value="">Cualquiera</option>
                    <option value="1">1+</option>
                    <option value="2">2+</option>
                    <option value="3">3+</option>
                    <option value="4">4+</option>
                  </select>
                </div>

                <div className="col-6 col-lg-2">
                  <label className="form-label">Cocheras</label>
                  <select
                    name="cocherasMin"
                    className="form-select"
                    value={filters.cocherasMin}
                    onChange={handleFilterChange}
                  >
                    <option value="">Cualquiera</option>
                    <option value="1">1+</option>
                    <option value="2">2+</option>
                    <option value="3">3+</option>
                  </select>
                </div>

                <div className="col-6 col-lg-2">
                  <label className="form-label">Superficie mín.</label>
                  <input
                    type="number"
                    name="superficieMin"
                    className="form-control"
                    min="0"
                    placeholder="100"
                    value={filters.superficieMin}
                    onChange={handleFilterChange}
                  />
                </div>

                <div className="col-12 col-lg-3">
                  <label className="form-label">Ordenar por</label>
                  <select
                    name="sortBy"
                    className="form-select"
                    value={filters.sortBy}
                    onChange={handleFilterChange}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-lg-3 d-grid">
                  <label className="form-label d-none d-lg-block">&nbsp;</label>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={handleClearFilters}
                    disabled={activeFiltersCount === 0}
                  >
                    Limpiar filtros
                  </button>
                </div>

                <div className="col-12">
                  <div className="d-flex flex-wrap gap-3">
                    {AMENITY_FILTERS.map((filter) => (
                      <div className="form-check" key={filter.key}>
                        <input
                          id={`agency-filter-${filter.key}`}
                          className="form-check-input"
                          type="checkbox"
                          name={filter.key}
                          checked={Boolean(filters[filter.key])}
                          onChange={handleFilterChange}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`agency-filter-${filter.key}`}
                        >
                          {filter.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {activeFilterBadges.length > 0 && (
            <div className="d-flex flex-wrap gap-2 mb-4">
              {activeFilterBadges.map((badge) => (
                <button
                  type="button"
                  key={badge.key}
                  className="btn btn-sm btn-light border rounded-pill"
                  onClick={() => handleRemoveFilter(badge.key)}
                >
                  {badge.label} ×
                </button>
              ))}
            </div>
          )}

          {inmueblesLoading && (
            <div className="alert alert-light border">
              Cargando inmuebles publicados...
            </div>
          )}

          {inmueblesError && (
            <div className="alert alert-warning">{inmueblesError}</div>
          )}

          {!inmueblesLoading && !inmueblesError && filteredInmuebles.length === 0 && (
            <div className="alert alert-info">
              No encontramos inmuebles con esos filtros.
            </div>
          )}

          {!inmueblesLoading && !inmueblesError && filteredInmuebles.length > 0 && (
            <div className="row g-4">
              {filteredInmuebles.map((inmueble) => (
                <div className="col-12 col-md-6 col-xl-4" key={inmueble.id}>
                  <InmueblePublicCard inmueble={inmueble} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-5 bg-light" id="contacto">
        <div className="container">
          <div className="row g-4 align-items-stretch">
            <div className="col-lg-7">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body p-4 p-lg-5">
                  <p className="text-uppercase text-muted small mb-1">Contacto</p>
                  <h2 className="h3 mb-3">Hablá con {inmobiliaria?.nombre}</h2>
                  <p className="text-muted mb-4">
                    Consultá por sus propiedades publicadas o solicitá una
                    tasación. La inmobiliaria recibirá tu contacto directamente.
                  </p>

                  <div className="d-flex flex-column gap-3">
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-success btn-lg align-self-start"
                      >
                        Consultar por WhatsApp
                      </a>
                    )}

                    {contacto.email && (
                      <div>
                        <div className="small text-muted">Email</div>
                        <a href={`mailto:${contacto.email}`}>{contacto.email}</a>
                      </div>
                    )}

                    {contacto.telefono && (
                      <div>
                        <div className="small text-muted">Teléfono</div>
                        <a href={`tel:${contacto.telefono}`}>{contacto.telefono}</a>
                      </div>
                    )}

                    {contacto.whatsapp && (
                      <div>
                        <div className="small text-muted">WhatsApp</div>
                        <span>{contacto.whatsapp}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body p-4 p-lg-5">
                  <p className="text-uppercase text-muted small mb-1">
                    Datos de perfil
                  </p>
                  <h2 className="h4 mb-3">Información de la inmobiliaria</h2>

                  <div className="vstack gap-3">
                    <div>
                      <div className="small text-muted">Nombre comercial</div>
                      <div className="fw-semibold">{inmobiliaria?.nombre}</div>
                    </div>

                    {inmobiliaria.razonSocial && (
                      <div>
                        <div className="small text-muted">Razón social</div>
                        <div>{inmobiliaria.razonSocial}</div>
                      </div>
                    )}

                    {inmobiliaria.cuit && (
                      <div>
                        <div className="small text-muted">CUIT</div>
                        <div>{inmobiliaria.cuit}</div>
                      </div>
                    )}

                    <div>
                      <div className="small text-muted">Validación</div>
                      <span
                        className={`badge ${isVerifiedAgency(inmobiliaria)
                          ? "text-bg-success"
                          : "text-bg-warning"
                          }`}
                      >
                        {getVerificationLabel(inmobiliaria)}
                      </span>
                    </div>

                    {operacionesPermitidas.length > 0 && (
                      <div>
                        <div className="small text-muted mb-2">Operaciones</div>
                        <div className="d-flex flex-wrap gap-2">
                          {operacionesPermitidas.map((operacion) => (
                            <span
                              key={operacion}
                              className="badge text-bg-primary"
                            >
                              {operacion}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {tiposPermitidos.length > 0 && (
                      <div>
                        <div className="small text-muted mb-2">Tipos de inmueble</div>
                        <div className="d-flex flex-wrap gap-2">
                          {tiposPermitidos.map((tipo) => (
                            <span key={tipo} className="badge text-bg-light border text-dark">
                              {tipo}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
