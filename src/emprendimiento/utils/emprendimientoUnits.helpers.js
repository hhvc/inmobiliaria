const cleanText = (value = "") => value?.toString?.().trim?.() || "";

const normalizeNumericValue = (value) => {
  const cleanValue = cleanText(value).replace(",", ".");
  if (!cleanValue) return "";

  const number = Number(cleanValue);
  return Number.isFinite(number) ? number : "";
};

export const UNIDAD_DISPONIBILIDADES = [
  { id: "disponible", label: "Disponible" },
  { id: "reservada", label: "Reservada" },
  { id: "vendida", label: "Vendida" },
  { id: "no_disponible", label: "No disponible" },
];

export const createEmptyUnitRow = (rowId = "") => ({
  rowId,
  codigo: "",
  tipo: "departamento",
  tipologia: "",
  piso: "",
  ambientes: "",
  dormitorios: "",
  superficie: "",
  operacion: "venta",
  precio: "",
  moneda: "USD",
  disponibilidad: "disponible",
});

export const duplicateUnitRow = (row = {}, rowId = "") => {
  const normalized = normalizeUnitRow(row);
  const code = normalized.codigo ? `${normalized.codigo} copia` : "";

  return {
    ...normalized,
    rowId,
    codigo: code,
  };
};

export const normalizeUnitRow = (row = {}) => ({
  ...createEmptyUnitRow(row.rowId),
  ...row,
  codigo: cleanText(row.codigo),
  tipo: cleanText(row.tipo) || "departamento",
  tipologia: cleanText(row.tipologia),
  piso: cleanText(row.piso),
  ambientes: normalizeNumericValue(row.ambientes),
  dormitorios: normalizeNumericValue(row.dormitorios),
  superficie: normalizeNumericValue(row.superficie),
  operacion: cleanText(row.operacion) || "venta",
  precio: normalizeNumericValue(row.precio),
  moneda: cleanText(row.moneda).toUpperCase() || "USD",
  disponibilidad: cleanText(row.disponibilidad) || "disponible",
});

export const validateUnitRows = (rows = []) => {
  const errors = {};
  const codes = new Map();

  rows.forEach((rawRow, index) => {
    const row = normalizeUnitRow(rawRow);
    const rowErrors = {};

    if (!row.codigo) rowErrors.codigo = "Código obligatorio";
    if (!row.tipo) rowErrors.tipo = "Tipo obligatorio";
    if (!row.operacion) rowErrors.operacion = "Operación obligatoria";

    const codeKey = row.codigo.toLowerCase();
    if (codeKey) {
      if (codes.has(codeKey)) {
        rowErrors.codigo = "Código repetido";
        const previousIndex = codes.get(codeKey);
        errors[previousIndex] = {
          ...(errors[previousIndex] || {}),
          codigo: "Código repetido",
        };
      } else {
        codes.set(codeKey, index);
      }
    }

    if (Object.keys(rowErrors).length > 0) errors[index] = rowErrors;
  });

  return errors;
};

export const buildUnitInmueblePayload = ({
  row,
  emprendimiento,
  inmobiliariaId,
}) => {
  const unit = normalizeUnitRow(row);
  const developmentName = cleanText(emprendimiento?.nombre) || "Emprendimiento";
  const title = `${developmentName} · Unidad ${unit.codigo}`;

  return {
    titulo: title,
    descripcion: `${title}. ${unit.tipologia || "Unidad disponible"} dentro del emprendimiento ${developmentName}.`,
    tipo: unit.tipo,
    operacion: unit.operacion,
    precio: unit.precio,
    moneda: unit.moneda,
    expensas: "",
    direccion: {
      ...(emprendimiento?.direccion || {}),
    },
    superficie: {
      total: unit.superficie,
      cubierta: "",
      semicubierta: "",
      descubierta: "",
      terreno: "",
      frente: "",
      fondo: "",
    },
    caracteristicas: {
      ambientes: unit.ambientes,
      dormitorios: unit.dormitorios,
      banos: "",
      toilettes: "",
      cocheras: false,
      cocherasCantidad: "",
      plantas: "",
      antiguedad: "",
      orientacion: "",
      estadoConservacion: "",
      piso: unit.piso,
      departamento: unit.codigo,
    },
    ambientes: unit.ambientes,
    dormitorios: unit.dormitorios,
    banos: "",
    cocheras: "",
    amenities: {},
    servicios: {},
    medidas: {},
    images: [],
    videos: [],
    estado: "activo",
    destacado: false,
    publicarEnPortal: false,
    noIndex: false,
    inmobiliariaId,
    ownerInmobiliariaId: inmobiliariaId,
    sharedWith: {},
    deleted: false,
    sharing: {
      enabled: false,
      mode: "all_colleagues",
      allowColleagueContact: true,
      showExactAddressToColleagues: false,
      showOwnerDataToColleagues: false,
    },
    emprendimientoId: emprendimiento?.id || "",
    emprendimientoNombre: developmentName,
    emprendimientoSlug: emprendimiento?.slug || "",
    unidadEmprendimiento: {
      codigo: unit.codigo,
      tipologia: unit.tipologia,
      piso: unit.piso,
      disponibilidad: unit.disponibilidad,
    },
  };
};

export const inmuebleToUnitRow = (inmueble = {}) => ({
  rowId: inmueble.id || "",
  codigo: inmueble.unidadEmprendimiento?.codigo || "",
  tipo: inmueble.tipo || "departamento",
  tipologia: inmueble.unidadEmprendimiento?.tipologia || "",
  piso:
    inmueble.unidadEmprendimiento?.piso ||
    inmueble.caracteristicas?.piso ||
    "",
  ambientes:
    inmueble.caracteristicas?.ambientes || inmueble.ambientes || "",
  dormitorios:
    inmueble.caracteristicas?.dormitorios || inmueble.dormitorios || "",
  superficie:
    inmueble.superficie?.total || inmueble.superficie?.cubierta || "",
  operacion: inmueble.operacion || "venta",
  precio: inmueble.precio ?? "",
  moneda: inmueble.moneda || "USD",
  disponibilidad:
    inmueble.unidadEmprendimiento?.disponibilidad || "disponible",
});

export const applyUnitRowToInmueble = ({
  inmueble,
  row,
  emprendimiento,
}) => {
  const unit = normalizeUnitRow(row);

  return {
    ...inmueble,
    tipo: unit.tipo,
    operacion: unit.operacion,
    precio: unit.precio,
    moneda: unit.moneda,
    superficie: {
      ...(inmueble.superficie || {}),
      total: unit.superficie,
    },
    caracteristicas: {
      ...(inmueble.caracteristicas || {}),
      ambientes: unit.ambientes,
      dormitorios: unit.dormitorios,
      piso: unit.piso,
      departamento: unit.codigo,
    },
    ambientes: unit.ambientes,
    dormitorios: unit.dormitorios,
    emprendimientoId: emprendimiento?.id || "",
    emprendimientoNombre: emprendimiento?.nombre || "",
    emprendimientoSlug: emprendimiento?.slug || "",
    unidadEmprendimiento: {
      ...(inmueble.unidadEmprendimiento || {}),
      codigo: unit.codigo,
      tipologia: unit.tipologia,
      piso: unit.piso,
      disponibilidad: unit.disponibilidad,
    },
  };
};
