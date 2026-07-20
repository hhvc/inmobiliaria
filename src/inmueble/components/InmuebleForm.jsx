import { useContext, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

import {
  OPERACIONES_OPCIONES,
  TIPOS_INMUEBLE_OPCIONES,
} from "../utils/inmuebleSchema";

import { INMUEBLE_ESTADOS_ARRAY } from "../../domain/inmueble/inmueble.constants";
import { AuthContext } from "../../context/auth/AuthContext";
import { db } from "../../firebase/config";

import { useInmuebleImages } from "../hooks/useInmuebleImages";
import InmuebleGallery from "./InmuebleGallery";

const DEFAULT_SHARING = {
  enabled: false,
  mode: "all_colleagues",
  allowColleagueContact: true,
  showExactAddressToColleagues: false,
  showOwnerDataToColleagues: false,
};

const DEFAULT_NETWORK_DATA = {
  exactAddress: "",
  commissionShare: "",
  internalPrice: "",
  documentationStatus: "",
  visitInstructions: "",
  notesForColleagues: "",
  ownerName: "",
  ownerPhone: "",
};

const normalizeRole = (role = "") => {
  const value = role.toString().trim().toLowerCase();

  if (value === "user") return "usuario";

  return value;
};

const userHasRole = (user, role) => {
  if (!user) return false;

  const normalizedRole = normalizeRole(role);

  const roles = Array.isArray(user.roles)
    ? user.roles.map((item) => normalizeRole(item))
    : [];

  const primaryRole = normalizeRole(user.primaryRole || user.role || "");

  return roles.includes(normalizedRole) || primaryRole === normalizedRole;
};

const normalizeInmobiliariaDoc = (docSnap) => {
  if (!docSnap?.exists?.()) return null;

  const data = docSnap.data();

  return {
    id: docSnap.id,
    nombre: data.nombre || data.razonSocial || docSnap.id,
    razonSocial: data.razonSocial || "",
    slug: data.slug || "",
    activa: data.activa !== false,
  };
};

const InmuebleForm = ({
  values = {},
  errors = {},
  loading = false,
  initialLoading = false,
  isEditMode = false,
  handleChange,
  handleNestedChange,
  handleSubmit,
  inmuebleId = null,
  inmobiliariaId = null,
}) => {
  const { user, activeInmobiliariaId } = useContext(AuthContext);

  const [inmobiliariasById, setInmobiliariasById] = useState({});
  const [loadingInmobiliarias, setLoadingInmobiliarias] = useState(false);

  const imageManager = useInmuebleImages(values?.images ?? []);

  const {
    images,
    addImages,
    reorderImages,
    loading: imagesLoading,
    error: imagesError,
  } = imageManager;

  const removeImage = imageManager.removeImage;

  const rawUserInmobiliarias = user?.inmobiliarias;

  const userInmobiliarias = useMemo(() => {
    return Array.isArray(rawUserInmobiliarias) ? rawUserInmobiliarias : [];
  }, [rawUserInmobiliarias]);

  const selectedInmobiliariaId =
    values?.inmobiliariaId || inmobiliariaId || activeInmobiliariaId || "";

  const selectorInmobiliariaIds = useMemo(() => {
    return Array.from(
      new Set([...userInmobiliarias, selectedInmobiliariaId].filter(Boolean)),
    );
  }, [selectedInmobiliariaId, userInmobiliarias]);

  const selectorInmobiliariaIdsKey = selectorInmobiliariaIds.join("|");

  useEffect(() => {
    let mounted = true;

    const fetchInmobiliarias = async () => {
      const ids = selectorInmobiliariaIdsKey.split("|").filter(Boolean);

      if (ids.length === 0) {
        setInmobiliariasById({});
        return;
      }

      try {
        setLoadingInmobiliarias(true);

        const docs = await Promise.all(
          ids.map(async (id) => {
            const ref = doc(db, "inmobiliarias", id);
            const snap = await getDoc(ref);

            return normalizeInmobiliariaDoc(snap);
          }),
        );

        if (!mounted) return;

        const mapped = docs.filter(Boolean).reduce((acc, inmobiliaria) => {
          acc[inmobiliaria.id] = inmobiliaria;
          return acc;
        }, {});

        setInmobiliariasById(mapped);
      } catch (error) {
        console.error("Error cargando nombres de inmobiliarias:", error);
      } finally {
        if (mounted) {
          setLoadingInmobiliarias(false);
        }
      }
    };

    fetchInmobiliarias();

    return () => {
      mounted = false;
    };
  }, [selectorInmobiliariaIdsKey]);

  const puedeCambiarInmobiliaria =
    selectorInmobiliariaIds.length > 1 &&
    (userHasRole(user, "root") || userHasRole(user, "admin"));

  const sharingValues = {
    ...DEFAULT_SHARING,
    ...(values?.sharing || {}),
  };

  const networkDataValues = {
    ...DEFAULT_NETWORK_DATA,
    ...(values?.networkData || {}),
  };

  const sharingEnabled = Boolean(sharingValues.enabled);

  const updateSharingField = (field, value) => {
    handleNestedChange("sharing", field, value);
  };

  const updateNetworkDataField = (field, value) => {
    handleNestedChange("networkData", field, value);
  };

  const onSubmit = (e) => {
    e.preventDefault();

    const finalInmobiliariaId =
      values?.inmobiliariaId || inmobiliariaId || activeInmobiliariaId;

    const normalizedSharing = {
      ...DEFAULT_SHARING,
      ...(values?.sharing || {}),
      enabled: Boolean(sharingValues.enabled),
      allowColleagueContact: Boolean(sharingValues.allowColleagueContact),
      showExactAddressToColleagues: Boolean(
        sharingValues.showExactAddressToColleagues,
      ),
      showOwnerDataToColleagues: Boolean(
        sharingValues.showOwnerDataToColleagues,
      ),
    };

    const normalizedNetworkData = {
      ...DEFAULT_NETWORK_DATA,
      ...(values?.networkData || {}),
    };

    handleSubmit({
      ...values,

      images: isEditMode ? images : values?.images || [],

      inmobiliariaId: finalInmobiliariaId,
      ownerInmobiliariaId: values?.ownerInmobiliariaId || finalInmobiliariaId,

      sharedWith: values?.sharedWith || {},
      deleted: values?.deleted ?? false,

      estado: values?.estado || "activo",

      publicarEnPortal: Boolean(values?.publicarEnPortal),
      noIndex: Boolean(values?.noIndex),

      sharing: normalizedSharing,
      networkData: normalizedNetworkData,
    });
  };

  if (initialLoading) {
    return <div className="text-center py-5">Cargando inmueble...</div>;
  }

  return (
    <form onSubmit={onSubmit}>
      {/* =========================
          Inmobiliaria
         ========================= */}
      {puedeCambiarInmobiliaria ? (
        <div className="card mb-4">
          <div className="card-header fw-semibold">Inmobiliaria</div>
          <div className="card-body">
            <select
              className="form-select"
              name="inmobiliariaId"
              value={selectedInmobiliariaId}
              onChange={handleChange}
            >
              <option value="" disabled>
                Seleccionar inmobiliaria
              </option>

              {selectorInmobiliariaIds.map((id) => {
                const inmobiliaria = inmobiliariasById[id];

                return (
                  <option key={id} value={id}>
                    {inmobiliaria?.nombre || inmobiliaria?.razonSocial || id}
                    {inmobiliaria?.slug ? ` /${inmobiliaria.slug}` : ""}
                  </option>
                );
              })}
            </select>

            {loadingInmobiliarias && (
              <div className="form-text">
                Cargando nombres de inmobiliarias...
              </div>
            )}
          </div>
        </div>
      ) : (
        <input
          type="hidden"
          name="inmobiliariaId"
          value={selectedInmobiliariaId}
          readOnly
        />
      )}

      {/* =========================
          Información básica
         ========================= */}
      <div className="card mb-4">
        <div className="card-header fw-semibold">Información básica</div>
        <div className="card-body row g-3">
          <div className="col-12">
            <label className="form-label">Título *</label>
            <input
              type="text"
              name="titulo"
              className={`form-control ${errors.titulo ? "is-invalid" : ""}`}
              value={values?.titulo || ""}
              onChange={handleChange}
            />
            {errors.titulo && (
              <div className="invalid-feedback">{errors.titulo}</div>
            )}
          </div>

          <div className="col-12">
            <label className="form-label">Descripción</label>
            <textarea
              name="descripcion"
              className="form-control"
              rows={3}
              value={values?.descripcion || ""}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* =========================
          Clasificación
         ========================= */}
      <div className="card mb-4">
        <div className="card-header fw-semibold">Clasificación</div>
        <div className="card-body row g-3">
          <div className="col-md-6">
            <label className="form-label">Tipo *</label>
            <select
              name="tipo"
              className={`form-select ${errors.tipo ? "is-invalid" : ""}`}
              value={values?.tipo || ""}
              onChange={handleChange}
            >
              <option value="">Seleccionar</option>
              {TIPOS_INMUEBLE_OPCIONES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {errors.tipo && (
              <div className="invalid-feedback">{errors.tipo}</div>
            )}
          </div>

          <div className="col-md-6">
            <label className="form-label">Operación *</label>
            <select
              name="operacion"
              className={`form-select ${errors.operacion ? "is-invalid" : ""
                }`}
              value={values?.operacion || ""}
              onChange={handleChange}
            >
              <option value="">Seleccionar</option>
              {OPERACIONES_OPCIONES.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.label}
                </option>
              ))}
            </select>
            {errors.operacion && (
              <div className="invalid-feedback">{errors.operacion}</div>
            )}
          </div>
        </div>
      </div>

      {/* =========================
          Precio
         ========================= */}
      {values?.operacion !== "tasacion" && (
        <div className="card mb-4">
          <div className="card-header fw-semibold">Precio</div>
          <div className="card-body row g-3">
            <div className="col-md-4">
              <label className="form-label">Precio *</label>
              <input
                type="number"
                name="precio"
                className={`form-control ${errors.precio ? "is-invalid" : ""
                  }`}
                value={values?.precio || ""}
                onChange={handleChange}
              />
              {errors.precio && (
                <div className="invalid-feedback">{errors.precio}</div>
              )}
            </div>

            <div className="col-md-4">
              <label className="form-label">Moneda</label>
              <select
                name="moneda"
                className="form-select"
                value={values?.moneda || "USD"}
                onChange={handleChange}
              >
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Expensas</label>
              <input
                type="number"
                name="expensas"
                className="form-control"
                value={values?.expensas || ""}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
      )}

      {/* =========================
          Ubicación
         ========================= */}
      <div className="card mb-4">
        <div className="card-header fw-semibold">Ubicación</div>
        <div className="card-body row g-3">
          <div className="col-md-4">
            <label className="form-label">Calle</label>
            <input
              className="form-control"
              value={values?.direccion?.calle || ""}
              onChange={(e) =>
                handleNestedChange("direccion", "calle", e.target.value)
              }
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">Número</label>
            <input
              className="form-control"
              value={values?.direccion?.numero || ""}
              onChange={(e) =>
                handleNestedChange("direccion", "numero", e.target.value)
              }
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Barrio</label>
            <input
              className="form-control"
              value={values?.direccion?.barrio || ""}
              onChange={(e) =>
                handleNestedChange("direccion", "barrio", e.target.value)
              }
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Ciudad *</label>
            <input
              className={`form-control ${errors.ciudad ? "is-invalid" : ""}`}
              value={values?.direccion?.ciudad || ""}
              onChange={(e) =>
                handleNestedChange("direccion", "ciudad", e.target.value)
              }
            />
            {errors.ciudad && (
              <div className="invalid-feedback">{errors.ciudad}</div>
            )}
          </div>
        </div>
      </div>

      {/* =========================
          Imágenes
         ========================= */}
      <div className="card mb-4">
        <div className="card-header fw-semibold">Imágenes</div>
        <div className="card-body">
          {isEditMode && inmuebleId ? (
            <InmuebleGallery
              images={images}
              onAddImages={addImages}
              onRemoveImage={(image) => {
                if (typeof removeImage !== "function") {
                  console.error(
                    "removeImage no está disponible en useInmuebleImages. API recibida:",
                    imageManager,
                  );
                  return;
                }

                removeImage({
                  image,
                  inmuebleId,
                  inmobiliariaId: selectedInmobiliariaId,
                });
              }}
              onReorderImages={(fromIndex, toIndex) =>
                reorderImages({
                  fromIndex,
                  toIndex,
                  inmuebleId,
                  inmobiliariaId: selectedInmobiliariaId,
                })
              }
              loading={imagesLoading}
              error={imagesError}
              inmuebleId={inmuebleId}
              inmobiliariaId={selectedInmobiliariaId}
            />
          ) : (
            <div className="alert alert-info mb-0">
              Primero creá el inmueble. Después vas a poder cargar y ordenar las
              imágenes desde la edición.
            </div>
          )}
        </div>
      </div>

      {/* =========================
          Publicación
         ========================= */}
      <div className="card mb-4">
        <div className="card-header fw-semibold">Publicación</div>
        <div className="card-body row g-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Estado *</label>
            <select
              name="estado"
              className={`form-select ${errors.estado ? "is-invalid" : ""}`}
              value={values?.estado || "activo"}
              onChange={handleChange}
            >
              {INMUEBLE_ESTADOS_ARRAY.map((estado) => (
                <option key={estado} value={estado}>
                  {estado.charAt(0).toUpperCase() + estado.slice(1)}
                </option>
              ))}
            </select>
            {errors.estado && (
              <div className="invalid-feedback">{errors.estado}</div>
            )}
          </div>

          <div className="col-md-4">
            <div className="form-check mt-4">
              <input
                className="form-check-input"
                type="checkbox"
                name="destacado"
                checked={Boolean(values?.destacado)}
                onChange={handleChange}
              />
              <label className="form-check-label">Destacado</label>
            </div>
          </div>

          <div className="col-md-4">
            <div className="form-check mt-4">
              <input
                className="form-check-input"
                type="checkbox"
                name="publicarEnPortal"
                checked={Boolean(values?.publicarEnPortal)}
                onChange={handleChange}
              />
              <label className="form-check-label">Publicar en portal</label>
            </div>
          </div>

          <div className="col-md-4">
            <div className="form-check mt-4">
              <input
                className="form-check-input"
                type="checkbox"
                name="noIndex"
                checked={Boolean(values?.noIndex)}
                onChange={handleChange}
              />
              <label className="form-check-label">No indexar en Google</label>
            </div>
          </div>

          {values?.noIndex && (
            <div className="col-12">
              <div className="alert alert-warning small mb-0">
                Esta publicación puede verse si está publicada en el portal,
                pero no será incluida en el sitemap y la ficha pública enviará
                la indicación <strong>noindex</strong> a los buscadores.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================
          Red de colegas
         ========================= */}
      <div className="card mb-4">
        <div className="card-header fw-semibold">Red de colegas</div>

        <div className="card-body">
          <div className="form-check form-switch mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              id="sharingEnabled"
              checked={sharingEnabled}
              onChange={(e) => updateSharingField("enabled", e.target.checked)}
            />

            <label className="form-check-label" htmlFor="sharingEnabled">
              Compartir este inmueble con colegas
            </label>
          </div>

          <p className="text-muted small mb-0">
            Al compartirlo, otras inmobiliarias habilitadas en ONO Prop podrán
            ver información comercial adicional que no se muestra al público
            general.
          </p>

          {sharingEnabled && (
            <>
              <hr />

              <div className="alert alert-info small">
                Esta información está pensada para la red interna de colegas.
                No debe mostrarse en la ficha pública del inmueble.
              </div>

              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Alcance de colaboración</label>

                  <select
                    className="form-select"
                    value={sharingValues.mode || "all_colleagues"}
                    onChange={(e) => updateSharingField("mode", e.target.value)}
                  >
                    <option value="all_colleagues">
                      Todos los colegas habilitados
                    </option>
                    <option value="selected_agencies" disabled>
                      Inmobiliarias seleccionadas próximamente
                    </option>
                  </select>

                  <div className="form-text">
                    En esta primera versión se comparte con colegas habilitados
                    de la red.
                  </div>
                </div>

                <div className="col-md-4">
                  <label className="form-label">
                    Comisión / colaboración ofrecida
                  </label>

                  <input
                    className="form-control"
                    value={networkDataValues.commissionShare || ""}
                    placeholder="Ej: 50% de honorarios / 1% / a convenir"
                    onChange={(e) =>
                      updateNetworkDataField(
                        "commissionShare",
                        e.target.value,
                      )
                    }
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">
                    Precio interno / margen negociable
                  </label>

                  <input
                    className="form-control"
                    value={networkDataValues.internalPrice || ""}
                    placeholder="Ej: escucha ofertas / margen 5%"
                    onChange={(e) =>
                      updateNetworkDataField("internalPrice", e.target.value)
                    }
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">
                    Estado de documentación
                  </label>

                  <select
                    className="form-select"
                    value={networkDataValues.documentationStatus || ""}
                    onChange={(e) =>
                      updateNetworkDataField(
                        "documentationStatus",
                        e.target.value,
                      )
                    }
                  >
                    <option value="">Sin especificar</option>
                    <option value="completa">Completa</option>
                    <option value="en_revision">En revisión</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="no_disponible">No disponible</option>
                  </select>
                </div>

                <div className="col-md-8">
                  <label className="form-label">
                    Dirección exacta para colegas
                  </label>

                  <input
                    className="form-control"
                    value={networkDataValues.exactAddress || ""}
                    placeholder="Calle, número, piso, unidad, referencias internas"
                    onChange={(e) =>
                      updateNetworkDataField("exactAddress", e.target.value)
                    }
                    disabled={!sharingValues.showExactAddressToColleagues}
                  />

                  {!sharingValues.showExactAddressToColleagues && (
                    <div className="form-text">
                      Activá “Mostrar dirección exacta a colegas” para usar este
                      campo.
                    </div>
                  )}
                </div>

                <div className="col-md-4">
                  <div className="form-check mt-md-4">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="showExactAddressToColleagues"
                      checked={Boolean(
                        sharingValues.showExactAddressToColleagues,
                      )}
                      onChange={(e) =>
                        updateSharingField(
                          "showExactAddressToColleagues",
                          e.target.checked,
                        )
                      }
                    />

                    <label
                      className="form-check-label"
                      htmlFor="showExactAddressToColleagues"
                    >
                      Mostrar dirección exacta a colegas
                    </label>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="form-check mt-md-4">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="allowColleagueContact"
                      checked={Boolean(sharingValues.allowColleagueContact)}
                      onChange={(e) =>
                        updateSharingField(
                          "allowColleagueContact",
                          e.target.checked,
                        )
                      }
                    />

                    <label
                      className="form-check-label"
                      htmlFor="allowColleagueContact"
                    >
                      Permitir contacto de colegas
                    </label>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="form-check mt-md-4">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="showOwnerDataToColleagues"
                      checked={Boolean(sharingValues.showOwnerDataToColleagues)}
                      onChange={(e) =>
                        updateSharingField(
                          "showOwnerDataToColleagues",
                          e.target.checked,
                        )
                      }
                    />

                    <label
                      className="form-check-label"
                      htmlFor="showOwnerDataToColleagues"
                    >
                      Mostrar datos del propietario
                    </label>
                  </div>
                </div>

                {sharingValues.showOwnerDataToColleagues && (
                  <>
                    <div className="col-md-6">
                      <label className="form-label">
                        Nombre del propietario
                      </label>

                      <input
                        className="form-control"
                        value={networkDataValues.ownerName || ""}
                        placeholder="Uso interno / colegas autorizados"
                        onChange={(e) =>
                          updateNetworkDataField("ownerName", e.target.value)
                        }
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">
                        Teléfono del propietario
                      </label>

                      <input
                        className="form-control"
                        value={networkDataValues.ownerPhone || ""}
                        placeholder="Uso interno / colegas autorizados"
                        onChange={(e) =>
                          updateNetworkDataField("ownerPhone", e.target.value)
                        }
                      />
                    </div>
                  </>
                )}

                <div className="col-12">
                  <label className="form-label">Instrucciones para visitas</label>

                  <textarea
                    className="form-control"
                    rows={3}
                    value={networkDataValues.visitInstructions || ""}
                    placeholder="Ej: coordinar con 24 hs, llaves en oficina, solo visitas por la tarde..."
                    onChange={(e) =>
                      updateNetworkDataField(
                        "visitInstructions",
                        e.target.value,
                      )
                    }
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">
                    Observaciones para colegas
                  </label>

                  <textarea
                    className="form-control"
                    rows={4}
                    value={networkDataValues.notesForColleagues || ""}
                    placeholder="Información comercial no visible al público: situación del propietario, urgencia, condiciones de negociación, restricciones, etc."
                    onChange={(e) =>
                      updateNetworkDataField(
                        "notesForColleagues",
                        e.target.value,
                      )
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* =========================
          Acciones
         ========================= */}
      <div className="d-flex justify-content-end">
        <button
          type="submit"
          className="btn btn-primary px-4"
          disabled={loading || imagesLoading}
        >
          {loading
            ? "Guardando..."
            : isEditMode
              ? "Actualizar inmueble"
              : "Crear inmueble"}
        </button>
      </div>
    </form>
  );
};

export default InmuebleForm;