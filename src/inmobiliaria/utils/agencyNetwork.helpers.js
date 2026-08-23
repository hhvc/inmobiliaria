export const normalizeAgencySlug = (value = "") => value
  .toString()
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 80);

export const buildSharedPublicationId = (ownerAgencyId, inmuebleId) => (
  `${ownerAgencyId || ""}_${inmuebleId || ""}`
);

export const isActivePromotion = (promotion, now = Date.now()) => {
  if (!promotion?.active) return false;
  const endsAt = promotion.endsAt;
  const endMs = typeof endsAt?.toMillis === "function"
    ? endsAt.toMillis()
    : Number(endsAt) || new Date(endsAt || 0).getTime();
  return Number.isFinite(endMs) && endMs > now;
};

export const buildAgencyPropertyPath = ({ agencySlug, branchSlug, inmueble }) => {
  const propertySlug = inmueble?.slug || inmueble?.id || "";
  if (!agencySlug || !propertySlug) return "/inmuebles";
  return branchSlug
    ? `/inmobiliaria/${agencySlug}/${branchSlug}/inmueble/${propertySlug}`
    : `/inmobiliaria/${agencySlug}/inmueble/${propertySlug}`;
};

export const mergeFriendPublication = ({ inmueble, override, agencySlug, branchSlug }) => ({
  ...inmueble,
  sourceInmobiliariaId:
    inmueble?.ownerInmobiliariaId || inmueble?.inmobiliariaId || "",
  syndicated: true,
  destacado: isActivePromotion(override?.promotion),
  promotion: override?.promotion || null,
  localPublication: override || null,
  publicPath: buildAgencyPropertyPath({ agencySlug, branchSlug, inmueble }),
});

export const canBranchManageInmueble = ({ role, assignedBranchIds = [], inmueble }) => {
  if (role === "admin" || role === "editor" || role === "root") return true;
  if (role !== "branch_manager") return false;
  return Boolean(inmueble?.sucursalId) && assignedBranchIds.includes(inmueble.sucursalId);
};
