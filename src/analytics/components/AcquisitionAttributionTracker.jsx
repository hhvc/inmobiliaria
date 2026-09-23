import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import {
    captureAcquisitionAttribution,
    getActiveAcquisitionAttribution,
    recordAcquisitionConversion,
} from "../services/acquisitionAttribution.service";

const getRouteEvent = (pathname, attribution = {}) => {
    if (pathname === "/publicar") return "publication_started";
    if (pathname === "/inmobiliarias/alta") return "agency_onboarding_started";
    if (pathname === "/contacto" && attribution.content === "solicitar_tasacion") {
        return "appraisal_request_started";
    }
    if ([
        "/software-para-inmobiliarias",
        "/software-administracion-consorcios",
        "/planes",
    ].includes(pathname)) {
        return "commercial_interest_started";
    }
    return "";
};

const AcquisitionAttributionTracker = () => {
    const location = useLocation();

    useEffect(() => {
        captureAcquisitionAttribution({
            search: location.search,
            pathname: location.pathname,
        });
        const attribution = getActiveAcquisitionAttribution();
        const eventType = getRouteEvent(location.pathname, attribution || {});
        if (eventType) {
            recordAcquisitionConversion(eventType, {
                dedupeKey: "journey:start",
            });
        }
    }, [location.pathname, location.search]);

    return null;
};

export default AcquisitionAttributionTracker;
