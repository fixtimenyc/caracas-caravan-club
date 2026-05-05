import LegalLayout from "@/components/LegalLayout";

const CancellationPage = () => {
  return (
    <LegalLayout
      title="Políticas de Cancelación y Reembolsos"
      subtitle="Condiciones para la cancelación de reservas y devolución de pagos"
    >
      <p>
        Las presentes Políticas de Cancelación y Reembolsos forman parte integrante
        de los <a href="/terminos">Términos y Condiciones Generales</a> de RuedaVe
        C.A. y establecen los derechos y obligaciones de los usuarios en caso de
        cancelación total o parcial de una reserva.
      </p>

      <h2>1. Definiciones</h2>
      <ul>
        <li><strong>Reserva:</strong> alquiler confirmado y pagado a través de la plataforma.</li>
        <li><strong>Fecha de inicio:</strong> fecha y hora pactadas para la entrega del vehículo.</li>
        <li><strong>No show:</strong> el conductor no se presenta a recoger el vehículo sin haber cancelado previamente.</li>
        <li><strong>Reembolso:</strong> devolución total o parcial del dinero pagado.</li>
        <li><strong>Penalización:</strong> monto retenido o cobrado como consecuencia de la cancelación.</li>
      </ul>

      <h2>2. Tipos de cancelación</h2>
      <p>
        Existen tres tipos: <strong>(A)</strong> por el conductor,{" "}
        <strong>(B)</strong> por el propietario y <strong>(C)</strong> por RuedaVe
        (incumplimiento de políticas o fuerza mayor). Toda cancelación debe
        realizarse a través de la plataforma; en caso de indisponibilidad técnica,
        notificar a{" "}
        <a href="mailto:soporte@ruedave.com">soporte@ruedave.com</a>.
      </p>

      <h2>3. Cancelación por el conductor</h2>
      <table>
        <thead>
          <tr>
            <th>Momento de la cancelación</th>
            <th>Alquiler</th>
            <th>Depósito</th>
            <th>Protección Plus</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Más de 7 días antes</td><td>100%</td><td>100%</td><td>100%</td></tr>
          <tr><td>Entre 7 días y 48 horas antes</td><td>75%</td><td>100%</td><td>100%</td></tr>
          <tr><td>Entre 48 y 24 horas antes</td><td>50%</td><td>100%</td><td>100%</td></tr>
          <tr><td>Entre 24 y 2 horas antes</td><td>25%</td><td>100%</td><td>100%</td></tr>
          <tr><td>Menos de 2 horas antes</td><td>0%</td><td>100%</td><td>0%</td></tr>
          <tr><td>No show</td><td>0%</td><td>0%</td><td>0%</td></tr>
        </tbody>
      </table>
      <h3>3.2 Causa justificada</h3>
      <p>
        Si el conductor cancela por causa justificada (enfermedad grave, fuerza
        mayor) podrá obtener el reembolso del 100% mediante presentación de la
        documentación soporte enviada a{" "}
        <a href="mailto:cancelaciones@ruedave.com">cancelaciones@ruedave.com</a>{" "}
        dentro de las 24 horas siguientes al hecho. RuedaVe responde en un plazo
        máximo de 5 días hábiles.
      </p>

      <h2>4. Cancelación por el propietario</h2>
      <p>
        El propietario no debe cancelar una reserva confirmada salvo causa de fuerza
        mayor. Penalizaciones aplicables:
      </p>
      <table>
        <thead>
          <tr>
            <th>Momento</th>
            <th>Penalización económica</th>
            <th>Otras consecuencias</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Más de 48 horas antes</td>
            <td>50% de la comisión devengada</td>
            <td>Anotación negativa en su perfil.</td>
          </tr>
          <tr>
            <td>Entre 48 y 24 horas antes</td>
            <td>100% de la comisión + 20 USD</td>
            <td>Anotación negativa + suspensión de la publicación por 7 días.</td>
          </tr>
          <tr>
            <td>Menos de 24 horas antes</td>
            <td>100% de la comisión + 50 USD</td>
            <td>Anotación negativa + suspensión por 30 días.</td>
          </tr>
        </tbody>
      </table>
      <p>
        En todos los casos el conductor recibe el <strong>100% de reembolso</strong>{" "}
        de lo pagado, más un bono de cortesía del 20% del valor del alquiler para
        usar en una futura reserva (válido por 90 días) o ayuda para encontrar un
        vehículo similar.
      </p>

      <h2>5. Cancelación por RuedaVe</h2>
      <ul>
        <li>
          <strong>Incumplimiento del conductor:</strong> reembolso total menos 10%
          por gastos administrativos.
        </li>
        <li>
          <strong>Incumplimiento del propietario:</strong> reembolso total al
          conductor + penalización al propietario.
        </li>
        <li>
          <strong>Fuerza mayor o causas técnicas:</strong> reembolso del 100% sin
          penalización para ninguna de las partes.
        </li>
      </ul>

      <h2>6. No show</h2>
      <p>
        El propietario debe esperar 30 minutos después de la hora pactada y luego
        reportar el no show desde la app. RuedaVe intentará contactar al conductor;
        confirmado el no show, este pierde el alquiler, depósito y Protección Plus,
        y recibe 1 estrella automática.
      </p>

      <h2>7. Modificaciones de la reserva</h2>
      <ul>
        <li>Extensión de días: sujeta a disponibilidad y pago adicional.</li>
        <li>
          Acortamiento con más de 48 horas: se reembolsa la diferencia conforme a
          las tablas anteriores.
        </li>
        <li>Acortamiento con menos de 48 horas: sin reembolso.</li>
      </ul>

      <h2>8. Reembolsos: plazos y forma</h2>
      <table>
        <thead><tr><th>Método de pago original</th><th>Plazo máximo</th></tr></thead>
        <tbody>
          <tr><td>Tarjeta de débito/crédito</td><td>7 a 14 días hábiles</td></tr>
          <tr><td>Pago Móvil</td><td>3 a 5 días hábiles</td></tr>
          <tr><td>Transferencia bancaria</td><td>3 a 5 días hábiles</td></tr>
        </tbody>
      </table>
      <p>
        Los reembolsos se realizan siempre al mismo método de pago original. No se
        aceptan solicitudes a una cuenta diferente.
      </p>

      <h2>9. Cancelaciones abusivas</h2>
      <p>
        RuedaVe podrá suspender o cerrar cuentas que presenten un patrón abusivo de
        cancelaciones. El usuario será notificado cuando se acerque al límite.
      </p>

      <h2>10. Cancelación por mantenimiento o causas técnicas</h2>
      <p>
        Ante interrupciones técnicas, RuedaVe cancelará automáticamente las reservas
        afectadas y reembolsará el 100% al conductor, sin responsabilidad por daños
        indirectos.
      </p>

      <h2>11. Legislación aplicable</h2>
      <p>
        Estas políticas se rigen por las leyes de Venezuela. Cualquier controversia
        se someterá a los tribunales competentes de Caracas.
      </p>

      <h2>12. Aceptación</h2>
      <p>
        El registro y la realización de una reserva implica la aceptación plena de
        las presentes Políticas de Cancelación y Reembolsos.
      </p>

      <h2>Contacto</h2>
      <p>
        Cancelaciones:{" "}
        <a href="mailto:cancelaciones@ruedave.com">cancelaciones@ruedave.com</a> ·
        Soporte: <a href="mailto:soporte@ruedave.com">soporte@ruedave.com</a> ·
        Teléfono: (0424) 285-1254.
      </p>
    </LegalLayout>
  );
};

export default CancellationPage;
