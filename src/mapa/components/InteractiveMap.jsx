import { useCallback, useEffect } from "react";
import L from "leaflet";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  WMSTileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { CORDOBA_CITY_CENTER } from "../utils/mapa.helpers";
import {getPropertyTypeMarker} from "../utils/propertyTypeMarkers";
import "../mapa.css";

const propertyIconCache = new Map();

const getPropertyMarkerIcon = (propertyType, selected) => {
  const marker = getPropertyTypeMarker(propertyType);
  const cacheKey = `${marker.key}:${selected ? "selected" : "default"}`;
  if (propertyIconCache.has(cacheKey)) return propertyIconCache.get(cacheKey);

  const glyph = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${marker.svg}</svg>`;
  const icon = L.divIcon({
    className: "ono-map-property-icon-host",
    html: `<span class="ono-map-property-marker map-property-type-${marker.key} ${
      selected ? "is-selected" : ""
    }"><span class="ono-map-property-glyph">${glyph}</span></span>`,
    iconSize: selected ? [42, 48] : [38, 44],
    iconAnchor: selected ? [21, 46] : [19, 42],
    popupAnchor: [0, -40],
  });
  propertyIconCache.set(cacheKey, icon);
  return icon;
};

const pointStyle = (point, selected) => {
  if (point.kind === "subject") {
    return {
      color: "#842029",
      fillColor: "#dc3545",
      fillOpacity: 0.9,
      weight: 3,
    };
  }
  if (point.kind === "omi") {
    return {
      color: selected ? "#052c65" : "#084298",
      fillColor: selected ? "#0d6efd" : "#6ea8fe",
      fillOpacity: 0.82,
      weight: selected ? 4 : 2,
    };
  }
  return {
    color: selected ? "#0a3622" : "#146c43",
    fillColor: selected ? "#198754" : "#75b798",
    fillOpacity: 0.86,
    weight: selected ? 4 : 2,
  };
};

const ViewportReporter = ({ onViewportChange, onMapClick }) => {
  const reportBounds = useCallback(
    (currentMap) => {
      if (!onViewportChange) return;
      const bounds = currentMap.getBounds();
      onViewportChange({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      });
    },
    [onViewportChange],
  );

  const map = useMapEvents({
    moveend: () => reportBounds(map),
    zoomend: () => reportBounds(map),
    click: (event) => {
      onMapClick?.({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  useEffect(() => {
    reportBounds(map);
  }, [map, reportBounds]);

  return null;
};

const MapFocusController = ({ focusPosition, focusVersion = 0 }) => {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(focusPosition) || focusPosition.length < 2) return;
    map.setView(focusPosition, Math.max(map.getZoom(), 15), { animate: true });
  }, [focusPosition, focusVersion, map]);

  return null;
};

const MapBoundsController = ({ positions, enabled }) => {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !Array.isArray(positions) || positions.length === 0) return;
    map.fitBounds(positions, {
      animate: false,
      maxZoom: 15,
      padding: [32, 32],
    });
  }, [enabled, map, positions]);

  return null;
};

const DefaultPopup = ({ point }) => (
  <div className="ono-map-popup">
    <strong>{point.title}</strong>
    {point.address && <div>{point.address}</div>}
    {point.priceLabel && <div>{point.priceLabel}</div>}
    {point.surfaceLabel && <div>{point.surfaceLabel}</div>}
  </div>
);

const InteractiveMap = ({
  points = [],
  subjectPoint = null,
  center = CORDOBA_CITY_CENTER,
  zoom = 13,
  selectedPointId = "",
  onSelectPoint,
  onViewportChange,
  onMapClick,
  renderPopup,
  focusPosition = null,
  focusVersion = 0,
  fitToPoints = false,
  showParcelLayer = true,
  highlightGeoJson = null,
  className = "",
}) => {
  const safeCenter =
    Array.isArray(center) && center.length >= 2 ? center : CORDOBA_CITY_CENTER;
  const visiblePoints = [subjectPoint, ...points].filter(
    (point) => Array.isArray(point?.position) && point.position.length >= 2,
  );

  return (
    <div className={`ono-map ${className}`.trim()}>
      <MapContainer
        center={safeCenter}
        zoom={zoom}
        scrollWheelZoom
        worldCopyJump
        className="ono-map-canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {showParcelLayer && (
          <WMSTileLayer
            url="https://idecor-ws.mapascordoba.gob.ar/geoserver/idecor/parcelas/wms"
            layers="parcelas"
            format="image/png"
            transparent
            opacity={0.72}
            minZoom={14}
            zIndex={350}
            attribution='Parcelario: <a href="https://www.mapascordoba.gob.ar/">IDECOR / Mapas Córdoba</a>'
          />
        )}
        <ViewportReporter
          onViewportChange={onViewportChange}
          onMapClick={onMapClick}
        />
        <MapFocusController
          focusPosition={focusPosition}
          focusVersion={focusVersion}
        />
        <MapBoundsController
          enabled={fitToPoints}
          positions={visiblePoints.map((point) => point.position)}
        />

        {highlightGeoJson && (
          <GeoJSON
            key={JSON.stringify(highlightGeoJson).slice(0, 240)}
            data={highlightGeoJson}
            pathOptions={{
              color: "#b02a37",
              fillColor: "#dc3545",
              fillOpacity: 0.18,
              weight: 4,
            }}
          />
        )}

        {visiblePoints.map((point) => {
          const selected = point.id === selectedPointId;

          if (point.kind === "inmueble") {
            return (
              <Marker
                key={point.id}
                position={point.position}
                icon={getPropertyMarkerIcon(point.propertyType, selected)}
                zIndexOffset={selected ? 1000 : 0}
                eventHandlers={{
                  click: () => onSelectPoint?.(point),
                }}
              >
                <Popup>
                  {renderPopup ? renderPopup(point) : <DefaultPopup point={point} />}
                </Popup>
              </Marker>
            );
          }

          return (
            <CircleMarker
              key={point.id}
              center={point.position}
              radius={point.kind === "subject" ? 10 : selected ? 9 : 7}
              pathOptions={pointStyle(point, selected)}
              eventHandlers={{
                click: () => onSelectPoint?.(point),
              }}
            >
              <Popup>
                {renderPopup ? renderPopup(point) : <DefaultPopup point={point} />}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default InteractiveMap;
