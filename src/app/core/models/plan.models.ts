export interface Alimento {
  id?: string;
  id_comida?: string;
  descripcion: string;
  calorias: number;
  proteinas: number;
  carbos: number;
  grasas: number;
}

export interface Comida {
  id?: string;
  id_plan?: string;
  nombre: string;
  nota_comida?: string;
  alimentos_comida?: Alimento[]; // Relación con sus alimentos
}

export interface PlanNutricional {
  id?: string;
  id_perfil: string;
  calorias_totales?: number;
  suplementacion?: string;
  medicacion?: string;
  comidas?: Comida[]; // Relación con sus comidas
}