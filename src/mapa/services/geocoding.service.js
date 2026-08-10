const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

const cleanText = (value, maxLength = 500) =>
  String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);

export const searchAddressCandidates = async (query) => {
  const safeQuery = cleanText(query);
  if (safeQuery.length < 5) {
    throw new Error("Completá una dirección más precisa antes de buscar.");
  }

  const url = new URL(NOMINATIM_SEARCH_URL);
  url.search = new URLSearchParams({
    q: safeQuery,
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "ar",
    limit: "5",
  }).toString();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "es-AR,es;q=0.9",
    },
  });
  if (!response.ok) {
    throw new Error("El buscador geográfico no respondió correctamente.");
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => ({
      id: String(item.place_id || `${item.lat}-${item.lon}`),
      label: cleanText(item.display_name, 700),
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.latitude) && Number.isFinite(item.longitude),
    );
};
