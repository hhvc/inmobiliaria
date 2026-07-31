import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useDomainAgency } from "../../inmobiliaria/context/useDomainAgency";
import { getPublicEmprendimientos } from "../services/emprendimiento.service";
import {
  EMPRENDIMIENTO_ESTADOS_OBRA,
  EMPRENDIMIENTO_TIPOS,
  getEmprendimientoStatusLabel,
  getEmprendimientoTypeLabel,
} from "../utils/emprendimientoSchema";

const EmprendimientoPortalPage = () => {
  const [searchParams] = useSearchParams();
  const { inmobiliaria: domainInmobiliaria } = useDomainAgency();
  const inmobiliariaId =
    searchParams.get("inmobiliaria") ||
    domainInmobiliaria?.id ||
    domainInmobiliaria?.inmobiliariaId ||
    "";

  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    tipo: "",
    estadoObra: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getPublicEmprendimientos({
          inmobiliariaId,
          pageSize: 100,
        });
        if (active) setItems(data);
      } catch (loadError) {
        console.error("Error cargando emprendimientos públicos:", loadError);
        if (active) {
          setError("No se pudieron cargar los emprendimientos. Intentá nuevamente.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [inmobiliariaId]);

  const filteredItems = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();

    return items.filter((item) => {
      if (filters.tipo && item.tipo !== filters.tipo) return false;
      if (filters.estadoObra && item.estadoObra !== filters.estadoObra) {
        return false;
      }
      if (!needle) return true;

      return [
        item.nombre,
        item.desarrollista,
        item.descripcion,
        item.direccion?.barrio,
        item.direccion?.ciudad,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [filters, items]);

  return (
    <main>
      <SEO
        title="Emprendimientos inmobiliarios | ONO Prop"
        description="Edificios, loteos y desarrollos inmobiliarios publicados por profesionales en ONO Prop."
      />

      <section className="bg-dark text-white py-5">
        <div className="container py-4">
          <p className="text-uppercase small opacity-75 mb-2">ONO Prop</p>
          <h1 className="display-5 fw-bold">Emprendimientos inmobiliarios</h1>
          <p className="lead mb-0">
            Conocé edificios, loteos y desarrollos con unidades disponibles.
          </p>
        </div>
      </section>

      <section className="container py-5">
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body row g-3">
            <div className="col-lg-6">
              <label className="form-label">Buscar</label>
              <input
                type="search"
                className="form-control"
                placeholder="Nombre, ciudad, barrio o desarrollista"
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
              />
            </div>
            <div className="col-md-6 col-lg-3">
              <label className="form-label">Tipo</label>
              <select
                className="form-select"
                value={filters.tipo}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    tipo: event.target.value,
                  }))
                }
              >
                <option value="">Todos</option>
                {EMPRENDIMIENTO_TIPOS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6 col-lg-3">
              <label className="form-label">Estado</label>
              <select
                className="form-select"
                value={filters.estadoObra}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    estadoObra: event.target.value,
                  }))
                }
              >
                <option value="">Todos</option>
                {EMPRENDIMIENTO_ESTADOS_OBRA.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-center py-5">Cargando emprendimientos...</div>
        )}
        {error && <div className="alert alert-danger">{error}</div>}
        {!loading && !error && filteredItems.length === 0 && (
          <div className="alert alert-light border text-center py-5">
            No hay emprendimientos que coincidan con la búsqueda.
          </div>
        )}

        <div className="row g-4">
          {filteredItems.map((item) => {
            const cover = [...(item.images || [])].sort(
              (a, b) => (a.order || 0) - (b.order || 0),
            )[0];

            return (
              <div className="col-md-6 col-xl-4" key={item.id}>
                <article className="card h-100 border-0 shadow-sm overflow-hidden">
                  {cover?.url ? (
                    <img
                      src={cover.url}
                      alt={item.nombre}
                      className="card-img-top"
                      loading="lazy"
                      style={{ height: 250, objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      className="bg-light text-muted d-flex align-items-center justify-content-center"
                      style={{ height: 250 }}
                    >
                      Sin imagen
                    </div>
                  )}
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      <span className="badge text-bg-primary">
                        {getEmprendimientoTypeLabel(item.tipo)}
                      </span>
                      <span className="badge text-bg-info">
                        {getEmprendimientoStatusLabel(item.estadoObra)}
                      </span>
                    </div>
                    <h2 className="h5">{item.nombre}</h2>
                    <p className="text-muted">
                      {[item.direccion?.barrio, item.direccion?.ciudad]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="small flex-grow-1">
                      {item.descripcion?.slice(0, 150)}
                      {item.descripcion?.length > 150 ? "…" : ""}
                    </p>
                    <Link
                      className="btn btn-outline-primary stretched-link"
                      to={`/emprendimiento/${item.slug}`}
                    >
                      Ver emprendimiento
                    </Link>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
};

export default EmprendimientoPortalPage;
