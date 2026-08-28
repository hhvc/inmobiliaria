const GEOREF_SEARCH_URL =
  "https://apis.datos.gob.ar/georef/api/v2.0/direcciones";

const cleanText = (value, maxLength = 500) =>
  String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);

const normalizeText = (value = "") =>
  cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isCountryPart = (value = "") =>
  ["argentina", "republica argentina", "ar"].includes(normalizeText(value));

const toCoordinate = (value) => {
  if (value === null || value === undefined || value === "") return Number.NaN;
  return Number(value);
};

const parseFreeFormAddress = (query = "") => {
  const parts = cleanText(query)
    .split(",")
    .map((part) => cleanText(part, 160))
    .filter(Boolean);

  if (parts.length === 0) {
    return { direction: "", locality: "", province: "" };
  }

  const geographicParts = parts.slice(1).filter((part) => !isCountryPart(part));

  return {
    direction: parts[0],
    locality: geographicParts[0] || "",
    province: geographicParts.length > 1
      ? geographicParts[geographicParts.length - 1]
      : "",
  };
};

export const buildGeorefSearchUrl = (query, context = {}) => {
  const safeQuery = cleanText(query);
  const parsed = parseFreeFormAddress(safeQuery);
  const structuredDirection = [context.street, context.number]
    .map((part) => cleanText(part, 160))
    .filter(Boolean)
    .join(" ");
  const direction = structuredDirection || parsed.direction || safeQuery;
  const locality = cleanText(
    context.locality || context.city || parsed.locality,
    160,
  );
  const province = cleanText(context.province || parsed.province, 160);

  if (direction.length < 5) {
    throw new Error("Completá calle y número antes de buscar la dirección.");
  }

  const url = new URL(GEOREF_SEARCH_URL);
  const params = new URLSearchParams({
    direccion: direction,
    max: "5",
  });

  if (locality) params.set("localidad", locality);
  if (province) params.set("provincia", province);

  url.search = params.toString();
  return url;
};

export const mapGeorefCandidates = (data = {}) => {
  const addresses = Array.isArray(data?.direcciones) ? data.direcciones : [];

  return addresses
    .map((item, index) => {
      const latitude = toCoordinate(item?.ubicacion?.lat);
      const longitude = toCoordinate(item?.ubicacion?.lon);
      const locality = cleanText(
        item?.localidad?.nombre || item?.localidad_censal?.nombre,
        160,
      );
      const province = cleanText(item?.provincia?.nombre, 160);
      const height = item?.altura?.valor ?? "";
      const streetId = cleanText(item?.calle?.id, 100);

      return {
        id: [streetId, height, latitude, longitude, index].join(":"),
        providerId: streetId ? `${streetId}:${height}` : "",
        label: cleanText(item?.nomenclatura, 700),
        locationLabel: [locality, province].filter(Boolean).join(", "),
        latitude,
        longitude,
        precision: height !== "" && height !== null ? "address" : "street",
        source: "georef_argentina",
        provider: "Georef Argentina",
      };
    })
    .filter(
      (item) =>
        item.label &&
        Number.isFinite(item.latitude) &&
        Number.isFinite(item.longitude),
    );
};

export const searchAddressCandidates = async (query, context = {}) => {
  const url = buildGeorefSearchUrl(query, context);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("El buscador oficial de direcciones no respondió correctamente.");
    }

    return mapGeorefCandidates(await response.json());
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("La búsqueda demoró demasiado. Volvé a intentarlo.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
