import { Link } from "react-router-dom";

const GuideCommercialOverview = ({
  audience,
  benefits = [],
  description,
  primaryAction,
  secondaryAction,
  title,
}) => (
  <section className="guide-commercial-overview mb-4" aria-labelledby="guide-commercial-title">
    <div className="guide-commercial-heading">
      <div>
        <p className="consortium-guide-kicker">Qué aporta este módulo</p>
        <h2 id="guide-commercial-title">{title}</h2>
        <p>{description}</p>
      </div>
      <div className="guide-commercial-audience">
        <span>Recomendado para</span>
        <strong>{audience}</strong>
      </div>
    </div>

    <div className="guide-commercial-benefits">
      {benefits.map((benefit) => (
        <article key={benefit.title}>
          <span aria-hidden="true">✓</span>
          <div><h3>{benefit.title}</h3><p>{benefit.text}</p></div>
        </article>
      ))}
    </div>

    <div className="guide-commercial-actions">
      <Link className="btn btn-primary" to={primaryAction.to}>{primaryAction.label}</Link>
      <Link className="btn btn-outline-primary" to={secondaryAction.to}>{secondaryAction.label}</Link>
      <a href="#manual-operativo">Ir al manual operativo ↓</a>
    </div>
  </section>
);

export default GuideCommercialOverview;
