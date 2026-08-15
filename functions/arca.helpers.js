import crypto from "node:crypto";

import { XMLParser } from "fast-xml-parser";

export const ARCA_RECEIVER_IVA_CONDITIONS = [
    {id: 1, label: "IVA Responsable Inscripto"},
    {id: 4, label: "IVA Sujeto Exento"},
    {id: 5, label: "Consumidor Final"},
    {id: 6, label: "Responsable Monotributo"},
    {id: 7, label: "Sujeto No Categorizado"},
    {id: 8, label: "Proveedor del Exterior"},
    {id: 9, label: "Cliente del Exterior"},
    {id: 10, label: "IVA Liberado – Ley 19.640"},
    {id: 13, label: "Monotributista Social"},
    {id: 15, label: "IVA No Alcanzado"},
    {id: 16, label: "Monotributo Trabajador Independiente Promovido"},
];

const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
});

const asArray = (value) => {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
};

const cleanDigits = (value = "") => value.toString().replace(/\D/g, "");

export const normalizeArcaCuit = (value = "") => cleanDigits(value).slice(0, 11);

export const isValidArcaCuit = (value = "") => {
    const cuit = normalizeArcaCuit(value);
    if (!/^\d{11}$/.test(cuit)) return false;
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => (
        total + Number(cuit[index]) * weight
    ), 0);
    const result = 11 - (sum % 11);
    const verifier = result === 11 ? 0 : result === 10 ? 9 : result;
    return verifier === Number(cuit[10]);
};

export const escapeArcaXml = (value = "") => value.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const decodeXmlEntities = (value = "") => value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

export const dateKeyToArca = (value = "") => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? `${match[1]}${match[2]}${match[3]}` : "";
};

const dateKeyToUtcTime = (value = "") => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(time) ? null : time;
};

export const arcaDateToKey = (value = "") => {
    const digits = cleanDigits(value);
    return /^\d{8}$/.test(digits)
        ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
        : "";
};

export const minorToArcaAmount = (amountMinor = 0) => (
    (Math.round(Number(amountMinor) || 0) / 100).toFixed(2)
);

export const createArcaRequestId = ({
    issuerProfileId,
    pointOfSale,
    voucherType,
    obligationId,
    environment = "homo",
} = {}) => {
    const parts = [issuerProfileId, pointOfSale, voucherType, obligationId];
    // Conserva las claves históricas de homologación y separa Producción.
    if (environment !== "homo") parts.push(environment);
    return crypto.createHash("sha256").update(parts.join("|"))
        .digest("hex").slice(0, 32);
};

export const createArcaCredentialTicketId = ({
    environment,
    credentialAlias,
    service,
} = {}) => crypto.createHash("sha256").update([
    environment?.toString?.().trim() || "",
    credentialAlias?.toString?.().trim() || "",
    service?.toString?.().trim() || "",
].join("|")).digest("hex").slice(0, 32);

export const getArcaAuthorizationMode = ({
    credentialOwnerCuit,
    representedCuit,
} = {}) => (
    normalizeArcaCuit(credentialOwnerCuit) === normalizeArcaCuit(representedCuit) ?
        "certificate_owner" : "platform_delegation"
);

export const buildWsaaTra = ({
    service = "wsfe",
    uniqueId = Math.floor(Date.now() / 1000),
    now = new Date(),
} = {}) => {
    const generationTime = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const expirationTime = new Date(now.getTime() + 11 * 60 * 60 * 1000).toISOString();
    return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Number(uniqueId)}</uniqueId>
    <generationTime>${generationTime}</generationTime>
    <expirationTime>${expirationTime}</expirationTime>
  </header>
  <service>${escapeArcaXml(service)}</service>
</loginTicketRequest>`;
};

export const buildWsaaLoginCmsEnvelope = (cmsBase64) => `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.afip.gov.ar/">
  <soapenv:Header/>
  <soapenv:Body><wsaa:loginCms><wsaa:in0>${escapeArcaXml(cmsBase64)}</wsaa:in0></wsaa:loginCms></soapenv:Body>
</soapenv:Envelope>`;

export const parseArcaSoapFault = (xml = "") => {
    try {
        const parsed = parser.parse(xml);
        const body = parsed?.Envelope?.Body || parsed?.Body || {};
        const fault = body.Fault;
        if (!fault) return null;
        return {
            code: (fault.faultcode || fault.Code?.Value || "ARCA_SOAP_FAULT").toString(),
            message: (
                fault.faultstring ||
                fault.Reason?.Text ||
                "ARCA devolvió un error SOAP."
            ).toString(),
        };
    } catch {
        return null;
    }
};

const parseSoap = (xml) => {
    const parsed = parser.parse(xml);
    const body = parsed?.Envelope?.Body || parsed?.Body || {};
    const fault = parseArcaSoapFault(xml);
    if (fault) {
        const error = new Error(fault.message);
        error.code = fault.code;
        throw error;
    }
    return body;
};

export const parseWsaaLoginTicket = (soapXml) => {
    const body = parseSoap(soapXml);
    const encoded = body.loginCmsResponse?.loginCmsReturn;
    if (!encoded) throw new Error("WSAA no devolvió el ticket de acceso.");
    const inner = parser.parse(decodeXmlEntities(encoded));
    const response = inner.loginTicketResponse || inner;
    const credentials = response.credentials || {};
    const expirationTime = response.header?.expirationTime || "";
    if (!credentials.token || !credentials.sign || !expirationTime) {
        throw new Error("El ticket WSAA no contiene credenciales completas.");
    }
    return {
        token: credentials.token.toString(),
        sign: credentials.sign.toString(),
        expirationTime: new Date(expirationTime).toISOString(),
    };
};

const authXml = ({token, sign, issuerCuit}) => `<ar:Auth>
  <ar:Token>${escapeArcaXml(token)}</ar:Token>
  <ar:Sign>${escapeArcaXml(sign)}</ar:Sign>
  <ar:Cuit>${escapeArcaXml(normalizeArcaCuit(issuerCuit))}</ar:Cuit>
</ar:Auth>`;

const wsfeEnvelope = (method, body) => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body><ar:${method} xmlns:ar="http://ar.gov.afip.dif.FEV1/">${body}</ar:${method}></soap:Body>
</soap:Envelope>`;

const registryEnvelope = (method, body = "") => `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="http://a5.soap.ws.server.puc.sr/">
  <soapenv:Header/>
  <soapenv:Body><a5:${method}>${body}</a5:${method}></soapenv:Body>
</soapenv:Envelope>`;

const cleanArcaText = (value = "") => (
    value?.toString?.().trim().replace(/\s+/g, " ") || ""
);

const normalizeRegistryActivity = (value = {}) => ({
    id: cleanArcaText(value.idActividad),
    description: cleanArcaText(value.descripcionActividad),
    nomenclator: cleanArcaText(value.nomenclador),
    order: Number(value.orden) || 0,
    period: cleanArcaText(value.periodo),
});

export const buildProductionConfirmationText = ({
    pointOfSale,
    proposedVoucherNumber,
    voucherType = 11,
} = {}) => {
    const normalizedPointOfSale = Math.max(0, Math.trunc(Number(pointOfSale) || 0));
    const normalizedVoucherNumber = Math.max(
        0,
        Math.trunc(Number(proposedVoucherNumber) || 0),
    );
    if (!normalizedPointOfSale || !normalizedVoucherNumber) return "";
    const prefix = Number(voucherType) === 13 ? "EMITIR NC" : "EMITIR";
    return `${prefix} ${normalizedPointOfSale}-${normalizedVoucherNumber}`;
};

export const buildProductionActivationConfirmationText = ({
    issuerCuit,
    pointOfSale,
} = {}) => {
    const normalizedCuit = normalizeArcaCuit(issuerCuit);
    const normalizedPointOfSale = Math.max(0, Math.trunc(Number(pointOfSale) || 0));
    if (!isValidArcaCuit(normalizedCuit) || !normalizedPointOfSale) return "";
    return `HABILITAR ${normalizedCuit} PV ${normalizedPointOfSale}`;
};

const normalizeRegistryTax = (value = {}) => ({
    id: cleanArcaText(value.idImpuesto),
    description: cleanArcaText(value.descripcionImpuesto),
    status: cleanArcaText(value.estadoImpuesto),
    reason: cleanArcaText(value.motivo),
    period: cleanArcaText(value.periodo),
});

const formatRegistryAddress = (value = {}) => {
    const parts = [
        cleanArcaText(value.direccion),
        [cleanArcaText(value.tipoDatoAdicional), cleanArcaText(value.datoAdicional)]
            .filter(Boolean).join(": "),
        cleanArcaText(value.localidad),
        cleanArcaText(value.descripcionProvincia),
        cleanArcaText(value.codPostal) ? `CP ${cleanArcaText(value.codPostal)}` : "",
    ].filter(Boolean);
    return parts.filter((part, index) => (
        parts.findIndex((candidate) => candidate.toLocaleUpperCase("es-AR") ===
            part.toLocaleUpperCase("es-AR")) === index
    )).join(", ");
};

const earliestActivityPeriod = (activities = []) => activities
    .map((item) => cleanDigits(item.period))
    .filter((period) => /^\d{6}(?:\d{2})?$/.test(period))
    .sort()[0] || "";

export const buildWsfeDummyRequest = () => wsfeEnvelope("FEDummy", "");

export const buildArcaRegistrationRequest = ({
    token,
    sign,
    representedCuit,
    personCuit,
} = {}) => registryEnvelope("getPersona_v2", `
    <token>${escapeArcaXml(token)}</token>
    <sign>${escapeArcaXml(sign)}</sign>
    <cuitRepresentada>${escapeArcaXml(normalizeArcaCuit(representedCuit))}</cuitRepresentada>
    <idPersona>${escapeArcaXml(normalizeArcaCuit(personCuit))}</idPersona>
  `);

export const parseArcaRegistrationResponse = (xml = "") => {
    const body = parseSoap(xml);
    const result = body.getPersona_v2Response?.personaReturn;
    if (!result) throw new Error("Constancia de Inscripción no devolvió datos.");

    const general = result.datosGenerales || {};
    const monotributo = result.datosMonotributo || {};
    const generalRegime = result.datosRegimenGeneral || {};
    const errors = [
        ...asArray(result.errorConstancia?.error),
        ...asArray(result.errorMonotributo?.error),
        result.errorMonotributo?.mensaje,
        ...asArray(result.errorRegimenGeneral?.error),
        result.errorRegimenGeneral?.mensaje,
    ].map(cleanArcaText).filter(Boolean);

    if (!general.idPersona && errors.length) {
        throw new Error(errors.join(" "));
    }

    const activities = [
        ...asArray(generalRegime.actividad),
        ...asArray(monotributo.actividad),
        ...asArray(monotributo.actividadMonotributista),
    ].map(normalizeRegistryActivity).filter((item) => item.id || item.description);
    const uniqueActivities = activities.filter((item, index) => (
        activities.findIndex((candidate) => (
            `${candidate.id}|${candidate.period}|${candidate.description}` ===
            `${item.id}|${item.period}|${item.description}`
        )) === index
    )).sort((a, b) => (a.order || 999) - (b.order || 999));
    const taxes = [
        ...asArray(generalRegime.impuesto),
        ...asArray(monotributo.impuesto),
    ].map(normalizeRegistryTax).filter((item) => item.id || item.description);
    const uniqueTaxes = taxes.filter((item, index) => (
        taxes.findIndex((candidate) => (
            `${candidate.id}|${candidate.period}|${candidate.description}` ===
            `${item.id}|${item.period}|${item.description}`
        )) === index
    ));
    const fiscalAddress = general.domicilioFiscal || {};
    const legalName = cleanArcaText(general.razonSocial) || [
        cleanArcaText(general.apellido),
        cleanArcaText(general.nombre),
    ].filter(Boolean).join(" ");
    const category = monotributo.categoriaMonotributo || {};
    const hasMonotributo = Boolean(
        category.idCategoria ||
        category.descripcionCategoria ||
        uniqueTaxes.some((item) => /monotribut/i.test(item.description)),
    );

    return {
        personCuit: normalizeArcaCuit(general.idPersona),
        personType: cleanArcaText(general.tipoPersona),
        taxIdStatus: cleanArcaText(general.estadoClave),
        legalName,
        fiscalAddress: {
            type: cleanArcaText(fiscalAddress.tipoDomicilio),
            street: cleanArcaText(fiscalAddress.direccion),
            locality: cleanArcaText(fiscalAddress.localidad),
            province: cleanArcaText(fiscalAddress.descripcionProvincia),
            postalCode: cleanArcaText(fiscalAddress.codPostal),
            additionalType: cleanArcaText(fiscalAddress.tipoDatoAdicional),
            additionalValue: cleanArcaText(fiscalAddress.datoAdicional),
            formatted: formatRegistryAddress(fiscalAddress),
        },
        monotributo: {
            registered: hasMonotributo,
            categoryId: cleanArcaText(category.idCategoria),
            categoryDescription: cleanArcaText(category.descripcionCategoria),
            period: cleanArcaText(category.periodo),
        },
        activities: uniqueActivities,
        taxes: uniqueTaxes,
        earliestActivityPeriod: earliestActivityPeriod(uniqueActivities),
        warnings: [...new Set(errors)],
        metadata: {
            processedAt: cleanArcaText(result.metadata?.fechaHora),
        },
    };
};

export const buildWsfePointsOfSaleRequest = (auth) => wsfeEnvelope(
    "FEParamGetPtosVenta",
    authXml(auth),
);

export const buildWsfeLastAuthorizedRequest = ({
    token,
    sign,
    issuerCuit,
    pointOfSale,
    voucherType,
}) => wsfeEnvelope("FECompUltimoAutorizado", `${authXml({token, sign, issuerCuit})}
<ar:PtoVta>${Number(pointOfSale)}</ar:PtoVta><ar:CbteTipo>${Number(voucherType)}</ar:CbteTipo>`);

export const buildWsfeVoucherQueryRequest = ({
    token,
    sign,
    issuerCuit,
    pointOfSale,
    voucherType,
    voucherNumber,
}) => wsfeEnvelope("FECompConsultar", `${authXml({token, sign, issuerCuit})}
<ar:FeCompConsReq><ar:CbteTipo>${Number(voucherType)}</ar:CbteTipo><ar:CbteNro>${Number(voucherNumber)}</ar:CbteNro><ar:PtoVta>${Number(pointOfSale)}</ar:PtoVta></ar:FeCompConsReq>`);

export const validateArcaInvoiceDraft = (draft = {}, {
    requestDateKey = "",
    allowedEnvironments = ["homo"],
} = {}) => {
    const errors = [];
    if (!allowedEnvironments.includes(draft.environment)) {
        errors.push("El ambiente fiscal no está habilitado para esta operación.");
    }
    const voucherType = Number(draft.voucherType);
    if (![11, 13].includes(voucherType)) {
        errors.push("Esta etapa admite únicamente Factura C o Nota de Crédito C.");
    }
    if (!(Number(draft.pointOfSale) > 0)) errors.push("Configurá el punto de venta WSFE.");
    if (!isValidArcaCuit(draft.issuerCuit)) errors.push("El CUIT emisor no es válido.");
    if (![80, 96, 99].includes(Number(draft.recipient?.documentType))) {
        errors.push("El tipo de documento del receptor no está admitido.");
    }
    const documentNumber = cleanDigits(draft.recipient?.documentNumber);
    if (documentNumber && documentNumber === cleanDigits(draft.issuerCuit)) {
        errors.push("El documento del receptor no puede ser igual al CUIT emisor.");
    }
    if (Number(draft.recipient?.documentType) === 80 && !isValidArcaCuit(documentNumber)) {
        errors.push("El CUIT del receptor no es válido.");
    }
    if (Number(draft.recipient?.documentType) === 96 && !/^\d{7,8}$/.test(documentNumber)) {
        errors.push("El DNI del receptor no es válido.");
    }
    if (Number(draft.recipient?.documentType) === 99 && documentNumber !== "0") {
        errors.push("Consumidor final sin documento debe informarse con número 0.");
    }
    if (!ARCA_RECEIVER_IVA_CONDITIONS.some((item) => item.id === Number(draft.recipient?.ivaConditionId))) {
        errors.push("Seleccioná la condición frente al IVA del receptor.");
    }
    if (!(Number(draft.amountMinor) > 0)) errors.push("El importe debe ser mayor a cero.");
    if (voucherType === 13) {
        const associated = draft.associatedVoucher || {};
        if (Number(associated.voucherType) !== 11 ||
            !(Number(associated.pointOfSale) > 0) ||
            !(Number(associated.voucherNumber) > 0)) {
            errors.push("La Nota de Crédito C debe asociarse a una Factura C autorizada.");
        }
        if (Number(associated.amountMinor) > 0 &&
            Number(draft.amountMinor) > Number(associated.amountMinor)) {
            errors.push("La Nota de Crédito no puede superar el importe de la factura asociada.");
        }
    }
    if (draft.currency !== "ARS") errors.push("Esta etapa admite únicamente pesos argentinos.");
    const invoiceTime = dateKeyToUtcTime(draft.invoiceDate);
    const requestTime = dateKeyToUtcTime(requestDateKey);
    if (invoiceTime === null) {
        errors.push("La fecha del comprobante no es válida.");
    } else if (requestTime !== null) {
        const differenceDays = Math.round((invoiceTime - requestTime) / 86400000);
        if (differenceDays < -10 || differenceDays > 10) {
            errors.push(
                "Para servicios, la fecha del comprobante debe estar entre " +
                "10 días antes y 10 días después de la solicitud a ARCA.",
            );
        }
    }
    if (!dateKeyToArca(draft.serviceFrom) || !dateKeyToArca(draft.serviceTo)) {
        errors.push("Informá el período del servicio.");
    } else if (draft.serviceFrom > draft.serviceTo) {
        errors.push("La fecha inicial del servicio no puede ser posterior a la final.");
    }
    if (!dateKeyToArca(draft.paymentDueDate)) {
        errors.push("La fecha de vencimiento no es válida.");
    } else if (invoiceTime !== null && draft.paymentDueDate < draft.invoiceDate) {
        errors.push("El vencimiento para el pago no puede ser anterior al comprobante.");
    }
    return errors;
};

export const buildWsfeCaeRequest = ({
    draft,
    token,
    sign,
    voucherNumber,
    requestDateKey = "",
}) => {
    const errors = validateArcaInvoiceDraft(draft, {
        requestDateKey,
        allowedEnvironments: draft.environment === "prod" ? ["prod"] : ["homo"],
    });
    if (errors.length) throw new Error(errors.join(" "));
    const amount = minorToArcaAmount(draft.amountMinor);
    const documentNumber = cleanDigits(draft.recipient.documentNumber) || "0";
    const voucherType = Number(draft.voucherType);
    const associatedXml = voucherType === 13 ? `
    <ar:CbtesAsoc><ar:CbteAsoc><ar:Tipo>${Number(draft.associatedVoucher.voucherType)}</ar:Tipo><ar:PtoVta>${Number(draft.associatedVoucher.pointOfSale)}</ar:PtoVta><ar:Nro>${Number(draft.associatedVoucher.voucherNumber)}</ar:Nro></ar:CbteAsoc></ar:CbtesAsoc>` : "";
    return wsfeEnvelope("FECAESolicitar", `${authXml({
        token,
        sign,
        issuerCuit: draft.issuerCuit,
    })}
<ar:FeCAEReq>
  <ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${Number(draft.pointOfSale)}</ar:PtoVta><ar:CbteTipo>${voucherType}</ar:CbteTipo></ar:FeCabReq>
  <ar:FeDetReq><ar:FECAEDetRequest>
    <ar:Concepto>2</ar:Concepto><ar:DocTipo>${Number(draft.recipient.documentType)}</ar:DocTipo><ar:DocNro>${documentNumber}</ar:DocNro>
    <ar:CbteDesde>${Number(voucherNumber)}</ar:CbteDesde><ar:CbteHasta>${Number(voucherNumber)}</ar:CbteHasta><ar:CbteFch>${dateKeyToArca(draft.invoiceDate)}</ar:CbteFch>
    <ar:ImpTotal>${amount}</ar:ImpTotal><ar:ImpTotConc>0.00</ar:ImpTotConc><ar:ImpNeto>${amount}</ar:ImpNeto><ar:ImpOpEx>0.00</ar:ImpOpEx><ar:ImpIVA>0.00</ar:ImpIVA><ar:ImpTrib>0.00</ar:ImpTrib>
    <ar:FchServDesde>${dateKeyToArca(draft.serviceFrom)}</ar:FchServDesde><ar:FchServHasta>${dateKeyToArca(draft.serviceTo)}</ar:FchServHasta><ar:FchVtoPago>${dateKeyToArca(draft.paymentDueDate)}</ar:FchVtoPago>${associatedXml}
    <ar:MonId>PES</ar:MonId><ar:MonCotiz>1.000000</ar:MonCotiz><ar:CondicionIVAReceptorId>${Number(draft.recipient.ivaConditionId)}</ar:CondicionIVAReceptorId>
  </ar:FECAEDetRequest></ar:FeDetReq>
</ar:FeCAEReq>`);
};

const collectErrors = (container) => asArray(container?.Err || container?.Obs)
    .filter(Boolean)
    .map((item) => ({
        code: Number(item.Code || 0),
        message: (item.Msg || "").toString(),
    }));

export const parseWsfeDummyResponse = (xml) => {
    const body = parseSoap(xml);
    const result = body.FEDummyResponse?.FEDummyResult;
    if (!result) throw new Error("WSFE no devolvió el estado del servicio.");
    return {
        appServer: result.AppServer || "",
        dbServer: result.DbServer || "",
        authServer: result.AuthServer || "",
        healthy: [result.AppServer, result.DbServer, result.AuthServer]
            .every((value) => value === "OK"),
    };
};

export const parseWsfePointsOfSaleResponse = (xml) => {
    const body = parseSoap(xml);
    const result = body.FEParamGetPtosVentaResponse?.FEParamGetPtosVentaResult;
    if (!result) throw new Error("WSFE no devolvió puntos de venta.");
    const errors = collectErrors(result.Errors);
    const blockingErrors = errors.filter((item) => item.code !== 602);
    if (blockingErrors.length) {
        throw new Error(blockingErrors
            .map((item) => `${item.code}: ${item.message}`).join(" · "));
    }
    if (errors.some((item) => item.code === 602)) return [];
    return asArray(result.ResultGet?.PtoVenta).map((item) => ({
        number: Number(item.Nro || 0),
        emissionType: item.EmisionTipo || "",
        blocked: item.Bloqueado === "S",
        dropDate: arcaDateToKey(item.FchBaja || ""),
    })).filter((item) => item.number > 0);
};

export const parseWsfeLastAuthorizedResponse = (xml) => {
    const body = parseSoap(xml);
    const result = body.FECompUltimoAutorizadoResponse?.FECompUltimoAutorizadoResult;
    if (!result) throw new Error("WSFE no devolvió la numeración del punto de venta.");
    const errors = collectErrors(result.Errors);
    if (errors.length) throw new Error(errors.map((item) => `${item.code}: ${item.message}`).join(" · "));
    return Number(result.CbteNro || 0);
};

const normalizeAuthorizedVoucher = (result = {}) => ({
    result: result.Resultado || "",
    cae: (result.CodAutorizacion || result.CAE || "").toString(),
    caeExpirationDate: arcaDateToKey(result.FchVto || result.CAEFchVto || ""),
    voucherNumber: Number(result.CbteDesde || result.CbteHasta || result.CbteNro || 0),
    voucherDate: arcaDateToKey(result.CbteFch || ""),
    observations: collectErrors(result.Observaciones),
});

export const parseWsfeCaeResponse = (xml) => {
    const body = parseSoap(xml);
    const result = body.FECAESolicitarResponse?.FECAESolicitarResult;
    if (!result) throw new Error("WSFE no devolvió el resultado de autorización.");
    const detail = asArray(result.FeDetResp?.FECAEDetResponse)[0] || {};
    return {
        ...normalizeAuthorizedVoucher(detail),
        processDate: result.FeCabResp?.FchProceso || "",
        errors: collectErrors(result.Errors),
    };
};

export const parseWsfeVoucherQueryResponse = (xml) => {
    const body = parseSoap(xml);
    const result = body.FECompConsultarResponse?.FECompConsultarResult;
    if (!result) return null;
    const errors = collectErrors(result.Errors);
    if (errors.some((item) => [602, 10016].includes(item.code))) return null;
    if (errors.length && !result.ResultGet) {
        throw new Error(errors.map((item) => `${item.code}: ${item.message}`).join(" · "));
    }
    return result.ResultGet ? normalizeAuthorizedVoucher(result.ResultGet) : null;
};
