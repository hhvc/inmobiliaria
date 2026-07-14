import { useDomainAgency } from "../inmobiliaria/context/useDomainAgency";
import InmobiliariaPublicPage from "../inmobiliaria/pages/InmobiliariaPublicPage";
import { isPortalBaseDomain } from "../inmobiliaria/utils/domainRouting";
import HomePage from "./HomePage";

const PublicHomeRoute = () => {
    const { loading, slug } = useDomainAgency();

    const isBaseDomain = isPortalBaseDomain();

    /*
      Dominios base del portal:
      - inmobiliaria-bcc63.web.app
      - inmobiliaria-bcc63.firebaseapp.com
      - onoprop.com
      - www.onoprop.com
  
      En esos casos SIEMPRE mostramos el portal principal,
      aunque el provider todavía esté cargando o haya devuelto algo.
    */
    if (isBaseDomain) {
        return <HomePage />;
    }

    /*
      Si NO es dominio base, entonces puede ser un dominio propio
      de inmobiliaria, por ejemplo:
      - ladoctaprop.com.ar
    */
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

    /*
      Fallback: si el dominio externo no pudo resolverse
      como inmobiliaria, mostramos el portal principal.
    */
    return <HomePage />;
};

export default PublicHomeRoute;