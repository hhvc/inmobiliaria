import { useCallback, useEffect, useMemo, useState } from "react";

import ConsortiumPrivateDocumentButton from "./ConsortiumPrivateDocumentButton";
import {
  getConsortiumManagedMessages,
  getConsortiumPortalResources,
  getConsortiumPortalSettings,
} from "../services/consorcioPortalInformation.service";
import {
  CONSORTIUM_PORTAL_SECTIONS,
  isConsortiumPortalSectionVisibleTo,
} from "../utils/consorcioPortalInformation.constants";
import {
  getConsortiumClaimCategory,
  getConsortiumClaimPriority,
  getConsortiumClaimStatus,
  getConsortiumCommunicationType,
} from "../utils/consorcio.constants";

const formatDate = (value = "") => {
  if (!value) return "";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("es-AR");
};

const ResourceDocumentButton = ({ resource }) => (
  resource.storagePath
    ? <ConsortiumPrivateDocumentButton path={resource.storagePath} fileName={resource.fileName} label="Ver documento" />
    : null
);

const ConsortiumBuildingInformation = ({ selectedUnit }) => {
  const [settings, setSettings] = useState(null);
  const [resources, setResources] = useState([]);
  const [managedMessages, setManagedMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const accessRole = selectedUnit?.portalAccessRole === "owner" ? "owner" : "occupant";

  const load = useCallback(async () => {
    if (!selectedUnit?.inmobiliariaId || !selectedUnit?.consortiumId) return;
    try {
      setLoading(true);
      setError("");
      const settingsData = await getConsortiumPortalSettings(
        selectedUnit.inmobiliariaId,
        selectedUnit.consortiumId,
      );
      const visibleSections = CONSORTIUM_PORTAL_SECTIONS.filter((section) => (
        isConsortiumPortalSectionVisibleTo(
          settingsData.sections[section.id],
          accessRole,
        )
      ));
      const contentSections = visibleSections.filter((section) => (
        section.id !== "managed_messages"
      ));
      const resourceGroups = await Promise.all(contentSections.map((section) => (
        getConsortiumPortalResources(
          selectedUnit.inmobiliariaId,
          selectedUnit.consortiumId,
          { section: section.id, publishedOnly: true },
        )
      )));
      const managedEnabled = accessRole === "owner" && visibleSections
        .some((section) => section.id === "managed_messages");
      const messageData = managedEnabled
        ? await getConsortiumManagedMessages({
          inmobiliariaId: selectedUnit.inmobiliariaId,
          consortiumId: selectedUnit.consortiumId,
        })
        : [];
      setSettings(settingsData);
      setResources(resourceGroups.flat());
      setManagedMessages(messageData);
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar la información del edificio.");
    } finally {
      setLoading(false);
    }
  }, [accessRole, selectedUnit?.consortiumId, selectedUnit?.inmobiliariaId]);

  useEffect(() => { load(); }, [load]);

  const resourcesBySection = useMemo(() => Object.fromEntries(
    CONSORTIUM_PORTAL_SECTIONS.map((section) => [
      section.id,
      resources.filter((resource) => resource.section === section.id),
    ]),
  ), [resources]);

  const visibleSections = useMemo(() => (
    settings ? CONSORTIUM_PORTAL_SECTIONS.filter((section) => (
      isConsortiumPortalSectionVisibleTo(settings.sections[section.id], accessRole)
      && (section.id === "managed_messages"
        ? managedMessages.length > 0
        : (resourcesBySection[section.id] || []).length > 0)
    )) : []
  ), [accessRole, managedMessages.length, resourcesBySection, settings]);

  if (loading) return <p className="text-muted">Cargando información del edificio...</p>;
  if (error) return <div className="alert alert-warning">{error}</div>;
  if (!visibleSections.length) return null;

  return (
    <section className="card border-0 shadow-sm mb-4">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between gap-2 mb-4">
          <div><span className="badge text-bg-light border mb-2">Edificio</span><h2 className="h5 mb-1">Información importante</h2><p className="text-muted small mb-0">Documentación, contactos y novedades publicados por la administración.</p></div>
          <span className="badge text-bg-secondary align-self-start">Acceso como {accessRole === "owner" ? "propietario" : "ocupante"}</span>
        </div>

        <div className="row g-4">
          {visibleSections.map((section) => {
            const sectionResources = resourcesBySection[section.id] || [];
            return <div className="col-12" key={section.id}><article className="border rounded p-3"><h3 className="h6 mb-1">{section.label}</h3><p className="text-muted small">{section.description}</p>
              {section.id === "emergency_contacts" && <div className="row g-2">{sectionResources.map((resource) => <div className="col-md-6 col-xl-4" key={resource.id}><div className="bg-light rounded p-3 h-100"><strong>{resource.title}</strong>{resource.phone && <a className="d-block mt-2" href={`tel:${resource.phone.replace(/[^+\d]/g, "")}`}>{resource.phone}</a>}{resource.email && <a className="d-block small" href={`mailto:${resource.email}`}>{resource.email}</a>}{resource.body && <p className="small text-muted mt-2 mb-0" style={{ whiteSpace: "pre-line" }}>{resource.body}</p>}</div></div>)}</div>}

              {["evacuation", "safety_report"].includes(section.id) && sectionResources.map((resource) => <div className="border-top py-3" key={resource.id}><div className="d-flex flex-wrap justify-content-between gap-2"><div><strong>{resource.title}</strong>{resource.providerName && <small className="d-block text-muted">Responsable: {resource.providerName}</small>}{resource.issuedDate && <small className="d-block text-muted">Fecha: {formatDate(resource.issuedDate)}</small>}{resource.expiresAt && <small className="d-block text-muted">Revisión prevista: {formatDate(resource.expiresAt)}</small>}</div><ResourceDocumentButton resource={resource} /></div>{resource.summary && <p className="mt-2 mb-1">{resource.summary}</p>}{resource.body && <p className="small mb-0" style={{ whiteSpace: "pre-line" }}>{resource.body}</p>}</div>)}

              {section.id === "insurance" && <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Póliza</th><th>Cobertura</th><th>Vigencia</th><th className="text-end">Documento</th></tr></thead><tbody>{sectionResources.map((resource) => <tr key={resource.id}><td><strong>{resource.title}</strong>{resource.providerName && <small className="d-block text-muted">{resource.providerName}</small>}{resource.policyNumber && <small className="d-block text-muted">N.º {resource.policyNumber}</small>}</td><td><span style={{ whiteSpace: "pre-line" }}>{resource.coverage || resource.summary || "—"}</span></td><td>{resource.effectiveDate ? `Desde ${formatDate(resource.effectiveDate)}` : ""}{resource.expiresAt && <small className={`d-block ${resource.expiresAt < new Date().toISOString().slice(0, 10) ? "text-danger fw-semibold" : "text-muted"}`}>Vence {formatDate(resource.expiresAt)}</small>}</td><td className="text-end"><ResourceDocumentButton resource={resource} /></td></tr>)}</tbody></table></div>}

              {["ownership_regulations", "coexistence_regulations", "assembly_minutes"].includes(section.id) && <div className="list-group list-group-flush">{sectionResources.map((resource) => <div className="list-group-item px-0 d-flex flex-wrap justify-content-between gap-3" key={resource.id}><div><strong>{resource.title}</strong>{resource.meetingDate && <small className="d-block text-muted">Asamblea del {formatDate(resource.meetingDate)}</small>}{resource.issuedDate && <small className="d-block text-muted">Documento del {formatDate(resource.issuedDate)}</small>}{resource.summary && <p className="small mb-0 mt-1">{resource.summary}</p>}</div><ResourceDocumentButton resource={resource} /></div>)}</div>}

              {section.id === "regulations" && <div className="list-group list-group-flush">{sectionResources.map((resource) => <a className="list-group-item list-group-item-action px-0" href={resource.url} key={resource.id} rel="noreferrer" target="_blank"><strong>{resource.title}</strong>{resource.summary && <small className="d-block text-muted">{resource.summary}</small>}</a>)}</div>}

              {section.id === "owner_council" && <div className="row g-2">{sectionResources.map((resource) => <div className="col-md-6 col-xl-4" key={resource.id}><div className="bg-light rounded p-3 h-100"><strong>{resource.title}</strong>{resource.memberRole && <small className="d-block text-muted">{resource.memberRole}</small>}{resource.phone && <a className="d-block mt-2" href={`tel:${resource.phone.replace(/[^+\d]/g, "")}`}>{resource.phone}</a>}{resource.email && <a className="d-block small" href={`mailto:${resource.email}`}>{resource.email}</a>}</div></div>)}</div>}

              {section.id === "managed_messages" && <div className="list-group list-group-flush">{managedMessages.map((message) => { const type = getConsortiumCommunicationType(message.communicationType); const status = getConsortiumClaimStatus(message.status); const priority = getConsortiumClaimPriority(message.priority); return <div className={`list-group-item px-0 ${message.featured ? "border-start border-4 border-warning ps-3" : ""}`} key={message.id}><div className="d-flex flex-wrap justify-content-between gap-2"><div><small className="text-muted">{message.reference}</small><strong className="d-block">{message.title}</strong><small className="text-muted">{getConsortiumClaimCategory(message.category).label}</small></div><div className="d-flex flex-wrap gap-2 align-content-start">{message.featured && <span className="badge text-bg-warning">Destacado</span>}<span className={`badge ${type.badge}`}>{type.label}</span><span className={`badge ${status.badge}`}>{status.label}</span><span className={`badge ${priority.badge}`}>{priority.label}</span></div></div>{message.statusHistory?.length > 0 && <div className="small mt-2"><strong>Evolución:</strong> {message.statusHistory.map((event, index) => <span className="ms-2" key={`${event.createdAtIso}_${index}`}>{event.previousStatus ? `${getConsortiumClaimStatus(event.previousStatus).label} → ` : ""}{getConsortiumClaimStatus(event.status).label} ({new Date(event.createdAtIso).toLocaleDateString("es-AR")})</span>)}</div>}</div>; })}</div>}
            </article></div>;
          })}
        </div>
      </div>
    </section>
  );
};

export default ConsortiumBuildingInformation;
