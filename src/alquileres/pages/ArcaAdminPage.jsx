import { useEffect, useMemo, useState } from "react";

import SEO from "../../components/SEO";
import { getAllInmobiliarias } from "../../inmobiliaria/services/inmobiliaria.service";
import { getRentalPeople } from "../services/rental.service";
import {
  getArcaAdminOverview,
  getArcaProductionRegistrationCertificate,
  testArcaHomologation,
  testArcaProductionConnection,
  upsertArcaIssuerProfile,
} from "../services/arca.service";

const emptyProfile = {
  name: "",
  issuerLegalName: "",
  issuerTradeName: "",
  commercialAddress: "",
  grossIncomeNumber: "",
  activityStartDate: "",
  inmobiliariaId: "",
  issuerPartyId: "",
  issuerCuit: "",
  pointOfSale: 0,
  active: true,
  productionIssuanceEnabled: false,
  registrationLookup: null,
};

const normalizeCuit = (value = "") => value.toString().replace(/\D/g, "").slice(0, 11);

const ArcaAdminPage = () => {
  const [profiles, setProfiles] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [agencyPeople, setAgencyPeople] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyProfile);
  const [testResult, setTestResult] = useState(null);
  const [productionTestResult, setProductionTestResult] = useState(null);
  const [productionRegistrationPreview, setProductionRegistrationPreview] = useState(null);
  const [registrationPreview, setRegistrationPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const agencyNames = useMemo(() => Object.fromEntries(
    agencies.map((item) => [item.id, item.nombre || item.name || item.id]),
  ), [agencies]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [overview, agencyData] = await Promise.all([
        getArcaAdminOverview(),
        getAllInmobiliarias(),
      ]);
      setProfiles(overview.profiles || []);
      setAgencies(agencyData || []);
      setForm((current) => ({
        ...current,
        inmobiliariaId: current.inmobiliariaId || agencyData?.[0]?.id || "",
      }));
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar la configuración ARCA.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let active = true;
    if (!form.inmobiliariaId) {
      setAgencyPeople([]);
      return undefined;
    }
    getRentalPeople(form.inmobiliariaId)
      .then((items) => {
        if (active) setAgencyPeople(items.filter((item) => item.roles?.includes("owner")));
      })
      .catch(() => { if (active) setAgencyPeople([]); });
    return () => { active = false; };
  }, [form.inmobiliariaId]);

  const save = async (event) => {
    event.preventDefault();
    const storedProfile = profiles.find((item) => item.id === editingId);
    const enablesProduction = form.productionIssuanceEnabled === true
      && storedProfile?.productionIssuanceEnabled !== true;
    let productionActivationConfirmation = "";
    if (enablesProduction) {
      if (!window.confirm(
        `Vas a habilitar la emisión de comprobantes REALES para CUIT ${normalizeCuit(form.issuerCuit)} · PV ${form.pointOfSale}. Esta habilitación no emite por sí sola, pero permitirá solicitar CAE desde los contratos. ¿Continuar?`,
      )) return;
      const expectedText = `HABILITAR ${normalizeCuit(form.issuerCuit)} PV ${Math.trunc(Number(form.pointOfSale) || 0)}`;
      productionActivationConfirmation = window.prompt(
        `Confirmación final de habilitación. Escribí exactamente: ${expectedText}`,
        "",
      ) || "";
      if (productionActivationConfirmation.trim().toUpperCase() !== expectedText) {
        setError(`La habilitación fue cancelada porque no se escribió ${expectedText}.`);
        return;
      }
    }
    try {
      setWorking(true);
      setError("");
      setNotice("");
      await upsertArcaIssuerProfile({
        profileId: editingId,
        profile: form,
        productionActivationConfirmation,
      });
      setEditingId("");
      setForm({ ...emptyProfile, inmobiliariaId: agencies[0]?.id || "" });
      setRegistrationPreview(null);
      await load();
      setNotice("Perfil fiscal guardado. Las credenciales permanecen en Secret Manager.");
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar el perfil.");
    } finally {
      setWorking(false);
    }
  };

  const edit = (profile) => {
    setEditingId(profile.id);
    setForm({
      name: profile.name || "",
      issuerLegalName: profile.issuerLegalName || "",
      issuerTradeName: profile.issuerTradeName || "",
      commercialAddress: profile.commercialAddress || "",
      grossIncomeNumber: profile.grossIncomeNumber || "",
      activityStartDate: profile.activityStartDate || "",
      inmobiliariaId: profile.inmobiliariaId || "",
      issuerPartyId: profile.issuerPartyId || "",
      issuerCuit: profile.issuerCuit || "",
      pointOfSale: Number(profile.pointOfSale || 0),
      active: profile.active === true,
      productionIssuanceEnabled: profile.productionIssuanceEnabled === true,
      registrationLookup: profile.registrationLookup || null,
    });
    setRegistrationPreview(null);
    setTestResult(null);
    setProductionTestResult(null);
    setProductionRegistrationPreview(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const lookupRegistration = async () => {
    if (!editingId) {
      setError("Guardá primero el perfil fiscal para consultar su constancia real en ARCA Producción.");
      return;
    }
    try {
      setWorking(true);
      setError("");
      setNotice("");
      setRegistrationPreview(null);
      const result = await getArcaProductionRegistrationCertificate(editingId);
      setRegistrationPreview(result);
      setNotice("ARCA Producción respondió la consulta real. Revisá los datos antes de aplicarlos al perfil.");
    } catch (lookupError) {
      setError(lookupError.message || "No se pudo consultar la constancia real en ARCA Producción.");
    } finally {
      setWorking(false);
    }
  };

  const applyRegistration = () => {
    if (normalizeCuit(registrationPreview?.personCuit) !== normalizeCuit(form.issuerCuit)) {
      setError("La constancia consultada no corresponde al CUIT emisor del perfil.");
      return;
    }
    setForm((current) => ({
      ...current,
      issuerLegalName: registrationPreview.suggestedProfile?.issuerLegalName || current.issuerLegalName,
      commercialAddress: registrationPreview.suggestedProfile?.commercialAddress || current.commercialAddress,
      registrationLookup: {
        personCuit: registrationPreview.personCuit,
        queriedAt: registrationPreview.source?.queriedAt || "",
        processedAt: registrationPreview.source?.processedAt || "",
        taxIdStatus: registrationPreview.taxIdStatus || "",
      },
    }));
    setError("");
    setNotice("Nombre y domicilio fiscal aplicados al formulario. Confirmalos y guardá el perfil.");
  };

  const test = async (profile) => {
    try {
      setWorking(true);
      setError("");
      setNotice("");
      const result = await testArcaHomologation(profile.id);
      setTestResult({ profileId: profile.id, ...result });
      setNotice(result.scope === "platform_only"
        ? "La plataforma respondió correctamente en homologación. El CUIT real representado se valida únicamente con Probar PROD."
        : result.configuredPointAvailable
          ? "WSAA, WSFE y el punto de venta respondieron correctamente."
          : "WSAA y WSFE respondieron, pero el punto configurado no está disponible.");
      await load();
    } catch (testError) {
      setError(testError.message || "No se pudo probar la conexión con ARCA.");
    } finally {
      setWorking(false);
    }
  };

  const testProduction = async (profile) => {
    try {
      setWorking(true);
      setError("");
      setNotice("");
      const result = await testArcaProductionConnection(profile.id);
      setProductionTestResult({ profileId: profile.id, ...result });
      setNotice(result.configuredPointAvailable
        ? "Producción respondió correctamente en modo de solo lectura. No se emitió ningún comprobante."
        : "Producción respondió, pero el punto de venta configurado no está disponible.");
      await load();
    } catch (testError) {
      setError(testError.message || "No se pudo probar la conexión de producción con ARCA.");
    } finally {
      setWorking(false);
    }
  };

  const lookupProductionRegistration = async (profile) => {
    try {
      setWorking(true);
      setError("");
      setNotice("");
      const result = await getArcaProductionRegistrationCertificate(profile.id);
      setProductionRegistrationPreview({
        profileId: profile.id,
        profileName: profile.name,
        ...result,
      });
      setNotice("ARCA Producción respondió la consulta real. No se emitió ningún comprobante.");
      await load();
    } catch (lookupError) {
      setError(lookupError.message || "No se pudo consultar la constancia real en ARCA.");
    } finally {
      setWorking(false);
    }
  };

  const applyProductionRegistration = () => {
    const profile = profiles.find((item) => (
      item.id === productionRegistrationPreview?.profileId
    ));
    if (!profile) {
      setError("No se encontró el perfil fiscal asociado a la consulta.");
      return;
    }
    edit(profile);
    setRegistrationPreview(productionRegistrationPreview);
    setProductionRegistrationPreview(null);
    setNotice("Datos reales preparados en el formulario. Revisalos y guardá para aplicarlos.");
  };

  return (
    <main className="container py-4">
      <SEO title="Integración ARCA | Administración" noIndex />
      <header className="mb-4">
        <p className="text-uppercase text-muted small mb-1">Administración ONO Prop</p>
        <h1 className="h3 mb-1">Integración ARCA</h1>
        <p className="text-muted mb-0">Perfiles multiemisor, homologación y controles de Producción.</p>
      </header>

      <div className="alert alert-info"><strong>Administración fiscal segura.</strong> Las pruebas y consultas de esta pantalla son de solo lectura. La emisión real se inicia exclusivamente desde el contrato, con vista previa, validación reciente y doble confirmación. La aplicación nunca muestra certificados, claves ni tickets WSAA.</div>
      <div className="alert alert-light border">
        <strong>Modelo multiemisor por delegación.</strong> ONO Prop utiliza su computador fiscal para operar por cada emisor autorizado. El CUIT y el punto de venta pertenecen al locador; no se cargan certificados ni claves fiscales del cliente. <strong>Probar PROD</strong> verifica la delegación y el punto de venta sin solicitar CAE.
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <section className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
          <h2 className="h5">{editingId ? "Editar perfil fiscal" : "Nuevo perfil fiscal"}</h2>
          <form onSubmit={save}>
            <div className="row g-3">
              <div className="col-lg-4"><label className="form-label">Nombre</label><input className="form-control" required placeholder="Emisor homologación ONO Prop" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
              <div className="col-lg-4"><label className="form-label">Inmobiliaria</label><select className="form-select" required value={form.inmobiliariaId} onChange={(event) => setForm({ ...form, inmobiliariaId: event.target.value })}>{agencies.map((agency) => <option value={agency.id} key={agency.id}>{agency.nombre || agency.name || agency.id}</option>)}</select></div>
              <div className="col-lg-4"><label className="form-label">Locador emisor</label><select className="form-select" value={form.issuerPartyId} onChange={(event) => setForm({ ...form, issuerPartyId: event.target.value })}><option value="">Perfil fiscal general</option>{agencyPeople.map((person) => <option value={person.id} key={person.id}>{person.name} · {person.taxId || "sin CUIT"}</option>)}</select><small className="text-muted">Al elegir un locador, el perfil solo podrá facturar sus contratos.</small></div>
              <div className="col-sm-7 col-lg-3"><label className="form-label">CUIT emisor</label><input className="form-control" inputMode="numeric" required value={form.issuerCuit} onChange={(event) => { setForm({ ...form, issuerCuit: event.target.value }); setRegistrationPreview(null); }} /></div>
              <div className="col-sm-5 col-lg-1"><label className="form-label">PV</label><input className="form-control" type="number" min="1" required value={form.pointOfSale || ""} onChange={(event) => setForm({ ...form, pointOfSale: Number(event.target.value) })} /></div>
              <div className="col-lg-5"><label className="form-label">Apellido y nombre / razón social</label><input className="form-control" placeholder="Dato que aparecerá en la factura" value={form.issuerLegalName} onChange={(event) => setForm({ ...form, issuerLegalName: event.target.value })} /></div>
              <div className="col-lg-3"><label className="form-label">Nombre de fantasía</label><input className="form-control" value={form.issuerTradeName} onChange={(event) => setForm({ ...form, issuerTradeName: event.target.value })} /></div>
              <div className="col-lg-6"><label className="form-label">Domicilio comercial</label><input className="form-control" value={form.commercialAddress} onChange={(event) => setForm({ ...form, commercialAddress: event.target.value })} /></div>
              <div className="col-sm-6 col-lg-3"><label className="form-label">Ingresos Brutos / condición</label><input className="form-control" placeholder="Número o No contribuyente" value={form.grossIncomeNumber} onChange={(event) => setForm({ ...form, grossIncomeNumber: event.target.value })} /></div>
              <div className="col-sm-6 col-lg-3"><label className="form-label">Inicio de actividades</label><input className="form-control" type="date" value={form.activityStartDate} onChange={(event) => setForm({ ...form, activityStartDate: event.target.value })} /></div>
              <div className="col-12">
                <div className="border rounded p-3 bg-light">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                    <div>
                      <strong>Constancia de Inscripción ARCA</strong>
                      <small className="d-block text-muted">Consulta real en Producción y de solo lectura; nunca sobrescribe el perfil sin confirmación.</small>
                    </div>
                    {form.registrationLookup?.queriedAt && <small className="text-muted">Última importación: {new Date(form.registrationLookup.queriedAt).toLocaleString("es-AR")}</small>}
                  </div>
                  <div className="row g-2 align-items-end">
                    <div className="col-md-5 col-lg-4">
                      <label className="form-label small">CUIT a consultar</label>
                      <input className="form-control" inputMode="numeric" value={form.issuerCuit} readOnly placeholder="CUIT del emisor" />
                    </div>
                    <div className="col-auto"><button type="button" className="btn btn-outline-primary" disabled={working || !editingId || !form.issuerCuit} onClick={lookupRegistration}>{working ? "Consultando..." : "Consultar constancia real"}</button></div>
                  </div>
                  <small className="d-block text-muted mt-2">{editingId ? "La consulta usa ARCA Producción y no emite comprobantes. Solo se habilita “Aplicar” cuando la constancia coincide con el CUIT emisor." : "Guardá primero el perfil para poder consultar la constancia real."}</small>
                  {registrationPreview && (
                    <div className="card border-primary mt-3">
                      <div className="card-body">
                        <div className="d-flex flex-wrap justify-content-between gap-2">
                          <div>
                            <strong>{registrationPreview.legalName || "Nombre no informado"}</strong>
                            <small className="d-block text-muted">CUIT {registrationPreview.personCuit} · {registrationPreview.taxIdStatus || "Estado no informado"}</small>
                          </div>
                          <button type="button" className="btn btn-sm btn-primary" disabled={normalizeCuit(registrationPreview.personCuit) !== normalizeCuit(form.issuerCuit)} onClick={applyRegistration}>Aplicar al formulario</button>
                        </div>
                        <p className="small mt-3 mb-1"><strong>Domicilio fiscal:</strong> {registrationPreview.fiscalAddress?.formatted || "No informado"}</p>
                        <p className="small mb-1"><strong>Monotributo:</strong> {registrationPreview.monotributo?.registered ? registrationPreview.monotributo.categoryDescription || "Inscripto" : "No surge categoría en la respuesta"}</p>
                        <p className="small mb-0"><strong>Actividades:</strong> {registrationPreview.activities?.length || 0}{registrationPreview.earliestActivityPeriod ? ` · período más antiguo informado ${registrationPreview.earliestActivityPeriod}` : ""}</p>
                        {registrationPreview.warnings?.length > 0 && <div className="alert alert-warning py-2 small mt-3 mb-0">{registrationPreview.warnings.join(" ")}</div>}
                      </div>
                    </div>
                  )}
                  <small className="d-block text-muted mt-2">Ingresos Brutos provincial y la fecha exacta de inicio de actividades deben confirmarse con la documentación del contribuyente.</small>
                </div>
              </div>
              <div className="col-12"><small className="text-muted">Estos datos se imprimen en la representación del comprobante. Antes de habilitar producción deberán estar completos.</small></div>
              <div className="col-12"><div className="form-check"><input id="arcaProfileActive" className="form-check-input" type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked, ...(!event.target.checked ? { productionIssuanceEnabled: false } : {}) })} /><label className="form-check-label" htmlFor="arcaProfileActive">Perfil activo para preparar comprobantes</label></div></div>
              <div className="col-12">
                <div className="border border-danger rounded p-3 bg-danger-subtle">
                  <div className="form-check">
                    <input id="arcaProductionEnabled" className="form-check-input" type="checkbox" disabled={!form.active} checked={form.productionIssuanceEnabled} onChange={(event) => setForm({ ...form, productionIssuanceEnabled: event.target.checked })} />
                    <label className="form-check-label fw-semibold" htmlFor="arcaProductionEnabled">Habilitar emisión real en ARCA Producción</label>
                  </div>
                  <small className="d-block mt-1">Requiere perfil completo, constancia real de menos de 30 días y prueba PROD de menos de 24 horas. Cada factura seguirá exigiendo una vista previa vigente y doble confirmación.</small>
                </div>
              </div>
            </div>
            <div className="d-flex gap-2 mt-3"><button className="btn btn-primary" disabled={working}>{working ? "Guardando..." : "Guardar perfil"}</button>{editingId && <button className="btn btn-outline-secondary" type="button" onClick={() => { setEditingId(""); setForm({ ...emptyProfile, inmobiliariaId: agencies[0]?.id || "" }); setRegistrationPreview(null); }}>Cancelar</button>}</div>
          </form>
        </div>
      </section>

      <section className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <h2 className="h5">Perfiles configurados</h2>
          <p className="small text-muted">“Probar plataforma HOMO” controla la integración técnica. “Probar PROD” valida el CUIT representado, la delegación y el punto de venta real sin emitir. Emitir exige además habilitar expresamente el perfil.</p>
          {loading ? <p className="text-muted">Cargando...</p> : profiles.length === 0 ? <p className="text-muted mb-0">Todavía no hay perfiles fiscales.</p> : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead><tr><th>Perfil</th><th>Inmobiliaria</th><th>Configuración</th><th>Últimas pruebas</th><th className="text-end">Acciones</th></tr></thead>
                <tbody>{profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td><strong>{profile.name}</strong><small className="d-block text-muted">{profile.active ? "Activo" : "Inactivo"}</small><span className={`badge mt-1 ${profile.productionIssuanceEnabled ? "text-bg-danger" : "text-bg-light text-dark border"}`}>{profile.productionIssuanceEnabled ? "Emisión PROD habilitada" : "PROD sin emisión"}</span>{profile.productionAuthorization?.status === "verified" ? <span className="badge text-bg-success ms-1">{profile.productionAuthorization.mode === "platform_delegation" ? "Delegación verificada" : "Certificado verificado"}</span> : profile.productionAuthorization?.status === "pending_or_rejected" ? <span className="badge text-bg-warning ms-1">Revisar delegación</span> : <span className="badge text-bg-secondary ms-1">Acceso sin verificar</span>}</td>
                    <td>{agencyNames[profile.inmobiliariaId] || profile.inmobiliariaId}</td>
                    <td>CUIT {profile.issuerCuit}<small className="d-block text-muted">Factura C · PV {profile.pointOfSale}</small></td>
                    <td>
                      <small className="d-block">HOMO: {profile.lastTest?.checkedAt ? new Date(profile.lastTest.checkedAt).toLocaleString("es-AR") : "Sin probar"}</small>
                      <small className="d-block">PROD: {profile.lastProductionTest?.checkedAt ? new Date(profile.lastProductionTest.checkedAt).toLocaleString("es-AR") : "Sin probar"}</small>
                    </td>
                    <td className="text-end text-nowrap">
                      <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => edit(profile)}>Editar</button>
                      <button className="btn btn-sm btn-outline-primary ms-2" type="button" disabled={working || !profile.active} onClick={() => test(profile)}>Probar plataforma HOMO</button>
                      <button className="btn btn-sm btn-outline-success ms-2" type="button" disabled={working || !profile.active} onClick={() => testProduction(profile)}>Probar PROD</button>
                      <button className="btn btn-sm btn-outline-success ms-2" type="button" disabled={working} onClick={() => lookupProductionRegistration(profile)}>Constancia real</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {testResult && (
            <div className="alert alert-light border mt-3 mb-0">
              <strong>HOMO:</strong> App {testResult.dummy?.appServer}, DB {testResult.dummy?.dbServer}, Auth {testResult.dummy?.authServer}. Certificado de ONO Prop vigente hasta {new Date(testResult.certificate?.validTo).toLocaleDateString("es-AR")}. {testResult.scope === "platform_only" ? "Esta prueba no valida el CUIT ni el punto de venta real del cliente; usá Probar PROD." : testResult.pointValidationMode === "last-authorized" ? `PV validado por numeración; último comprobante: ${testResult.lastAuthorizedVoucher || 0}.` : `Puntos WSFE: ${testResult.pointsOfSale?.map((item) => item.number).join(", ") || "ninguno"}.`}
            </div>
          )}
          {productionTestResult && (
            <div className="alert alert-success mt-3 mb-0">
              <strong>PROD · solo lectura:</strong> {productionTestResult.authorization?.mode === "platform_delegation" ? "Delegación" : "Acceso directo"} verificado para CUIT {productionTestResult.authorization?.representedCuit}. App {productionTestResult.dummy?.appServer}, DB {productionTestResult.dummy?.dbServer}, Auth {productionTestResult.dummy?.authServer}. Certificado de ONO Prop vigente hasta {new Date(productionTestResult.certificate?.validTo).toLocaleDateString("es-AR")}. {productionTestResult.pointValidationMode === "last-authorized" ? `PV validado por numeración; último comprobante real: ${productionTestResult.lastAuthorizedVoucher || 0}.` : `Puntos WSFE: ${productionTestResult.pointsOfSale?.map((item) => item.number).join(", ") || "ninguno"}.`} No se solicitó CAE.
            </div>
          )}
          {productionRegistrationPreview && (
            <div className="card border-success mt-3">
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between gap-2">
                  <div>
                    <strong>Constancia real · {productionRegistrationPreview.profileName}</strong>
                    <small className="d-block text-muted">{productionRegistrationPreview.legalName || "Nombre no informado"} · CUIT {productionRegistrationPreview.personCuit}</small>
                  </div>
                  <button type="button" className="btn btn-sm btn-success" onClick={applyProductionRegistration}>Revisar y aplicar al perfil</button>
                </div>
                <p className="small mt-3 mb-1"><strong>Domicilio fiscal:</strong> {productionRegistrationPreview.fiscalAddress?.formatted || "No informado"}</p>
                <p className="small mb-0"><strong>Estado:</strong> {productionRegistrationPreview.taxIdStatus || "No informado"}</p>
                {productionRegistrationPreview.warnings?.length > 0 && <div className="alert alert-warning py-2 small mt-3 mb-0">{productionRegistrationPreview.warnings.join(" ")}</div>}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default ArcaAdminPage;
