import {Buffer} from "node:buffer";

import PDFDocument from "pdfkit";
import QRCode from "qrcode";

const digits = (value = "") => value.toString().replace(/\D/g, "");
const cleanText = (value = "", maxLength = 1000) => (
    value?.toString?.().trim().replace(/\s+/g, " ").slice(0, maxLength) || ""
);

const formatDate = (value = "") => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(value || "");
    return match ? `${match[3]}/${match[2]}/${match[1]}` : cleanText(value) || "—";
};

export const formatArcaPdfVoucherNumber = (pointOfSale, voucherNumber) => (
    `${String(Number(pointOfSale) || 0).padStart(5, "0")}-` +
    String(Number(voucherNumber) || 0).padStart(8, "0")
);

export const buildArcaPdfQrUrl = (voucher = {}) => {
    if (voucher.status !== "authorized" || !digits(voucher.cae)) {
        throw new Error("El comprobante todavía no tiene un CAE autorizado.");
    }
    const payload = {
        ver: 1,
        fecha: voucher.voucherDate || voucher.invoiceDate,
        cuit: Number(digits(voucher.issuerCuit)),
        ptoVta: Number(voucher.pointOfSale),
        tipoCmp: Number(voucher.voucherType),
        nroCmp: Number(voucher.voucherNumber),
        importe: Math.round(Number(voucher.amountMinor || 0)) / 100,
        moneda: "PES",
        ctz: 1,
        tipoDocRec: Number(voucher.recipient?.documentType),
        nroDocRec: Number(digits(voucher.recipient?.documentNumber) || 0),
        tipoCodAut: "E",
        codAut: Number(digits(voucher.cae)),
    };
    const base64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
    return `https://www.arca.gob.ar/fe/qr/?p=${encodeURIComponent(base64)}`;
};

const formatMoney = (amountMinor) => new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
}).format(Math.round(Number(amountMinor || 0)) / 100);

const ivaLabel = (value) => ({
    1: "IVA Responsable Inscripto",
    4: "IVA Sujeto Exento",
    5: "Consumidor Final",
    6: "Responsable Monotributo",
    7: "Sujeto No Categorizado",
    13: "Monotributista Social",
    15: "IVA No Alcanzado",
}[Number(value)] || "No informada");

const documentLabel = (value) => ({80: "CUIT", 96: "DNI", 99: "Consumidor final"}[
    Number(value)
] || "Documento");

const drawRule = (doc, y) => doc.moveTo(28, y).lineTo(567, y).strokeColor("#cbd5e1").stroke();

export const buildArcaVoucherPdf = async ({voucher, profile = {}, contract = {}} = {}) => {
    const isCreditNote = Number(voucher?.voucherType) === 13;
    const voucherLabel = isCreditNote ? "NOTA DE CRÉDITO C" : "FACTURA C";
    const issuer = voucher?.issuerSnapshot || {
        legalName: profile.issuerLegalName || profile.name || "",
        tradeName: profile.issuerTradeName || "",
        commercialAddress: profile.commercialAddress || "",
        grossIncomeNumber: profile.grossIncomeNumber || "",
        activityStartDate: profile.activityStartDate || "",
        ivaConditionId: Number(profile.issuerIvaConditionId || 6),
    };
    const qrUrl = buildArcaPdfQrUrl(voucher);
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
        type: "png",
        width: 170,
        margin: 1,
        errorCorrectionLevel: "M",
    });
    const doc = new PDFDocument({
        size: "A4",
        margins: {top: 28, right: 28, bottom: 28, left: 28},
        compress: true,
        info: {
            Title: `${voucherLabel} ${formatArcaPdfVoucherNumber(voucher.pointOfSale, voucher.voucherNumber)}`,
            Author: cleanText(issuer.legalName, 200),
            Subject: "Representación de comprobante electrónico autorizado por ARCA",
        },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const completed = new Promise((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
    });

    doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748b")
        .text(cleanText(issuer.tradeName || "COMPROBANTE ELECTRÓNICO", 150).toUpperCase(), 28, 30, {width: 210});
    doc.fontSize(15).fillColor("#0f172a")
        .text(cleanText(issuer.legalName || "Emisor", 200), 28, 44, {width: 220});
    doc.font("Helvetica").fontSize(8).fillColor("#334155")
        .text(`Domicilio comercial: ${cleanText(issuer.commercialAddress, 300) || "No informado"}`, 28, 64, {width: 225})
        .text(`Condición frente al IVA: ${ivaLabel(issuer.ivaConditionId)}`, 28, 84, {width: 225});

    doc.rect(270, 30, 48, 48).lineWidth(1.5).strokeColor("#0f172a").stroke();
    doc.font("Helvetica-Bold").fontSize(25).fillColor("#0f172a").text("C", 270, 40, {width: 48, align: "center"});
    doc.font("Helvetica").fontSize(6.5).text(`Cód. ${isCreditNote ? "013" : "011"}`, 270, 67, {width: 48, align: "center"});

    doc.font("Helvetica").fontSize(8).fillColor("#334155").text("ORIGINAL", 335, 31, {width: 232, align: "right"});
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#0f172a").text(voucherLabel, 335, 45, {width: 232, align: "right"});
    doc.fontSize(10).text(`N.º ${formatArcaPdfVoucherNumber(voucher.pointOfSale, voucher.voucherNumber)}`, 335, 66, {width: 232, align: "right"});
    doc.font("Helvetica").fontSize(8).text(`Fecha: ${formatDate(voucher.voucherDate || voucher.invoiceDate)}`, 335, 83, {width: 232, align: "right"});

    drawRule(doc, 110);
    doc.font("Helvetica").fontSize(8).fillColor("#0f172a")
        .text(`CUIT: ${cleanText(voucher.issuerCuit, 20)}`, 28, 120, {width: 250})
        .text(`Ingresos Brutos: ${cleanText(issuer.grossIncomeNumber, 80) || "No informado"}`, 305, 120, {width: 262})
        .text(`Inicio de actividades: ${formatDate(issuer.activityStartDate)}`, 28, 135, {width: 250})
        .text("Concepto: Servicios", 305, 135, {width: 262});
    drawRule(doc, 154);

    doc.text(`Servicio desde: ${formatDate(voucher.serviceFrom)}`, 28, 164, {width: 170})
        .text(`Servicio hasta: ${formatDate(voucher.serviceTo)}`, 212, 164, {width: 170})
        .text(`Vencimiento de pago: ${formatDate(voucher.paymentDueDate)}`, 396, 164, {width: 171});

    let y = 190;
    if (isCreditNote) {
        doc.roundedRect(28, y, 539, 45, 4).fillAndStroke("#f8fafc", "#cbd5e1");
        doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8)
            .text(`Comprobante asociado: Factura C ${formatArcaPdfVoucherNumber(voucher.associatedVoucher?.pointOfSale, voucher.associatedVoucher?.voucherNumber)}`, 38, y + 9, {width: 519});
        doc.font("Helvetica").text(`Motivo: ${cleanText(voucher.reason, 300)}`, 38, y + 24, {width: 519});
        y += 57;
    }

    doc.roundedRect(28, y, 539, 55, 4).fillAndStroke("#f8fafc", "#cbd5e1");
    doc.fillColor("#0f172a").font("Helvetica").fontSize(8)
        .text(`Cliente: ${cleanText(voucher.recipient?.name, 200)}`, 38, y + 9, {width: 260})
        .text(`${documentLabel(voucher.recipient?.documentType)}: ${cleanText(voucher.recipient?.documentNumber, 30)}`, 305, y + 9, {width: 250})
        .text(`Domicilio: ${cleanText(voucher.recipient?.address, 300) || "NR"}`, 38, y + 27, {width: 260})
        .text(`Condición frente al IVA: ${ivaLabel(voucher.recipient?.ivaConditionId)}`, 305, y + 27, {width: 250});
    y += 72;

    doc.rect(28, y, 539, 24).fillAndStroke("#334155", "#334155");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8)
        .text("DESCRIPCIÓN", 38, y + 8, {width: 390})
        .text("IMPORTE", 438, y + 8, {width: 119, align: "right"});
    doc.rect(28, y + 24, 539, 72).strokeColor("#cbd5e1").stroke();
    doc.fillColor("#0f172a").font("Helvetica").fontSize(8)
        .text(cleanText(voucher.description || `Alquiler ${voucher.periodKey}`, 500), 38, y + 36, {width: 385})
        .text(cleanText(contract.inmuebleSnapshot?.address, 300), 38, y + 53, {width: 385})
        .text(formatMoney(voucher.amountMinor), 438, y + 36, {width: 119, align: "right"});
    doc.font("Helvetica-Bold").fontSize(11)
        .text(`${isCreditNote ? "Total acreditado" : "Total"}: ${formatMoney(voucher.amountMinor)}`, 320, y + 108, {width: 237, align: "right"});

    const footerY = Math.max(y + 145, 500);
    drawRule(doc, footerY);
    doc.image(qrBuffer, 28, footerY + 12, {width: 112, height: 112});
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a").text("ARCA", 145, footerY + 100);
    doc.font("Helvetica").fontSize(8)
        .text(`CAE: ${cleanText(voucher.cae, 30)}`, 300, footerY + 25, {width: 267, align: "right"})
        .text(`Vencimiento CAE: ${formatDate(voucher.caeExpirationDate)}`, 300, footerY + 43, {width: 267, align: "right"})
        .text("Comprobante fiscal autorizado por ARCA.", 300, footerY + 65, {width: 267, align: "right"});

    doc.end();
    return completed;
};

export const buildArcaVoucherPdfFilename = (voucher = {}) => {
    const prefix = Number(voucher.voucherType) === 13 ? "nota-credito-c" : "factura-c";
    return `${prefix}-${formatArcaPdfVoucherNumber(voucher.pointOfSale, voucher.voucherNumber)}.pdf`;
};
