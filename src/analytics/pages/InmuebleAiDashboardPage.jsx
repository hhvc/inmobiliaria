import {useEffect, useMemo, useState} from "react";
import {Link} from "react-router-dom";

import SEO from "../../components/SEO";
import {getInmuebleAiDraftDashboard} from "../../inmueble/services/inmuebleAi.service";

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const defaultDateFrom = () => {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return toDateKey(date);
};

const emptyDashboard = {
  summary: {},
  daily: [],
  agencies: [],
  failures: [],
  models: [],
  operations: [],
};

const formatNumber = (value, maximumFractionDigits = 0) => Number(value || 0)
  .toLocaleString("es-AR", {maximumFractionDigits});

const formatPercent = (value) => `${formatNumber(Number(value || 0) * 100, 1)}%`;

const formatCost = (value) => `USD ${Number(value || 0).toLocaleString("es-AR", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
})}`;

const formatLatency = (value) => {
  const milliseconds = Number(value || 0);
  if (!milliseconds) return "—";
  return `${formatNumber(milliseconds / 1000, 1)} s`;
};

const MetricCard = ({label, value, detail, tone = "primary"}) => (
  <div className="col-sm-6 col-xl-3">
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <div className={`text-${tone} text-uppercase small fw-semibold mb-2`}>
          {label}
        </div>
        <div className="h3 mb-1">{value}</div>
        <div className="small text-muted">{detail}</div>
      </div>
    </div>
  </div>
);

const InmuebleAiDashboardPage = () => {
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(() => toDateKey(new Date()));
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const result = await getInmuebleAiDraftDashboard({dateFrom, dateTo});
        if (!cancelled) setDashboard({...emptyDashboard, ...result});
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo]);

  const summary = dashboard.summary || {};
  const operationTotals = Object.fromEntries(
    (dashboard.operations || []).map((item) => [
      item.operationType,
      Number(item.attempts || 0),
    ]),
  );
  const feedbackDetail = summary.feedbackTotal > 0
    ? `${formatNumber(summary.usefulFeedback)} útiles de ${formatNumber(summary.feedbackTotal)}`
    : "todavía sin valoraciones";
  const maxDailyAttempts = useMemo(() => Math.max(
    1,
    ...dashboard.daily.map((item) => Number(item.attempts || 0)),
  ), [dashboard.daily]);

  return (
    <>
      <SEO
        title="Uso de IA | Administración ONO Prop"
        description="Métricas privadas de la carga asistida con IA."
        noIndex
      />

      <main className="container-fluid px-3 px-xl-5 py-4">
        <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 align-items-xl-end mb-4">
          <div>
            <span className="badge rounded-pill text-bg-dark mb-2">ROOT · ONO Prop</span>
            <h1 className="h2 mb-2">Asistencia inmobiliaria con IA</h1>
            <p className="text-muted mb-0">
              Uso, resultados, costos estimados y valoración de borradores y revisiones.
            </p>
          </div>
          <Link className="btn btn-outline-secondary" to="/admin/dashboard">
            Volver al panel
          </Link>
        </header>

        <section className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4">
            <div className="row g-3 align-items-end">
              <div className="col-sm-6 col-lg-3">
                <label className="form-label" htmlFor="ai-date-from">Desde</label>
                <input
                  className="form-control"
                  id="ai-date-from"
                  max={dateTo}
                  onChange={(event) => setDateFrom(event.target.value)}
                  type="date"
                  value={dateFrom}
                />
              </div>
              <div className="col-sm-6 col-lg-3">
                <label className="form-label" htmlFor="ai-date-to">Hasta</label>
                <input
                  className="form-control"
                  id="ai-date-to"
                  min={dateFrom}
                  onChange={(event) => setDateTo(event.target.value)}
                  type="date"
                  value={dateTo}
                />
              </div>
              <div className="col-lg-6">
                <div className="alert alert-light border mb-0 small">
                  <strong>Privacidad:</strong> se registran contadores, tiempos, tokens y resultado técnico. No se guardan la descripción pegada, direcciones, teléfonos, emails ni respuestas completas de la IA.
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && <div className="alert alert-danger">{error}</div>}
        {dashboard.truncated && (
          <div className="alert alert-warning">
            El período supera los 5.000 eventos. Acortalo para obtener métricas completas.
          </div>
        )}

        {loading ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body py-5 text-center">
              <div className="spinner-border text-primary" role="status" />
              <p className="text-muted mt-3 mb-0">Cargando métricas de IA...</p>
            </div>
          </div>
        ) : (
          <>
            <section className="row g-3 mb-4" aria-label="Métricas principales de IA">
              <MetricCard
                label="Intentos"
                value={formatNumber(summary.attempts)}
                detail={`${formatPercent(summary.successRate)} completados`}
              />
              <MetricCard
                label="Propuestas aplicadas"
                value={formatNumber(summary.appliedDrafts)}
                detail={`${formatPercent(summary.applicationRate)} de los exitosos`}
                tone="success"
              />
              <MetricCard
                label="Valoración útil"
                value={formatPercent(summary.usefulRate)}
                detail={feedbackDetail}
                tone="warning"
              />
              <MetricCard
                label="Costo estimado"
                value={formatCost(summary.estimatedCostUsd)}
                detail={`${formatNumber(summary.totalTokens)} tokens · ${formatLatency(summary.averageLatencyMs)} promedio`}
                tone="info"
              />
            </section>

            <div className="row g-4 mb-4">
              <div className="col-xl-7">
                <section className="card border-0 shadow-sm h-100">
                  <div className="card-body p-4">
                    <h2 className="h4 mb-1">Actividad diaria</h2>
                    <p className="text-muted small">
                      El costo es orientativo y debe compararse con la facturación real de OpenAI.
                    </p>
                    {dashboard.daily.length === 0 ? (
                      <div className="alert alert-light border mb-0">
                        Todavía no hay generaciones registradas en este período.
                      </div>
                    ) : (
                      <div className="d-grid gap-3">
                        {dashboard.daily.map((item) => (
                          <div key={item.dayKey}>
                            <div className="d-flex justify-content-between small mb-1 gap-3">
                              <span>{item.dayKey}</span>
                              <span>
                                <strong>{formatNumber(item.attempts)}</strong> intentos · {formatNumber(item.appliedDrafts)} aplicados · {formatCost(item.estimatedCostUsd)}
                              </span>
                            </div>
                            <div className="progress" style={{height: 9}}>
                              <div
                                className="progress-bar"
                                style={{width: `${(item.attempts / maxDailyAttempts) * 100}%`}}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="col-xl-5">
                <section className="card border-0 shadow-sm h-100">
                  <div className="card-body p-4">
                    <h2 className="h4 mb-1">Calidad y adopción</h2>
                    <p className="text-muted small">Señales agregadas de las asistencias inmobiliarias.</p>
                    <dl className="row mb-0">
                      <dt className="col-7">Borradores preparados</dt>
                      <dd className="col-5 text-end">{formatNumber(operationTotals.draft)}</dd>
                      <dt className="col-7">Publicaciones revisadas</dt>
                      <dd className="col-5 text-end">{formatNumber(operationTotals.review)}</dd>
                      <dt className="col-7">Galerías revisadas</dt>
                      <dd className="col-5 text-end">{formatNumber(operationTotals.image_review)}</dd>
                      <dt className="col-7">Generaciones exitosas</dt>
                      <dd className="col-5 text-end">{formatNumber(summary.successes)}</dd>
                      <dt className="col-7">Errores</dt>
                      <dd className="col-5 text-end">{formatNumber(summary.failures)}</dd>
                      <dt className="col-7">Campos aplicados</dt>
                      <dd className="col-5 text-end">{formatNumber(summary.appliedFields)}</dd>
                      <dt className="col-7">Útiles</dt>
                      <dd className="col-5 text-end">{formatNumber(summary.usefulFeedback)}</dd>
                      <dt className="col-7">Necesitan mejorar</dt>
                      <dd className="col-5 text-end">{formatNumber(summary.improvementFeedback)}</dd>
                      <dt className="col-7">Tokens de entrada</dt>
                      <dd className="col-5 text-end">{formatNumber(summary.inputTokens)}</dd>
                      <dt className="col-7">Tokens de salida</dt>
                      <dd className="col-5 text-end">{formatNumber(summary.outputTokens)}</dd>
                    </dl>
                  </div>
                </section>
              </div>
            </div>

            <section className="card border-0 shadow-sm mb-4">
              <div className="card-body p-4">
                <h2 className="h4 mb-1">Uso por inmobiliaria</h2>
                <p className="text-muted small">
                  Los usuarios particulares aparecen agrupados y no se identifican individualmente.
                </p>
                {dashboard.agencies.length === 0 ? (
                  <div className="alert alert-light border mb-0">Sin actividad para mostrar.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Origen</th>
                          <th className="text-end">Intentos</th>
                          <th className="text-end">Éxito</th>
                          <th className="text-end">Aplicados</th>
                          <th className="text-end">Útiles</th>
                          <th className="text-end">Costo estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.agencies.map((item) => (
                          <tr key={item.inmobiliariaId}>
                            <td className="fw-semibold">{item.inmobiliariaNombre}</td>
                            <td className="text-end">{formatNumber(item.attempts)}</td>
                            <td className="text-end">{formatPercent(item.successRate)}</td>
                            <td className="text-end">{formatNumber(item.appliedDrafts)}</td>
                            <td className="text-end">{formatPercent(item.usefulRate)}</td>
                            <td className="text-end">{formatCost(item.estimatedCostUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {dashboard.failures.length > 0 && (
              <section className="card border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                  <h2 className="h4 mb-3">Errores técnicos agregados</h2>
                  <div className="d-flex flex-wrap gap-2">
                    {dashboard.failures.map((item) => (
                      <span className="badge text-bg-light border" key={item.type}>
                        {item.type}: {formatNumber(item.total)}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
};

export default InmuebleAiDashboardPage;

