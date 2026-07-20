import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Login from "../../components/auth/Login";
import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import {
    createParticularPublicationRequest,
    getActiveInmobiliariasForPublicationRequest,
} from "../services/particularPublication.service";

const MIN_DESCRIPTION_LENGTH = 20;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

const INITIAL_FORM = {
    nombre: "",
    telefono: "",
    email: "",
    operacion: "",
    tipo: "",
    ubicacion: "",
    descripcion: "",
    precioEstimado: "",
    targetType: "onoprop",
    targetInmobiliariaId: "",
    targetInmobiliariaNombre: "",
};

const OPERACIONES = [
    { id: "venta", label: "Venta" },
    { id: "alquiler", label: "Alquiler" },
    { id: "alquiler_temporal", label: "Alquiler temporal" },
    { id: "tasacion", label: "Tasación / quiero conocer el valor" },
];

const TIPOS_INMUEBLE = [
    { id: "casa", label: "Casa" },
    { id: "departamento", label: "Departamento" },
    { id: "terreno", label: "Terreno" },
    { id: "local", label: "Local" },
    { id: "oficina", label: "Oficina" },
    { id: "cochera", label: "Cochera" },
    { id: "campo", label: "Campo" },
    { id: "otro", label: "Otro" },
];

const getInitialFormForUser = (user) => ({
    ...INITIAL_FORM,
    nombre: user?.displayName || "",
    email: user?.email || "",
});

const getVerificationBadge = (inmobiliaria) => {
    const estado = inmobiliaria?.verificacion?.estado || "";

    if (estado === "verificada") {
        return "Verificada";
    }

    if (estado === "pendiente_revision") {
        return "En revisión";
    }

    return "Pendiente";
};

const formatFileSize = (bytes = 0) => {
    if (!bytes) return "0 MB";

    const mb = bytes / (1024 * 1024);

    return `${mb.toFixed(mb >= 1 ? 1 : 2)} MB`;
};

const getImagePreviewId = (file, index) => {
    return `${file.name}-${file.size}-${file.lastModified}-${index}`;
};

const ParticularPublicationRequestPage = () => {
    const { user } = useAuth();

    const [formData, setFormData] = useState(INITIAL_FORM);
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [imageError, setImageError] = useState("");
    const [inmobiliarias, setInmobiliarias] = useState([]);
    const [loadingInmobiliarias, setLoadingInmobiliarias] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const siteUrl =
        import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const descriptionLength = formData.descripcion.trim().length;
    const isDescriptionShort =
        descriptionLength > 0 && descriptionLength < MIN_DESCRIPTION_LENGTH;

    const selectedInmobiliaria = useMemo(() => {
        return (
            inmobiliarias.find(
                (inmobiliaria) => inmobiliaria.id === formData.targetInmobiliariaId,
            ) || null
        );
    }, [formData.targetInmobiliariaId, inmobiliarias]);

    const remainingImages = MAX_IMAGES - imageFiles.length;

    useEffect(() => {
        if (!user) return;

        setFormData((prev) => ({
            ...prev,
            nombre: prev.nombre || user.displayName || "",
            email: prev.email || user.email || "",
        }));
    }, [user]);

    useEffect(() => {
        if (!user) return;

        const fetchInmobiliarias = async () => {
            try {
                setLoadingInmobiliarias(true);

                const data = await getActiveInmobiliariasForPublicationRequest();
                setInmobiliarias(data);
            } catch (err) {
                console.error("Error cargando inmobiliarias activas:", err);
            } finally {
                setLoadingInmobiliarias(false);
            }
        };

        fetchInmobiliarias();
    }, [user]);

    useEffect(() => {
        const previews = imageFiles.map((file, index) => ({
            id: getImagePreviewId(file, index),
            name: file.name,
            size: file.size,
            url: URL.createObjectURL(file),
        }));

        setImagePreviews(previews);

        return () => {
            previews.forEach((preview) => URL.revokeObjectURL(preview.url));
        };
    }, [imageFiles]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((prev) => {
            if (name === "targetType") {
                return {
                    ...prev,
                    targetType: value,
                    targetInmobiliariaId: "",
                    targetInmobiliariaNombre: "",
                };
            }

            if (name === "targetInmobiliariaId") {
                const selected =
                    inmobiliarias.find((inmobiliaria) => inmobiliaria.id === value) ||
                    null;

                return {
                    ...prev,
                    targetInmobiliariaId: value,
                    targetInmobiliariaNombre: selected?.nombre || "",
                };
            }

            return {
                ...prev,
                [name]: value,
            };
        });

        setError("");
        setSuccess("");
    };

    const handleImageChange = (e) => {
        const selectedFiles = Array.from(e.target.files || []);

        if (selectedFiles.length === 0) return;

        setError("");
        setSuccess("");
        setImageError("");

        const availableSlots = MAX_IMAGES - imageFiles.length;

        if (availableSlots <= 0) {
            setImageError(`Ya cargaste el máximo de ${MAX_IMAGES} fotos.`);
            e.target.value = "";
            return;
        }

        const filesToAdd = [];
        const errors = [];

        selectedFiles.slice(0, availableSlots).forEach((file) => {
            if (!file.type?.startsWith("image/")) {
                errors.push(`"${file.name}" no es una imagen válida.`);
                return;
            }

            if (file.size > MAX_IMAGE_SIZE_BYTES) {
                errors.push(`"${file.name}" supera los 8 MB.`);
                return;
            }

            filesToAdd.push(file);
        });

        if (selectedFiles.length > availableSlots) {
            errors.push(
                `Solo se agregaron ${availableSlots} foto${availableSlots === 1 ? "" : "s"
                }. El máximo es ${MAX_IMAGES}.`,
            );
        }

        if (filesToAdd.length > 0) {
            setImageFiles((prev) => [...prev, ...filesToAdd]);
        }

        if (errors.length > 0) {
            setImageError(errors.join(" "));
        }

        e.target.value = "";
    };

    const handleRemoveImage = (indexToRemove) => {
        setImageFiles((prev) =>
            prev.filter((_, index) => index !== indexToRemove),
        );
        setImageError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (saving) return;

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            await createParticularPublicationRequest({
                ...formData,
                images: imageFiles,
            });

            setSuccess(
                formData.targetType === "onoprop"
                    ? "Recibimos tu solicitud. ONO Prop podrá contactarte para validar los datos y coordinar cómo avanzar."
                    : `Recibimos tu solicitud. ${formData.targetInmobiliariaNombre} podrá revisarla y contactarte para validar los datos.`,
            );

            setFormData(getInitialFormForUser(user));
            setImageFiles([]);
            setImageError("");
        } catch (err) {
            console.error("Error enviando solicitud de publicación:", err);
            setError(err.message || "No se pudo enviar la solicitud.");
        } finally {
            setSaving(false);
        }
    };

    if (!user) {
        return (
            <main className="portal-home">
                <SEO
                    title="Iniciar sesión para publicar | ONO Prop"
                    description="Para solicitar la publicación de una propiedad en ONO Prop necesitás iniciar sesión."
                    url={`${siteUrl}/publicar`}
                    type="website"
                    siteName="ONO Prop"
                    noIndex
                />

                <section className="portal-section">
                    <div className="container">
                        <div className="row justify-content-center">
                            <div className="col-lg-7">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-body p-4 p-md-5">
                                        <p className="text-uppercase text-muted small mb-1">
                                            Publicar propiedad
                                        </p>

                                        <h1 className="h3 mb-3">
                                            Para publicar necesitás iniciar sesión
                                        </h1>

                                        <p className="text-muted">
                                            Podés solicitar la publicación de una propiedad como
                                            particular, pero primero necesitamos identificarte para
                                            poder hacer seguimiento del pedido y contactarte.
                                        </p>

                                        <div className="alert alert-info">
                                            La solicitud no publica automáticamente el inmueble.
                                            Primero se revisa la información y luego se coordina cómo
                                            avanzar.
                                        </div>

                                        <div className="border rounded-3 p-3 p-md-4 bg-light">
                                            <Login />
                                        </div>

                                        <div className="mt-3 d-flex flex-wrap gap-2">
                                            <Link to="/" className="btn btn-outline-secondary">
                                                Volver al inicio
                                            </Link>

                                            <Link
                                                to="/inmobiliarias"
                                                className="btn btn-outline-primary"
                                            >
                                                Soy inmobiliaria
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="portal-home">
            <SEO
                title="Publicar propiedad | ONO Prop"
                description="Solicitá publicar una propiedad en ONO Prop. Revisamos tu pedido y te contactamos para avanzar."
                url={`${siteUrl}/publicar`}
                type="website"
                siteName="ONO Prop"
                noIndex
            />

            <section className="portal-section">
                <div className="container">
                    <div className="row g-4 align-items-start">
                        <div className="col-lg-5">
                            <p className="text-uppercase text-muted small mb-1">
                                Publicar propiedad
                            </p>

                            <h1 className="portal-section-title mb-3">
                                ¿Querés publicar una propiedad?
                            </h1>

                            <p className="lead text-muted">
                                Completá esta solicitud y elegí quién querés que revise los
                                datos: ONO Prop o una inmobiliaria activa de la plataforma.
                            </p>

                            <div className="alert alert-info">
                                <strong>Importante:</strong> esta solicitud no publica
                                automáticamente el inmueble. Primero se revisa la información y
                                luego se coordina cómo avanzar.
                            </div>

                            <div className="card border-0 shadow-sm mb-3">
                                <div className="card-body p-4">
                                    <h2 className="h5 mb-3">Seguimiento de solicitudes</h2>

                                    <p className="text-muted">
                                        Después de enviar el pedido, podés consultar el estado desde
                                        tu panel de publicaciones.
                                    </p>

                                    <Link
                                        to="/mis-publicaciones"
                                        className="btn btn-outline-primary"
                                    >
                                        Ver mis solicitudes
                                    </Link>
                                </div>
                            </div>

                            <div className="card border-0 shadow-sm">
                                <div className="card-body p-4">
                                    <h2 className="h5 mb-3">
                                        También podés publicar como inmobiliaria
                                    </h2>

                                    <p className="text-muted">
                                        Si administrás una inmobiliaria, podés crear tu perfil,
                                        cargar propiedades, recibir consultas y usar la red de
                                        colegas.
                                    </p>

                                    <Link to="/inmobiliarias" className="btn btn-outline-primary">
                                        Soy inmobiliaria
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <div className="col-lg-7">
                            <form className="card border-0 shadow-sm" onSubmit={handleSubmit}>
                                <fieldset disabled={saving} className="border-0 p-0 m-0">
                                    <div className="card-body p-4">
                                        <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-3">
                                            <div>
                                                <h2 className="h4 mb-1">Solicitud de publicación</h2>
                                                <p className="text-muted mb-0">
                                                    Completá los datos principales del inmueble y, si
                                                    querés, agregá fotos.
                                                </p>
                                            </div>

                                            <div className="small text-muted">
                                                Usuario:{" "}
                                                <strong>{user.displayName || user.email}</strong>
                                            </div>
                                        </div>

                                        {error && <div className="alert alert-danger">{error}</div>}

                                        {success && (
                                            <div className="alert alert-success">
                                                <div>{success}</div>

                                                <div className="mt-3 d-flex flex-wrap gap-2">
                                                    <Link
                                                        to="/mis-publicaciones"
                                                        className="btn btn-sm btn-success"
                                                    >
                                                        Ver mis solicitudes
                                                    </Link>

                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-success"
                                                        onClick={() => setSuccess("")}
                                                    >
                                                        Cargar otra solicitud
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="row g-3">
                                            <div className="col-12">
                                                <label className="form-label">
                                                    ¿Quién querés que revise y publique tu propiedad?
                                                </label>

                                                <div className="row g-3">
                                                    <div className="col-md-6">
                                                        <label className="border rounded-3 p-3 h-100 d-block">
                                                            <input
                                                                type="radio"
                                                                name="targetType"
                                                                value="onoprop"
                                                                checked={formData.targetType === "onoprop"}
                                                                onChange={handleChange}
                                                                className="form-check-input me-2"
                                                            />
                                                            <strong>ONO Prop</strong>
                                                            <span className="d-block text-muted small mt-2">
                                                                El equipo central revisa los datos y coordina
                                                                cómo avanzar. Ideal si todavía no elegiste una
                                                                inmobiliaria.
                                                            </span>
                                                        </label>
                                                    </div>

                                                    <div className="col-md-6">
                                                        <label className="border rounded-3 p-3 h-100 d-block">
                                                            <input
                                                                type="radio"
                                                                name="targetType"
                                                                value="inmobiliaria"
                                                                checked={formData.targetType === "inmobiliaria"}
                                                                onChange={handleChange}
                                                                className="form-check-input me-2"
                                                            />
                                                            <strong>Una inmobiliaria</strong>
                                                            <span className="d-block text-muted small mt-2">
                                                                Elegís una inmobiliaria activa para que revise
                                                                los datos y gestione la publicación.
                                                            </span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>

                                            {formData.targetType === "inmobiliaria" && (
                                                <div className="col-12">
                                                    <label className="form-label">
                                                        Inmobiliaria elegida
                                                    </label>

                                                    <select
                                                        name="targetInmobiliariaId"
                                                        className="form-select"
                                                        value={formData.targetInmobiliariaId}
                                                        onChange={handleChange}
                                                        required
                                                    >
                                                        <option value="">
                                                            {loadingInmobiliarias
                                                                ? "Cargando inmobiliarias..."
                                                                : "Seleccionar inmobiliaria"}
                                                        </option>

                                                        {inmobiliarias.map((inmobiliaria) => (
                                                            <option
                                                                key={inmobiliaria.id}
                                                                value={inmobiliaria.id}
                                                            >
                                                                {inmobiliaria.nombre}
                                                                {inmobiliaria.slug
                                                                    ? ` /${inmobiliaria.slug}`
                                                                    : ""}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    {selectedInmobiliaria && (
                                                        <div className="alert alert-light border small mt-2 mb-0">
                                                            Solicitud dirigida a{" "}
                                                            <strong>{selectedInmobiliaria.nombre}</strong>.{" "}
                                                            Estado de validación:{" "}
                                                            <strong>
                                                                {getVerificationBadge(selectedInmobiliaria)}
                                                            </strong>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="col-md-6">
                                                <label className="form-label">Nombre</label>

                                                <input
                                                    type="text"
                                                    name="nombre"
                                                    className="form-control"
                                                    value={formData.nombre}
                                                    onChange={handleChange}
                                                    placeholder="Tu nombre"
                                                    autoComplete="name"
                                                    required
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <label className="form-label">Teléfono / WhatsApp</label>

                                                <input
                                                    type="text"
                                                    name="telefono"
                                                    className="form-control"
                                                    value={formData.telefono}
                                                    onChange={handleChange}
                                                    placeholder="+54 351..."
                                                    autoComplete="tel"
                                                />

                                                <div className="form-text">
                                                    Indicá un teléfono si preferís que te contacten por
                                                    WhatsApp.
                                                </div>
                                            </div>

                                            <div className="col-md-6">
                                                <label className="form-label">Email</label>

                                                <input
                                                    type="email"
                                                    name="email"
                                                    className="form-control"
                                                    value={formData.email}
                                                    onChange={handleChange}
                                                    placeholder="tu@email.com"
                                                    autoComplete="email"
                                                />

                                                <div className="form-text">
                                                    Debe quedar al menos un medio de contacto: teléfono o
                                                    email.
                                                </div>
                                            </div>

                                            <div className="col-md-6">
                                                <label className="form-label">Operación</label>

                                                <select
                                                    name="operacion"
                                                    className="form-select"
                                                    value={formData.operacion}
                                                    onChange={handleChange}
                                                    required
                                                >
                                                    <option value="">Seleccionar</option>

                                                    {OPERACIONES.map((option) => (
                                                        <option key={option.id} value={option.id}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="col-md-6">
                                                <label className="form-label">Tipo de inmueble</label>

                                                <select
                                                    name="tipo"
                                                    className="form-select"
                                                    value={formData.tipo}
                                                    onChange={handleChange}
                                                    required
                                                >
                                                    <option value="">Seleccionar</option>

                                                    {TIPOS_INMUEBLE.map((option) => (
                                                        <option key={option.id} value={option.id}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="col-md-6">
                                                <label className="form-label">Precio estimado</label>

                                                <input
                                                    type="text"
                                                    name="precioEstimado"
                                                    className="form-control"
                                                    value={formData.precioEstimado}
                                                    onChange={handleChange}
                                                    placeholder="Ej: USD 80.000 / $600.000 mensual"
                                                />

                                                <div className="form-text">
                                                    Puede ser aproximado. También podés dejarlo vacío.
                                                </div>
                                            </div>

                                            <div className="col-12">
                                                <label className="form-label">
                                                    Ubicación aproximada
                                                </label>

                                                <input
                                                    type="text"
                                                    name="ubicacion"
                                                    className="form-control"
                                                    value={formData.ubicacion}
                                                    onChange={handleChange}
                                                    placeholder="Barrio, ciudad o zona"
                                                    required
                                                />

                                                <div className="form-text">
                                                    No hace falta publicar dirección exacta en esta etapa.
                                                </div>
                                            </div>

                                            <div className="col-12">
                                                <div className="d-flex justify-content-between gap-2">
                                                    <label className="form-label">Descripción</label>

                                                    <small
                                                        className={
                                                            isDescriptionShort ? "text-warning" : "text-muted"
                                                        }
                                                    >
                                                        {descriptionLength}/{MAX_DESCRIPTION_LENGTH}
                                                    </small>
                                                </div>

                                                <textarea
                                                    name="descripcion"
                                                    className="form-control"
                                                    rows={5}
                                                    value={formData.descripcion}
                                                    onChange={handleChange}
                                                    placeholder="Contanos brevemente características, ambientes, estado, documentación, disponibilidad, etc."
                                                    minLength={MIN_DESCRIPTION_LENGTH}
                                                    maxLength={MAX_DESCRIPTION_LENGTH}
                                                    required
                                                />

                                                <div className="form-text">
                                                    Mínimo {MIN_DESCRIPTION_LENGTH} caracteres. Agregá
                                                    datos como ambientes, estado general, documentación y
                                                    disponibilidad.
                                                </div>
                                            </div>

                                            <div className="col-12">
                                                <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-2">
                                                    <div>
                                                        <label className="form-label mb-1">
                                                            Fotos de la propiedad
                                                        </label>
                                                        <div className="form-text mt-0">
                                                            Opcional. Podés subir hasta {MAX_IMAGES} fotos de
                                                            máximo 8 MB cada una.
                                                        </div>
                                                    </div>

                                                    <div className="small text-muted">
                                                        {imageFiles.length}/{MAX_IMAGES} cargadas ·{" "}
                                                        {remainingImages} disponibles
                                                    </div>
                                                </div>

                                                <input
                                                    type="file"
                                                    className="form-control"
                                                    accept="image/*"
                                                    multiple
                                                    onChange={handleImageChange}
                                                    disabled={saving || remainingImages <= 0}
                                                />

                                                {imageError && (
                                                    <div className="alert alert-warning small mt-2 mb-0">
                                                        {imageError}
                                                    </div>
                                                )}

                                                {imagePreviews.length > 0 && (
                                                    <div className="row g-3 mt-1">
                                                        {imagePreviews.map((preview, index) => (
                                                            <div
                                                                className="col-6 col-md-4"
                                                                key={preview.id}
                                                            >
                                                                <div className="border rounded-3 overflow-hidden bg-light h-100">
                                                                    <div
                                                                        className="ratio ratio-4x3"
                                                                        style={{ backgroundColor: "#f8f9fa" }}
                                                                    >
                                                                        <img
                                                                            src={preview.url}
                                                                            alt={preview.name}
                                                                            className="w-100 h-100 object-fit-cover"
                                                                        />
                                                                    </div>

                                                                    <div className="p-2">
                                                                        <div
                                                                            className="small fw-semibold text-truncate"
                                                                            title={preview.name}
                                                                        >
                                                                            {preview.name}
                                                                        </div>

                                                                        <div className="small text-muted">
                                                                            {formatFileSize(preview.size)}
                                                                        </div>

                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-sm btn-outline-danger w-100 mt-2"
                                                                            onClick={() => handleRemoveImage(index)}
                                                                        >
                                                                            Quitar
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="col-12">
                                                <div className="alert alert-light border small mb-0">
                                                    Al enviar esta solicitud aceptás que el destino
                                                    elegido pueda revisar la información, ver las fotos
                                                    cargadas y contactarte. Por ahora el servicio es
                                                    gratuito; más adelante ONO Prop podrá definir planes,
                                                    suscripciones o cargos por publicación.
                                                </div>
                                            </div>

                                            <div className="col-12 d-flex flex-wrap gap-2">
                                                <button
                                                    type="submit"
                                                    className="btn btn-primary"
                                                    disabled={saving || isDescriptionShort}
                                                >
                                                    {saving ? "Enviando..." : "Enviar solicitud"}
                                                </button>

                                                <Link
                                                    to="/mis-publicaciones"
                                                    className="btn btn-outline-primary"
                                                >
                                                    Mis solicitudes
                                                </Link>

                                                <Link to="/" className="btn btn-outline-secondary">
                                                    Volver al inicio
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </fieldset>
                            </form>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default ParticularPublicationRequestPage;