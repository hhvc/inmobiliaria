import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { useActiveInmobiliariaModules } from "../../inmobiliaria/hooks/useActiveInmobiliariaModules";
import {
  createConsortium,
  getConsortiumById,
  updateConsortium,
} from "../services/consorcio.service";
import { createEmptyConsortium } from "../utils/consorcio.schema";
import "../consorcio.css";

const ConsortiumFormPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { activeInmobiliariaId, activeInmobiliaria, loading: agencyLoading } =
    useActiveInmobiliariaModules();
  const [form, setForm] = useState(createEmptyConsortium);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!id || !activeInmobiliariaId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getConsortiumById(activeInmobiliariaId, id);
        if (!data) throw new Error("El consorcio no existe.");
        if (mounted) setForm({ ...createEmptyConsortium(), ...data });
      } catch (loadError) {
        if (mounted) setError(loadError.message || "No se pudo cargar el consorcio.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [activeInmobiliariaId, id]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      if (id) {
        await updateConsortium(activeInmobiliariaId, id, form);
        navigate(`/admin/consorcios/${id}`);
      } else {
        const createdId = await createConsortium(activeInmobiliariaId, form);
        navigate(`/admin/consorcios/${createdId}`);
      }
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar el consorcio.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || agencyLoading) return <main className="container py-5 text-center">Cargando...</main>;

  return (
    <main className="container py-4 consortium-workspace">
      <SEO title={`${id ? "Editar" : "Nuevo"} consorcio | ONO Prop`} noIndex />
      <header className="mb-4">
        <Link className="text-decoration-none" to={id ? `/admin/consorcios/${id}` : "/admin/consorcios"}>← Volver</Link>
        <p className="text-uppercase text-muted small mb-1 mt-3">{activeInmobiliaria?.nombre || "Inmobiliaria activa"}</p>
        <h1 className="h3">{id ? "Editar consorcio" : "Nuevo consorcio"}</h1>
      </header>
      {error && <div className="alert alert-danger">{error}</div>}
      <form className="card border-0 shadow-sm" onSubmit={submit}>
        <div className="card-body p-4 p-lg-5">
          <h2 className="h5 mb-3">Identificación</h2>
          <div className="row g-3 mb-4">
            <div className="col-lg-6">
              <label className="form-label" htmlFor="consortium-name">Nombre del consorcio *</label>
              <input id="consortium-name" className="form-control" value={form.name} onChange={(e) => update("name", e.target.value)} required />
            </div>
            <div className="col-lg-6">
              <label className="form-label" htmlFor="consortium-legal-name">Denominación legal</label>
              <input id="consortium-legal-name" className="form-control" value={form.legalName} onChange={(e) => update("legalName", e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="consortium-tax-id">CUIT</label>
              <input id="consortium-tax-id" className="form-control" value={form.taxId} onChange={(e) => update("taxId", e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="consortium-registration">Matrícula / registro</label>
              <input id="consortium-registration" className="form-control" value={form.registration} onChange={(e) => update("registration", e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="consortium-status">Estado</label>
              <select id="consortium-status" className="form-select" value={form.status} onChange={(e) => update("status", e.target.value)}>
                <option value="active">Activo</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
          </div>

          <h2 className="h5 mb-3">Domicilio</h2>
          <div className="row g-3 mb-4">
            <div className="col-lg-7">
              <label className="form-label" htmlFor="consortium-address">Dirección *</label>
              <input id="consortium-address" className="form-control" value={form.address} onChange={(e) => update("address", e.target.value)} required />
            </div>
            <div className="col-lg-2">
              <label className="form-label" htmlFor="consortium-postal-code">Código postal</label>
              <input id="consortium-postal-code" className="form-control" value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} />
            </div>
            <div className="col-md-6 col-lg-3">
              <label className="form-label" htmlFor="consortium-city">Ciudad</label>
              <input id="consortium-city" className="form-control" value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="consortium-province">Provincia</label>
              <input id="consortium-province" className="form-control" value={form.province} onChange={(e) => update("province", e.target.value)} />
            </div>
          </div>

          <h2 className="h5 mb-3">Liquidación y cobros</h2>
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <label className="form-label" htmlFor="consortium-currency">Moneda</label>
              <select id="consortium-currency" className="form-select" value={form.currency} onChange={(e) => update("currency", e.target.value)}>
                <option value="ARS">Pesos argentinos (ARS)</option>
                <option value="USD">Dólares estadounidenses (USD)</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="consortium-due-day">Día habitual de vencimiento</label>
              <input id="consortium-due-day" className="form-control" type="number" min="1" max="31" value={form.dueDay} onChange={(e) => update("dueDay", Number(e.target.value))} />
              <div className="form-text">Se propone para el mes siguiente al período liquidado.</div>
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="consortium-bank-account">CBU, CVU o alias</label>
              <input id="consortium-bank-account" className="form-control" value={form.bankAccount} onChange={(e) => update("bankAccount", e.target.value)} />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="consortium-notes">Notas internas</label>
              <textarea id="consortium-notes" className="form-control" rows="4" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <Link className="btn btn-outline-secondary" to={id ? `/admin/consorcios/${id}` : "/admin/consorcios"}>Cancelar</Link>
            <button className="btn btn-primary" disabled={saving || !activeInmobiliariaId} type="submit">
              {saving ? "Guardando..." : "Guardar consorcio"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
};

export default ConsortiumFormPage;
