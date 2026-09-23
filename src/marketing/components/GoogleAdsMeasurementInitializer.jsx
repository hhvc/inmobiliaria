import { useEffect } from "react";

import { configureGoogleAdsMeasurement } from "../services/googleAdsMeasurement.service";

const GoogleAdsMeasurementInitializer = () => {
  useEffect(() => {
    configureGoogleAdsMeasurement();
  }, []);

  return null;
};

export default GoogleAdsMeasurementInitializer;
