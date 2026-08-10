import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import InteractiveMap from "../components/InteractiveMap";
import PropertyTypeLegend from "../components/PropertyTypeLegend";
import { getAllPublicInmueblesForMap } from "../services/mapa.service";
import { buildInmuebleMapPoint } from "../utils/mapa.helpers";
import "../mapa.css";

const OPERATION_OPTIONS = [
  { value: "", label: "Todas las operaciones" },
  { value: "venta", label: "Venta" },
  { value: "alquiler", label: "Alquiler" },
  { value: "alquiler_temporal", label: "Alquiler temporal" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Todos los tipos" },
  { value: "casa", label: "Casas" },
  { value: "departamento", label: "Departamentos" },
  { value: "terreno", label: "Terrenos" },
  { value: "local", label: "Locales" },
  { value: "oficina", label: "Oficinas" },
  { value: "campo", label: "Campos" },
];

const MapaPortalPage = () => {
  const [inmuebles, setInmuebles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [operation, setOperation] = useState("");
  const [type, setType] = useState("");
  const [selectedPoint, setSelectedPoint] = useState(null);

  useEffect(() => {
    let mounted = true;
    getAllPublicInmueblesForMap()
      .then((items) => {
        if (mounted) setInmuebles(items);
      })
      .catch((loadError) => {
        if (mounted) {
          setError(loadError.message || "No se pudieron cargar los inmuebles.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredInmuebles = useMemo(
    () =>
      inmuebles.filter((item) => {
        if (operation && item.operacion !== operation) return false;
        if (type && item.tipo !== type) return false;
        return true;
      }),
    [inmuebles, operation, type],
  );

  const points = useMemo(
    () =>
      filteredInmuebles
        .map((item) => buildInmuebleMapPoint(item, { publicView: true }))
        .filter(Boolean),
    [filteredInmuebles],
  );
  const missingLocationCount = filteredInmuebles.length - points.length;

  useEffect(() => {
    if (
      selectedPoint &&
      !points.some((point) => point.id === selectedPoint.id)
    ) {
      setSelectedPoint(null);
    }
  }, [points, selectedPoint]);

  return (
    <main className="container-fluid px-3 px-lg-4 py-4 mapa-portal-page">
      <SEO
        title="Mapa de inmuebles | ONO Prop"
        description="Explorá en el mapa inmuebles publicados por inmobiliarias en ONO Prop."
      />

      <header className="mb-3">
        <h1 className="h3 mb-1">Mapa de inmuebles</h1>
        <p className="text-muted mb-0">
          Las ubicaciones públicas se muestran con precisión aproximada.
        </p>
      </header>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <select
          className="form-select mapa-filter"
          value={operation}
          onChange={(event) => setOperation(event.target.value)}
          aria-label="Filtrar por operación"
        >
          {OPERATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="form-select mapa-filter"
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-label="Filtrar por tipo de inmueble"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="align-self-center text-muted small">
          {points.length} ubicaciones visibles
        </span>
      </div>

      <PropertyTypeLegend />

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <div className="py-5 text-center">Cargando mapa...</div>
      ) : (
        <div className="row g-3">
          <div className="col-12 col-lg-9">
            <InteractiveMap
              points={points}
              zoom={14}
              fitToPoints
              selectedPointId={selectedPoint?.id || ""}
              onSelectPoint={setSelectedPoint}
              className="mapa-portal-map"
            />
          </div>
          <aside className="col-12 col-lg-3">
            {selectedPoint ? (
              <div className="card shadow-sm mapa-selected-card">
                <div className="card-body">
                  <p className="text-uppercase text-muted small mb-1">
                    {selectedPoint.operation || "Inmueble"}
                  </p>
                  <h2 className="h5">{selectedPoint.title}</h2>
                  {selectedPoint.address && <p>{selectedPoint.address}</p>}
                  <p className="h5">{selectedPoint.priceLabel}</p>
                  {selectedPoint.slug && (
                    <Link
                      className="btn btn-primary w-100"
                      to={`/inmueble/${selectedPoint.slug}`}
                    >
                      Ver publicación
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="alert alert-light border">
                Seleccioná un punto para ver la publicación.
              </div>
            )}
            {missingLocationCount > 0 && (
              <div className="alert alert-warning mt-3 small">
                <strong>{missingLocationCount} publicaciones</strong> todavía no
                tienen coordenadas. Hay que editarlas y usar “Buscar dirección” o
                marcar su punto para que aparezcan.
              </div>
            )}
            <p className="text-muted small mt-3">
              La capa parcelaria corresponde a IDECOR / Mapas Córdoba. Acercá el
              mapa para ver sus límites.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
};

export default MapaPortalPage;
