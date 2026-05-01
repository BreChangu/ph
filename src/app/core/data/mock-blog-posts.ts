import { BlogPost } from '../models/blog-post.model';

export const BLOG_POSTS: BlogPost[] = [
  {
    id: '1',
    title: '3 suplementos para tu sistema inmunológico',
    excerpt: '¿Realmente los suplementos alimenticios fortalecen tu sistema inmune? Si la dieta es correcta, existen algunos que son de ayuda. Descúbrelos aquí.',
    content: `
      <p>Usar suplementos para mejorar el sistema inmunológico más allá de sus capacidades no es real, nuestro sistema de defensa es uno y lo único que podemos lograr es tenerlo en óptimas condiciones para que a su capacidad combata factores externos que puedan dañarnos.</p>
      
      <p>Esto se consigue a través del estilo de vida que llevamos, de ti depende que tengamos un sistema inmune fuerte o no, tus hábitos son la base de un sistema inmunológico fuerte y tienen mucha relevancia. Prioriza antes lo siguiente:</p>
      <ul>
        <li>Dormir bien, el descanso es súper importante para no mermar nuestras defensas.</li>
        <li>Llevar una dieta saludable, con alto consumo de vegetales, frutas y una porción baja de procesados.</li>
        <li>Realizar actividad física (de cualquier tipo, en casa pon acción ya)</li>
      </ul>
      <p>Si ya tienes la dieta en orden y todo lo demás, pon atención en estos 3 suplementos.</p>
      
      <h3>Ajo</h3>
      <p>El ajo es un alimento que te puede ayudar a prevenir enfermarte de infecciones o resfriado hasta un 60%, esto debido a que mejora la función de ciertas células inmunitarias. El ajo puede interactuar con algunos medicamentos por lo que, si piensas incluirlo en tu dieta diaria, consúltalo con tu médico, especialmente si tomas anticoagulantes, tratamiento para VIH o tuberculosis.</p>
      <p>Lo puedes tomar en su forma natural o como suplemento en polvo. Si lo tomas como alimento, con 3 dientes de ajo al día puede ser suficiente, lo puedes cocinar, tomar crudo, molido, o en cualquier forma. Como suplemento en polvo puedes consumir de 600 a 1200 mg de extracto de ajo en polvo.</p>

      <h3>Vitamina C</h3>
      <p>Esta vitamina puede ayudarte a reducir la duración de una enfermedad infecciosa (no curarla) y la frecuencia con la que te enfermas de cosas comunes como resfriado. El efecto de la Vitamina C es más efectivo en personas activas, por lo que te recomendamos combinarlo con un estilo de vida que incluya ejercicio regular y un buen consumo de frutas y verduras.</p>
      <p>Puedes tomar desde 500 mg hasta 2000 mg al día dividido en 2 o 3 dosis a lo largo del día, ya sea en comprimidos, tabletas o tabletas efervescentes.</p>

      <h3>Vitamina D</h3>
      <p>La vitamina D se ha vuelto muy popular en esta pandemia, ya que su deficiencia se ha relacionado con un peor pronóstico a la hora de contagiarse de Covid-19, y lo interesante es que su deficiencia puede suceder en parte importante de la población, ya que su principal fuente es la luz del sol y en estos momentos de confinamiento mucha gente no se expone lo suficiente al sol para generarla. Es por ello que suplementaria puede ser interesante si tú pasas la mayor parte del día en casa o bajo techo en general, puedes pensar en una ingesta de entre 2000 a 5000 UI cada 24 a 48 horas, aunque la dosis dependerá de tu sexo, edad, raza y otros factores, por lo que siempre te recomendamos acercarte a un profesional.</p>
      
      <p><em>En NTS te estaremos esperando cuando todo esto pase para seguir con tus metas trabajando juntos.</em></p>
      <p><strong>Por: Maestro en nutrición Fernando Plata | Nutriólogo NTS Clinic</strong></p>
    `,
    coverImage: '/images/blog-inmune.webp', // Asumiendo que tendrás estas imágenes
    date: '2024-05-10',
    category: 'Suplementación',
    readTime: '4 min',
    author: 'Fernando Plata'
  },
  {
    id: '2',
    title: 'Repeticiones en reserva ¿Qué son y cómo usarlas?',
    excerpt: 'Las repeticiones en reserva son una herramienta útil para que tú mismo puedas modular los pesos y la intensidad de tus entrenamientos.',
    content: '<p>Contenido en desarrollo...</p>',
    coverImage: '/images/blog-repeticiones.webp',
    date: '2024-05-05',
    category: 'Entrenamiento',
    readTime: '3 min',
    author: 'Pablo Herrera'
  },
  {
    id: '3',
    title: 'Ayuno Intermitente: Más allá de la pérdida de grasa',
    excerpt: '¿Has escuchado del ayuno intermitente?, ¿has escuchado de sus beneficios? Es una herramienta buena pero que va más allá de solo pérdida de grasa.',
    content: '<p>Contenido en desarrollo...</p>',
    coverImage: '/images/blog-ayuno.webp',
    date: '2024-04-28',
    category: 'Nutrición',
    readTime: '5 min',
    author: 'Pablo Herrera'
  },
  {
    id: '4',
    title: 'Leche, ¿buena o mala en un plan de alimentación?',
    excerpt: 'Se piensa que es mala para la pérdida de grasa, pero ¿realmente es una bebida tan mala? Hoy para salir de dudas te preparé este artículo.',
    content: '<p>Contenido en desarrollo...</p>',
    coverImage: '/images/blog-leche.webp',
    date: '2024-04-15',
    category: 'Nutrición',
    readTime: '4 min',
    author: 'Pablo Herrera'
  },
  {
    id: '5',
    title: 'Ansiedad en la dieta, cómo vencerla y tener éxito',
    excerpt: 'Empiezas un plan de alimentación y al no tener experiencia te llega la ansiedad, te vence y terminas abandonando. Descubre cómo evitarlo.',
    content: '<p>Contenido en desarrollo...</p>',
    coverImage: '/images/blog-ansiedad.webp',
    date: '2024-04-02',
    category: 'Mindset',
    readTime: '6 min',
    author: 'Pablo Herrera'
  }
];