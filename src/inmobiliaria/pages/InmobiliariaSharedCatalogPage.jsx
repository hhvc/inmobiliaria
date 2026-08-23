import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../context/auth/useAuth";
import { applyBillingHighlightCredits } from "../../billing/services/billing.service";
import {
  getFriendSharedPublications,
  getInmobiliariaBranches,
  saveSharedPublicationOverride,
} from "../services/agencyNetwork.service";

const coverUrl = (item) => [...(item.images || [])]
  .filter((image) => image?.url)
  .sort((a, b) => (a.order || 0) - (b.order || 0))[0]?.url || "";

export default function InmobiliariaSharedCatalogPage() {
  const { activeInmobiliariaId } = useAuth();
  const [items, setItems] = useState([]); const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState("");
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [daysByItem, setDaysByItem] = useState({});

  const load = useCallback(async () => {
    if (!activeInmobiliariaId) return; setLoading(true); setError("");
    try {
      const [publications, branchItems] = await Promise.all([
        getFriendSharedPublications({ agencyId: activeInmobiliariaId, includeHidden: true }),
        getInmobiliariaBranches(activeInmobiliariaId),
      ]);
      setItems(publications); setBranches(branchItems);
    } catch (err) { setError(err.message || "No se pudieron cargar los inmuebles compartidos."); }
    finally { setLoading(false); }
  }, [activeInmobiliariaId]);
  useEffect(() => { load(); }, [load]);
  const count = useMemo(() => items.length, [items]);

  const patchItem = async (item, patch) => {
    const key = `${item.sourceInmobiliariaId}_${item.id}`; setBusy(key); setError(""); setMessage("");
    try {
      await saveSharedPublicationOverride({ agencyId: activeInmobiliariaId, ownerAgencyId: item.sourceInmobiliariaId, inmuebleId: item.id, patch });
      setMessage("La presentación local fue actualizada sin modificar el aviso original."); await load();
    } catch (err) { setError(err.message || "No se pudo actualizar."); }
    finally { setBusy(""); }
  };

  const highlight = async (item) => {
    const key = `${item.sourceInmobiliariaId}_${item.id}`; setBusy(key); setError(""); setMessage("");
    try {
      await applyBillingHighlightCredits({
        inmobiliariaId: activeInmobiliariaId,
        inmuebleId: item.id,
        ownerInmobiliariaId: item.sourceInmobiliariaId,
        sharedPublication: true,
        days: Number(daysByItem[key] || 1),
      });
      setMessage("El inmueble compartido quedó destacado solamente en tu página."); await load();
    } catch (err) { setError(err.message || "No se pudo aplicar el destaque."); }
    finally { setBusy(""); }
  };

  if (loading) return <main className="container py-5">Cargando catálogo compartido...</main>;
  return <main className="container py-4">
    <header className="mb-4"><p className="text-uppercase text-muted small mb-1">Marca blanca</p><h1 className="h3">Inmuebles de inmobiliarias amigas</h1><p className="text-muted">{count} avisos disponibles. Ocultalos, habilitalos por sucursal o destacalos localmente.</p></header>
    {error && <div className="alert alert-danger">{error}</div>}{message && <div className="alert alert-success">{message}</div>}
    {items.length === 0 && <div className="alert alert-info">No hay inmuebles compartidos por grupos aceptados.</div>}
    <div className="row g-4">{items.map((item) => {
      const key = `${item.sourceInmobiliariaId}_${item.id}`; const local = item.localPublication || {};
      return <article className="col-xl-6" key={key}><div className="card h-100 border-0 shadow-sm"><div className="row g-0 h-100"><div className="col-md-4">{coverUrl(item) ? <img src={coverUrl(item)} alt="" className="img-fluid rounded-start h-100" style={{ objectFit: "cover", minHeight: 210 }} /> : <div className="bg-light h-100 d-flex align-items-center justify-content-center">Sin foto</div>}</div><div className="col-md-8"><div className="card-body">
        <div className="d-flex justify-content-between gap-2"><h2 className="h5">{item.titulo}</h2>{item.destacado && <span className="badge text-bg-warning">Destacado aquí</span>}</div>
        <p className="small text-muted">{item.direccion?.barrio || item.direccion?.ciudad || "Sin ubicación"}</p>
        <div className="form-check form-switch mb-3"><input className="form-check-input" type="checkbox" checked={local.hiddenOnMain !== true} onChange={(e) => patchItem(item, { hiddenOnMain: !e.target.checked })} disabled={busy === key} /><label className="form-check-label">Mostrar en página principal</label></div>
        {branches.length > 0 && <div className="mb-3"><div className="small fw-semibold mb-1">Mostrar también en sucursales</div>{branches.map((branch) => { const checked = (local.branchIds || []).includes(branch.id); return <label className="form-check" key={branch.id}><input type="checkbox" className="form-check-input" checked={checked} onChange={() => patchItem(item, { branchIds: checked ? (local.branchIds || []).filter((id) => id !== branch.id) : [...(local.branchIds || []), branch.id] })} /><span className="form-check-label">{branch.name}</span></label>; })}</div>}
        <div className="input-group input-group-sm mb-2"><input type="number" min="1" max="365" className="form-control" value={daysByItem[key] || 1} onChange={(e) => setDaysByItem({ ...daysByItem, [key]: e.target.value })} /><span className="input-group-text">días</span><button className="btn btn-warning" onClick={() => highlight(item)} disabled={busy === key}>Destacar</button></div>
        <div className="small text-muted">El aviso original permanece bajo control exclusivo de la inmobiliaria que lo cargó.</div>
      </div></div></div></div></article>;
    })}</div>
  </main>;
}
