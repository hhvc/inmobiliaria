import { Link } from "react-router-dom";

import SEO from "../components/SEO";
import "./consortiumGuide.css";
import "./rentalGuide.css";

const workflow = [
  ["1", "Preparar", "Cargá el inmueble y registrá a las personas intervinientes."],
  ["2", "Contratar", "Creá un alquiler recurrente o temporal y revisalo antes de activarlo."],
  ["3", "Generar", "Creá o sincronizá las obligaciones sin duplicar períodos."],
  ["4", "Cobrar", "Registrá pagos, bonificaciones o cancelaciones externas."],
  ["5", "Liquidar", "Calculá honorarios y gastos y rendí los fondos al locador."],
  ["6", "Facturar", "Prepará, revisá y emití comprobantes ARCA cuando corresponda."],
  ["7", "Controlar", "Consultá cuentas corrientes y fondos pendientes de entrega."],
  ["8", "Cerrar", "Rectificá errores con trazabilidad y archivá contratos finalizados."],
];

const GuideSection = ({ number, id, title, summary, children }) => (
  <section className="consortium-guide-section" id={id}>
    <header><span aria-hidden="true">{number}</span><div><h2>{title}</h2><p>{summary}</p></div></header>
    <div className="consortium-guide-section-body">{children}</div>
  </section>
);

const Checklist = ({ children }) => <ul className="consortium-guide-checklist">{children}</ul>;

const RentalAdministrationGuidePage = () => (
  <main className="consortium-guide-page rental-guide-page">
    <SEO
      title="Manual de Administración de Alquileres | ONO Prop"
      description="Guía para crear contratos, administrar cobros y liquidaciones, rendir fondos al locador y emitir comprobantes ARCA con ONO Prop."
      url="https://onoprop.com/guias/administracion-alquileres"
      noIndex
    />

    <section className="consortium-guide-hero rental-guide-hero">
      <div className="container py-5 py-lg-6">
        <p className="consortium-guide-eyebrow">ONO Prop · Manual operativo</p>
        <h1>Administración de alquileres, paso a paso</h1>
        <p className="consortium-guide-lead">Del alta del contrato al cobro, la rendición al locador y la facturación, conservando el historial de cada movimiento.</p>
        <p className="consortium-guide-version">Actualizado en septiembre de 2026</p>
        <div className="d-flex flex-wrap gap-2 mt-4"><Link className="btn btn-light btn-lg" to="/admin/alquileres">Abrir Administración de Alquileres</Link><Link className="btn btn-outline-light btn-lg" to="/guias">Ver todas las guías</Link></div>
      </div>
    </section>

    <div className="container consortium-guide-content py-5">
      <aside className="consortium-guide-principle mb-4"><span aria-hidden="true">✓</span><div><h2>Antes de comenzar</h2><p className="mb-0">Confirmá la inmobiliaria activa en la barra superior. Personas, contratos, cobros y comprobantes siempre pertenecen a esa inmobiliaria.</p></div></aside>

      <nav className="consortium-guide-index mb-4" aria-label="Índice del manual">
        <strong>Ir directamente a</strong><div><a href="#alta">Alta</a><a href="#contrato">Contrato</a><a href="#obligaciones">Obligaciones</a><a href="#cobros">Cobros</a><a href="#locador">Locador</a><a href="#arca">ARCA</a><a href="#cuentas">Cuentas</a><a href="#controles">Controles</a><a href="#preguntas">Preguntas frecuentes</a></div>
      </nav>

      <section className="consortium-guide-workflow mb-4"><p className="consortium-guide-kicker">Vista rápida</p><h2>El circuito completo en ocho etapas</h2><div>{workflow.map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

      <GuideSection number="1" id="alta" title="Inmueble y personas" summary="El contrato reutiliza la información ya cargada en la inmobiliaria.">
        <div className="row g-4"><div className="col-lg-6"><h3>Inmueble</h3><Checklist><li>Cargalo desde Administración de Inmuebles.</li><li>Puede permanecer sin publicar: la publicación comercial y la administración son independientes.</li><li>Revisá dirección y datos básicos antes de vincularlo.</li></Checklist></div><div className="col-lg-6"><h3>Personas</h3><Checklist><li>Registrá locadores, locatarios y garantes desde <strong>Personas</strong>.</li><li>Asigná los roles correspondientes y completá documento, email y teléfono.</li><li>Editá la persona cuando cambien sus datos; el borrador fiscal permite volver a tomar la información actualizada.</li></Checklist></div></div>
      </GuideSection>

      <GuideSection number="2" id="contrato" title="Crear y activar el contrato" summary="Usá el borrador para revisar las condiciones antes de generar obligaciones.">
        <div className="consortium-guide-columns"><article><h3>Alquiler recurrente</h3><p>Definí vigencia, moneda, alquiler inicial, día de vencimiento, honorarios y regla de ajuste. Genera obligaciones por período.</p></article><article><h3>Alquiler temporal</h3><p>Definí inicio, fin, importe total y vencimiento. Una estadía de un día utiliza la misma fecha de inicio y fin y genera una única obligación.</p></article><article><h3>Activación</h3><p>Revisá inmueble, partes, fechas y valores. Al activar se crean las obligaciones iniciales; los cambios posteriores quedan registrados.</p></article></div>
      </GuideSection>

      <GuideSection number="3" id="obligaciones" title="Obligaciones y ajustes" summary="Cada período muestra importe base, cargos, bonificaciones, cobros y saldo operativo.">
        <Checklist><li>Usá <strong>Generar obligaciones</strong> para completar períodos futuros.</li><li>Después de editar un contrato, usá <strong>Sincronizar períodos</strong>; los que ya tengan actividad se preservan para evitar pérdida de información.</li><li>Confirmá manualmente cada nuevo importe cuando corresponda un ajuste contractual.</li><li>En alquileres temporales podés bonificar parte o toda la estadía, indicando el motivo y sin dejar un total inferior a lo ya cobrado.</li></Checklist>
      </GuideSection>

      <GuideSection number="4" id="cobros" title="Cobros y recibos" summary="Un cobro modifica el saldo, la liquidación y la cuenta corriente; verificá importe y período antes de confirmarlo.">
        <div className="row g-4"><div className="col-lg-6"><h3>Cobro administrado</h3><Checklist><li>Elegí la obligación y presioná <strong>Registrar pago</strong>.</li><li>Completá importe, fecha, medio y referencia.</li><li>El pago puede ser parcial.</li><li>El recibo se imprime en triplicado: locatario, locador e inmobiliaria.</li></Checklist></div><div className="col-lg-6"><h3>Operaciones externas</h3><Checklist><li>Usá <strong>Cancelación externa</strong> cuando la inmobiliaria no recibió el dinero.</li><li>Usá <strong>Facturado externamente</strong> cuando el comprobante fiscal se emitió fuera de ONO Prop.</li><li>Son registros distintos y no deben utilizarse para simular una cobranza.</li></Checklist></div></div>
      </GuideSection>

      <GuideSection number="5" id="locador" title="Liquidación y pago al locador" summary="La rendición diferencia el dinero cobrado, los honorarios y los gastos a cargo del locador.">
        <ol className="consortium-guide-numbered"><li><span>1</span><div><strong>Liquidar.</strong><p>Revisá cobros, honorarios y gastos descontables.</p></div></li><li><span>2</span><div><strong>Registrar el pago.</strong><p>Indicá fecha, medio y referencia; se genera el recibo por duplicado.</p></div></li><li><span>3</span><div><strong>Confirmar recepción.</strong><p>Registrá el medio de confirmación del locador para cerrar el circuito.</p></div></li></ol>
        <div className="consortium-guide-warning"><strong>Importante:</strong> “Pago registrado” indica que el dinero salió de la inmobiliaria. “Recepción confirmada” acredita que el locador informó o documentó su recepción.</div>
      </GuideSection>

      <GuideSection number="6" id="arca" title="Facturación ARCA" summary="La emisión real solo está disponible para perfiles fiscales verificados y expresamente habilitados.">
        <Checklist><li>Seleccioná el perfil emisor y prepará el borrador fiscal del período o estadía.</li><li>Revisá receptor, importe, concepto, fechas de servicio, vencimiento y numeración estimada.</li><li>La vista previa de Producción no solicita CAE: todavía permite detenerse y corregir.</li><li>Emití únicamente cuando los datos sean definitivos. Una factura real se corrige mediante el comprobante fiscal correspondiente, no editando su registro.</li><li>Las facturas y notas de crédito autorizadas pueden imprimirse, guardarse en PDF y enviarse por email o WhatsApp.</li></Checklist>
        <div className="consortium-guide-note"><strong>Emisión por delegación.</strong> Cada locador emisor debe delegar Facturación Electrónica y tener su punto de venta. Consultá la <Link to="/guias/delegacion-arca">guía de delegación ARCA</Link>.</div>
      </GuideSection>

      <GuideSection number="7" id="cuentas" title="Cuentas corrientes" summary="Las cuentas permiten explicar qué se cobró, qué se descontó y qué fondos faltan entregar.">
        <div className="consortium-guide-columns"><article><h3>Cuenta del contrato</h3><p>Reúne cobros, honorarios, gastos, liquidaciones y pagos vinculados al contrato.</p></article><article><h3>Cuenta del locador</h3><p>Consolida los movimientos de todos sus contratos sin mezclar monedas.</p></article><article><h3>Fondos pendientes</h3><p>La vista general identifica importes cobrados que todavía deben rendirse al locador.</p></article></div>
      </GuideSection>

      <GuideSection number="8" id="controles" title="Rectificaciones y archivo" summary="Los errores se corrigen con movimientos explicativos; no se elimina el historial.">
        <Checklist><li>Para un cobro equivocado, anulalo e indicá el motivo.</li><li>Si ya se registró la recepción del locador, rectificá primero la recepción y luego el pago, en orden inverso.</li><li>Si una emisión ARCA queda pendiente, reconciliá antes de volver a intentar.</li><li>Archivá los contratos finalizados: sus pagos, recibos y comprobantes se conservan.</li></Checklist>
      </GuideSection>

      <section className="consortium-guide-faq" id="preguntas"><p className="consortium-guide-kicker">Ayuda rápida</p><h2>Preguntas frecuentes</h2><details><summary>¿Por qué no aparece un inmueble o una persona?</summary><p>Verificá la inmobiliaria activa. El inmueble debe estar cargado y la persona activa con el rol correspondiente.</p></details><details><summary>¿Editar el contrato cambia todos los períodos?</summary><p>No necesariamente. Luego debés sincronizar; los períodos con movimientos se conservan para revisión.</p></details><details><summary>¿Puedo facturar un importe renegociado?</summary><p>El borrador fiscal permite ajustar importe y fechas para reflejar lo acordado. Documentá siempre el motivo de la excepción.</p></details><details><summary>¿Cómo corrijo una factura real?</summary><p>No la elimines ni la marques como externa. Prepará la nota de crédito que corresponda y consultá al responsable fiscal si existe alguna duda.</p></details></section>

      <section className="consortium-guide-help text-center mt-4"><h2>¿Necesitás acompañamiento?</h2><p>Podemos ayudarte a configurar el primer contrato y revisar su circuito de cobro y facturación.</p><a className="btn btn-primary" href="mailto:contacto@onoprop.com?subject=Ayuda%20con%20Administraci%C3%B3n%20de%20Alquileres">contacto@onoprop.com</a></section>
      <p className="consortium-guide-disclaimer text-center">Este manual describe el funcionamiento operativo de ONO Prop. La inmobiliaria y los responsables fiscales deben aplicar la normativa y las condiciones contractuales correspondientes.</p>
    </div>
  </main>
);

export default RentalAdministrationGuidePage;

