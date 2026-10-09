import { Link } from "react-router-dom";

import SEO from "../components/SEO";
import GuideCommercialOverview from "./GuideCommercialOverview";
import "./consortiumGuide.css";
import "./propertyGuide.css";

const propertyGuideJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "Administración de inmuebles con ONO Prop",
  description: "Beneficios y guía operativa para organizar, publicar y difundir propiedades desde una ficha reutilizable.",
  author: { "@type": "Organization", name: "ONO Prop", url: "https://onoprop.com" },
  about: { "@type": "SoftwareApplication", name: "Administración de Inmuebles ONO Prop", applicationCategory: "BusinessApplication" },
};

const workflow = [
  ["1", "Cargar", "Creá la ficha manualmente o importá propiedades desde un archivo CSV."],
  ["2", "Completar", "Revisá ubicación, características, precio, descripción, imágenes y videos."],
  ["3", "Controlar", "Usá el listado para detectar datos faltantes y mantener actualizado el inventario."],
  ["4", "Publicar", "Decidí qué propiedades se muestran en el portal y cuáles permanecen privadas."],
  ["5", "Difundir", "Prepará contenido, integraciones y canales comerciales desde la misma ficha."],
  ["6", "Administrar", "Si existe una locación, iniciá su contrato sin volver a cargar la propiedad."],
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

const PropertyManagementGuidePage = () => (
  <main className="consortium-guide-page property-guide-page">
    <SEO
      title="Manual de Administración de Inmuebles | ONO Prop"
      description="Conocé cómo ONO Prop organiza el inventario y reutiliza cada ficha en publicaciones, difusión, tasaciones y alquileres."
      url="https://onoprop.com/guias/administracion-inmuebles"
      jsonLd={propertyGuideJsonLd}
    />

    <section className="consortium-guide-hero property-guide-hero">
      <div className="container py-5 py-lg-6">
        <p className="consortium-guide-eyebrow">ONO Prop · Manual operativo</p>
        <h1>Administración de inmuebles, paso a paso</h1>
        <p className="consortium-guide-lead">Cargá la información una vez, mantené ordenado el inventario y reutilizá cada ficha para publicar, difundir y administrar.</p>
        <p className="consortium-guide-version">Actualizado en octubre de 2026</p>
        <div className="d-flex flex-wrap gap-2 mt-4">
          <Link className="btn btn-light btn-lg" to="/admin/inmuebles/listado">Abrir Administración de inmuebles</Link>
          <Link className="btn btn-outline-light btn-lg" to="/guias">Ver todas las guías</Link>
        </div>
      </div>
    </section>

    <div className="container consortium-guide-content py-5">
      <GuideCommercialOverview
        audience="Inmobiliarias, sucursales y equipos comerciales"
        title="Una base única para trabajar y publicar mejor"
        description="Cada propiedad conserva sus datos, multimedia y estado comercial. Desde esa ficha el equipo puede revisar calidad, publicar, compartir, preparar difusión e iniciar una administración de alquiler."
        benefits={[
          { title: "Carga reutilizable", text: "Evitá repetir información entre publicaciones, contratos y acciones comerciales." },
          { title: "Inventario ordenado", text: "Filtrá, duplicá, exportá y detectá datos faltantes antes de publicar." },
          { title: "Mayor alcance", text: "Compartí con la red, inmobiliarias amigas e integraciones habilitadas." },
        ]}
        primaryAction={{ to: "/software-para-inmobiliarias#solicitar-demo", label: "Solicitar demostración" }}
        secondaryAction={{ to: "/planes#catalogo-planes", label: "Consultar planes" }}
      />

      <aside className="consortium-guide-principle mb-4" id="manual-operativo">
        <span aria-hidden="true">✓</span>
        <div>
          <h2>Una distinción importante</h2>
          <p className="mb-0">
            <strong>Administración de inmuebles</strong> conserva la ficha técnica y comercial.
            <strong> Administración de alquileres</strong> conserva contratos, personas, obligaciones,
            cobros, liquidaciones y comprobantes. Una propiedad puede existir sin estar publicada y
            sin tener un contrato.
          </p>
        </div>
      </aside>

      <nav className="consortium-guide-index mb-4" aria-label="Índice del manual">
        <strong>Ir directamente a</strong>
        <div>
          <a href="#alta">Alta</a><a href="#ficha">Ficha</a><a href="#publicacion">Publicación</a>
          <a href="#difusion">Difusión</a><a href="#inventario">Inventario</a>
          <a href="#alquileres">Alquileres</a><a href="#preguntas">Preguntas frecuentes</a>
        </div>
      </nav>

      <section className="consortium-guide-workflow mb-4">
        <p className="consortium-guide-kicker">Vista rápida</p>
        <h2>El circuito de una propiedad</h2>
        <div>{workflow.map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <GuideSection number="1" id="alta" title="Crear o importar propiedades" summary="Elegí la forma de carga que mejor se adapte al volumen y a la información disponible.">
        <div className="consortium-guide-columns">
          <article><h3>Carga individual</h3><p>Usá <strong>Nueva propiedad</strong> para completar una ficha desde cero. Podés guardarla sin publicarla mientras reunís la información.</p></article>
          <article><h3>Importación CSV</h3><p>Usá la importación masiva para incorporar varias propiedades. Revisá la validación de cada fila y completá luego imágenes o datos faltantes.</p></article>
          <article><h3>Duplicar</h3><p>Si dos unidades comparten características, duplicá la ficha como borrador y modificá dirección, precio, unidad y demás diferencias antes de publicar.</p></article>
        </div>
      </GuideSection>

      <GuideSection number="2" id="ficha" title="Completar la ficha" summary="La calidad de la publicación y de los demás módulos depende de una ficha consistente.">
        <Checklist>
          <li>Confirmá tipo de propiedad, operación, ubicación y dirección.</li>
          <li>Revisá superficies, ambientes, dormitorios, baños, cocheras y demás características.</li>
          <li>Cargá precio, moneda, título y una descripción clara sin promesas que no puedan verificarse.</li>
          <li>Ordená imágenes y videos; verificá que representen la propiedad correcta.</li>
          <li>Si la ubicación pública debe ser aproximada, configurala de ese modo antes de publicar.</li>
        </Checklist>
        <div className="consortium-guide-note"><strong>Asistencia con IA.</strong> Las sugerencias ayudan a redactar y completar contenido, pero la persona que publica debe revisar datos, medidas, precio y afirmaciones antes de guardar.</div>
      </GuideSection>

      <GuideSection number="3" id="publicacion" title="Separar ficha y publicación" summary="Guardar una propiedad no obliga a mostrarla en el portal.">
        <div className="row g-4">
          <div className="col-lg-6"><h3>Propiedad privada o en preparación</h3><Checklist><li>Mantenela sin publicar mientras falten datos o autorización.</li><li>Puede utilizarse igualmente para iniciar un contrato de alquiler.</li><li>La ficha continúa disponible para el equipo autorizado.</li></Checklist></div>
          <div className="col-lg-6"><h3>Propiedad publicada</h3><Checklist><li>Revisá la vista previa antes de publicar.</li><li>Controlá los avisos de calidad del listado.</li><li>Cuando deje de ofrecerse, actualizá su estado o despublicala sin borrar el antecedente.</li></Checklist></div>
        </div>
      </GuideSection>

      <GuideSection number="4" id="difusion" title="Compartir y difundir" summary="La ficha concentra las acciones comerciales disponibles para cada propiedad.">
        <Checklist>
          <li>Usá <strong>Marketing</strong> para preparar piezas y textos promocionales.</li>
          <li>Usá <strong>Difusión</strong> para revisar las integraciones habilitadas para la inmobiliaria.</li>
          <li>Definí si la propiedad se comparte con la red ONO Prop o con grupos de inmobiliarias amigas.</li>
          <li>Revisá el rendimiento para comparar visitas, favoritos y contactos.</li>
          <li>Las publicaciones compartidas conservan las reglas y permisos de la inmobiliaria que las administra.</li>
        </Checklist>
      </GuideSection>

      <GuideSection number="5" id="inventario" title="Ordenar y controlar el inventario" summary="El listado es el centro operativo para mantener información confiable.">
        <Checklist>
          <li>Filtrá y ordená por precio, fecha de carga o última modificación.</li>
          <li>Usá los indicadores de calidad para encontrar fichas incompletas.</li>
          <li>Exportá el listado cuando necesites controlarlo o compartirlo fuera del sistema.</li>
          <li>Duplicá solo cuando corresponda: cada ficha debe representar una propiedad o unidad identificable.</li>
          <li>No elimines una ficha solo porque finalizó una operación; actualizá su estado para conservar el historial.</li>
        </Checklist>
      </GuideSection>

      <GuideSection number="6" id="alquileres" title="Vincular con Administración de alquileres" summary="El contrato toma la propiedad seleccionada y evita duplicar su información básica.">
        <ol className="consortium-guide-numbered">
          <li><span>1</span><div><strong>Abrí la propiedad.</strong><p>Desde el listado elegí <strong>Crear contrato</strong>.</p></div></li>
          <li><span>2</span><div><strong>Confirmá la ficha.</strong><p>El formulario de alquiler mostrará la propiedad ya seleccionada.</p></div></li>
          <li><span>3</span><div><strong>Completá el contrato.</strong><p>Agregá partes, modalidad, vigencia, importes, ajustes y honorarios.</p></div></li>
        </ol>
        <div className="consortium-guide-warning"><strong>No son el mismo módulo:</strong> editar la publicación no reemplaza la edición del contrato, y modificar el contrato no publica ni despublica la propiedad.</div>
      </GuideSection>

      <section className="consortium-guide-faq" id="preguntas">
        <p className="consortium-guide-kicker">Ayuda rápida</p><h2>Preguntas frecuentes</h2>
        <details><summary>¿Puedo administrar una propiedad sin publicarla?</summary><p>Sí. La ficha puede mantenerse privada y utilizarse en alquileres u otros circuitos internos.</p></details>
        <details><summary>¿Publicar crea automáticamente un contrato?</summary><p>No. La publicación es comercial. El contrato se crea expresamente en Administración de alquileres.</p></details>
        <details><summary>¿Qué pasa si corrijo la dirección o el título?</summary><p>La ficha queda actualizada. Los contratos conservan además una referencia histórica propia, por lo que conviene revisar ambos circuitos cuando el cambio sea relevante.</p></details>
        <details><summary>¿Debo borrar una propiedad vendida o alquilada?</summary><p>No. Actualizá su estado o despublicala para conservar el antecedente y sus métricas.</p></details>
      </section>

      <section className="consortium-guide-help text-center mt-4"><h2>¿Querés ordenar y potenciar tu inventario?</h2><p>Coordinemos una demostración con una carga individual, una importación CSV y el circuito de publicación.</p><div className="d-flex flex-wrap justify-content-center gap-2"><Link className="btn btn-primary" to="/software-para-inmobiliarias#solicitar-demo">Solicitar demostración</Link><a className="btn btn-outline-primary" href="mailto:contacto@onoprop.com?subject=Gesti%C3%B3n%20de%20Propiedades">contacto@onoprop.com</a></div></section>
      <p className="consortium-guide-disclaimer text-center">La inmobiliaria es responsable de revisar la exactitud, autorización y vigencia de la información publicada.</p>
    </div>
  </main>
);

export default PropertyManagementGuidePage;
