import { useState } from "react";

import SEO from "../components/SEO";
import "./guides.css";

const ONO_PROP_CUIT = "20-25300621-9";
const ONO_PROP_CUIT_DIGITS = "20253006219";

const Step = ({ number, children }) => (
  <li className="arca-guide-step">
    <span className="arca-guide-step-number" aria-hidden="true">{number}</span>
    <div>{children}</div>
  </li>
);

const ArcaDelegationGuidePage = () => {
  const [copied, setCopied] = useState(false);

  const copyCuit = async () => {
    try {
      await navigator.clipboard.writeText(ONO_PROP_CUIT_DIGITS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="arca-guide-page">
      <SEO
        title="Guía de delegación ARCA | ONO Prop"
        description="Instrucciones para delegar Facturación Electrónica y crear el punto de venta que utilizará ONO Prop."
        url="https://onoprop.com/guias/delegacion-arca"
        noIndex
      />

      <section className="arca-guide-hero">
        <div className="container py-5 py-lg-6">
          <p className="arca-guide-eyebrow mb-2">ONO Prop · Guía para clientes</p>
          <h1>Habilitá la facturación electrónica en ONO Prop</h1>
          <p className="arca-guide-lead">
            Solo necesitás completar dos gestiones en ARCA: delegar el servicio de
            Facturación Electrónica y crear un punto de venta para Web Services.
          </p>
          <div className="d-flex flex-wrap gap-2 mt-4">
            <a
              className="btn btn-light btn-lg"
              href="https://www.arca.gob.ar/"
              target="_blank"
              rel="noreferrer"
            >
              Ingresar a ARCA
            </a>
            <button className="btn btn-outline-light btn-lg" type="button" onClick={copyCuit}>
              {copied ? "CUIT copiado" : "Copiar CUIT de ONO Prop"}
            </button>
          </div>
        </div>
      </section>

      <div className="container arca-guide-content py-5">
        <aside className="arca-guide-prerequisite mb-4">
          <div className="arca-guide-icon" aria-hidden="true">✓</div>
          <div>
            <h2>Antes de comenzar</h2>
            <p className="mb-0">
              Ingresá con la Clave Fiscal de la persona o empresa que emitirá las facturas.
              Necesitás nivel de seguridad 3 o superior y facultades para administrar sus relaciones.
            </p>
          </div>
        </aside>

        <section className="arca-guide-card mb-4">
          <div className="arca-guide-card-heading">
            <span className="arca-guide-section-number">1</span>
            <div>
              <p className="arca-guide-kicker">Primera gestión</p>
              <h2>Delegá Facturación Electrónica</h2>
            </div>
          </div>

          <ol className="arca-guide-steps">
            <Step number="1">
              Ingresá a <strong>ARCA</strong> con tu CUIT y Clave Fiscal.
            </Step>
            <Step number="2">
              Abrí <strong>Administrador de Relaciones de Clave Fiscal</strong>.
            </Step>
            <Step number="3">
              En <strong>Autoridad de Aplicación</strong>, elegí a la persona o empresa que emitirá
              las facturas y seleccioná <strong>Nueva relación</strong>.
            </Step>
            <Step number="4">
              Buscá <strong>ARCA → WebServices → Facturación Electrónica</strong>.
            </Step>
            <Step number="5">
              En representante, ingresá el CUIT de ONO Prop: <strong>{ONO_PROP_CUIT}</strong>.
            </Step>
            <Step number="6">
              Verificá que aparezca <strong>Héctor Horacio Vázquez Cuestas</strong>. Si ARCA muestra
              una advertencia sobre el computador, podés continuar.
            </Step>
            <Step number="7">
              Confirmá y guardá la relación. La delegación solo habilita el servicio: no emite
              comprobantes por sí misma.
            </Step>
          </ol>

          <div className="arca-guide-identity">
            <span>Representante técnico de ONO Prop</span>
            <strong>Héctor Horacio Vázquez Cuestas</strong>
            <span>CUIT {ONO_PROP_CUIT}</span>
          </div>
        </section>

        <section className="arca-guide-card mb-4">
          <div className="arca-guide-card-heading">
            <span className="arca-guide-section-number">2</span>
            <div>
              <p className="arca-guide-kicker">Segunda gestión</p>
              <h2>Creá el punto de venta</h2>
            </div>
          </div>

          <ol className="arca-guide-steps">
            <Step number="1">
              En <strong>Mis Servicios</strong>, abrí <strong>Administración de puntos de venta y domicilios</strong>.
            </Step>
            <Step number="2">
              Elegí la persona o empresa emisora y entrá en <strong>A/B/M de puntos de venta</strong>.
            </Step>
            <Step number="3">
              Presioná <strong>Agregar</strong>, elegí un número libre y escribí <strong>ONO Prop</strong>
              como nombre de fantasía.
            </Step>
            <Step number="4">
              Seleccioná el sistema que corresponda a tu condición fiscal:
              <ul className="arca-guide-options">
                <li><strong>Monotributista:</strong> Factura Electrónica - Monotributo - Web Services.</li>
                <li><strong>Responsable Inscripto:</strong> RECE para aplicativo y WebServices.</li>
                <li><strong>Exento:</strong> Facturación Electrónica - Exento en IVA - WebServices.</li>
              </ul>
            </Step>
            <Step number="5">
              Asociá el domicilio correspondiente y guardá el nuevo punto de venta.
            </Step>
            <Step number="6">
              Avisanos que completaste la delegación e indicanos el <strong>número del punto de venta</strong>.
            </Step>
          </ol>
        </section>

        <aside className="arca-guide-security mb-4">
          <div className="arca-guide-security-mark" aria-hidden="true">!</div>
          <div>
            <h2>Protegé tus credenciales</h2>
            <p className="mb-0">
              ONO Prop nunca te pedirá tu Clave Fiscal, certificado ni clave privada. La autorización
              se realiza dentro de ARCA y puede revocarse desde allí.
            </p>
          </div>
        </aside>

        <section className="arca-guide-after mb-4">
          <p className="arca-guide-kicker">Después de avisarnos</p>
          <h2>¿Qué hace ONO Prop?</h2>
          <div className="arca-guide-after-grid">
            <div><span>1</span><p>Aceptamos y vinculamos la delegación.</p></div>
            <div><span>2</span><p>Verificamos el acceso técnico.</p></div>
            <div><span>3</span><p>Validamos el punto de venta sin emitir una factura.</p></div>
            <div><span>4</span><p>Te confirmamos cuando el perfil queda habilitado.</p></div>
          </div>
        </section>

        <section className="arca-guide-help text-center">
          <h2>¿Necesitás ayuda?</h2>
          <p>Escribinos y te acompañamos durante la configuración.</p>
          <a className="btn btn-primary" href="mailto:contacto@onoprop.com?subject=Ayuda%20con%20delegaci%C3%B3n%20ARCA">
            contacto@onoprop.com
          </a>
        </section>

        <p className="arca-guide-sources text-center mb-0">
          Información basada en las guías oficiales de ARCA sobre
          {" "}<a href="https://serviciosweb.arca.gob.ar/genericos/guiasPasoPaso/VerGuia.aspx?id=26" target="_blank" rel="noreferrer">delegación de servicios</a>
          {" "}y <a href="https://www.arca.gob.ar/facturacion/documentos/puntos-de-venta.pdf" target="_blank" rel="noreferrer">puntos de venta</a>.
        </p>
      </div>
    </main>
  );
};

export default ArcaDelegationGuidePage;
