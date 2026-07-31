export const INSTAGRAM_REEL_MAX_FILES = 5;
export const INSTAGRAM_REEL_MAX_BYTES = 300 * 1024 * 1024;
export const INSTAGRAM_REEL_MIN_DURATION_SECONDS = 3;
export const INSTAGRAM_REEL_MAX_DURATION_SECONDS = 15 * 60;
export const INSTAGRAM_REEL_MAX_WIDTH = 1920;

const ALLOWED_CONTENT_TYPES = new Set(["video/mp4", "video/quicktime"]);
const ALLOWED_EXTENSIONS = new Set(["mp4", "mov"]);

const cleanText = (value = "", maxLength = 500) =>
  value?.toString?.().trim().slice(0, maxLength) || "";

const getExtension = (fileName = "") =>
  cleanText(fileName).toLowerCase().split(".").pop() || "";

export const validateInstagramReelMetadata = (metadata = {}) => {
  const errors = [];
  const name = cleanText(metadata.name, 300);
  const contentType = cleanText(metadata.contentType || metadata.type, 100)
    .toLowerCase();
  const extension = getExtension(name);
  const size = Number(metadata.size || 0);
  const duration = Number(metadata.duration || 0);
  const width = Number(metadata.width || 0);

  if (
    !ALLOWED_CONTENT_TYPES.has(contentType) &&
    !ALLOWED_EXTENSIONS.has(extension)
  ) {
    errors.push("El video debe estar en formato MP4 o MOV.");
  }
  if (!Number.isFinite(size) || size <= 0) {
    errors.push("No se pudo determinar el tamaño del video.");
  } else if (size > INSTAGRAM_REEL_MAX_BYTES) {
    errors.push("El video supera el límite de 300 MB de OnoProp.");
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    errors.push("No se pudo determinar la duración del video.");
  } else if (duration < INSTAGRAM_REEL_MIN_DURATION_SECONDS) {
    errors.push("El Reel debe durar al menos 3 segundos.");
  } else if (duration > INSTAGRAM_REEL_MAX_DURATION_SECONDS) {
    errors.push("El Reel no puede superar los 15 minutos.");
  }
  if (!Number.isFinite(width) || width <= 0) {
    errors.push("No se pudo determinar la resolución del video.");
  } else if (width > INSTAGRAM_REEL_MAX_WIDTH) {
    errors.push("El ancho del video no puede superar 1920 píxeles.");
  }

  return errors;
};

export const normalizeInstagramReel = (reel = {}) => ({
  id: cleanText(reel.id, 128),
  url: cleanText(reel.url, 3000),
  storagePath: cleanText(reel.storagePath, 1000),
  name: cleanText(reel.name, 300),
  contentType: cleanText(reel.contentType, 100).toLowerCase(),
  size: Math.max(0, Number(reel.size || 0)),
  duration: Math.max(0, Number(reel.duration || 0)),
  width: Math.max(0, Number(reel.width || 0)),
  height: Math.max(0, Number(reel.height || 0)),
  createdAt: cleanText(reel.createdAt, 100),
  uploadedBy: cleanText(reel.uploadedBy, 128),
});

export const normalizeInstagramReels = (reels = []) => {
  if (!Array.isArray(reels)) return [];

  const seen = new Set();
  return reels
    .map(normalizeInstagramReel)
    .filter((reel) => {
      if (!reel.id || !reel.url || !reel.storagePath || seen.has(reel.id)) {
        return false;
      }
      seen.add(reel.id);
      return true;
    })
    .slice(0, INSTAGRAM_REEL_MAX_FILES);
};

export const getInstagramReelAspectWarning = (reel = {}) => {
  const width = Number(reel.width || 0);
  const height = Number(reel.height || 0);
  if (!width || !height) return "";

  const ratio = width / height;
  const target = 9 / 16;
  return Math.abs(ratio - target) > 0.03
    ? "Para ocupar toda la pantalla de Reels se recomienda formato vertical 9:16."
    : "";
};

