import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  getAllInmueblesForRental,
  getRentalInmuebleAddress,
} from "../services/rentalInmueble.service";
import {
  changeRentalContractStatus,
  createRentalContract,
  generateRentalObligations,
  getRentalContractById,
  getRentalPeople,
  updateRentalContract,
} from "../services/rental.service";
import {
  RENTAL_ADJUSTMENT_MODES,
  RENTAL_CONTRACT_TYPES,
  RENTAL_CURRENCIES,
  RENTAL_PARTY_ROLES,
} from "../utils/rental.constants";
import { majorToMinor, minorToMajorInput } from "../utils/rental.helpers";
import { createEmptyRentalContract, normalizeRentalContract } from "../utils/rentalSchema";
import "../rental.css";

const RentalContractFormPage = () => {
  const { id: contractId = "" } = useParams();
  const navigate = useNavigate();
  const { activeInmobiliariaId, activeInmobiliaria } = useActiveInmobiliariaModules();
  const [form, setForm] = useState(createEmptyRentalContract);
  const [people, setPeople] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) return;
    try {
      setLoading(true);
      setError("");
      const [peopleData, propertyData, contractData] = await Promise.all([
        getRentalPeople(activeInmobiliariaId),
        getAllInmueblesForRental(activeInmobiliariaId),
        contractId ? getRentalContractById(activeInmobiliariaId, contractId) : Promise.resolve(null),
      ]);
      setPeople(peopleData);
      setInmuebles(propertyData);
      if (contractId) {
        if (!contractData) throw new Error("No se encontró el contrato.");
        setForm(normalizeRentalContract(contractData));
      }
    } catch (loadError) {
      setError(loadError.message || "No se pudo preparar el contrato.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId, contractId]);

  useEffect(() => { load(); }, [load]);

  const peopleByRole = useMemo(() => Object.fromEntries(RENTAL_PARTY_ROLES.map((role) => [
    role.id,
    people.filter((person) => person.active !== false && person.roles?.includes(role.id)),
  ])), [people]);

  const setAdjustment = (field, value) => setForm((current) => ({
    ...current,
    financial: {
      ...current.financial,
      adjustment: { ...current.financial.adjustment, [field]: value },
    },
  }));

  const setFee = (field, value) => setForm((current) => ({
    ...current,
    financial: {
      ...current.financial,
      administrationFee: { ...current.financial.administrationFee, [field]: value },
    },
  }));

  const setContractType = (contractType) => setForm((current) => ({
    ...current,
    contractType,
    endDate: contractType === "temporary" && !current.endDate
      ? current.startDate
      : current.endDate,
    paymentDueDate: contractType === "temporary" && !current.paymentDueDate
      ? current.startDate
      : current.paymentDueDate,
  }));

  const setStartDate = (startDate) => setForm((current) => {
    const syncEndDate = current.contractType === "temporary"
      && (!current.endDate || current.endDate === current.startDate);
    const syncDueDate = current.contractType === "temporary"
      && (!current.paymentDueDate || current.paymentDueDate === current.startDate);
    return {
      ...current,
      startDate,
      endDate: syncEndDate ? startDate : current.endDate,
      paymentDueDate: syncDueDate ? startDate : current.paymentDueDate,
    };
  });

  const toggleParty = (group, partyId) => setForm((current) => {
    const selected = current.partyIds[group] || [];
    return {
      ...current,
      partyIds: {
        ...current.partyIds,
        [group]: selected.includes(partyId)
          ? selected.filter((id) => id !== partyId)
          : [...selected, partyId],
      },
    };
  });

  const selectInmueble = (id) => {
    const inmueble = inmuebles.find((item) => item.id === id);
    setForm((current) => ({
      ...current,
      inmuebleId: id,
      inmuebleSnapshot: inmueble ? {
        title: inmueble.titulo || "Inmueble sin título",
        address: getRentalInmuebleAddress(inmueble),
        propertyType: inmueble.tipo || "",
      } : createEmptyRentalContract().inmuebleSnapshot,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      let id = contractId;
      if (contractId) {
        await updateRentalContract(activeInmobiliariaId, contractId, form);
        await changeRentalContractStatus(activeInmobiliariaId, contractId, form.status);
      } else {
        id = await createRentalContract(activeInmobiliariaId, form);
      }
      if (
        form.status === "active"
        && (form.contractType === "temporary"
          || form.startDate <= new Date().toISOString().slice(0, 10))
      ) {
        await generateRentalObligations({
          inmobiliariaId: activeInmobiliariaId,
          contractId: id,
          throughDate: form.contractType === "temporary" ? form.endDate : undefined,
        });
      }
      navigate(`/admin/alquileres/${id}`);
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar el contrato.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="container py-5 text-center">Cargando contrato...</main>;

  return (
    <main className="container py-4 rental-workspace">
      <SEO title={`${contractId ? "Editar" : "Nuevo"} contrato de alquiler | ONO Prop`} noIndex />
      <header className="d-flex flex-wrap justify-content-between gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">Administración de alquileres</p>
          <h1 className="h3 mb-1">{contractId ? "Editar contrato" : "Nuevo contrato"}</h1>
          <p className="text-muted mb-0">{activeInmobiliaria?.nombre || "Inmobiliaria activa"}</p>
        </div>
        <Link className="btn btn-outline-secondary align-self-start" to={contractId ? `/admin/alquileres/${contractId}` : "/admin/alquileres"}>Cancelar</Link>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={submit} className="vstack gap-4">
        <section className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="rental-section-heading"><span>1</span><div><h2 className="h5 mb-1">Inmueble, modalidad y estado</h2><p className="text-muted small mb-0">El contrato queda vinculado al inmueble ya cargado.</p></div></div>
            <div className="row g-3 mt-1">
              <fieldset className="col-12">
                <legend className="form-label fs-6">Modalidad del contrato *</legend>
                <div className="row g-2">
                  {RENTAL_CONTRACT_TYPES.map((item) => (
                    <div className="col-md-6" key={item.id}>
                      <label className={`border rounded-3 p-3 d-flex gap-3 h-100 ${form.contractType === item.id ? "border-primary bg-primary-subtle" : ""}`}>
                        <input className="form-check-input mt-1" type="radio" name="contractType" value={item.id} checked={form.contractType === item.id} onChange={() => setContractType(item.id)} />
                        <span><strong className="d-block">{item.label}</strong><small className="text-muted">{item.description}</small></span>
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
              <div className="col-lg-9">
                <label className="form-label" htmlFor="rentalProperty">Inmueble administrado *</label>
                <select id="rentalProperty" className="form-select" required value={form.inmuebleId} onChange={(event) => selectInmueble(event.target.value)}>
                  <option value="">Seleccionar...</option>
                  {inmuebles.map((item) => <option key={item.id} value={item.id}>{item.titulo || "Sin título"} · {getRentalInmuebleAddress(item) || "Sin dirección"}</option>)}
                </select>
                {inmuebles.length === 0 && <div className="form-text">Primero tenés que cargar el inmueble, aunque permanezca sin publicar.</div>}
              </div>
              <div className="col-lg-3">
                <label className="form-label" htmlFor="rentalContractStatus">Estado</label>
                <select id="rentalContractStatus" className="form-select" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="draft">Borrador</option><option value="active">Activo</option><option value="ended">Finalizado</option><option value="cancelled">Rescindido</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="rental-section-heading"><span>2</span><div><h2 className="h5 mb-1">Partes</h2><p className="text-muted small mb-0">Las partes se copian al contrato para conservar el antecedente histórico.</p></div></div>
            <div className="row g-4 mt-1">
              {[
                ["owners", "owner", "Locadores *"],
                ["tenants", "tenant", "Locatarios *"],
                ["guarantors", "guarantor", "Garantes"],
              ].map(([group, role, label]) => (
                <fieldset className="col-lg-4" key={group}>
                  <legend className="form-label fs-6">{label}</legend>
                  <div className="rental-party-picker">
                    {(peopleByRole[role] || []).map((person) => (
                      <label className="form-check" key={person.id}>
                        <input className="form-check-input" type="checkbox" checked={form.partyIds[group].includes(person.id)} onChange={() => toggleParty(group, person.id)} />
                        <span className="form-check-label">{person.name}<small className="d-block text-muted">{person.taxId}</small></span>
                      </label>
                    ))}
                    {(peopleByRole[role] || []).length === 0 && <small className="text-muted">No hay personas con este rol.</small>}
                  </div>
                </fieldset>
              ))}
            </div>
            <Link className="btn btn-sm btn-outline-primary mt-3" to="/admin/alquileres/personas">+ Registrar o editar personas</Link>
          </div>
        </section>

        <section className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="rental-section-heading"><span>3</span><div><h2 className="h5 mb-1">Vigencia y valores</h2><p className="text-muted small mb-0">{form.contractType === "temporary" ? "Definí la estadía, su importe total y el vencimiento del pago." : "Definí períodos, moneda, vencimiento y honorarios."}</p></div></div>
            <div className="row g-3 mt-1">
              <div className="col-md-3"><label className="form-label" htmlFor="rentalStart">{form.contractType === "temporary" ? "Inicio del servicio *" : "Inicio *"}</label><input id="rentalStart" className="form-control" type="date" required value={form.startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
              <div className="col-md-3"><label className="form-label" htmlFor="rentalEnd">{form.contractType === "temporary" ? "Fin del servicio *" : "Finalización *"}</label><input id="rentalEnd" className="form-control" type="date" min={form.startDate} required value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></div>
              <div className="col-md-3"><label className="form-label" htmlFor="rentalSigned">Firma</label><input id="rentalSigned" className="form-control" type="date" value={form.signedAt} onChange={(event) => setForm({ ...form, signedAt: event.target.value })} /></div>
              {form.contractType === "recurring" ? <div className="col-md-3"><label className="form-label" htmlFor="rentalDueDay">Día de vencimiento *</label><input id="rentalDueDay" className="form-control" type="number" min="1" max="31" required value={form.dueDay} onChange={(event) => setForm({ ...form, dueDay: Number(event.target.value) })} /></div> : <div className="col-md-3"><label className="form-label" htmlFor="rentalPaymentDue">Vencimiento del pago *</label><input id="rentalPaymentDue" className="form-control" type="date" required value={form.paymentDueDate} onChange={(event) => setForm({ ...form, paymentDueDate: event.target.value })} /></div>}
              <div className="col-md-3"><label className="form-label" htmlFor="rentalCurrency">Moneda</label><select id="rentalCurrency" className="form-select" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}>{RENTAL_CURRENCIES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></div>
              {form.currency === "OTHER" && <div className="col-md-3"><label className="form-label" htmlFor="rentalOtherCurrency">Identificación</label><input id="rentalOtherCurrency" className="form-control" value={form.otherCurrency} onChange={(event) => setForm({ ...form, otherCurrency: event.target.value })} /></div>}
              <div className="col-md-3"><label className="form-label" htmlFor="rentalInitial">{form.contractType === "temporary" ? "Importe total de la estadía *" : "Alquiler inicial *"}</label><input id="rentalInitial" className="form-control" inputMode="decimal" required value={minorToMajorInput(form.financial.initialRentAmountMinor)} onChange={(event) => { const amount = majorToMinor(event.target.value); setForm((current) => { const shouldSyncCurrent = current.contractType === "temporary" || !current.financial.currentRentAmountMinor || current.financial.currentRentAmountMinor === current.financial.initialRentAmountMinor; return { ...current, financial: { ...current.financial, initialRentAmountMinor: amount, currentRentAmountMinor: shouldSyncCurrent ? amount : current.financial.currentRentAmountMinor } }; }); }} /></div>
              <div className="col-md-3"><label className="form-label" htmlFor="rentalDeposit">Depósito</label><input id="rentalDeposit" className="form-control" inputMode="decimal" value={minorToMajorInput(form.depositAmountMinor)} onChange={(event) => setForm({ ...form, depositAmountMinor: majorToMinor(event.target.value) })} /></div>
              <div className="col-md-3"><label className="form-label" htmlFor="rentalFeePercent">Honorarios {form.contractType === "temporary" ? "sobre la estadía" : "mensuales"} (%)</label><input id="rentalFeePercent" className="form-control" type="number" min="0" step="0.01" value={form.financial.administrationFee.percent} onChange={(event) => setFee("percent", Number(event.target.value))} /></div>
              <div className="col-md-3"><label className="form-label" htmlFor="rentalFeeFixed">Honorario fijo {form.contractType === "temporary" ? "por la estadía" : "mensual"}</label><input id="rentalFeeFixed" className="form-control" inputMode="decimal" value={minorToMajorInput(form.financial.administrationFee.fixedAmountMinor)} onChange={(event) => setFee("fixedAmountMinor", majorToMinor(event.target.value))} /></div>
            </div>
            {form.contractType === "temporary" && <div className="alert alert-info small mt-3 mb-0">Para una estadía de un solo día, ingresá la misma fecha en inicio y fin. Se creará una sola obligación con esas fechas de servicio para el circuito de facturación.</div>}
          </div>
        </section>

        {form.contractType === "recurring" && <section className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="rental-section-heading"><span>4</span><div><h2 className="h5 mb-1">Actualización del alquiler</h2><p className="text-muted small mb-0">Se documenta la regla contractual sin imponer un índice legal fijo.</p></div></div>
            <div className="row g-3 mt-1">
              <div className="col-lg-4"><label className="form-label" htmlFor="rentalAdjustmentMode">Modalidad</label><select id="rentalAdjustmentMode" className="form-select" value={form.financial.adjustment.mode} onChange={(event) => setAdjustment("mode", event.target.value)}>{RENTAL_ADJUSTMENT_MODES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
              {form.financial.adjustment.mode !== "manual" && <div className="col-lg-3"><label className="form-label" htmlFor="rentalFrequency">Frecuencia (meses)</label><input id="rentalFrequency" className="form-control" type="number" min="1" max="36" value={form.financial.adjustment.frequencyMonths} onChange={(event) => setAdjustment("frequencyMonths", Number(event.target.value))} /></div>}
              {form.financial.adjustment.mode === "fixed_percent" && <div className="col-lg-3"><label className="form-label" htmlFor="rentalFixedPercent">Porcentaje fijo</label><input id="rentalFixedPercent" className="form-control" type="number" min="0" step="0.01" value={form.financial.adjustment.fixedPercent} onChange={(event) => setAdjustment("fixedPercent", Number(event.target.value))} /></div>}
              {form.financial.adjustment.mode === "index" && <div className="col-lg-5"><label className="form-label" htmlFor="rentalIndexName">Índice contractual</label><input id="rentalIndexName" className="form-control" placeholder="Ej.: índice y fuente pactados" value={form.financial.adjustment.indexName} onChange={(event) => setAdjustment("indexName", event.target.value)} /></div>}
              {form.financial.adjustment.mode === "formula" && <div className="col-12"><label className="form-label" htmlFor="rentalFormula">Fórmula / cláusula</label><textarea id="rentalFormula" className="form-control" rows="3" value={form.financial.adjustment.formula} onChange={(event) => setAdjustment("formula", event.target.value)} /></div>}
            </div>
            {["index", "formula"].includes(form.financial.adjustment.mode) && <div className="alert alert-info small mt-3 mb-0">La regla queda registrada y generará una alerta. El nuevo importe se confirma manualmente para mantener trazabilidad sobre el valor aplicado.</div>}
          </div>
        </section>}

        <section className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="rental-section-heading"><span>{form.contractType === "temporary" ? "4" : "5"}</span><div><h2 className="h5 mb-1">Documentación y notas</h2><p className="text-muted small mb-0">Información privada para administrar el contrato.</p></div></div>
            <div className="row g-3 mt-1">
              <div className="col-lg-6"><label className="form-label" htmlFor="rentalServices">Servicios o conceptos incluidos</label><textarea id="rentalServices" className="form-control" rows="3" value={form.servicesIncluded} onChange={(event) => setForm({ ...form, servicesIncluded: event.target.value })} /></div>
              <div className="col-lg-6"><label className="form-label" htmlFor="rentalLateFee">Mora pactada</label><textarea id="rentalLateFee" className="form-control" rows="3" value={form.lateFeeNotes} onChange={(event) => setForm({ ...form, lateFeeNotes: event.target.value })} /></div>
              <div className="col-lg-6"><label className="form-label" htmlFor="rentalDocument">Enlace al contrato digitalizado</label><input id="rentalDocument" className="form-control" type="url" value={form.documentUrl} onChange={(event) => setForm({ ...form, documentUrl: event.target.value })} /></div>
              <div className="col-12"><label className="form-label" htmlFor="rentalNotes">Notas internas</label><textarea id="rentalNotes" className="form-control" rows="3" value={form.contractNotes} onChange={(event) => setForm({ ...form, contractNotes: event.target.value })} /></div>
            </div>
          </div>
        </section>

        <div className="rental-save-bar d-flex flex-wrap justify-content-between align-items-center gap-3">
          <small className="text-muted">{form.contractType === "temporary" ? "Al activar el contrato se genera una única obligación por toda la estadía." : "Al activar el contrato se generan las obligaciones mensuales hasta el período actual."}</small>
          <button className="btn btn-primary btn-lg" disabled={saving}>{saving ? "Guardando..." : "Guardar contrato"}</button>
        </div>
      </form>
    </main>
  );
};

export default RentalContractFormPage;
