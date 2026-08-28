import { useMemo, useState } from "react";

import InteractiveMap from "./InteractiveMap";
import { searchAddressCandidates } from "../services/geocoding.service";
import {
  CORDOBA_CITY_CENTER,
  normalizeMapCoordinates,
} from "../utils/mapa.helpers";

const formatCoordinate = (value) => Number(value).toFixed(6);

const MapPointPicker = ({
  latitude,
  longitude,
  onChange,
  title = "Ubicación en el mapa",
  help = "Buscá la dirección y confirmá el punto. También podés corregirlo haciendo clic en el mapa.",
  addressQuery = "",
  addressContext = {},
}) => {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [focusVersion, setFocusVersion] = useState(0);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [addressResults, setAddressResults] = useState([]);
  const [addressError, setAddressError] = useState("");
  const [manualCoordinatesOpen, setManualCoordinatesOpen] = useState(false);
  const [manualLatitude, setManualLatitude] = useState("");
  const [manualLongitude, setManualLongitude] = useState("");
  const [manualError, setManualError] = useState("");
  const coordinates = normalizeMapCoordinates(latitude, longitude);
  const center = coordinates
    ? [coordinates.latitude, coordinates.longitude]
    : CORDOBA_CITY_CENTER;
  const subjectPoint = coordinates
    ? {
        id: "selected-location",
        kind: "subject",
        position: center,
        title: "Ubicación seleccionada",
      }
    : null;
  const googleMapsUrl = useMemo(() => {
    const safeAddress = String(addressQuery || "").trim();
    if (!safeAddress) return "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(safeAddress)}`;
  }, [addressQuery]);

  const emitLocation = (location, geocoding = {}) => {
    onChange?.({
      ...location,
      geocoding: {
        provider: geocoding.provider || "manual_map",
        providerId: geocoding.providerId || "",
        label: geocoding.label || "",
        precision: geocoding.precision || "manual",
        confirmedAt: new Date().toISOString(),
      },
    });
    setLocationError("");
    setAddressError("");
    setFocusVersion((current) => current + 1);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Este navegador no permite obtener la ubicación actual.");
      return;
    }

    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        emitLocation(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          { provider: "device_location", precision: "device" },
        );
        setLocating(false);
      },
      () => {
        setLocationError("No se pudo obtener la ubicación actual.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const searchAddress = async () => {
    try {
      setSearchingAddress(true);
      setAddressError("");
      const results = await searchAddressCandidates(addressQuery, addressContext);
      setAddressResults(results);
      if (results.length === 0) {
        setAddressError(
          "Georef no encontró una coordenada para esa dirección. Revisá calle, número, ciudad y provincia o marcá el punto en el mapa.",
        );
      }
    } catch (error) {
      setAddressResults([]);
      setAddressError(error.message || "No se pudo buscar la dirección.");
    } finally {
      setSearchingAddress(false);
    }
  };

  const openManualCoordinates = () => {
    setManualLatitude(coordinates ? String(coordinates.latitude) : "");
    setManualLongitude(coordinates ? String(coordinates.longitude) : "");
    setManualError("");
    setManualCoordinatesOpen(true);
  };

  const applyManualCoordinates = () => {
    const next = normalizeMapCoordinates(manualLatitude, manualLongitude);
    if (!next) {
      setManualError("Ingresá una latitud y longitud válidas.");
      return;
    }

    emitLocation(next, {
      provider: "manual_coordinates",
      precision: "manual",
    });
    setManualCoordinatesOpen(false);
    setManualError("");
  };

  return (
    <div className="ono-map-picker">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
        <div>
          <h3 className="h6 mb-1">{title}</h3>
          <p className="text-muted small mb-0">{help}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {addressQuery && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={searchingAddress}
              onClick={searchAddress}
            >
              {searchingAddress ? "Buscando..." : "Buscar dirección"}
            </button>
          )}
          {googleMapsUrl && (
            <a
              className="btn btn-sm btn-outline-primary"
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Verificar en Google Maps
            </a>
          )}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={locating}
            onClick={useCurrentLocation}
          >
            {locating ? "Localizando..." : "Usar mi ubicación"}
          </button>
        </div>
      </div>
      {locationError && <div className="alert alert-warning py-2">{locationError}</div>}
      {addressError && <div className="alert alert-warning py-2">{addressError}</div>}
      {addressResults.length > 0 && (
        <div className="mb-2">
          <div className="small text-muted mb-1">
            Direcciones encontradas por Georef Argentina
          </div>
          <div className="list-group">
            {addressResults.map((result) => (
              <button
                key={result.id}
                type="button"
                className="list-group-item list-group-item-action py-2"
                onClick={() => {
                  emitLocation(
                    {
                      latitude: result.latitude,
                      longitude: result.longitude,
                    },
                    result,
                  );
                  setAddressResults([]);
                }}
              >
                <span className="d-block fw-semibold">{result.label}</span>
                {result.locationLabel && (
                  <small className="text-muted">{result.locationLabel}</small>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      <InteractiveMap
        center={center}
        zoom={coordinates ? 16 : 12}
        subjectPoint={subjectPoint}
        onMapClick={(next) => emitLocation(next, {
          provider: "manual_map",
          precision: "manual",
        })}
        focusPosition={coordinates ? center : null}
        focusVersion={focusVersion}
        className="ono-map-picker-canvas"
      />

      <div className="ono-map-coordinate-summary mt-2">
        <div>
          <span className="d-block text-muted small">Coordenadas internas</span>
          <strong>
            {coordinates
              ? `${formatCoordinate(coordinates.latitude)}, ${formatCoordinate(coordinates.longitude)}`
              : "Se completan al buscar o marcar la ubicación"}
          </strong>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={openManualCoordinates}
        >
          {coordinates ? "Editar coordenadas" : "Ingresar coordenadas manualmente"}
        </button>
      </div>

      {manualCoordinatesOpen && (
        <div className="ono-map-manual-coordinates mt-2">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-sm-5">
              <label className="form-label small" htmlFor="manual-map-latitude">
                Latitud
              </label>
              <input
                id="manual-map-latitude"
                type="number"
                step="any"
                className="form-control"
                value={manualLatitude}
                onChange={(event) => setManualLatitude(event.target.value)}
              />
            </div>
            <div className="col-12 col-sm-5">
              <label className="form-label small" htmlFor="manual-map-longitude">
                Longitud
              </label>
              <input
                id="manual-map-longitude"
                type="number"
                step="any"
                className="form-control"
                value={manualLongitude}
                onChange={(event) => setManualLongitude(event.target.value)}
              />
            </div>
            <div className="col-12 col-sm-2 d-grid">
              <button
                type="button"
                className="btn btn-primary"
                onClick={applyManualCoordinates}
              >
                Aplicar
              </button>
            </div>
          </div>
          {manualError && <div className="text-danger small mt-2">{manualError}</div>}
          <button
            type="button"
            className="btn btn-link btn-sm px-0 mt-1"
            onClick={() => {
              setManualCoordinatesOpen(false);
              setManualError("");
            }}
          >
            Cancelar edición manual
          </button>
        </div>
      )}
    </div>
  );
};

export default MapPointPicker;
