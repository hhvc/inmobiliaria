import admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { buildSiroAssignmentId, cleanSiroText } from "./siro.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const REGION = "southamerica-east1";
const ASSIGNMENTS = "payment_provider_assignments";

export const paymentResolveCheckoutProvider = onCall({
    region: REGION,
    invoker: "public",
}, async (request) => {
    if (!request.auth?.uid) {
        throw new HttpsError("unauthenticated", "Tenés que iniciar sesión.");
    }
    const contextType = cleanSiroText(request.data?.contextType, 60);
    if (contextType !== "consortium_obligation") {
        return { provider: "mercadopago" };
    }
    const inmobiliariaId = cleanSiroText(request.data?.inmobiliariaId, 128);
    const obligationId = cleanSiroText(request.data?.obligationId, 128);
    if (!inmobiliariaId || !obligationId) {
        throw new HttpsError("invalid-argument", "Falta identificar la expensa.");
    }
    const obligationSnap = await db.collection("inmobiliarias")
        .doc(inmobiliariaId).collection("condominium_obligations")
        .doc(obligationId).get();
    if (!obligationSnap.exists) {
        throw new HttpsError("not-found", "La expensa no existe.");
    }
    const assignmentId = buildSiroAssignmentId({
        targetType: "consortium",
        inmobiliariaId,
        targetId: obligationSnap.data()?.consortiumId,
    });
    const assignmentSnap = await db.collection(ASSIGNMENTS)
        .doc(assignmentId).get();
    if (assignmentSnap.exists && assignmentSnap.data()?.active === true &&
        assignmentSnap.data()?.provider === "siro") {
        return { provider: "siro", environment: assignmentSnap.data().environment };
    }
    return { provider: "mercadopago" };
});

