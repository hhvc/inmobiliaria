import {useMemo, useState} from "react";
import {Link} from "react-router-dom";

import SEO from "../../components/SEO";
import {useActiveInmobiliariaModules} from
  "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import InteractiveMap from "../components/InteractiveMap";
import {searchAddressCandidates} from "../services/geocoding.service";
import {getParcelAtPoint} from "../services/parcelas.service";
import {CORDOBA_CITY_CENTER} from "../utils/mapa.helpers";
import "../mapa.css";

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 2,
});

const showValue = (value, suffix = "") => {
  if (value === null || value === undefined || value === "") return "Sin dato";
  return `${value}${suffix}`;
};

const showNumber = (value, suffix = "") => {
  if (!Number.isFinite(Number(value))) return "Sin dato";
  return `${numberFormatter.format(Number(value))}${suffix}`;
};

const showMoney = (value) => {
  if (!Number.isFinite(Number(value))) return "Sin dato";
  return moneyFormatter.format(Number(value));
};

const DataRow = ({label, value}) => (
  <div className="parcel-data-row">
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);

const DataCard = ({title, children}) => (
  <section className="card shadow-sm h-100">
    <div className="card-body">
      <h2 className="h6 text-uppercase text-muted mb-3">{title}</h2>
      <dl className="parcel-data-list mb-0">{children}</dl>
    </div>
  </section>
);

const ParcelDetails = ({result}) => {
  const parcel = result?.parcel;
  const occupancy = result?.urbanPlanning?.occupancy;
  const subdivision = result?.urbanPlanning?.subdivision;
  const landUse = result?.urbanPlanning?.landUse;
  const hasUrbanPlanning = occupancy || subdivision || landUse;

  if (!parcel) {
    return (
      <div className="alert alert-warning mb-0">
        No encontramos una parcela en el punto seleccionado. Acercá el mapa y
        hacé clic dentro del polígono, no sobre la calle.
      </div>
    );
  }

  return (
    <div className="d-grid gap-3">
      <DataCard title="Identificación catastral">
        <DataRow label="Nomenclatura" value={showValue(parcel.nomenclature)} />
        <DataRow label="Cuenta" value={showValue(parcel.accountNumber)} />
        <DataRow
          label="Designación oficial"
          value={showValue(parcel.officialDesignation)}
        />
        <DataRow label="Tipo" value={showValue(parcel.parcelType)} />
        <DataRow label="Estado" value={showValue(parcel.status)} />
        <DataRow
          label="Ubicación"
          value={[
            parcel.locality,
            parcel.district,
            parcel.department,
          ].filter(Boolean).join(" · ") || "Sin dato"}
        />
      </DataCard>

      <DataCard title="Superficies y valuación fiscal">
        <DataRow
          label="Tierra urbana"
          value={showNumber(parcel.landAreaUrban, " m²")}
        />
        <DataRow
          label="Tierra rural"
          value={showNumber(parcel.landAreaRural, " m²")}
        />
        <DataRow
          label="Mejoras"
          value={showNumber(parcel.improvementsArea, " m²")}
        />
        <DataRow label="Valuación total" value={showMoney(parcel.totalValuation)} />
        <DataRow
          label="Valuación tierra urbana"
          value={showMoney(parcel.urbanLandValuation)}
        />
        <DataRow
          label="Valuación tierra rural"
          value={showMoney(parcel.ruralLandValuation)}
        />
        <DataRow
          label="Valuación mejoras"
          value={showMoney(parcel.improvementsValuation)}
        />
        <DataRow
          label="Vigencia desde"
          value={showValue(parcel.valuationValidFrom)}
        />
      </DataCard>

      {hasUrbanPlanning ? (
        <>
          <DataCard title="Ocupación del suelo">
            <DataRow label="Localidad" value={showValue(occupancy?.locality)} />
            <DataRow label="Zona" value={showValue(occupancy?.zone)} />
            <DataRow
              label="Denominación"
              value={showValue(occupancy?.designation)}
            />
            <DataRow label="FOS" value={showValue(occupancy?.fos)} />
            <DataRow label="FOT" value={showValue(occupancy?.fot)} />
            <DataRow
              label="Altura máxima"
              value={showValue(occupancy?.maximumHeight)}
            />
            <DataRow label="Retiros" value={showValue(occupancy?.setbacks)} />
            <DataRow
              label="Ordenanza"
              value={showValue(occupancy?.ordinance)}
            />
          </DataCard>

          <DataCard title="Fraccionamiento">
            <DataRow label="Zona" value={showValue(subdivision?.zone)} />
            <DataRow
              label="Superficie mínima"
              value={showValue(
                subdivision?.minimumArea || occupancy?.minimumArea,
              )}
            />
            <DataRow
              label="Frente mínimo"
              value={showValue(
                subdivision?.minimumFront || occupancy?.minimumFront,
              )}
            />
            <DataRow
              label="Ordenanza"
              value={showValue(subdivision?.ordinance)}
            />
          </DataCard>

          <DataCard title="Usos del suelo">
            <DataRow label="Zona" value={showValue(landUse?.zone)} />
            <DataRow
              label="Uso dominante"
              value={showValue(landUse?.dominantUse)}
            />
            <DataRow
              label="Uso complementario"
              value={showValue(landUse?.complementaryUse)}
            />
            <DataRow label="Ordenanza" value={showValue(landUse?.ordinance)} />
          </DataCard>
        </>
      ) : (
        <div className="alert alert-info mb-0">
          La parcela fue identificada, pero las capas provinciales no tienen
          normativa urbana publicada para este punto. Esto no significa que no
          exista normativa municipal.
        </div>
      )}
    </div>
  );
};

const ParcelasProfessionalPage = () => {
  const {
    activeInmobiliaria,
    activeInmobiliariaId,
    loading: loadingAgency,
    isRoot,
  } = useActiveInmobiliariaModules();
  const [address, setAddress] = useState("");
  const [addressResults, setAddressResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [result, setResult] = useState(null);
  const [focusVersion, setFocusVersion] = useState(0);

  const selectedPoint = useMemo(() => {
    if (!selectedLocation) return null;
    return {
      id: "parcel-query-point",
      kind: "subject",
      position: [selectedLocation.latitude, selectedLocation.longitude],
      title: "Punto consultado",
    };
  }, [selectedLocation]);

  const queryPoint = async (location) => {
    try {
      setQuerying(true);
      setError("");
      setSelectedLocation(location);
      setResult(null);
      const data = await getParcelAtPoint({
        inmobiliariaId: activeInmobiliariaId,
        latitude: location.latitude,
        longitude: location.longitude,
      });
      setResult(data);
    } catch (queryError) {
      setError(queryError.message || "No se pudo consultar la parcela.");
    } finally {
      setQuerying(false);
    }
  };

  const handleAddressSearch = async (event) => {
    event.preventDefault();
    try {
      setSearching(true);
      setError("");
      setAddressResults(await searchAddressCandidates(address));
    } catch (searchError) {
      setAddressResults([]);
      setError(searchError.message || "No se pudo buscar la dirección.");
    } finally {
      setSearching(false);
    }
  };

  const chooseAddress = (candidate) => {
    const location = {
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    };
    setAddress(candidate.label);
    setAddressResults([]);
    setFocusVersion((current) => current + 1);
    queryPoint(location);
  };

  return (
    <main className="container-fluid px-3 px-lg-4 py-4 parcelas-page">
      <SEO
        title="Consulta profesional de parcelas | ONO Prop"
        description="Consulta catastral y normativa urbana para inmobiliarias suscriptoras."
        noIndex
      />

      <header className="mb-3">
        <div className="d-flex flex-wrap justify-content-between gap-3">
          <div>
            <p className="text-uppercase text-muted small mb-1">
              Herramienta profesional
            </p>
            <h1 className="h3 mb-1">Parcelas y normativa urbana</h1>
            <p className="text-muted mb-0">
              {activeInmobiliaria?.nombre || (isRoot ? "Acceso root" : "Inmobiliaria activa")}
            </p>
          </div>
          <Link to="/admin/inmobiliaria" className="btn btn-outline-secondary align-self-start">
            Volver al panel
          </Link>
        </div>
      </header>

      <div className="alert alert-light border small">
        Buscá una dirección o hacé clic dentro de una parcela. Los datos
        catastrales y normativos provienen de IDECOR / Mapas Córdoba.
      </div>

      <form className="row g-2 mb-3" onSubmit={handleAddressSearch}>
        <div className="col-12 col-lg">
          <label htmlFor="parcel-address" className="visually-hidden">
            Dirección
          </label>
          <input
            id="parcel-address"
            className="form-control"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Ej.: Caseros 500, Córdoba, Argentina"
          />
        </div>
        <div className="col-12 col-lg-auto">
          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={searching || loadingAgency}
          >
            {searching ? "Buscando..." : "Buscar dirección"}
          </button>
        </div>
      </form>

      {addressResults.length > 0 && (
        <div className="list-group mb-3 parcel-address-results">
          {addressResults.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className="list-group-item list-group-item-action"
              onClick={() => chooseAddress(candidate)}
            >
              {candidate.label}
            </button>
          ))}
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <InteractiveMap
            center={selectedPoint?.position || CORDOBA_CITY_CENTER}
            zoom={selectedPoint ? 17 : 13}
            subjectPoint={selectedPoint}
            onMapClick={queryPoint}
            focusPosition={selectedPoint?.position || null}
            focusVersion={focusVersion}
            highlightGeoJson={result?.parcel?.geometry || null}
            className="parcelas-professional-map"
          />
          <p className="form-text mb-0">
            La selección debe caer dentro del polígono parcelario. Los bordes se
            muestran a partir de un nivel de acercamiento alto.
          </p>
        </div>
        <aside className="col-12 col-xl-4">
          {querying ? (
            <div className="card shadow-sm">
              <div className="card-body text-center py-5">
                <div className="spinner-border" />
                <p className="text-muted mt-3 mb-0">
                  Consultando Catastro y normativa...
                </p>
              </div>
            </div>
          ) : result ? (
            <ParcelDetails result={result} />
          ) : (
            <div className="alert alert-info">
              Seleccioná una parcela para ver su información profesional.
            </div>
          )}
        </aside>
      </div>

      {result && (
        <footer className="alert alert-secondary small mt-3 mb-0">
          <strong>Fuente:</strong> {result.provider}. {result.legalNotice}
          {result.coverageNotice && ` ${result.coverageNotice}`}
          {result.queriedAt && (
            <> Consulta: {new Date(result.queriedAt).toLocaleString("es-AR")}.</>
          )}
        </footer>
      )}
    </main>
  );
};

export default ParcelasProfessionalPage;
