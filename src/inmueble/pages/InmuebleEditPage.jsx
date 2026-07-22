import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import InmuebleForm from "../components/InmuebleForm";
import { getInmuebleById, updateInmueble } from "../services/inmueble.service";

import { useAuth } from "../../context/auth/useAuth";
import { canEditInmueble } from "../helpers/permissions";

import { updateConvertedPublicationVisibility } from "../../particular/services/particularPublication.service";

import {
  DEFAULT_AMENITIES,
  DEFAULT_CARACTERISTICAS,
  DEFAULT_MEDIDAS,
  DEFAULT_SERVICIOS,
  DEFAULT_SUPERFICIE,
} from "../utils/inmuebleDetailsSchema";

/* =========================
   Valores iniciales
   ========================= */

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

const EMPTY_VALUES = {
  titulo: "",
  descripcion: "",
  tipo: "",
  operacion: "",
  precio: "",
  moneda: "USD",
  expensas: "",

  direccion: {
    calle: "",
    numero: "",
    barrio: "",
    ciudad: "",
  },

  superficie: {
    ...DEFAULT_SUPERFICIE,
  },

  caracteristicas: {
    ...DEFAULT_CARACTERISTICAS,
  },

  amenities: {
    ...DEFAULT_AMENITIES,
  },

  servicios: {
    ...DEFAULT_SERVICIOS,
  },

  medidas: {
    ...DEFAULT_MEDIDAS,
  },

  ambientes: "",
  dormitorios: "",
  banos: "",
  cocheras: "",

  estado: "activo",
  destacado: false,
  publicarEnPortal: false,
  noIndex: false,
  images: [],

  inmobiliariaId: "",
  ownerInmobiliariaId: "",
  ownerId: "",

  sharedWith: {},
  deleted: false,

  sharing: DEFAULT_SHARING,
  networkData: DEFAULT_NETWORK_DATA,
};

/* =========================
   Helpers
   ========================= */

const normalizeSharing = (value = {}) => {
  return {
    ...DEFAULT_SHARING,
    ...value,
    enabled: Boolean(value.enabled),
    mode: value.mode || "all_colleagues",
    allowColleagueContact:
      value.allowColleagueContact === undefined
        ? true
        : Boolean(value.allowColleagueContact),
    showExactAddressToColleagues: Boolean(
      value.showExactAddressToColleagues,
    ),
    showOwnerDataToColleagues: Boolean(value.showOwnerDataToColleagues),
  };
};

const normalizeNetworkData = ({ sharing, networkData }) => {
  const data = {
    ...DEFAULT_NETWORK_DATA,
    ...(networkData || {}),
  };

  return {
    ...data,

    exactAddress: sharing.showExactAddressToColleagues
      ? data.exactAddress || ""
      : "",

    ownerName: sharing.showOwnerDataToColleagues ? data.ownerName || "" : "",

    ownerPhone: sharing.showOwnerDataToColleagues ? data.ownerPhone || "" : "",
  };
};

const removeProtectedFieldsFromPublicData = (formValues = {}) => {
  const publicData = { ...formValues };

  delete publicData.networkData;

  return publicData;
};

const getInmuebleOriginInfo = ({ inmueble, fromParticularRequest, queryId }) => {
  const sourceRequestId =
    queryId || inmueble?.particularPublicationRequestId || "";

  const isFromParticularRequest =
    fromParticularRequest ||
    inmueble?.sourceType === "particular_publication_request" ||
    Boolean(sourceRequestId);

  return {
    isFromParticularRequest,
    sourceRequestId,
  };
};

const getInmueblePublicPath = (inmuebleData = {}) => {
  if (!inmuebleData?.slug) return "";

  return `/inmueble/${inmuebleData.slug}`;
};

const shouldShowConvertedPublicationToParticular = (inmuebleData = {}) => {
  return (
    inmuebleData.estado === "activo" &&
    Boolean(inmuebleData.publicarEnPortal) &&
    inmuebleData.deleted !== true
  );
};

const InmuebleEditPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { user, activeInmobiliariaId } = useAuth();

  const queryInmobiliariaId = searchParams.get("inmobiliariaId") || "";
  const fromParticularRequest =
    searchParams.get("fromParticularRequest") === "1";
  const queryParticularRequestId =
    searchParams.get("particularRequestId") || "";

  const resolvedInmobiliariaIdForLoad =
    queryInmobiliariaId || activeInmobiliariaId || "";

  const [inmueble, setInmueble] = useState(null);
  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState({});

  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const originInfo = useMemo(() => {
    return getInmuebleOriginInfo({
      inmueble,
      fromParticularRequest,
      queryId: queryParticularRequestId,
    });
  }, [fromParticularRequest, inmueble, queryParticularRequestId]);

  const currentInmobiliariaId =
    inmueble?.inmobiliariaId ||
    inmueble?.ownerInmobiliariaId ||
    values?.inmobiliariaId ||
    resolvedInmobiliariaIdForLoad;

  const previewUrl = currentInmobiliariaId
    ? `/admin/inmuebles/${id}/preview?inmobiliariaId=${encodeURIComponent(
      currentInmobiliariaId,
    )}`
    : `/admin/inmuebles/${id}/preview`;

  /* =========================
     Cargar inmueble
     ========================= */

  useEffect(() => {
    let mounted = true;

    const fetchInmueble = async () => {
      try {
        setInitialLoading(true);
        setError(null);

        if (!id) {
          throw new Error("ID de inmueble no recibido");
        }

        if (!user?.uid) {
          throw new Error("No se pudo determinar el usuario");
        }

        if (!resolvedInmobiliariaIdForLoad) {
          throw new Error("No hay inmobiliaria seleccionada para cargar el inmueble");
        }

        const data = await getInmuebleById(resolvedInmobiliariaIdForLoad, id);

        if (!mounted) return;

        if (!data) {
          throw new Error("El inmueble no existe");
        }

        if (!canEditInmueble(user, data)) {
          throw new Error("No tenés permisos para editar este inmueble");
        }

        const resolvedInmobiliariaId =
          data.inmobiliariaId ||
          data.ownerInmobiliariaId ||
          resolvedInmobiliariaIdForLoad;

        const normalizedSharing = normalizeSharing(data.sharing || {});
        const normalizedNetworkData = normalizeNetworkData({
          sharing: normalizedSharing,
          networkData: data.networkData || {},
        });

        const formattedValues = {
          ...EMPTY_VALUES,
          ...data,

          direccion: {
            ...EMPTY_VALUES.direccion,
            ...(data.direccion || {}),
          },

          superficie: {
            ...DEFAULT_SUPERFICIE,
            ...(data.superficie || {}),
          },

          caracteristicas: {
            ...DEFAULT_CARACTERISTICAS,
            ...(data.caracteristicas || {}),
            ambientes:
              data.caracteristicas?.ambientes ||
              data.ambientes ||
              "",
            dormitorios:
              data.caracteristicas?.dormitorios ||
              data.dormitorios ||
              "",
            banos:
              data.caracteristicas?.banos ||
              data.banos ||
              data.banios ||
              "",
            cocheras: Boolean(
              data.caracteristicas?.cocheras ||
              data.caracteristicas?.cocherasCantidad ||
              data.cocheras,
            ),
            cocherasCantidad:
              data.caracteristicas?.cocherasCantidad ||
              data.cocheras ||
              "",
          },

          amenities: {
            ...DEFAULT_AMENITIES,
            ...(data.amenities || {}),
          },

          servicios: {
            ...DEFAULT_SERVICIOS,
            ...(data.servicios || {}),
          },

          medidas: {
            ...DEFAULT_MEDIDAS,
            ...(data.medidas || {}),
          },

          images: Array.isArray(data.images) ? data.images : [],

          inmobiliariaId: resolvedInmobiliariaId,
          ownerInmobiliariaId:
            data.ownerInmobiliariaId || resolvedInmobiliariaId,

          ownerId: data.ownerId || "",

          sharedWith:
            data.sharedWith && typeof data.sharedWith === "object"
              ? data.sharedWith
              : {},

          deleted: data.deleted ?? false,

          estado: data.estado || "activo",
          destacado: Boolean(data.destacado),
          publicarEnPortal: Boolean(data.publicarEnPortal),
          noIndex: Boolean(data.noIndex),

          sharing: normalizedSharing,
          networkData: normalizedNetworkData,
        };

        setInmueble({
          ...data,
          inmobiliariaId: resolvedInmobiliariaId,
          ownerInmobiliariaId:
            data.ownerInmobiliariaId || resolvedInmobiliariaId,
          destacado: Boolean(data.destacado),
          publicarEnPortal: Boolean(data.publicarEnPortal),
          noIndex: Boolean(data.noIndex),
          sharing: normalizedSharing,
        });

        setValues(formattedValues);
      } catch (err) {
        console.error("Error cargando inmueble:", err);

        if (mounted) {
          if (err.code === "permission-denied") {
            setError("Acceso denegado");
          } else {
            setError(err.message || "Error al cargar el inmueble");
          }
        }
      } finally {
        if (mounted) {
          setInitialLoading(false);
        }
      }
    };

    fetchInmueble();

    return () => {
      mounted = false;
    };
  }, [id, resolvedInmobiliariaIdForLoad, user]);

  /* =========================
     Handlers de formulario
     ========================= */

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (!name) return;

    if (name === "inmobiliariaId") return;

    setValues((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors[name];
        return nextErrors;
      });
    }
  };

  const handleNestedChange = (group, field, value) => {
    if (!group) return;

    if (!field) {
      setValues((prev) => ({
        ...prev,
        [group]: value,
      }));
      return;
    }

    setValues((prev) => ({
      ...prev,
      [group]: {
        ...(prev[group] || {}),
        [field]: value,
      },
    }));

    const errorKey = field ? `${group}.${field}` : group;

    if (errors[errorKey]) {
      setErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors[errorKey];
        return nextErrors;
      });
    }
  };

  /* =========================
     Validación mínima
     ========================= */

  const validate = (formValues) => {
    const nextErrors = {};

    if (!formValues.titulo?.trim()) {
      nextErrors.titulo = "El título es obligatorio";
    }

    if (!formValues.tipo?.trim()) {
      nextErrors.tipo = "El tipo es obligatorio";
    }

    if (!formValues.operacion?.trim()) {
      nextErrors.operacion = "La operación es obligatoria";
    }

    if (!formValues.direccion?.ciudad?.trim()) {
      nextErrors.ciudad = "La ciudad es obligatoria";
    }

    if (formValues.operacion !== "tasacion" && !formValues.precio) {
      nextErrors.precio = "El precio es obligatorio";
    }

    if (!formValues.estado?.trim()) {
      nextErrors.estado = "El estado es obligatorio";
    }

    return nextErrors;
  };

  /* =========================
     Guardar cambios
     ========================= */

  const handleUpdate = async (formValues) => {
    try {
      setSaving(true);
      setError(null);

      if (!id) {
        throw new Error("ID de inmueble no recibido");
      }

      if (!user?.uid) {
        throw new Error("No se pudo determinar el usuario");
      }

      if (!inmueble) {
        throw new Error("No hay inmueble cargado");
      }

      const targetInmobiliariaId =
        inmueble.inmobiliariaId ||
        inmueble.ownerInmobiliariaId ||
        resolvedInmobiliariaIdForLoad;

      if (!targetInmobiliariaId) {
        throw new Error("No se pudo determinar la inmobiliaria del inmueble");
      }

      if (!canEditInmueble(user, inmueble)) {
        throw new Error("No tenés permisos para editar este inmueble");
      }

      const validationErrors = validate(formValues);
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        return;
      }

      const normalizedSharing = normalizeSharing(formValues?.sharing);
      const normalizedNetworkData = normalizeNetworkData({
        sharing: normalizedSharing,
        networkData: formValues?.networkData,
      });

      const publicFormValues = removeProtectedFieldsFromPublicData(formValues);

      const updatedInmueble = {
        ...publicFormValues,

        ownerId: inmueble.ownerId,
        createdBy: inmueble.createdBy || formValues.createdBy || null,

        inmobiliariaId: targetInmobiliariaId,
        ownerInmobiliariaId:
          inmueble.ownerInmobiliariaId || targetInmobiliariaId,

        images: Array.isArray(formValues.images) ? formValues.images : [],

        sharedWith:
          inmueble.sharedWith && typeof inmueble.sharedWith === "object"
            ? inmueble.sharedWith
            : {},

        deleted: inmueble.deleted ?? false,

        estado: formValues.estado || "activo",
        destacado: Boolean(formValues?.destacado),
        publicarEnPortal: Boolean(formValues?.publicarEnPortal),
        noIndex: Boolean(formValues?.noIndex),

        sharing: normalizedSharing,
      };

      await updateInmueble(targetInmobiliariaId, id, updatedInmueble, {
        networkData: normalizedSharing.enabled ? normalizedNetworkData : null,
      });

      const sourceRequestId =
        formValues.particularPublicationRequestId ||
        inmueble.particularPublicationRequestId ||
        "";

      if (sourceRequestId) {
        const publicPath = getInmueblePublicPath({
          ...inmueble,
          ...updatedInmueble,
        });

        await updateConvertedPublicationVisibility(sourceRequestId, {
          inmuebleId: id,
          inmobiliariaId: targetInmobiliariaId,
          titulo: updatedInmueble.titulo,
          publicPath,
          visible: shouldShowConvertedPublicationToParticular(updatedInmueble),
        });
      }

      console.log("✅ Inmueble actualizado:", id);

      navigate("/admin/inmuebles/listado");
    } catch (err) {
      console.error("Error actualizando inmueble:", err);

      if (err.code === "permission-denied") {
        setError("No tenés permisos para realizar esta acción");
      } else {
        setError(err.message || "Ocurrió un error al guardar los cambios");
      }
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     Estados visuales
     ========================= */

  if (initialLoading) {
    return <p className="text-muted">Cargando inmueble...</p>;
  }

  if (error) {
    return (
      <section className="container py-4">
        <div className="alert alert-danger">{error}</div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate("/admin/inmuebles/listado")}
        >
          Volver al listado
        </button>
      </section>
    );
  }

  if (!inmueble) {
    return null;
  }

  /* =========================
     Render
     ========================= */

  return (
    <section className="container py-4">
      <header className="mb-4 d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
        <div>
          <h1 className="h3 mb-1">Editar inmueble</h1>
          <p className="text-muted mb-0">
            Modificá la información básica del inmueble
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <Link to={previewUrl} className="btn btn-outline-primary">
            Vista previa
          </Link>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate("/admin/inmuebles/listado")}
          >
            Volver
          </button>
        </div>
      </header>

      {originInfo.isFromParticularRequest && (
        <div className="alert alert-success border">
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
            <div>
              <strong>Inmueble creado desde una solicitud particular.</strong>

              <div className="small mt-1">
                Revisá los datos precargados, las fotos copiadas, la ubicación,
                el precio y la configuración de publicación antes de activarlo
                en el portal.
              </div>

              <div className="small mt-1">
                Solicitud original:{" "}
                <strong>{originInfo.sourceRequestId || "sin ID visible"}</strong>
                {" · "}
                Fotos actuales en el inmueble:{" "}
                <strong>{values.images?.length || 0}</strong>
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2 align-self-lg-center">
              <Link
                to="/admin/inmobiliaria/solicitudes-particulares"
                className="btn btn-sm btn-outline-success"
              >
                Ver solicitudes
              </Link>

              <Link to={previewUrl} className="btn btn-sm btn-success">
                Ver vista previa
              </Link>
            </div>
          </div>
        </div>
      )}

      {!values.publicarEnPortal && (
        <div className="alert alert-warning small">
          Esta publicación todavía no está visible en el portal público. Para
          publicarla, activá <strong>Publicar en portal</strong> y guardá los
          cambios.
        </div>
      )}

      <InmuebleForm
        key={inmueble.id || id}
        values={values}
        errors={errors}
        loading={saving}
        initialLoading={false}
        isEditMode={true}
        handleChange={handleChange}
        handleNestedChange={handleNestedChange}
        handleSubmit={handleUpdate}
        inmuebleId={id}
        inmobiliariaId={values.inmobiliariaId}
      />
    </section>
  );
};

export default InmuebleEditPage;