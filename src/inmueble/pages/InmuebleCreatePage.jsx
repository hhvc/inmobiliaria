import { useState } from "react";
import { useNavigate } from "react-router-dom";

import InmuebleForm from "../components/InmuebleForm";
import { useAuth } from "../../context/auth/useAuth";
import { createInmueble } from "../services/inmueble.service";
import { canCreateInmueble } from "../helpers/permissions";

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
    total: "",
    cubierta: "",
    descubierta: "",
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

  // 🔑 Dominio / compatibilidad
  inmobiliariaId: "",
  ownerInmobiliariaId: "",

  // 🤝 Compartir / soft delete
  sharedWith: {},
  deleted: false,

  // 🤝 Red de colegas
  sharing: DEFAULT_SHARING,
  networkData: DEFAULT_NETWORK_DATA,
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

const InmuebleCreatePage = () => {
  const navigate = useNavigate();
  const { user, activeInmobiliariaId } = useAuth();

  const [values, setValues] = useState(INITIAL_VALUES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
  };

  const handleNestedChange = (group, field, value) => {
    if (!group) return;

    // Permite usar este handler también para campos planos,
    // evitando estructuras rotas tipo destacado: { null: true }
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
  };

  /* =========================
     Crear inmueble
     ========================= */

  const handleCreate = async (formValues) => {
    try {
      setLoading(true);
      setError(null);

      const selectedInmobiliariaId =
        formValues?.inmobiliariaId || activeInmobiliariaId;

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

      /*
        IMPORTANTE:
        networkData se separa del documento público del inmueble.
        El servicio createInmueble deberá guardarlo en una estructura protegida.
      */
      const { networkData: _networkData, ...publicFormValues } =
        formValues || {};

      const inmuebleData = {
        ...publicFormValues,

        // 🔑 Dominio principal
        ownerId: user.uid,
        createdBy: user.uid,

        // 🔑 Compatibilidad + patrón híbrido futuro
        inmobiliariaId: selectedInmobiliariaId,
        ownerInmobiliariaId: selectedInmobiliariaId,

        // 🖼️ En creación todavía no subimos imágenes
        images: [],

        // 🤝 Compartir
        sharedWith:
          formValues?.sharedWith && typeof formValues.sharedWith === "object"
            ? formValues.sharedWith
            : {},

        // 🗑️ Soft delete
        deleted: false,

        // Publicación
        estado: formValues?.estado || "activo",
        destacado: Boolean(formValues?.destacado),
        publicarEnPortal: Boolean(formValues?.publicarEnPortal),
        noIndex: Boolean(formValues?.noIndex),

        // Red de colegas: datos no sensibles para consulta/query
        sharing: normalizedSharing,
      };

      const inmuebleId = await createInmueble(
        selectedInmobiliariaId,
        inmuebleData,
        {
          networkData: normalizedSharing.enabled ? normalizedNetworkData : null,
        },
      );

      console.log("✅ Inmueble creado:", inmuebleId);

      navigate("/admin/inmuebles/listado");
    } catch (err) {
      console.error("Error creando inmueble:", err);
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
        <p>Cargá la información básica para publicar el inmueble</p>
      </header>

      {error && <div className="error-box">{error}</div>}

      <InmuebleForm
        values={values}
        errors={{}}
        loading={loading}
        isEditMode={false}
        handleChange={handleChange}
        handleNestedChange={handleNestedChange}
        handleSubmit={handleCreate}
        inmuebleId={null}
        inmobiliariaId={activeInmobiliariaId}
      />
    </section>
  );
};

export default InmuebleCreatePage;