import { getAgencySlugFromDomain } from "../inmobiliaria/utils/domainRouting";
import InmobiliariaPublicPage from "../inmobiliaria/pages/InmobiliariaPublicPage";
import HomePage from "./HomePage";

const PublicHomeRoute = () => {
    const agencySlug = getAgencySlugFromDomain();

    if (agencySlug) {
        return <InmobiliariaPublicPage />;
    }

    return <HomePage />;
};

export default PublicHomeRoute;