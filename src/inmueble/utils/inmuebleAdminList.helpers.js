const DEFAULT_SHARING = {
  enabled: false,
  mode: "friend_groups",
  shareWithOnopropNetwork: false,
  friendGroupIds: [],
};

export const INMUEBLE_ADMIN_SORT_OPTIONS = [
  { value: "created_desc", label: "Más recientes primero" },
  { value: "created_asc", label: "Más antiguos primero" },
  { value: "updated_desc", label: "Modificados recientemente" },
  { value: "updated_asc", label: "Modificados hace más tiempo" },
  { value: "price_asc", label: "Precio: menor a mayor (por moneda)" },
  { value: "price_desc", label: "Precio: mayor a menor (por moneda)" },
];

const normalizeSearchText = (value = "") => value
  .toString()
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const timestampToMillis = (value) => {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (Number.isFinite(value?.seconds)) return value.seconds * 1000;

  const parsed = value instanceof Date ? value.getTime() : Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizePrice = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = (value ?? "").toString().trim().replace(/\s+/g, "");
  if (!raw) return null;

  let normalized = raw;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d+(,\d+)?$/.test(raw)) {
    normalized = raw.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const compareNullableNumbers = (left, right, direction = 1) => {
  const leftMissing = left === null;
  const rightMissing = right === null;

  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  return (left - right) * direction;
};

const stableTieBreak = (left = {}, right = {}) => (
  (left.titulo || left.id || "").localeCompare(
    right.titulo || right.id || "",
    "es",
    { sensitivity: "base" },
  )
);

export const normalizeInmuebleSharing = (value = {}) => {
  const friendGroupIds = Array.isArray(value.friendGroupIds)
    ? [...new Set(value.friendGroupIds.filter(Boolean))]
    : [];
  const shareWithOnopropNetwork = value.shareWithOnopropNetwork === undefined
    ? Boolean(value.enabled && value.mode === "all_colleagues")
    : Boolean(value.shareWithOnopropNetwork);

  return {
    ...DEFAULT_SHARING,
    ...value,
    enabled: shareWithOnopropNetwork || friendGroupIds.length > 0,
    mode: shareWithOnopropNetwork ? "all_colleagues" : "friend_groups",
    shareWithOnopropNetwork,
    friendGroupIds,
  };
};

export const filterAdminInmuebles = (items = [], filters = {}) => {
  const search = normalizeSearchText(filters.search || "");

  return items
    .filter((item) => item?.deleted !== true)
    .filter((item) => (filters.estado ? item.estado === filters.estado : true))
    .filter((item) => (filters.tipo ? item.tipo === filters.tipo : true))
    .filter((item) => (
      filters.operacion ? item.operacion === filters.operacion : true
    ))
    .filter((item) => (
      filters.destacado === true ? item.destacado === true : true
    ))
    .filter((item) => {
      if (!search) return true;

      return normalizeSearchText([
        item.titulo,
        item.descripcion,
        item.tipo,
        item.operacion,
        item.direccion?.calle,
        item.direccion?.numero,
        item.direccion?.barrio,
        item.direccion?.ciudad,
        item.codigo,
        item.slug,
      ].filter(Boolean).join(" ")).includes(search);
    });
};

export const sortAdminInmuebles = (items = [], sortOption = "created_desc") => {
  const [field, order] = sortOption.split("_");
  const direction = order === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    if (field === "price") {
      const leftPrice = normalizePrice(left.precio);
      const rightPrice = normalizePrice(right.precio);
      const leftCurrency = (left.moneda || "").toString().toUpperCase();
      const rightCurrency = (right.moneda || "").toString().toUpperCase();

      if (leftPrice !== null && rightPrice !== null && leftCurrency !== rightCurrency) {
        return leftCurrency.localeCompare(rightCurrency, "es");
      }

      return compareNullableNumbers(leftPrice, rightPrice, direction)
        || stableTieBreak(left, right);
    }

    const dateField = field === "updated" ? "updatedAt" : "createdAt";
    return compareNullableNumbers(
      timestampToMillis(left[dateField]),
      timestampToMillis(right[dateField]),
      direction,
    ) || stableTieBreak(left, right);
  });
};

const formatDateForCsv = (value) => {
  const millis = timestampToMillis(value);
  if (millis === null) return "";

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(millis));
};

const protectSpreadsheetValue = (value) => {
  const text = value === null || value === undefined ? "" : value.toString();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

const csvCell = (value) => `"${protectSpreadsheetValue(value).replace(/"/g, '""')}"`;

const getAddress = (item = {}) => [
  item.direccion?.calle,
  item.direccion?.numero,
  item.direccion?.barrio,
  item.direccion?.ciudad,
  item.direccion?.provincia,
].filter(Boolean).join(", ");

export const buildAdminInmueblesCsv = (
  items = [],
  {
    branchesById = {},
    friendGroupsById = {},
    publicOrigin = "https://onoprop.com",
  } = {},
) => {
  const headers = [
    "ID",
    "Título",
    "Tipo",
    "Operación",
    "Precio",
    "Moneda",
    "Estado",
    "Dirección",
    "Sucursal",
    "Publicado en portal",
    "Destacado",
    "Compartido con red ONO Prop",
    "Grupos de inmobiliarias amigas",
    "Fecha de carga",
    "Última modificación",
    "URL pública",
  ];

  const rows = items.map((item) => {
    const sharing = normalizeInmuebleSharing(item.sharing || {});
    const groupNames = sharing.friendGroupIds
      .map((groupId) => friendGroupsById[groupId]?.name || groupId)
      .join(", ");
    const publicUrl = item.slug
      ? `${publicOrigin.replace(/\/$/, "")}/inmueble/${item.slug}`
      : "";

    return [
      item.id || "",
      item.titulo || "",
      item.tipo || "",
      item.operacion || "",
      item.precio ?? "",
      item.moneda || "",
      item.estado || "",
      getAddress(item),
      branchesById[item.sucursalId]?.name || item.sucursalId || "",
      item.publicarEnPortal === true ? "Sí" : "No",
      item.destacado === true ? "Sí" : "No",
      sharing.shareWithOnopropNetwork ? "Sí" : "No",
      groupNames,
      formatDateForCsv(item.createdAt),
      formatDateForCsv(item.updatedAt),
      publicUrl,
    ];
  });

  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n")}`;
};
