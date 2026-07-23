import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import InmuebleForm from "../components/InmuebleForm";
import { useAuth } from "../../context/auth/useAuth";
import {
  createInmueble,
  updateInmuebleImages,
} from "../services/inmueble.service";
import { copyPublicationRequestImagesToInmueble } from "../helpers/uploadInmuebleImages";
import { canCreateInmueble } from "../helpers/permissions";
import {
  getParticularPublicationRequestById,
  markParticularPublicationRequestAsConverted,
  releaseParticularPublicationRequestConversion,
  reserveParticularPublicationRequestConversion,
} from "../../particular/services/particularPublication.service";
import { approvePublicationRequestAsParticular } from "../../particular/services/particularPublicationListing.service";
import PublicationRequestImages from "../../particular/components/PublicationRequestImages";
import InmuebleVideoSection from "../components/InmuebleVideoSection";
import { normalizeInmuebleVideos } from "../utils/inmuebleVideos.helpers";
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

const INITIAL_VALUES = {
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
  videos: [],

  inmobiliariaId: "",
  ownerInmobiliariaId: "",

  sharedWith: {},
  deleted: false,

  sharing: DEFAULT_SHARING,
  networkData: DEFAULT_NETWORK_DATA,
};

const OPERACION_LABELS = {
  venta: "venta",
  alquiler: "alquiler",
  alquiler_temporal: "alquiler temporal",
  tasacion: "tasación",
};

const TIPO_LABELS = {
  casa: "Casa",
  departamento: "Departamento",
  terreno: "Terreno",
  local: "Local",
  oficina: "Oficina",
  cochera: "Cochera",
  campo: "Campo",
  otro: "Inmueble",
};

/* =========================
   Helpers solicitud particular
   ========================= */

const normalizeText = (value = "") => value.toString().trim();

const inferCurrencyFromPrice = (value = "") => {
  const text = value.toString().toUpperCase();

  if (text.includes("USD") || text.includes("U$S") || text.includes("US$")) {
    return "USD";
  }

  if (text.includes("ARS") || text.includes("$")) {
    return "ARS";
  }

  return "USD";
};

const buildTitleFromRequest = (request) => {
  const tipo = TIPO_LABELS[request?.tipo] || "Inmueble";
  const operacion = OPERACION_LABELS[request?.operacion] || "publicación";
  const ubicacion = normalizeText(request?.ubicacion);

  if (ubicacion) {
    return `${tipo} en ${operacion} - ${ubicacion}`;
  }

  return `${tipo} en ${operacion}`;
};

const buildPrefillFromParticularRequest = ({
  request,
  activeInmobiliariaId,
}) => {
  const targetInmobiliariaId =
    request?.targetType === "inmobiliaria"
      ? request.targetInmobiliariaId
      : "";

  const selectedInmobiliariaId =
    targetInmobiliariaId || activeInmobiliariaId || "";

  return {
    ...INITIAL_VALUES,

    titulo: buildTitleFromRequest(request),
    descripcion: request?.descripcion || "",
    tipo: request?.tipo || "",
    operacion: request?.operacion || "",
    precio: request?.precioEstimado || "",
    moneda: inferCurrencyFromPrice(request?.precioEstimado),

    direccion: {
      ...INITIAL_VALUES.direccion,
      barrio: request?.ubicacion || "",
    },

    superficie: {
      ...DEFAULT_SUPERFICIE,
      ...(request?.superficie || {}),
    },

    caracteristicas: {
      ...DEFAULT_CARACTERISTICAS,
      ambientes: request?.ambientes || "",
      dormitorios: request?.dormitorios || "",
      banos: request?.banos || request?.banios || "",
      cocheras: Boolean(request?.cocheras),
      cocherasCantidad: request?.cocheras || "",
    },

    amenities: {
      ...DEFAULT_AMENITIES,
      ...(request?.amenities || {}),
    },

    servicios: {
      ...DEFAULT_SERVICIOS,
      ...(request?.servicios || {}),
    },

    medidas: {
      ...DEFAULT_MEDIDAS,
      ...(request?.medidas || {}),
    },

    estado: "activo",
    publicarEnPortal: false,
    noIndex: true,
    videos: normalizeInmuebleVideos(request?.videos || []),

    inmobiliariaId: selectedInmobiliariaId,
    ownerInmobiliariaId: selectedInmobiliariaId,

    sourceType: "particular_publication_request",
    particularPublicationRequestId: request?.id || "",
    sourceRequestTargetType: request?.targetType || "",
    sourceRequestValidationOwner: request?.validationOwner || "",
  };
};

const buildNetworkDataFromParticularRequest = ({
  request,
  baseNetworkData,
}) => {
  if (!request) return baseNetworkData;

  const notes = [
    baseNetworkData?.notesForColleagues,
    "Origen: solicitud particular desde ONO Prop.",
    request.id ? `Solicitud ID: ${request.id}` : "",
    request.email ? `Email del propietario: ${request.email}` : "",
    request.telefono ? `Teléfono/WhatsApp: ${request.telefono}` : "",
    request.targetInmobiliariaNombre
      ? `Destino elegido: ${request.targetInmobiliariaNombre}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    ...DEFAULT_NETWORK_DATA,
    ...(baseNetworkData || {}),
    ownerName: request.nombre || baseNetworkData?.ownerName || "",
    ownerPhone: request.telefono || baseNetworkData?.ownerPhone || "",
    notesForColleagues: notes,
  };
};

const getCreatedInmuebleId = (result) => {
  if (!result) return "";

  if (typeof result === "string") return result;

  return result.id || result.inmuebleId || result.docId || "";
};

const getCreatedInmuebleSlug = (result) => {
  if (!result || typeof result === "string") return "";

  return result.slug || "";
};

const buildConvertedPaths = ({
  inmuebleId,
  inmobiliariaId,
  slug,
  requestId,
}) => {
  if (!inmuebleId || !inmobiliariaId) {
    return {
      editPath: "",
      previewPath: "",
      publicPath: slug ? `/inmueble/${slug}` : "",
    };
  }

  const editParams = new URLSearchParams();
  editParams.set("inmobiliariaId", inmobiliariaId);

  if (requestId) {
    editParams.set("fromParticularRequest", "1");
    editParams.set("particularRequestId", requestId);
  }

  const previewParams = new URLSearchParams();
  previewParams.set("inmobiliariaId", inmobiliariaId);

  return {
    editPath: `/admin/inmuebles/${inmuebleId}/editar?${editParams.toString()}`,
    previewPath: `/admin/inmuebles/${inmuebleId}/preview?${previewParams.toString()}`,
    publicPath: slug ? `/inmueble/${slug}` : "",
  };
};

const getConvertedEditPathFromRequest = (request) => {
  if (!request?.convertedInmuebleId) return "";

  if (request.convertedEditPath) {
    return request.convertedEditPath;
  }

  if (!request.convertedInmobiliariaId) return "";

  const params = new URLSearchParams();

  params.set("inmobiliariaId", request.convertedInmobiliariaId);
  params.set("fromParticularRequest", "1");
  params.set("particularRequestId", request.id);

  return `/admin/inmuebles/${request.convertedInmuebleId}/editar?${params.toString()}`;
};

const getConvertedPreviewPathFromRequest = (request) => {
  if (!request?.convertedInmuebleId) return "";

  if (request.convertedPreviewPath) {
    return request.convertedPreviewPath;
  }

  if (!request.convertedInmobiliariaId) return "";

  const params = new URLSearchParams();

  params.set("inmobiliariaId", request.convertedInmobiliariaId);

  return `/admin/inmuebles/${request.convertedInmuebleId}/preview?${params.toString()}`;
};

const getConvertedPublicPathFromRequest = (request) => {
  if (
    request?.convertedPublicVisible === true &&
    request?.convertedPublicPath
  ) {
    return request.convertedPublicPath;
  }

  return "";
};

/* =========================
   Normalización Red de colegas
   ========================= */

const normalizeSharing = (value = {}) => {
  return {
    ...DEFAULT_SHARING,
    ...value,
    enabled: Boolean(value.enabled),
    mode: value.mode || "all_colleagues",
    allowColleagueContact: Boolean(value.allowColleagueContact),
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

/* =========================
   Permisos / aprobación particular
   ========================= */

const userIsRoot = (user) => {
  return Boolean(
    user?.role === "root" ||
    user?.primaryRole === "root" ||
    (Array.isArray(user?.roles) && user.roles.includes("root")),
  );
};

const getParticularPublicationPathFromRequest = (request) => {
  if (request?.particularPublicationPath) {
    return request.particularPublicationPath;
  }

  if (request?.particularPublicationId) {
    return `/particulares/${request.particularPublicationId}`;
  }

  return "";
};

const canApproveSourceRequestAsParticular = ({ request, user }) => {
  if (!userIsRoot(user)) return false;
  if (!request?.id) return false;
  if (request.targetType !== "onoprop") return false;
  if (request.particularPublicationId) return false;
  if (request.convertedInmuebleId) return false;
  if (request.conversionLockStatus === "processing") return false;
  if (request.estado === "descartado") return false;

  return true;
};

const InmuebleCreatePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { user, activeInmobiliariaId } = useAuth();

  const particularRequestId =
    searchParams.get("particularRequestId") ||
    searchParams.get("requestId") ||
    "";

  const queryInmobiliariaId = searchParams.get("inmobiliariaId") || "";

  const [values, setValues] = useState(INITIAL_VALUES);
  const [sourceRequest, setSourceRequest] = useState(null);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [approvingParticular, setApprovingParticular] = useState(false);
  const [error, setError] = useState(null);

  const sourceRequestAlreadyConverted = Boolean(
    sourceRequest?.convertedInmuebleId,
  );

  const sourceRequestAlreadyApprovedAsParticular = Boolean(
    sourceRequest?.particularPublicationId,
  );

  const sourceRequestConversionInProgress =
    sourceRequest?.conversionLockStatus === "processing" &&
    !sourceRequest?.convertedInmuebleId;

  const sourceRequestConversionBlocked =
    sourceRequestAlreadyConverted ||
    sourceRequestAlreadyApprovedAsParticular ||
    sourceRequestConversionInProgress;

  const sourceRequestEditPath = getConvertedEditPathFromRequest(sourceRequest);
  const sourceRequestPreviewPath =
    getConvertedPreviewPathFromRequest(sourceRequest);
  const sourceRequestPublicPath = getConvertedPublicPathFromRequest(sourceRequest);

  const sourceRequestParticularPath =
    getParticularPublicationPathFromRequest(sourceRequest);

  const canApproveSourceAsParticular = canApproveSourceRequestAsParticular({
    request: sourceRequest,
    user,
  });

  const sourceRequestIsOnoProp = sourceRequest?.targetType === "onoprop";
  const sourceRequestVideoCount = normalizeInmuebleVideos(
    sourceRequest?.videos || [],
  ).length;

  /* =========================
     Precargar solicitud particular
     ========================= */

  useEffect(() => {
    if (!particularRequestId) return;

    let isMounted = true;

    const fetchParticularRequest = async () => {
      try {
        setLoadingRequest(true);
        setError(null);

        const request =
          await getParticularPublicationRequestById(particularRequestId);

        if (!isMounted) return;

        setSourceRequest(request);

        setValues(
          buildPrefillFromParticularRequest({
            request,
            activeInmobiliariaId: queryInmobiliariaId || activeInmobiliariaId,
          }),
        );
      } catch (err) {
        console.error("Error cargando solicitud particular:", err);

        if (isMounted) {
          setError(
            err.message ||
            "No se pudo cargar la solicitud particular para precargar el inmueble.",
          );
        }
      } finally {
        if (isMounted) {
          setLoadingRequest(false);
        }
      }
    };

    fetchParticularRequest();

    return () => {
      isMounted = false;
    };
  }, [activeInmobiliariaId, particularRequestId, queryInmobiliariaId]);

  /* =========================
     Asegurar inmobiliaria activa
     ========================= */

  useEffect(() => {
    if (!activeInmobiliariaId) return;

    setValues((prev) => {
      if (prev.inmobiliariaId) return prev;

      return {
        ...prev,
        inmobiliariaId: activeInmobiliariaId,
        ownerInmobiliariaId: activeInmobiliariaId,
      };
    });
  }, [activeInmobiliariaId]);

  /* =========================
     Handlers
     ========================= */

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (!name) return;

    setValues((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    setError(null);
  };

  const handleNestedChange = (group, field, value) => {
    if (!group) return;

    if (!field) {
      setValues((prev) => ({
        ...prev,
        [group]: value,
      }));
      setError(null);
      return;
    }

    setValues((prev) => ({
      ...prev,
      [group]: {
        ...(prev[group] || {}),
        [field]: value,
      },
    }));

    setError(null);
  };

  /* =========================
     Aprobar como particular
     ========================= */

  const handleApproveSourceAsParticular = async () => {
    if (!sourceRequest?.id) return;

    const confirmed = window.confirm(
      "¿Confirmás aprobar esta solicitud como publicación particular de ONO Prop?",
    );

    if (!confirmed) return;

    try {
      setApprovingParticular(true);
      setError(null);

      const result = await approvePublicationRequestAsParticular(sourceRequest.id, {
        internalNote: `Solicitud aprobada como publicación particular desde la vista de carga de inmueble: ${buildTitleFromRequest(
          sourceRequest,
        )}.`,
      });

      navigate(result?.path || `/particulares/${result?.id}`);
    } catch (err) {
      console.error("Error aprobando publicación particular:", err);
      setError(
        err.message ||
        "No se pudo aprobar la solicitud como publicación particular.",
      );
    } finally {
      setApprovingParticular(false);
    }
  };

  /* =========================
     Crear inmueble
     ========================= */

  const handleCreate = async (formValues) => {
    let conversionReserved = false;
    let createdInmuebleId = "";

    try {
      setLoading(true);
      setError(null);

      if (sourceRequestAlreadyApprovedAsParticular) {
        throw new Error(
          "Esta solicitud ya fue aprobada como publicación particular. No se puede convertir también en inmueble.",
        );
      }

      if (sourceRequestAlreadyConverted) {
        throw new Error(
          "Esta solicitud particular ya fue convertida en inmueble. No se puede crear una publicación duplicada.",
        );
      }

      if (sourceRequest?.id) {
        await reserveParticularPublicationRequestConversion(sourceRequest.id);
        conversionReserved = true;
      }

      if (sourceRequestAlreadyConverted) {
        throw new Error(
          "Esta solicitud particular ya fue convertida en inmueble. No se puede crear una publicación duplicada.",
        );
      }

      const selectedInmobiliariaId =
        formValues?.inmobiliariaId ||
        queryInmobiliariaId ||
        sourceRequest?.targetInmobiliariaId ||
        activeInmobiliariaId;

      if (!user?.uid || !selectedInmobiliariaId) {
        throw new Error(
          "No se pudo determinar el usuario o la inmobiliaria activa",
        );
      }

      if (!canCreateInmueble(user, selectedInmobiliariaId)) {
        throw new Error("No tenés permisos para crear inmuebles");
      }

      const normalizedSharing = normalizeSharing(formValues?.sharing);
      const normalizedNetworkData = normalizeNetworkData({
        sharing: normalizedSharing,
        networkData: formValues?.networkData,
      });

      const privateNetworkDataFromRequest =
        buildNetworkDataFromParticularRequest({
          request: sourceRequest,
          baseNetworkData: normalizedNetworkData,
        });

      const privateNetworkData = sourceRequest
        ? privateNetworkDataFromRequest
        : normalizedSharing.enabled
          ? normalizedNetworkData
          : null;

      const { networkData: _networkData, ...publicFormValues } =
        formValues || {};

      const inmuebleData = {
        ...publicFormValues,

        ownerId: user.uid,
        createdBy: user.uid,

        inmobiliariaId: selectedInmobiliariaId,
        ownerInmobiliariaId: selectedInmobiliariaId,

        images: [],
        videos: normalizeInmuebleVideos(
          formValues?.videos || sourceRequest?.videos || [],
        ),

        sharedWith:
          formValues?.sharedWith && typeof formValues.sharedWith === "object"
            ? formValues.sharedWith
            : {},

        deleted: false,

        estado: formValues?.estado || "activo",
        destacado: Boolean(formValues?.destacado),
        publicarEnPortal: Boolean(formValues?.publicarEnPortal),
        noIndex:
          sourceRequest && formValues?.noIndex !== false
            ? true
            : Boolean(formValues?.noIndex),

        sharing: normalizedSharing,

        sourceType: sourceRequest
          ? "particular_publication_request"
          : publicFormValues.sourceType || "",
        particularPublicationRequestId: sourceRequest?.id || "",
      };

      const result = await createInmueble(
        selectedInmobiliariaId,
        inmuebleData,
        {
          networkData: privateNetworkData,
        },
      );

      const inmuebleId = getCreatedInmuebleId(result);
      createdInmuebleId = inmuebleId;

      const inmuebleSlug = getCreatedInmuebleSlug(result);

      const convertedPaths = buildConvertedPaths({
        inmuebleId,
        inmobiliariaId: selectedInmobiliariaId,
        slug: inmuebleSlug,
        requestId: sourceRequest?.id || "",
      });

      let copiedImages = [];
      let imageCopyError = "";

      if (sourceRequest?.images?.length > 0 && inmuebleId) {
        try {
          copiedImages = await copyPublicationRequestImagesToInmueble({
            images: sourceRequest.images,
            inmuebleId,
            inmobiliariaId: selectedInmobiliariaId,
            startOrder: 0,
          });

          if (copiedImages.length > 0) {
            await updateInmuebleImages(
              selectedInmobiliariaId,
              inmuebleId,
              copiedImages,
            );
          }
        } catch (imageError) {
          console.error(
            "Error copiando fotos de solicitud particular:",
            imageError,
          );

          imageCopyError =
            imageError.message ||
            "No se pudieron copiar automáticamente las fotos de la solicitud.";
        }
      }

      if (sourceRequest?.id) {
        const copiedVideos = normalizeInmuebleVideos(
          formValues?.videos || sourceRequest?.videos || [],
        );

        const mediaSummary = [
          copiedImages.length
            ? `Se copiaron ${copiedImages.length} foto(s)`
            : "",
          copiedVideos.length
            ? `Se copiaron ${copiedVideos.length} video(s)`
            : "",
        ]
          .filter(Boolean)
          .join(" y ");

        const conversionNote = mediaSummary
          ? `Solicitud convertida en inmueble: ${inmuebleData.titulo}. ${mediaSummary}.`
          : imageCopyError
            ? `Solicitud convertida en inmueble: ${inmuebleData.titulo}. El inmueble fue creado, pero no se pudieron copiar las fotos automáticamente: ${imageCopyError}`
            : `Solicitud convertida en inmueble: ${inmuebleData.titulo}.`;

        await markParticularPublicationRequestAsConverted(sourceRequest.id, {
          inmuebleId,
          inmobiliariaId: selectedInmobiliariaId,
          titulo: inmuebleData.titulo,
          slug: inmuebleSlug,
          editPath: convertedPaths.editPath,
          previewPath: convertedPaths.previewPath,
          publicPath: convertedPaths.publicPath,
          internalNote: conversionNote,
        });
      }

      console.log("✅ Inmueble creado:", inmuebleId || result);

      if (inmuebleId) {
        navigate(
          convertedPaths.editPath ||
          `/admin/inmuebles/${inmuebleId}/editar?inmobiliariaId=${encodeURIComponent(
            selectedInmobiliariaId,
          )}`,
        );
        return;
      }

      navigate("/admin/inmuebles/listado");
    } catch (err) {
      console.error("Error creando inmueble:", err);

      if (conversionReserved && !createdInmuebleId && sourceRequest?.id) {
        try {
          await releaseParticularPublicationRequestConversion(sourceRequest.id, {
            reason:
              err.message ||
              "La conversión fue cancelada porque no se pudo crear el inmueble.",
          });
        } catch (releaseError) {
          console.error("Error liberando reserva de conversión:", releaseError);
        }
      }

      setError(err.message || "Ocurrió un error al crear el inmueble");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     Render
     ========================= */

  return (
    <section className="page-container">
      <header className="page-header">
        <h1>Nuevo inmueble</h1>

        <p>
          {sourceRequest
            ? "Revisá y completá la información precargada desde la solicitud particular."
            : "Cargá la información básica para publicar el inmueble."}
        </p>
      </header>

      {error && <div className="error-box">{error}</div>}

      {loadingRequest && (
        <div className="alert alert-light border">
          Cargando datos de la solicitud particular...
        </div>
      )}

      {sourceRequest && (
        <div className="alert alert-info">
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
            <div>
              <strong>Solicitud particular precargada.</strong>

              <div className="small mt-1">
                Solicitante: {sourceRequest.nombre || "Sin nombre"} ·{" "}
                {sourceRequest.email || "Sin email"} ·{" "}
                {sourceRequest.telefono || "Sin teléfono"}
              </div>

              <div className="small">
                Destino elegido:{" "}
                {sourceRequest.targetInmobiliariaNombre || "ONO Prop"} · Estado:{" "}
                {sourceRequest.estado || "nuevo"}
              </div>

              <div className="small">
                Fotos recibidas: {sourceRequest.images?.length || 0}. Al guardar
                el inmueble, se copiarán a la galería propia de la publicación.
              </div>

              <div className="small">
                Videos recibidos: {sourceRequestVideoCount}. Al guardar el
                inmueble, se copiarán como links embebidos.
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2 align-self-lg-center">
              {userIsRoot(user) && (
                <Link
                  to="/admin/publicaciones/particulares"
                  className="btn btn-sm btn-outline-primary"
                >
                  Ver solicitudes root
                </Link>
              )}

              <Link
                to="/admin/inmobiliaria/solicitudes-particulares"
                className="btn btn-sm btn-outline-primary"
              >
                Ver solicitudes inmobiliaria
              </Link>

              {canApproveSourceAsParticular && (
                <button
                  type="button"
                  className="btn btn-sm btn-dark"
                  disabled={approvingParticular || loading || loadingRequest}
                  onClick={handleApproveSourceAsParticular}
                >
                  {approvingParticular
                    ? "Aprobando..."
                    : "Aprobar como publicación particular ONO Prop"}
                </button>
              )}

              {sourceRequestParticularPath && (
                <Link
                  to={sourceRequestParticularPath}
                  className="btn btn-sm btn-success"
                >
                  Ver publicación particular
                </Link>
              )}

              <Link
                to="/admin/inmuebles/listado"
                className="btn btn-sm btn-outline-secondary"
              >
                Ver inmuebles
              </Link>
            </div>
          </div>

          {sourceRequestIsOnoProp &&
            !sourceRequestParticularPath &&
            !sourceRequestAlreadyConverted &&
            !sourceRequestConversionInProgress && (
              <div className="alert alert-warning small mt-3 mb-0">
                <strong>Esta solicitud fue enviada a ONO Prop.</strong>

                <div>
                  Si sos root, podés aprobarla como publicación particular de
                  ONO Prop. Si preferís gestionarla desde una inmobiliaria,
                  también podés completar el formulario y convertirla en inmueble.
                </div>
              </div>
            )}

          {sourceRequestAlreadyApprovedAsParticular && (
            <div className="alert alert-success mt-3 mb-0">
              <strong>
                Esta solicitud ya fue aprobada como publicación particular.
              </strong>

              {sourceRequest.particularPublicationId && (
                <div className="small mt-1">
                  ID publicación particular:{" "}
                  <code>{sourceRequest.particularPublicationId}</code>
                </div>
              )}

              {sourceRequest.particularPublicationStatus && (
                <div className="small mt-1">
                  Estado:{" "}
                  <span className="badge text-bg-success">
                    {sourceRequest.particularPublicationStatus}
                  </span>
                </div>
              )}

              {sourceRequestParticularPath && (
                <div className="mt-3">
                  <Link
                    to={sourceRequestParticularPath}
                    className="btn btn-sm btn-success"
                  >
                    Ver publicación particular
                  </Link>
                </div>
              )}
            </div>
          )}

          {sourceRequestAlreadyConverted && (
            <div className="alert alert-success mt-3 mb-0">
              <strong>Esta solicitud ya fue convertida en inmueble.</strong>

              {sourceRequest.convertedTitle && (
                <div className="small mt-1">
                  Publicación: <strong>{sourceRequest.convertedTitle}</strong>
                </div>
              )}

              <div className="small mt-1">
                ID del inmueble: <code>{sourceRequest.convertedInmuebleId}</code>
              </div>

              <div className="mt-3 d-flex flex-wrap gap-2">
                {sourceRequestEditPath && (
                  <Link
                    to={sourceRequestEditPath}
                    className="btn btn-sm btn-success"
                  >
                    Editar inmueble existente
                  </Link>
                )}

                {sourceRequestPreviewPath && (
                  <Link
                    to={sourceRequestPreviewPath}
                    className="btn btn-sm btn-outline-success"
                  >
                    Vista previa
                  </Link>
                )}

                {sourceRequestPublicPath && (
                  <Link
                    to={sourceRequestPublicPath}
                    className="btn btn-sm btn-success"
                  >
                    Ver publicación pública
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="mt-3">
            <PublicationRequestImages
              images={sourceRequest.images}
              title="Fotos que se copiarán al inmueble"
              emptyMessage="Esta solicitud no tiene fotos cargadas."
            />

            <InmuebleVideoSection
              videos={normalizeInmuebleVideos(sourceRequest.videos || [])}
              title="Videos que se copiarán al inmueble"
            />
          </div>
        </div>
      )}

      {sourceRequestConversionBlocked ? (
        <div className="alert alert-light border">
          {sourceRequestAlreadyApprovedAsParticular
            ? "No se muestra el formulario de creación porque esta solicitud ya fue aprobada como publicación particular de ONO Prop."
            : sourceRequestAlreadyConverted
              ? "No se muestra el formulario de creación porque esta solicitud ya tiene un inmueble asociado. Usá los botones superiores para editar o revisar la publicación existente."
              : "No se muestra el formulario de creación porque esta solicitud ya está siendo convertida por otro usuario. Actualizá el panel en unos minutos para revisar el resultado."}
        </div>
      ) : (
        <InmuebleForm
          values={values}
          errors={{}}
          loading={loading || loadingRequest || approvingParticular}
          isEditMode={false}
          handleChange={handleChange}
          handleNestedChange={handleNestedChange}
          handleSubmit={handleCreate}
          inmuebleId={null}
          inmobiliariaId={values.inmobiliariaId || activeInmobiliariaId}
        />
      )}
    </section>
  );
};

export default InmuebleCreatePage;