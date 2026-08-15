import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import { getArcaOverview } from "../services/arca.service";
import { getRentalContracts } from "../services/rental.service";
import {
  ARCA_VOUCHER_CENTER_STATUS,
  buildArcaVoucherCenterCsv,
  buildArcaVoucherCenterRows,
  filterArcaVoucherCenterRows,
  summarizeArcaVoucherCenterRows,
} from "../utils/arcaVoucherCenter.helpers";
import { formatRentalMoney } from "../utils/rental.helpers";
import "../rental.css";

const emptyFilters = {
  search: "",
  kind: "",
  status: "",
  profileId: "",
  dateFrom: "",
  dateTo: "",
};

const formatDate = (value = "") => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value || "—";
};

const downloadCsv = (content) => {
  const blob = new Blob([content], {type: "text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `comprobantes-arca-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const RentalArcaVoucherCenterPage = () => {
  const {
    activeInmobiliariaId,
    activeInmobiliaria,
    loading: agencyLoading,
  } = useActiveInmobiliariaModules();
  const [rows, setRows] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const [overview, contracts] = await Promise.all([
        getArcaOverview(activeInmobiliariaId),
        getRentalContracts(activeInmobiliariaId),
      ]);
      setProfiles(overview.profiles || []);
      setRows(buildArcaVoucherCenterRows({
        documents: overview.productionPreviews || [],
        contracts,
        profiles: overview.profiles || [],
      }));
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar los comprobantes ARCA.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId]);

  useEffect(() => { load(); }, [load]);

  const visibleRows = useMemo(
    () => filterArcaVoucherCenterRows(rows, filters),
    [rows, filters],
  );
  const summary = useMemo(
    () => summarizeArcaVoucherCenterRows(visibleRows),
    [visibleRows],
  );

  const updateFilter = (field, value) => setFilters((current) => ({
    ...current,
    [field]: value,
  }));

  return (
    <main className="container py-4 rental-workspace">
      <SEO title="Centro de comprobantes ARCA | ONO Prop" noIndex />
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">Administración fiscal</p>
          <h1 className="h3 mb-1">Centro de comprobantes ARCA</h1>
          <p className="text-muted mb-0">
            {activeInmobiliaria?.nombre || "Inmobiliaria activa"} · Facturas C, Notas de Crédito C y seguimiento operativo.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-outline-secondary" to="/admin/alquileres">Volver a alquileres</Link>
          <button
            type="button"
            className="btn btn-outline-success"
            disabled={visibleRows.length === 0}
            onClick={() => downloadCsv(buildArcaVoucherCenterCsv(visibleRows))}
          >
            Exportar CSV
          </button>
        </div>
      </header>

      <section className="row g-3 mb-4" aria-label="Resumen de comprobantes ARCA">
        {[
          ["Facturado", formatRentalMoney(summary.invoicedMinor, "ARS"), `${summary.invoiceCount} Factura C`, "border-primary"],
          ["Notas de crédito", formatRentalMoney(summary.creditedMinor, "ARS"), `${summary.creditNoteCount} autorizadas`, "border-danger"],
          ["Neto fiscal", formatRentalMoney(summary.netMinor, "ARS"), `${summary.authorizedCount} comprobantes autorizados`, "border-success"],
          ["Requieren acción", summary.actionRequiredCount, "Preparados, rechazados o por conciliar", "border-warning"],
        ].map(([label, value, hint, border]) => (
          <div className="col-sm-6 col-xl-3" key={label}>
            <div className={`card h-100 border-0 shadow-sm border-start border-4 ${border}`}>
              <div className="card-body">
                <div className="small text-uppercase text-muted">{label}</div>
                <strong className="fs-4 d-block">{value}</strong>
                <small className="text-muted">{hint}</small>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-lg-4">
              <label className="form-label" htmlFor="arcaCenterSearch">Buscar</label>
              <input
                id="arcaCenterSearch"
                className="form-control"
                type="search"
                placeholder="Número, emisor, receptor, CUIT, inmueble o CAE..."
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
              />
            </div>
            <div className="col-sm-6 col-lg-2">
              <label className="form-label" htmlFor="arcaCenterType">Tipo</label>
              <select id="arcaCenterType" className="form-select" value={filters.kind} onChange={(event) => updateFilter("kind", event.target.value)}>
                <option value="">Todos</option>
                <option value="invoice">Facturas C</option>
                <option value="credit_note">Notas de Crédito C</option>
              </select>
            </div>
            <div className="col-sm-6 col-lg-2">
              <label className="form-label" htmlFor="arcaCenterStatus">Estado</label>
              <select id="arcaCenterStatus" className="form-select" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                <option value="">Todos</option>
                {Object.entries(ARCA_VOUCHER_CENTER_STATUS).map(([value, meta]) => (
                  <option value={value} key={value}>{meta.label}</option>
                ))}
              </select>
            </div>
            <div className="col-lg-4">
              <label className="form-label" htmlFor="arcaCenterIssuer">Emisor</label>
              <select id="arcaCenterIssuer" className="form-select" value={filters.profileId} onChange={(event) => updateFilter("profileId", event.target.value)}>
                <option value="">Todos los emisores</option>
                {profiles.map((profile) => (
                  <option value={profile.id} key={profile.id}>{profile.issuerLegalName || profile.name} · {profile.issuerCuit}</option>
                ))}
              </select>
            </div>
            <div className="col-sm-6 col-lg-3">
              <label className="form-label" htmlFor="arcaCenterFrom">Desde</label>
              <input id="arcaCenterFrom" className="form-control" type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
            </div>
            <div className="col-sm-6 col-lg-3">
              <label className="form-label" htmlFor="arcaCenterTo">Hasta</label>
              <input id="arcaCenterTo" className="form-control" type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
            </div>
            <div className="col-lg-6 d-flex align-items-end justify-content-lg-end">
              <button type="button" className="btn btn-link" onClick={() => setFilters(emptyFilters)}>Limpiar filtros</button>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="alert alert-danger">{error}</div>}
      {(loading || agencyLoading) && <div className="text-center py-5">Cargando comprobantes...</div>}
      {!loading && !agencyLoading && !error && visibleRows.length === 0 && (
        <section className="card border-0 shadow-sm">
          <div className="card-body p-5 text-center">
            <h2 className="h5">No hay comprobantes para mostrar</h2>
            <p className="text-muted mb-3">Probá limpiar los filtros o emití el primer comprobante desde un contrato.</p>
            <Link className="btn btn-primary" to="/admin/alquileres">Ir a contratos</Link>
          </div>
        </section>
      )}

      {!loading && !agencyLoading && !error && visibleRows.length > 0 && (
        <section className="card border-0 shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Comprobante</th>
                    <th>Emisor / receptor</th>
                    <th>Contrato</th>
                    <th className="text-end">Importe</th>
                    <th>Estado</th>
                    <th className="text-end">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const status = ARCA_VOUCHER_CENTER_STATUS[row.status];
                    const detailId = row.kind === "credit_note" && row.status !== "authorized"
                      ? row.associatedPreviewId
                      : row.id;
                    const detailUrl = detailId
                      ? `/admin/alquileres/${row.contractId}/comprobantes/${detailId}`
                      : `/admin/alquileres/${row.contractId}`;
                    return (
                      <tr key={row.id}>
                        <td className="text-nowrap">{formatDate(row.date)}</td>
                        <td>
                          <strong className="d-block">{row.typeLabel}</strong>
                          <span className="small">{row.voucherNumber}</span>
                          {row.cae && <small className="d-block text-muted">CAE {row.cae}</small>}
                        </td>
                        <td>
                          <strong className="d-block">{row.issuerName}</strong>
                          <small className="d-block text-muted">CUIT {row.issuerCuit}</small>
                          <span className="d-block mt-1">{row.recipientName}</span>
                          {row.recipientDocument && <small className="text-muted">Doc. {row.recipientDocument}</small>}
                        </td>
                        <td>
                          <Link to={`/admin/alquileres/${row.contractId}`}>{row.contractLabel}</Link>
                          {row.periodLabel && <small className="d-block text-muted">{row.periodLabel}</small>}
                        </td>
                        <td className={`text-end fw-semibold ${row.kind === "credit_note" ? "text-danger" : ""}`}>
                          {row.kind === "credit_note" ? "− " : ""}{formatRentalMoney(row.amountMinor, "ARS")}
                        </td>
                        <td>
                          <span className={`badge ${status?.badge || "text-bg-secondary"}`}>{status?.label || row.status}</span>
                          {row.kind === "invoice" && row.relatedCreditNotesCount > 0 && (
                            <small className="d-block text-muted mt-1">
                              {row.relatedCreditNotesCount} NC · {formatRentalMoney(row.authorizedCreditsMinor, "ARS")} acreditado
                            </small>
                          )}
                          {row.kind === "credit_note" && row.associatedVoucherNumber && (
                            <small className="d-block text-muted mt-1">Asociada a {row.associatedVoucherNumber}</small>
                          )}
                        </td>
                        <td className="text-end text-nowrap">
                          <Link className={`btn btn-sm ${row.status === "authorized" ? "btn-outline-success" : "btn-outline-primary"}`} to={detailUrl}>
                            {row.status === "authorized" ? "Ver / enviar" : "Continuar"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </main>
  );
};

export default RentalArcaVoucherCenterPage;
