import { Link } from "react-router-dom";

import SEO from "../components/SEO";
import GuideCommercialOverview from "./GuideCommercialOverview";
import "./consortiumGuide.css";
import "./propertyGuide.css";

const appraisalsGuideJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "Tasaciones inmobiliarias con ONO Prop",
  description: "Beneficios y guía operativa para documentar evidencia, aplicar métodos de valuación y emitir informes trazables.",
  author: { "@type": "Organization", name: "ONO Prop", url: "https://onoprop.com" },
  about: { "@type": "SoftwareApplication", name: "Tasaciones ONO Prop", applicationCategory: "BusinessApplication" },
};

const workflow = [
  ["1", "Encargo", "Definí cliente, finalidad, alcance, documentación y profesional responsable."],
  ["2", "Inspección", "Registrá ubicación, entorno, parcela, servicios, zonificación y evidencia de la visita."],
  ["3", "Características", "Completá tipología, superficies, terreno, antigüedad, estado y demás atributos relevantes."],
  ["4", "Valuación", "Documentá antecedentes y aplicá el método comparativo, el costo separativo o ambos."],
  ["5", "Informe", "Reconciliá resultados, revisá, emití una versión inmutable y entregala al cliente."],
];

const GuideSection = ({ number, id, title, summary, children }) => (
  <section className="consortium-guide-section" id={id}>
    <header>
      <span aria-hidden="true">{number}</span>
      <div><h2>{title}</h2><p>{summary}</p></div>
    </header>
    <div className="consortium-guide-section-body">{children}</div>
  </section>
);

const Checklist = ({ children }) => <ul className="consortium-guide-checklist">{children}</ul>;

const AppraisalsGuidePage = () => (
  <main className="consortium-guide-page property-guide-page">
    <SEO
      title="Manual de Tasaciones Inmobiliarias | ONO Prop"
      description="Conocé cómo ONO Prop organiza antecedentes, cálculos, revisión profesional, emisión y verificación de informes de tasación."
      url="https://onoprop.com/guias/tasaciones"
      jsonLd={appraisalsGuideJsonLd}
    />

    <section className="consortium-guide-hero property-guide-hero">
      <div className="container py-5 py-lg-6">
        <p className="consortium-guide-eyebrow">ONO Prop · Manual operativo</p>
        <h1>Tasaciones inmobiliarias, paso a paso</h1>
        <p className="consortium-guide-lead">Convertí datos, inspecciones y antecedentes comparables en un expediente ordenado, revisable y verificable.</p>
        <p className="consortium-guide-version">Actualizado en octubre de 2026</p>
        <div className="d-flex flex-wrap gap-2 mt-4">
          <Link className="btn btn-light btn-lg" to="/admin/tasaciones">Abrir Tasaciones</Link>
          <Link className="btn btn-outline-light btn-lg" to="/guias">Ver todas las guías</Link>
        </div>
      </div>
    </section>

    <div className="container consortium-guide-content py-5">
      <GuideCommercialOverview
        audience="Inmobiliarias, corredores y profesionales que intervienen en valuaciones"
        title="Más evidencia, consistencia y trazabilidad en cada informe"
        description="ONO Prop reúne el inmueble, la inspección, los antecedentes, los métodos de cálculo y la revisión profesional en un mismo expediente. El sistema acompaña el análisis sin reemplazar el criterio ni la responsabilidad del profesional firmante."
        benefits={[
          { title: "Datos reutilizables", text: "Importá una propiedad ya cargada o creá un borrador publicable desde la tasación." },
          { title: "Métodos documentados", text: "Conservá fuentes, ajustes, muestras y resultados para revisar cómo se obtuvo el valor." },
          { title: "Informe verificable", text: "Emití versiones inmutables, rectificá sin borrar antecedentes y compartí un código público de vigencia." },
        ]}
        primaryAction={{ to: "/software-para-inmobiliarias#solicitar-demo", label: "Solicitar demostración" }}
        secondaryAction={{ to: "/planes#catalogo-planes", label: "Consultar planes" }}
      />

      <aside className="consortium-guide-principle mb-4" id="manual-operativo">
        <span aria-hidden="true">✓</span>
        <div>
          <h2>La herramienta asiste; el profesional decide</h2>
          <p className="mb-0">Los cálculos, coeficientes y controles ayudan a trabajar con un criterio consistente. La inspección, la calidad de la evidencia, la selección de métodos, el valor adoptado y la firma siguen bajo responsabilidad del profesional competente.</p>
        </div>
      </aside>

      <nav className="consortium-guide-index mb-4" aria-label="Índice del manual">
        <strong>Ir directamente a</strong>
        <div>
          <a href="#inicio">Inicio</a><a href="#inspeccion">Inspección</a><a href="#caracteristicas">Características</a>
          <a href="#metodos">Evidencia y métodos</a><a href="#informe">Informe</a><a href="#seguimiento">Seguimiento</a>
          <a href="#preguntas">Preguntas frecuentes</a>
        </div>
      </nav>

      <section className="consortium-guide-workflow mb-4">
        <p className="consortium-guide-kicker">Vista rápida</p>
        <h2>El circuito de una tasación</h2>
        <div>{workflow.map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <GuideSection number="1" id="inicio" title="Crear el expediente" summary="Definí desde el comienzo qué se valúa, para quién y con qué finalidad.">
        <Checklist>
          <li>Ingresá cliente, titular, finalidad, tipo de informe y moneda.</li>
          <li>Identificá al profesional responsable y completá los datos legales disponibles.</li>
          <li>Seleccioná una propiedad ya cargada para heredar información, esté publicada o no.</li>
          <li>Si la propiedad todavía no existe, elegí crear un borrador no publicado a partir de la tasación.</li>
          <li>Guardá el borrador antes de salir: podés retomar el trabajo desde el listado.</li>
        </Checklist>
      </GuideSection>

      <GuideSection number="2" id="inspeccion" title="Documentar inspección y entorno" summary="La fecha, modalidad y evidencia de la inspección condicionan el alcance del informe.">
        <Checklist>
          <li>Indicá si la inspección fue presencial, remota o no realizada y explicá cualquier limitación.</li>
          <li>Confirmá dirección y geolocalización en el mapa.</li>
          <li>Cuando el servicio esté habilitado, seleccioná la parcela para completar datos disponibles sin sobrescribir los ya revisados.</li>
          <li>Registrá zonificación, servicios, infraestructura y características del entorno.</li>
          <li>Revisá las fotografías asociadas antes de generar el informe.</li>
        </Checklist>
        <div className="consortium-guide-note"><strong>Importante.</strong> Los datos parcelarios o urbanos provenientes de terceros deben verificarse antes de incorporarlos como conclusión profesional.</div>
      </GuideSection>

      <GuideSection number="3" id="caracteristicas" title="Describir el inmueble sujeto" summary="Separá correctamente superficies construidas, descubiertas y de terreno.">
        <Checklist>
          <li>Definí tipología, disposición, piso, orientación, antigüedad y estado de conservación.</li>
          <li>Cargá superficie cubierta, semicubierta, balcón o terraza, descubierta y terreno.</li>
          <li>En lotes, indicá frente, fondo, posición —medianero, esquina u otra—, forma y demás condicionantes.</li>
          <li>Documentá mejoras, remodelaciones, patologías y cualquier factor que afecte el valor.</li>
          <li>Corregí los datos heredados de la propiedad cuando la inspección aporte información más precisa.</li>
        </Checklist>
      </GuideSection>

      <GuideSection number="4" id="metodos" title="Cargar evidencia y aplicar métodos" summary="Cada antecedente y cada ajuste deben poder explicarse y revisarse.">
        <div className="row g-4">
          <div className="col-lg-6">
            <h3>Método comparativo directo</h3>
            <Checklist>
              <li>Cargá al menos 3 antecedentes válidos; la muestra recomendada es de 5.</li>
              <li>Podés incorporar antecedentes manualmente o seleccionarlos desde el mapa.</li>
              <li>Confirmá fuente, fecha, moneda, precio, superficies y confiabilidad.</li>
              <li>Justificá negociación, ubicación, estado y demás coeficientes aplicados.</li>
              <li>Revisá promedio, mediana, ponderación y dispersión antes de adoptar un resultado.</li>
            </Checklist>
          </div>
          <div className="col-lg-6">
            <h3>Método del costo separativo</h3>
            <Checklist>
              <li>Valuá el suelo y las mejoras por separado.</li>
              <li>Documentá el valor unitario del terreno y sus factores de ajuste.</li>
              <li>Indicá costo de reposición, vida útil, conservación y depreciaciones.</li>
              <li>Elegí el escenario de conservar, remodelar o demoler y cargá sus costos.</li>
              <li>Usá ambos métodos cuando la evidencia permita una reconciliación más sólida.</li>
            </Checklist>
          </div>
        </div>
      </GuideSection>

      <GuideSection number="5" id="informe" title="Reconciliar y preparar el informe" summary="El valor adoptado no es una copia automática: debe surgir de una conclusión fundada.">
        <Checklist>
          <li>Compará los resultados y cargá el valor de mercado finalmente adoptado.</li>
          <li>Explicá diferencias, supuestos, fuentes, limitaciones y vigencia de la conclusión.</li>
          <li>En escenarios de garantía, revisá el coeficiente de realización y los parámetros configurados.</li>
          <li>Abrí el informe para controlar textos, tablas, mapas, fotografías y anexos.</li>
          <li>Usá <strong>Imprimir / guardar PDF</strong> solo después de completar la revisión.</li>
        </Checklist>
      </GuideSection>

      <GuideSection number="6" id="seguimiento" title="Revisar, emitir y entregar" summary="Los estados conservan la trazabilidad del expediente y protegen la versión entregada.">
        <ol className="consortium-guide-numbered">
          <li><span>1</span><div><strong>Revisión.</strong><p>Pasá el borrador a revisión y registrá observaciones o aprobación.</p></div></li>
          <li><span>2</span><div><strong>Emisión.</strong><p>Confirmá la revisión y firma profesional. La versión emitida queda inmutable.</p></div></li>
          <li><span>3</span><div><strong>Entrega.</strong><p>Registrá destinatario y entrega. El código público permite comprobar vigencia sin revelar cliente, domicilio exacto ni valor.</p></div></li>
          <li><span>4</span><div><strong>Rectificación.</strong><p>Si necesitás corregir un informe emitido, creá una nueva versión vinculada en lugar de modificar el original.</p></div></li>
        </ol>
      </GuideSection>

      <section className="consortium-guide-faq" id="preguntas">
        <p className="consortium-guide-kicker">Ayuda rápida</p><h2>Preguntas frecuentes</h2>
        <details><summary>¿El sistema realiza una tasación profesional automáticamente?</summary><p>No. Calcula, ordena y documenta información, pero el valor adoptado y la firma requieren revisión y criterio profesional.</p></details>
        <details><summary>¿Puedo tasar una propiedad que todavía no está cargada?</summary><p>Sí. Al guardar podés crear un borrador privado de la propiedad para completarlo y publicarlo más adelante.</p></details>
        <details><summary>¿Los antecedentes deben estar cargados en ONO Prop?</summary><p>No necesariamente. Pueden ingresarse manualmente o seleccionarse desde las fuentes disponibles en el mapa, conservando sus datos y evidencia.</p></details>
        <details><summary>¿Puedo corregir un informe ya emitido?</summary><p>No se modifica la versión emitida. Debés crear una rectificación vinculada para preservar la trazabilidad.</p></details>
      </section>

      <section className="consortium-guide-help text-center mt-4"><h2>¿Querés profesionalizar el circuito de tasaciones?</h2><p>Coordinemos una demostración desde la carga del inmueble hasta la emisión y verificación del informe.</p><div className="d-flex flex-wrap justify-content-center gap-2"><Link className="btn btn-primary" to="/software-para-inmobiliarias#solicitar-demo">Solicitar demostración</Link><a className="btn btn-outline-primary" href="mailto:contacto@onoprop.com?subject=M%C3%B3dulo%20Tasaciones">contacto@onoprop.com</a></div></section>
      <p className="consortium-guide-disclaimer text-center">ONO Prop no reemplaza la inspección, matrícula, incumbencia ni responsabilidad profesional exigible en cada caso.</p>
    </div>
  </main>
);

export default AppraisalsGuidePage;
