export const COMMERCIAL_LEAD_STATUS_OPTIONS = [
    { id: "new", label: "Nuevo", badge: "text-bg-primary" },
    { id: "contacted", label: "Contactado", badge: "text-bg-info" },
    { id: "demo", label: "Demostración", badge: "text-bg-warning" },
    { id: "pilot", label: "Piloto activo", badge: "text-bg-success" },
    { id: "proposal", label: "Propuesta enviada", badge: "text-bg-secondary" },
    { id: "won", label: "Ganado", badge: "text-bg-success" },
    { id: "lost", label: "Perdido", badge: "text-bg-dark" },
];

export const COMMERCIAL_PROPERTY_VOLUME_OPTIONS = [
    { value: "1-20", label: "Hasta 20 propiedades" },
    { value: "21-50", label: "Entre 21 y 50" },
    { value: "51-150", label: "Entre 51 y 150" },
    { value: "151-500", label: "Entre 151 y 500" },
    { value: "500+", label: "Más de 500" },
];

export const COMMERCIAL_PILOT_CHECKLIST = [
    { id: "demoCompleted", label: "Demostración completada" },
    { id: "consortiumSelected", label: "Consorcio real seleccionado" },
    { id: "unitsImported", label: "Unidades y responsables cargados" },
    { id: "firstSettlement", label: "Primera liquidación completada" },
    { id: "portalActivated", label: "Portal de consorcistas activado" },
    { id: "communicationsConfigured", label: "Comunicaciones configuradas" },
    { id: "teamTrained", label: "Equipo capacitado" },
];

const QUALIFICATION_LABELS = {
    currentManagementMethod: {
        spreadsheet: "Planillas",
        manual: "Registros manuales",
        mixed: "Herramientas dispersas",
        software: "Otro sistema",
        starting: "Comienza a administrar",
    },
    mainPain: {
        settlements: "Liquidaciones",
        collections: "Cobranzas y mora",
        communication: "Comunicación",
        documents: "Documentación",
        control: "Control económico",
        migration: "Migración",
    },
    startTiming: {
        now: "Lo antes posible",
        within_30_days: "Dentro de 30 días",
        within_90_days: "Dentro de 3 meses",
        exploring: "Evaluando alternativas",
    },
};

const toSafeMinor = (value) => Math.max(0, Math.trunc(Number(value) || 0));

const roundPercent = (value) => Math.round(value * 10) / 10;

export const getCommercialLeadStatus = (status = "new") => (
    COMMERCIAL_LEAD_STATUS_OPTIONS.find((item) => item.id === status) ||
    { id: status, label: status || "Sin estado", badge: "text-bg-secondary" }
);

export const buildCommercialSource = ({
    href = "",
    pathname = "",
    search = "",
    referrer = "",
} = {}) => {
    let params = new URLSearchParams(search);
    try {
        const url = new URL(href || `https://onoprop.com${pathname}${search}`);
        params = url.searchParams;
        pathname = pathname || url.pathname;
    } catch {
        // Los valores parciales siguen siendo suficientes para atribución básica.
    }
    return {
        path: pathname || "/planes",
        referrer,
        utmSource: params.get("utm_source") || "",
        utmMedium: params.get("utm_medium") || "",
        utmCampaign: params.get("utm_campaign") || "",
        utmContent: params.get("utm_content") || "",
        utmTerm: params.get("utm_term") || "",
    };
};

export const buildCommercialWhatsappUrl = (phone = "", message = "") => {
    const digits = phone.toString().replace(/\D/g, "");
    if (!digits) return "";
    const text = message ? `?text=${encodeURIComponent(message)}` : "";
    return `https://wa.me/${digits}${text}`;
};

export const getCommercialInterestSummary = (lead = {}) => {
    const names = Array.isArray(lead.interestNames)
        ? lead.interestNames.filter(Boolean)
        : [];
    return names.length ? names.join(" · ") : "Demostración general";
};

export const isConsortiumPilotLead = (lead = {}) => (
    lead.commercialOffer?.code === "consortium-pilot-2026" &&
    lead.commercialOffer?.requestType === "pilot"
);

export const getCommercialOfferSummary = (lead = {}) => {
    const offer = lead.commercialOffer;
    if (!offer || offer.code !== "consortium-pilot-2026") return "";
    const request = offer.requestType === "pilot"
        ? "Piloto de 30 días"
        : "Demostración gratuita";
    const units = Number(offer.unitCount || 0) > 0
        ? ` · ${offer.unitCount} unidades`
        : "";
    return `${request}${units}`;
};

export const getCommercialQualification = (lead = {}) => {
    const qualification = lead.qualification || {};
    const score = Math.min(100, Math.max(0, Math.trunc(Number(
        qualification.score || 0,
    ))));
    const level = qualification.level || (
        score >= 70 ? "high" : score >= 45 ? "medium" : "exploratory"
    );
    const display = level === "high"
        ? { label: "Alta prioridad", badge: "text-bg-danger" }
        : level === "medium"
            ? { label: "Prioridad media", badge: "text-bg-warning" }
            : { label: "Exploratorio", badge: "text-bg-light border text-dark" };
    return { ...qualification, score, level, ...display };
};

export const getCommercialQualificationSummary = (lead = {}) => {
    const qualification = lead.qualification || {};
    return [
        qualification.consortiumCount
            ? `${qualification.consortiumCount} consorcios`
            : "",
        QUALIFICATION_LABELS.currentManagementMethod[
            qualification.currentManagementMethod
        ] || "",
        QUALIFICATION_LABELS.mainPain[qualification.mainPain] || "",
        QUALIFICATION_LABELS.startTiming[qualification.startTiming] || "",
    ].filter(Boolean).join(" · ");
};

export const getCommercialLeadMonthlyRevenueMinor = (lead = {}) => (
    toSafeMinor(lead.commercialEconomics?.monthlyRevenueMinor) ||
    toSafeMinor(lead.commercialOffer?.estimatedMonthlyAmountMinor)
);

export const buildCommercialFunnelMetrics = (leads = []) => {
    const safeLeads = Array.isArray(leads) ? leads : [];
    const demoStatuses = new Set(["demo", "pilot", "proposal", "won"]);
    const pilotStatuses = new Set(["pilot", "won"]);
    const total = safeLeads.length;
    const demos = safeLeads.filter((lead) => demoStatuses.has(lead.status)).length;
    const pilots = safeLeads.filter((lead) => pilotStatuses.has(lead.status)).length;
    const won = safeLeads.filter((lead) => lead.status === "won").length;
    const lost = safeLeads.filter((lead) => lead.status === "lost").length;
    const open = total - won - lost;
    const highPriority = safeLeads.filter(
        (lead) => getCommercialQualification(lead).score >= 70,
    ).length;
    const sumRevenue = (items) => items.reduce(
        (totalMinor, lead) => totalMinor + getCommercialLeadMonthlyRevenueMinor(lead),
        0,
    );

    return {
        total,
        open,
        demos,
        pilots,
        won,
        lost,
        highPriority,
        estimatedOpenMrrMinor: sumRevenue(safeLeads.filter(
            (lead) => !["won", "lost"].includes(lead.status),
        )),
        wonMrrMinor: sumRevenue(safeLeads.filter((lead) => lead.status === "won")),
        leadToDemoPercent: total ? roundPercent((demos / total) * 100) : 0,
        leadToPilotPercent: total ? roundPercent((pilots / total) * 100) : 0,
        leadToWonPercent: total ? roundPercent((won / total) * 100) : 0,
    };
};

export const calculateCommercialUnitEconomics = (economics = {}) => {
    const monthlyRevenueMinor = toSafeMinor(economics.monthlyRevenueMinor);
    const monthlyCostMinor = toSafeMinor(economics.monthlyCostMinor);
    const onboardingCostMinor = toSafeMinor(economics.onboardingCostMinor);
    const setupFeeMinor = toSafeMinor(economics.setupFeeMinor);
    const acquisitionCostMinor = toSafeMinor(economics.acquisitionCostMinor);
    const monthlyGrossProfitMinor = monthlyRevenueMinor - monthlyCostMinor;
    const initialInvestmentMinor = acquisitionCostMinor + Math.max(
        0,
        onboardingCostMinor - setupFeeMinor,
    );
    return {
        monthlyRevenueMinor,
        monthlyCostMinor,
        monthlyGrossProfitMinor,
        grossMarginPercent: monthlyRevenueMinor
            ? roundPercent((monthlyGrossProfitMinor / monthlyRevenueMinor) * 100)
            : 0,
        initialInvestmentMinor,
        paybackMonths: monthlyGrossProfitMinor > 0
            ? Math.ceil((initialInvestmentMinor / monthlyGrossProfitMinor) * 10) / 10
            : null,
    };
};

export const getCommercialChecklistProgress = (checklist = {}) => {
    const completed = COMMERCIAL_PILOT_CHECKLIST.filter(
        (item) => checklist?.[item.id] === true,
    ).length;
    const total = COMMERCIAL_PILOT_CHECKLIST.length;
    return {
        completed,
        total,
        percent: total ? Math.round((completed / total) * 100) : 0,
    };
};

export const commercialMoneyInputToMinor = (value) => {
    const normalized = value?.toString?.().trim().replace(",", ".") || "";
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
};
