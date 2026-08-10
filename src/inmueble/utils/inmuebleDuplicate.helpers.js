const cloneObject = (value, fallback = {}) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : { ...fallback };

const cloneArray = (value) =>
  Array.isArray(value)
    ? value.map((item) =>
      item && typeof item === "object" ? { ...item } : item,
    )
    : [];

export const buildDuplicateInmuebleTitle = (title = "") => {
  const normalizedTitle = title?.toString?.().trim?.() || "Inmueble";
  return `${normalizedTitle} (copia)`;
};

export const buildInmuebleDuplicateValues = ({
  source = {},
  inmobiliariaId = "",
} = {}) => {
  const resolvedInmobiliariaId =
    inmobiliariaId ||
    source.inmobiliariaId ||
    source.ownerInmobiliariaId ||
    "";
  const sourceUnit = cloneObject(source.unidadEmprendimiento, {
    codigo: "",
    tipologia: "",
    piso: "",
    disponibilidad: "disponible",
  });
  const duplicateUnitCode = sourceUnit.codigo
    ? `${sourceUnit.codigo} copia`
    : "";

  return {
    titulo: buildDuplicateInmuebleTitle(source.titulo),
    descripcion: source.descripcion || "",
    tipo: source.tipo || "",
    operacion: source.operacion || "",
    precio: source.precio ?? "",
    moneda: source.moneda || "USD",
    expensas: source.expensas ?? "",

    direccion: cloneObject(source.direccion),
    superficie: cloneObject(source.superficie),
    caracteristicas: cloneObject(source.caracteristicas),
    amenities: cloneObject(source.amenities),
    servicios: cloneObject(source.servicios),
    medidas: cloneObject(source.medidas),
    datosParcelarios: cloneObject(source.datosParcelarios),

    ambientes:
      source.caracteristicas?.ambientes ?? source.ambientes ?? "",
    dormitorios:
      source.caracteristicas?.dormitorios ?? source.dormitorios ?? "",
    banos:
      source.caracteristicas?.banos ?? source.banos ?? source.banios ?? "",
    cocheras:
      source.caracteristicas?.cocherasCantidad ?? source.cocheras ?? "",

    estado: "activo",
    destacado: false,
    publicarEnPortal: false,
    noIndex: true,
    images: [],
    videos: cloneArray(source.videos),

    emprendimientoId: source.emprendimientoId || "",
    emprendimientoNombre: source.emprendimientoNombre || "",
    emprendimientoSlug: source.emprendimientoSlug || "",
    unidadEmprendimiento: {
      ...sourceUnit,
      codigo: duplicateUnitCode,
    },

    inmobiliariaId: resolvedInmobiliariaId,
    ownerInmobiliariaId: resolvedInmobiliariaId,
    sharedWith: {},
    deleted: false,

    sharing: {
      ...cloneObject(source.sharing),
      enabled: false,
    },
    networkData: cloneObject(source.networkData),

    sourceType: "duplicate",
    duplicatedFromInmuebleId: source.id || "",
  };
};
