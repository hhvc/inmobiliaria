import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  getInternalPermissions,
  getInternalRoleForInmobiliaria,
  isGlobalRoot,
} from "../../inmobiliaria/utils/inmobiliariaPermissions";
import { getInmuebleById } from "../../inmueble/services/inmueble.service";
import InteractiveMap from "../../mapa/components/InteractiveMap";
import { normalizeMapCoordinates } from "../../mapa/utils/mapa.helpers";
import TasacionWorkflowPanel from "../components/TasacionWorkflowPanel";
import { getTasacionById } from "../services/tasacion.service";
import {
  COMPARATIVE_UNIT_BASES,
  getTasacionEstado,
  TASACION_FINALIDADES,
  TASACION_POSICIONES_LOTE,
  TASACION_TIPOLOGIAS,
  TASACION_TIPOS_INFORME,
} from "../utils/tasacion.constants";
import {
  calculateTasacion,
  formatTasacionMoney,
} from "../utils/tasacion.helpers";
import { normalizeTasacion } from "../utils/tasacionSchema";
import {
  canEditTasacion,
  getTasacionVersionLabel,
} from "../utils/tasacionWorkflow.helpers";
import "../tasacion.css";

const findLabel = (options, value) =>
  options.find((item) => item.id === value)?.label || value || "No informado";

const ReportField = ({ label, value }) => (
  <div className="col-sm-6 col-lg-4 mb-3">
    <div className="text-uppercase text-muted tasacion-report-label">{label}</div>
    <div>{value || "No informado"}</div>
  </div>
);

const Money = ({ value, currency }) => formatTasacionMoney(value, currency);

const formatReportDate = (value, { withTime = true } = {}) => {
  if (!value) return "No registrada";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "No registrada";
  return withTime ? date.toLocaleString("es-AR") : date.toLocaleDateString("es-AR");
};

const TasacionReportPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { activeInmobiliariaId, activeInmobiliaria, loading: agencyLoading } =
    useActiveInmobiliariaModules();
  const [item, setItem] = useState(null);
  const [propertyImages, setPropertyImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeInmobiliariaId || !id) return;
    try {
      setLoading(true);
      setError("");
      const result = await getTasacionById(activeInmobiliariaId, id);
      if (!result) throw new Error("No se encontró la tasación.");
      const normalized = normalizeTasacion(result);
      setItem(normalized);

      if (normalized.propertyLink?.inmuebleId) {
        const inmueble = await getInmuebleById(
          activeInmobiliariaId,
          normalized.propertyLink.inmuebleId,
        );
        setPropertyImages((inmueble?.images || []).filter((image) => image?.url).slice(0, 6));
      } else {
        setPropertyImages([]);
      }
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar el informe.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, id]);

  useEffect(() => {
    load();
  }, [load]);

  const calculation = useMemo(() => {
    if (!item) return null;
    return ["emitida", "entregada", "anulada"].includes(item.estado)
      && item.calculationSnapshot
      ? item.calculationSnapshot
      : calculateTasacion(item);
  }, [item]);

  const canManage = useMemo(() => {
    const role = getInternalRoleForInmobiliaria(user, activeInmobiliariaId);
    return getInternalPermissions(role, isGlobalRoot(user)).canEditTasaciones;
  }, [activeInmobiliariaId, user]);

  if (agencyLoading || loading) {
    return <main className="container py-5 text-center">Preparando informe...</main>;
  }

  if (error || !item || !calculation) {
    return (
      <main className="container py-5">
        <div className="alert alert-danger">{error || "No se pudo preparar el informe."}</div>
        <Link className="btn btn-primary" to="/admin/tasaciones">Volver</Link>
      </main>
    );
  }

  const currency = item.scope.currency === "OTRA" ? item.scope.otherCurrency || "USD" : item.scope.currency;
  const state = getTasacionEstado(item.estado);
  const address = item.inspection.address;
  const validComparables = calculation.comparative.comparables.filter((entry) => entry.valid);
  const isProfessional = item.scope.reportType !== "estimacion_comercial";
  const hasProfessionalIdentity = Boolean(
    item.scope.appraiser.name && (!isProfessional || item.scope.appraiser.license),
  );
  const canPresentAsFinal = ["emitida", "entregada"].includes(item.estado)
    && hasProfessionalIdentity
    && item.review.signatureConfirmed;
  const agencySnapshot = item.issuance?.agencySnapshot;
  const reportAgency = agencySnapshot?.name
    ? agencySnapshot
    : {
      name: activeInmobiliaria?.nombre || activeInmobiliaria?.razonSocial || "ONO Prop",
      legalName: activeInmobiliaria?.razonSocial || "",
      taxId: activeInmobiliaria?.cuit || "",
      logoUrl: activeInmobiliaria?.branding?.logo?.url || "",
      contact: {
        email: activeInmobiliaria?.configuracion?.contacto?.email || "",
        phone: activeInmobiliaria?.configuracion?.contacto?.telefono || "",
      },
    };
  const verificationCode = item.issuance?.verificationCode || "";
  const verificationUrl = verificationCode
    ? `${window.location.origin}/tasaciones/verificar/${verificationCode}`
    : "";
  const subjectCoordinates = normalizeMapCoordinates(
    item.inspection.geolocation?.latitude,
    item.inspection.geolocation?.longitude,
  );
  const subjectPoint = subjectCoordinates
    ? {
      id: `tasacion:${item.id}`,
      kind: "subject",
      title: "Inmueble tasado",
      address: [address.street, address.number, address.city].filter(Boolean).join(" "),
      position: [subjectCoordinates.latitude, subjectCoordinates.longitude],
    }
    : null;
  const comparableMapPoints = validComparables.map((entry, index) => {
    const rawCoordinates = entry.sourceSnapshot?.coordinates;
    const coordinates = Array.isArray(rawCoordinates)
      ? normalizeMapCoordinates(rawCoordinates[1], rawCoordinates[0])
      : normalizeMapCoordinates(rawCoordinates?.latitude, rawCoordinates?.longitude);
    if (!coordinates) return null;
    return {
      id: `report-comparable:${entry.id || index}`,
      kind: entry.sourceSnapshot?.provider === "OMI Córdoba" ? "omi" : "comparable",
      title: entry.address || `Antecedente ${index + 1}`,
      address: entry.source || "Fuente manual",
      priceLabel: formatTasacionMoney(entry.price, currency),
      position: [coordinates.latitude, coordinates.longitude],
    };
  }).filter(Boolean);
  const watermark = item.estado === "anulada"
    ? "INFORME ANULADO"
    : canPresentAsFinal
      ? ""
      : "BORRADOR NO FIRMADO";

  return (
    <main className="container py-4 tasacion-workspace">
      <SEO title={`Informe de tasación · ${item.scope.clientName} | ONO Prop`} noIndex />

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4 no-print">
        <div>
          <span className={`badge ${state.badge} me-2`}>{state.label}</span>
          <span className="text-muted small">Expediente {id}</span>
        </div>
        <div className="d-flex gap-2">
          <Link className="btn btn-outline-secondary" to="/admin/tasaciones">Listado</Link>
          {canEditTasacion(item.estado) && (
            <Link className="btn btn-outline-primary" to={`/admin/tasaciones/${id}/editar`}>Editar</Link>
          )}
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir / guardar PDF</button>
        </div>
      </div>

      <TasacionWorkflowPanel
        item={item}
        inmobiliariaId={activeInmobiliariaId}
        inmobiliaria={activeInmobiliaria}
        canManage={canManage}
        onChanged={load}
      />

      <article className="tasacion-report card border-0 shadow-sm position-relative">
        {watermark && <div className="tasacion-watermark">{watermark}</div>}
        <div className="card-body p-4 p-lg-5 position-relative">
          <header className="border-bottom pb-4 mb-4">
            <div className="d-flex flex-wrap justify-content-between gap-4">
              <div className="d-flex align-items-start gap-3">
                {reportAgency.logoUrl && (
                  <img className="tasacion-report-logo" src={reportAgency.logoUrl} alt={`Logo de ${reportAgency.name}`} />
                )}
                <div>
                <p className="text-uppercase text-muted small mb-2">{reportAgency.name}</p>
                <h1 className="h2 mb-2">Informe de valuación inmobiliaria</h1>
                <p className="mb-0">{findLabel(TASACION_TIPOS_INFORME, item.scope.reportType)}</p>
                </div>
              </div>
              <div className="text-lg-end">
                <div><strong>{getTasacionVersionLabel(item)}</strong></div>
                <div><strong>Fecha de valuación:</strong> {item.scope.valuationDate}</div>
                <div><strong>Moneda:</strong> {currency}</div>
                <div><strong>Estado:</strong> {state.label}</div>
                {verificationCode && <div><strong>Código:</strong> {verificationCode}</div>}
              </div>
            </div>
          </header>

          <section className="mb-5">
            <h2 className="h5 border-bottom pb-2 mb-3">1. Encargo, identificación y alcance</h2>
            <div className="row">
              <ReportField label="Comitente" value={item.scope.clientName} />
              <ReportField label="Titular informado" value={item.scope.ownerName} />
              <ReportField label="Finalidad" value={findLabel(TASACION_FINALIDADES, item.scope.purpose)} />
              <ReportField label="Matrícula RPI / folio real" value={item.scope.propertyRegistry} />
              <ReportField label="Nomenclatura catastral" value={item.scope.cadastralNomenclature} />
              <ReportField label="Plano" value={item.scope.surveyPlan} />
            </div>
            {item.scope.titleNotes && <p className="mb-0"><strong>Documentación y dominio:</strong> {item.scope.titleNotes}</p>}
          </section>

          <section className="mb-5">
            <h2 className="h5 border-bottom pb-2 mb-3">2. Inspección, ubicación y entorno</h2>
            <div className="row">
              <ReportField label="Dirección" value={[address.street, address.number].filter(Boolean).join(" ")} />
              <ReportField label="Localidad" value={[address.neighborhood, address.city, address.province].filter(Boolean).join(", ")} />
              <ReportField label="Fecha de inspección" value={item.inspection.inspectionDate} />
              <ReportField label="Modalidad" value={item.inspection.mode} />
              <ReportField label="Zonificación" value={item.inspection.zoning.code} />
              <ReportField label="FOT / FOS" value={[item.inspection.zoning.fot, item.inspection.zoning.fos].filter(Boolean).join(" / ")} />
            </div>
            {item.inspection.environmentNotes && <p><strong>Entorno:</strong> {item.inspection.environmentNotes}</p>}
            {item.inspection.riskNotes && <p><strong>Riesgos observados:</strong> {item.inspection.riskNotes}</p>}
            {item.inspection.parcelData?.parcel && (
              <p className="small text-muted mb-0">
                <strong>Fuente parcelaria:</strong>{" "}
                {item.inspection.parcelData.provider || "IDECOR / Mapas Córdoba"}
                {item.inspection.parcelData.queriedAt
                  ? ` · consulta ${new Date(item.inspection.parcelData.queriedAt).toLocaleString("es-AR")}`
                  : ""}.
                La respuesta utilizada queda conservada en el expediente.
              </p>
            )}
          </section>

          {(subjectPoint || comparableMapPoints.length > 0) && (
            <section className="mb-5 tasacion-report-map-section">
              <h2 className="h5 border-bottom pb-2 mb-3">2.1. Localización de la evidencia</h2>
              <InteractiveMap
                subjectPoint={subjectPoint}
                points={comparableMapPoints}
                center={subjectPoint?.position}
                fitToPoints
                showParcelLayer={Boolean(subjectPoint)}
                className="tasacion-report-map"
              />
              <p className="small text-muted mt-2 mb-0">
                Punto rojo: inmueble sujeto. Puntos azules: antecedentes OMI. Puntos verdes:
                antecedentes propios. La ubicación forma parte del expediente privado.
              </p>
            </section>
          )}

          {propertyImages.length > 0 && (
            <section className="mb-5">
              <h2 className="h5 border-bottom pb-2 mb-3">2.2. Registro fotográfico vinculado</h2>
              <div className="tasacion-photo-grid">
                {propertyImages.map((image, index) => (
                  <figure className="mb-0" key={image.id || image.url}>
                    <img src={image.url} alt={image.alt || `Registro del inmueble ${index + 1}`} />
                    <figcaption>Imagen {index + 1}{image.description ? ` · ${image.description}` : ""}</figcaption>
                  </figure>
                ))}
              </div>
              <p className="small text-muted mt-2 mb-0">
                Imágenes tomadas del inmueble vinculado al momento de generar este informe.
              </p>
            </section>
          )}

          <section className="mb-5">
            <h2 className="h5 border-bottom pb-2 mb-3">3. Inmueble sujeto</h2>
            <div className="row">
              <ReportField label="Tipología" value={findLabel(TASACION_TIPOLOGIAS, item.subject.typology)} />
              <ReportField label="Antigüedad / vida útil" value={`${item.subject.age || 0} / ${item.subject.usefulLife || 0} años`} />
              <ReportField label="Estado Ross-Heidecke" value={calculation.cost.rossHeidecke.conditionLabel} />
              <ReportField label="Superficie cubierta" value={`${item.subject.surfaces.cubierta || 0} m²`} />
              <ReportField label="Superficie ponderada" value={`${calculation.comparative.subjectWeightedSurface} m²`} />
              <ReportField label="Terreno" value={`${item.subject.surfaces.terreno || 0} m²`} />
              <ReportField label="Posición del lote" value={findLabel(TASACION_POSICIONES_LOTE, item.subject.lot.position)} />
              <ReportField label="Frente principal" value={item.subject.lot.mainFront ? `${item.subject.lot.mainFront} m` : "No informado"} />
              {item.subject.lot.secondaryFront && <ReportField label="Segundo frente" value={`${item.subject.lot.secondaryFront} m`} />}
              <ReportField label="Fondo / profundidad media" value={item.subject.lot.averageDepth ? `${item.subject.lot.averageDepth} m` : "No informado"} />
            </div>
            <p>{item.subject.description || "No se incorporó una descripción general."}</p>
            {item.subject.lot.dimensionsNotes && <p><strong>Forma y medidas del lote:</strong> {item.subject.lot.dimensionsNotes}</p>}
            <p className="mb-0"><strong>Mejor uso considerado:</strong> {item.subject.bestUse}. {item.subject.bestUseRationale}</p>
          </section>

          {item.methods.comparative && (
            <section className="mb-5">
              <h2 className="h5 border-bottom pb-2 mb-3">4. Método comparativo</h2>
              <p>Se analizaron {validComparables.length} antecedentes válidos. La base unitaria aplicada fue <strong>{findLabel(COMPARATIVE_UNIT_BASES, calculation.comparative.resolvedUnitBasis)}</strong>. Los coeficientes son relativos al inmueble sujeto y quedan documentados para revisión.</p>
              <div className="table-responsive">
                <table className="table table-sm align-middle tasacion-comparables-table">
                  <thead>
                    <tr><th>Antecedente y evidencia</th><th>Tipo</th><th className="text-end">Precio</th><th className="text-end">Sup. pond.</th><th className="text-end">Terreno</th><th className="text-end">Factor</th><th className="text-end">Unitario homog.</th></tr>
                  </thead>
                  <tbody>
                    {validComparables.map((entry, index) => (
                      <tr key={entry.id || index}>
                        <td>
                          <div>{entry.address || entry.source || `Comparable ${index + 1}`}</div>
                          <div className="small text-muted">
                            {entry.source || "Fuente manual"}
                            {Number.isFinite(Number(entry.distanceMeters))
                              ? ` · ${(Number(entry.distanceMeters) / 1000).toLocaleString("es-AR", {maximumFractionDigits: 2})} km`
                              : ""}
                            {entry.sourceCapturedAt
                              ? ` · capturado ${new Date(entry.sourceCapturedAt).toLocaleDateString("es-AR")}`
                              : ""}
                            {entry.sourceSnapshot?.recordId
                              ? ` · registro ${entry.sourceSnapshot.recordId}`
                              : ""}
                          </div>
                        </td>
                        <td>{entry.dataType}</td>
                        <td className="text-end"><Money value={entry.price} currency={currency} /></td>
                        <td className="text-end">{entry.weightedSurface} m²</td>
                        <td className="text-end">{entry.landSurface} m²</td>
                        <td className="text-end">{entry.totalAdjustmentFactor}</td>
                        <td className="text-end"><Money value={entry.homogenizedUnitPrice} currency={currency} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row mt-3">
                <ReportField label="Promedio ponderado unitario" value={<Money value={calculation.comparative.weightedAverageUnitValue} currency={currency} />} />
                <ReportField label="Mediana unitaria" value={<Money value={calculation.comparative.medianUnitValue} currency={currency} />} />
                <ReportField label="Coeficiente de variación" value={`${calculation.comparative.coefficientOfVariationPercent}%`} />
                <ReportField label="Valor indicado" value={<Money value={calculation.comparative.indicatedValue} currency={currency} />} />
              </div>
              <p className="small text-muted mt-3 mb-0">
                Los antecedentes importados conservan una copia de la fuente,
                precio, moneda, superficies, coordenadas y fecha de captura
                utilizadas. Los cambios posteriores en las publicaciones de origen
                no alteran esta versión del expediente.
              </p>
            </section>
          )}

          {item.methods.cost && (
            <section className="mb-5">
              <h2 className="h5 border-bottom pb-2 mb-3">5. Método del costo: suelo y mejoras</h2>
              <div className="row">
                <ReportField label="Valor del suelo" value={<Money value={calculation.cost.landValue} currency={currency} />} />
                <ReportField label="Costo de reposición a nuevo" value={<Money value={calculation.cost.replacementCostNew} currency={currency} />} />
                <ReportField label="Depreciación total" value={`${calculation.cost.rossHeidecke.totalDepreciationPercent}%`} />
                <ReportField label="Valor mejoras depreciadas" value={<Money value={calculation.cost.adoptedBuildingValue} currency={currency} />} />
                <ReportField label="Escenario" value={calculation.cost.scenario} />
                <ReportField label="Valor indicado" value={<Money value={calculation.cost.indicatedValue} currency={currency} />} />
              </div>
              <p className="small text-muted mb-0">Los ajustes del terreno fueron ingresados por el tasador. Esta versión no aplica automáticamente una tabla Fitte-Cervini no documentada.</p>
            </section>
          )}

          <section className="mb-5 tasacion-conclusion p-4 rounded">
            <h2 className="h5 mb-3">Conclusión y reconciliación</h2>
            <div className="tasacion-final-value mb-3">
              <span>Valor de mercado adoptado</span>
              <strong><Money value={item.conclusion.adoptedMarketValue} currency={currency} /></strong>
            </div>
            <p><strong>Fundamento:</strong> {item.conclusion.rationale || "Pendiente."}</p>
            {item.conclusion.professionalOpinion && <p><strong>Dictamen:</strong> {item.conclusion.professionalOpinion}</p>}
            {item.conclusion.limitations && <p className="mb-0"><strong>Limitaciones:</strong> {item.conclusion.limitations}</p>}
          </section>

          {(item.scope.reportType === "garantia_hipotecaria" || item.scope.purpose === "garantia") && (
            <section className="mb-5">
              <h2 className="h5 border-bottom pb-2 mb-3">Escenario de garantía y realización</h2>
              <div className="row">
                <ReportField label="Valor de realización estimado" value={<Money value={calculation.risk.quickSaleValue} currency={currency} />} />
                <ReportField label="Factor de realización" value={`${(calculation.risk.quickSaleFactor * 100).toFixed(2)}%`} />
                <ReportField label="Valor computable simulado" value={<Money value={calculation.risk.guaranteeComputableValue} currency={currency} />} />
                <ReportField label="Monto de crédito propuesto" value={<Money value={calculation.risk.proposedLoanAmount} currency={currency} />} />
                <ReportField label="LTV informativo" value={`${calculation.risk.ltvPercent}%`} />
              </div>
              <p className="small text-muted mb-0">Los factores y el LTV son una simulación configurable. No representan un límite universal del BCRA ni obligan a una entidad financiera.</p>
            </section>
          )}

          <section className="mb-5">
            <h2 className="h5 border-bottom pb-2 mb-3">Trazabilidad documental</h2>
            <div className="row">
              <ReportField label="Serie" value={item.versioning?.seriesId || item.id} />
              <ReportField label="Versión" value={item.versioning?.versionNumber || 1} />
              <ReportField label="Expediente anterior" value={item.versioning?.previousTasacionId || "Primera versión"} />
              <ReportField label="Revisión" value={formatReportDate(item.review?.reviewedAt)} />
              <ReportField label="Emisión" value={formatReportDate(item.workflow?.issuedAt)} />
              <ReportField label="Entrega" value={formatReportDate(item.workflow?.deliveredAt)} />
            </div>
            {item.versioning?.changeReason && (
              <p><strong>Motivo de esta versión:</strong> {item.versioning.changeReason}</p>
            )}
            {item.estado === "anulada" && (
              <div className="alert alert-danger">
                <strong>Informe anulado:</strong> {item.annulment?.reason || "Sin motivo informado."}
              </div>
            )}
            {verificationCode && (
              <div className="tasacion-verification-box">
                <div>
                  <span className="text-uppercase small fw-semibold">Verificación pública</span>
                  <strong>{verificationCode}</strong>
                </div>
                <div className="small text-break">{verificationUrl}</div>
                <p className="small mb-0 mt-2">
                  El registro público confirma emisor, versión, fecha y vigencia sin exponer
                  cliente, domicilio exacto ni valor.
                </p>
              </div>
            )}
          </section>

          <section className="border-top pt-4">
            <h2 className="h6">Profesional y revisión</h2>
            <div className="row">
              <ReportField label="Profesional" value={item.scope.appraiser.name} />
              <ReportField label="Profesión" value={item.scope.appraiser.profession} />
              <ReportField label="Matrícula" value={item.scope.appraiser.license} />
            </div>
            {!canPresentAsFinal && (
              <div className="alert alert-warning mb-3">
                {item.estado === "anulada"
                  ? "Este documento fue anulado y no debe utilizarse como informe vigente."
                  : "Documento preliminar. No cuenta con confirmación de firma ni estado de emisión."}
                {isProfessional && !hasProfessionalIdentity ? " Falta identificar al profesional matriculado." : ""}
              </div>
            )}
            <div className="tasacion-signature-block">
              <div className="tasacion-signature-line" />
              <strong>{item.scope.appraiser.name || "Profesional responsable"}</strong>
              <span>
                {[item.scope.appraiser.profession, item.scope.appraiser.license && `M.P. ${item.scope.appraiser.license}`]
                  .filter(Boolean)
                  .join(" · ") || "Identificación pendiente"}
              </span>
              {item.review?.signatureConfirmed && (
                <small>Firma profesional confirmada en el circuito interno.</small>
              )}
            </div>
            <p className="small text-muted mb-0">
              Motor {calculation.engineVersion} · Parámetros {calculation.parameterVersion} ·
              Cálculo registrado el {formatReportDate(calculation.calculatedAt)}.
            </p>
          </section>

          <div className="tasacion-report-footer mt-4 pt-3 border-top" role="contentinfo">
            <div>
              <strong>{reportAgency.name}</strong>
              {reportAgency.legalName && reportAgency.legalName !== reportAgency.name
                ? ` · ${reportAgency.legalName}`
                : ""}
              {reportAgency.taxId ? ` · CUIT ${reportAgency.taxId}` : ""}
            </div>
            <div>
              {[reportAgency.contact?.email, reportAgency.contact?.phone].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      </article>
    </main>
  );
};

export default TasacionReportPage;
