import { useState } from "react";

import { downloadPrivateConsortiumDocument } from "../services/consorcio.service";

const ConsortiumPrivateDocumentButton = ({
  path,
  fileName,
  label = "Descargar",
  className = "btn btn-sm btn-outline-secondary",
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    try {
      setLoading(true);
      setError("");
      await downloadPrivateConsortiumDocument({ path, fileName });
    } catch (downloadError) {
      setError(downloadError.message || "No se pudo descargar el archivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="d-inline-flex flex-column align-items-end gap-1">
      <button className={className} disabled={loading || !path} type="button" onClick={download}>
        {loading ? "Descargando..." : label}
      </button>
      {error && <small className="text-danger">{error}</small>}
    </span>
  );
};

export default ConsortiumPrivateDocumentButton;
