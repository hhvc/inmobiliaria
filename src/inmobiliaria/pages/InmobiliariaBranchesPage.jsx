import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

import { useAuth } from "../../context/auth/useAuth";
import { db } from "../../firebase/config";
import {
  archiveInmobiliariaBranch,
  getInmobiliariaBranches,
  saveInmobiliariaBranch,
} from "../services/agencyNetwork.service";
import { getInternalRoleForInmobiliaria } from "../utils/inmobiliariaPermissions";

const EMPTY_BRANCH = {
  name: "", slug: "", active: true, address: "",
  contact: { email: "", telefono: "", whatsapp: "" },
  branding: { heroImageUrl: "", primaryColor: "" },
};

export default function InmobiliariaBranchesPage() {
  const { user, activeInmobiliariaId } = useAuth();
  const [agency, setAgency] = useState(null);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(EMPTY_BRANCH);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const role = getInternalRoleForInmobiliaria(user, activeInmobiliariaId);
  const assignedIds = useMemo(
    () => user?.inmobiliariaBranchIds?.[activeInmobiliariaId] || [],
    [activeInmobiliariaId, user?.inmobiliariaBranchIds],
  );
  const isBranchManager = role === "branch_manager";
  const visibleBranches = useMemo(() => (
    isBranchManager ? branches.filter((item) => assignedIds.includes(item.id)) : branches
  ), [assignedIds, branches, isBranchManager]);

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) return;
    setLoading(true);
    try {
      const [agencySnap, items] = await Promise.all([
        getDoc(doc(db, "inmobiliarias", activeInmobiliariaId)),
        getInmobiliariaBranches(activeInmobiliariaId, { includeInactive: true }),
      ]);
      setAgency(agencySnap.exists() ? { id: agencySnap.id, ...agencySnap.data() } : null);
      setBranches(items);
    } catch (err) { setError(err.message || "No se pudieron cargar las sucursales."); }
    finally { setLoading(false); }
  }, [activeInmobiliariaId]);

  useEffect(() => { load(); }, [load]);

  const updateNested = (group, field, value) => setForm((current) => ({
    ...current, [group]: { ...(current[group] || {}), [field]: value },
  }));

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      if (isBranchManager && !form.id) throw new Error("Solo la administración principal puede crear sucursales.");
      if (isBranchManager && !assignedIds.includes(form.id)) throw new Error("No podés editar esta sucursal.");
      await saveInmobiliariaBranch(activeInmobiliariaId, form);
      setMessage(form.id ? "Sucursal actualizada." : "Sucursal creada.");
      setForm(EMPTY_BRANCH); await load();
    } catch (err) { setError(err.message || "No se pudo guardar."); }
    finally { setSaving(false); }
  };

  if (loading) return <main className="container py-5">Cargando sucursales...</main>;
  return (
    <main className="container py-4">
      <header className="mb-4">
        <p className="text-uppercase text-muted small mb-1">Organización</p>
        <h1 className="h3">Sucursales de {agency?.nombre || "la inmobiliaria"}</h1>
        <p className="text-muted">Cada sucursal tiene página y contacto propios; el logo se hereda de la casa central.</p>
      </header>
      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}
      <div className="row g-4">
        <section className="col-lg-5">
          <form className="card border-0 shadow-sm" onSubmit={submit}>
            <div className="card-body p-4">
              <h2 className="h5">{form.id ? "Editar sucursal" : "Nueva sucursal"}</h2>
              {isBranchManager && !form.id && <div className="alert alert-info small">Seleccioná tu sucursal para editar su contacto y portada.</div>}
              <label className="form-label">Nombre</label>
              <input className="form-control mb-3" value={form.name} disabled={isBranchManager} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <label className="form-label">URL corta</label>
              <input className="form-control mb-3" value={form.slug} disabled={isBranchManager} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="centro" />
              <label className="form-label">Dirección</label>
              <input className="form-control mb-3" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <div className="row g-2">
                <div className="col-md-6"><label className="form-label">Teléfono</label><input className="form-control" value={form.contact?.telefono || ""} onChange={(e) => updateNested("contact", "telefono", e.target.value)} /></div>
                <div className="col-md-6"><label className="form-label">WhatsApp</label><input className="form-control" value={form.contact?.whatsapp || ""} onChange={(e) => updateNested("contact", "whatsapp", e.target.value)} /></div>
                <div className="col-12"><label className="form-label">Email</label><input type="email" className="form-control" value={form.contact?.email || ""} onChange={(e) => updateNested("contact", "email", e.target.value)} /></div>
                <div className="col-12"><label className="form-label">Foto de portada (URL)</label><input className="form-control" value={form.branding?.heroImageUrl || ""} onChange={(e) => updateNested("branding", "heroImageUrl", e.target.value)} /></div>
              </div>
              <div className="d-flex gap-2 mt-4">
                <button className="btn btn-primary" disabled={saving || (isBranchManager && !form.id)}>{saving ? "Guardando..." : "Guardar"}</button>
                {form.id && <button type="button" className="btn btn-outline-secondary" onClick={() => setForm(EMPTY_BRANCH)}>Cancelar</button>}
              </div>
            </div>
          </form>
        </section>
        <section className="col-lg-7">
          <div className="card border-0 shadow-sm"><div className="card-body p-4">
            <h2 className="h5">Sucursales</h2>
            {visibleBranches.length === 0 && <div className="alert alert-light border">Todavía no hay sucursales disponibles.</div>}
            <div className="list-group list-group-flush">
              {visibleBranches.map((branch) => <div className="list-group-item px-0" key={branch.id}>
                <div className="d-flex justify-content-between gap-3">
                  <div><strong>{branch.name}</strong> {!branch.active && <span className="badge text-bg-secondary">Archivada</span>}<div className="small text-muted">/{agency?.slug}/{branch.slug} · {branch.address || "Sin dirección"}</div></div>
                  <div className="d-flex gap-2"><button className="btn btn-sm btn-outline-primary" onClick={() => setForm({ ...EMPTY_BRANCH, ...branch, contact: { ...EMPTY_BRANCH.contact, ...(branch.contact || {}) }, branding: { ...EMPTY_BRANCH.branding, ...(branch.branding || {}) } })}>Editar</button>
                  {!isBranchManager && branch.active !== false && <button className="btn btn-sm btn-outline-danger" onClick={async () => { if (window.confirm("¿Archivar la sucursal?")) { await archiveInmobiliariaBranch(activeInmobiliariaId, branch.id); await load(); } }}>Archivar</button>}</div>
                </div>
              </div>)}
            </div>
          </div></div>
        </section>
      </div>
    </main>
  );
}
