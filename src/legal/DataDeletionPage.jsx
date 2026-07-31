import { Link } from "react-router-dom";

import LegalPageLayout from "./LegalPageLayout";
import { LEGAL_PRIVACY_EMAIL } from "./legal.constants";

const DataDeletionPage = () => {
  return (
    <LegalPageLayout
      eyebrow="Eliminación de datos"
      title="Cómo eliminar tus datos de ONO Prop"
      description="Instrucciones para desconectar Instagram y solicitar la eliminación de datos personales o de integración almacenados por ONO Prop."
      canonicalPath="/eliminacion-de-datos"
      intro="Podés desconectar Instagram o solicitar la eliminación de información asociada a tu cuenta mediante cualquiera de las opciones que se describen a continuación."
    >
      <section>
        <h2>1. Desconectar Instagram desde ONO Prop</h2>
        <ol>
          <li>Iniciá sesión en ONO Prop.</li>
          <li>Abrí el inmueble y entrá en la sección de Difusión.</li>
          <li>Ubicá la cuenta de Instagram conectada.</li>
          <li>Seleccioná <strong>Desconectar</strong> y confirmá.</li>
        </ol>
        <p>
          Esta acción invalida el acceso de ONO Prop y elimina el token cifrado
          y la asociación activa con la cuenta profesional. No elimina
          publicaciones que ya hayan sido creadas en Instagram.
        </p>
      </section>

      <section>
        <h2>2. Revocar el acceso desde Meta</h2>
        <p>
          También podés quitar ONO Prop desde la configuración de aplicaciones y
          sitios web de tu cuenta de Instagram o Meta. Cuando Meta nos notifica
          la desautorización, eliminamos las credenciales de acceso almacenadas
          y marcamos la integración como desconectada.
        </p>
      </section>

      <section>
        <h2>3. Solicitar eliminación por correo</h2>
        <p>
          Escribí a{" "}
          <a
            href={`mailto:${LEGAL_PRIVACY_EMAIL}?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos%20-%20ONO%20Prop`}
          >
            {LEGAL_PRIVACY_EMAIL}
          </a>{" "}
          con el asunto <strong>“Solicitud de eliminación de datos”</strong>.
          Incluí:
        </p>
        <ul>
          <li>tu nombre y correo registrado;</li>
          <li>la inmobiliaria asociada, si corresponde;</li>
          <li>el nombre de usuario de Instagram, si la solicitud se refiere a esa integración;</li>
          <li>qué información querés eliminar.</li>
        </ul>
        <p>
          Podremos pedirte una verificación razonable de identidad antes de
          ejecutar la solicitud. Te informaremos cuando se complete o si existe
          una obligación legal que exija conservar temporalmente algún dato.
        </p>
      </section>

      <section>
        <h2>4. Solicitudes iniciadas desde Meta</h2>
        <p>
          ONO Prop dispone de una callback técnica para recibir solicitudes
          firmadas de eliminación enviadas por Meta. El proceso elimina la
          conexión de Instagram, sus credenciales cifradas y la asociación con
          el identificador de esa cuenta, y devuelve un código de confirmación
          y una URL para consultar el resultado.
        </p>
      </section>

      <section>
        <h2>5. Alcance de la eliminación</h2>
        <p>
          La eliminación de una integración no borra automáticamente una
          publicación ya visible en Instagram ni elimina toda la cuenta de
          ONO Prop. Para solicitar la eliminación integral de la cuenta y sus
          datos asociados, utilizá el canal de correo indicado arriba.
        </p>
        <p>
          Podemos conservar información mínima cuando sea necesaria para
          cumplir obligaciones legales, resolver disputas, prevenir fraude o
          acreditar una solicitud ya atendida. Finalizado ese plazo, se elimina
          o disocia.
        </p>
      </section>

      <div className="legal-callout">
        <strong>¿Sólo querés dejar de publicar en Instagram?</strong>
        <p>
          Desconectar la integración es suficiente. Podrás volver a conectarla
          más adelante mediante una nueva autorización.
        </p>
        <Link to="/privacidad">Consultar la Política de privacidad</Link>
      </div>
    </LegalPageLayout>
  );
};

export default DataDeletionPage;
