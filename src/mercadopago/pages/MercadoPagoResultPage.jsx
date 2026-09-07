import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import SEO from "../../components/SEO";
import { getSiroOrderStatus } from "../../siro/services/siro.service";
import { getMercadoPagoOrderStatus } from "../services/mercadoPago.service";

const STATES = {
  approved: { title: "Pago aprobado", className: "success", icon: "✓" },
  pending: { title: "Pago en proceso", className: "warning", icon: "…" },
  in_process: { title: "Pago en revisión", className: "warning", icon: "…" },
  rejected: { title: "Pago rechazado", className: "danger", icon: "!" },
  cancelled: { title: "Pago cancelado", className: "secondary", icon: "×" },
};

const formatMoney = (minor, currency = "ARS") => new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency,
}).format(Number(minor || 0) / 100);

const MercadoPagoResultPage = () => {
  const [params] = useSearchParams();
  const orderId = params.get("order") || "";
  const token = params.get("token") || "";
  const provider = params.get("provider") === "siro" ? "siro" : "mercadopago";
  const providerPaymentId = params.get("payment_id") ||
    params.get("collection_id") || "";
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setOrder(provider === "siro"
        ? await getSiroOrderStatus(orderId, token)
        : await getMercadoPagoOrderStatus(orderId, token, providerPaymentId));
    } catch (loadError) {
      setError(loadError.message || "No se pudo consultar el pago.");
    } finally {
      setLoading(false);
    }
  }, [orderId, provider, providerPaymentId, token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!order || order.credited || !["pending", "in_process"].includes(order.status)) return;
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [load, order]);

  const visual = order?.credited || order?.simulatedApproved
    ? STATES.approved
    : STATES[order?.status] || STATES.pending;
  const returnTarget = order?.contextType === "consortium_obligation"
    ? "/mi-consorcio"
    : order?.contextType === "billing_account" ||
      order?.contextType === "billing_obligation"
    ? `/admin/inmobiliaria/cuenta-corriente?inmobiliariaId=${encodeURIComponent(
      order.inmobiliariaId || "",
    )}`
    : "/";
  const returnLabel = returnTarget === "/mi-consorcio"
    ? "Volver a Mi Consorcio"
    : returnTarget === "/"
      ? "Volver a ONO Prop"
      : "Volver a la cuenta corriente";

  return (
    <main className="container py-5" style={{ maxWidth: 760 }}>
      <SEO title="Resultado del pago | ONO Prop" noIndex />
      <section className="card border-0 shadow-sm text-center">
        <div className="card-body p-4 p-lg-5">
          {loading && !order ? <div className="spinner-border text-primary" /> : (
            <>
              <div className={`d-inline-flex align-items-center justify-content-center rounded-circle bg-${visual.className}-subtle text-${visual.className} fs-1 fw-bold mb-3`} style={{ width: 76, height: 76 }}>{visual.icon}</div>
              <h1 className="h2">{visual.title}</h1>
              {error && <div className="alert alert-danger mt-3">{error}</div>}
              {order && <>
                <p className="lead mb-1">{order.title}</p>
                <p className="fs-3 fw-bold">{formatMoney(order.amountMinor, order.currency)}</p>
                {order.simulatedApproved ? (
                  <div className="alert alert-warning">La operación fue aprobada en homologación de SIRO. Es una prueba y no canceló la deuda ni generó movimientos reales.</div>
                ) : order.credited ? (
                  <div className="alert alert-success">El pago fue acreditado y aplicado automáticamente.</div>
                ) : (
                  <div className="alert alert-info">La confirmación definitiva se verifica directamente con {provider === "siro" ? "SIRO" : "Mercado Pago"}. Esta página se actualizará automáticamente.</div>
                )}
                {order.needsReview && <div className="alert alert-warning">El cobro fue recibido, pero requiere revisión administrativa antes de aplicarse.</div>}
              </>}
              <div className="d-flex flex-wrap justify-content-center gap-2 mt-4">
                {!order?.credited && !order?.simulatedApproved && <button className="btn btn-outline-primary" type="button" onClick={load} disabled={loading}>{loading ? "Consultando..." : "Actualizar estado"}</button>}
                <Link className="btn btn-primary" to={returnTarget}>{returnLabel}</Link>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
};

export default MercadoPagoResultPage;
