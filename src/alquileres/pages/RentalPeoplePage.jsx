import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  archiveRentalParty,
  createRentalParty,
  getRentalPeople,
  updateRentalParty,
} from "../services/rental.service";
import { ARCA_RECEIVER_IVA_CONDITIONS } from "../services/arca.service";
import { RENTAL_PARTY_ROLES } from "../utils/rental.constants";
import { createEmptyRentalParty, normalizeRentalParty } from "../utils/rentalSchema";
import "../rental.css";

const RentalPeoplePage = () => {
  const { activeInmobiliariaId, activeInmobiliaria } = useActiveInmobiliariaModules();
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState(createEmptyRentalParty);
  const [editingId, setEditingId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) return;
    try {
      setLoading(true);
      setPeople(await getRentalPeople(activeInmobiliariaId));
    } catch (loadError) {
      setError(loadError.message || "No se pudieron cargar las personas.");
    } finally {
      setLoading(false);
    }
  }, [activeInmobiliariaId]);

  useEffect(() => { load(); }, [load]);

  const visiblePeople = useMemo(() => {
    const term = search.trim().toLowerCase();
    return people.filter((person) => !term || [person.name, person.taxId, person.email, person.phone]
      .filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [people, search]);

  const reset = () => {
    setForm(createEmptyRentalParty());
    setEditingId("");
    setError("");
  };

  const toggleRole = (role) => setForm((current) => ({
    ...current,
    roles: current.roles.includes(role)
      ? current.roles.filter((item) => item !== role)
      : [...current.roles, role],
  }));

  const submit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      if (editingId) await updateRentalParty(activeInmobiliariaId, editingId, form);
      else await createRentalParty(activeInmobiliariaId, form);
      reset();
      await load();
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la persona.");
    } finally {
      setSaving(false);
    }
  };

  const archive = async (person) => {
    if (!window.confirm(`¿Archivar a ${person.name}? Los contratos conservarán su identificación histórica.`)) return;
    try {
      await archiveRentalParty(activeInmobiliariaId, person.id);
      setPeople((current) => current.filter((item) => item.id !== person.id));
    } catch (actionError) {
      setError(actionError.message || "No se pudo archivar la persona.");
    }
  };

  return (
    <main className="container py-4 rental-workspace">
      <SEO title="Personas de alquileres | ONO Prop" noIndex />
      <header className="d-flex flex-wrap justify-content-between gap-3 mb-4">
        <div>
          <p className="text-uppercase text-muted small mb-1">Administración de alquileres</p>
          <h1 className="h3 mb-1">Personas y partes</h1>
          <p className="text-muted mb-0">{activeInmobiliaria?.nombre || "Inmobiliaria activa"}</p>
        </div>
        <Link className="btn btn-outline-secondary align-self-start" to="/admin/alquileres">Volver a contratos</Link>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}
      <div className="row g-4">
        <div className="col-xl-5">
          <form className="card border-0 shadow-sm sticky-xl-top rental-sticky-form" onSubmit={submit}>
            <div className="card-body p-4">
              <h2 className="h5 mb-3">{editingId ? "Editar persona" : "Nueva persona"}</h2>
              <div className="mb-3">
                <label className="form-label" htmlFor="rentalPersonName">Nombre o razón social *</label>
                <input id="rentalPersonName" className="form-control" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="row g-3 mb-3">
                <div className="col-sm-6">
                  <label className="form-label" htmlFor="rentalPersonType">Tipo</label>
                  <select id="rentalPersonType" className="form-select" value={form.personType} onChange={(event) => setForm({ ...form, personType: event.target.value })}>
                    <option value="individual">Persona humana</option>
                    <option value="company">Persona jurídica</option>
                  </select>
                </div>
                <div className="col-sm-6">
                  <label className="form-label" htmlFor="rentalPersonTaxId">DNI / CUIT</label>
                  <input id="rentalPersonTaxId" className="form-control" value={form.taxId} onChange={(event) => setForm({ ...form, taxId: event.target.value })} />
                </div>
                <div className="col-sm-6">
                  <label className="form-label" htmlFor="rentalPersonIva">Condición frente al IVA</label>
                  <select id="rentalPersonIva" className="form-select" value={form.ivaConditionId || 5} onChange={(event) => setForm({ ...form, ivaConditionId: Number(event.target.value) })}>
                    {ARCA_RECEIVER_IVA_CONDITIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </div>
              </div>
              <fieldset className="mb-3">
                <legend className="form-label fs-6">Roles *</legend>
                <div className="d-flex flex-wrap gap-3">
                  {RENTAL_PARTY_ROLES.map((role) => (
                    <label className="form-check" key={role.id}>
                      <input className="form-check-input" type="checkbox" checked={form.roles.includes(role.id)} onChange={() => toggleRole(role.id)} />
                      <span className="form-check-label">{role.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="row g-3 mb-3">
                <div className="col-sm-6"><label className="form-label" htmlFor="rentalPersonEmail">Email</label><input id="rentalPersonEmail" type="email" className="form-control" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
                <div className="col-sm-6"><label className="form-label" htmlFor="rentalPersonPhone">Teléfono</label><input id="rentalPersonPhone" className="form-control" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
                <div className="col-12"><label className="form-label" htmlFor="rentalPersonAddress">Domicilio</label><input id="rentalPersonAddress" className="form-control" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
                <div className="col-12"><label className="form-label" htmlFor="rentalPersonBank">Cuenta para liquidaciones</label><input id="rentalPersonBank" className="form-control" placeholder="CBU, CVU o alias" value={form.bankAccount} onChange={(event) => setForm({ ...form, bankAccount: event.target.value })} /></div>
                <div className="col-12"><label className="form-label" htmlFor="rentalPersonNotes">Notas privadas</label><textarea id="rentalPersonNotes" className="form-control" rows="2" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-primary" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
                {editingId && <button type="button" className="btn btn-outline-secondary" onClick={reset}>Cancelar</button>}
              </div>
            </div>
          </form>
        </div>
        <div className="col-xl-7">
          <section className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                <h2 className="h5 mb-0">Directorio ({visiblePeople.length})</h2>
                <input className="form-control rental-search-compact" type="search" placeholder="Buscar..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              {loading && <p className="text-muted">Cargando personas...</p>}
              {!loading && visiblePeople.length === 0 && <div className="alert alert-light border">No hay personas para mostrar.</div>}
              <div className="vstack gap-3">
                {visiblePeople.map((person) => (
                  <article className="border rounded-3 p-3" key={person.id}>
                    <div className="d-flex flex-wrap justify-content-between gap-3">
                      <div>
                        <h3 className="h6 mb-1">{person.name}</h3>
                        <div className="d-flex flex-wrap gap-1 mb-2">
                          {person.roles.map((role) => <span className="badge text-bg-light border text-dark" key={role}>{RENTAL_PARTY_ROLES.find((item) => item.id === role)?.label || role}</span>)}
                        </div>
                        <div className="small text-muted">{[person.taxId, person.email, person.phone].filter(Boolean).join(" · ") || "Sin datos de contacto"}</div>
                      </div>
                      <div className="d-flex gap-2 align-self-start">
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { setEditingId(person.id); setForm(normalizeRentalParty(person)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Editar</button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => archive(person)}>Archivar</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default RentalPeoplePage;
