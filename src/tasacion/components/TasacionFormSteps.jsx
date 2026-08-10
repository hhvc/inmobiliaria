import { Link } from "react-router-dom";

import ComparableMapSelector from "../../mapa/components/ComparableMapSelector";
import MapPointPicker from "../../mapa/components/MapPointPicker";
import {getStoredParcelSummary} from
  "../../inmueble/utils/inmuebleParcel.helpers";

import {
  COMPARABLE_TIPOS_DATO,
  COMPARATIVE_UNIT_BASES,
  ROSS_HEIDECKE_ESTADOS,
  TASACION_FINALIDADES,
  TASACION_METODOS,
  TASACION_MONEDAS,
  TASACION_POSICIONES_LOTE,
  TASACION_TIPOLOGIAS,
  TASACION_TIPOS_INFORME,
} from "../utils/tasacion.constants";
import {
  calculateRossHeidecke,
  calculateWeightedSurface,
  formatTasacionMoney,
} from "../utils/tasacion.helpers";

const SectionCard = ({ title, help = "", children }) => (
  <section className="card border-0 shadow-sm mb-4">
    <div className="card-header bg-white py-3">
      <h2 className="h6 mb-1">{title}</h2>
      {help && <p className="text-muted small mb-0">{help}</p>}
    </div>
    <div className="card-body">
      <div className="row g-3">{children}</div>
    </div>
  </section>
);

const SelectField = ({ label, value, onChange, options, className = "col-md-4", help = "" }) => (
  <div className={className}>
    <label className="form-label">{label}</label>
    <select className="form-select" value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.id} value={option.id} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
    {help && <div className="form-text">{help}</div>}
  </div>
);

const InputField = ({
  label,
  value,
  onChange,
  className = "col-md-4",
  type = "text",
  min,
  max,
  step,
  placeholder = "",
  help = "",
  required = false,
}) => (
  <div className={className}>
    <label className="form-label">{label}{required ? " *" : ""}</label>
    <input
      className="form-control"
      type={type}
      value={value ?? ""}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
    {help && <div className="form-text">{help}</div>}
  </div>
);

const TextAreaField = ({ label, value, onChange, className = "col-12", rows = 3, help = "" }) => (
  <div className={className}>
    <label className="form-label">{label}</label>
    <textarea className="form-control" rows={rows} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    {help && <div className="form-text">{help}</div>}
  </div>
);

const ToggleField = ({ id, label, checked, onChange, className = "col-md-4", help = "", disabled = false }) => (
  <div className={className}>
    <div className="form-check form-switch mt-md-4 pt-md-2">
      <input id={id} className="form-check-input" type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <label className="form-check-label" htmlFor={id}>{label}</label>
    </div>
    {help && <div className="form-text">{help}</div>}
  </div>
);

const ResultValue = ({ label, value, help = "", emphasis = false }) => (
  <div className="col-md-4">
    <div className={`border rounded p-3 h-100 ${emphasis ? "border-primary bg-primary-subtle" : "bg-light"}`}>
      <div className="text-muted small">{label}</div>
      <div className={`${emphasis ? "h4" : "h5"} mb-0`}>{value}</div>
      {help && <div className="small text-muted mt-1">{help}</div>}
    </div>
  </div>
);

export const TasacionStepOne = ({
  values,
  setValue,
  inmuebles = [],
  loadingInmuebles = false,
  importingInmueble = false,
  onSelectInmueble,
  inmobiliariaId = "",
}) => {
  const reportType = TASACION_TIPOS_INFORME.find((item) => item.id === values.scope.reportType);
  const propertyLink = values.propertyLink || {};
  const propertySelection =
    propertyLink.mode === "existing"
      ? propertyLink.inmuebleId
      : propertyLink.mode === "new"
        ? "__new__"
        : "";

  return (
    <>
      <SectionCard
        title="Inmueble a tasar"
        help="Podés reutilizar un inmueble cargado, esté publicado o no, o crear un borrador a partir de esta tasación."
      >
        <div className="col-12">
          <label className="form-label" htmlFor="tasacion-property-source">
            Origen de los datos *
          </label>
          <select
            id="tasacion-property-source"
            className="form-select"
            value={propertySelection}
            disabled={loadingInmuebles || importingInmueble}
            onChange={(event) => onSelectInmueble?.(event.target.value)}
          >
            <option value="">
              {loadingInmuebles ? "Cargando inmuebles..." : "Seleccionar inmueble"}
            </option>
            <option value="__new__">Inmueble nuevo / todavía no cargado</option>
            {inmuebles.length > 0 && (
              <optgroup label="Inmuebles ya cargados">
                {inmuebles.map((inmueble) => {
                  const address = [
                    inmueble.direccion?.calle,
                    inmueble.direccion?.numero,
                    inmueble.direccion?.barrio,
                  ].filter(Boolean).join(" ");
                  const publicationStatus = inmueble.publicarEnPortal
                    ? "Publicado"
                    : "No publicado";
                  return (
                    <option key={inmueble.id} value={inmueble.id}>
                      {inmueble.titulo || "Inmueble sin título"}
                      {address ? ` · ${address}` : ""} · {publicationStatus}
                    </option>
                  );
                })}
              </optgroup>
            )}
          </select>
          <div className="form-text">
            {importingInmueble
              ? "Importando los datos disponibles..."
              : `${inmuebles.length} inmueble${inmuebles.length === 1 ? "" : "s"} disponible${inmuebles.length === 1 ? "" : "s"}.`}
          </div>
        </div>

        {propertyLink.mode === "existing" && (
          <div className="col-12">
            <div className="alert alert-success mb-0">
              <strong>{propertyLink.inmuebleTitle || "Inmueble vinculado"}.</strong>{" "}
              Se heredaron los datos disponibles. La tasación no modificará la ficha original.
            </div>
          </div>
        )}

        {propertyLink.mode === "new" && (
          <div className="col-12">
            <div className="alert alert-info mb-0">
              {propertyLink.inmuebleId ? (
                <>
                  Se creó un borrador no publicado y se mantendrá sincronizado con la tasación
                  mientras siga inactivo. {" "}
                  <Link
                    to={`/admin/inmuebles/${propertyLink.inmuebleId}/editar${
                      inmobiliariaId
                        ? `?inmobiliariaId=${encodeURIComponent(inmobiliariaId)}`
                        : ""
                    }`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir borrador del inmueble
                  </Link>
                </>
              ) : (
                "Al guardar la tasación se creará un único borrador no publicado del inmueble para completarlo y publicarlo más adelante."
              )}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Finalidad y alcance" help="La finalidad condiciona el concepto de valor, el método y el contenido del informe.">
        <SelectField label="Tipo de informe" value={values.scope.reportType} onChange={(value) => setValue("scope.reportType", value)} options={TASACION_TIPOS_INFORME} className="col-md-5" />
        <SelectField label="Finalidad" value={values.scope.purpose} onChange={(value) => setValue("scope.purpose", value)} options={TASACION_FINALIDADES} className="col-md-4" />
        <InputField label="Fecha de valuación" type="date" value={values.scope.valuationDate} onChange={(value) => setValue("scope.valuationDate", value)} className="col-md-3" required />
        <SelectField label="Moneda del informe" value={values.scope.currency} onChange={(value) => setValue("scope.currency", value)} options={TASACION_MONEDAS} className="col-md-4" />
        {values.scope.currency === "OTRA" && <InputField label="Código o nombre de moneda" value={values.scope.otherCurrency} onChange={(value) => setValue("scope.otherCurrency", value)} className="col-md-4" />}
        <TextAreaField label="Detalle particular de la finalidad" value={values.scope.purposeDetail} onChange={(value) => setValue("scope.purposeDetail", value)} className="col-12" rows={2} />
        <div className="col-12"><div className="alert alert-info mb-0"><strong>{reportType?.label}.</strong> {reportType?.help}</div></div>
      </SectionCard>

      <SectionCard title="Comitente y titular">
        <InputField label="Cliente / comitente" value={values.scope.clientName} onChange={(value) => setValue("scope.clientName", value)} className="col-md-6" required />
        <InputField label="Documento o CUIT del cliente" value={values.scope.clientDocument} onChange={(value) => setValue("scope.clientDocument", value)} className="col-md-6" />
        <InputField label="Titular registral" value={values.scope.ownerName} onChange={(value) => setValue("scope.ownerName", value)} className="col-md-6" />
        <InputField label="Documento o CUIT del titular" value={values.scope.ownerDocument} onChange={(value) => setValue("scope.ownerDocument", value)} className="col-md-6" />
      </SectionCard>

      <SectionCard title="Identificación legal" help="Estos campos registran la documentación examinada; no sustituyen un estudio de títulos.">
        <InputField label="Matrícula RPI / Folio real" value={values.scope.propertyRegistry} onChange={(value) => setValue("scope.propertyRegistry", value)} className="col-md-4" />
        <InputField label="Nomenclatura catastral" value={values.scope.cadastralNomenclature} onChange={(value) => setValue("scope.cadastralNomenclature", value)} className="col-md-4" />
        <InputField label="Plano de mensura / subdivisión" value={values.scope.surveyPlan} onChange={(value) => setValue("scope.surveyPlan", value)} className="col-md-4" />
        <TextAreaField label="Observaciones sobre dominio y documentación" value={values.scope.titleNotes} onChange={(value) => setValue("scope.titleNotes", value)} />
      </SectionCard>

      <SectionCard title="Profesional interviniente" help="Completar para tasaciones profesionales. La carga de estos datos no equivale a una firma digital.">
        <InputField label="Nombre y apellido" value={values.scope.appraiser.name} onChange={(value) => setValue("scope.appraiser.name", value)} className="col-md-4" />
        <InputField label="Profesión" value={values.scope.appraiser.profession} onChange={(value) => setValue("scope.appraiser.profession", value)} className="col-md-3" />
        <InputField label="Matrícula" value={values.scope.appraiser.license} onChange={(value) => setValue("scope.appraiser.license", value)} className="col-md-2" />
        <InputField label="Consejo / colegio" value={values.scope.appraiser.council} onChange={(value) => setValue("scope.appraiser.council", value)} className="col-md-3" />
      </SectionCard>
    </>
  );
};

export const TasacionStepTwo = ({
  values,
  setValue,
  onTasacionLocationChange,
  onQueryTasacionParcel,
  parcelLoading = false,
  parcelError = "",
  parcelMessage = "",
}) => {
  const services = [
    ["water", "Agua corriente"], ["sewer", "Cloacas"], ["gas", "Gas natural"],
    ["electricity", "Electricidad"], ["pavement", "Pavimento"], ["streetLighting", "Alumbrado público"],
  ];
  const parcelSummary = getStoredParcelSummary(
    values.inspection.parcelData || {},
  );
  const hasParcelData = Boolean(values.inspection.parcelData?.parcel);
  const hasCoordinates = Boolean(
    values.inspection.geolocation.latitude &&
    values.inspection.geolocation.longitude,
  );

  return (
    <>
      <SectionCard title="Inspección" help="Una estimación remota debe quedar expresamente identificada y limitada en el informe.">
        <InputField label="Fecha de inspección" type="date" value={values.inspection.inspectionDate} onChange={(value) => setValue("inspection.inspectionDate", value)} className="col-md-4" required />
        <SelectField label="Modalidad" value={values.inspection.mode} onChange={(value) => setValue("inspection.mode", value)} options={[{ id: "presencial", label: "Presencial" }, { id: "remota", label: "Remota" }, { id: "no_realizada", label: "No realizada" }]} className="col-md-4" />
        <InputField label="Inspeccionado por" value={values.inspection.inspectedBy} onChange={(value) => setValue("inspection.inspectedBy", value)} className="col-md-4" />
      </SectionCard>

      <SectionCard title="Ubicación">
        <InputField label="Calle" value={values.inspection.address.street} onChange={(value) => setValue("inspection.address.street", value)} className="col-md-5" />
        <InputField label="Número" value={values.inspection.address.number} onChange={(value) => setValue("inspection.address.number", value)} className="col-md-2" />
        <InputField label="Barrio" value={values.inspection.address.neighborhood} onChange={(value) => setValue("inspection.address.neighborhood", value)} className="col-md-5" />
        <InputField label="Ciudad" value={values.inspection.address.city} onChange={(value) => setValue("inspection.address.city", value)} className="col-md-4" required />
        <InputField label="Provincia" value={values.inspection.address.province} onChange={(value) => setValue("inspection.address.province", value)} className="col-md-3" required />
        <InputField label="País" value={values.inspection.address.country} onChange={(value) => setValue("inspection.address.country", value)} className="col-md-3" />
        <InputField label="Código postal" value={values.inspection.address.postalCode} onChange={(value) => setValue("inspection.address.postalCode", value)} className="col-md-2" />
        <InputField label="Latitud" type="number" step="any" value={values.inspection.geolocation.latitude} onChange={(value) => setValue("inspection.geolocation.latitude", value)} className="col-md-3" />
        <InputField label="Longitud" type="number" step="any" value={values.inspection.geolocation.longitude} onChange={(value) => setValue("inspection.geolocation.longitude", value)} className="col-md-3" />
        <div className="col-12">
          <MapPointPicker
            latitude={values.inspection.geolocation.latitude}
            longitude={values.inspection.geolocation.longitude}
            addressQuery={[
              values.inspection.address.street,
              values.inspection.address.number,
              values.inspection.address.neighborhood,
              values.inspection.address.city,
              values.inspection.address.province,
              values.inspection.address.country,
            ]
              .filter(Boolean)
              .join(", ")}
            title="Marcar inmueble a tasar"
            help="La ubicación alimenta la búsqueda geográfica de antecedentes. Hacé clic para corregir el punto."
            onChange={onTasacionLocationChange}
          />
        </div>
        <div className="col-12">
          <div className="border rounded p-3 bg-light">
            <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start">
              <div>
                <h3 className="h6 mb-1">Parcela y normativa urbana</h3>
                <p className="small text-muted mb-0">
                  La selección del punto consulta IDECOR y conserva la respuesta
                  utilizada en este expediente.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                disabled={!hasCoordinates || parcelLoading}
                onClick={onQueryTasacionParcel}
              >
                {parcelLoading
                  ? "Consultando..."
                  : hasParcelData
                    ? "Actualizar parcela"
                    : "Consultar parcela"}
              </button>
            </div>
            {parcelError && (
              <div className="alert alert-warning py-2 mt-2 mb-0">{parcelError}</div>
            )}
            {parcelMessage && (
              <div className="alert alert-success py-2 mt-2 mb-0">{parcelMessage}</div>
            )}
            {hasParcelData && (
              <div className="row g-2 small mt-2">
                <div className="col-md-4">
                  <span className="text-muted">Nomenclatura:</span>{" "}
                  <strong>{parcelSummary.nomenclature || "Sin dato"}</strong>
                </div>
                <div className="col-md-4">
                  <span className="text-muted">Terreno:</span>{" "}
                  <strong>
                    {parcelSummary.landArea !== "" &&
                    Number.isFinite(Number(parcelSummary.landArea))
                      ? `${Number(parcelSummary.landArea).toLocaleString("es-AR")} m²`
                      : "Sin dato"}
                  </strong>
                </div>
                <div className="col-md-4">
                  <span className="text-muted">Zona:</span>{" "}
                  <strong>{parcelSummary.zone || "Sin dato"}</strong>
                </div>
                <div className="col-md-4">
                  <span className="text-muted">FOS:</span>{" "}
                  <strong>{parcelSummary.fos !== "" ? parcelSummary.fos : "Sin dato"}</strong>
                </div>
                <div className="col-md-4">
                  <span className="text-muted">FOT:</span>{" "}
                  <strong>{parcelSummary.fot !== "" ? parcelSummary.fot : "Sin dato"}</strong>
                </div>
                <div className="col-md-4">
                  <span className="text-muted">Valuación fiscal:</span>{" "}
                  <strong>
                    {parcelSummary.totalValuation !== "" &&
                    Number.isFinite(Number(parcelSummary.totalValuation))
                      ? Number(parcelSummary.totalValuation).toLocaleString(
                          "es-AR",
                          {style: "currency", currency: "ARS"},
                        )
                      : "Sin dato"}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Zonificación e infraestructura">
        <InputField label="Zonificación / distrito" value={values.inspection.zoning.code} onChange={(value) => setValue("inspection.zoning.code", value)} className="col-md-3" />
        <InputField label="FOT" type="number" step="0.01" value={values.inspection.zoning.fot} onChange={(value) => setValue("inspection.zoning.fot", value)} className="col-md-2" />
        <InputField label="FOS" type="number" step="0.01" value={values.inspection.zoning.fos} onChange={(value) => setValue("inspection.zoning.fos", value)} className="col-md-2" />
        <InputField label="Uso permitido" value={values.inspection.zoning.permittedUse} onChange={(value) => setValue("inspection.zoning.permittedUse", value)} className="col-md-5" />
        {services.map(([id, label]) => <ToggleField key={id} id={`service-${id}`} label={label} checked={values.inspection.services[id]} onChange={(checked) => setValue(`inspection.services.${id}`, checked)} className="col-6 col-md-4" />)}
      </SectionCard>

      <SectionCard title="Entorno, riesgos y evidencia">
        <TextAreaField label="Descripción del entorno" value={values.inspection.environmentNotes} onChange={(value) => setValue("inspection.environmentNotes", value)} className="col-md-6" rows={4} />
        <TextAreaField label="Riesgos o factores adversos" value={values.inspection.riskNotes} onChange={(value) => setValue("inspection.riskNotes", value)} className="col-md-6" rows={4} help="Inundabilidad, servidumbres, ruidos, contaminación, seguridad, estado estructural u otros." />
        <TextAreaField label="Documentación y fotografías examinadas" value={values.inspection.documentationNotes} onChange={(value) => setValue("inspection.documentationNotes", value)} rows={3} help="En esta etapa se registra la evidencia; la carga de archivos se incorporará como extensión del módulo." />
      </SectionCard>
    </>
  );
};

export const TasacionStepThree = ({ values, setValue }) => {
  const weightedSurface = calculateWeightedSurface(values.subject.surfaces, values.parameters.surfaceWeights);
  const ross = calculateRossHeidecke({ age: values.subject.age, usefulLife: values.subject.usefulLife, condition: values.subject.condition });
  const lotPosition = values.subject.lot.position;
  const showSecondaryFront = ["esquina", "doble_frente", "irregular"].includes(lotPosition);
  const mainFrontLabel = lotPosition === "interno" ? "Ancho del acceso" : lotPosition === "doble_frente" ? "Frente sobre calle A" : "Frente principal";
  const secondaryFrontLabel = lotPosition === "doble_frente" ? "Frente sobre calle B" : "Frente sobre calle secundaria";
  const depthLabel = lotPosition === "doble_frente" ? "Distancia media entre calles" : "Fondo / profundidad media";

  return (
    <>
      <SectionCard title="Identificación física y funcional">
        <SelectField label="Tipología" value={values.subject.typology} onChange={(value) => setValue("subject.typology", value)} options={TASACION_TIPOLOGIAS} className="col-md-4" />
        <SelectField label="Ocupación" value={values.subject.occupancy} onChange={(value) => setValue("subject.occupancy", value)} options={[{ id: "desocupado", label: "Desocupado" }, { id: "propietario", label: "Ocupado por propietario" }, { id: "alquilado", label: "Alquilado" }, { id: "ocupado_terceros", label: "Ocupado por terceros" }]} className="col-md-4" />
        <SelectField label="Mejor uso considerado" value={values.subject.bestUse} onChange={(value) => setValue("subject.bestUse", value)} options={[{ id: "uso_actual", label: "Uso actual" }, { id: "reconversion", label: "Reconversión" }, { id: "desarrollo", label: "Desarrollo" }, { id: "demolicion", label: "Demolición" }]} className="col-md-4" />
        <TextAreaField label="Descripción del inmueble" value={values.subject.description} onChange={(value) => setValue("subject.description", value)} rows={4} />
        <TextAreaField label="Fundamento del mejor uso" value={values.subject.bestUseRationale} onChange={(value) => setValue("subject.bestUseRationale", value)} rows={2} />
      </SectionCard>

      <SectionCard title="Antigüedad, calidad y conservación" help="La vida útil es estimada por el tasador según el sistema constructivo; no es una constante universal.">
        <InputField label="Antigüedad (años)" type="number" min="0" value={values.subject.age} onChange={(value) => setValue("subject.age", value)} className="col-md-3" />
        <InputField label="Vida útil estimada (años)" type="number" min="1" value={values.subject.usefulLife} onChange={(value) => setValue("subject.usefulLife", value)} className="col-md-3" />
        <SelectField label="Estado Ross-Heidecke" value={String(values.subject.condition)} onChange={(value) => setValue("subject.condition", Number(value))} options={ROSS_HEIDECKE_ESTADOS} className="col-md-3" />
        <SelectField label="Calidad constructiva" value={values.subject.constructionQuality} onChange={(value) => setValue("subject.constructionQuality", value)} options={[{ id: "economica", label: "Económica" }, { id: "estandar", label: "Estándar" }, { id: "buena", label: "Buena" }, { id: "superior", label: "Superior" }, { id: "especial", label: "Especial" }]} className="col-md-3" />
        <ResultValue label="Vida consumida" value={`${ross.lifeConsumedPercent}%`} />
        <ResultValue label="Depreciación calculada" value={`${ross.totalDepreciationPercent}%`} help="Se utiliza en el método del costo." />
        <ResultValue label="Coeficiente remanente" value={ross.remainingCoefficient.toFixed(4)} />
      </SectionCard>

      <SectionCard title="Superficies" help="La superficie ponderada es una herramienta comparativa configurable, no un coeficiente normativo fijo.">
        {[
          ["cubierta", "Cubierta"], ["semicubierta", "Semicubierta"], ["balcon", "Balcón / terraza"],
          ["descubierta", "Descubierta"], ["terreno", "Terreno"],
        ].map(([id, label]) => <InputField key={id} label={`${label} (m²)`} type="number" min="0" step="0.01" value={values.subject.surfaces[id]} onChange={(value) => setValue(`subject.surfaces.${id}`, value)} className="col-6 col-md-3" />)}
        <ResultValue label="Superficie ponderada" value={`${weightedSurface.toLocaleString("es-AR")} m²`} emphasis />
      </SectionCard>

      <SectionCard title="Configuración y medidas del lote" help="Las superficies se expresan en m²; los frentes y profundidades, en metros lineales. En un lote esquina deben informarse las dos líneas municipales.">
        <SelectField label="Posición del lote" value={lotPosition} onChange={(value) => setValue("subject.lot.position", value)} options={TASACION_POSICIONES_LOTE} className="col-md-4" />
        {lotPosition && lotPosition !== "no_aplica" && (
          <>
            <InputField label={`${mainFrontLabel} (m lineales)`} type="number" min="0" step="0.01" value={values.subject.lot.mainFront} onChange={(value) => setValue("subject.lot.mainFront", value)} className="col-6 col-md-4" />
            {showSecondaryFront && <InputField label={`${secondaryFrontLabel} (m lineales)`} type="number" min="0" step="0.01" value={values.subject.lot.secondaryFront} onChange={(value) => setValue("subject.lot.secondaryFront", value)} className="col-6 col-md-4" />}
            <InputField label={`${depthLabel} (m lineales)`} type="number" min="0" step="0.01" value={values.subject.lot.averageDepth} onChange={(value) => setValue("subject.lot.averageDepth", value)} className="col-6 col-md-4" />
            <TextAreaField label="Observaciones sobre forma y medidas" value={values.subject.lot.dimensionsNotes} onChange={(value) => setValue("subject.lot.dimensionsNotes", value)} rows={2} help="Usá este campo para lotes trapezoidales, martillo, ochavas o medidas no uniformes." />
          </>
        )}
      </SectionCard>

      <SectionCard title="Características relativas">
        <InputField label="Piso" value={values.subject.floor} onChange={(value) => setValue("subject.floor", value)} className="col-md-3" />
        <SelectField label="Disposición" value={values.subject.disposition} onChange={(value) => setValue("subject.disposition", value)} options={[{ id: "frente", label: "Frente" }, { id: "contrafrente_abierto", label: "Contrafrente abierto" }, { id: "interno", label: "Interno" }, { id: "no_aplica", label: "No aplica" }]} className="col-md-3" />
        <InputField label="Orientación" value={values.subject.orientation} onChange={(value) => setValue("subject.orientation", value)} className="col-md-3" />
        <TextAreaField label="Amenities y características positivas" value={values.subject.amenities} onChange={(value) => setValue("subject.amenities", value)} className="col-md-6" rows={3} />
        <TextAreaField label="Factores adversos propios" value={values.subject.adverseFactors} onChange={(value) => setValue("subject.adverseFactors", value)} className="col-md-6" rows={3} />
      </SectionCard>
    </>
  );
};

const comparableAdjustmentLabels = {
  offer: "Oferta / negociación", time: "Fecha", location: "Ubicación", surface: "Superficie",
  floor: "Piso", disposition: "Disposición", quality: "Calidad", ageCondition: "Edad / estado",
  extras: "Extras", other: "Otros",
};

const formatComparableDistance = (value) => {
  if (!Number.isFinite(Number(value))) return "No calculada";
  if (Number(value) < 1000) return `${Math.round(Number(value))} m`;
  return `${(Number(value) / 1000).toLocaleString("es-AR", {
    maximumFractionDigits: 2,
  })} km`;
};

const ComparableEditor = ({ comparable, index, calculated, setComparableValue, removeComparable, currency }) => (
  <article className="card border mb-3">
    <div className="card-header d-flex justify-content-between align-items-center">
      <strong>Antecedente {index + 1}</strong>
      <button type="button" className="btn btn-sm btn-outline-danger" onClick={removeComparable}>Quitar</button>
    </div>
    <div className="card-body">
      <div className="row g-3">
        <SelectField label="Tipo de dato" value={comparable.dataType} onChange={(value) => setComparableValue("dataType", value)} options={COMPARABLE_TIPOS_DATO} className="col-md-3" />
        <InputField label="Fuente / inmobiliaria" value={comparable.source} onChange={(value) => setComparableValue("source", value)} className="col-md-3" />
        <InputField label="Fecha de verificación" type="date" value={comparable.verifiedAt} onChange={(value) => setComparableValue("verifiedAt", value)} className="col-md-3" />
        <InputField label="Confiabilidad (1 a 5)" type="number" min="1" max="5" step="1" value={comparable.reliabilityWeight} onChange={(value) => setComparableValue("reliabilityWeight", value)} className="col-md-3" />
        <InputField label="Tipología del antecedente" value={comparable.propertyType} onChange={(value) => setComparableValue("propertyType", value)} className="col-md-3" />
        <InputField label="Operación" value={comparable.operation} onChange={(value) => setComparableValue("operation", value)} className="col-md-3" />
        <InputField label="Moneda confirmada" value={comparable.currency} onChange={(value) => setComparableValue("currency", value.toUpperCase())} className="col-md-3" help={`Debe coincidir con ${currency}. Si convertís el precio, documentá tipo de cambio y fecha.`} />
        <div className="col-md-3">
          <label className="form-label">Distancia al inmueble</label>
          <div className="form-control bg-light">{formatComparableDistance(comparable.distanceMeters)}</div>
        </div>
        <InputField label="Dirección" value={comparable.address} onChange={(value) => setComparableValue("address", value)} className="col-md-5" />
        <InputField label="URL de evidencia" type="url" value={comparable.sourceUrl} onChange={(value) => setComparableValue("sourceUrl", value)} className="col-md-4" />
        <InputField label={`Precio (${currency})`} type="number" min="0" step="0.01" value={comparable.price} onChange={(value) => setComparableValue("price", value)} className="col-md-3" />
        {[["cubierta", "Cubierta"], ["semicubierta", "Semicubierta"], ["balcon", "Balcón / terraza"], ["descubierta", "Descubierta"], ["terreno", "Terreno"]].map(([id, label]) => <InputField key={id} label={`${label} (m²)`} type="number" min="0" step="0.01" value={comparable.surfaces[id]} onChange={(value) => setComparableValue(`surfaces.${id}`, value)} className="col-6 col-md-3" />)}
        <div className="col-12">
          <details>
            <summary className="fw-semibold text-primary">Coeficientes de homogeneización</summary>
            <div className="row g-3 mt-1">
              {Object.entries(comparableAdjustmentLabels).map(([id, label]) => <InputField key={id} label={label} type="number" min="0" step="0.001" value={comparable.adjustments[id]} onChange={(value) => setComparableValue(`adjustments.${id}`, value)} className="col-6 col-md-3" />)}
              <div className="col-12"><div className="form-text">Cada factor transforma el antecedente como si tuviera características equivalentes al bien tasado. La dirección del ajuste debe justificarse.</div></div>
            </div>
          </details>
        </div>
        <TextAreaField label="Notas y justificación de ajustes" value={comparable.notes} onChange={(value) => setComparableValue("notes", value)} rows={2} />
        {comparable.sourceSnapshot && (
          <div className="col-12">
            <details className="border rounded p-3 bg-light">
              <summary className="fw-semibold">Evidencia capturada e inmutable</summary>
              <div className="small mt-2">
                Fuente: {comparable.sourceSnapshot.provider || comparable.source}
                {comparable.sourceSnapshot.recordId
                  ? ` · Registro ${comparable.sourceSnapshot.recordId}`
                  : ""}
                {comparable.sourceCapturedAt
                  ? ` · Capturado ${new Date(comparable.sourceCapturedAt).toLocaleString("es-AR")}`
                  : ""}
              </div>
              <div className="form-text">
                La ficha puede editarse después; esta copia conserva los datos utilizados en el expediente.
              </div>
            </details>
          </div>
        )}
        {calculated?.currencyCompatible === false && Number(comparable.price) > 0 && (
          <div className="col-12">
            <div className="alert alert-warning py-2 mb-0">
              La moneda “{comparable.currency || "sin confirmar"}” no coincide con {currency}.
              Confirmala o convertí el precio antes de usar este antecedente.
            </div>
          </div>
        )}
        <ResultValue label="Construida ponderada" value={`${calculated?.weightedSurface || 0} m²`} />
        <ResultValue label="Terreno" value={`${calculated?.landSurface || 0} m²`} />
        <ResultValue label="Base del valor unitario" value={`${calculated?.comparisonSurface || 0} m²`} help={calculated?.unitBasis === "land" ? "Se usa el terreno." : "Se usa la superficie construida ponderada."} />
        <ResultValue label="Valor unitario" value={formatTasacionMoney(calculated?.unitPrice, currency)} />
        <ResultValue label="Unitario homogeneizado" value={formatTasacionMoney(calculated?.homogenizedUnitPrice, currency)} help={`K total: ${calculated?.totalAdjustmentFactor || 0}`} emphasis />
      </div>
    </div>
  </article>
);

export const TasacionStepFour = ({
  values,
  setValue,
  calculation,
  addComparable,
  removeComparable,
  setComparableValue,
  inmuebles = [],
  onAddMappedComparable,
  canAddComparable = true,
  inmobiliariaId = "",
}) => {
  const currency = values.scope.currency === "OTRA" ? "USD" : values.scope.currency;

  return (
    <>
      <SectionCard title="Selección de métodos" help="La selección depende de la finalidad, el mejor uso y la calidad de la evidencia, no sólo de la tipología.">
        {TASACION_METODOS.map((method) => <ToggleField key={method.id} id={`method-${method.id}`} label={`${method.label}${method.disabled ? " · próximamente" : ""}`} checked={values.methods[method.id]} disabled={method.disabled} onChange={(checked) => setValue(`methods.${method.id}`, checked)} className="col-md-6" help={method.disabled ? "La arquitectura lo contempla, pero el motor todavía no lo ejecuta." : ""} />)}
        <TextAreaField label="Fundamento de la selección metodológica" value={values.methods.selectionRationale} onChange={(value) => setValue("methods.selectionRationale", value)} rows={2} />
      </SectionCard>

      {values.methods.comparative && (
        <section className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white py-3 d-flex flex-wrap justify-content-between gap-2 align-items-center">
            <div><h2 className="h6 mb-1">Método comparativo directo</h2><p className="text-muted small mb-0">Mínimo operativo: 3 antecedentes. Recomendado: 5 o más cuando el mercado lo permita.</p></div>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={addComparable} disabled={!canAddComparable}>+ Agregar antecedente</button>
          </div>
          <div className="card-body">
            <div className="row g-3 mb-4">
              <SelectField
                label="Base para calcular el valor unitario"
                value={values.methods.comparativeUnitBasis}
                onChange={(value) => setValue("methods.comparativeUnitBasis", value)}
                options={COMPARATIVE_UNIT_BASES}
                className="col-md-6"
                help={COMPARATIVE_UNIT_BASES.find((item) => item.id === values.methods.comparativeUnitBasis)?.help}
              />
              <ResultValue
                label="Base aplicada"
                value={calculation.comparative.resolvedUnitBasis === "land" ? "Terreno" : "Construida ponderada"}
                help={`${calculation.comparative.subjectComparisonSurface.toLocaleString("es-AR")} m² en el inmueble sujeto`}
              />
            </div>
            <ComparableMapSelector
              subjectLocation={values.inspection.geolocation}
              subjectInmuebleId={values.propertyLink?.inmuebleId || ""}
              inmuebles={inmuebles}
              existingComparables={values.comparables}
              onAddComparable={onAddMappedComparable}
              inmobiliariaId={inmobiliariaId}
            />
            {values.comparables.map((comparable, index) => <ComparableEditor key={comparable.id} comparable={comparable} index={index} calculated={calculation.comparative.comparables[index]} currency={currency} setComparableValue={(path, value) => setComparableValue(index, path, value)} removeComparable={() => removeComparable(index)} />)}
            <div className={`alert ${calculation.comparative.meetsMinimumSample ? "alert-success" : "alert-warning"} mb-0`}>
              Antecedentes válidos: <strong>{calculation.comparative.validComparableCount}</strong> de un máximo operativo de 5. {calculation.comparative.meetsMinimumSample ? "Se alcanza el mínimo operativo." : "Faltan antecedentes completos para continuar."}
              {calculation.comparative.meetsRecommendedSample && " Se alcanza la muestra recomendada de 5."}
            </div>
          </div>
        </section>
      )}

      {values.methods.cost && (
        <>
          <SectionCard title="Valor del suelo" help="Se comparan las características del terreno y su aptitud; no se aplica la tabla Fitte-Cervini.">
            <InputField label={`Valor base del terreno por m² (${currency})`} type="number" min="0" step="0.01" value={values.costMethod.landUnitValue} onChange={(value) => setValue("costMethod.landUnitValue", value)} className="col-md-4" />
            <InputField label="Fuente del valor del suelo" value={values.costMethod.landValueSource} onChange={(value) => setValue("costMethod.landValueSource", value)} className="col-md-8" />
            {Object.entries({ location: "Ubicación", measures: "Frente y fondo", surface: "Superficie", shape: "Forma", topography: "Topografía", buildability: "Aptitud / edificabilidad", services: "Servicios", corner: "Esquina" }).map(([id, label]) => <InputField key={id} label={`Factor: ${label}`} type="number" min="0" step="0.001" value={values.costMethod.landAdjustments[id]} onChange={(value) => setValue(`costMethod.landAdjustments.${id}`, value)} className="col-6 col-md-3" />)}
            <TextAreaField label="Justificación de los ajustes del suelo" value={values.costMethod.landAdjustmentRationale} onChange={(value) => setValue("costMethod.landAdjustmentRationale", value)} rows={2} />
          </SectionCard>
          <SectionCard title="Costo de reposición depreciado">
            <InputField label={`Costo de reposición a nuevo por m² (${currency})`} type="number" min="0" step="0.01" value={values.costMethod.replacementCostPerSquareMeter} onChange={(value) => setValue("costMethod.replacementCostPerSquareMeter", value)} className="col-md-4" />
            <InputField label="Fuente y fecha del costo" value={values.costMethod.replacementCostSource} onChange={(value) => setValue("costMethod.replacementCostSource", value)} className="col-md-5" />
            <InputField label="Factor costo semicubierto" type="number" min="0" step="0.01" value={values.costMethod.semiCoveredCostFactor} onChange={(value) => setValue("costMethod.semiCoveredCostFactor", value)} className="col-md-3" />
            <InputField label="Valor residual (%)" type="number" min="0" max="100" step="0.1" value={values.costMethod.residualPercent} onChange={(value) => setValue("costMethod.residualPercent", value)} className="col-md-3" />
            <InputField label={`Depreciación funcional (${currency})`} type="number" min="0" step="0.01" value={values.costMethod.functionalDepreciationAmount} onChange={(value) => setValue("costMethod.functionalDepreciationAmount", value)} className="col-md-3" />
            <SelectField label="Escenario" value={values.costMethod.scenario} onChange={(value) => setValue("costMethod.scenario", value)} options={[{ id: "conservar", label: "Conservar" }, { id: "remodelar", label: "Remodelar" }, { id: "demoler", label: "Demoler" }]} className="col-md-3" />
            {values.costMethod.scenario === "remodelar" && <InputField label={`Costo de remodelación (${currency})`} type="number" min="0" step="0.01" value={values.costMethod.remodelingCost} onChange={(value) => setValue("costMethod.remodelingCost", value)} className="col-md-3" />}
            {values.costMethod.scenario === "demoler" && <InputField label={`Demolición y limpieza (${currency})`} type="number" min="0" step="0.01" value={values.costMethod.demolitionCost} onChange={(value) => setValue("costMethod.demolitionCost", value)} className="col-md-3" />}
            <InputField label={`Otros ajustes (+/- ${currency})`} type="number" step="0.01" value={values.costMethod.otherAdjustments} onChange={(value) => setValue("costMethod.otherAdjustments", value)} className="col-md-3" />
            <TextAreaField label="Notas del método del costo" value={values.costMethod.notes} onChange={(value) => setValue("costMethod.notes", value)} rows={2} />
            <ResultValue label="Valor del suelo" value={formatTasacionMoney(calculation.cost.landValue, currency)} />
            <ResultValue label="Edificación depreciada" value={formatTasacionMoney(calculation.cost.adoptedBuildingValue, currency)} />
            <ResultValue label="Valor indicado por costo" value={formatTasacionMoney(calculation.cost.indicatedValue, currency)} emphasis />
          </SectionCard>
        </>
      )}
    </>
  );
};

export const TasacionStepFive = ({ values, setValue, calculation }) => {
  const currency = values.scope.currency === "OTRA" ? "USD" : values.scope.currency;
  const mortgageVisible = values.scope.reportType === "garantia_hipotecaria" || values.scope.purpose === "garantia";
  const range = values.parameters.quickSaleReferenceRange;

  return (
    <>
      <SectionCard title="Resultados de los métodos" help="Los indicadores ayudan al profesional, pero no reemplazan la reconciliación fundada.">
        {values.methods.comparative && <><ResultValue label="Comparativo · promedio" value={formatTasacionMoney(calculation.comparative.averageUnitValue * calculation.comparative.subjectComparisonSurface, currency)} /><ResultValue label="Comparativo · mediana" value={formatTasacionMoney(calculation.comparative.medianUnitValue * calculation.comparative.subjectComparisonSurface, currency)} /><ResultValue label="Comparativo · ponderado" value={formatTasacionMoney(calculation.comparative.indicatedValue, currency)} emphasis /><ResultValue label="Dispersión muestral" value={`${calculation.comparative.coefficientOfVariationPercent}%`} help={`${calculation.comparative.validComparableCount} antecedentes válidos`} /></>}
        {values.methods.cost && <ResultValue label="Costo separativo" value={formatTasacionMoney(calculation.cost.indicatedValue, currency)} help={`Suelo ${formatTasacionMoney(calculation.cost.landValue, currency)} + mejoras`} emphasis={!values.methods.comparative} />}
      </SectionCard>

      <SectionCard title="Reconciliación profesional">
        <SelectField label="Método principal adoptado" value={values.conclusion.selectedMethod} onChange={(value) => setValue("conclusion.selectedMethod", value)} options={TASACION_METODOS.filter((item) => !item.disabled)} className="col-md-4" />
        <InputField label={`Valor de mercado adoptado (${currency})`} type="number" min="0" step="0.01" value={values.conclusion.adoptedMarketValue} onChange={(value) => setValue("conclusion.adoptedMarketValue", value)} className="col-md-4" required />
        <div className="col-md-4 d-flex align-items-end gap-2">
          {values.methods.comparative && <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setValue("conclusion.adoptedMarketValue", calculation.comparative.indicatedValue)}>Usar comparativo</button>}
          {values.methods.cost && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setValue("conclusion.adoptedMarketValue", calculation.cost.indicatedValue)}>Usar costo</button>}
        </div>
        <TextAreaField label="Fundamento del valor adoptado" value={values.conclusion.rationale} onChange={(value) => setValue("conclusion.rationale", value)} rows={4} help="Explicá la ponderación relativa de la evidencia, la dispersión y cualquier apartamiento del valor indicado." />
        <TextAreaField label="Dictamen pericial" value={values.conclusion.professionalOpinion} onChange={(value) => setValue("conclusion.professionalOpinion", value)} className="col-md-6" rows={4} />
        <TextAreaField label="Supuestos, reservas y limitaciones" value={values.conclusion.limitations} onChange={(value) => setValue("conclusion.limitations", value)} className="col-md-6" rows={4} />
      </SectionCard>

      {mortgageVisible && (
        <SectionCard title="Escenario de garantía hipotecaria" help="Los resultados son una simulación técnica. No representan una oferta ni un límite universal de crédito del BCRA.">
          <SelectField label="Destino" value={values.mortgage.destination} onChange={(value) => { setValue("mortgage.destination", value); setValue("mortgage.guaranteeFactor", value === "vivienda_propia" ? 0.75 : 0.5); }} options={[{ id: "vivienda_propia", label: "Vivienda propia" }, { id: "otros_usos", label: "Comercial / otros usos" }]} className="col-md-4" />
          <ToggleField id="purchase-financing" label="Financia adquisición" checked={values.mortgage.isPurchaseFinancing} onChange={(checked) => setValue("mortgage.isPurchaseFinancing", checked)} className="col-md-4" />
          {values.mortgage.isPurchaseFinancing && <InputField label={`Precio de adquisición (${currency})`} type="number" min="0" value={values.mortgage.acquisitionPrice} onChange={(value) => setValue("mortgage.acquisitionPrice", value)} className="col-md-4" />}
          <InputField label="Coeficiente de realización" type="number" min={range.min} max={range.max} step="0.01" value={values.mortgage.quickSaleFactor} onChange={(value) => setValue("mortgage.quickSaleFactor", value)} className="col-md-3" help={`Rango de referencia configurado: ${range.min} a ${range.max}.`} />
          <InputField label={`Costos directos de realización (${currency})`} type="number" min="0" value={values.mortgage.directRealizationCosts} onChange={(value) => setValue("mortgage.directRealizationCosts", value)} className="col-md-3" />
          <InputField label="Factor de cómputo configurado" type="number" min="0" max="1" step="0.01" value={values.mortgage.guaranteeFactor} onChange={(value) => setValue("mortgage.guaranteeFactor", value)} className="col-md-3" help="No se presenta como monto máximo prestable." />
          <InputField label={`Préstamo propuesto (${currency})`} type="number" min="0" value={values.mortgage.proposedLoanAmount} onChange={(value) => setValue("mortgage.proposedLoanAmount", value)} className="col-md-3" />
          <TextAreaField label="Política o condiciones de la entidad financiera" value={values.mortgage.institutionPolicyNotes} onChange={(value) => setValue("mortgage.institutionPolicyNotes", value)} rows={2} />
          <ResultValue label="Valor de realización" value={formatTasacionMoney(calculation.risk.quickSaleValue, currency)} />
          <ResultValue label="Garantía computable simulada" value={formatTasacionMoney(calculation.risk.guaranteeComputableValue, currency)} />
          <ResultValue label="LTV sobre base conservadora" value={`${calculation.risk.ltvPercent}%`} help={`Base: ${formatTasacionMoney(calculation.risk.conservativeLtvBase, currency)}`} emphasis />
        </SectionCard>
      )}

      <div className="alert alert-warning">
        <strong>Antes de emitir:</strong> completá la identidad del profesional, enviá el
        expediente a revisión y confirmá la firma desde la vista del informe. La emisión
        conserva esta versión de forma inmutable; una corrección posterior genera otra versión.
      </div>
    </>
  );
};
