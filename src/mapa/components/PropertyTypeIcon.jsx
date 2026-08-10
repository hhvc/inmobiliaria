import {getPropertyTypeMarker} from "../utils/propertyTypeMarkers";

const PropertyTypeIcon = ({propertyType, className = "", title}) => {
  const marker = getPropertyTypeMarker(propertyType);
  const Icon = marker.Icon;

  return <Icon className={className} aria-hidden={title ? undefined : true} title={title} />;
};

export default PropertyTypeIcon;
