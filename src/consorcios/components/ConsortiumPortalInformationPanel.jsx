import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ConsortiumPrivateDocumentButton from "./ConsortiumPrivateDocumentButton";
import {
  archiveConsortiumPortalResource,
  getConsortiumPortalResources,
  getConsortiumPortalSettings,
  saveConsortiumPortalResource,
  saveConsortiumPortalSettings,
} from "../services/consorcioPortalInformation.service";
import {
  CONSORTIUM_PORTAL_FILE_SECTIONS,
  CONSORTIUM_PORTAL_REQUIRED_FILE_SECTIONS,
  CONSORTIUM_PORTAL_SECTIONS,
  CONSORTIUM_PORTAL_VISIBILITIES,
  createEmptyConsortiumPortalResource,
  getConsortiumPortalSection,
} from "../utils/consorcioPortalInformation.constants";

const formatDate = (value = "") => {
  if (!value) return "";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("es-AR");
};

const ConsortiumPortalInformationPanel = ({
  inmobiliariaId,
  consortiumId,
  canManage = false,
}) => {
  const [settings, setSettings] = useState(null);
  const [resources, setResources] = useState([]);
  const [resourceForm, setResourceForm] = useState(null);
  const [editingResourceId, setEditingResourceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const resourceFormRef = useRef(null);

  const load = useCallback(async () => {
    if (!inmobiliariaId || !consortiumId || !canManage) return;
    try {
      setLoading(true);
      setError("");
      const [settingsData, resourceData] = await Promise.all([
        getConsortiumPortalSettings(inmobiliariaId, consortiumId),
        getConsortiumPortalResources(inmobiliariaId, consortiumId),
      ]);
      setSettings(settingsData);
      setResources(resourceData);
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar el centro de información.");
    } finally {
      setLoading(false);
    }
  }, [canManage, consortiumId, inmobiliariaId]);

  useEffect(() => { load(); }, [load]);

  const resourcesBySection = useMemo(() => Object.fromEntries(
    CONSORTIUM_PORTAL_SECTIONS.map((section) => [
      section.id,
      resources.filter((resource) => resource.section === section.id),
    ]),
  ), [resources]);

  if (!canManage) return null;

  const updateSection = (sectionId, changes) => {
    setSettings((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionId]: { ...current.sections[sectionId], ...changes },
      },
    }));
  };

  const focusResourceForm = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resourceFormRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        resourceFormRef.current
          ?.querySelector("[data-resource-form-first-field]")
          ?.focus({ preventScroll: true });
      });
    });
  };

  const saveSettings = async () => {
    try {
      setOperation("settings");
      setError("");
      setSuccess("");
      const saved = await saveConsortiumPortalSettings({
        inmobiliariaId,
        consortiumId,
        sections: settings.sections,
      });
      setSettings(saved);
      setSuccess("Visibilidad actualizada. También se recalcularon los accesos de propietarios y ocupantes.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la configuración.");
    } finally {
      setOperation("");
    }
  };

  const openNewResource = (sectionId) => {
    setEditingResourceId("");
    setResourceForm(createEmptyConsortiumPortalResource(sectionId));
    setFileInputKey((current) => current + 1);
    setError("");
    setSuccess("");
    focusResourceForm();
  };

  const openEditResource = (resource) => {
    setEditingResourceId(resource.id);
    setResourceForm({
      ...createEmptyConsortiumPortalResource(resource.section),
      ...resource,
      file: null,
    });
    setFileInputKey((current) => current + 1);
    setError("");
    setSuccess("");
    focusResourceForm();
  };

  const enableSection = async (sectionId) => {
    const section = getConsortiumPortalSection(sectionId);
    try {
      setOperation(`enable-${sectionId}`);
      setError("");
      setSuccess("");
      const nextSections = {
        ...settings.sections,
        [sectionId]: {
          ...settings.sections[sectionId],
          enabled: true,
        },
      };
      const saved = await saveConsortiumPortalSettings({
        inmobiliariaId,
        consortiumId,
        sections: nextSections,
      });
      setSettings(saved);
      setSuccess(`${section?.label || "El bloque"} ya está visible para los usuarios autorizados.`);
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo habilitar el bloque.");
    } finally {
      setOperation("");
    }
  };

  const submitResource = async (event) => {
    event.preventDefault();
    try {
      setOperation("resource");
      setError("");
      setSuccess("");
      if (resourceForm.published !== false) {
        const nextSections = {
          ...settings.sections,
          [resourceForm.section]: {
            ...settings.sections[resourceForm.section],
            enabled: true,
          },
        };
        const savedSettings = await saveConsortiumPortalSettings({
          inmobiliariaId,
          consortiumId,
          sections: nextSections,
        });
        setSettings(savedSettings);
      }
      await saveConsortiumPortalResource({
        inmobiliariaId,
        consortiumId,
        resourceId: editingResourceId,
        value: resourceForm,
      });
      if (resourceForm.published === false) {
        setSuccess(editingResourceId ? "Contenido actualizado y oculto." : "Contenido guardado como oculto.");
      } else {
        setSuccess(editingResourceId
          ? "Contenido actualizado y bloque visible para los usuarios autorizados."
          : "Contenido agregado y bloque habilitado para los usuarios autorizados.");
      }
      setResourceForm(null);
      setEditingResourceId("");
      setFileInputKey((current) => current + 1);
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar el contenido.");
    } finally {
      setOperation("");
    }
  };

  const archiveResource = async (resource) => {
    if (!window.confirm(`¿Ocultar y archivar “${resource.title}”?`)) return;
    try {
      setOperation(`archive-${resource.id}`);
      setError("");
      await archiveConsortiumPortalResource({ inmobiliariaId, resourceId: resource.id });
      setSuccess("Contenido archivado. El documento se conserva en el historial interno.");
      await load();
    } catch (archiveError) {
      setError(archiveError.message || "No se pudo archivar el contenido.");
    } finally {
      setOperation("");
    }
  };

  const selectedSection = resourceForm
    ? getConsortiumPortalSection(resourceForm.section)
    : null;
  const needsFile = resourceForm
    ? CONSORTIUM_PORTAL_FILE_SECTIONS.has(resourceForm.section)
    : false;
  const requiresFile = resourceForm
    ? CONSORTIUM_PORTAL_REQUIRED_FILE_SECTIONS.has(resourceForm.section)
    : false;

  return (
    <section className="card border-0 shadow-sm mb-4 consortium-section-anchor" id="informacion-edificio">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
          <div>
            <span className="badge text-bg-light border mb-2">Mi Consorcio</span>
            <h2 className="h5 mb-1">Centro de información del edificio</h2>
            <p className="text-muted small mb-0">Definí qué información se publica y si corresponde verla como propietario u ocupante.</p>
          </div>
          <button className="btn btn-primary" disabled={!settings || operation === "settings"} type="button" onClick={saveSettings}>
            {operation === "settings" ? "Guardando..." : "Guardar visibilidad"}
          </button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        {loading && <p className="text-muted">Cargando configuración...</p>}

        {settings && <div className="row g-3">
          {CONSORTIUM_PORTAL_SECTIONS.map((section) => {
            const sectionSettings = settings.sections[section.id];
            const sectionResources = resourcesBySection[section.id] || [];
            return (
              <div className="col-xl-6" key={section.id}>
                <article className={`border rounded h-100 p-3 ${sectionSettings.enabled ? "border-primary" : "bg-light"}`}>
                  <div className="d-flex justify-content-between gap-3">
                    <div>
                      <h3 className="h6 mb-1">{section.label}</h3>
                      <p className="text-muted small mb-2">{section.description}</p>
                    </div>
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" role="switch" aria-label={`Mostrar ${section.label}`} checked={sectionSettings.enabled} onChange={(event) => updateSection(section.id, { enabled: event.target.checked })} />
                    </div>
                  </div>
                  <div className="row g-2 align-items-end mb-3">
                    <div className="col-sm-7">
                      <label className="form-label small">Visibilidad</label>
                      <select className="form-select form-select-sm" disabled={section.fixedVisibility} value={sectionSettings.visibility} onChange={(event) => updateSection(section.id, { visibility: event.target.value })}>
                        {CONSORTIUM_PORTAL_VISIBILITIES.map((visibility) => <option key={visibility.id} value={visibility.id}>{visibility.label}</option>)}
                      </select>
                    </div>
                    {section.id !== "managed_messages" && <div className="col-sm-5 text-sm-end"><button className="btn btn-sm btn-outline-primary" type="button" onClick={() => openNewResource(section.id)}>Agregar {section.resourceLabel}</button></div>}
                  </div>

                  {section.id === "evacuation" && <div className="alert alert-warning py-2 small"><strong>Recomendación:</strong> revisá el procedimiento y realizá simulacros periódicos, dejando constancia de las fechas y observaciones.</div>}
                  {section.id === "safety_report" && <div className="alert alert-info py-2 small"><strong>Recomendación:</strong> encargá informes periódicos a profesionales idóneos y publicá la versión vigente junto con las medidas correctivas.</div>}
                  {section.id === "managed_messages" && <p className="small text-muted mb-0">Al habilitarlo, los propietarios verán todos los expedientes de forma anonimizada. Podés destacar casos desde “Mensajes a la Administración”.</p>}
                  {!sectionSettings.enabled && sectionResources.some((resource) => resource.published) && <div className="alert alert-warning py-2 small d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <span>Hay contenido publicado, pero este bloque todavía está oculto en Mi Consorcio.</span>
                    <button className="btn btn-sm btn-warning" disabled={operation === `enable-${section.id}`} type="button" onClick={() => enableSection(section.id)}>
                      {operation === `enable-${section.id}` ? "Habilitando..." : "Habilitar bloque"}
                    </button>
                  </div>}

                  {sectionResources.map((resource) => (
                    <div className="border-top py-2" key={resource.id}>
                      <div className="d-flex justify-content-between gap-2">
                        <div>
                          <strong className="small">{resource.title}</strong>
                          <small className="d-block text-muted">
                            {resource.expiresAt ? `Vence ${formatDate(resource.expiresAt)}` : resource.meetingDate ? formatDate(resource.meetingDate) : resource.published ? "Publicado" : "Oculto"}
                          </small>
                        </div>
                        <div className="btn-group btn-group-sm">
                          {resource.storagePath && <ConsortiumPrivateDocumentButton path={resource.storagePath} fileName={resource.fileName} label="Ver" />}
                          <button className="btn btn-outline-secondary" type="button" onClick={() => openEditResource(resource)}>Editar</button>
                          <button className="btn btn-outline-danger" disabled={operation === `archive-${resource.id}`} type="button" onClick={() => archiveResource(resource)}>Archivar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {section.id !== "managed_messages" && !sectionResources.length && <p className="small text-muted mb-0">Todavía no hay contenido cargado.</p>}
                </article>
              </div>
            );
          })}
        </div>}

        {resourceForm && selectedSection && <form ref={resourceFormRef} className="border rounded bg-light p-3 mt-4 scroll-mt-3" onSubmit={submitResource}>
          <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
            <div><h3 className="h6 mb-1">{editingResourceId ? "Editar" : "Agregar"} · {selectedSection.label}</h3><p className="small text-muted mb-0">El historial conserva cada póliza, renovación, informe o acta como registro independiente.</p></div>
            <button className="btn-close" type="button" aria-label="Cerrar" onClick={() => setResourceForm(null)} />
          </div>
          <div className="row g-3">
            <div className="col-md-6"><label className="form-label">Título o nombre *</label><input className="form-control" data-resource-form-first-field value={resourceForm.title} onChange={(event) => setResourceForm((current) => ({ ...current, title: event.target.value }))} required /></div>
            {resourceForm.section === "emergency_contacts" && <><div className="col-md-3"><label className="form-label">Teléfono</label><input className="form-control" value={resourceForm.phone} onChange={(event) => setResourceForm((current) => ({ ...current, phone: event.target.value }))} /></div><div className="col-md-3"><label className="form-label">Email</label><input className="form-control" type="email" value={resourceForm.email} onChange={(event) => setResourceForm((current) => ({ ...current, email: event.target.value }))} /></div></>}
            {resourceForm.section === "regulations" && <div className="col-md-6"><label className="form-label">URL *</label><input className="form-control" type="url" placeholder="https://..." value={resourceForm.url} onChange={(event) => setResourceForm((current) => ({ ...current, url: event.target.value }))} required /></div>}
            {resourceForm.section === "owner_council" && <><div className="col-md-4"><label className="form-label">Función</label><input className="form-control" placeholder="Ej. Presidente" value={resourceForm.memberRole} onChange={(event) => setResourceForm((current) => ({ ...current, memberRole: event.target.value }))} /></div><div className="col-md-4"><label className="form-label">Teléfono</label><input className="form-control" value={resourceForm.phone} onChange={(event) => setResourceForm((current) => ({ ...current, phone: event.target.value }))} /></div><div className="col-md-4"><label className="form-label">Email</label><input className="form-control" type="email" value={resourceForm.email} onChange={(event) => setResourceForm((current) => ({ ...current, email: event.target.value }))} /></div></>}
            {["safety_report", "insurance"].includes(resourceForm.section) && <div className="col-md-4"><label className="form-label">Profesional / aseguradora</label><input className="form-control" value={resourceForm.providerName} onChange={(event) => setResourceForm((current) => ({ ...current, providerName: event.target.value }))} /></div>}
            {resourceForm.section === "insurance" && <><div className="col-md-4"><label className="form-label">Número de póliza</label><input className="form-control" value={resourceForm.policyNumber} onChange={(event) => setResourceForm((current) => ({ ...current, policyNumber: event.target.value }))} /></div><div className="col-12"><label className="form-label">Coberturas</label><textarea className="form-control" rows="3" value={resourceForm.coverage} onChange={(event) => setResourceForm((current) => ({ ...current, coverage: event.target.value }))} /></div></>}
            {["safety_report", "ownership_regulations", "coexistence_regulations"].includes(resourceForm.section) && <div className="col-md-4"><label className="form-label">Fecha del documento</label><input className="form-control" type="date" value={resourceForm.issuedDate} onChange={(event) => setResourceForm((current) => ({ ...current, issuedDate: event.target.value }))} /></div>}
            {resourceForm.section === "insurance" && <><div className="col-md-3"><label className="form-label">Vigencia desde</label><input className="form-control" type="date" value={resourceForm.effectiveDate} onChange={(event) => setResourceForm((current) => ({ ...current, effectiveDate: event.target.value }))} /></div><div className="col-md-3"><label className="form-label">Vencimiento</label><input className="form-control" type="date" value={resourceForm.expiresAt} onChange={(event) => setResourceForm((current) => ({ ...current, expiresAt: event.target.value }))} /></div></>}
            {resourceForm.section === "safety_report" && <div className="col-md-4"><label className="form-label">Revisar / renovar antes de</label><input className="form-control" type="date" value={resourceForm.expiresAt} onChange={(event) => setResourceForm((current) => ({ ...current, expiresAt: event.target.value }))} /></div>}
            {resourceForm.section === "assembly_minutes" && <div className="col-md-4"><label className="form-label">Fecha de la asamblea</label><input className="form-control" type="date" value={resourceForm.meetingDate} onChange={(event) => setResourceForm((current) => ({ ...current, meetingDate: event.target.value }))} /></div>}
            <div className="col-12"><label className="form-label">Resumen</label><textarea className="form-control" rows="2" value={resourceForm.summary} onChange={(event) => setResourceForm((current) => ({ ...current, summary: event.target.value }))} /></div>
            {["emergency_contacts", "evacuation", "safety_report"].includes(resourceForm.section) && <div className="col-12"><label className="form-label">Detalle / instrucciones</label><textarea className="form-control" rows="5" value={resourceForm.body} onChange={(event) => setResourceForm((current) => ({ ...current, body: event.target.value }))} /></div>}
            {needsFile && <div className="col-md-8"><label className="form-label">Documento {editingResourceId || !requiresFile ? "(opcional)" : "*"}</label><input key={fileInputKey} className="form-control" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setResourceForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} required={requiresFile && !editingResourceId} /></div>}
            <div className="col-md-4"><div className="form-check mt-md-4"><input className="form-check-input" id="portal-resource-published" type="checkbox" checked={resourceForm.published !== false} onChange={(event) => setResourceForm((current) => ({ ...current, published: event.target.checked }))} /><label className="form-check-label" htmlFor="portal-resource-published">Publicar en Mi Consorcio</label><small className="d-block text-muted">Al guardar, el bloque se habilitará automáticamente.</small></div></div>
            <div className="col-12 text-end"><button className="btn btn-primary" disabled={operation === "resource"} type="submit">{operation === "resource" ? "Guardando..." : "Guardar contenido"}</button></div>
          </div>
        </form>}
      </div>
    </section>
  );
};

export default ConsortiumPortalInformationPanel;
