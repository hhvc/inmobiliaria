export const RENTAL_CONTRACT_STATUSES = [
  { id: "draft", label: "Borrador", badge: "text-bg-secondary" },
  { id: "active", label: "Activo", badge: "text-bg-success" },
  { id: "ended", label: "Finalizado", badge: "text-bg-info" },
  { id: "cancelled", label: "Rescindido", badge: "text-bg-dark" },
];

export const RENTAL_PARTY_ROLES = [
  { id: "owner", label: "Locador" },
  { id: "tenant", label: "Locatario" },
  { id: "guarantor", label: "Garante" },
];

export const RENTAL_ADJUSTMENT_MODES = [
  { id: "manual", label: "Actualización manual" },
  { id: "fixed_percent", label: "Porcentaje fijo" },
  { id: "index", label: "Índice de referencia" },
  { id: "formula", label: "Fórmula contractual" },
];

export const RENTAL_CURRENCIES = [
  { id: "ARS", label: "Pesos argentinos (ARS)" },
  { id: "USD", label: "Dólares estadounidenses (USD)" },
  { id: "EUR", label: "Euros (EUR)" },
  { id: "OTHER", label: "Otra moneda" },
];

export const RENTAL_PAYMENT_METHODS = [
  { id: "transfer", label: "Transferencia" },
  { id: "cash", label: "Efectivo" },
  { id: "deposit", label: "Depósito" },
  { id: "card", label: "Tarjeta / plataforma" },
  { id: "other", label: "Otro" },
];

export const RENTAL_SETTLEMENT_RECEIPT_CONFIRMATION_METHODS = [
  { id: "signed_receipt", label: "Recibo firmado" },
  { id: "written_confirmation", label: "Confirmación escrita" },
  { id: "bank_confirmation", label: "Acreditación bancaria confirmada" },
  { id: "verbal_confirmation", label: "Confirmación verbal" },
  { id: "other", label: "Otro medio documentado" },
];

export const RENTAL_EXTERNAL_CLOSURE_REASONS = [
  { id: "pre_management", label: "Período anterior al inicio de la administración" },
  { id: "paid_direct_to_owner", label: "Pago recibido directamente por el locador" },
  { id: "managed_by_third_party", label: "Período gestionado por un tercero" },
  { id: "other", label: "Otro motivo documentado" },
];

export const RENTAL_EXTERNAL_VOUCHER_TYPES = [
  { id: "unknown", label: "Sin datos del comprobante" },
  { id: "factura_c", label: "Factura C" },
  { id: "factura_b", label: "Factura B" },
  { id: "factura_a", label: "Factura A" },
  { id: "otro", label: "Otro comprobante fiscal" },
];

export const RENTAL_EXPENSE_ALLOCATIONS = [
  { id: "owner", label: "A cargo del locador" },
  { id: "tenant", label: "A cargo del locatario" },
  { id: "agency", label: "A cargo de la inmobiliaria" },
];

export const getRentalContractStatus = (status = "draft") =>
  RENTAL_CONTRACT_STATUSES.find((item) => item.id === status)
  || RENTAL_CONTRACT_STATUSES[0];
