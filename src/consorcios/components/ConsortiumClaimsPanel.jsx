import { useCallback, useEffect, useMemo, useState } from "react";

import ConsortiumPrivateDocumentButton from "./ConsortiumPrivateDocumentButton";
import {
  addConsortiumClaimMessage,
  createConsortiumClaim,
  getConsortiumClaimEvents,
  getConsortiumClaims,
  updateConsortiumClaim,
} from "../services/consorcio.service";
import {
  CONSORTIUM_CLAIM_CATEGORIES,
  CONSORTIUM_CLAIM_PRIORITIES,
  CONSORTIUM_CLAIM_STATUSES,
  CONSORTIUM_COMMUNICATION_TYPES,
  CONSORTIUM_DOCUMENT_ACCEPT,
  getConsortiumClaimCategory,
  getConsortiumClaimPriority,
  getConsortiumClaimStatus,
  getConsortiumCommunicationType,
} from "../utils/consorcio.constants";
import {
  getConsortiumClaimReference,
  isConsortiumClaimOpen,
} from "../utils/consorcio.helpers";
import { isConsortiumDocumentFileValid } from "../utils/consorcioPortal.helpers";

const emptyClaimForm = (unitId = "") => ({
  unitId,
  communicationType: "request",
  title: "",
  description: "",
  category: "other",
  priority: "normal",
  location: "common_area",
  accessNotes: "",
  file: null,
});

const emptyMessageForm = () => ({ message: "", visibility: "public", file: null });

const formatDateTime = (value = "") => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value || "—"
    : parsed.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
};

const ConsortiumHistoryEvent = ({ item }) => {
  const actor = item.authorRole === "resident" ? "Consorcista" : "Administración";
  const eventTitle = {
    created: "Mensaje recibido",
    status_update: "Cambio de estado",
    management_update: "Actualización de gestión",
    message: actor,
  }[item.type] || actor;
  const previousStatus = item.previousStatus
    ? getConsortiumClaimStatus(item.previousStatus)
    : null;
  const nextStatus = item.status ? getConsortiumClaimStatus(item.status) : null;
  const previousPriority = item.previousPriority
    ? getConsortiumClaimPriority(item.previousPriority)
    : null;
  const nextPriority = item.priority ? getConsortiumClaimPriority(item.priority) : null;

  return (
    <article className={`border-start ps-3 pb-3 ${item.visibility === "internal" ? "border-warning" : "border-primary"}`}>
      <div className="d-flex flex-wrap justify-content-between gap-2">
        <strong>
          {eventTitle}
          {item.authorName ? ` · ${item.authorName}` : ""}
          {item.visibility === "internal" ? " · nota interna" : ""}
        </strong>
        <small className="text-muted">{formatDateTime(item.createdAtIso)}</small>
      </div>
      {item.type === "status_update" && nextStatus && (
        <div className="d-flex flex-wrap align-items-center gap-2 my-2">
          {previousStatus && item.previousStatus !== item.status && (
            <><span className={`badge ${previousStatus.badge}`}>{previousStatus.label}</span><span aria-hidden="true">→</span></>
          )}
          <span className={`badge ${nextStatus.badge}`}>{nextStatus.label}</span>
        </div>
      )}
      {previousPriority && nextPriority && item.previousPriority !== item.priority && (
        <div className="small mb-2">
          Prioridad: <span className={`badge ${previousPriority.badge}`}>{previousPriority.label}</span>
          <span className="mx-2" aria-hidden="true">→</span>
          <span className={`badge ${nextPriority.badge}`}>{nextPriority.label}</span>
        </div>
      )}
      <p className="mb-1">{item.message}</p>
      {item.attachmentStoragePath && (
        <ConsortiumPrivateDocumentButton
          path={item.attachmentStoragePath}
          fileName={item.attachmentFileName}
          label="Ver archivo"
        />
      )}
    </article>
  );
};

const ConsortiumClaimsPanel = ({
  inmobiliariaId,
  consortium,
  units = [],
  suppliers = [],
  selectedUnit = null,
  portalMode = false,
  canManage = false,
}) => {
  const consortiumId = consortium?.id || selectedUnit?.consortiumId || "";
  const fixedUnitId = portalMode ? selectedUnit?.id || "" : "";
  const [claims, setClaims] = useState([]);
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [events, setEvents] = useState([]);
  const [claimForm, setClaimForm] = useState(() => emptyClaimForm(fixedUnitId));
  const [messageForm, setMessageForm] = useState(emptyMessageForm);
  const [adminForm, setAdminForm] = useState({
    status: "open",
    priority: "normal",
    assignedSupplierId: "",
    scheduledDate: "",
    resolutionSummary: "",
    featuredInPortal: false,
    portalPublicTitle: "",
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [eventLoading, setEventLoading] = useState(false);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);

  const loadClaims = useCallback(async () => {
    if (!inmobiliariaId || !consortiumId || (portalMode && !fixedUnitId)) return;
    try {
      setLoading(true);
      setError("");
      const data = await getConsortiumClaims(inmobiliariaId, {
        consortiumId,
        unitId: fixedUnitId,
        includeClosed: true,
      });
      setClaims(data);
      setSelectedClaimId((current) => (
        current && data.some((item) => item.id === current)
          ? current
          : data.find(isConsortiumClaimOpen)?.id || data[0]?.id || ""
      ));
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar los mensajes.");
    } finally {
      setLoading(false);
    }
  }, [consortiumId, fixedUnitId, inmobiliariaId, portalMode]);

  useEffect(() => { loadClaims(); }, [loadClaims]);
  useEffect(() => {
    setClaimForm(emptyClaimForm(fixedUnitId));
    setShowCreateForm(false);
  }, [fixedUnitId]);

  const selectedClaim = useMemo(
    () => claims.find((item) => item.id === selectedClaimId) || null,
    [claims, selectedClaimId],
  );

  const loadEvents = useCallback(async () => {
    if (!selectedClaim) {
      setEvents([]);
      return;
    }
    try {
      setEventLoading(true);
      const data = await getConsortiumClaimEvents(inmobiliariaId, {
        claimId: selectedClaim.id,
        portalOnly: portalMode,
      });
      setEvents(data);
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar el historial del mensaje.");
    } finally {
      setEventLoading(false);
    }
  }, [inmobiliariaId, portalMode, selectedClaim]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => {
    if (!selectedClaim) return;
    setAdminForm({
      status: selectedClaim.status || "open",
      priority: selectedClaim.priority || "normal",
      assignedSupplierId: selectedClaim.assignedSupplierId || "",
      scheduledDate: selectedClaim.scheduledDate || "",
      resolutionSummary: selectedClaim.resolutionSummary || "",
      featuredInPortal: selectedClaim.featuredInPortal === true,
      portalPublicTitle: selectedClaim.portalPublicTitle || "",
    });
    setMessageForm(emptyMessageForm());
  }, [selectedClaim]);

  const openCount = claims.filter(isConsortiumClaimOpen).length;
  const urgentCount = claims.filter((item) => isConsortiumClaimOpen(item) && item.priority === "urgent").length;
  const resolvedCount = claims.filter((item) => item.status === "resolved" || item.status === "closed").length;

  const submitClaim = async (event) => {
    event.preventDefault();
    try {
      setOperation("create");
      setError("");
      setSuccess("");
      if (claimForm.file && !isConsortiumDocumentFileValid(claimForm.file)) {
        throw new Error("Adjuntá un PDF, JPG, PNG o WEBP de hasta 10 MB.");
      }
      const claimId = await createConsortiumClaim({
        inmobiliariaId,
        consortiumId,
        ...claimForm,
        unitId: fixedUnitId || claimForm.unitId,
        authorRole: portalMode ? "resident" : "admin",
      });
      setClaimForm(emptyClaimForm(fixedUnitId));
      setFileInputKey((current) => current + 1);
      setShowCreateForm(false);
      setSuccess(portalMode
        ? "Mensaje enviado. La administración ya puede verlo y responderte."
        : "Mensaje registrado por la administración.");
      await loadClaims();
      setSelectedClaimId(claimId);
    } catch (saveError) {
      setError(saveError.message || "No se pudo registrar el mensaje.");
    } finally {
      setOperation("");
    }
  };

  const submitAdminUpdate = async (event) => {
    event.preventDefault();
    if (!selectedClaim) return;
    try {
      setOperation("update");
      setError("");
      setSuccess("");
      await updateConsortiumClaim({ inmobiliariaId, claimId: selectedClaim.id, ...adminForm });
      setSuccess("Mensaje actualizado. El cambio quedó visible en su historial.");
      await loadClaims();
      await loadEvents();
    } catch (saveError) {
      setError(saveError.message || "No se pudo actualizar el mensaje.");
    } finally {
      setOperation("");
    }
  };

  const submitMessage = async (event) => {
    event.preventDefault();
    if (!selectedClaim) return;
    try {
      setOperation("message");
      setError("");
      setSuccess("");
      if (messageForm.file && !isConsortiumDocumentFileValid(messageForm.file)) {
        throw new Error("Adjuntá un PDF, JPG, PNG o WEBP de hasta 10 MB.");
      }
      await addConsortiumClaimMessage({
        inmobiliariaId,
        claimId: selectedClaim.id,
        ...messageForm,
        visibility: portalMode ? "public" : messageForm.visibility,
        authorRole: portalMode ? "resident" : "admin",
      });
      setMessageForm(emptyMessageForm());
      setFileInputKey((current) => current + 1);
      setSuccess(portalMode ? "Mensaje enviado a la administración." : "Actualización agregada al historial.");
      await loadClaims();
      await loadEvents();
    } catch (saveError) {
      setError(saveError.message || "No se pudo agregar el mensaje.");
    } finally {
      setOperation("");
    }
  };

  return (
    <section className="card border-0 shadow-sm mb-4 consortium-section-anchor" id="mensajes-administracion">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
          <div>
            <span className="badge text-bg-light border mb-2">Comunicación</span>
            <h2 className="h5 mb-1">Mensajes a la Administración</h2>
            <p className="text-muted small mb-0">Avisos, solicitudes y reclamos quedan ordenados con responsables, archivos e historial.</p>
          </div>
          {(portalMode || canManage) && <button className="btn btn-primary" type="button" onClick={() => setShowCreateForm((current) => !current)}>{showCreateForm ? "Cerrar formulario" : "Nuevo mensaje"}</button>}
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {showCreateForm && <form className="rounded border bg-light p-3 mb-4" onSubmit={submitClaim}>
          <h3 className="h6 mb-3">Enviar un mensaje a la Administración</h3>
          <div className="row g-3">
            <fieldset className="col-12">
              <legend className="form-label">Tipo de mensaje *</legend>
              <div className="row g-2">
                {CONSORTIUM_COMMUNICATION_TYPES.map((item) => (
                  <div className="col-md-4" key={item.id}>
                    <label className={`form-check border rounded p-3 ps-5 h-100 ${claimForm.communicationType === item.id ? "border-primary bg-white" : ""}`}>
                      <input className="form-check-input" type="radio" name="consortium-communication-type" value={item.id} checked={claimForm.communicationType === item.id} onChange={(event) => setClaimForm((current) => ({ ...current, communicationType: event.target.value }))} required />
                      <span className="form-check-label d-block ps-1"><strong>{item.label}</strong><small className="text-muted d-block mt-1">{item.description}</small></span>
                    </label>
                  </div>
                ))}
              </div>
            </fieldset>
            {!portalMode && <div className="col-md-4"><label className="form-label">Unidad *</label><select className="form-select" value={claimForm.unitId} onChange={(event) => setClaimForm((current) => ({ ...current, unitId: event.target.value }))} required><option value="">Seleccionar...</option>{units.filter((item) => item.active !== false).map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}</select></div>}
            <div className={portalMode ? "col-md-8" : "col-md-5"}><label className="form-label">Título *</label><input className="form-control" placeholder="Ej. Pérdida de agua en el palier" value={claimForm.title} onChange={(event) => setClaimForm((current) => ({ ...current, title: event.target.value }))} required /></div>
            <div className="col-md-3"><label className="form-label">Prioridad</label><select className="form-select" value={claimForm.priority} onChange={(event) => setClaimForm((current) => ({ ...current, priority: event.target.value }))}>{CONSORTIUM_CLAIM_PRIORITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
            <div className="col-md-4"><label className="form-label">Categoría</label><select className="form-select" value={claimForm.category} onChange={(event) => setClaimForm((current) => ({ ...current, category: event.target.value }))}>{CONSORTIUM_CLAIM_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
            <div className="col-md-4"><label className="form-label">Ubicación</label><select className="form-select" value={claimForm.location} onChange={(event) => setClaimForm((current) => ({ ...current, location: event.target.value }))}><option value="common_area">Espacio común</option><option value="unit">Dentro de la unidad</option></select></div>
            <div className="col-md-4"><label className="form-label">Foto o documento</label><input key={`claim-${fileInputKey}`} className="form-control" type="file" accept={CONSORTIUM_DOCUMENT_ACCEPT} onChange={(event) => setClaimForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} /></div>
            <div className="col-12"><label className="form-label">Descripción *</label><textarea className="form-control" rows="4" placeholder="Indicá qué sucede, desde cuándo y cualquier dato útil para revisarlo." value={claimForm.description} onChange={(event) => setClaimForm((current) => ({ ...current, description: event.target.value }))} required /></div>
            <div className="col-12"><label className="form-label">Indicaciones de acceso</label><input className="form-control" placeholder="Horarios posibles, persona de contacto o instrucciones" value={claimForm.accessNotes} onChange={(event) => setClaimForm((current) => ({ ...current, accessNotes: event.target.value }))} /></div>
            {(claimForm.communicationType === "notice" || claimForm.priority === "urgent") && <div className="col-12"><div className="alert alert-warning mb-0"><strong>Situaciones urgentes:</strong> si existe peligro inmediato para personas o bienes, avisá también al servicio de emergencias correspondiente. Este canal no reemplaza una comunicación de emergencia.</div></div>}
            <div className="col-12 d-flex justify-content-end"><button className="btn btn-primary" disabled={operation === "create"} type="submit">{operation === "create" ? "Enviando..." : "Enviar mensaje"}</button></div>
          </div>
        </form>}

        <div className="row g-3 mb-4 consortium-claim-summary">
          <div className="col-sm-4"><div className="rounded border p-3"><small className="text-muted d-block">En gestión</small><strong className="fs-5">{openCount}</strong></div></div>
          <div className="col-sm-4"><div className="rounded border p-3"><small className="text-muted d-block">Urgentes</small><strong className={urgentCount ? "fs-5 text-danger" : "fs-5"}>{urgentCount}</strong></div></div>
          <div className="col-sm-4"><div className="rounded border p-3"><small className="text-muted d-block">Resueltos</small><strong className="fs-5 text-success">{resolvedCount}</strong></div></div>
        </div>

        {loading ? <p className="text-center text-muted py-4">Cargando mensajes...</p> : <div className="row g-4">
          <div className="col-lg-5">
            <div className="list-group consortium-claim-list">
              {claims.map((claim) => {
                const status = getConsortiumClaimStatus(claim.status);
                const priority = getConsortiumClaimPriority(claim.priority);
                const communicationType = getConsortiumCommunicationType(claim.communicationType);
                return <button className={`list-group-item list-group-item-action text-start ${selectedClaimId === claim.id ? "active" : ""}`} key={claim.id} type="button" onClick={() => setSelectedClaimId(claim.id)}><div className="d-flex justify-content-between gap-2"><strong>{claim.title}</strong><small>{getConsortiumClaimReference(claim)}</small></div><div className="small mt-1">Unidad {claim.unitSnapshot?.code || claim.unitId} · {getConsortiumClaimCategory(claim.category).label}</div><div className="d-flex flex-wrap gap-2 mt-2"><span className={`badge ${communicationType.badge}`}>{communicationType.label}</span><span className={`badge ${status.badge}`}>{status.label}</span><span className={`badge ${priority.badge}`}>{priority.label}</span></div><small className={`d-block mt-2 ${selectedClaimId === claim.id ? "text-white-50" : "text-muted"}`}>{claim.lastPublicMessage || claim.description}</small></button>;
              })}
              {!claims.length && <div className="list-group-item text-center text-muted py-4">Todavía no hay mensajes registrados.</div>}
            </div>
          </div>

          <div className="col-lg-7">
            {!selectedClaim && <div className="rounded border text-center text-muted p-5">Seleccioná un mensaje para ver su seguimiento.</div>}
            {selectedClaim && <div className="rounded border p-3 consortium-claim-detail">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3"><div><small className="text-muted">{getConsortiumClaimReference(selectedClaim)}</small><h3 className="h5 mb-1">{selectedClaim.title}</h3><span className="text-muted small">Unidad {selectedClaim.unitSnapshot?.code || selectedClaim.unitId} · creado {formatDateTime(selectedClaim.createdAtIso)}</span></div><div className="d-flex flex-wrap gap-2"><span className={`badge ${getConsortiumCommunicationType(selectedClaim.communicationType).badge}`}>{getConsortiumCommunicationType(selectedClaim.communicationType).label}</span><span className={`badge ${getConsortiumClaimStatus(selectedClaim.status).badge}`}>{getConsortiumClaimStatus(selectedClaim.status).label}</span><span className={`badge ${getConsortiumClaimPriority(selectedClaim.priority).badge}`}>{getConsortiumClaimPriority(selectedClaim.priority).label}</span></div></div>
              <p className="mb-2">{selectedClaim.description}</p>
              <div className="small text-muted mb-3">{selectedClaim.location === "unit" ? "Dentro de la unidad" : "Espacio común"}{selectedClaim.accessNotes ? ` · Acceso: ${selectedClaim.accessNotes}` : ""}</div>
              {selectedClaim.attachmentStoragePath && <div className="mb-3"><ConsortiumPrivateDocumentButton path={selectedClaim.attachmentStoragePath} fileName={selectedClaim.attachmentFileName} label="Ver adjunto inicial" /></div>}
              {(selectedClaim.assignedSupplierSnapshot?.name || selectedClaim.scheduledDate) && <div className="alert alert-info py-2"><strong>Intervención:</strong> {selectedClaim.assignedSupplierSnapshot?.name || "Administración"}{selectedClaim.scheduledDate ? ` · programada para ${selectedClaim.scheduledDate}` : ""}</div>}

              {canManage && !portalMode && <form className="rounded bg-light border p-3 mb-4" onSubmit={submitAdminUpdate}><h4 className="h6">Gestión del mensaje</h4><div className="row g-3"><div className="col-md-6"><label className="form-label">Estado</label><select className="form-select" value={adminForm.status} onChange={(event) => setAdminForm((current) => ({ ...current, status: event.target.value }))}>{CONSORTIUM_CLAIM_STATUSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="col-md-6"><label className="form-label">Prioridad</label><select className="form-select" value={adminForm.priority} onChange={(event) => setAdminForm((current) => ({ ...current, priority: event.target.value }))}>{CONSORTIUM_CLAIM_PRIORITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="col-md-7"><label className="form-label">Proveedor asignado</label><select className="form-select" value={adminForm.assignedSupplierId} onChange={(event) => setAdminForm((current) => ({ ...current, assignedSupplierId: event.target.value }))}><option value="">Sin proveedor asignado</option>{suppliers.filter((item) => item.active !== false).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div><div className="col-md-5"><label className="form-label">Fecha programada</label><input className="form-control" type="date" value={adminForm.scheduledDate} onChange={(event) => setAdminForm((current) => ({ ...current, scheduledDate: event.target.value }))} /></div><div className="col-12"><label className="form-label">Resolución / motivo de cierre</label><textarea className="form-control" rows="2" value={adminForm.resolutionSummary} onChange={(event) => setAdminForm((current) => ({ ...current, resolutionSummary: event.target.value }))} /><small className="text-muted">Es obligatorio al resolver, cerrar o rechazar.</small></div><div className="col-12"><label className="form-label">Título público anonimizado</label><input className="form-control" placeholder="Opcional; si queda vacío se genera uno según la categoría" value={adminForm.portalPublicTitle} onChange={(event) => setAdminForm((current) => ({ ...current, portalPublicTitle: event.target.value }))} /><small className="text-muted">No incluyas nombres, unidad ni datos que permitan identificar al remitente o a terceros.</small></div><div className="col-md-8"><div className="form-check"><input className="form-check-input" id={`feature-consortium-message-${selectedClaim.id}`} type="checkbox" checked={adminForm.featuredInPortal} onChange={(event) => setAdminForm((current) => ({ ...current, featuredInPortal: event.target.checked }))} /><label className="form-check-label" htmlFor={`feature-consortium-message-${selectedClaim.id}`}>Destacar en el tablero general visible para propietarios</label></div><small className="text-muted">Se comparte el estado y su evolución sin identificar al remitente ni a la unidad.</small></div><div className="col-md-4 text-end"><button className="btn btn-outline-primary" disabled={operation === "update"} type="submit">{operation === "update" ? "Guardando..." : "Guardar gestión"}</button></div></div></form>}

              <h4 className="h6">Historial</h4>
              {eventLoading ? <p className="text-muted">Cargando historial...</p> : <div className="consortium-claim-timeline mb-4">{events.map((item) => <ConsortiumHistoryEvent item={item} key={item.id} />)}{!events.length && <p className="text-muted">Todavía no hay novedades.</p>}</div>}

              <form className="rounded bg-light border p-3" onSubmit={submitMessage}><h4 className="h6">{portalMode ? "Enviar un mensaje" : "Agregar actualización"}</h4><div className="row g-3">{!portalMode && <div className="col-md-4"><label className="form-label">Visibilidad</label><select className="form-select" value={messageForm.visibility} onChange={(event) => setMessageForm((current) => ({ ...current, visibility: event.target.value }))}><option value="public">Visible para el consorcista</option><option value="internal">Nota interna</option></select></div>}<div className={portalMode ? "col-12" : "col-md-8"}><label className="form-label">Mensaje</label><textarea className="form-control" rows="3" value={messageForm.message} onChange={(event) => setMessageForm((current) => ({ ...current, message: event.target.value }))} /></div><div className="col-md-8"><label className="form-label">Archivo opcional</label><input key={`message-${fileInputKey}`} className="form-control" type="file" accept={CONSORTIUM_DOCUMENT_ACCEPT} onChange={(event) => setMessageForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} /></div><div className="col-md-4 d-flex align-items-end"><button className="btn btn-primary w-100" disabled={operation === "message"} type="submit">{operation === "message" ? "Enviando..." : "Agregar al historial"}</button></div></div></form>
            </div>}
          </div>
        </div>}
      </div>
    </section>
  );
};

export default ConsortiumClaimsPanel;
