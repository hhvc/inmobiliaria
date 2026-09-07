import crypto from "node:crypto";
import { Buffer } from "node:buffer";

export const cleanSiroText = (value = "", maxLength = 500) => (
    `${value ?? ""}`.trim().slice(0, maxLength)
);

export const normalizeSiroConcept = (value = "") => cleanSiroText(value, 200)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

export const normalizeSiroAgreementId = (value = "") => {
    const digits = cleanSiroText(value, 30).replace(/\D/g, "");
    return digits.length === 10 ? digits : "";
};

const numericHash = (value, length) => {
    const hex = crypto.createHash("sha256").update(`${value}`).digest("hex");
    const modulus = 10n ** BigInt(length);
    const number = BigInt(`0x${hex}`) % modulus;
    return number.toString().padStart(length, "0");
};

export const buildSiroCustomerCode = ({
    inmobiliariaId = "",
    consortiumId = "",
    unitId = "",
}) => numericHash(`${inmobiliariaId}:${consortiumId}:${unitId}`, 9);

export const buildSiroCpe = ({ customerCode = "", agreementId = "" }) => {
    const normalizedCustomer = cleanSiroText(customerCode, 20).replace(/\D/g, "");
    const normalizedAgreement = normalizeSiroAgreementId(agreementId);
    if (normalizedCustomer.length !== 9 || !normalizedAgreement) return "";
    return `${normalizedCustomer}${normalizedAgreement}`;
};

const getMonthYearSuffix = (periodKey = "", dueDate = "") => {
    const match = cleanSiroText(periodKey || dueDate, 10)
        .match(/^(\d{4})-(\d{2})/);
    if (!match) {
        const now = new Date();
        return `${String(now.getMonth() + 1).padStart(2, "0")}${
            String(now.getFullYear()).slice(-2)}`;
    }
    return `${match[2]}${match[1].slice(-2)}`;
};

export const buildSiroReceiptNumber = ({
    obligationId = "",
    periodKey = "",
    dueDate = "",
    conceptCode = 0,
}) => {
    const concept = Math.max(0, Math.min(9, Number(conceptCode) || 0));
    return `${numericHash(obligationId, 15)}${concept}${
        getMonthYearSuffix(periodKey, dueDate)}`;
};

export const createSiroPublicToken = () => crypto.randomBytes(24).toString("base64url");

export const hashSiroPublicToken = (value = "") => crypto.createHash("sha256")
    .update(cleanSiroText(value, 300))
    .digest("hex");

export const isSiroPublicTokenValid = (value, expectedHash) => {
    const actual = Buffer.from(hashSiroPublicToken(value), "utf8");
    const expected = Buffer.from(cleanSiroText(expectedHash, 128), "utf8");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

export const normalizeSiroPaymentStatus = (result = {}) => {
    const state = cleanSiroText(result.Estado || result.estado, 80).toUpperCase();
    const successful = result.PagoExitoso === true || result.pagoExitoso === true;
    if (successful || state === "PROCESADA" || state === "PROCESADO") {
        return "approved";
    }
    if (["RECHAZADA", "RECHAZADO"].includes(state)) return "rejected";
    if (["CANCELADA", "CANCELADO", "ANULADA", "ANULADO"].includes(state)) {
        return "cancelled";
    }
    if (["VENCIDA", "VENCIDO", "EXPIRADA", "EXPIRADO"].includes(state)) {
        return "expired";
    }
    if (["INICIADA", "INICIADO", "PENDIENTE"].includes(state)) return "pending";
    return state ? "in_process" : "pending";
};

export const extractSiroCallbackResultId = (source = {}) => cleanSiroText(
    source.id_resultado || source.idResultado || source.IdResultado ||
    source.Id_Resultado || source.idResultadoOperacion,
    100,
);

export const extractSiroAgreements = (payload) => {
    const candidates = Array.isArray(payload) ? payload : [
        payload?.Convenios,
        payload?.convenios,
        payload?.Data,
        payload?.data,
        payload?.Resultado,
        payload?.resultado,
    ].find(Array.isArray) || [];
    return candidates.map((item = {}) => {
        const id = normalizeSiroAgreementId(
            item.nro_empresa || item.NroEmpresa || item.NumeroEmpresa ||
            item.IdConvenio || item.idConvenio || item.Convenio || item.convenio,
        );
        return {
            id,
            name: cleanSiroText(
                item.RazonSocial || item.razonSocial || item.Nombre || item.nombre ||
                item.Descripcion || item.descripcion || `Convenio ${id}`,
                180,
            ),
            administratorCuit: cleanSiroText(
                item.CuitAdministrador || item.cuit_administrador ||
                item.CUITAdministrador || item.cuitAdministrador,
                20,
            ).replace(/\D/g, ""),
        };
    }).filter((item) => item.id);
};

export const buildSiroAssignmentId = ({
    inmobiliariaId = "",
    targetType = "",
    targetId = "",
}) => [targetType, inmobiliariaId, targetId]
    .map((value) => cleanSiroText(value, 128).replace(/[^A-Za-z0-9_-]/g, ""))
    .join("_");
