import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import { getInmobiliariaBranches } from "../../inmobiliaria/services/agencyNetwork.service";
import { getPortalPerformanceDashboard } from "../services/portalPerformance.service";
import {
    aggregatePerformanceRecords,
    buildPerformanceCsv,
    filterPerformanceRecords,
} from "../utils/portalPerformance.helpers";

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

const formatNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString("es-AR") : value;
};
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatShortDate = (dateKey) => {
    const [year, month, day] = (dateKey || "").split("-");
    return day && month && year ? `${day}/${month}` : dateKey;
};

const downloadCsv = (content, filename) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
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
    <div className="col-6 col-lg">
        <div className={`card h-100 border-0 shadow-sm performance-metric-card tone-${tone}`}>
            <div className="card-body">
                <div className="small text-muted mb-1">{label}</div>
                <div className="fs-3 fw-bold">{formatNumber(value)}</div>
                {detail && <div className="small text-muted mt-1">{detail}</div>}
            </div>
        </div>
    </div>
);

const ComparisonColumn = ({ title, data, promoted }) => (
    <div className="col-md-6">
        <div className={`performance-comparison-card ${promoted ? "is-promoted" : ""}`}>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="h6 mb-0">{title}</h3>
                <span className={`badge ${promoted ? "text-bg-warning" : "text-bg-light"}`}>
                    {promoted ? "Con inversión" : "Sin inversión"}
                </span>
            </div>
            <div className="row g-3">
                <div className="col-4">
                    <span className="small text-muted d-block">Visitas</span>
                    <strong>{formatNumber(data.detailViews)}</strong>
                </div>
                <div className="col-4">
                    <span className="small text-muted d-block">Favoritos</span>
                    <strong>{formatNumber(data.favoriteAdds)}</strong>
                </div>
                <div className="col-4">
                    <span className="small text-muted d-block">Contactos</span>
                    <strong>{formatNumber(data.contacts)}</strong>
                </div>
            </div>
        </div>
    </div>
);

const PortalPerformanceDashboardPage = () => {
    const { activeInmobiliariaId, activeInmobiliaria, loading: agencyLoading } =
        useActiveInmobiliariaModules();
    const [searchParams, setSearchParams] = useSearchParams();
    const defaultDates = useMemo(buildDefaultDates, []);
    const [dateFrom, setDateFrom] = useState(defaultDates.dateFrom);
    const [dateTo, setDateTo] = useState(defaultDates.dateTo);
    const [records, setRecords] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [truncated, setTruncated] = useState(false);
    const [filters, setFilters] = useState({
        branchId: "",
        inmuebleId: searchParams.get("inmuebleId") || "",
        operation: "",
        promotion: "",
    });

    useEffect(() => {
        let active = true;
        if (!activeInmobiliariaId) {
            setBranches([]);
            return undefined;
        }

        getInmobiliariaBranches(activeInmobiliariaId, { includeInactive: true })
            .then((items) => {
                if (active) setBranches(items);
            })
            .catch((err) => {
                console.warn("No se pudieron cargar las sucursales:", err);
                if (active) setBranches([]);
            });

        return () => {
            active = false;
        };
    }, [activeInmobiliariaId]);

    useEffect(() => {
        let active = true;

        const loadDashboard = async () => {
            if (!activeInmobiliariaId) return;
            setLoading(true);
            setError("");

            try {
                const result = await getPortalPerformanceDashboard({
                    inmobiliariaId: activeInmobiliariaId,
                    dateFrom,
                    dateTo,
                });
                if (!active) return;
                setRecords(Array.isArray(result.records) ? result.records : []);
                setTruncated(result.truncated === true);
            } catch (err) {
                if (!active) return;
                setRecords([]);
                setError(err.message || "No se pudo cargar el rendimiento.");
            } finally {
                if (active) setLoading(false);
            }
        };

        loadDashboard();
        return () => {
            active = false;
        };
    }, [activeInmobiliariaId, dateFrom, dateTo]);

    const propertyOptions = useMemo(() => {
        const byId = new Map();
        records.forEach((record) => {
            if (!record.inmuebleId || byId.has(record.inmuebleId)) return;
            byId.set(record.inmuebleId, {
                id: record.inmuebleId,
                title: record.inmuebleTitle || "Inmueble publicado",
            });
        });
        return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));
    }, [records]);

    const operations = useMemo(() => Array.from(new Set(
        records.map((record) => record.inmuebleOperation).filter(Boolean),
    )).sort(), [records]);

    const filteredRecords = useMemo(
        () => filterPerformanceRecords(records, filters),
        [filters, records],
    );
    const analytics = useMemo(
        () => aggregatePerformanceRecords(filteredRecords),
        [filteredRecords],
    );
    const maxDailyViews = Math.max(
        1,
        ...analytics.daily.map((item) => Number(item.counters.detailViews || 0)),
    );

    const updateFilter = (key, value) => {
        setFilters((current) => ({ ...current, [key]: value }));
        if (key === "inmuebleId") {
            const next = new URLSearchParams(searchParams);
            if (value) next.set("inmuebleId", value);
            else next.delete("inmuebleId");
            setSearchParams(next, { replace: true });
        }
    };

    const resetFilters = () => {
        setFilters({ branchId: "", inmuebleId: "", operation: "", promotion: "" });
        setSearchParams({}, { replace: true });
    };

    const handleExport = () => {
        const csv = buildPerformanceCsv(analytics.properties);
        downloadCsv(csv, `rendimiento-publicaciones-${dateFrom}-${dateTo}.csv`);
    };

    if (agencyLoading && !activeInmobiliariaId) {
        return <div className="container py-5">Cargando inmobiliaria...</div>;
    }

    if (!activeInmobiliariaId) {
        return (
            <div className="container py-5">
                <div className="alert alert-warning">Seleccioná una inmobiliaria para continuar.</div>
            </div>
        );
    }

    return (
        <main className="performance-dashboard py-4 py-lg-5">
            <div className="container">
                <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-lg-end mb-4">
                    <div>
                        <span className="badge rounded-pill text-bg-primary mb-2">
                            {activeInmobiliaria?.nombre || "Inmobiliaria"}
                        </span>
                        <h1 className="h2 mb-2">Rendimiento de publicaciones</h1>
                        <p className="text-muted mb-0">
                            Medí visitas, intención de contacto y resultados de los avisos destacados.
                        </p>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="btn btn-outline-primary"
                            onClick={handleExport}
                            disabled={analytics.properties.length === 0}
                        >
                            Exportar CSV
                        </button>
                        <Link to="/admin/inmuebles/listado" className="btn btn-primary">
                            Ver publicaciones
                        </Link>
                    </div>
                </div>

                <section className="card border-0 shadow-sm mb-4" aria-label="Filtros de rendimiento">
                    <div className="card-body">
                        <div className="row g-3 align-items-end">
                            <div className="col-6 col-lg-2">
                                <label className="form-label" htmlFor="performance-date-from">Desde</label>
                                <input
                                    id="performance-date-from"
                                    type="date"
                                    className="form-control"
                                    value={dateFrom}
                                    max={dateTo}
                                    onChange={(event) => setDateFrom(event.target.value)}
                                />
                            </div>
                            <div className="col-6 col-lg-2">
                                <label className="form-label" htmlFor="performance-date-to">Hasta</label>
                                <input
                                    id="performance-date-to"
                                    type="date"
                                    className="form-control"
                                    value={dateTo}
                                    min={dateFrom}
                                    onChange={(event) => setDateTo(event.target.value)}
                                />
                            </div>
                            <div className="col-md-6 col-lg-2">
                                <label className="form-label" htmlFor="performance-branch">Sucursal</label>
                                <select
                                    id="performance-branch"
                                    className="form-select"
                                    value={filters.branchId}
                                    onChange={(event) => updateFilter("branchId", event.target.value)}
                                >
                                    <option value="">Todas</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-6 col-lg-3">
                                <label className="form-label" htmlFor="performance-property">Inmueble</label>
                                <select
                                    id="performance-property"
                                    className="form-select"
                                    value={filters.inmuebleId}
                                    onChange={(event) => updateFilter("inmuebleId", event.target.value)}
                                >
                                    <option value="">Todos</option>
                                    {propertyOptions.map((item) => (
                                        <option key={item.id} value={item.id}>{item.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-6 col-lg">
                                <label className="form-label" htmlFor="performance-operation">Operación</label>
                                <select
                                    id="performance-operation"
                                    className="form-select"
                                    value={filters.operation}
                                    onChange={(event) => updateFilter("operation", event.target.value)}
                                >
                                    <option value="">Todas</option>
                                    {operations.map((operation) => (
                                        <option key={operation} value={operation}>{operation}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-6 col-lg">
                                <label className="form-label" htmlFor="performance-promotion">Destaque</label>
                                <select
                                    id="performance-promotion"
                                    className="form-select"
                                    value={filters.promotion}
                                    onChange={(event) => updateFilter("promotion", event.target.value)}
                                >
                                    <option value="">Todos</option>
                                    <option value="promoted">Destacados</option>
                                    <option value="organic">Orgánicos</option>
                                </select>
                            </div>
                        </div>
                        {(filters.branchId || filters.inmuebleId || filters.operation || filters.promotion) && (
                            <button type="button" className="btn btn-link px-0 mt-3" onClick={resetFilters}>
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                </section>

                {error && <div className="alert alert-danger">{error}</div>}
                {truncated && (
                    <div className="alert alert-warning">
                        El período contiene muchos registros. Acortalo para ver el detalle completo.
                    </div>
                )}

                {loading ? (
                    <div className="performance-loading card border-0 shadow-sm text-center py-5">
                        <div className="spinner-border text-primary mx-auto" role="status" />
                        <span className="mt-3 text-muted">Calculando rendimiento...</span>
                    </div>
                ) : (
                    <>
                        <section className="row g-3 mb-4" aria-label="Resumen de rendimiento">
                            <MetricCard label="Visitas al detalle" value={analytics.summary.detailViews} tone="primary" />
                            <MetricCard label="Guardados" value={analytics.summary.favoriteAdds} tone="warning" />
                            <MetricCard label="Clicks a WhatsApp" value={analytics.summary.whatsappClicks} tone="success" />
                            <MetricCard label="Clicks a email" value={analytics.summary.emailClicks} tone="info" />
                            <MetricCard label="Consultas enviadas" value={analytics.summary.inquiries} tone="info" />
                            <MetricCard
                                label="Conversión a contacto"
                                value={formatPercent(analytics.summary.conversionRate)}
                                detail={`${formatNumber(analytics.summary.contacts)} contactos totales`}
                                tone="dark"
                            />
                        </section>

                        {records.length === 0 ? (
                            <div className="card border-0 shadow-sm text-center py-5 px-3">
                                <div className="display-6 mb-3" aria-hidden="true">📊</div>
                                <h2 className="h5">Todavía no hay interacciones registradas</h2>
                                <p className="text-muted mb-0">
                                    Los datos comenzarán a aparecer con las próximas visitas y consultas públicas.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="row g-4 mb-4">
                                    <div className="col-lg-7">
                                        <section className="card border-0 shadow-sm h-100">
                                            <div className="card-body">
                                                <h2 className="h5">Visitas por día</h2>
                                                <p className="small text-muted">Aperturas de la ficha completa, sin contar repeticiones diarias del mismo navegador.</p>
                                                <div className="performance-daily-chart" role="img" aria-label="Gráfico de visitas diarias">
                                                    {analytics.daily.map((item) => {
                                                        const value = item.counters.detailViews;
                                                        const height = Math.max(4, (value / maxDailyViews) * 100);
                                                        return (
                                                            <div className="performance-daily-column" key={item.dateKey} title={`${item.dateKey}: ${value} visitas`}>
                                                                <span className="performance-daily-value">{value}</span>
                                                                <span className="performance-daily-bar" style={{ height: `${height}%` }} />
                                                                <span className="performance-daily-label">{formatShortDate(item.dateKey)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </section>
                                    </div>
                                    <div className="col-lg-5">
                                        <section className="card border-0 shadow-sm h-100">
                                            <div className="card-body">
                                                <h2 className="h5">Origen de las visitas</h2>
                                                <p className="small text-muted">Dónde encontró el público cada publicación.</p>
                                                <div className="d-grid gap-3">
                                                    {analytics.sources.map((item) => {
                                                        const width = analytics.summary.detailViews > 0
                                                            ? (item.counters.detailViews / analytics.summary.detailViews) * 100
                                                            : 0;
                                                        return (
                                                            <div key={item.source}>
                                                                <div className="d-flex justify-content-between small mb-1">
                                                                    <span>{item.label}</span>
                                                                    <strong>{formatNumber(item.counters.detailViews)}</strong>
                                                                </div>
                                                                <div className="progress" style={{ height: 8 }}>
                                                                    <div className="progress-bar" style={{ width: `${width}%` }} />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </section>
                                    </div>
                                </div>

                                <section className="card border-0 shadow-sm mb-4">
                                    <div className="card-body">
                                        <div className="mb-3">
                                            <h2 className="h5 mb-1">Destacados frente a orgánicos</h2>
                                            <p className="small text-muted mb-0">
                                                Comparación de resultados según el estado del aviso al momento de la interacción.
                                            </p>
                                        </div>
                                        <div className="row g-3">
                                            <ComparisonColumn title="Publicaciones destacadas" data={analytics.comparison.promoted} promoted />
                                            <ComparisonColumn title="Publicaciones orgánicas" data={analytics.comparison.organic} />
                                        </div>
                                    </div>
                                </section>

                                <section className="card border-0 shadow-sm">
                                    <div className="card-body p-0">
                                        <div className="p-4 pb-2">
                                            <h2 className="h5 mb-1">Ranking de publicaciones</h2>
                                            <p className="small text-muted mb-0">Ordenado por contactos y luego por visitas.</p>
                                        </div>
                                        <div className="table-responsive">
                                            <table className="table align-middle mb-0 performance-ranking-table">
                                                <thead>
                                                    <tr>
                                                        <th>Publicación</th>
                                                        <th>Estado</th>
                                                        <th className="text-end">Visitas</th>
                                                        <th className="text-end">Favoritos</th>
                                                        <th className="text-end">Contactos</th>
                                                        <th className="text-end">Conversión</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {analytics.properties.map((item) => (
                                                        <tr key={`${item.ownerAgencyId}:${item.inmuebleId}`}>
                                                            <td>
                                                                <Link to={`/inmueble/${item.inmuebleSlug}`} className="fw-semibold text-decoration-none">
                                                                    {item.inmuebleTitle}
                                                                </Link>
                                                                <div className="small text-muted text-capitalize">
                                                                    {[item.inmuebleType, item.inmuebleOperation].filter(Boolean).join(" · ")}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${item.promoted ? "text-bg-warning" : "text-bg-light"}`}>
                                                                    {item.promoted ? "Destacado" : "Orgánico"}
                                                                </span>
                                                            </td>
                                                            <td className="text-end">{formatNumber(item.counters.detailViews)}</td>
                                                            <td className="text-end">{formatNumber(item.counters.favoriteAdds)}</td>
                                                            <td className="text-end fw-semibold">{formatNumber(item.contacts)}</td>
                                                            <td className="text-end">{formatPercent(item.conversionRate)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </section>
                            </>
                        )}
                    </>
                )}
            </div>
        </main>
    );
};

export default PortalPerformanceDashboardPage;
