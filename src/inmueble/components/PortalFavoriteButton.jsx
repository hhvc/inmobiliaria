import { usePortalFavorites } from "../hooks/usePortalFavorites";
import { recordPortalPerformanceEvent } from "../services/portalPerformance.service";

const PortalFavoriteButton = ({
    item,
    className = "btn btn-light border portal-favorite-button",
    compact = false,
    performanceSource = "direct",
    presentationAgencyId = "",
    presentationBranchId = "",
}) => {
    const { isFavorite, toggleFavorite } = usePortalFavorites();
    const active = isFavorite(item);
    const label = active ? "Quitar de favoritos" : "Guardar en favoritos";

    return (
        <button
            type="button"
            className={`${className}${active ? " is-active" : ""}`}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const added = toggleFavorite(item);
                const ownerAgencyId =
                    item?.ownerInmobiliariaId ||
                    item?.sourceInmobiliariaId ||
                    item?.inmobiliariaId ||
                    "";

                if (added && ownerAgencyId && item?.sourceType !== "particular") {
                    void recordPortalPerformanceEvent({
                        eventType: "favorite_add",
                        source: performanceSource,
                        sourceType: item?.sourceType || "inmobiliaria",
                        ownerAgencyId,
                        presentationAgencyId: presentationAgencyId || ownerAgencyId,
                        branchId: presentationBranchId || item?.sucursalId || "",
                        inmuebleId: item?.id || "",
                    });
                }
            }}
            aria-label={label}
            aria-pressed={active}
            title={label}
        >
            <span aria-hidden="true" className="portal-favorite-heart">
                {active ? "♥" : "♡"}
            </span>
            {!compact && <span>{active ? "Guardado" : "Guardar"}</span>}
        </button>
    );
};

export default PortalFavoriteButton;
