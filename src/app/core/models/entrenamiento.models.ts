export interface Ejercicio {
  id?: string;
  id_dia?: string;
  ejercicio: string;
  series: number;
  reps: string;
  orden?: number;
}

export interface DiaEntrenamiento {
  id?: string;
  id_rutina?: string;
  titulo: string;
  orden?: number;
  ejercicios: Ejercicio[];
}

export interface Rutina {
  id?: string;
  id_perfil: string;
  notas?: string;
  dias_entrenamiento: DiaEntrenamiento[];
}