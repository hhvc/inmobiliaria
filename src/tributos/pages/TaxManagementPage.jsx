import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/auth/useAuth";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  getInternalPermissions,
  getInternalRoleForInmobiliaria,
  isGlobalRoot,
} from "../../inmobiliaria/utils/inmobiliariaPermissions";
import {
  archiveTaxObject,
  createTaxObject,
  createTaxObligation,
  getAllInmueblesForTax,
  getTaxObjects,
  getTaxObligations,
  recordTaxPayment,
  setTaxObligationStatus,
  updateTaxObject,
  updateTaxObligation,
} from "../services/tax.service";
import {
  getTaxProvider,
  TAX_OBLIGATION_STATUS_OPTIONS,
  TAX_PROVIDERS,
  TAX_REPRESENTATION_STATUS_OPTIONS,
  TAX_STATUS_BADGES,
  TAX_STATUS_LABELS,
} from "../utils/tax.constants";
import {
  formatTaxMoney,
  normalizeTaxObject,
  normalizeTaxObligation,
  resolveTaxObligationStatus,
  summarizeTaxPortfolio,
  taxMajorToMinor,
  taxMinorToMajorInput,
} from "../utils/tax.helpers";
import TaxNotificationPanel from "../components/TaxNotificationPanel";

const todayKey = () => new Date().toISOString().slice(0, 10);

const emptyObjectForm = () => normalizeTaxObject({
  providerId: "municipalidad_cordoba",
  representation: { status: "not_required" },
  reminderDays: [15, 5, 1],
});

const emptyObligationForm = (taxObject = null) => normalizeTaxObligation({
  taxObjectId: taxObject?.id || "",
  providerId: taxObject?.providerId || "",
  authorityName: taxObject?.authority?.name || "",
  inmuebleId: taxObject?.inmuebleId || "",
  concept: taxObject?.taxTypeLabel || "",
  periodKey: todayKey().slice(0, 7),
  dueDate: "",
  currency: "ARS",
  status: "pending",
  officialPaymentUrl: taxObject?.officialPortalUrl || "",
});

const getInmuebleAddress = (inmueble = {}) => [
  inmueble.direccion?.calle || inmueble.calle,
  inmueble.direccion?.numero || inmueble.numero,
  inmueble.direccion?.barrio || inmueble.barrio,
  inmueble.direccion?.ciudad || inmueble.ciudad,
].filter(Boolean).join(" · ");

const formatDate = (value = "") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Sin fecha";
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-AR");
};

const TaxManagementPage = () => {
  const { user } = useAuth();
  const { activeInmobiliariaId, activeInmobiliaria, loading: agencyLoading } =
    useActiveInmobiliariaModules();
  const [taxObjects, setTaxObjects] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [providerFilter, setProviderFilter] = useState("");
  const [objectForm, setObjectForm] = useState(null);
  const [obligationForm, setObligationForm] = useState(null);
  const [amountInput, setAmountInput] = useState("");
  const [paymentForm, setPaymentForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isRoot = isGlobalRoot(user);
  const internalRole = getInternalRoleForInmobiliaria(user, activeInmobiliariaId);
  const permissions = getInternalPermissions(internalRole, isRoot);
  const canManage = permissions.canManageTaxes === true;

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) {
      setTaxObjects([]);
      setObligations([]);
      setInmuebles([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const [objectsData, obligationsData, inmueblesData] = await Promise.all([
        getTaxObjects(activeInmobiliariaId),
        getTaxObligations(activeInmobiliariaId),
        getAllInmueblesForTax(activeInmobiliariaId),
      ]);
      setTaxObjects(objectsData);
      setObligations(obligationsData.map((item) => ({
        ...item,
        status: resolveTaxObligationStatus(item),
      })));
      setInmuebles(inmueblesData);
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar el control tributario.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setObjectForm(null);
    setObligationForm(null);
    setPaymentForm(null);
    setNotice("");
  }, [activeInmobiliariaId]);

  const objectById = useMemo(() => Object.fromEntries(
    taxObjects.map((item) => [item.id, item]),
  ), [taxObjects]);

  const summary = useMemo(
    () => summarizeTaxPortfolio(taxObjects, obligations),
    [obligations, taxObjects],
  );

  const visibleObjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return taxObjects.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (providerFilter && item.providerId !== providerFilter) return false;
      if (!term) return true;
      return [
        item.inmuebleSnapshot?.title,
        item.inmuebleSnapshot?.address,
        item.identifier,
        item.secondaryIdentifier,
        item.authority?.name,
        item.responsibleName,
      ].some((value) => value?.toString?.().toLowerCase().includes(term));
    });
  }, [providerFilter, search, statusFilter, taxObjects]);

  const obligationsByObject = useMemo(() => {
    const grouped = {};
    obligations.forEach((item) => {
      grouped[item.taxObjectId] = grouped[item.taxObjectId] || [];
      grouped[item.taxObjectId].push(item);
    });
    Object.values(grouped).forEach((items) => items.sort(
      (a, b) => (b.dueDate || "").localeCompare(a.dueDate || ""),
    ));
    return grouped;
  }, [obligations]);

  const updateObjectField = (field, value) => {
    setObjectForm((current) => ({ ...current, [field]: value }));
  };

  const changeProvider = (providerId) => {
    const provider = getTaxProvider(providerId);
    setObjectForm((current) => normalizeTaxObject({
      ...current,
      providerId,
      authority: { id: provider.id, name: provider.authorityName },
      jurisdiction: {
        countryCode: "AR",
        level: provider.jurisdictionLevel,
        code: provider.jurisdictionCode,
      },
      taxType: provider.taxType,
      taxTypeLabel: provider.taxTypeLabel,
      identifierType: provider.identifierTypes[0]?.id,
      officialPortalUrl: provider.officialPortalUrl,
      integration: {
        mode: provider.integrationMode,
        status: "not_connected",
      },
    }));
  };

  const selectInmueble = (inmuebleId) => {
    const inmueble = inmuebles.find((item) => item.id === inmuebleId);
    setObjectForm((current) => ({
      ...current,
      inmuebleId,
      inmuebleSnapshot: inmueble ? {
        title: inmueble.titulo || "Inmueble sin título",
        address: getInmuebleAddress(inmueble),
        propertyType: inmueble.tipo || "",
      } : { title: "", address: "", propertyType: "" },
    }));
  };

  const submitObject = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setNotice("");
      if (objectForm.id) {
        await updateTaxObject(activeInmobiliariaId, objectForm.id, objectForm);
        setNotice("Objeto fiscal actualizado.");
      } else {
        await createTaxObject(activeInmobiliariaId, objectForm);
        setNotice("Objeto fiscal creado.");
      }
      setObjectForm(null);
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar el objeto fiscal.");
    } finally {
      setSaving(false);
    }
  };

  const openObligationForm = (taxObject, obligation = null) => {
    const next = obligation
      ? normalizeTaxObligation(obligation)
      : emptyObligationForm(taxObject);
    setObligationForm(obligation ? { ...next, id: obligation.id } : next);
    setAmountInput(taxMinorToMajorInput(next.amountMinor));
    setPaymentForm(null);
  };

  const submitObligation = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setNotice("");
      const payload = {
        ...obligationForm,
        amountMinor: taxMajorToMinor(amountInput),
      };
      if (obligationForm.id) {
        await updateTaxObligation(
          activeInmobiliariaId,
          obligationForm.id,
          payload,
        );
        setNotice("Obligación actualizada.");
      } else {
        await createTaxObligation(activeInmobiliariaId, payload);
        setNotice("Obligación registrada.");
      }
      setObligationForm(null);
      setAmountInput("");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la obligación.");
    } finally {
      setSaving(false);
    }
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setNotice("");
      await recordTaxPayment({
        inmobiliariaId: activeInmobiliariaId,
        obligationId: paymentForm.obligationId,
        paidAt: paymentForm.paidAt,
        reference: paymentForm.reference,
        evidenceUrl: paymentForm.evidenceUrl,
      });
      setPaymentForm(null);
      setNotice("Pago registrado y auditado.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo registrar el pago.");
    } finally {
      setSaving(false);
    }
  };

  const changeObligationStatus = async (obligation, status) => {
    try {
      setSaving(true);
      setError("");
      await setTaxObligationStatus(
        activeInmobiliariaId,
        obligation.id,
        status,
      );
      setNotice("Estado tributario actualizado.");
      await load();
    } catch (actionError) {
      setError(actionError.message || "No se pudo actualizar el estado.");
    } finally {
      setSaving(false);
    }
  };

  const archiveObject = async (item) => {
    if (!window.confirm(`¿Archivar el objeto fiscal de ${item.inmuebleSnapshot?.title || "este inmueble"}?`)) {
      return;
    }
    try {
      setSaving(true);
      setError("");
      await archiveTaxObject(activeInmobiliariaId, item.id);
      setNotice("Objeto fiscal archivado sin eliminar su historial.");
      await load();
    } catch (actionError) {
      setError(actionError.message || "No se pudo archivar el objeto fiscal.");
    } finally {
      setSaving(false);
    }
  };

  if (agencyLoading || loading) {
    return (
      <main className="container py-5 text-center">
        <div className="spinner-border" />
        <p className="text-muted mt-3">Cargando control tributario...</p>
      </main>
    );
  }

  const provider = objectForm ? getTaxProvider(objectForm.providerId) : null;
  const editableStatuses = TAX_OBLIGATION_STATUS_OPTIONS.filter(
    (item) => !["overdue", "paid"].includes(item.id),
  );
  const obligationStatusOptions = editableStatuses.some(
    (item) => item.id === obligationForm?.status,
  )
    ? editableStatuses
    : [
        {
          id: obligationForm?.status,
          label: TAX_STATUS_LABELS[obligationForm?.status] || obligationForm?.status,
        },
        ...editableStatuses,
      ];

  return (
    <main className="container py-5">
      <SEO title="Control tributario | ONO Prop" noIndex />

      <header className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">Panel inmobiliario</p>
          <h1 className="h3 mb-1">Control tributario inmobiliario</h1>
          <p className="text-muted mb-0">
            {activeInmobiliaria?.nombre || "Inmobiliaria activa"} · objetos fiscales,
            vencimientos y pagos auditados.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link className="btn btn-outline-secondary" to="/admin/inmobiliaria">
            Panel
          </Link>
          {canManage && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setObjectForm(emptyObjectForm());
                setObligationForm(null);
                setPaymentForm(null);
              }}
            >
              + Vincular inmueble
            </button>
          )}
        </div>
      </header>

      <div className="alert alert-info small">
        Esta etapa registra datos manuales y abre portales oficiales. No solicita ni
        almacena claves ARCA, CiDi o bancarias. Los conectores automáticos se habilitarán
        solamente con credenciales oficiales de aplicación.
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <section className="row g-3 mb-4">
        {[
          ["Objetos activos", summary.activeObjects, "text-primary"],
          ["Pendientes", summary.pending, "text-warning"],
          ["Vencidas", summary.overdue, "text-danger"],
          ["Próximos 30 días", summary.dueSoon, "text-info"],
        ].map(([label, value, color]) => (
          <div className="col-6 col-xl-3" key={label}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="small text-muted">{label}</div>
                <div className={`h3 mb-0 ${color}`}>{value}</div>
              </div>
            </div>
          </div>
        ))}
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-2">
              <span className="text-muted">Importe pendiente registrado</span>
              <strong className="h5 mb-0">
                {formatTaxMoney(summary.outstandingAmountMinor)}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <TaxNotificationPanel
        inmobiliariaId={activeInmobiliariaId}
        canManage={canManage}
        isRoot={isRoot}
        userEmail={user?.email || ""}
        onAutomationRun={load}
      />

      {objectForm && canManage && (
        <section className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4">
            <div className="d-flex justify-content-between gap-3 mb-3">
              <div>
                <p className="text-uppercase text-muted small mb-1">Objeto fiscal</p>
                <h2 className="h5 mb-0">
                  {objectForm.id ? "Editar vinculación" : "Vincular inmueble a un organismo"}
                </h2>
              </div>
              <button type="button" className="btn-close" onClick={() => setObjectForm(null)} />
            </div>

            <form className="row g-3" onSubmit={submitObject}>
              <div className="col-lg-6">
                <label className="form-label" htmlFor="taxProperty">Inmueble *</label>
                <select
                  id="taxProperty"
                  className="form-select"
                  required
                  value={objectForm.inmuebleId}
                  disabled={Boolean(objectForm.id)}
                  onChange={(event) => selectInmueble(event.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {inmuebles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.titulo || "Sin título"} · {getInmuebleAddress(item) || "Sin dirección"}
                    </option>
                  ))}
                </select>
                {inmuebles.length === 0 && (
                  <div className="form-text">
                    Primero cargá el inmueble, aunque permanezca sin publicar.
                  </div>
                )}
              </div>

              <div className="col-lg-6">
                <label className="form-label" htmlFor="taxProvider">Organismo *</label>
                <select
                  id="taxProvider"
                  className="form-select"
                  value={objectForm.providerId}
                  onChange={(event) => changeProvider(event.target.value)}
                >
                  {TAX_PROVIDERS.map((item) => (
                    <option key={item.id} value={item.id}>{item.authorityName}</option>
                  ))}
                </select>
              </div>

              {objectForm.providerId === "other" && (
                <div className="col-lg-6">
                  <label className="form-label" htmlFor="taxAuthorityName">
                    Nombre del organismo *
                  </label>
                  <input
                    id="taxAuthorityName"
                    className="form-control"
                    value={objectForm.authority?.name || ""}
                    onChange={(event) => setObjectForm((current) => ({
                      ...current,
                      authority: { ...current.authority, name: event.target.value },
                    }))}
                    required
                  />
                </div>
              )}

              <div className="col-lg-4">
                <label className="form-label" htmlFor="taxIdentifierType">
                  Tipo de identificador
                </label>
                <select
                  id="taxIdentifierType"
                  className="form-select"
                  value={objectForm.identifierType}
                  onChange={(event) => updateObjectField("identifierType", event.target.value)}
                >
                  {provider.identifierTypes.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div className="col-lg-4">
                <label className="form-label" htmlFor="taxIdentifier">Identificador *</label>
                <input
                  id="taxIdentifier"
                  className="form-control"
                  required
                  value={objectForm.identifier}
                  onChange={(event) => updateObjectField("identifier", event.target.value)}
                />
              </div>

              <div className="col-lg-4">
                <label className="form-label" htmlFor="taxSecondaryIdentifier">
                  Identificador adicional
                </label>
                <input
                  id="taxSecondaryIdentifier"
                  className="form-control"
                  value={objectForm.secondaryIdentifier}
                  onChange={(event) => updateObjectField("secondaryIdentifier", event.target.value)}
                />
              </div>

              <div className="col-lg-6">
                <label className="form-label" htmlFor="taxResponsible">
                  Titular o responsable
                </label>
                <input
                  id="taxResponsible"
                  className="form-control"
                  value={objectForm.responsibleName}
                  onChange={(event) => updateObjectField("responsibleName", event.target.value)}
                />
              </div>

              <div className="col-lg-6">
                <label className="form-label" htmlFor="taxRepresentation">
                  Autorización para gestionar
                </label>
                <select
                  id="taxRepresentation"
                  className="form-select"
                  value={objectForm.representation.status}
                  onChange={(event) => setObjectForm((current) => ({
                    ...current,
                    representation: {
                      ...current.representation,
                      status: event.target.value,
                    },
                  }))}
                >
                  {TAX_REPRESENTATION_STATUS_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label" htmlFor="taxRepresentationRef">
                  Referencia de autorización
                </label>
                <input
                  id="taxRepresentationRef"
                  className="form-control"
                  value={objectForm.representation.reference}
                  onChange={(event) => setObjectForm((current) => ({
                    ...current,
                    representation: {
                      ...current.representation,
                      reference: event.target.value,
                    },
                  }))}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label" htmlFor="taxRepresentationFrom">Vigente desde</label>
                <input
                  id="taxRepresentationFrom"
                  type="date"
                  className="form-control"
                  value={objectForm.representation.validFrom}
                  onChange={(event) => setObjectForm((current) => ({
                    ...current,
                    representation: {
                      ...current.representation,
                      validFrom: event.target.value,
                    },
                  }))}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label" htmlFor="taxRepresentationUntil">Vigente hasta</label>
                <input
                  id="taxRepresentationUntil"
                  type="date"
                  className="form-control"
                  value={objectForm.representation.validUntil}
                  onChange={(event) => setObjectForm((current) => ({
                    ...current,
                    representation: {
                      ...current.representation,
                      validUntil: event.target.value,
                    },
                  }))}
                />
              </div>

              <div className="col-lg-6">
                <label className="form-label" htmlFor="taxReminderDays">
                  Avisar con días de anticipación
                </label>
                <input
                  id="taxReminderDays"
                  className="form-control"
                  placeholder="15, 5, 1"
                  value={
                    Array.isArray(objectForm.reminderDays)
                      ? objectForm.reminderDays.join(", ")
                      : objectForm.reminderDays
                  }
                  onChange={(event) => updateObjectField("reminderDays", event.target.value)}
                />
              </div>

              <div className="col-lg-6">
                <label className="form-label" htmlFor="taxOfficialPortal">Portal oficial</label>
                <input
                  id="taxOfficialPortal"
                  type="url"
                  className="form-control"
                  value={objectForm.officialPortalUrl}
                  onChange={(event) => updateObjectField("officialPortalUrl", event.target.value)}
                />
              </div>

              <div className="col-12">
                <label className="form-label" htmlFor="taxObjectNotes">Notas internas</label>
                <textarea
                  id="taxObjectNotes"
                  className="form-control"
                  rows="2"
                  value={objectForm.notes}
                  onChange={(event) => updateObjectField("notes", event.target.value)}
                />
              </div>

              <div className="col-12 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setObjectForm(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar objeto fiscal"}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {obligationForm && canManage && (
        <section className="card border-primary shadow-sm mb-4">
          <div className="card-body p-4">
            <div className="d-flex justify-content-between gap-3 mb-3">
              <div>
                <p className="text-uppercase text-muted small mb-1">Obligación tributaria</p>
                <h2 className="h5 mb-0">
                  {obligationForm.id ? "Editar obligación" : "Registrar vencimiento"}
                </h2>
                <div className="small text-muted">
                  {objectById[obligationForm.taxObjectId]?.inmuebleSnapshot?.title}
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setObligationForm(null)} />
            </div>

            <form className="row g-3" onSubmit={submitObligation}>
              <div className="col-lg-6">
                <label className="form-label" htmlFor="taxConcept">Concepto *</label>
                <input
                  id="taxConcept"
                  className="form-control"
                  required
                  value={obligationForm.concept}
                  onChange={(event) => setObligationForm((current) => ({
                    ...current,
                    concept: event.target.value,
                  }))}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="taxPeriod">Período *</label>
                <input
                  id="taxPeriod"
                  type="month"
                  className="form-control"
                  required
                  value={obligationForm.periodKey}
                  onChange={(event) => setObligationForm((current) => ({
                    ...current,
                    periodKey: event.target.value,
                  }))}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="taxDueDate">Vencimiento *</label>
                <input
                  id="taxDueDate"
                  type="date"
                  className="form-control"
                  required
                  value={obligationForm.dueDate}
                  onChange={(event) => setObligationForm((current) => ({
                    ...current,
                    dueDate: event.target.value,
                  }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="taxAmount">Importe *</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    id="taxAmount"
                    className="form-control"
                    inputMode="decimal"
                    required
                    value={amountInput}
                    onChange={(event) => setAmountInput(event.target.value)}
                  />
                </div>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="taxObligationStatus">Estado</label>
                <select
                  id="taxObligationStatus"
                  className="form-select"
                  value={obligationForm.status}
                  disabled={obligationForm.status === "paid"}
                  onChange={(event) => setObligationForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))}
                >
                  {obligationStatusOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="taxExternalId">ID externo</label>
                <input
                  id="taxExternalId"
                  className="form-control"
                  value={obligationForm.externalId}
                  onChange={(event) => setObligationForm((current) => ({
                    ...current,
                    externalId: event.target.value,
                  }))}
                />
              </div>
              <div className="col-lg-6">
                <label className="form-label" htmlFor="taxDocumentUrl">URL del cedulón</label>
                <input
                  id="taxDocumentUrl"
                  type="url"
                  className="form-control"
                  value={obligationForm.officialDocumentUrl}
                  onChange={(event) => setObligationForm((current) => ({
                    ...current,
                    officialDocumentUrl: event.target.value,
                  }))}
                />
              </div>
              <div className="col-lg-6">
                <label className="form-label" htmlFor="taxPaymentUrl">URL oficial de pago</label>
                <input
                  id="taxPaymentUrl"
                  type="url"
                  className="form-control"
                  value={obligationForm.officialPaymentUrl}
                  onChange={(event) => setObligationForm((current) => ({
                    ...current,
                    officialPaymentUrl: event.target.value,
                  }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="taxObligationNotes">Notas internas</label>
                <textarea
                  id="taxObligationNotes"
                  rows="2"
                  className="form-control"
                  value={obligationForm.notes}
                  onChange={(event) => setObligationForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))}
                />
              </div>
              <div className="col-12 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setObligationForm(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar obligación"}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {paymentForm && canManage && (
        <section className="card border-success shadow-sm mb-4">
          <div className="card-body p-4">
            <h2 className="h5">Registrar pago</h2>
            <p className="text-muted small">
              El registro no ejecuta el pago: documenta una operación realizada por un canal oficial.
            </p>
            <form className="row g-3" onSubmit={submitPayment}>
              <div className="col-md-3">
                <label className="form-label" htmlFor="taxPaidAt">Fecha de pago *</label>
                <input
                  id="taxPaidAt"
                  type="date"
                  className="form-control"
                  required
                  value={paymentForm.paidAt}
                  onChange={(event) => setPaymentForm((current) => ({
                    ...current,
                    paidAt: event.target.value,
                  }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="taxPaymentReference">Referencia</label>
                <input
                  id="taxPaymentReference"
                  className="form-control"
                  value={paymentForm.reference}
                  onChange={(event) => setPaymentForm((current) => ({
                    ...current,
                    reference: event.target.value,
                  }))}
                />
              </div>
              <div className="col-md-5">
                <label className="form-label" htmlFor="taxEvidenceUrl">Comprobante (URL HTTPS)</label>
                <input
                  id="taxEvidenceUrl"
                  type="url"
                  className="form-control"
                  value={paymentForm.evidenceUrl}
                  onChange={(event) => setPaymentForm((current) => ({
                    ...current,
                    evidenceUrl: event.target.value,
                  }))}
                />
              </div>
              <div className="col-12 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setPaymentForm(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success" disabled={saving}>
                  Confirmar registro
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-lg-6">
              <label className="form-label" htmlFor="taxSearch">Buscar</label>
              <input
                id="taxSearch"
                className="form-control"
                placeholder="Inmueble, domicilio, identificador o titular"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="taxProviderFilter">Organismo</label>
              <select
                id="taxProviderFilter"
                className="form-select"
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value)}
              >
                <option value="">Todos</option>
                {TAX_PROVIDERS.map((item) => (
                  <option key={item.id} value={item.id}>{item.authorityName}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="taxObjectStatusFilter">Objetos</label>
              <select
                id="taxObjectStatusFilter"
                className="form-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="active">Activos</option>
                <option value="archived">Archivados</option>
                <option value="">Todos</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="d-flex flex-column gap-4">
        {visibleObjects.map((item) => {
          const itemProvider = getTaxProvider(item.providerId);
          const itemObligations = obligationsByObject[item.id] || [];
          const representationLabel = TAX_REPRESENTATION_STATUS_OPTIONS.find(
            (option) => option.id === item.representation?.status,
          )?.label;
          return (
            <article className="card border-0 shadow-sm" key={item.id}>
              <div className="card-body p-4">
                <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                  <div>
                    <div className="d-flex flex-wrap gap-2 align-items-center mb-1">
                      <h2 className="h5 mb-0">
                        {item.inmuebleSnapshot?.title || "Inmueble sin título"}
                      </h2>
                      <span className="badge text-bg-primary-subtle border text-primary-emphasis">
                        {itemProvider.authorityName}
                      </span>
                      {item.status === "archived" && (
                        <span className="badge text-bg-secondary">Archivado</span>
                      )}
                    </div>
                    <div className="text-muted">
                      {item.inmuebleSnapshot?.address || "Sin domicilio cargado"}
                    </div>
                    <div className="small mt-2">
                      <strong>{itemProvider.identifierTypes.find((type) => type.id === item.identifierType)?.label || "Identificador"}:</strong>{" "}
                      {item.identifier}
                      {item.secondaryIdentifier ? ` · ${item.secondaryIdentifier}` : ""}
                    </div>
                    <div className="small text-muted">
                      {representationLabel || "Autorización sin definir"}
                      {item.responsibleName ? ` · ${item.responsibleName}` : ""}
                    </div>
                  </div>

                  <div className="d-flex flex-wrap align-content-start gap-2">
                    {item.officialPortalUrl && (
                      <a
                        className="btn btn-outline-primary btn-sm"
                        href={item.officialPortalUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir portal oficial
                      </a>
                    )}
                    {canManage && item.status !== "archived" && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => openObligationForm(item)}
                        >
                          + Obligación
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => {
                            setObjectForm({ ...normalizeTaxObject(item), id: item.id });
                            setObligationForm(null);
                            setPaymentForm(null);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => archiveObject(item)}
                        >
                          Archivar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {item.notes && <div className="alert alert-light border small">{item.notes}</div>}

                {itemObligations.length === 0 ? (
                  <div className="text-muted small border rounded p-3">
                    Todavía no hay obligaciones cargadas para este objeto fiscal.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Período</th>
                          <th>Concepto</th>
                          <th>Vencimiento</th>
                          <th>Estado</th>
                          <th className="text-end">Importe</th>
                          <th className="text-end">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemObligations.map((obligation) => (
                          <tr key={obligation.id}>
                            <td>{obligation.periodKey}</td>
                            <td>
                              <div>{obligation.concept}</div>
                              <div className="d-flex gap-2 small">
                                {obligation.officialDocumentUrl && (
                                  <a href={obligation.officialDocumentUrl} target="_blank" rel="noreferrer">
                                    Cedulón
                                  </a>
                                )}
                                {obligation.officialPaymentUrl && (
                                  <a href={obligation.officialPaymentUrl} target="_blank" rel="noreferrer">
                                    Pagar oficialmente
                                  </a>
                                )}
                              </div>
                            </td>
                            <td>{formatDate(obligation.dueDate)}</td>
                            <td>
                              <span className={`badge ${TAX_STATUS_BADGES[obligation.status] || "text-bg-secondary"}`}>
                                {TAX_STATUS_LABELS[obligation.status] || obligation.status}
                              </span>
                              {obligation.status === "paid" && obligation.payment?.paidAt && (
                                <div className="small text-muted mt-1">
                                  {formatDate(obligation.payment.paidAt)}
                                </div>
                              )}
                            </td>
                            <td className="text-end fw-semibold">
                              {formatTaxMoney(obligation.amountMinor, obligation.currency)}
                            </td>
                            <td>
                              {canManage && (
                                <div className="d-flex justify-content-end flex-wrap gap-1">
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() => openObligationForm(item, obligation)}
                                  >
                                    Editar
                                  </button>
                                  {!["paid", "cancelled"].includes(obligation.status) && (
                                    <button
                                      type="button"
                                      className="btn btn-outline-success btn-sm"
                                      onClick={() => {
                                        setPaymentForm({
                                          obligationId: obligation.id,
                                          paidAt: todayKey(),
                                          reference: "",
                                          evidenceUrl: "",
                                        });
                                        setObligationForm(null);
                                      }}
                                    >
                                      Registrar pago
                                    </button>
                                  )}
                                  {obligation.status === "pending" && (
                                    <button
                                      type="button"
                                      className="btn btn-outline-info btn-sm"
                                      onClick={() => changeObligationStatus(obligation, "payment_pending")}
                                    >
                                      Pago informado
                                    </button>
                                  )}
                                  {!["paid", "cancelled", "disputed"].includes(
                                    obligation.status,
                                  ) && (
                                    <button
                                      type="button"
                                      className="btn btn-outline-dark btn-sm"
                                      onClick={() => changeObligationStatus(obligation, "disputed")}
                                    >
                                      Observar
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {visibleObjects.length === 0 && (
          <div className="alert alert-light border text-center py-5">
            <h2 className="h5">No hay objetos fiscales para mostrar</h2>
            <p className="text-muted mb-0">
              Vinculá un inmueble para comenzar a controlar tasas, impuestos y vencimientos.
            </p>
          </div>
        )}
      </section>
    </main>
  );
};

export default TaxManagementPage;
