import admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

import {
    addDaysToDateKey,
    buildAutomatedRentalObligations,
} from "./rentals.helpers.js";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const REGION = "southamerica-east1";
const AUTOMATION_ACTOR = "system:rental-monthly-automation";

const todayArgentina = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
}).format(new Date());

const processContract = async ({contractRef, contract, todayDate, throughDate}) => {
    const obligations = buildAutomatedRentalObligations({
        contract: {id: contractRef.id, ...contract},
        todayDate,
        throughDate,
    });
    const obligationsRef = contractRef.parent.parent.collection("rental_obligations");
    const existingSnap = await obligationsRef
        .where("contractId", "==", contractRef.id).get();
    const existingPeriods = new Set(existingSnap.docs
        .filter((item) => item.data()?.voided !== true)
        .map((item) => item.data()?.periodKey));
    const missing = obligations.filter((item) => !existingPeriods.has(item.periodKey));
    const batch = db.batch();
    missing.forEach((obligation) => {
        const id = `${contractRef.id}_${obligation.periodKey}`;
        batch.set(obligationsRef.doc(id), {
            ...obligation,
            id,
            inmobiliariaId: contract.inmobiliariaId,
            ownerInmobiliariaId: contract.inmobiliariaId,
            automationSource: "scheduled_monthly_generation",
            createdBy: AUTOMATION_ACTOR,
            updatedBy: AUTOMATION_ACTOR,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
    });
    batch.set(contractRef, {
        obligationsGeneratedThrough: throughDate,
        lastAutomaticObligationRunAt: FieldValue.serverTimestamp(),
        lastAutomaticObligationCreated: missing.length,
        updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
    await batch.commit();
    return missing.length;
};

export const rentalGenerateMonthlyObligations = onSchedule({
    region: REGION,
    schedule: "25 3 * * *",
    timeZone: "America/Argentina/Buenos_Aires",
    timeoutSeconds: 540,
    memory: "512MiB",
}, async () => {
    const todayDate = todayArgentina();
    const throughDate = addDaysToDateKey(todayDate, 45);
    const contractsSnap = await db.collectionGroup("rental_contracts")
        .where("status", "==", "active").get();
    let processed = 0;
    let created = 0;
    const failures = [];
    for (const contractDoc of contractsSnap.docs) {
        const contract = contractDoc.data() || {};
        if (contract.deleted === true || !contract.inmobiliariaId) continue;
        try {
            created += await processContract({
                contractRef: contractDoc.ref,
                contract,
                todayDate,
                throughDate,
            });
            processed += 1;
        } catch (error) {
            failures.push({
                contractId: contractDoc.id,
                inmobiliariaId: contract.inmobiliariaId,
                message: error?.message?.toString?.().slice(0, 300) || "Error desconocido",
            });
        }
    }
    await db.collection("rental_automation_runs").add({
        type: "monthly_obligation_generation",
        todayDate,
        throughDate,
        processedContracts: processed,
        createdObligations: created,
        failureCount: failures.length,
        failures: failures.slice(0, 50),
        executedAt: FieldValue.serverTimestamp(),
    });
    if (failures.length) console.error("Fallaron contratos en la automatización de alquileres.", failures);
});
