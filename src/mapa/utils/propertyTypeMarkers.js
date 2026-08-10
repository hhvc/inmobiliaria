import {
  FaBriefcase,
  FaBuilding,
  FaHome,
  FaMapMarkerAlt,
  FaStore,
  FaTractor,
  FaVectorSquare,
} from "react-icons/fa";

import {normalizeMapPropertyType} from "./mapa.helpers";

export const PROPERTY_TYPE_MARKERS = [
  {
    key: "departamento",
    label: "Departamento",
    Icon: FaBuilding,
    svg: '<path d="M5 20V3h11v17M3 20h18M8 7h2m3 0h2M8 11h2m3 0h2M9 20v-5h4v5"/>',
  },
  {
    key: "casa",
    label: "Casa / PH",
    Icon: FaHome,
    svg: '<path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6"/>',
  },
  {
    key: "terreno",
    label: "Terreno",
    Icon: FaVectorSquare,
    svg: '<path d="m4 6 6-3 10 5-6 13-10-5ZM10 3l4 18M4 6l16 2M4 16l16-8"/>',
  },
  {
    key: "local",
    label: "Local",
    Icon: FaStore,
    svg: '<path d="M4 9v11h16V9M3 9l2-6h14l2 6M8 20v-6h8v6M3 9h18"/>',
  },
  {
    key: "oficina",
    label: "Oficina",
    Icon: FaBriefcase,
    svg: '<path d="M4 7h16v12H4ZM9 7V4h6v3M4 12h16M10 12v2h4v-2"/>',
  },
  {
    key: "campo",
    label: "Campo",
    Icon: FaTractor,
    svg: '<path d="M12 21V3M12 8c-3 0-5-2-5-5 3 0 5 2 5 5Zm0 4c3 0 5-2 5-5-3 0-5 2-5 5Zm0 4c-3 0-5-2-5-5 3 0 5 2 5 5Z"/>',
  },
];

const FALLBACK_MARKER = {
  key: "otro",
  label: "Otro inmueble",
  Icon: FaMapMarkerAlt,
  svg: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Zm-8 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>',
};

export const getPropertyTypeMarker = (propertyType) => {
  const normalized = normalizeMapPropertyType(propertyType);
  return PROPERTY_TYPE_MARKERS.find((item) => item.key === normalized) ||
    FALLBACK_MARKER;
};
