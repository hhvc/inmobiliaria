import { useDomainAgency } from "../inmobiliaria/context/useDomainAgency";
import InmobiliariaPublicPage from "../inmobiliaria/pages/InmobiliariaPublicPage";
import HomePage from "./HomePage";

const PublicHomeRoute = () => {
    const { loading, slug } = useDomainAgency();

    if (loading) {
        return (
            <main className="portal-home">
                <div className="container py-5">
                    <div className="alert alert-light border">
                        Cargando sitio de inmobiliaria...
                    </div>
                </div>
            </main>
        );
    }

    if (slug) {
        return <InmobiliariaPublicPage forcedSlug={slug} />;
    }

    return <HomePage />;
};

export default PublicHomeRoute;