import {PROPERTY_TYPE_MARKERS} from "../utils/propertyTypeMarkers";
import PropertyTypeIcon from "./PropertyTypeIcon";

const PropertyTypeLegend = () => (
  <div className="map-property-legend" aria-label="Referencias de tipos de inmueble">
    {PROPERTY_TYPE_MARKERS.map((marker) => (
      <span className="map-property-legend-item" key={marker.key}>
        <span className={`map-property-legend-icon map-property-type-${marker.key}`}>
          <PropertyTypeIcon propertyType={marker.key} />
        </span>
        {marker.label}
      </span>
    ))}
  </div>
);

export default PropertyTypeLegend;
