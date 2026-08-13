import assert from "node:assert/strict";
import test from "node:test";

import {
    buildArcaRegistrationRequest,
    buildProductionActivationConfirmationText,
    buildProductionConfirmationText,
    buildWsaaTra,
    buildWsfeCaeRequest,
    createArcaRequestId,
    isValidArcaCuit,
    parseArcaSoapFault,
    parseArcaRegistrationResponse,
    parseWsaaLoginTicket,
    parseWsfeCaeResponse,
    parseWsfePointsOfSaleResponse,
    validateArcaInvoiceDraft,
} from "./arca.helpers.js";

const issuerCuit = "20253006219";

const validDraft = {
    environment: "homo",
    voucherType: 11,
    pointOfSale: 3,
    issuerCuit,
    recipient: {
        documentType: 99,
        documentNumber: "0",
        ivaConditionId: 5,
    },
    amountMinor: 1000000,
    currency: "ARS",
    invoiceDate: "2026-08-06",
    serviceFrom: "2026-08-01",
    serviceTo: "2026-08-31",
    paymentDueDate: "2026-08-10",
};

test("valida el CUIT completo y no solo su longitud", () => {
    assert.equal(isValidArcaCuit(issuerCuit), true);
    assert.equal(isValidArcaCuit("20253006218"), false);
});

test("genera un TRA acotado al servicio wsfe", () => {
    const xml = buildWsaaTra({
        service: "wsfe",
        uniqueId: 123,
        now: new Date("2026-08-06T12:00:00.000Z"),
    });
    assert.match(xml, /<uniqueId>123<\/uniqueId>/);
    assert.match(xml, /<service>wsfe<\/service>/);
    assert.match(xml, /2026-08-06T11:55:00.000Z/);
    assert.match(xml, /2026-08-06T23:00:00.000Z/);
});

test("interpreta el ticket devuelto por WSAA", () => {
    const inner = `&lt;loginTicketResponse&gt;&lt;header&gt;&lt;expirationTime&gt;2026-08-06T23:00:00.000Z&lt;/expirationTime&gt;&lt;/header&gt;&lt;credentials&gt;&lt;token&gt;TOKEN&lt;/token&gt;&lt;sign&gt;SIGN&lt;/sign&gt;&lt;/credentials&gt;&lt;/loginTicketResponse&gt;`;
    const soap = `<soap:Envelope xmlns:soap="x"><soap:Body><loginCmsResponse><loginCmsReturn>${inner}</loginCmsReturn></loginCmsResponse></soap:Body></soap:Envelope>`;
    assert.deepEqual(parseWsaaLoginTicket(soap), {
        token: "TOKEN",
        sign: "SIGN",
        expirationTime: "2026-08-06T23:00:00.000Z",
    });
});

test("construye la consulta de constancia sin exponer XML inválido", () => {
    const xml = buildArcaRegistrationRequest({
        token: "token&privado",
        sign: "firma<privada",
        representedCuit: issuerCuit,
        personCuit: "20164755100",
    });
    assert.match(xml, /<a5:getPersona_v2>/);
    assert.match(xml, /<cuitRepresentada>20253006219<\/cuitRepresentada>/);
    assert.match(xml, /<idPersona>20164755100<\/idPersona>/);
    assert.match(xml, /token&amp;privado/);
    assert.match(xml, /firma&lt;privada/);
});

test("normaliza la constancia y conserva domicilio, impuestos y actividades", () => {
    const xml = `<soap:Envelope><soap:Body><getPersona_v2Response><personaReturn>
      <datosGenerales><apellido>VAZQUEZ CUESTAS</apellido><nombre>HECTOR</nombre>
        <estadoClave>ACTIVO</estadoClave><idPersona>${issuerCuit}</idPersona><tipoPersona>FISICA</tipoPersona>
        <domicilioFiscal><codPostal>5000</codPostal><datoAdicional>LOS MANANTIALES</datoAdicional><descripcionProvincia>CORDOBA</descripcionProvincia><direccion>PUBLICA MZA 28 CASA 27</direccion><localidad>CORDOBA</localidad><tipoDatoAdicional>BARRIO</tipoDatoAdicional><tipoDomicilio>FISCAL</tipoDomicilio></domicilioFiscal>
      </datosGenerales>
      <datosMonotributo><actividad><descripcionActividad>SERVICIOS ADMINISTRATIVOS</descripcionActividad><idActividad>821100</idActividad><orden>1</orden><periodo>202507</periodo></actividad><categoriaMonotributo><descripcionCategoria>CATEGORIA A</descripcionCategoria><idCategoria>10</idCategoria><periodo>202507</periodo></categoriaMonotributo></datosMonotributo>
      <datosRegimenGeneral><impuesto><descripcionImpuesto>IVA</descripcionImpuesto><estadoImpuesto>AC</estadoImpuesto><idImpuesto>30</idImpuesto><periodo>202507</periodo></impuesto></datosRegimenGeneral>
      <metadata><fechaHora>2026-08-09T10:00:00-03:00</fechaHora></metadata>
    </personaReturn></getPersona_v2Response></soap:Body></soap:Envelope>`;
    assert.deepEqual(parseArcaRegistrationResponse(xml), {
        personCuit: issuerCuit,
        personType: "FISICA",
        taxIdStatus: "ACTIVO",
        legalName: "VAZQUEZ CUESTAS HECTOR",
        fiscalAddress: {
            type: "FISCAL",
            street: "PUBLICA MZA 28 CASA 27",
            locality: "CORDOBA",
            province: "CORDOBA",
            postalCode: "5000",
            additionalType: "BARRIO",
            additionalValue: "LOS MANANTIALES",
            formatted: "PUBLICA MZA 28 CASA 27, BARRIO: LOS MANANTIALES, CORDOBA, CP 5000",
        },
        monotributo: {
            registered: true,
            categoryId: "10",
            categoryDescription: "CATEGORIA A",
            period: "202507",
        },
        activities: [{
            id: "821100",
            description: "SERVICIOS ADMINISTRATIVOS",
            nomenclator: "",
            order: 1,
            period: "202507",
        }],
        taxes: [{
            id: "30",
            description: "IVA",
            status: "AC",
            reason: "",
            period: "202507",
        }],
        earliestActivityPeriod: "202507",
        warnings: [],
        metadata: {processedAt: "2026-08-09T10:00:00-03:00"},
    });
});

test("extrae el detalle de un error SOAP devuelto con HTTP 500", () => {
    const soap = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault><faultcode>soapenv:Server.userException</faultcode><faultstring>ns1:coe.alreadyAuthenticated: El CEE ya posee un TA valido para el acceso al WSN solicitado</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>`;
    assert.deepEqual(parseArcaSoapFault(soap), {
        code: "soapenv:Server.userException",
        message: "ns1:coe.alreadyAuthenticated: El CEE ya posee un TA valido para el acceso al WSN solicitado",
    });
    assert.equal(parseArcaSoapFault("<not-a-fault/>"), null);
});

test("exige condición IVA y campos fiscales antes de emitir", () => {
    assert.deepEqual(validateArcaInvoiceDraft(validDraft), []);
    assert.match(validateArcaInvoiceDraft({
        ...validDraft,
        recipient: {...validDraft.recipient, ivaConditionId: 0},
    }).join(" "), /condición frente al IVA/i);
});

test("rechaza un receptor con el mismo documento que el emisor", () => {
    const errors = validateArcaInvoiceDraft({
        ...validDraft,
        recipient: {
            documentType: 80,
            documentNumber: issuerCuit,
            ivaConditionId: 5,
        },
    });

    assert.match(errors.join(" "), /no puede ser igual al CUIT emisor/i);
});

test("valida las fechas exigidas por ARCA para servicios", () => {
    const oldInvoiceErrors = validateArcaInvoiceDraft({
        ...validDraft,
        invoiceDate: "2026-07-20",
    }, {requestDateKey: "2026-08-06"});
    assert.match(oldInvoiceErrors.join(" "), /10 días antes/i);

    const invalidDueDateErrors = validateArcaInvoiceDraft({
        ...validDraft,
        invoiceDate: "2026-08-06",
        paymentDueDate: "2026-08-05",
    }, {requestDateKey: "2026-08-06"});
    assert.match(invalidDueDateErrors.join(" "), /no puede ser anterior al comprobante/i);

    const invalidServicePeriodErrors = validateArcaInvoiceDraft({
        ...validDraft,
        serviceFrom: "2026-08-31",
        serviceTo: "2026-08-01",
    });
    assert.match(invalidServicePeriodErrors.join(" "), /inicial del servicio/i);
});

test("construye Factura C de servicios sin exponer descripción libre", () => {
    const xml = buildWsfeCaeRequest({
        draft: validDraft,
        token: "token&privado",
        sign: "firma<privada",
        voucherNumber: 18,
    });
    assert.match(xml, /<ar:CbteTipo>11<\/ar:CbteTipo>/);
    assert.match(xml, /<ar:CbteDesde>18<\/ar:CbteDesde>/);
    assert.match(xml, /<ar:CondicionIVAReceptorId>5<\/ar:CondicionIVAReceptorId>/);
    assert.match(xml, /<ar:ImpTotal>10000.00<\/ar:ImpTotal>/);
    assert.match(xml, /token&amp;privado/);
    assert.match(xml, /firma&lt;privada/);
});

test("normaliza puntos de venta y respuesta CAE", () => {
    const pointsXml = `<soap:Envelope><soap:Body><FEParamGetPtosVentaResponse><FEParamGetPtosVentaResult><ResultGet><PtoVenta><Nro>3</Nro><EmisionTipo>CAE</EmisionTipo><Bloqueado>N</Bloqueado></PtoVenta></ResultGet></FEParamGetPtosVentaResult></FEParamGetPtosVentaResponse></soap:Body></soap:Envelope>`;
    assert.deepEqual(parseWsfePointsOfSaleResponse(pointsXml), [{
        number: 3,
        emissionType: "CAE",
        blocked: false,
        dropDate: "",
    }]);

    const noPointsXml = `<soap:Envelope><soap:Body><FEParamGetPtosVentaResponse><FEParamGetPtosVentaResult><Errors><Err><Code>602</Code><Msg>Sin Resultados: - Metodo FEParamGetPtosVenta</Msg></Err></Errors></FEParamGetPtosVentaResult></FEParamGetPtosVentaResponse></soap:Body></soap:Envelope>`;
    assert.deepEqual(parseWsfePointsOfSaleResponse(noPointsXml), []);

    const caeXml = `<soap:Envelope><soap:Body><FECAESolicitarResponse><FECAESolicitarResult><FeCabResp><FchProceso>20260806120000</FchProceso></FeCabResp><FeDetResp><FECAEDetResponse><Resultado>A</Resultado><CAE>12345678901234</CAE><CAEFchVto>20260816</CAEFchVto><CbteDesde>18</CbteDesde><CbteFch>20260806</CbteFch></FECAEDetResponse></FeDetResp></FECAESolicitarResult></FECAESolicitarResponse></soap:Body></soap:Envelope>`;
    assert.deepEqual(parseWsfeCaeResponse(caeXml), {
        result: "A",
        cae: "12345678901234",
        caeExpirationDate: "2026-08-16",
        voucherNumber: 18,
        voucherDate: "2026-08-06",
        observations: [],
        processDate: "20260806120000",
        errors: [],
    });
});

test("la idempotencia depende del emisor, punto, tipo y obligación", () => {
    const first = createArcaRequestId({issuerProfileId: "a", pointOfSale: 3, voucherType: 11, obligationId: "o1"});
    const same = createArcaRequestId({issuerProfileId: "a", pointOfSale: 3, voucherType: 11, obligationId: "o1"});
    const other = createArcaRequestId({issuerProfileId: "a", pointOfSale: 4, voucherType: 11, obligationId: "o1"});
    const production = createArcaRequestId({issuerProfileId: "a", pointOfSale: 3, voucherType: 11, obligationId: "o1", environment: "prod"});
    assert.equal(first, same);
    assert.notEqual(first, other);
    assert.notEqual(first, production);
});

test("genera una confirmación productiva ligada al punto y número", () => {
    assert.equal(buildProductionConfirmationText({
        pointOfSale: 4,
        proposedVoucherNumber: 27,
    }), "EMITIR 4-27");
    assert.equal(buildProductionConfirmationText({
        pointOfSale: 4,
        proposedVoucherNumber: 3,
        voucherType: 13,
    }), "EMITIR NC 4-3");
    assert.equal(buildProductionConfirmationText({pointOfSale: 0}), "");
});

test("construye una Nota de Crédito C asociada sin superar la factura", () => {
    const creditNote = {
        ...validDraft,
        environment: "prod",
        voucherType: 13,
        amountMinor: 500,
        associatedVoucher: {
            voucherType: 11,
            pointOfSale: 4,
            voucherNumber: 1,
            amountMinor: 1000,
        },
    };
    assert.deepEqual(validateArcaInvoiceDraft(creditNote, {
        allowedEnvironments: ["prod"],
    }), []);
    const xml = buildWsfeCaeRequest({
        draft: creditNote,
        token: "TOKEN",
        sign: "SIGN",
        voucherNumber: 2,
        requestDateKey: "2026-08-06",
    });
    assert.match(xml, /<ar:CbteTipo>13<\/ar:CbteTipo>/);
    assert.match(xml, /<ar:CbtesAsoc><ar:CbteAsoc><ar:Tipo>11<\/ar:Tipo><ar:PtoVta>4<\/ar:PtoVta><ar:Nro>1<\/ar:Nro>/);
    assert.match(validateArcaInvoiceDraft({
        ...creditNote,
        amountMinor: 1001,
    }, {allowedEnvironments: ["prod"]}).join(" "), /no puede superar/i);
});

test("genera una confirmación de activación ligada al CUIT y punto de venta", () => {
    assert.equal(buildProductionActivationConfirmationText({
        issuerCuit: "20-25300621-9",
        pointOfSale: 4,
    }), "HABILITAR 20253006219 PV 4");
    assert.equal(buildProductionActivationConfirmationText({
        issuerCuit: "2030",
        pointOfSale: 4,
    }), "");
});

test("un comprobante productivo exige habilitación explícita", () => {
    const productionDraft = {...validDraft, environment: "prod"};
    assert.match(
        validateArcaInvoiceDraft(productionDraft).join(" "),
        /ambiente fiscal/i,
    );
    assert.deepEqual(validateArcaInvoiceDraft(productionDraft, {
        allowedEnvironments: ["prod"],
    }), []);
    const xml = buildWsfeCaeRequest({
        draft: productionDraft,
        token: "token",
        sign: "sign",
        voucherNumber: 1,
    });
    assert.match(xml, /<ar:CbteDesde>1<\/ar:CbteDesde>/);
    assert.match(xml, /<ar:CbteHasta>1<\/ar:CbteHasta>/);
});
