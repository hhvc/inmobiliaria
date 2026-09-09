import { Link } from "react-router-dom";

import SEO from "../components/SEO";
import "./consortiumGuide.css";

const workflow = [
  ["1", "Configurar", "Creá el consorcio, sus unidades y los accesos de propietarios y ocupantes."],
  ["2", "Preparar", "Registrá cuentas, proveedores y, si corresponde, los saldos anteriores."],
  ["3", "Liquidar", "Cargá gastos, distribución y comprobantes; luego emití las expensas."],
  ["4", "Comunicar", "Enviá liquidaciones y recordatorios según la autorización configurada."],
  ["5", "Cobrar", "Imputá cada cobro a uno o varios períodos y emití su recibo."],
  ["6", "Gestionar mora", "Registrá gestiones, convenios y, si corresponde, intereses."],
  ["7", "Controlar", "Pagá proveedores, conciliá tesorería y revisá las cuentas corrientes."],
  ["8", "Cerrar", "Ejecutá el control mensual asistido y conservá su registro auditable."],
];

const GuideSection = ({ number, id, title, summary, children }) => (
  <section className="consortium-guide-section" id={id}>
    <header>
      <span aria-hidden="true">{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{summary}</p>
      </div>
    </header>
    <div className="consortium-guide-section-body">{children}</div>
  </section>
);

const Checklist = ({ children }) => <ul className="consortium-guide-checklist">{children}</ul>;

const ConsortiumAdministrationGuidePage = () => (
  <main className="consortium-guide-page">
    <SEO
      title="Manual de Administración de Consorcios | ONO Prop"
      description="Guía práctica para configurar consorcios, liquidar expensas, registrar cobranzas, gestionar tesorería y realizar el cierre mensual en ONO Prop."
      url="https://onoprop.com/guias/administracion-consorcios"
      noIndex
    />

    <section className="consortium-guide-hero">
      <div className="container py-5 py-lg-6">
        <p className="consortium-guide-eyebrow">ONO Prop · Manual operativo</p>
        <h1>Administración de consorcios, paso a paso</h1>
        <p className="consortium-guide-lead">Una guía para pasar de la configuración inicial al cierre mensual sin perder saldos, comprobantes ni trazabilidad.</p>
        <p className="consortium-guide-version">Actualizado en septiembre de 2026</p>
        <div className="d-flex flex-wrap gap-2 mt-4">
          <Link className="btn btn-light btn-lg" to="/admin/consorcios">Abrir Administración de Consorcios</Link>
          <a className="btn btn-outline-light btn-lg" href="#circuito-mensual">Ver circuito mensual</a>
          <Link className="btn btn-outline-light btn-lg" to="/guias">Todas las guías</Link>
        </div>
      </div>
    </section>

    <div className="container consortium-guide-content py-5">
      <aside className="consortium-guide-principle mb-4">
        <span aria-hidden="true">✓</span>
        <div><h2>Regla principal</h2><p className="mb-0">No borres movimientos históricos para corregirlos. Usá las acciones de anulación, rectificación, archivo o cambio de estado: así la cuenta siempre conserva su explicación.</p></div>
      </aside>

      <nav className="consortium-guide-index mb-4" aria-label="Índice del manual">
        <strong>Ir directamente a</strong>
        <div>
          <a href="#puesta-en-marcha">Puesta en marcha</a>
          <a href="#liquidaciones">Liquidaciones</a>
          <a href="#cobranzas">Cobranzas</a>
          <a href="#mora-intereses">Mora e intereses</a>
          <a href="#tesoreria">Tesorería</a>
          <a href="#comunicaciones">Comunicaciones</a>
          <a href="#cierre-mensual">Cierre mensual</a>
          <a href="#mi-consorcio">Mi Consorcio</a>
          <a href="#primer-consorcio">Primer consorcio</a>
          <a href="#preguntas-frecuentes">Preguntas frecuentes</a>
        </div>
      </nav>

      <section className="consortium-guide-workflow mb-4" id="circuito-mensual">
        <p className="consortium-guide-kicker">Vista rápida</p>
        <h2>El circuito completo en ocho etapas</h2>
        <div>{workflow.map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <GuideSection number="1" id="puesta-en-marcha" title="Puesta en marcha" summary="Estos datos se cargan al comenzar una administración y luego solo requieren mantenimiento ocasional.">
        <div className="row g-4">
          <div className="col-lg-6"><h3>Crear el consorcio</h3><Checklist><li>Ingresá en <strong>Administración de Consorcios → Nuevo consorcio</strong>.</li><li>Completá nombre, domicilio, CUIT, moneda y día habitual de vencimiento.</li><li>Definí la política de intereses solo si ya fue aprobada por la administración.</li><li>Guardá y entrá en <strong>Gestionar</strong>.</li></Checklist></div>
          <div className="col-lg-6"><h3>Cargar unidades y accesos</h3><Checklist><li>En <strong>Unidades</strong>, cargá identificación, piso, departamento y coeficiente.</li><li>Identificá titular y ocupante con sus fechas de vigencia.</li><li>Agregá los emails que podrán ingresar a <strong>Mi Consorcio</strong>.</li><li>El coeficiente funciona como peso relativo; recomendamos que el total represente 100.</li></Checklist></div>
        </div>
        <div className="consortium-guide-note"><strong>Administraciones preexistentes.</strong> Usá “Migración y saldos iniciales” para registrar deuda o crédito anterior. No cargues esos importes como gastos del mes actual.</div>
      </GuideSection>

      <GuideSection number="2" id="liquidaciones" title="Liquidar expensas" summary="La liquidación se prepara como borrador y queda protegida una vez emitida.">
        <ol className="consortium-guide-numbered">
          <li><span>1</span><div><strong>Crear el período.</strong><p>Elegí mes y vencimiento y presioná “Crear borrador mensual”.</p></div></li>
          <li><span>2</span><div><strong>Cargar los gastos.</strong><p>Indicá concepto, categoría, importe y distribución: por coeficiente, partes iguales o una unidad determinada.</p></div></li>
          <li><span>3</span><div><strong>Adjuntar comprobantes.</strong><p>Relacioná cada PDF o imagen con el gasto correspondiente. Podés completar proveedor, número y fecha.</p></div></li>
          <li><span>4</span><div><strong>Revisar y emitir.</strong><p>Al emitir se crean las obligaciones de cada unidad. El borrador deja de ser editable.</p></div></li>
        </ol>
        <div className="consortium-guide-note"><strong>Correcciones posteriores.</strong> Si la liquidación ya fue emitida, registrá una nota de débito o crédito desde “Rectificar liquidación emitida”. El documento original se conserva.</div>
      </GuideSection>

      <GuideSection number="3" id="cobranzas" title="Cobros y cuentas corrientes" summary="El tablero de Cobranzas consolida la deuda y permite imputar un cobro a varios períodos sin perder trazabilidad.">
        <div className="consortium-guide-columns">
          <article><h3>Tablero de cobranzas</h3><p>Desde el consorcio abrí <strong>Cobranzas</strong>. Podés filtrar por mora, buscar una unidad, consultar su última gestión y exportar la vista a CSV.</p></article>
          <article><h3>Imputación de un cobro</h3><p>Elegí la unidad y los períodos alcanzados. El importe se aplica por vencimiento y un único recibo detalla todas las imputaciones. Si seleccionás toda la deuda, el excedente puede quedar como saldo a favor.</p></article>
          <article><h3>Pago informado por el consorcista</h3><p>El usuario adjunta el comprobante desde <strong>Mi Consorcio</strong>. La administración debe aprobarlo o rechazarlo; hasta entonces el saldo no cambia.</p></article>
          <article><h3>Cobro online</h3><p>Si el consorcio tiene un medio de cobro habilitado, el consorcista puede pagar online. La confirmación del proveedor registra el pago y sus deducciones; una devolución o contracargo también queda identificado.</p></article>
          <article><h3>Recibo y cuenta individual</h3><p>Desde <strong>Cuenta</strong> consultás obligaciones, pagos, ajustes, intereses, comunicaciones y saldo. Los cobros manuales pueden anularse indicando el motivo.</p></article>
          <article><h3>Convenios de pago</h3><p>El convenio documenta anticipo, cuotas y vencimientos, pero no cancela deuda. La cuenta corriente cambia recién cuando se registran los pagos reales.</p></article>
        </div>
        <div className="consortium-guide-warning"><strong>Importante:</strong> cerrar un mes no cancela la deuda. Los importes pendientes continúan vigentes hasta que se registre su pago o una rectificación válida.</div>
      </GuideSection>

      <GuideSection number="4" id="mora-intereses" title="Mora, gestiones e intereses" summary="La gestión de mora se documenta por unidad y los intereses siempre se previsualizan antes de afectar la cuenta.">
        <div className="row g-4">
          <div className="col-lg-6"><h3>Seguimiento</h3><Checklist><li>Registrá contactos, avisos, notas internas y promesas de pago.</li><li>Consultá la antigüedad de la deuda y el historial antes de una nueva gestión.</li><li>Usá convenios para documentar acuerdos sin borrar las obligaciones originales.</li></Checklist></div>
          <div className="col-lg-6"><h3>Liquidar intereses</h3><Checklist><li>En <strong>Editar consorcio</strong>, activá la TNA, el tipo de cálculo y los días de gracia.</li><li>En <strong>Cobranzas</strong>, seleccioná períodos y fecha de corte.</li><li>Revisá días, base e importe antes de confirmar los débitos.</li><li>La próxima liquidación comienza después de la última fecha ya calculada.</li></Checklist></div>
        </div>
        <div className="consortium-guide-note"><strong>Control deliberado.</strong> ONO Prop no genera intereses automáticamente. Cada confirmación deja un débito auditable. Si necesitás bonificar o corregirlo, usá una nota de crédito sobre “Interés por mora”.</div>
      </GuideSection>

      <GuideSection number="5" id="tesoreria" title="Proveedores y tesorería" summary="Tesorería explica dónde están los fondos y qué obligaciones quedan pendientes.">
        <div className="row g-4">
          <div className="col-lg-6"><h3>Preparación</h3><Checklist><li>Creá las cajas, cuentas bancarias, billeteras o fondos de reserva.</li><li>Cargá proveedores con sus datos de contacto y pago.</li><li>Relacioná los gastos del período con sus cuentas a pagar.</li></Checklist></div>
          <div className="col-lg-6"><h3>Operación diaria</h3><Checklist><li>Registrá pagos a proveedores indicando la cuenta de salida.</li><li>Usá movimientos manuales solo para operaciones que no provienen de cobros o proveedores.</li><li>Las transferencias entre cuentas no modifican el total de fondos.</li><li>Conciliá cada cuenta contra el extracto o arqueo disponible.</li></Checklist></div>
        </div>
        <p className="mb-0">El <strong>Estado económico</strong> reúne saldo inicial, ingresos, egresos, deuda de unidades, deuda con proveedores y fondos de reserva. Cada cierre o rectificación genera una versión inalterable.</p>
      </GuideSection>

      <GuideSection number="6" id="comunicaciones" title="Comunicaciones, avisos y multas" summary="ONO Prop separa la comunicación cotidiana de los movimientos económicos.">
        <div className="consortium-guide-columns">
          <article><h3>Envíos automáticos</h3><p>La administración autoriza la automatización por consorcio. Cada unidad puede heredarla, personalizar días de aviso o quedar excluida.</p></article>
          <article><h3>Mensajes a la administración</h3><p>Los usuarios pueden enviar denuncias o avisos, solicitudes y reclamos. El historial conserva respuestas y cambios de estado.</p></article>
          <article><h3>Multas</h3><p>Registralas desde el área <strong>Multas</strong> o desde la unidad. El débito queda vinculado al expediente y a su historial.</p></article>
        </div>
        <p className="mb-0">En <strong>Edificio</strong> administrás contactos de emergencia, evacuación, informes, pólizas, reglamentos, normativa, consejo de propietarios y actas, respetando la visibilidad elegida.</p>
      </GuideSection>

      <GuideSection number="7" id="cierre-mensual" title="Control y cierre mensual" summary="El asistente revisa los datos nuevamente antes de guardar el cierre y la identidad del responsable.">
        <Checklist><li>Seleccioná una liquidación emitida y presioná <strong>Revisar cierre mensual</strong>.</li><li>Resolvé los controles rojos: impiden un cierre seguro.</li><li>Revisá las advertencias amarillas. Pueden incluir deuda, falta de comprobantes o conciliaciones pendientes.</li><li>Agregá una observación si necesitás explicar una excepción.</li><li>Aceptá las advertencias y confirmá el cierre.</li></Checklist>
        <div className="consortium-guide-close-grid"><div><strong>Bloquea</strong><span>Liquidación sin emitir, ausencia de obligaciones o pagos informados pendientes.</span></div><div><strong>Advierte</strong><span>Deudas, documentos faltantes, proveedores pendientes o tesorería sin conciliar.</span></div><div><strong>Registra</strong><span>Controles, observaciones, advertencias, fecha y usuario responsable.</span></div></div>
      </GuideSection>

      <GuideSection number="8" id="mi-consorcio" title="Qué ve el consorcista" summary="Propietarios y ocupantes acceden únicamente a las unidades y contenidos autorizados para su email.">
        <div className="row g-4"><div className="col-lg-6"><h3>Funciones personales</h3><Checklist><li>Consultar liquidaciones y cuenta corriente propia.</li><li>Informar pagos y adjuntar comprobantes.</li><li>Enviar mensajes a la administración y seguir sus respuestas.</li></Checklist></div><div className="col-lg-6"><h3>Información del edificio</h3><Checklist><li>Ver emergencias, evacuación y reglamento de convivencia.</li><li>Los propietarios pueden acceder además a pólizas, actas y documentación reservada.</li><li>La visibilidad final siempre depende de la configuración del administrador.</li></Checklist></div></div>
        <div className="d-flex flex-wrap gap-2"><Link className="btn btn-outline-primary" to="/mi-consorcio">Abrir Mi Consorcio</Link><span className="align-self-center text-muted small">El usuario debe ingresar con el email habilitado en su unidad.</span></div>
      </GuideSection>

      <section className="consortium-guide-launch mb-4" id="primer-consorcio">
        <p className="consortium-guide-kicker">Puesta en producción</p>
        <h2>Checklist del primer consorcio</h2>
        <div className="consortium-guide-launch-grid">
          <Checklist><li>Consorcio, moneda y vencimiento revisados.</li><li>Unidades, coeficientes y responsables cargados.</li><li>Emails de acceso verificados con una unidad de prueba.</li><li>Cuenta de tesorería y medio de cobro configurados.</li></Checklist>
          <Checklist><li>Saldos anteriores conciliados con la administración saliente.</li><li>Primer borrador comparado antes de emitir.</li><li>Un pago, recibo y anulación de prueba verificados.</li><li>Automatizaciones autorizadas expresamente.</li></Checklist>
        </div>
      </section>

      <section className="consortium-guide-faq" id="preguntas-frecuentes">
        <p className="consortium-guide-kicker">Ayuda rápida</p><h2>Preguntas frecuentes</h2>
        <details><summary>¿Puedo corregir una liquidación emitida?</summary><p>Sí. Usá una nota de débito o crédito. No se modifica ni elimina la liquidación original.</p></details>
        <details><summary>¿Puedo cerrar aunque existan expensas impagas?</summary><p>Sí. La deuda aparece como advertencia y continúa en la cuenta corriente después del cierre.</p></details>
        <details><summary>¿Por qué un consorcista no puede ingresar?</summary><p>Verificá que use exactamente el email habilitado como titular, ocupante o acceso adicional, y que su email esté verificado en ONO Prop.</p></details>
        <details><summary>¿Una conciliación con diferencia impide cerrar?</summary><p>No necesariamente. Se muestra como advertencia y debe quedar revisada y, cuando corresponda, explicada mediante movimientos respaldados.</p></details>
        <details><summary>¿Cómo corrijo un pago o comprobante equivocado?</summary><p>Usá la acción de anular o rechazar e ingresá el motivo. Después registrá el dato correcto como un nuevo movimiento.</p></details>
        <details><summary>¿Los intereses se agregan solos?</summary><p>No. La política define cómo calcularlos, pero el administrador elige períodos y fecha, revisa la vista previa y confirma el débito.</p></details>
        <details><summary>¿Qué pasa si un pago cubre varios meses?</summary><p>Seleccioná los períodos alcanzados en Cobranzas. ONO Prop imputa primero el más antiguo y el recibo muestra el detalle completo.</p></details>
      </section>

      <section className="consortium-guide-help text-center mt-4">
        <h2>¿Necesitás acompañamiento?</h2><p>Podemos ayudarte a configurar el primer consorcio y revisar su circuito mensual.</p><a className="btn btn-primary" href="mailto:contacto@onoprop.com?subject=Ayuda%20con%20Administraci%C3%B3n%20de%20Consorcios">contacto@onoprop.com</a>
      </section>

      <p className="consortium-guide-disclaimer text-center">Este manual describe el funcionamiento operativo de ONO Prop. La administración debe aplicar la normativa, el reglamento y los criterios profesionales correspondientes a cada consorcio.</p>
    </div>
  </main>
);

export default ConsortiumAdministrationGuidePage;
