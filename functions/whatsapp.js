import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

import {
    buildWhatsappDestinationUrl,
    normalizeWhatsappAgencySlug,
} from "./whatsapp.helpers.js";

const REGION = "southamerica-east1";
const ONOPROP_WHATSAPP_NUMBER = defineSecret("ONOPROP_WHATSAPP_NUMBER");

const setPrivateResponseHeaders = (res) => {
    res.set("Cache-Control", "private, no-store, max-age=0");
    res.set("Pragma", "no-cache");
    res.set("Referrer-Policy", "no-referrer");
    res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
};

const sendUnavailablePage = (res, status, message) => {
    res.status(status).send(`
        <!doctype html>
        <html lang="es">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>WhatsApp no disponible</title>
          </head>
          <body style="font-family: Arial, sans-serif; padding: 32px;">
            <h1>WhatsApp no disponible</h1>
            <p>${message}</p>
            <p><a href="/">Volver al sitio</a></p>
          </body>
        </html>
    `);
};

const getAgencyWhatsappDestination = async (slug, context = {}) => {
    const snap = await getFirestore()
        .collection("inmobiliarias")
        .where("activa", "==", true)
        .where("slug", "==", slug)
        .limit(1)
        .get();

    if (snap.empty) return null;

    const data = snap.docs[0].data() || {};
    const number = data.configuracion?.contacto?.whatsapp || "";
    const url = buildWhatsappDestinationUrl({
        number,
        agencyName: data.nombre || "la inmobiliaria",
        ...context,
    });

    return url || null;
};

export const whatsappRedirect = onRequest(
    {
        region: REGION,
        invoker: "public",
        secrets: [ONOPROP_WHATSAPP_NUMBER],
    },
    async (req, res) => {
        setPrivateResponseHeaders(res);

        if (req.method !== "GET" && req.method !== "HEAD") {
            res.set("Allow", "GET, HEAD");
            res.status(405).send("Método no permitido.");
            return;
        }

        try {
            const requestedAgency = req.query.agency?.toString?.() || "";
            const agencySlug = normalizeWhatsappAgencySlug(requestedAgency);
            const context = {
                developmentName:
                    req.query.development?.toString?.() || "",
                unitReference: req.query.unit?.toString?.() || "",
            };

            if (requestedAgency && !agencySlug) {
                sendUnavailablePage(
                    res,
                    400,
                    "La inmobiliaria solicitada no es válida.",
                );
                return;
            }

            const destinationUrl = agencySlug
                ? await getAgencyWhatsappDestination(agencySlug, context)
                : buildWhatsappDestinationUrl({
                    number: ONOPROP_WHATSAPP_NUMBER.value(),
                    ...context,
                });

            if (!destinationUrl) {
                sendUnavailablePage(
                    res,
                    404,
                    agencySlug
                        ? "Esta inmobiliaria no configuró un número de WhatsApp."
                        : "El canal de WhatsApp de ONO Prop no está configurado.",
                );
                return;
            }

            res.redirect(302, destinationUrl);
        } catch (error) {
            console.error("WhatsApp redirect error", {
                name: error?.name || "",
                message: error?.message || "",
            });
            sendUnavailablePage(
                res,
                500,
                "No se pudo abrir WhatsApp en este momento.",
            );
        }
    },
);
