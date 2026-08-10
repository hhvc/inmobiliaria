// === index.js (Firebase Functions v6, Node 22) ===

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

// Inicializar Firebase Admin
initializeApp();
const db = getFirestore();

// === TRIGGER: al crear un nuevo mensaje en contactMessages ===
export const createMailOnNewContact = onDocumentCreated(
  "contactMessages/{messageId}",
  async (event) => {
    if (!event.data) {
      console.error("❌ No se encontraron datos del documento.");
      return null;
    }

    const messageData = event.data.data();
    const messageRef = event.data.ref;

    // Validación básica
    if (!messageData.name || !messageData.email || !messageData.message) {
      console.error("❌ Datos incompletos en el mensaje:", messageData);
      await messageRef.update({
        notificationSent: false,
        error: "Datos incompletos para enviar email",
      });
      return null;
    }

    // Crear documento en la colección "mail" para que la extensión lo procese
    const mailDoc = {
      to: ["contacto@onoprop.com"], // 📥 destinatario principal
      replyTo: messageData.email, // Permite responder al cliente
      message: {
        subject: `📨 Nuevo mensaje de contacto: ${messageData.name}`,
        text: `Nuevo mensaje de ${messageData.name} (${messageData.email})\n\n${messageData.message}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Nuevo mensaje de contacto</h2>
            <p><strong>👤 Nombre:</strong> ${messageData.name}</p>
            <p><strong>📧 Email:</strong> ${messageData.email}</p>
            <p><strong>📞 Teléfono:</strong> ${messageData.phone || "No proporcionado"
          }</p>
            <hr/>
            <p><strong>💬 Mensaje:</strong></p>
            <p style="background: #f1f5f9; padding: 10px; border-radius: 5px;">${messageData.message
          }</p>
            <br/>
            <p style="font-size: 12px; color: #64748b;">Enviado desde el sitio web de ONO Prop</p>
          </div>
        `,
      },
      createdAt: FieldValue.serverTimestamp(),
    };

    try {
      const mailRef = await db.collection("mail").add(mailDoc);
      console.log(`✅ Documento "mail" creado con ID: ${mailRef.id}`);

      await messageRef.update({
        notificationSent: true,
        notifiedAt: FieldValue.serverTimestamp(),
        mailDocId: mailRef.id,
        error: FieldValue.delete(), // Elimina el campo 'error' si el email se disparó correctamente
      });
    } catch (error) {
      console.error("❌ Error creando documento en 'mail':", error);
      await messageRef.update({
        notificationSent: false,
        error: error.message,
      });
    }

    return;
  }
);

export {
  mercadoLibreAuthStart,
  mercadoLibreOAuthCallback,
  mercadoLibreConnectionStatus,
  mercadoLibreDisconnect,
  mercadoLibreGetDistribution,
  mercadoLibreSaveSettings,
  mercadoLibreGetCategoryDetails,
  mercadoLibreGetLocationOptions,
  mercadoLibreValidateItem,
  mercadoLibrePublishItem,
  mercadoLibreUpdateItem,
  mercadoLibreChangeItemStatus,
  mercadoLibreSyncItemStatus,
  mercadoLibreGetLeads,
  mercadoLibreUpdateLeadStatus,
  mercadoLibreAnswerQuestion,
  mercadoLibreSyncLeads,
  mercadoLibreProcessNotification,
  mercadoLibreNotifications,
} from "./mercadolibre.js";

export {
  instagramAuthStart,
  instagramOAuthCallback,
  instagramConnectionStatus,
  instagramValidateConnection,
  instagramDisconnect,
  instagramGetDistribution,
  instagramPublishAgencyMedia,
  instagramSubmitOnopropPublication,
  instagramListOnopropRequests,
  instagramApproveOnopropPublication,
  instagramRejectOnopropPublication,
  instagramMaintainConnections,
  instagramDeauthorize,
  instagramDataDeletion,
} from "./instagram.js";

export { whatsappRedirect } from "./whatsapp.js";

export {
  omiTestConnection,
  omiSearchComparables,
} from "./omi.js";

export { parcelasGetAtPoint } from "./parcelas.js";

export {
  arcaGetOverview,
  arcaGetAdminOverview,
  arcaGetRegistrationCertificate,
  arcaGetProductionRegistrationCertificate,
  arcaUpsertIssuerProfile,
  arcaTestHomologation,
  arcaTestProductionConnection,
  arcaCreateRentalInvoiceDraft,
  arcaPrepareProductionRentalInvoicePreview,
  arcaAuthorizeRentalInvoice,
  arcaAuthorizeProductionRentalInvoice,
} from "./arca.js";

export {
  billingGetPublicCatalog,
  billingCreateCommercialLead,
  billingUpdateCommercialLead,
  billingGetAgencyOverview,
  billingGetAdminOverview,
  billingUpsertInterestRate,
  billingUpsertPromotion,
  billingUpsertCatalogItem,
  billingSeedInitialCatalog,
  billingRequestContract,
  billingSetContractQuote,
  billingAcceptContractQuote,
  billingRejectContract,
  billingApproveContract,
  billingActivateContract,
  billingAmendContractFinancialTerms,
  billingRequestCancellation,
  billingResolveCancellation,
  billingCreatePaymentReport,
  billingResolvePaymentReport,
  billingCreateManualEntry,
  billingReverseLedgerEntry,
  billingApplyHighlightCredits,
  billingRunMaintenance,
  billingGenerateRecurringCharges,
} from "./billing.js";

export {
  taxProcessDueReminders,
  taxRunDueAutomation,
} from "./tax.js";

export { rentalGenerateMonthlyObligations } from "./rentals.js";

export {
  consortiumSaveNotificationSettings,
  consortiumSendCommunications,
  consortiumSendOnObligationCreated,
  consortiumRunReminderAutomation,
  consortiumProcessReminders,
  consortiumSyncMailStatus,
} from "./consortium.js";
