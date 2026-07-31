import LegalPageLayout from "./LegalPageLayout";
import {
  LEGAL_EMAIL,
  LEGAL_FISCAL_ADDRESS,
  LEGAL_OPERATOR,
  LEGAL_PHONE,
  LEGAL_TAX_ID,
  LEGAL_TRADE_NAME,
} from "./legal.constants";

const TermsPage = () => {
  return (
    <LegalPageLayout
      eyebrow="Condiciones del servicio"
      title="Términos de uso de ONO Prop"
      description="Condiciones aplicables al uso del portal y la plataforma inmobiliaria ONO Prop, incluidas sus integraciones de publicación."
      canonicalPath="/terminos"
      intro="Estas condiciones regulan el acceso y uso de ONO Prop por inmobiliarias, sus equipos, anunciantes y demás personas usuarias."
    >
      <section>
        <h2>1. Aceptación y responsable</h2>
        <p>
          {LEGAL_TRADE_NAME} es el nombre comercial de un emprendimiento
          personal operado por <strong>{LEGAL_OPERATOR}</strong>, CUIT{" "}
          {LEGAL_TAX_ID}, con domicilio fiscal en {LEGAL_FISCAL_ADDRESS}. El
          servicio se presta exclusivamente en línea mediante{" "}
          <a href="https://onoprop.com">onoprop.com</a>; no existe un local de
          atención al público y el domicilio informado no constituye un punto
          de atención presencial.
        </p>
        <p>
          Al registrarte, contratar un plan o utilizar sus funciones aceptás
          estas condiciones y la Política de privacidad. Si actuás por una
          inmobiliaria u organización, declarás contar con facultades
          suficientes para representarla.
        </p>
      </section>

      <section>
        <h2>2. Servicio</h2>
        <p>
          ONO Prop ofrece herramientas para cargar y administrar inmuebles,
          crear presencia web, recibir consultas, colaborar entre
          inmobiliarias y distribuir contenido hacia portales o redes sociales
          autorizadas. Las funciones disponibles dependen del plan contratado,
          el estado de la cuenta, la configuración y la disponibilidad de los
          proveedores externos.
        </p>
        <p>
          ONO Prop no es propietaria de los inmuebles publicados, no actúa como
          corredora en las operaciones informadas por terceros y no garantiza
          que una publicación produzca consultas, reservas, ventas o
          alquileres.
        </p>
      </section>

      <section>
        <h2>3. Registro y seguridad de la cuenta</h2>
        <p>
          Debés proporcionar información veraz, mantenerla actualizada y
          proteger tus medios de acceso. Sos responsable por las acciones
          realizadas desde tu cuenta y debés avisarnos sin demora si detectás
          un acceso no autorizado. Podemos exigir verificaciones adicionales
          para proteger a las personas usuarias y a la plataforma.
        </p>
      </section>

      <section>
        <h2>4. Planes y suscripciones</h2>
        <p>
          Las funciones habilitadas, límites, precio, periodicidad, impuestos,
          configuración inicial y condiciones de baja serán los informados en
          la propuesta o contratación correspondiente. La falta de pago puede
          ocasionar la suspensión de módulos o de la cuenta, sin perjuicio de
          las obligaciones pendientes.
        </p>
      </section>

      <section>
        <h2>5. Contenido y autorizaciones</h2>
        <p>
          Conservás los derechos sobre el contenido que incorporás. Otorgás a
          ONO Prop una autorización limitada, no exclusiva y revocable —salvo
          respecto de operaciones ya ejecutadas— para alojarlo, adaptarlo
          técnicamente, mostrarlo y enviarlo a los destinos que selecciones.
        </p>
        <p>Declarás y garantizás que:</p>
        <ul>
          <li>
            contás con autorización para ofrecer el inmueble y publicar su
            información;
          </li>
          <li>
            tenés los derechos o permisos necesarios sobre imágenes, videos,
            marcas y textos;
          </li>
          <li>
            los datos son veraces, suficientes y no inducen a error;
          </li>
          <li>
            el contenido cumple la normativa profesional, publicitaria, de
            defensa del consumidor y de protección de datos aplicable.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Instagram y servicios de terceros</h2>
        <p>
          Las integraciones funcionan mediante autorizaciones otorgadas
          directamente por la persona titular o administradora de cada cuenta.
          Sólo solicitaremos los permisos necesarios para las funciones
          habilitadas. Podés revocarlos desde ONO Prop o desde el proveedor.
        </p>
        <p>
          Al publicar en Instagram, Mercado Libre u otro servicio también
          aceptás sus términos, políticas, formatos, límites y decisiones de
          moderación. Esos proveedores pueden rechazar, limitar, modificar,
          pausar o eliminar publicaciones, cambiar sus API o interrumpir
          funciones. ONO Prop no controla esas decisiones y no garantiza la
          disponibilidad permanente de una integración externa.
        </p>
      </section>

      <section>
        <h2>7. Publicación en la cuenta central de ONO Prop</h2>
        <p>
          El envío de un inmueble a la cuenta o portal central de ONO Prop no
          implica aprobación automática. Podemos revisar, priorizar, rechazar,
          despublicar o solicitar correcciones por razones editoriales,
          comerciales, legales, de calidad o seguridad. Los destaques pagos se
          regirán además por las condiciones comerciales informadas al
          contratarlos.
        </p>
      </section>

      <section>
        <h2>8. Consultas y datos de terceros</h2>
        <p>
          Las consultas recibidas deben utilizarse exclusivamente para atender
          el interés inmobiliario expresado y conforme a la normativa de
          protección de datos. No está permitido vender contactos, enviar
          comunicaciones engañosas o utilizarlos para finalidades
          incompatibles sin una autorización válida.
        </p>
      </section>

      <section>
        <h2>9. Usos prohibidos</h2>
        <p>No podés utilizar ONO Prop para:</p>
        <ul>
          <li>publicar contenido ilícito, falso, discriminatorio o fraudulento;</li>
          <li>suplantar identidades o acceder a cuentas sin autorización;</li>
          <li>
            vulnerar derechos de propiedad intelectual, privacidad o imagen;
          </li>
          <li>
            eludir controles, interferir con la seguridad, extraer datos
            masivamente o introducir código dañino;
          </li>
          <li>
            incumplir las políticas de Meta, Mercado Libre u otros destinos
            conectados.
          </li>
        </ul>
      </section>

      <section>
        <h2>10. Propiedad intelectual</h2>
        <p>
          La plataforma, su software, diseño, documentación, marcas y elementos
          propios pertenecen a ONO Prop o a sus licenciantes. El acceso al
          servicio no transfiere derechos de propiedad ni autoriza su copia,
          ingeniería inversa o explotación fuera de lo permitido por estas
          condiciones.
        </p>
      </section>

      <section>
        <h2>11. Disponibilidad, suspensión y baja</h2>
        <p>
          Podemos realizar mantenimiento, introducir mejoras o suspender
          temporalmente funciones. También podemos restringir una cuenta ante
          incumplimientos, riesgos de seguridad, requerimientos legales o uso
          que perjudique a terceros. Cuando sea razonable, informaremos la causa
          y ofreceremos un canal de revisión.
        </p>
        <p>
          Podés solicitar la baja de tu cuenta o desconectar una integración.
          La baja no elimina obligaciones económicas vencidas ni información
          que deba conservarse legalmente. El tratamiento posterior se rige por
          la Política de privacidad.
        </p>
      </section>

      <section>
        <h2>12. Responsabilidad</h2>
        <p>
          ONO Prop presta una herramienta tecnológica. Dentro de los límites
          permitidos por la ley, no responde por la exactitud del contenido
          cargado por terceros, negociaciones entre personas usuarias,
          decisiones de proveedores externos ni pérdidas causadas por usos no
          autorizados atribuibles a la persona usuaria.
        </p>
        <p>
          Nada de estas condiciones excluye responsabilidades que no puedan
          limitarse legalmente ni afecta derechos inderogables que pudieran
          corresponder.
        </p>
      </section>

      <section>
        <h2>13. Cambios, ley aplicable y contacto</h2>
        <p>
          Podemos actualizar estas condiciones cuando cambien el servicio, las
          integraciones o la normativa. Las modificaciones relevantes serán
          informadas por medios razonables. Se aplican las leyes de la
          República Argentina y se respetará la jurisdicción inderogable que
          corresponda en cada caso.
        </p>
        <p>
          Consultas legales o contractuales:{" "}
          <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a> o{" "}
          <a href={`tel:${LEGAL_PHONE.replace(/\s/g, "")}`}>{LEGAL_PHONE}</a>.
        </p>
      </section>
    </LegalPageLayout>
  );
};

export default TermsPage;
