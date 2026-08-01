import { useState } from "react";

import { getBillingPaymentProofUrl } from "../services/billing.service";

const BillingPaymentProofLink = ({ proofPath = "", legacyProofUrl = "" }) => {
    const [url, setUrl] = useState(legacyProofUrl);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    if (!proofPath && !legacyProofUrl) return <span className="text-muted">-</span>;

    if (url) {
        return (
            <a href={url} target="_blank" rel="noreferrer">
                Abrir comprobante
            </a>
        );
    }

    const prepareLink = async () => {
        try {
            setLoading(true);
            setError("");
            setUrl(await getBillingPaymentProofUrl(proofPath));
        } catch (loadError) {
            setError(loadError.message || "No se pudo abrir el archivo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <span>
            <button
                type="button"
                className="btn btn-sm btn-link p-0"
                onClick={prepareLink}
                disabled={loading}
            >
                {loading ? "Preparando..." : "Ver comprobante"}
            </button>
            {error && <span className="small text-danger d-block">{error}</span>}
        </span>
    );
};

export default BillingPaymentProofLink;
