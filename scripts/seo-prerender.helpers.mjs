import fs from "node:fs";
import path from "node:path";

export const DEFAULT_SITE_URL = "https://onoprop.com";
export const DEFAULT_IMAGE_PATH = "/assets/img/Logo.png";

export const STATIC_SEO_ROUTES = {
  "/": {
    title: "ONO Prop | Buscá y publicá inmuebles",
    description:
      "Buscá casas, departamentos, terrenos, locales y oficinas publicados por inmobiliarias y particulares en ONO Prop.",
    heading: "Encontrá el inmueble que estás buscando",
    summary:
      "Publicaciones de inmobiliarias y particulares, con contacto directo y filtros para encontrar propiedades.",
    links: [
      { href: "/inmuebles", label: "Buscar inmuebles" },
      { href: "/publicar-inmueble-gratis", label: "Publicar gratis" },
    ],
  },
  "/inmuebles": {
    title: "Inmuebles en venta y alquiler | ONO Prop",
    description:
      "Explorá propiedades en venta, alquiler y alquiler temporal publicadas en ONO Prop.",
    heading: "Inmuebles publicados en ONO Prop",
    summary:
      "Filtrá por localidad, operación, tipo, precio y características para comparar alternativas.",
  },
  "/mapa": {
    title: "Mapa de inmuebles | ONO Prop",
    description:
      "Explorá en el mapa casas, departamentos, terrenos, locales y otras propiedades publicadas en ONO Prop.",
    heading: "Mapa de inmuebles publicados",
    summary: "Ubicá propiedades por zona y abrí la ficha completa para conocer sus características.",
  },
  "/emprendimientos": {
    title: "Emprendimientos inmobiliarios | ONO Prop",
    description:
      "Consultá edificios, loteos y otros emprendimientos inmobiliarios publicados en ONO Prop.",
    heading: "Emprendimientos inmobiliarios",
    summary: "Conocé desarrollos y las unidades disponibles informadas por las inmobiliarias.",
  },
  "/publicar-inmueble-gratis": {
    title: "Publicar un inmueble gratis | ONO Prop",
    description:
      "Publicá gratis tu casa, departamento, terreno, local u oficina en ONO Prop. Cargá fotos y datos y seguí la solicitud online.",
    heading: "Publicá tu inmueble gratis",
    summary:
      "Cargá una propiedad en venta, alquiler o alquiler temporal y elegí si la revisa ONO Prop o una inmobiliaria adherida.",
    facts: ["Publicación sin costo", "Fotografías y videos", "Seguimiento online"],
    links: [{ href: "/publicar", label: "Comenzar publicación" }],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Publicación gratuita de inmuebles en ONO Prop",
      provider: { "@type": "Organization", name: "ONO Prop" },
      offers: { "@type": "Offer", price: 0, priceCurrency: "ARS" },
    },
  },
  "/software-para-inmobiliarias": {
    title: "Software para inmobiliarias | ONO Prop",
    description:
      "Publicá inmuebles y administrá alquileres, consorcios, tasaciones, cobranzas, facturación e integraciones desde ONO Prop.",
    heading: "Software modular para inmobiliarias",
    summary:
      "Publicá, administrá y cobrá desde una plataforma que conserva la identidad comercial de tu inmobiliaria.",
    facts: ["Publicación y difusión", "Alquileres y consorcios", "Tasaciones e integraciones"],
    links: [
      { href: "/planes", label: "Ver planes y servicios" },
      { href: "/inmobiliarias/alta", label: "Crear inmobiliaria" },
    ],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "ONO Prop para inmobiliarias",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
    },
  },
  "/inmobiliarias": {
    title: "ONO Prop para inmobiliarias | Publicá y administrá",
    description:
      "Creá o vinculá tu inmobiliaria, publicá inmuebles y accedé a herramientas de gestión y colaboración.",
    heading: "Sumá tu inmobiliaria a ONO Prop",
    summary:
      "Creá una inmobiliaria o solicitá acceso a una existente para comenzar a publicar y administrar.",
  },
  "/planes": {
    title: "Planes para inmobiliarias | ONO Prop",
    description:
      "Elegí herramientas para publicar inmuebles y gestionar tasaciones, alquileres, consorcios, dominios e integraciones.",
    heading: "Productos y servicios para inmobiliarias",
    summary: "Empezá con lo que necesitás y sumá nuevas herramientas a medida que crece tu operación.",
  },
  "/guias": {
    title: "Guías y manuales | ONO Prop",
    description:
      "Consultá las guías públicas de ONO Prop para administrar alquileres, consorcios e integraciones.",
    heading: "Guías y manuales de ONO Prop",
    summary: "Instructivos breves para conocer y utilizar las herramientas de la plataforma.",
  },
  "/sobre-onoprop": {
    title: "Conocé ONO Prop | Portal y herramientas inmobiliarias",
    description:
      "Conocé cómo ONO Prop ayuda a buscar, publicar y gestionar inmuebles a particulares e inmobiliarias.",
    heading: "Portal y herramientas para el sector inmobiliario",
    summary: "ONO Prop conecta publicaciones, consultas y herramientas de gestión en una misma plataforma.",
  },
};

export const normalizeText = (value = "") => value
  .toString()
  .replace(/\s+/g, " ")
  .trim();

export const truncateText = (value = "", maxLength = 165) => {
  const clean = normalizeText(value);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
};

export const escapeHtml = (value = "") => value
  .toString()
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export const absoluteUrl = (value = "", siteUrl = DEFAULT_SITE_URL) => {
  const cleanSiteUrl = siteUrl.toString().replace(/\/+$/, "");
  if (!value) return `${cleanSiteUrl}${DEFAULT_IMAGE_PATH}`;

  try {
    return new URL(value, `${cleanSiteUrl}/`).toString();
  } catch {
    return `${cleanSiteUrl}${DEFAULT_IMAGE_PATH}`;
  }
};

const getAddressValue = (item = {}, key) => item?.direccion?.[key] || item?.[key] || "";

export const buildAddress = (item = {}) => [
  getAddressValue(item, "calle"),
  getAddressValue(item, "numero"),
  getAddressValue(item, "barrio"),
  getAddressValue(item, "ciudad"),
  getAddressValue(item, "provincia"),
].filter(Boolean).join(", ");

export const getFirstImageUrl = (item = {}) => {
  const candidates = [
    item.portadaUrl,
    item.coverUrl,
    item.logoUrl,
    item.logo,
    item.branding?.logoUrl,
    item.branding?.logo,
    item.branding?.isologoUrl,
    item.imagenPrincipal,
    item.imageUrl,
    item.imagenes?.[0],
    item.images?.[0],
    item.fotos?.[0],
  ];
  const selected = candidates.find(Boolean);

  if (typeof selected === "string") return selected;
  return selected?.url || selected?.downloadURL || selected?.src || "";
};

export const formatPrice = (item = {}) => {
  if (item.precio === undefined || item.precio === null || item.precio === "") return "Consultar";
  const value = Number(item.precio);
  const formatted = Number.isFinite(value) ? value.toLocaleString("es-AR") : item.precio;
  return `${item.moneda || "USD"} ${formatted}`;
};

const capitalize = (value = "") => {
  const clean = normalizeText(value);
  return clean ? `${clean.charAt(0).toUpperCase()}${clean.slice(1)}` : "";
};

const createBaseRoute = ({ routePath, title, description, heading, summary, image, facts, links, jsonLd }) => ({
  path: routePath,
  title: truncateText(title, 70),
  description: truncateText(description, 165),
  heading: normalizeText(heading || title),
  summary: normalizeText(summary || description),
  image: image || DEFAULT_IMAGE_PATH,
  facts: (facts || []).map(normalizeText).filter(Boolean).slice(0, 8),
  links: (links || []).filter((link) => link?.href && link?.label).slice(0, 6),
  jsonLd: jsonLd || null,
});

export const buildStaticSeoRoute = (routePath) => {
  const data = STATIC_SEO_ROUTES[routePath];
  if (!data) return null;
  return createBaseRoute({ routePath, ...data });
};

export const buildAgencySeoRoute = ({ agency = {}, routePath }) => {
  const name = normalizeText(agency.nombre || agency.name || "Inmobiliaria adherida");
  const location = buildAddress(agency);
  const customDescription = normalizeText(agency.descripcion || agency.presentacion || agency.bio);
  const summary = customDescription || [
    `Consultá inmuebles publicados por ${name}.`,
    location ? `Atención en ${location}.` : "",
  ].filter(Boolean).join(" ");

  return createBaseRoute({
    routePath,
    title: `${name} | Inmobiliaria en ONO Prop`,
    description: summary,
    heading: name,
    summary,
    image: getFirstImageUrl(agency),
    facts: [location, "Inmuebles publicados", "Contacto directo"],
    links: [{ href: "/inmuebles", label: "Buscar inmuebles" }],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "RealEstateAgent",
      name,
      description: truncateText(summary, 300),
      url: routePath,
      image: getFirstImageUrl(agency) || undefined,
      address: location || undefined,
    },
  });
};

export const buildPropertySeoRoute = ({ property = {}, agency = {}, routePath }) => {
  const agencyName = normalizeText(agency.nombre || property.inmobiliariaNombre || "ONO Prop");
  const location = buildAddress(property);
  const operation = capitalize(property.operacion);
  const propertyType = capitalize(property.tipo || "Inmueble");
  const title = normalizeText(property.titulo) || [operation, propertyType, location ? `en ${location}` : ""].filter(Boolean).join(" ");
  const facts = [
    operation,
    propertyType,
    location,
    formatPrice(property),
    property.dormitorios ? `${property.dormitorios} dormitorios` : "",
    property.banos ? `${property.banos} baños` : "",
    property.superficie?.total ? `${property.superficie.total} m² totales` : "",
  ].filter(Boolean);
  const summary = [
    operation && propertyType ? `${propertyType} en ${operation.toLowerCase()}.` : "",
    location ? `Ubicación: ${location}.` : "",
    `Precio: ${formatPrice(property)}.`,
    normalizeText(property.descripcion),
    `Publicado por ${agencyName}.`,
  ].filter(Boolean).join(" ");
  const image = getFirstImageUrl(property);
  const numericPrice = Number(property.precio);

  return createBaseRoute({
    routePath,
    title: `${title || "Inmueble publicado"} | ${agencyName}`,
    description: summary,
    heading: title || "Inmueble publicado",
    summary,
    image,
    facts,
    links: [
      { href: routePath, label: "Ver ficha completa" },
      { href: "/inmuebles", label: "Ver más inmuebles" },
    ],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Offer",
      name: title || "Inmueble publicado",
      description: truncateText(summary, 300),
      url: routePath,
      image: image || undefined,
      price: Number.isFinite(numericPrice) ? numericPrice : undefined,
      priceCurrency: normalizeText(property.moneda || "USD"),
      availability: "https://schema.org/InStock",
      seller: { "@type": "RealEstateAgent", name: agencyName },
      itemOffered: {
        "@type": "Place",
        name: title || "Inmueble publicado",
        address: location || undefined,
      },
    },
  });
};

export const buildDevelopmentSeoRoute = ({ development = {}, agency = {}, routePath }) => {
  const name = normalizeText(development.nombre || development.titulo || "Emprendimiento inmobiliario");
  const agencyName = normalizeText(agency.nombre || "ONO Prop");
  const location = buildAddress(development);
  const summary = [
    normalizeText(development.tipo),
    location ? `en ${location}.` : "",
    normalizeText(development.descripcion),
    `Publicado por ${agencyName}.`,
  ].filter(Boolean).join(" ");
  const image = getFirstImageUrl(development);

  return createBaseRoute({
    routePath,
    title: `${name} | ${agencyName}`,
    description: summary,
    heading: name,
    summary,
    image,
    facts: [development.tipo, location, agencyName],
    links: [
      { href: routePath, label: "Ver emprendimiento" },
      { href: "/emprendimientos", label: "Ver más emprendimientos" },
    ],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Place",
      name,
      description: truncateText(summary, 300),
      url: routePath,
      image: image || undefined,
      address: location || undefined,
    },
  });
};

const escapeJsonForScript = (value) => JSON.stringify(value)
  .replaceAll("<", "\\u003c")
  .replaceAll(">", "\\u003e")
  .replaceAll("&", "\\u0026");

const renderFallback = (route) => {
  const facts = route.facts?.length
    ? `<ul>${route.facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>`
    : "";
  const links = route.links?.length
    ? `<nav aria-label="Enlaces relacionados">${route.links.map((link) => (
      `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`
    )).join(" ")}</nav>`
    : "";

  return [
    '<main data-static-seo="true" style="max-width:72rem;margin:3rem auto;padding:1.5rem;font-family:system-ui,sans-serif;color:#16302b">',
    '<article>',
    `<h1>${escapeHtml(route.heading || route.title)}</h1>`,
    `<p>${escapeHtml(route.summary || route.description)}</p>`,
    facts,
    links,
    "</article>",
    "</main>",
  ].join("");
};

export const renderSeoDocument = (template, route, siteUrl = DEFAULT_SITE_URL) => {
  const canonical = absoluteUrl(route.path, siteUrl);
  const image = absoluteUrl(route.image, siteUrl);
  const jsonLd = route.jsonLd ? {
    ...route.jsonLd,
    url: canonical,
    image: route.jsonLd.image ? absoluteUrl(route.jsonLd.image, siteUrl) : image,
  } : null;
  const head = [
    `<meta name="description" content="${escapeHtml(route.description)}" />`,
    '<meta name="robots" content="index,follow,max-image-preview:large" />',
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(route.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(route.description)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    '<meta property="og:site_name" content="ONO Prop" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    jsonLd ? `<script type="application/ld+json">${escapeJsonForScript(jsonLd)}</script>` : "",
  ].filter(Boolean).join("\n  ");
  const withTitle = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(route.title)}</title>`);
  const withHead = withTitle.replace("</head>", `  ${head}\n</head>`);

  return withHead.replace(
    /<div id="root"><\/div>/i,
    `<div id="root">${renderFallback(route)}</div>`,
  );
};

const getOutputPath = (distPath, routePath) => {
  if (routePath === "/") return path.join(distPath, "index.html");

  const segments = routePath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Ruta SEO inválida: ${routePath}`);
  }

  return path.join(distPath, ...segments, "index.html");
};

export const writePrerenderedPages = ({ template, routes, distPath, siteUrl = DEFAULT_SITE_URL }) => {
  let count = 0;

  routes.forEach((route) => {
    if (!route?.path || !route?.title || !route?.description) return;
    const outputPath = getOutputPath(distPath, route.path);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, renderSeoDocument(template, route, siteUrl), "utf8");
    count += 1;
  });

  return count;
};
