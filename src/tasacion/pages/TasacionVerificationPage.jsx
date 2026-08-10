import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { getTasacionVerificationByCode } from "../services/tasacion.service";
import { getTasacionEstado } from "../utils/tasacion.constants";

const formatDate = (value) => {
  if (!value) return "No informada";
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime())
    ? "No informada"
    : date.toLocaleString("es-AR");
};

const TasacionVerificationPage = () => {
  const { code = "" } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    getTasacionVerificationByCode(code)
      .then((result) => {
        if (!mounted) return;
        if (!result) throw new Error("No encontramos un informe asociado a ese código.");
        setRecord(result);
      })
      .catch((loadError) => {
        if (mounted) setError(loadError.message || "No se pudo verificar el informe.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [code]);

  const state = getTasacionEstado(record?.status);
  const isValid = record && record.status !== "anulada";

  return (
    <main className="container py-5">
      <SEO title="Verificar informe de tasación | ONO Prop" noIndex />
      <div className="mx-auto" style={{ maxWidth: 720 }}>
        <div className="text-center mb-4">
          <p className="text-uppercase text-muted small mb-1">ONO Prop</p>
          <h1 className="h3">Verificación de informe</h1>
        </div>

        {loading && <div className="text-center py-5">Consultando registro...</div>}
        {error && (
          <div className="card border-danger shadow-sm">
            <div className="card-body p-4">
              <h2 className="h5 text-danger">Código no verificado</h2>
              <p className="mb-0">{error}</p>
            </div>
          </div>
        )}

        {!loading && record && (
          <article className={`card shadow-sm ${isValid ? "border-success" : "border-danger"}`}>
            <div className="card-body p-4 p-md-5">
              <div className="d-flex flex-wrap justify-content-between gap-2 mb-4">
                <div>
                  <div className="small text-uppercase text-muted">Código</div>
                  <code className="fs-5">{record.code}</code>
                </div>
                <span className={`badge align-self-start ${state.badge}`}>{state.label}</span>
              </div>
              <h2 className="h4">{isValid ? "Informe registrado" : "Informe anulado"}</h2>
              <p className="text-muted">
                Este registro confirma la emisión y su estado actual. Por privacidad no publica
                el cliente, el domicilio exacto ni el valor informado.
              </p>
              <dl className="row mb-0">
                <dt className="col-sm-5">Inmobiliaria emisora</dt><dd className="col-sm-7">{record.agencyName || "No informada"}</dd>
                <dt className="col-sm-5">Versión</dt><dd className="col-sm-7">{record.versionNumber || 1}</dd>
                <dt className="col-sm-5">Tipología</dt><dd className="col-sm-7">{record.typology || "No informada"}</dd>
                <dt className="col-sm-5">Localidad</dt><dd className="col-sm-7">{record.city || "No informada"}</dd>
                <dt className="col-sm-5">Fecha de valuación</dt><dd className="col-sm-7">{record.valuationDate || "No informada"}</dd>
                <dt className="col-sm-5">Fecha de emisión</dt><dd className="col-sm-7">{formatDate(record.issuedAt)}</dd>
              </dl>
            </div>
          </article>
        )}

        <div className="text-center mt-4">
          <Link className="btn btn-outline-primary" to="/">Volver a ONO Prop</Link>
        </div>
      </div>
    </main>
  );
};

export default TasacionVerificationPage;
