import LegalLayout from "@/components/LegalLayout";

const PrivacyPage = () => {
  return (
    <LegalLayout
      title="Política de Privacidad"
      subtitle="Protección de datos personales en la plataforma de alquiler de vehículos"
    >
      <p>
        La presente Política de Privacidad establece los términos y condiciones bajo
        los cuales <strong>RuedaVe C.A.</strong> recopila, almacena, usa, transmite y
        protege los datos personales de sus usuarios, en cumplimiento de la{" "}
        <strong>Ley Orgánica de Protección de Datos Personales (LOPDP)</strong> y su
        Reglamento, así como de la normativa aplicable en la República Bolivariana
        de Venezuela.
      </p>
      <p>
        Su aceptación es obligatoria y condición indispensable para el registro y
        uso de la plataforma.
      </p>

      <h2>1. Definiciones aplicables</h2>
      <table>
        <thead>
          <tr>
            <th>Término</th>
            <th>Definición</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Datos personales</strong></td>
            <td>
              Cualquier información concerniente a una persona natural que la
              identifica o la hace identificable.
            </td>
          </tr>
          <tr>
            <td><strong>Titular</strong></td>
            <td>Persona natural a la que se refieren los datos personales.</td>
          </tr>
          <tr>
            <td><strong>Tratamiento</strong></td>
            <td>
              Cualquier operación que permita la recopilación, almacenamiento, uso,
              circulación, supresión o transmisión de datos personales.
            </td>
          </tr>
          <tr>
            <td><strong>Responsable</strong></td>
            <td>RuedaVe C.A., quien decide sobre la finalidad del tratamiento.</td>
          </tr>
          <tr>
            <td><strong>Encargado</strong></td>
            <td>Tercero que realiza el tratamiento por cuenta de RuedaVe.</td>
          </tr>
        </tbody>
      </table>

      <h2>2. Identificación del responsable</h2>
      <p>
        <strong>RuedaVe C.A.</strong> · Caracas, Venezuela <br />
        Correo: <a href="mailto:privacidad@ruedave.com">privacidad@ruedave.com</a>{" "}
        <br />
        Teléfono: (0424) 285-1254
      </p>

      <h2>3. Datos personales recopilados</h2>
      <h3>3.1 Identificación y contacto</h3>
      <ul>
        <li>Nombre y apellidos completos.</li>
        <li>Cédula de identidad o pasaporte vigente.</li>
        <li>Fecha de nacimiento.</li>
        <li>Dirección de residencia o domicilio fiscal.</li>
        <li>Teléfono móvil y correo electrónico.</li>
      </ul>
      <h3>3.2 Verificación y seguridad</h3>
      <ul>
        <li>Fotografía actualizada del titular.</li>
        <li>Imagen de la licencia de conducir vigente.</li>
        <li>Fotografía del documento de identidad.</li>
        <li>Datos biométricos (si se implementa verificación facial).</li>
      </ul>
      <h3>3.3 Pago y transaccionales</h3>
      <ul>
        <li>Información de tarjetas tokenizadas (no se almacenan números completos).</li>
        <li>Cuentas bancarias para pagos móviles o transferencias.</li>
        <li>Historial de transacciones.</li>
      </ul>
      <h3>3.4 Uso de la plataforma</h3>
      <ul>
        <li>Dirección IP, dispositivo, sistema operativo y navegador.</li>
        <li>Registro de actividades dentro de la plataforma.</li>
        <li>Geolocalización (solo si el usuario autoriza expresamente).</li>
      </ul>
      <h3>3.5 Datos del vehículo (para propietarios)</h3>
      <ul>
        <li>Placa, marca, modelo, año, color y número de serie (VIN).</li>
        <li>Documentos del vehículo (título, SOAT, seguro).</li>
        <li>Registro fotográfico y fílmico del vehículo.</li>
        <li>Informe de auditoría técnica de AUDITCAR.</li>
      </ul>
      <h3>3.6 Calificaciones y reputación</h3>
      <ul>
        <li>Comentarios y calificaciones recibidas.</li>
        <li>Historial de incidentes reportados.</li>
      </ul>

      <h2>4. Finalidad del tratamiento</h2>
      <table>
        <thead>
          <tr><th>Finalidad</th><th>Descripción</th></tr>
        </thead>
        <tbody>
          <tr><td>Gestión de cuenta</td><td>Crear y administrar la cuenta del usuario.</td></tr>
          <tr><td>Verificación de identidad</td><td>Confirmar que el conductor cumple los requisitos legales.</td></tr>
          <tr><td>Procesamiento de pagos</td><td>Cobrar al conductor y pagar al propietario.</td></tr>
          <tr><td>Gestión de alquileres</td><td>Reservas, check-in, check-out y documentación.</td></tr>
          <tr><td>Atención al usuario</td><td>Consultas, incidentes y reclamos.</td></tr>
          <tr><td>Cumplimiento legal</td><td>Obligaciones fiscales, regulatorias y judiciales.</td></tr>
          <tr><td>Prevención de fraude</td><td>Detectar actividades sospechosas o ilegales.</td></tr>
          <tr><td>Mejora del servicio</td><td>Analizar el uso para mejorar la experiencia.</td></tr>
          <tr><td>Comunicaciones comerciales</td><td>Solo si el usuario otorga consentimiento expreso.</td></tr>
        </tbody>
      </table>

      <h2>5. Base legal</h2>
      <ul>
        <li><strong>Ejecución de contrato</strong> entre las partes.</li>
        <li><strong>Consentimiento</strong> del titular para fines no esenciales.</li>
        <li><strong>Cumplimiento legal</strong> (Ley de Tránsito, deberes fiscales).</li>
        <li><strong>Interés legítimo</strong> en la prevención de fraude y mejora del servicio.</li>
      </ul>

      <h2>6. Derechos del titular</h2>
      <p>
        Conforme a la LOPDP, el titular tiene derecho de acceso, rectificación,
        actualización, cancelación, oposición y revocación del consentimiento. Para
        ejercerlos:
      </p>
      <ol>
        <li>
          Enviar un correo a{" "}
          <a href="mailto:privacidad@ruedave.com">privacidad@ruedave.com</a> con el
          asunto “Ejercicio de derecho LOPDP”.
        </li>
        <li>Adjuntar copia de la cédula de identidad o pasaporte.</li>
        <li>Indicar el derecho que desea ejercer y los datos involucrados.</li>
      </ol>
      <p>
        RuedaVe responderá en un plazo máximo de <strong>20 días hábiles</strong>.
      </p>

      <h2>7. Consentimiento</h2>
      <p>
        Al registrarse, el titular manifiesta su consentimiento libre, expreso e
        informado para el tratamiento de sus datos. Para finalidades adicionales
        (comunicaciones comerciales, geolocalización) se solicitará una casilla de
        verificación independiente.
      </p>

      <h2>8. Transferencia y compartición</h2>
      <p>
        RuedaVe podrá compartir datos con propietarios y conductores (para ejecutar
        el alquiler), AUDITCAR (auditoría técnica), procesadores de pago, autoridades
        competentes y aseguradoras. <strong>RuedaVe no vende ni alquila datos
        personales</strong> a terceros con fines publicitarios ajenos a la
        plataforma.
      </p>

      <h2>9. Medidas de seguridad</h2>
      <ul>
        <li>Cifrado SSL/TLS en todas las comunicaciones.</li>
        <li>Almacenamiento cifrado de contraseñas y datos sensibles.</li>
        <li>Tokenización de datos de pago.</li>
        <li>Control de acceso basado en roles.</li>
        <li>Registro de auditoría y políticas internas de seguridad.</li>
      </ul>
      <p>
        En caso de violación de seguridad, RuedaVe notificará al titular y a la
        autoridad competente en un plazo de <strong>48 horas</strong>.
      </p>

      <h2>10. Conservación</h2>
      <p>
        Los datos se conservan mientras la cuenta esté activa y por un plazo
        adicional de <strong>cinco (5) años</strong> tras su cierre, con fines
        legales y de prevención de fraude.
      </p>

      <h2>11. Cookies</h2>
      <p>
        Utilizamos cookies esenciales, de rendimiento y funcionales. El usuario
        puede configurar su navegador para rechazarlas, pero la desactivación de
        cookies esenciales puede afectar el funcionamiento de la plataforma.
      </p>

      <h2>12. Enlaces a terceros</h2>
      <p>
        La plataforma puede contener enlaces a sitios de terceros. RuedaVe no es
        responsable por las prácticas de privacidad de dichos sitios.
      </p>

      <h2>13. Menores de edad</h2>
      <p>
        La plataforma no está dirigida a menores de 18 años, y los conductores deben
        tener al menos 21 años. Si tomamos conocimiento de datos recopilados de un
        menor sin autorización, procederemos a eliminarlos de inmediato.
      </p>

      <h2>14. Modificaciones</h2>
      <p>
        Las modificaciones serán publicadas en la plataforma y notificadas. El uso
        continuado después de 10 días hábiles implicará la aceptación de la nueva
        versión.
      </p>

      <h2>15. Legislación aplicable</h2>
      <p>
        Esta política se rige por las leyes de Venezuela y, en particular, por la
        LOPDP. Cualquier controversia se someterá a los tribunales competentes de
        Caracas.
      </p>

      <h2>16. Contacto</h2>
      <p>
        Delegado de Protección de Datos:{" "}
        <a href="mailto:privacidad@ruedave.com">privacidad@ruedave.com</a> · Correo
        alternativo: <a href="mailto:legal@ruedave.com">legal@ruedave.com</a> ·
        Teléfono: (0424) 285-1254 · Caracas, Venezuela.
      </p>
    </LegalLayout>
  );
};

export default PrivacyPage;
