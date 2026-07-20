import LegalLayout from "@/components/LegalLayout";

const InsurancePage = () => {
  return (
    <LegalLayout
      overrideKey="insurance"
      title="Seguro y Cobertura"
      subtitle="Alcance de la cobertura, exclusiones y proceso de reclamos"
    >
      <p>
        Toda reserva realizada en RuedaVe incluye una cobertura de seguro básica
        contratada con aseguradoras autorizadas para operar en la República
        Bolivariana de Venezuela. La presente sección describe el alcance de la
        cobertura, las exclusiones, los deducibles y el procedimiento para
        presentar un reclamo.
      </p>

      <h2>1. Cobertura incluida</h2>
      <ul>
        <li><strong>Responsabilidad civil</strong> frente a terceros por daños materiales y lesiones personales.</li>
        <li><strong>Daños al vehículo</strong> por colisión, vuelco o incendio (con deducible).</li>
        <li><strong>Robo total</strong> del vehículo, previa denuncia ante autoridades.</li>
        <li><strong>Asistencia vial 24/7</strong>: grúa, batería, cambio de neumáticos.</li>
      </ul>

      <h2>2. Protección Plus (opcional)</h2>
      <p>
        Reduce el deducible en caso de siniestro, cubre daños a cristales,
        neumáticos y espejos, e incluye conductor adicional. Se contrata al
        momento de la reserva por una tarifa diaria adicional.
      </p>

      <h2>3. Exclusiones</h2>
      <ul>
        <li>Conducción bajo efectos de alcohol, drogas o sustancias psicotrópicas.</li>
        <li>Uso del vehículo para actividades ilícitas, carreras o competencias.</li>
        <li>Conductores no autorizados o menores de la edad mínima permitida.</li>
        <li>Daños intencionales o por negligencia grave.</li>
        <li>Uso fuera del territorio nacional sin autorización expresa.</li>
      </ul>

      <h2>4. Deducibles</h2>
      <p>
        El deducible es el monto que el arrendatario asume en caso de siniestro
        antes de que la aseguradora cubra el resto. El monto exacto depende del
        segmento del vehículo y se informa en el detalle de cada reserva.
      </p>

      <h2>5. Cómo reportar un siniestro</h2>
      <ol>
        <li>Detener el vehículo en un lugar seguro y activar las luces de emergencia.</li>
        <li>Llamar al 911 y a la línea de asistencia de RuedaVe: (0424) 285-1254.</li>
        <li>Tomar fotografías del vehículo, del lugar y de los otros involucrados.</li>
        <li>No firmar acuerdos con terceros sin la autorización de la aseguradora.</li>
        <li>Enviar el reporte completo a <a href="mailto:siniestros@ruedave.com">siniestros@ruedave.com</a> dentro de las 24 horas.</li>
      </ol>

      <h2>6. Plazos de resolución</h2>
      <p>
        La aseguradora dispone de hasta 30 días hábiles para resolver un reclamo.
        RuedaVe hace seguimiento y mantiene informadas a ambas partes del estado
        del expediente.
      </p>

      <h2>7. Contacto</h2>
      <p>
        Siniestros: <a href="mailto:siniestros@ruedave.com">siniestros@ruedave.com</a> ·
        Soporte: <a href="mailto:soporte@ruedave.com">soporte@ruedave.com</a> ·
        Teléfono 24/7: (0424) 285-1254.
      </p>
    </LegalLayout>
  );
};

export default InsurancePage;
