import { useState } from "react";

import SEO from "../../components/SEO";
import {
  createMercadoPagoCheckout,
  createMercadoPagoOperationId,
  openMercadoPagoCheckout,
} from "../services/mercadoPago.service";

const PRESETS = [1000, 2500, 5000, 10000];

const DonationPage = () => {
  const [amount, setAmount] = useState("2500");
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    try {
      setWorking(true);
      setError("");
      const result = await createMercadoPagoCheckout({
        contextType: "donation",
        operationId: createMercadoPagoOperationId("donation"),
        amountMinor: Math.round(Number(amount) * 100),
        ...form,
      });
      openMercadoPagoCheckout(result.initPoint);
    } catch (submitError) {
      setError(submitError.message || "No se pudo iniciar la donación.");
      setWorking(false);
    }
  };

  return (
    <main className="container py-5" style={{ maxWidth: 820 }}>
      <SEO title="Apoyar ONO Prop" description="Apoyá el desarrollo de ONO Prop mediante Mercado Pago." />
      <section className="card border-0 shadow-sm overflow-hidden">
        <div className="card-body p-4 p-lg-5">
          <span className="badge text-bg-success mb-3">Aporte voluntario</span>
          <h1 className="display-6 fw-bold">Ayudanos a seguir construyendo ONO Prop</h1>
          <p className="lead text-muted">Tu aporte ayuda a sostener el portal y desarrollar nuevas herramientas para inmobiliarias, consorcios, propietarios e inquilinos.</p>
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={submit} className="mt-4">
            <fieldset disabled={working}>
              <legend className="h5">Elegí el importe</legend>
              <div className="d-flex flex-wrap gap-2 mb-3">{PRESETS.map((value) => <button key={value} type="button" className={`btn ${Number(amount) === value ? "btn-success" : "btn-outline-success"}`} onClick={() => setAmount(`${value}`)}>${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value)}</button>)}</div>
              <div className="mb-3"><label className="form-label" htmlFor="donationAmount">Otro importe</label><div className="input-group"><span className="input-group-text">$</span><input id="donationAmount" className="form-control" type="number" min="100" max="1000000" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div></div>
              <div className="row g-3">
                <div className="col-md-6"><label className="form-label" htmlFor="donorName">Nombre (opcional)</label><input id="donorName" className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
                <div className="col-md-6"><label className="form-label" htmlFor="donorEmail">Email (opcional)</label><input id="donorEmail" className="form-control" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
                <div className="col-12"><label className="form-label" htmlFor="donorMessage">Mensaje (opcional)</label><textarea id="donorMessage" className="form-control" rows="3" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></div>
              </div>
              <p className="small text-muted mt-3">El pago se procesa de forma segura en Mercado Pago. ONO Prop no almacena los datos de tu tarjeta.</p>
              <button className="btn btn-success btn-lg w-100" type="submit">{working ? "Abriendo Mercado Pago..." : "Donar con Mercado Pago"}</button>
            </fieldset>
          </form>
        </div>
      </section>
    </main>
  );
};

export default DonationPage;

