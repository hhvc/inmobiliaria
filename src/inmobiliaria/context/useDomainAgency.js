import { createContext, useContext } from "react";

export const DomainAgencyContext = createContext({
    hostname: "",
    loading: false,
    error: null,
    inmobiliaria: null,
    slug: null,
    isAgencyDomain: false,
});

export const useDomainAgency = () => useContext(DomainAgencyContext);