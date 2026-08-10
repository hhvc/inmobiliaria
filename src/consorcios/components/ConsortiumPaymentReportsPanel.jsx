import {
  CONSORTIUM_PAYMENT_METHODS,
} from "../utils/consorcio.constants";
import { formatConsortiumMoney } from "../utils/consorcio.helpers";
import { getPaymentReportStatus } from "../utils/consorcioPortal.helpers";
import ConsortiumPrivateDocumentButton from "./ConsortiumPrivateDocumentButton";

const ConsortiumPaymentReportsPanel = ({
  reports = [],
  periodId = "",
  canManage = false,
  operation = "",
  onApprove,
  onReject,
}) => {
  const visibleReports = periodId
    ? reports.filter((item) => item.periodId === periodId)
    : reports;

  return (
    <section className="rounded border bg-light p-3 mb-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h3 className="h6 mb-1">Pagos informados por consorcistas</h3>
          <p className="text-muted small mb-0">La deuda solo se cancela cuando la administración aprueba el informe.</p>
        </div>
        <span className="badge text-bg-warning">{visibleReports.filter((item) => item.status === "pending").length} pendientes</span>
      </div>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead><tr><th>Unidad</th><th>Fecha</th><th>Importe</th><th>Medio / referencia</th><th>Estado</th><th className="text-end">Acciones</th></tr></thead>
          <tbody>
            {visibleReports.map((report) => {
              const state = getPaymentReportStatus(report.status);
              const method = CONSORTIUM_PAYMENT_METHODS.find((item) => item.id === report.method)?.label || report.method;
              return (
                <tr key={report.id}>
                  <td><strong>{report.unitSnapshot?.code || report.unitId}</strong><small className="d-block text-muted">{report.submittedByEmail}</small></td>
                  <td>{report.date}</td>
                  <td className="consortium-money">{formatConsortiumMoney(report.amountMinor, report.currency)}</td>
                  <td><div>{method}</div><small className="text-muted">{report.reference || "Sin referencia"}</small></td>
                  <td><span className={`badge ${state.badge}`}>{state.label}</span>{report.rejectionReason && <small className="d-block text-danger">{report.rejectionReason}</small>}</td>
                  <td className="text-end"><div className="d-flex flex-wrap justify-content-end gap-2"><ConsortiumPrivateDocumentButton path={report.proofStoragePath} fileName={report.proofFileName} label="Comprobante" />{canManage && report.status === "pending" && <><button className="btn btn-sm btn-success" disabled={Boolean(operation)} type="button" onClick={() => onApprove(report)}>Aprobar</button><button className="btn btn-sm btn-outline-danger" disabled={Boolean(operation)} type="button" onClick={() => onReject(report)}>Rechazar</button></>}</div></td>
                </tr>
              );
            })}
            {!visibleReports.length && <tr><td className="text-center text-muted py-3" colSpan="6">No hay pagos informados para este período.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ConsortiumPaymentReportsPanel;
