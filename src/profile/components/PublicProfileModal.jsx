import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getPublicInmobiliariaById } from "../../inmobiliaria/services/inmobiliaria.service";
import { getPublicProfileById } from "../services/publicProfile.service";
import { getPublicProfileInitials } from "../utils/publicProfile.helpers";

const getAgencyLogoUrl = (agency = {}) =>
  agency.branding?.logo?.url ||
  agency.branding?.logoUrl ||
  agency.logoUrl ||
  "";

const buildAgencyProfile = (agency, fallback = {}) => {
  if (!agency) return fallback;

  const profile = agency.publicProfile || {};

  return {
    type: "agency",
    id: agency.id || fallback.id || "",
    name: profile.displayName || agency.nombre || fallback.name || "Inmobiliaria",
    photoURL: profile.photoURL || getAgencyLogoUrl(agency) || fallback.photoURL || "",
    headline: profile.headline || fallback.headline || "",
    bio: profile.bio || "",
    location: profile.location || "",
    profilePath: agency.slug ? `/inmobiliaria/${agency.slug}` : fallback.profilePath || "",
  };
};

const PublicProfileModal = ({ publisher, onClose }) => {
  const [profile, setProfile] = useState(publisher || null);
  const [loading, setLoading] = useState(Boolean(publisher?.id));

  useEffect(() => {
    if (!publisher) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("modal-open");

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [onClose, publisher]);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      if (!publisher) return;

      setProfile(publisher);
      setLoading(Boolean(publisher.id));

      try {
        if (publisher.type === "user") {
          const userProfile = await getPublicProfileById(publisher.id);

          if (mounted && userProfile?.isPublic) {
            setProfile({
              ...publisher,
              ...userProfile,
              type: "user",
              id: publisher.id,
              name: userProfile.displayName,
            });
          } else if (mounted) {
            setProfile({
              type: "user",
              id: publisher.id,
              name: "Usuario",
              photoURL: "",
              headline: "",
              bio: "",
              location: "",
              profilePath: "",
            });
          }
        } else if (publisher.id) {
          const agency = await getPublicInmobiliariaById(publisher.id);
          if (mounted) setProfile(buildAgencyProfile(agency, publisher));
        }
      } catch (error) {
        console.warn("No se pudo cargar la presentación pública:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [publisher]);

  const displayName = profile?.displayName || profile?.name || "Perfil público";
  const photoURL = profile?.photoURL || profile?.logoUrl || "";
  const hasPresentation = Boolean(profile?.headline || profile?.bio || profile?.location);
  const typeLabel = profile?.type === "user" ? "Acerca de quien publica" : "Acerca de la inmobiliaria";
  const modalTitleId = useMemo(
    () => `public-profile-${profile?.id || "publisher"}`,
    [profile?.id],
  );

  if (!publisher) return null;

  return (
    <>
      <div
        className="modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
        tabIndex={-1}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg overflow-hidden">
            <div className="modal-header border-0 pb-0">
              <span className="text-uppercase text-muted small fw-semibold">
                {typeLabel}
              </span>
              <button
                type="button"
                className="btn-close"
                aria-label="Cerrar presentación"
                onClick={onClose}
              />
            </div>

            <div className="modal-body p-4 p-md-5 pt-md-3">
              <div className="d-flex align-items-center gap-3 mb-4">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt={displayName}
                    className="public-profile-avatar"
                  />
                ) : (
                  <div className="public-profile-avatar public-profile-avatar-fallback">
                    {getPublicProfileInitials(displayName)}
                  </div>
                )}

                <div className="min-w-0">
                  <h2 className="h4 mb-1" id={modalTitleId}>
                    {displayName}
                  </h2>
                  {profile?.headline && (
                    <p className="text-muted mb-0">{profile.headline}</p>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="d-flex align-items-center gap-2 text-muted">
                  <span className="spinner-border spinner-border-sm" />
                  Cargando presentación...
                </div>
              ) : (
                <>
                  {profile?.bio && (
                    <p className="mb-3 public-profile-bio">{profile.bio}</p>
                  )}

                  {profile?.location && (
                    <p className="small text-muted mb-3">📍 {profile.location}</p>
                  )}

                  {!hasPresentation && (
                    <p className="text-muted mb-3">
                      Este perfil todavía no agregó una presentación pública.
                    </p>
                  )}

                  {profile?.profilePath && (
                    <Link
                      to={profile.profilePath}
                      className="btn btn-outline-primary"
                      onClick={onClose}
                    >
                      Ver página de la inmobiliaria
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
};

export default PublicProfileModal;
