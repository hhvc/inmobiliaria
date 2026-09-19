import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import { getOnopropAcquisitionDashboard } from "../services/onopropAcquisition.service";
import {
    aggregateAcquisitionRecords,
    buildAcquisitionSearchCsv,
} from "../utils/onopropAcquisition.helpers";

const toLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const buildDefaultDates = () => {
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 29);
    return { dateFrom: toLocalDateKey(dateFrom), dateTo: toLocalDateKey(dateTo) };
};

const formatNumber = (value, digits = 0) => Number(value || 0).toLocaleString("es-AR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
});
const formatPercent = (value) => `${formatNumber(value, 1)}%`;

const downloadCsv = (content, filename) => {
    const blob = new Blob([`\ufeff${content}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};

const MetricCard = ({ label, value, detail, tone = "primary" }) => (
    <div className="col-sm-6 col-xl-3">
        <div className={`card h-100 border-0 shadow-sm border-start border-4 border-${tone}`}>
            <div className="card-body p-4">
                <span className="text-muted small text-uppercase">{label}</span>
                <strong className="display-6 d-block mt-1">{value}</strong>
                {detail && <small className="text-muted">{detail}</small>}
            </div>
        </div>
    </div>
);

const FunnelStep = ({ number, label, value, detail }) => (
    <div className="col-md-6 col-xl">
        <div className="card h-100 border-0 bg-light">
            <div className="card-body">
                <span className="badge rounded-pill text-bg-dark mb-2">{number}</span>
                <h3 className="h6 mb-1">{label}</h3>
                <strong className="fs-3 d-block">{formatNumber(value)}</strong>
                <small className="text-muted">{detail}</small>
            </div>
        </div>
    </div>
);

const OnopropAcquisitionDashboardPage = () => {
    const defaultDates = useMemo(buildDefaultDates, []);
    const [dateFrom, setDateFrom] = useState(defaultDates.dateFrom);
    const [dateTo, setDateTo] = useState(defaultDates.dateTo);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [truncated, setTruncated] = useState(false);

    useEffect(() => {
        let active = true;

        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const result = await getOnopropAcquisitionDashboard({ dateFrom, dateTo });
                if (!active) return;
                setRecords(Array.isArray(result.records) ? result.records : []);
                setTruncated(result.truncated === true);
            } catch (err) {
                if (!active) return;
                setRecords([]);
                setError(err.message || "No se pudo cargar la adquisición.");
            } finally {
                if (active) setLoading(false);
            }
        };

        load();
        return () => {
            active = false;
        };
    }, [dateFrom, dateTo]);

    const analytics = useMemo(() => aggregateAcquisitionRecords(records), [records]);
    const maxDailySearches = Math.max(
        1,
        ...analytics.daily.map((item) => Number(item.counters.searches || 0)),
    );

    const handleExport = () => downloadCsv(
        buildAcquisitionSearchCsv(analytics.searches),
        `adquisicion-onoprop-${dateFrom}-${dateTo}.csv`,
    );

    return (
        <main className="bg-body-tertiary min-vh-100 py-4 py-lg-5">
            <SEO
                title="Adquisición y conversión | ONO Prop"
                description="Panel interno de adquisición, demanda y conversión de ONO Prop."
                noIndex
            />
            <div className="container-fluid px-3 px-xl-5">
                <header className="d-flex flex-column flex-xl-row justify-content-between gap-3 align-items-xl-end mb-4">
                    <div>
                        <span className="badge rounded-pill text-bg-dark mb-2">ROOT · ONO Prop</span>
                        <h1 className="h2 mb-2">Adquisición y conversión</h1>
                        <p className="text-muted mb-0">
                            Demanda agregada desde ChatGPT, aperturas de publicaciones y contactos generados.
                        </p>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                        <Link className="btn btn-outline-secondary" to="/admin/dashboard">
                            Volver al panel
                        </Link>
                        <button
                            className="btn btn-outline-primary"
                            disabled={analytics.searches.length === 0}
                            onClick={handleExport}
                            type="button"
                        >
                            Exportar demanda
                        </button>
                    </div>
                </header>

                <section className="card border-0 shadow-sm mb-4">
                    <div className="card-body p-4">
                        <div className="row g-3 align-items-end">
                            <div className="col-sm-6 col-lg-3">
                                <label className="form-label" htmlFor="acquisition-date-from">Desde</label>
                                <input
                                    className="form-control"
                                    id="acquisition-date-from"
                                    max={dateTo}
                                    onChange={(event) => setDateFrom(event.target.value)}
                                    type="date"
                                    value={dateFrom}
                                />
                            </div>
                            <div className="col-sm-6 col-lg-3">
                                <label className="form-label" htmlFor="acquisition-date-to">Hasta</label>
                                <input
                                    className="form-control"
                                    id="acquisition-date-to"
                                    min={dateFrom}
                                    onChange={(event) => setDateTo(event.target.value)}
                                    type="date"
                                    value={dateTo}
                                />
                            </div>
                            <div className="col-lg-6">
                                <div className="alert alert-light border mb-0 small">
                                    <strong>Privacidad:</strong> se guardan filtros agregados y contadores. No se almacenan conversaciones, usuarios, emails, teléfonos ni el texto libre de las consultas.
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {error && <div className="alert alert-danger">{error}</div>}
                {truncated && (
                    <div className="alert alert-warning">
                        El período contiene más registros que el límite de la vista. Acortalo para obtener el detalle completo.
                    </div>
                )}

                {loading ? (
                    <div className="card border-0 shadow-sm">
                        <div className="card-body py-5 text-center">
                            <div className="spinner-border text-primary" role="status" />
                            <p className="text-muted mt-3 mb-0">Cargando adquisición...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <section className="row g-3 mb-4" aria-label="Métricas principales">
                            <MetricCard label="Búsquedas" value={formatNumber(analytics.summary.searches)} detail="consultas procesadas por el plugin" />
                            <MetricCard label="Sin resultados" value={formatNumber(analytics.summary.zeroResultSearches)} detail={formatPercent(analytics.summary.zeroResultRate)} tone="warning" />
                            <MetricCard label="Fichas abiertas" value={formatNumber(analytics.summary.detailViews)} detail={`${formatPercent(analytics.summary.listingOpenRate)} sobre búsquedas`} tone="info" />
                            <MetricCard label="Contactos" value={formatNumber(analytics.summary.contacts)} detail={`${formatPercent(analytics.summary.contactRate)} sobre fichas abiertas`} tone="success" />
                        </section>

                        <section className="card border-0 shadow-sm mb-4">
                            <div className="card-body p-4">
                                <div className="mb-3">
                                    <h2 className="h4 mb-1">Embudo ChatGPT → ONO Prop</h2>
                                    <p className="text-muted small mb-0">
                                        Las etapas representan señales distintas; no identifican personas individuales.
                                    </p>
                                </div>
                                <div className="row g-3">
                                    <FunnelStep number="1" label="Búsquedas" value={analytics.summary.searches} detail={`${formatNumber(analytics.summary.averageResults, 1)} resultados promedio`} />
                                    <FunnelStep number="2" label="Detalles consultados" value={analytics.summary.propertyDetails} detail="fichas pedidas dentro de ChatGPT" />
                                    <FunnelStep number="3" label="Publicaciones abiertas" value={analytics.summary.detailViews} detail="visitas verificadas en onoprop.com" />
                                    <FunnelStep number="4" label="Contactos" value={analytics.summary.contacts} detail="WhatsApp, email o formulario" />
                                    <FunnelStep number="5" label="Recorridos comerciales" value={analytics.summary.startRequests} detail="publicar, inmobiliarias, software o tasación" />
                                </div>
                            </div>
                        </section>

                        <section className="mb-4">
                            <div className="mb-3">
                                <h2 className="h4 mb-1">Conversiones verificadas</h2>
                                <p className="text-muted small mb-0">
                                    Acciones completadas después de una visita atribuida al conector de ChatGPT.
                                </p>
                            </div>
                            <div className="row g-3">
                                <MetricCard label="Cuentas creadas" value={formatNumber(analytics.summary.registrationsCompleted)} detail="registros nuevos atribuidos" tone="info" />
                                <MetricCard label="Publicaciones" value={formatNumber(analytics.summary.publicationsCompleted)} detail={`${formatNumber(analytics.summary.publicationStarts)} iniciadas`} tone="success" />
                                <MetricCard label="Inmobiliarias" value={formatNumber(analytics.summary.agenciesCompleted)} detail={`${formatNumber(analytics.summary.agencyOnboardingStarts)} altas iniciadas`} tone="primary" />
                                <MetricCard label="Tasaciones" value={formatNumber(analytics.summary.appraisalRequestsCompleted)} detail={`${formatNumber(analytics.summary.appraisalRequestStarts)} solicitudes iniciadas`} tone="warning" />
                                <MetricCard label="Consultas comerciales" value={formatNumber(analytics.summary.commercialLeadsSubmitted)} detail={`${formatNumber(analytics.summary.commercialInterestStarts)} recorridos iniciados`} tone="info" />
                                <MetricCard label="Servicios activos" value={formatNumber(analytics.summary.serviceContractsActivated)} detail={`${formatNumber(analytics.summary.serviceContractsRequested)} contrataciones solicitadas`} tone="success" />
                            </div>
                        </section>

                        <section className="card border-0 shadow-sm mb-4">
                            <div className="card-body p-4">
                                <h2 className="h4 mb-1">Recorrido de conversión</h2>
                                <p className="text-muted small">
                                    Son señales agregadas y pueden corresponder a recorridos distintos; no se perfilan personas.
                                </p>
                                <div className="row g-3 mb-4">
                                    <FunnelStep number="1" label="Opciones solicitadas" value={analytics.summary.startRequests} detail="enlaces comerciales entregados por ChatGPT" />
                                    <FunnelStep number="2" label="Procesos iniciados" value={analytics.summary.journeyStarts} detail="publicar, alta, tasación o servicios" />
                                    <FunnelStep number="3" label="Cuentas creadas" value={analytics.summary.registrationsCompleted} detail="registros atribuidos" />
                                    <FunnelStep number="4" label="Resultados completados" value={analytics.summary.completedOutcomes} detail={formatPercent(analytics.summary.journeyCompletionRate)} />
                                    <FunnelStep number="5" label="Servicios activados" value={analytics.summary.serviceContractsActivated} detail="contrataciones efectivamente activadas" />
                                </div>
                                {analytics.conversions.length === 0 ? (
                                    <div className="alert alert-light border mb-0">
                                        Todavía no hay conversiones atribuidas en este período.
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-hover align-middle mb-0">
                                            <thead>
                                                <tr>
                                                    <th>Conversión</th>
                                                    <th>Recorrido de origen</th>
                                                    <th className="text-end">Cantidad</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analytics.conversions.map((item) => (
                                                    <tr key={`${item.conversionType}:${item.attributionContent}`}>
                                                        <td>{item.label}</td>
                                                        <td>{item.goalLabel}</td>
                                                        <td className="text-end fw-semibold">{formatNumber(item.total)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </section>

                        <div className="row g-4 mb-4">
                            <div className="col-xl-7">
                                <section className="card border-0 shadow-sm h-100">
                                    <div className="card-body p-4">
                                        <h2 className="h4 mb-1">Búsquedas por día</h2>
                                        <p className="text-muted small">Volumen agregado procesado por ONO Prop.</p>
                                        {analytics.daily.length === 0 ? (
                                            <div className="alert alert-light border mb-0">Todavía no hay actividad registrada en este período.</div>
                                        ) : (
                                            <div className="d-grid gap-3">
                                                {analytics.daily.map((item) => {
                                                    const searches = item.counters.searches;
                                                    const width = (searches / maxDailySearches) * 100;
                                                    return (
                                                        <div key={item.dateKey}>
                                                            <div className="d-flex justify-content-between small mb-1">
                                                                <span>{item.dateKey}</span>
                                                                <strong>{formatNumber(searches)}</strong>
                                                            </div>
                                                            <div className="progress" style={{ height: 9 }}>
                                                                <div className="progress-bar" style={{ width: `${width}%` }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                            <div className="col-xl-5">
                                <section className="card border-0 shadow-sm h-100">
                                    <div className="card-body p-4">
                                        <h2 className="h4 mb-1">Intereses comerciales</h2>
                                        <p className="text-muted small">Qué pidió hacer la persona desde ChatGPT.</p>
                                        {analytics.goals.length === 0 ? (
                                            <div className="alert alert-light border mb-0">Sin recorridos comerciales registrados.</div>
                                        ) : (
                                            <div className="list-group list-group-flush">
                                                {analytics.goals.map((item) => (
                                                    <div className="list-group-item px-0 d-flex justify-content-between gap-3" key={item.goal}>
                                                        <span>{item.label}</span>
                                                        <strong>{formatNumber(item.requests)}</strong>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </div>

                        <section className="card border-0 shadow-sm mb-4">
                            <div className="card-body p-4">
                                <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                                    <div>
                                        <h2 className="h4 mb-1">Oportunidades sin oferta</h2>
                                        <p className="text-muted small mb-0">Filtros que devolvieron cero resultados y pueden orientar la captación de inventario.</p>
                                    </div>
                                    <span className="badge text-bg-warning align-self-start">
                                        {formatNumber(analytics.zeroResultSearches.length)} combinaciones
                                    </span>
                                </div>
                                {analytics.zeroResultSearches.length === 0 ? (
                                    <div className="alert alert-success mb-0">No hubo búsquedas sin resultados en el período.</div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-hover align-middle mb-0">
                                            <thead>
                                                <tr>
                                                    <th>Demanda agregada</th>
                                                    <th className="text-end">Búsquedas</th>
                                                    <th className="text-end">Sin resultados</th>
                                                    <th className="text-end">Tasa</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analytics.zeroResultSearches.slice(0, 30).map((item) => {
                                                    const rate = item.counters.searches > 0
                                                        ? (item.counters.zeroResultSearches / item.counters.searches) * 100
                                                        : 0;
                                                    return (
                                                        <tr key={JSON.stringify(item.search)}>
                                                            <td>{item.label}</td>
                                                            <td className="text-end">{formatNumber(item.counters.searches)}</td>
                                                            <td className="text-end fw-semibold text-warning-emphasis">{formatNumber(item.counters.zeroResultSearches)}</td>
                                                            <td className="text-end">{formatPercent(rate)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="card border-0 shadow-sm">
                            <div className="card-body p-4">
                                <h2 className="h4 mb-1">Demanda agregada</h2>
                                <p className="text-muted small">Todas las combinaciones de filtros registradas, sin conservar el texto de la conversación.</p>
                                {analytics.searches.length === 0 ? (
                                    <div className="alert alert-light border mb-0">Todavía no hay búsquedas registradas.</div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-striped align-middle mb-0">
                                            <thead>
                                                <tr>
                                                    <th>Búsqueda</th>
                                                    <th className="text-end">Veces</th>
                                                    <th className="text-end">Resultados</th>
                                                    <th className="text-end">Promedio</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analytics.searches.slice(0, 50).map((item) => (
                                                    <tr key={JSON.stringify(item.search)}>
                                                        <td>{item.label}</td>
                                                        <td className="text-end">{formatNumber(item.counters.searches)}</td>
                                                        <td className="text-end">{formatNumber(item.counters.resultsReturned)}</td>
                                                        <td className="text-end">
                                                            {formatNumber(
                                                                item.counters.searches > 0
                                                                    ? item.counters.resultsReturned / item.counters.searches
                                                                    : 0,
                                                                1,
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </main>
    );
};

export default OnopropAcquisitionDashboardPage;
