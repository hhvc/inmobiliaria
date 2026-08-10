const RECEIPT_COPIES = [
  { id: "original", label: "ORIGINAL", destination: "Locatario" },
  { id: "duplicate", label: "DUPLICADO", destination: "Locador" },
  { id: "triplicate", label: "TRIPLICADO", destination: "Inmobiliaria" },
];

const RentalReceiptCopies = ({
  title,
  receiptNumber,
  dateLabel,
  date,
  agencyName,
  children,
  footerText,
  signatureLabel,
  copies = RECEIPT_COPIES,
}) => (
  <div className="rental-receipt-copies">
    {copies.map((copy) => (
      <article className="rental-receipt-sheet rental-receipt-copy" key={copy.id}>
        <header className="d-flex justify-content-between align-items-start gap-4 border-bottom pb-4 mb-4">
          <div>
            <p className="text-uppercase text-muted small mb-1">Administración de alquileres</p>
            <h1 className="h3 mb-1">{title}</h1>
            <strong>{agencyName || "Inmobiliaria"}</strong>
          </div>
          <div className="text-end">
            <span className="badge text-bg-light border text-dark mb-2">{copy.label} · Para {copy.destination}</span>
            <div className="small text-muted">Número</div>
            <strong>{receiptNumber}</strong>
            <div className="small text-muted mt-2">{dateLabel}</div>
            <strong>{date}</strong>
          </div>
        </header>
        {children}
        <footer className="row mt-5 pt-5">
          <div className="col-7"><p className="small text-muted mb-0">{footerText}</p></div>
          <div className="col-5 text-center"><div className="rental-signature-line" /><small>{signatureLabel}</small></div>
        </footer>
      </article>
    ))}
  </div>
);

export default RentalReceiptCopies;
