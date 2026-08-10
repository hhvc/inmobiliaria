import LegalPageLayout from "./LegalPageLayout";
import {
  LEGAL_COUNTRY,
  LEGAL_FISCAL_ADDRESS,
  LEGAL_OPERATOR,
  LEGAL_PRIVACY_EMAIL,
  LEGAL_TAX_ID,
  LEGAL_TRADE_NAME,
} from "./legal.constants";

const PrivacyPolicyPage = () => {
  return (
    <LegalPageLayout
      eyebrow="Política de privacidad"
      title="Cómo tratamos y protegemos tus datos"
      description="Política de privacidad de ONO Prop: datos tratados, finalidades, integraciones, conservación y derechos de las personas usuarias."
      canonicalPath="/privacidad"
      intro="Esta política explica qué información trata ONO Prop al prestar su plataforma inmobiliaria y sus integraciones, para qué la utiliza y cómo podés ejercer tus derechos."
    >
      <section>
        <h2>1. Responsable y alcance</h2>
        <p>
          El responsable de la plataforma y del tratamiento de datos es{" "}
          <strong>{LEGAL_OPERATOR}</strong>, CUIT {LEGAL_TAX_ID}, con domicilio
          fiscal en {LEGAL_FISCAL_ADDRESS}.
        </p>
        <p>
          {LEGAL_TRADE_NAME} opera exclusivamente en línea a través de{" "}
          <a href="https://onoprop.com">onoprop.com</a> y no cuenta con un
          local de atención al público. El domicilio indicado es fiscal y legal;
          no constituye un punto de atención presencial.
        </p>
        <p>
          Podés realizar consultas sobre privacidad o ejercer tus derechos
          desde {LEGAL_COUNTRY} escribiendo a{" "}
          <a href={`mailto:${LEGAL_PRIVACY_EMAIL}`}>{LEGAL_PRIVACY_EMAIL}</a>.
        </p>
        <p>
          Esta política se aplica al portal onoprop.com, sus paneles para
          inmobiliarias y las funciones de publicación, consultas e
          integraciones con servicios externos. Cada inmobiliaria también es
          responsable por los datos que incorpora y utiliza en su actividad
          profesional y debe contar con las autorizaciones que correspondan.
        </p>
      </section>

      <section>
        <h2>2. Información que podemos tratar</h2>
        <p>Según las funciones que utilices, podemos tratar:</p>
        <ul>
          <li>
            <strong>Datos de cuenta y organización:</strong> nombre, correo,
            teléfono, identificador de usuario, rol, inmobiliaria asociada,
            estado de suscripción y preferencias operativas.
          </li>
          <li>
            <strong>Datos inmobiliarios:</strong> características, ubicación,
            imágenes, videos, textos, precios, documentación, estado y
            referencias de inmuebles y publicaciones.
          </li>
          <li>
            <strong>Consultas y contactos:</strong> nombre, correo, teléfono,
            mensaje, inmueble o servicio consultado, tamaño aproximado de la
            operación, código promocional, origen, campaña, fecha y seguimiento
            de la interacción.
          </li>
          <li>
            <strong>Datos de integraciones:</strong> identificadores de cuenta,
            nombre de usuario, tipo de cuenta, permisos concedidos, estado de
            conexión, vencimientos, identificadores de publicaciones,
            resultados y errores informados por el proveedor.
          </li>
          <li>
            <strong>Datos técnicos y de seguridad:</strong> registros de acceso
            y operación, dirección IP, navegador, dispositivo, eventos de
            autenticación y datos necesarios para prevenir fraude, abuso o
            accesos no autorizados.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Datos de Instagram y otras integraciones</h2>
        <p>
          Cuando conectás una cuenta profesional de Instagram, ONO Prop recibe
          únicamente los datos y permisos que autorizás en la pantalla de Meta.
          Para publicar contenido podemos tratar el identificador y nombre de
          la cuenta, el tipo de cuenta, los permisos otorgados, el token de
          acceso cifrado, su vencimiento y los identificadores o enlaces de las
          publicaciones realizadas.
        </p>
        <p>
          ONO Prop no recibe ni almacena tu contraseña de Instagram. Podés
          revocar el acceso desde ONO Prop o desde la configuración de Meta. Los
          permisos para mensajes, comentarios, métricas o publicidad sólo serán
          solicitados si una función visible de la plataforma los necesita y
          después de informarte su finalidad.
        </p>
        <p>
          Mercado Libre, Meta, Google y otros servicios integrados operan bajo
          sus propios términos y políticas de privacidad. La conexión es
          voluntaria y podés desconectarla cuando quieras.
        </p>
      </section>

      <section>
        <h2>4. Finalidades</h2>
        <p>Utilizamos la información para:</p>
        <ul>
          <li>crear y administrar cuentas, permisos y suscripciones;</li>
          <li>publicar y mostrar inmuebles en el portal y destinos autorizados;</li>
          <li>gestionar consultas, solicitudes, derivaciones y seguimiento;</li>
          <li>
            conectar, mantener y desconectar integraciones solicitadas por la
            persona usuaria;
          </li>
          <li>
            brindar soporte, registrar operaciones y comunicar cambios
            relevantes del servicio;
          </li>
          <li>
            proteger la plataforma, detectar usos indebidos y cumplir
            obligaciones legales.
          </li>
        </ul>
        <p>
          El tratamiento se basa, según corresponda, en tu consentimiento, en
          la relación contractual o precontractual, en el cumplimiento de
          obligaciones legales y en la necesidad de proteger la seguridad e
          integridad del servicio.
        </p>
      </section>

      <section>
        <h2>5. Destinatarios y proveedores</h2>
        <p>
          No vendemos datos personales. Podemos comunicarlos en la medida
          necesaria a:
        </p>
        <ul>
          <li>
            la inmobiliaria destinataria de una consulta o responsable de una
            publicación;
          </li>
          <li>
            proveedores de infraestructura, autenticación, almacenamiento,
            correo, seguridad y soporte;
          </li>
          <li>
            Meta/Instagram, Mercado Libre u otra plataforma elegida para
            ejecutar una publicación o integración;
          </li>
          <li>
            autoridades competentes cuando exista una obligación legal o
            requerimiento válido.
          </li>
        </ul>
        <p>
          Algunos proveedores pueden procesar información fuera de Argentina.
          En esos casos procuramos limitar los datos a lo necesario y utilizar
          proveedores con medidas contractuales y de seguridad adecuadas al
          servicio prestado.
        </p>
      </section>

      <section>
        <h2>6. Conservación</h2>
        <p>
          Conservamos la información mientras la cuenta o relación comercial
          permanezca activa y durante el tiempo necesario para prestar el
          servicio, resolver incidencias, proteger derechos y cumplir
          obligaciones legales. Los tokens de una integración se eliminan o
          inutilizan al desconectarla. Los estados temporales de autorización y
          las constancias técnicas de eliminación tienen vencimientos
          limitados.
        </p>
        <p>
          Una solicitud de eliminación de datos de Instagram elimina la
          conexión, sus credenciales cifradas y la asociación con esa cuenta.
          Ciertos registros de una publicación ya realizada o información que
          deba conservarse por una obligación legal pueden mantenerse de forma
          limitada, minimizada o disociada.
        </p>
      </section>

      <section>
        <h2>7. Seguridad</h2>
        <p>
          Aplicamos controles de acceso por rol, validaciones en el servidor,
          cifrado de credenciales de integración, conexiones HTTPS, separación
          de datos privados y registros de operación. Ningún sistema es
          infalible; si detectamos un incidente actuaremos para contenerlo,
          investigarlo y realizar las comunicaciones exigibles.
        </p>
      </section>

      <section>
        <h2>8. Tus derechos</h2>
        <p>
          Podés solicitar información, acceso, actualización, rectificación,
          supresión o retiro de tu consentimiento escribiendo a{" "}
          <a
            href={`mailto:${LEGAL_PRIVACY_EMAIL}?subject=Privacidad%20-%20ONO%20Prop`}
          >
            {LEGAL_PRIVACY_EMAIL}
          </a>
          . Para protegerte podremos pedirte datos razonables para acreditar tu
          identidad y la cuenta involucrada.
        </p>
        <p>
          En Argentina, el derecho de acceso puede ejercerse gratuitamente en
          los términos de la Ley 25.326. Las solicitudes de acceso deben ser
          respondidas dentro de diez días corridos y las de rectificación,
          actualización o supresión dentro de cinco días hábiles, salvo que
          exista una excepción legal aplicable.
        </p>
        <p>
          La Agencia de Acceso a la Información Pública, órgano de control de la
          Ley 25.326, recibe denuncias y reclamos relacionados con el
          incumplimiento de las normas de protección de datos personales.
        </p>
      </section>

      <section>
        <h2>9. Menores de edad</h2>
        <p>
          ONO Prop es una plataforma profesional y comercial que no está
          dirigida a menores de edad. Si advertimos que recibimos datos de un
          menor sin autorización válida, adoptaremos medidas razonables para
          eliminarlos.
        </p>
      </section>

      <section>
        <h2>10. Cambios y contacto</h2>
        <p>
          Podemos actualizar esta política para reflejar cambios del servicio,
          de las integraciones o de la normativa. Publicaremos la fecha de
          vigencia y, cuando corresponda, comunicaremos los cambios relevantes.
        </p>
        <p>
          Para cualquier consulta:{" "}
          <a href={`mailto:${LEGAL_PRIVACY_EMAIL}`}>
            {LEGAL_PRIVACY_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
};

export default PrivacyPolicyPage;
