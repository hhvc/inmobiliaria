import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/auth/useAuth";
import { db } from "../firebase/config";
import {
  getMyPublicProfile,
  saveMyPublicProfile,
  validatePublicProfilePhoto,
} from "../profile/services/publicProfile.service";
import {
  PUBLIC_PROFILE_LIMITS,
  getPublicProfileInitials,
  validatePublicProfile,
} from "../profile/utils/publicProfile.helpers";

const INITIAL_FORM = {
  displayName: "",
  photoURL: "",
  headline: "",
  bio: "",
  location: "",
  isPublic: true,
};

const UserProfilePage = () => {
  const { user, refreshUserAccess } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL_FORM);
  const [meta, setMeta] = useState({
    roles: [],
    primaryRole: "usuario",
    inmobiliarias: [],
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const photoPreview = useMemo(() => {
    if (photoFile) return URL.createObjectURL(photoFile);
    return photoRemoved ? "" : form.photoURL;
  }, [form.photoURL, photoFile, photoRemoved]);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      if (!user?.uid) return;

      try {
        setLoading(true);
        setError("");

        const [privateSnap, publicProfile] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getMyPublicProfile(),
        ]);
        const privateData = privateSnap.exists() ? privateSnap.data() : {};

        if (!mounted) return;

        setForm({
          displayName:
            publicProfile?.displayName ||
            privateData.displayName ||
            user.displayName ||
            "",
          photoURL:
            publicProfile?.photoURL ||
            privateData.photoURL ||
            user.photoURL ||
            "",
          headline: publicProfile?.headline || "",
          bio: publicProfile?.bio || "",
          location: publicProfile?.location || "",
          isPublic: publicProfile ? publicProfile.isPublic !== false : true,
        });
        setMeta({
          roles: Array.isArray(privateData.roles)
            ? privateData.roles
            : [privateData.role || "usuario"],
          primaryRole:
            privateData.primaryRole || privateData.role || "usuario",
          inmobiliarias: Array.isArray(privateData.inmobiliarias)
            ? privateData.inmobiliarias
            : [],
        });
      } catch (loadError) {
        console.error("Error cargando perfil:", loadError);
        if (mounted) setError("No se pudo cargar tu perfil.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [user]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((previous) => ({ ...previous, [name]: "" }));
    setError("");
    setSuccess("");
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    try {
      validatePublicProfilePhoto(file);
      setPhotoFile(file);
      setPhotoRemoved(false);
      setError("");
      setSuccess("");
    } catch (photoError) {
      event.target.value = "";
      setError(photoError.message);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoRemoved(true);
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationErrors = validatePublicProfile(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const savedProfile = await saveMyPublicProfile(form, {
        photoFile,
        removePhoto: photoRemoved,
      });

      setForm((previous) => ({
        ...previous,
        ...savedProfile,
      }));
      setPhotoFile(null);
      setPhotoRemoved(false);
      await refreshUserAccess();
      setSuccess("Perfil actualizado correctamente.");
    } catch (saveError) {
      console.error("Error guardando perfil:", saveError);
      if (saveError.validationErrors) setErrors(saveError.validationErrors);
      setError(saveError.message || "No se pudo actualizar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="container py-5 text-center">
        <div className="spinner-border" />
        <p className="text-muted mt-3">Cargando tu perfil...</p>
      </main>
    );
  }

  return (
    <main className="container py-4 py-lg-5">
      <div className="row justify-content-center g-4">
        <section className="col-lg-8">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4 p-lg-5">
              <p className="text-uppercase text-muted small mb-1">Tu cuenta</p>
              <h1 className="h3 mb-2">Mi perfil</h1>
              <p className="text-muted mb-4">
                Elegí cómo querés presentarte cuando publiques a título personal.
                Tu email, roles y vinculaciones nunca se muestran en la ficha pública.
              </p>

              {error && <div className="alert alert-danger">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              <form onSubmit={handleSubmit} noValidate>
                <div className="row g-4">
                  <div className="col-md-4">
                    <div className="d-flex flex-column align-items-center text-center gap-3">
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Vista previa de tu perfil"
                          className="public-profile-avatar public-profile-avatar-editor"
                        />
                      ) : (
                        <div className="public-profile-avatar public-profile-avatar-editor public-profile-avatar-fallback">
                          {getPublicProfileInitials(form.displayName)}
                        </div>
                      )}

                      <div className="w-100">
                        <label className="btn btn-outline-primary btn-sm w-100">
                          Elegir foto
                          <input
                            type="file"
                            className="visually-hidden"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handlePhotoChange}
                            disabled={saving}
                          />
                        </label>
                        {(photoPreview || photoFile) && (
                          <button
                            type="button"
                            className="btn btn-link btn-sm text-danger mt-1"
                            onClick={handleRemovePhoto}
                            disabled={saving}
                          >
                            Quitar foto
                          </button>
                        )}
                        <div className="form-text">JPG, PNG o WebP. Máximo 5 MB.</div>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-8">
                    <div className="mb-3">
                      <label className="form-label" htmlFor="profile-display-name">
                        Nombre público *
                      </label>
                      <input
                        id="profile-display-name"
                        type="text"
                        name="displayName"
                        className={`form-control ${errors.displayName ? "is-invalid" : ""}`}
                        value={form.displayName}
                        onChange={handleChange}
                        maxLength={PUBLIC_PROFILE_LIMITS.displayName}
                        disabled={saving}
                      />
                      {errors.displayName && (
                        <div className="invalid-feedback">{errors.displayName}</div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="profile-headline">
                        Título o frase breve
                      </label>
                      <input
                        id="profile-headline"
                        type="text"
                        name="headline"
                        className={`form-control ${errors.headline ? "is-invalid" : ""}`}
                        value={form.headline}
                        onChange={handleChange}
                        maxLength={PUBLIC_PROFILE_LIMITS.headline}
                        placeholder="Ej.: Asesor inmobiliario y anfitrión en Córdoba"
                        disabled={saving}
                      />
                      {errors.headline && (
                        <div className="invalid-feedback">{errors.headline}</div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="profile-location">
                        Ubicación pública
                      </label>
                      <input
                        id="profile-location"
                        type="text"
                        name="location"
                        className={`form-control ${errors.location ? "is-invalid" : ""}`}
                        value={form.location}
                        onChange={handleChange}
                        maxLength={PUBLIC_PROFILE_LIMITS.location}
                        placeholder="Ej.: Córdoba, Argentina"
                        disabled={saving}
                      />
                      {errors.location && (
                        <div className="invalid-feedback">{errors.location}</div>
                      )}
                    </div>
                  </div>

                  <div className="col-12">
                    <label className="form-label" htmlFor="profile-bio">
                      Presentación pública
                    </label>
                    <textarea
                      id="profile-bio"
                      name="bio"
                      className={`form-control ${errors.bio ? "is-invalid" : ""}`}
                      rows={7}
                      value={form.bio}
                      onChange={handleChange}
                      maxLength={PUBLIC_PROFILE_LIMITS.bio}
                      placeholder="Contá quién sos, tu experiencia y qué valorás al acompañar a tus clientes o huéspedes."
                      disabled={saving}
                    />
                    <div className="d-flex justify-content-between form-text">
                      <span>Esta información podrá verse desde tus publicaciones.</span>
                      <span>{form.bio.length}/{PUBLIC_PROFILE_LIMITS.bio}</span>
                    </div>
                    {errors.bio && <div className="invalid-feedback">{errors.bio}</div>}
                  </div>

                  <div className="col-12">
                    <div className="form-check form-switch border rounded-3 p-3 ps-5">
                      <input
                        id="profile-is-public"
                        className="form-check-input"
                        type="checkbox"
                        name="isPublic"
                        checked={form.isPublic}
                        onChange={handleChange}
                        disabled={saving}
                      />
                      <label className="form-check-label fw-semibold" htmlFor="profile-is-public">
                        Habilitar mi presentación pública
                      </label>
                      <div className="small text-muted">
                        Si la desactivás, tus avisos volverán a presentarse con el perfil de la inmobiliaria.
                      </div>
                    </div>
                  </div>

                  <div className="col-12">
                    <label className="form-label">Email de acceso</label>
                    <input
                      type="email"
                      className="form-control"
                      value={user?.email || ""}
                      disabled
                    />
                    <div className="form-text">Este dato es privado y no se publica.</div>
                  </div>

                  <div className="col-12 d-flex flex-wrap justify-content-between gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => navigate(-1)}
                      disabled={saving}
                    >
                      Volver
                    </button>
                    <button type="submit" className="btn btn-primary px-4" disabled={saving}>
                      {saving ? "Guardando..." : "Guardar perfil"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </section>

        <aside className="col-lg-4">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
              <h2 className="h5 mb-3">Vista previa pública</h2>
              <div className="border rounded-4 p-4 text-center">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Vista previa pública"
                    className="public-profile-avatar mb-3"
                  />
                ) : (
                  <div className="public-profile-avatar public-profile-avatar-fallback mx-auto mb-3">
                    {getPublicProfileInitials(form.displayName)}
                  </div>
                )}
                <h3 className="h5 mb-1">{form.displayName || "Tu nombre"}</h3>
                {form.headline && <p className="text-muted small">{form.headline}</p>}
                {form.bio && (
                  <p className="small mb-2 public-profile-bio">{form.bio}</p>
                )}
                {form.location && <p className="small text-muted mb-0">📍 {form.location}</p>}
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <h2 className="h6">Información interna</h2>
              <div className="small text-muted mb-2">Rol principal</div>
              <span className="badge text-bg-secondary mb-3">{meta.primaryRole}</span>
              <div className="small text-muted mb-2">Roles asignados</div>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {meta.roles.map((role) => (
                  <span key={role} className="badge text-bg-light border text-dark">
                    {role}
                  </span>
                ))}
              </div>
              <div className="small text-muted">
                Inmobiliarias vinculadas: {meta.inmobiliarias.length}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default UserProfilePage;
