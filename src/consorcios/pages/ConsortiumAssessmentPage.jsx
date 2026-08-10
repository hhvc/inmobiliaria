import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  getConsortiumById,
  getConsortiumObligationById,
  getConsortiumPeriodById,
} from "../services/consorcio.service";
import {
  buildConsortiumLiquidationLines,
  formatConsortiumMoney,
  getConsortiumDistributionLabel,
  getConsortiumExpenseCategoryLabel,
  getConsortiumLiquidationNumber,
  getConsortiumObligationStatus,
  getConsortiumObligationStatusLabel,
  getConsortiumPeriodLabel,
} from "../utils/consorcio.helpers";
import "../consorcio.css";

const formatDate = (value = "") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "No informada";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR").format(new Date(year, month - 1, day));
};

const formatTimestamp = (value) => {
  const date = value?.toDate?.() || (value?.seconds ? new Date(value.seconds * 1000) : null);
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date)
    : "Sin fecha registrada";
};

const ConsortiumAssessmentPage = ({ portalMode = false }) => {
  const {
    id: consortiumId = "",
    obligationId = "",
    inmobiliariaId: portalInmobiliariaId = "",
  } = useParams();
  const {
    activeInmobiliariaId,
    loading: agencyLoading,
  } = useActiveInmobiliariaModules();
  const inmobiliariaId = portalMode ? portalInmobiliariaId : activeInmobiliariaId;
  const [consortium, setConsortium] = useState(null);
  const [period, setPeriod] = useState(null);
  const [obligation, setObligation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!inmobiliariaId) return;
      try {
        setLoading(true);
        setError("");
        const obligationData = await getConsortiumObligationById(inmobiliariaId, obligationId);
        if (!obligationData || obligationData.consortiumId !== consortiumId) {
          throw new Error("La liquidación no existe para este consorcio.");
        }
        const [consortiumData, periodData] = await Promise.all([
          getConsortiumById(inmobiliariaId, consortiumId),
          getConsortiumPeriodById(inmobiliariaId, obligationData.periodId),
        ]);
        if (!consortiumData || !periodData || periodData.consortiumId !== consortiumId) {
          throw new Error("No se pudo reconstruir la liquidación emitida.");
        }
        if (mounted) {
          setConsortium(consortiumData);
          setPeriod(periodData);
          setObligation(obligationData);
        }
      } catch (loadError) {
        if (mounted) setError(loadError.message || "No se pudo cargar la liquidación.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [consortiumId, inmobiliariaId, obligationId]);

  const lines = useMemo(
    () => buildConsortiumLiquidationLines({ period, obligation }),
    [obligation, period],
  );
  const status = getConsortiumObligationStatus(obligation || {});
  const statusMeta = getConsortiumObligationStatusLabel(status);
  const unit = obligation?.unitSnapshot || {};
  const currency = obligation?.currency || period?.currency || consortium?.currency || "ARS";
  const liquidationNumber = getConsortiumLiquidationNumber({
    periodKey: obligation?.periodKey,
    unitCode: unit.code || obligation?.unitId,
  });
  const backTo = portalMode ? "/mi-consorcio" : `/admin/consorcios/${consortiumId}`;

  if (loading || (!portalMode && agencyLoading)) {
    return <main className="container py-5 text-center">Cargando liquidación...</main>;
  }
  if (error || !consortium || !period || !obligation) {
    return <main className="container py-5"><div className="alert alert-danger">{error || "Liquidación no encontrada."}</div></main>;
  }

  return (
    <main className="container py-4 consortium-assessment-page">
      <SEO title={`Liquidación ${obligation.periodKey} · Unidad ${unit.code} | ONO Prop`} noIndex />
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4 consortium-no-print">
        <Link className="btn btn-outline-secondary" to={backTo}>← Volver</Link>
        <button className="btn btn-primary" type="button" onClick={() => window.print()}>Imprimir / guardar PDF</button>
      </div>

      <article className="consortium-assessment-sheet">
        <header className="d-flex flex-wrap justify-content-between gap-4 border-bottom pb-3 mb-4">
          <div>
            <p className="text-uppercase text-muted small mb-1">Liquidación de expensas</p>
            <h1 className="h3 mb-1">{consortium.legalName || consortium.name}</h1>
            {consortium.legalName && consortium.name !== consortium.legalName && <p className="mb-1">{consortium.name}</p>}
            <p className="mb-0">{consortium.address}{consortium.city ? ` · ${consortium.city}` : ""}</p>
            {(consortium.taxId || consortium.registration) && <p className="small text-muted mb-0">{consortium.taxId ? `CUIT ${consortium.taxId}` : ""}{consortium.taxId && consortium.registration ? " · " : ""}{consortium.registration ? `Registro ${consortium.registration}` : ""}</p>}
          </div>
          <div className="text-end">
            <span className="badge text-bg-light text-dark border">{liquidationNumber}</span>
            <strong className="d-block mt-2">{getConsortiumPeriodLabel(obligation.periodKey)}</strong>
            <small className="d-block text-muted">Emitida: {formatTimestamp(period.issuedAt)}</small>
          </div>
        </header>

        <section className="row g-3 mb-4">
          <div className="col-md-7">
            <div className="rounded border p-3 h-100">
              <small className="text-muted text-uppercase">Unidad funcional</small>
              <h2 className="h4 mb-2">Unidad {unit.code || obligation.unitId}</h2>
              <div className="row g-2 small">
                <div className="col-sm-6"><strong>Piso:</strong> {unit.floor || "—"}</div>
                <div className="col-sm-6"><strong>Departamento:</strong> {unit.apartment || "—"}</div>
                <div className="col-sm-6"><strong>Titular informado:</strong> {unit.ownerName || "—"}</div>
                <div className="col-sm-6"><strong>Ocupante informado:</strong> {unit.occupantName || "—"}</div>
                <div className="col-sm-6"><strong>Coeficiente:</strong> {Number(unit.coefficient || 0).toLocaleString("es-AR", { maximumFractionDigits: 6 })}</div>
              </div>
            </div>
          </div>
          <div className="col-md-5">
            <div className="rounded border p-3 h-100">
              <small className="text-muted text-uppercase">Pago</small>
              <p className="mb-1"><strong>Vencimiento:</strong> {formatDate(obligation.dueDate)}</p>
              <p className="mb-1"><strong>CBU, CVU o alias:</strong> {consortium.bankAccount || "Consultar con la administración"}</p>
              <p className="mb-0"><strong>Estado actual:</strong> <span className={`badge ${statusMeta.badge}`}>{statusMeta.label}</span></p>
            </div>
          </div>
        </section>

        <section className="mb-4">
          <h2 className="h5">Detalle de gastos y prorrateo</h2>
          <div className="table-responsive">
            <table className="table table-sm consortium-assessment-table">
              <thead><tr><th>Concepto</th><th>Tipo</th><th>Distribución</th><th className="text-end">Gasto general</th><th className="text-end">Imputado a la unidad</th></tr></thead>
              <tbody>
                {lines.map((line, index) => <tr key={`${line.expenseId}_${index}`}><td>{line.concept}</td><td>{getConsortiumExpenseCategoryLabel(line.category)}</td><td>{getConsortiumDistributionLabel(line.distributionMode)}</td><td className="text-end consortium-money">{formatConsortiumMoney(line.expenseTotalMinor, currency)}</td><td className="text-end consortium-money fw-semibold">{formatConsortiumMoney(line.unitAmountMinor, currency)}</td></tr>)}
                {!lines.length && <tr><td className="text-center text-muted py-3" colSpan="5">No hay conceptos detallados.</td></tr>}
              </tbody>
              <tfoot><tr><th colSpan="3">Totales</th><th className="text-end consortium-money">{formatConsortiumMoney(period.totalExpensesMinor, currency)}</th><th className="text-end consortium-money">{formatConsortiumMoney(obligation.totalAmountMinor, currency)}</th></tr></tfoot>
            </table>
          </div>
        </section>

        <section className="row g-3 mb-4">
          <div className="col-md-4"><div className="rounded bg-light p-3 h-100"><small className="text-muted text-uppercase">Expensas ordinarias</small><strong className="fs-5 d-block consortium-money">{formatConsortiumMoney(obligation.ordinaryMinor, currency)}</strong></div></div>
          <div className="col-md-4"><div className="rounded bg-light p-3 h-100"><small className="text-muted text-uppercase">Expensas extraordinarias</small><strong className="fs-5 d-block consortium-money">{formatConsortiumMoney(obligation.extraordinaryMinor, currency)}</strong></div></div>
          <div className="col-md-4"><div className="rounded bg-primary-subtle p-3 h-100"><small className="text-muted text-uppercase">Total del período</small><strong className="fs-5 d-block consortium-money">{formatConsortiumMoney(obligation.totalAmountMinor, currency)}</strong></div></div>
        </section>

        <section className="rounded border p-3 mb-4">
          <div className="row g-3 align-items-center">
            <div className="col-md-4"><small className="text-muted text-uppercase">Pagos aplicados</small><strong className="d-block consortium-money">{formatConsortiumMoney(obligation.paidAmountMinor, currency)}</strong></div>
            <div className="col-md-4"><small className="text-muted text-uppercase">Saldo actual</small><strong className={`d-block fs-5 consortium-money ${Number(obligation.balanceMinor || 0) > 0 ? "text-danger" : "text-success"}`}>{formatConsortiumMoney(obligation.balanceMinor, currency)}</strong></div>
            <div className="col-md-4 text-md-end"><span className={`badge fs-6 ${statusMeta.badge}`}>{statusMeta.label}</span></div>
          </div>
        </section>

        <footer className="small text-muted border-top pt-3">
          <p className="mb-1">Documento de gestión emitido por ONO Prop a partir de la liquidación aprobada. No reemplaza el recibo de pago ni un comprobante fiscal.</p>
          <p className="mb-0">Los importes imputados corresponden a la fotografía del prorrateo al momento de emisión; pagos y saldo reflejan el estado actual registrado.</p>
        </footer>
      </article>
    </main>
  );
};

export default ConsortiumAssessmentPage;
