import { useState } from "react";

import InteractiveMap from "./InteractiveMap";
import { searchAddressCandidates } from "../services/geocoding.service";
import {
  CORDOBA_CITY_CENTER,
  normalizeMapCoordinates,
} from "../utils/mapa.helpers";

const MapPointPicker = ({
  latitude,
  longitude,
  onChange,
  title = "Ubicación en el mapa",
  help = "Hacé clic en el mapa para guardar la ubicación exacta.",
  addressQuery = "",
}) => {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [focusVersion, setFocusVersion] = useState(0);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [addressResults, setAddressResults] = useState([]);
  const [addressError, setAddressError] = useState("");
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

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Este navegador no permite obtener la ubicación actual.");
      return;
    }

    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        onChange?.(next);
        setFocusVersion((current) => current + 1);
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
      const results = await searchAddressCandidates(addressQuery);
      setAddressResults(results);
      if (results.length === 0) {
        setAddressError(
          "No encontramos coincidencias. Revisá calle, número, ciudad y provincia.",
        );
      }
    } catch (error) {
      setAddressResults([]);
      setAddressError(error.message || "No se pudo buscar la dirección.");
    } finally {
      setSearchingAddress(false);
    }
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
              className="btn btn-sm btn-outline-primary"
              disabled={searchingAddress}
              onClick={searchAddress}
            >
              {searchingAddress ? "Buscando..." : "Buscar dirección"}
            </button>
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
        <div className="list-group mb-2">
          {addressResults.map((result) => (
            <button
              key={result.id}
              type="button"
              className="list-group-item list-group-item-action py-2"
              onClick={() => {
                onChange?.({
                  latitude: result.latitude,
                  longitude: result.longitude,
                });
                setAddressResults([]);
                setFocusVersion((current) => current + 1);
              }}
            >
              {result.label}
            </button>
          ))}
        </div>
      )}
      <InteractiveMap
        center={center}
        zoom={coordinates ? 16 : 12}
        subjectPoint={subjectPoint}
        onMapClick={(next) => {
          onChange?.(next);
          setFocusVersion((current) => current + 1);
        }}
        focusPosition={coordinates ? center : null}
        focusVersion={focusVersion}
        className="ono-map-picker-canvas"
      />
      <div className="form-text">
        {coordinates
          ? `Coordenadas: ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`
          : "Todavía no se seleccionó una ubicación."}
      </div>
    </div>
  );
};

export default MapPointPicker;
