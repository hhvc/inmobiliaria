import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";

import {
    getInmobiliariaById,
    updateInmobiliariaVerificationData,
} from "../services/inmobiliaria.service";
import { uploadInmobiliariaVerificationFile } from "../helpers/uploadInmobiliariaVerificationFile";

const DOCUMENT_LABELS = {
    constanciaArca: "Constancia de inscripción en ARCA",
    dniTitular: "DNI del titular / representante",
    estatutoContratoSocial: "Estatuto o contrato social",
    poderApoderado: "Poder del apoderado",
};

const getRequiredDocumentKeys = ({ tipoPersona, actuaPorPoder }) => {
    const required = ["constanciaArca"];

    if (tipoPersona === "juridica") {
        required.push("estatutoContratoSocial");
        required.push("dniTitular");
    } else {
        required.push("dniTitular");
    }

    if (actuaPorPoder) {
        required.push("poderApoderado");
    }

    return required;
};

const isUploadedDocument = (documentData) => {
    return Boolean(documentData?.path);
};

const formatFileSize = (size = 0) => {
    const numericSize = Number(size);

    if (!Number.isFinite(numericSize) || numericSize <= 0) {
        return "";
    }

    if (numericSize < 1024 * 1024) {
        return `${Math.round(numericSize / 1024)} KB`;
    }

    return `${(numericSize / (1024 * 1024)).toFixed(1)} MB`;
};

const InmobiliariaVerificationDocumentsPage = () => {
    const { user, activeInmobiliariaId } = useAuth();

    const userInmobiliarias = useMemo(() => {
        return Array.isArray(user?.inmobiliarias) ? user.inmobiliarias : [];
    }, [user?.inmobiliarias]);

    const inmobiliariaId = activeInmobiliariaId || userInmobiliarias[0] || "";

    const [inmobiliaria, setInmobiliaria] = useState(null);

    const [formState, setFormState] = useState({
        tipoPersona: "fisica",
        actuaPorPoder: false,
    });

    const [files, setFiles] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const siteUrl =
        import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const documentacion = useMemo(() => {
        return inmobiliaria?.documentacionVerificacion || {};
    }, [inmobiliaria?.documentacionVerificacion]);

    const requiredDocumentKeys = useMemo(() => {
        return getRequiredDocumentKeys(formState);
    }, [formState]);

    const allRequiredDocumentsUploaded = useMemo(() => {
        return requiredDocumentKeys.every((key) =>
            isUploadedDocument(documentacion[key]) || Boolean(files[key]),
        );
    }, [documentacion, files, requiredDocumentKeys]);

    useEffect(() => {
        const fetchInmobiliaria = async () => {
            try {
                setLoading(true);
                setError("");

                if (!user) {
                    return;
                }

                if (!inmobiliariaId) {
                    throw new Error("No tenés una inmobiliaria activa seleccionada");
                }

                const data = await getInmobiliariaById(inmobiliariaId);

                if (!data) {
                    throw new Error("No se encontró la inmobiliaria");
                }

                setInmobiliaria(data);

                setFormState({
                    tipoPersona: data.verificacion?.tipoPersona || "fisica",
                    actuaPorPoder: Boolean(data.verificacion?.actuaPorPoder),
                });
            } catch (err) {
                console.error("Error cargando documentación de validación:", err);
                setError(err.message || "No se pudo cargar la documentación");
            } finally {
                setLoading(false);
            }
        };

        fetchInmobiliaria();
    }, [inmobiliariaId, user]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        setFormState((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));

        setSuccess("");
        setError("");
    };

    const handleFileChange = (documentKey, file) => {
        setFiles((prev) => ({
            ...prev,
            [documentKey]: file || null,
        }));

        setSuccess("");
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            if (!inmobiliariaId) {
                throw new Error("No tenés una inmobiliaria activa seleccionada");
            }

            const uploadedDocuments = {};

            for (const [documentKey, file] of Object.entries(files)) {
                if (!file) continue;

                uploadedDocuments[documentKey] =
                    await uploadInmobiliariaVerificationFile({
                        inmobiliariaId,
                        documentKey,
                        file,
                    });
            }

            const nextDocumentacion = {
                ...documentacion,
                ...uploadedDocuments,
            };

            const complete = requiredDocumentKeys.every((key) =>
                isUploadedDocument(nextDocumentacion[key]),
            );

            const nextEstado = complete
                ? "pendiente_revision"
                : "pendiente_documentacion";

            await updateInmobiliariaVerificationData(inmobiliariaId, {
                verificacion: {
                    ...(inmobiliaria?.verificacion || {}),
                    tipoPersona: formState.tipoPersona,
                    actuaPorPoder: formState.actuaPorPoder,
                    estado: nextEstado,
                    estadoLabel: complete
                        ? "Documentación en revisión"
                        : "Pendiente de documentación para validar",
                    requiereDocumentacion: true,
                    documentacionCompleta: complete,
                    submittedAt: complete ? new Date().toISOString() : null,
                    observaciones: complete
                        ? "La documentación fue presentada y se encuentra pendiente de revisión."
                        : "La inmobiliaria todavía debe completar la documentación requerida para validar.",
                },
                documentacionVerificacion: nextDocumentacion,
            });

            setFiles({});
            setSuccess(
                complete
                    ? "Documentación enviada a revisión correctamente."
                    : "Documentación guardada. Todavía faltan archivos requeridos para enviar a revisión.",
            );

            const refreshed = await getInmobiliariaById(inmobiliariaId);
            setInmobiliaria(refreshed);
        } catch (err) {
            console.error("Error guardando documentación:", err);
            setError(err.message || "No se pudo guardar la documentación");
        } finally {
            setSaving(false);
        }
    };

    if (!user) {
        return (
            <main className="portal-home">
                <section className="portal-section">
                    <div className="container">
                        <div className="alert alert-warning">
                            Tenés que iniciar sesión para cargar documentación.
                        </div>

                        <Link to="/inmobiliarias" className="btn btn-primary">
                            Ir a inmobiliarias
                        </Link>
                    </div>
                </section>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="portal-home">
                <section className="portal-section">
                    <div className="container">
                        <p className="text-muted mb-0">Cargando documentación...</p>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="portal-home">
            <SEO
                title="Documentación de validación | ONO Prop"
                description="Cargá documentación para validar una inmobiliaria en ONO Prop."
                url={`${siteUrl}/admin/inmobiliaria/documentacion`}
                type="website"
                siteName="ONO Prop"
                noIndex
            />

            <section className="portal-section">
                <div className="container">
                    <div className="mb-4">
                        <Link to="/admin/inmobiliaria" className="btn btn-outline-secondary">
                            ← Volver al panel
                        </Link>
                    </div>

                    <div className="row mb-4">
                        <div className="col-lg-9">
                            <p className="text-uppercase text-muted small mb-1">
                                Validación de inmobiliaria
                            </p>

                            <h1 className="portal-section-title">
                                Documentación para validar
                            </h1>

                            <p className="lead text-muted">
                                Cargá la documentación legal y fiscal correspondiente. La
                                inmobiliaria puede operar mientras esté pendiente, pero en su
                                página pública se mostrará el estado de validación.
                            </p>
                        </div>
                    </div>

                    {inmobiliaria && (
                        <div className="alert alert-light border">
                            <strong>{inmobiliaria.nombre}</strong>
                            <br />
                            Estado actual:{" "}
                            <strong>
                                {inmobiliaria.verificacion?.estadoLabel ||
                                    inmobiliaria.verificacion?.estado ||
                                    "Pendiente de documentación"}
                            </strong>
                        </div>
                    )}

                    {error && <div className="alert alert-danger">{error}</div>}

                    {success && <div className="alert alert-success">{success}</div>}

                    <form className="card border-0 shadow-sm" onSubmit={handleSubmit}>
                        <div className="card-body p-4">
                            <div className="row g-4">
                                <div className="col-md-6">
                                    <label className="form-label">Tipo de persona</label>

                                    <select
                                        name="tipoPersona"
                                        className="form-select"
                                        value={formState.tipoPersona}
                                        onChange={handleChange}
                                    >
                                        <option value="fisica">Persona física</option>
                                        <option value="juridica">Persona jurídica</option>
                                    </select>
                                </div>

                                <div className="col-md-6 d-flex align-items-end">
                                    <div className="form-check">
                                        <input
                                            id="actuaPorPoder"
                                            name="actuaPorPoder"
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={formState.actuaPorPoder}
                                            onChange={handleChange}
                                        />

                                        <label
                                            className="form-check-label"
                                            htmlFor="actuaPorPoder"
                                        >
                                            Actúa mediante apoderado
                                        </label>
                                    </div>
                                </div>

                                <div className="col-12">
                                    <div className="alert alert-info small mb-0">
                                        Documentación requerida:{" "}
                                        {requiredDocumentKeys
                                            .map((key) => DOCUMENT_LABELS[key])
                                            .join(" · ")}
                                    </div>
                                </div>

                                {Object.entries(DOCUMENT_LABELS).map(([documentKey, label]) => {
                                    const isRequired = requiredDocumentKeys.includes(documentKey);
                                    const currentDocument = documentacion[documentKey];

                                    return (
                                        <div className="col-md-6" key={documentKey}>
                                            <div className="border rounded-3 p-3 h-100">
                                                <div className="d-flex justify-content-between gap-2 mb-2">
                                                    <label className="form-label fw-semibold mb-0">
                                                        {label}
                                                    </label>

                                                    {isRequired ? (
                                                        <span className="badge text-bg-warning">
                                                            Requerido
                                                        </span>
                                                    ) : (
                                                        <span className="badge text-bg-light border">
                                                            Opcional
                                                        </span>
                                                    )}
                                                </div>

                                                {currentDocument?.filename && (
                                                    <div className="alert alert-success small py-2 mb-2">
                                                        Archivo cargado:{" "}
                                                        <strong>{currentDocument.filename}</strong>{" "}
                                                        {currentDocument.size
                                                            ? `(${formatFileSize(currentDocument.size)})`
                                                            : ""}
                                                    </div>
                                                )}

                                                <input
                                                    type="file"
                                                    className="form-control"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    onChange={(e) =>
                                                        handleFileChange(
                                                            documentKey,
                                                            e.target.files?.[0] || null,
                                                        )
                                                    }
                                                />

                                                <div className="form-text">
                                                    Formatos sugeridos: PDF, JPG o PNG.
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                <div className="col-12">
                                    {!allRequiredDocumentsUploaded && (
                                        <div className="alert alert-warning">
                                            Todavía faltan documentos requeridos. Podés guardar el
                                            avance, pero la inmobiliaria seguirá pendiente de
                                            documentación.
                                        </div>
                                    )}

                                    {allRequiredDocumentsUploaded && (
                                        <div className="alert alert-success">
                                            La documentación requerida está completa. Al guardar,
                                            quedará enviada a revisión.
                                        </div>
                                    )}
                                </div>

                                <div className="col-12 d-flex flex-wrap gap-2">
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={saving}
                                    >
                                        {saving
                                            ? "Guardando..."
                                            : allRequiredDocumentsUploaded
                                                ? "Guardar y enviar a revisión"
                                                : "Guardar documentación"}
                                    </button>

                                    <Link
                                        to="/admin/inmobiliaria"
                                        className="btn btn-outline-secondary"
                                    >
                                        Cancelar
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </section>
        </main>
    );
};

export default InmobiliariaVerificationDocumentsPage;