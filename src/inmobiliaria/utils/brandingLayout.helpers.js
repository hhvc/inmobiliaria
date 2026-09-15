export const HERO_HEIGHT_OPTIONS = [
  { value: "compact", label: "Compacta", minHeight: 360 },
  { value: "balanced", label: "Equilibrada", minHeight: 480 },
  { value: "tall", label: "Amplia", minHeight: 620 },
];

export const HERO_IMAGE_POSITION_OPTIONS = [
  { value: "top", label: "Parte superior" },
  { value: "center", label: "Centro" },
  { value: "bottom", label: "Parte inferior" },
];

export const PROFILE_CARD_POSITION_OPTIONS = [
  { value: "right", label: "A la derecha" },
  { value: "left", label: "A la izquierda" },
  { value: "below", label: "Debajo de la portada" },
];

export const HERO_TEXT_ALIGNMENT_OPTIONS = [
  { value: "left", label: "A la izquierda" },
  { value: "center", label: "Centrado" },
];

export const PROFILE_CARD_STYLE_OPTIONS = [
  { value: "solid", label: "Blanca" },
  { value: "soft", label: "Semitransparente" },
];

export const HERO_OVERLAY_OPTIONS = [
  { value: "0.3", label: "Suave" },
  { value: "0.45", label: "Media" },
  { value: "0.6", label: "Intensa" },
  { value: "0.72", label: "Muy intensa" },
];

export const DEFAULT_BRANDING_LAYOUT = Object.freeze({
  heroHeight: "balanced",
  heroImagePosition: "center",
  profileCardPosition: "right",
  heroTextAlignment: "left",
  profileCardStyle: "solid",
  heroOverlayOpacity: 0.45,
});

const getAllowedValue = (options, value, fallback) => {
  return options.some((option) => option.value === value) ? value : fallback;
};

export const normalizeBrandingLayout = (branding = {}) => {
  const safeBranding = branding && typeof branding === "object" ? branding : {};
  const layout =
    safeBranding.layout && typeof safeBranding.layout === "object"
      ? safeBranding.layout
      : {};
  const rawOpacity = Number(
    layout.heroOverlayOpacity ?? safeBranding.heroOverlayOpacity,
  );
  const heroOverlayOpacity = HERO_OVERLAY_OPTIONS.some(
    (option) => Number(option.value) === rawOpacity,
  )
    ? rawOpacity
    : DEFAULT_BRANDING_LAYOUT.heroOverlayOpacity;

  return {
    heroHeight: getAllowedValue(
      HERO_HEIGHT_OPTIONS,
      layout.heroHeight,
      DEFAULT_BRANDING_LAYOUT.heroHeight,
    ),
    heroImagePosition: getAllowedValue(
      HERO_IMAGE_POSITION_OPTIONS,
      layout.heroImagePosition,
      DEFAULT_BRANDING_LAYOUT.heroImagePosition,
    ),
    profileCardPosition: getAllowedValue(
      PROFILE_CARD_POSITION_OPTIONS,
      layout.profileCardPosition,
      DEFAULT_BRANDING_LAYOUT.profileCardPosition,
    ),
    heroTextAlignment: getAllowedValue(
      HERO_TEXT_ALIGNMENT_OPTIONS,
      layout.heroTextAlignment,
      DEFAULT_BRANDING_LAYOUT.heroTextAlignment,
    ),
    profileCardStyle: getAllowedValue(
      PROFILE_CARD_STYLE_OPTIONS,
      layout.profileCardStyle,
      DEFAULT_BRANDING_LAYOUT.profileCardStyle,
    ),
    heroOverlayOpacity,
  };
};

export const getHeroMinHeight = (heroHeight) => {
  return (
    HERO_HEIGHT_OPTIONS.find((option) => option.value === heroHeight)
      ?.minHeight || 480
  );
};
