export const PUBLIC_PROFILE_LIMITS = Object.freeze({
  displayName: 100,
  headline: 140,
  bio: 1500,
  location: 100,
});

const normalizeText = (value = "") =>
  value
    .toString()
    .replace(/\s+/g, " ")
    .trim();

const normalizeMultilineText = (value = "") =>
  value
    .toString()
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const normalizePublicProfile = (profile = {}, fallback = {}) => ({
  uid: normalizeText(profile.uid || fallback.uid),
  displayName: normalizeText(
    profile.displayName || fallback.displayName || "",
  ),
  photoURL: normalizeText(profile.photoURL || fallback.photoURL || ""),
  photoPath: normalizeText(profile.photoPath || ""),
  headline: normalizeText(profile.headline || ""),
  bio: normalizeMultilineText(profile.bio || ""),
  location: normalizeText(profile.location || ""),
  isPublic: profile.isPublic !== false,
});

export const validatePublicProfile = (profile = {}) => {
  const normalized = normalizePublicProfile(profile);
  const errors = {};

  if (normalized.displayName.length < 2) {
    errors.displayName = "Ingresá un nombre de al menos 2 caracteres.";
  } else if (normalized.displayName.length > PUBLIC_PROFILE_LIMITS.displayName) {
    errors.displayName = `El nombre no puede superar los ${PUBLIC_PROFILE_LIMITS.displayName} caracteres.`;
  }

  if (normalized.headline.length > PUBLIC_PROFILE_LIMITS.headline) {
    errors.headline = `El título no puede superar los ${PUBLIC_PROFILE_LIMITS.headline} caracteres.`;
  }

  if (normalized.bio.length > PUBLIC_PROFILE_LIMITS.bio) {
    errors.bio = `La presentación no puede superar los ${PUBLIC_PROFILE_LIMITS.bio} caracteres.`;
  }

  if (normalized.location.length > PUBLIC_PROFILE_LIMITS.location) {
    errors.location = `La ubicación no puede superar los ${PUBLIC_PROFILE_LIMITS.location} caracteres.`;
  }

  return errors;
};

export const getPublicProfileInitials = (displayName = "") => {
  const words = normalizeText(displayName).split(" ").filter(Boolean);

  if (words.length === 0) return "OP";

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
};

export const resolveInmueblePublisherMode = (inmueble = {}) => {
  if (inmueble.publisherMode === "user") return "user";
  if (inmueble.publisherMode === "agency") return "agency";
  if (inmueble.publisher?.type === "user") return "user";
  return "agency";
};

export const buildInmueblePublisherDescriptor = ({
  inmueble = {},
  agency = null,
  forceAgency = false,
} = {}) => {
  const agencyId =
    agency?.id ||
    agency?.inmobiliariaId ||
    inmueble.inmobiliariaId ||
    inmueble.ownerInmobiliariaId ||
    inmueble.sourceInmobiliariaId ||
    "";
  const agencyName =
    agency?.nombre ||
    inmueble.inmobiliariaNombre ||
    inmueble.sourceLabel ||
    inmueble.publisher?.name ||
    "Inmobiliaria adherida";
  const agencyLogo =
    agency?.branding?.logo?.url ||
    agency?.branding?.logoUrl ||
    inmueble.inmobiliariaLogoUrl ||
    inmueble.sourceLogoUrl ||
    "";

  if (!forceAgency && resolveInmueblePublisherMode(inmueble) === "user") {
    return {
      type: "user",
      id:
        inmueble.publisherUserId ||
        inmueble.publisher?.id ||
        inmueble.createdBy ||
        "",
      name: inmueble.publisher?.name || inmueble.sourceLabel || "Usuario",
      photoURL:
        inmueble.publisher?.photoURL ||
        inmueble.publisher?.logoUrl ||
        inmueble.sourceLogoUrl ||
        "",
      headline: inmueble.publisher?.headline || "",
      profilePath: "",
    };
  }

  return {
    type: "agency",
    id: agencyId,
    name: agencyName,
    photoURL: agencyLogo,
    headline: agency?.publicProfile?.headline || "",
    profilePath:
      agency?.slug || inmueble.inmobiliariaSlug || inmueble.publisher?.slug
        ? `/inmobiliaria/${
            agency?.slug ||
            inmueble.inmobiliariaSlug ||
            inmueble.publisher?.slug
          }`
        : "",
  };
};
