import { Navigate, useLocation } from "react-router-dom";

import Login from "../components/auth/Login";
import SEO from "../components/SEO";
import { useAuth } from "../context/auth/useAuth";

const LoginPage = () => {
    const { user } = useAuth();
    const location = useLocation();

    const siteUrl =
        import.meta.env.VITE_PUBLIC_SITE_URL || "https://onoprop.com";

    const redirectTo = location.state?.from?.pathname || "/publicar";

    if (user) {
        return <Navigate to={redirectTo} replace />;
    }

    return (
        <main className="portal-home">
            <SEO
                title="Iniciar sesión | ONO Prop"
                description="Iniciá sesión para publicar propiedades, administrar consultas o acceder a tu panel en ONO Prop."
                url={`${siteUrl}/login`}
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
                                        Acceso requerido
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
                                        La solicitud no publica automáticamente el inmueble. Primero
                                        se revisa la información y luego se coordina cómo avanzar.
                                    </div>

                                    <div className="border rounded-3 p-3 p-md-4 bg-light">
                                        <Login />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default LoginPage;