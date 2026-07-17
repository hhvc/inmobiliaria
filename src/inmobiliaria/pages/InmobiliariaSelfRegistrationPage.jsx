import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import SEO from "../../components/SEO";
import Login from "../../components/auth/Login";
import { useAuth } from "../../context/auth/useAuth";

import InmobiliariaForm from "../components/InmobiliariaForm";
import {
    createSelfRegisteredInmobiliaria,
    updateInmobiliaria,
} from "../services/inmobiliaria.service";
import { uploadInmobiliariaImagesSimplified } from "../helpers/uploadInmobiliariaImages";

const getUserInmobiliarias = (user) => {
    return Array.isArray(user?.inmobiliarias) ? user.inmobiliarias : [];
};

const InmobiliariaSelfRegistrationPage = () => {
    const navigate = useNavigate();
    const { user, activeInmobiliariaId } = useAuth();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const userInmobiliarias = getUserInmobiliarias(user);
    const hasLinkedInmobiliaria =
        Boolean(activeInmobiliariaId) || userInmobiliarias.length > 0;

    const siteUrl =
        import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const handleSubmit = async (formData, images) => {
        try {
            setLoading(true);
            setError("");

            const inmobiliariaId = await createSelfRegisteredInmobiliaria(formData);

            const imagesToUpload = {
                logo: images?.logo?.file || null,
                backgrounds: {
                    primary: images?.backgrounds?.primary?.file || null,
                    secondary: images?.backgrounds?.secondary?.file || null,
                    tertiary: images?.backgrounds?.tertiary?.file || null,
                },
            };

            const hasImages =
                imagesToUpload.logo ||
                imagesToUpload.backgrounds.primary ||
                imagesToUpload.backgrounds.secondary ||
                imagesToUpload.backgrounds.tertiary;

            if (hasImages) {
                const branding = await uploadInmobiliariaImagesSimplified(
                    inmobiliariaId,
                    imagesToUpload,
                );

                if (Object.keys(branding).length > 0) {
                    await updateInmobiliaria(inmobiliariaId, {
                        branding,
                        updatedAt: new Date().toISOString(),
                    });
                }
            }

            alert(
                "✅ Inmobiliaria creada correctamente. Ya podés operar, aunque quedará pendiente de documentación para validar.",
            );

            navigate("/admin/inmobiliaria");
        } catch (err) {
            console.error("Error en alta autogestionada de inmobiliaria:", err);
            setError(err?.message || "No se pudo crear la inmobiliaria");
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        navigate("/inmobiliarias");
    };

    return (
        <main className="portal-home">
            <SEO
                title="Dar de alta inmobiliaria | ONO Prop"
                description="Creá tu inmobiliaria en ONO Prop para publicar inmuebles, recibir consultas y operar con herramientas comerciales."
                url={`${siteUrl}/inmobiliarias/alta`}
                type="website"
                siteName="ONO Prop"
                noIndex
            />

            <section className="portal-section">
                <div className="container">
                    <div className="mb-4">
                        <Link to="/inmobiliarias" className="btn btn-outline-secondary">
                            ← Volver
                        </Link>
                    </div>

                    {!user && (
                        <div className="row justify-content-center">
                            <div className="col-lg-7">
                                <div className="card border-0 shadow-sm">
                                    <div className="card-body p-4 p-lg-5">
                                        <p className="text-uppercase text-muted small mb-1">
                                            Alta de inmobiliaria
                                        </p>

                                        <h1 className="h3 mb-3">
                                            Primero iniciá sesión o registrate.
                                        </h1>

                                        <p className="text-muted">
                                            Para dar de alta una inmobiliaria necesitamos identificar
                                            al usuario responsable.
                                        </p>

                                        <Login />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {user && hasLinkedInmobiliaria && (
                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4 p-lg-5">
                                <h1 className="h3 mb-3">Ya tenés una inmobiliaria vinculada</h1>

                                <p className="text-muted">
                                    Tu usuario ya está asociado a una inmobiliaria. Podés ingresar
                                    al panel para operar.
                                </p>

                                <div className="d-flex flex-wrap gap-2">
                                    <Link to="/admin/inmobiliaria" className="btn btn-primary">
                                        Ir al panel
                                    </Link>

                                    <Link
                                        to="/inmobiliarias/vincular"
                                        className="btn btn-outline-primary"
                                    >
                                        Solicitar otra vinculación
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {user && !hasLinkedInmobiliaria && (
                        <>
                            <div className="row mb-4">
                                <div className="col-lg-9">
                                    <p className="text-uppercase text-muted small mb-1">
                                        Alta autogestionada
                                    </p>

                                    <h1 className="portal-section-title">
                                        Dar de alta nueva inmobiliaria
                                    </h1>

                                    <p className="lead text-muted">
                                        La inmobiliaria quedará operativa para cargar inmuebles y
                                        gestionar publicaciones. Hasta completar la documentación,
                                        figurará como pendiente de documentación para validar.
                                    </p>
                                </div>
                            </div>

                            <div className="alert alert-warning">
                                <strong>Validación posterior.</strong> Podés comenzar a operar,
                                pero más adelante deberás presentar constancia de inscripción en
                                ARCA y documentación del titular, representante o apoderado.
                            </div>

                            {error && (
                                <div className="alert alert-danger">
                                    {error}
                                </div>
                            )}

                            <div className="card border-0 shadow-sm">
                                <div className="card-body p-3 p-lg-4">
                                    <InmobiliariaForm
                                        initialData={null}
                                        onSubmit={handleSubmit}
                                        onCancel={handleCancel}
                                        loading={loading}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </section>
        </main>
    );
};

export default InmobiliariaSelfRegistrationPage;