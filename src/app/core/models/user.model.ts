export interface Perfil {
  id: string;
  email: string;
  nombre_completo: string;
  rol: 'admin' | 'paciente' | 'nutriologo';
  peso_kg?: number;
  estatura_cm?: number;
  estado_aprobacion: 'pendiente' | 'aprobado' | 'suspendido';
  created_at?: string;
}