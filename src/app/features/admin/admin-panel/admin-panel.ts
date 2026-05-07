import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { AuthService } from '../../../core/supabase/auth'; // 🟢 VITAL: Importar el servicio con la ruta relativa correcta

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], 
  templateUrl: './admin-panel.html',
  styleUrls: ['./admin-panel.scss']
})
export class AdminPanelComponent implements OnInit {

  vistaActual: 'lista' | 'editor' = 'lista';
  pacienteSeleccionado: any = null;

  // 🟢 MOCK ACTUALIZADO: Usando 'estado_aprobacion' real
  pacientes = [
    { id: 'tu-uuid-real-aqui', nombre: 'Alejandro M.', estado_aprobacion: 'aprobado', ultimaActualizacion: '05 May 2026' },
    { id: 'tu-uuid-real-aqui-2', nombre: 'Sofía R.', estado_aprobacion: 'pendiente', ultimaActualizacion: '01 May 2026' },
    { id: 'tu-uuid-real-aqui-3', nombre: 'Carlos T.', estado_aprobacion: 'aprobado', ultimaActualizacion: '28 Abr 2026' }
  ];

  planForm!: FormGroup;

  // 🟢 INYECTAMOS EL AuthService EN EL CONSTRUCTOR
  constructor(private fb: FormBuilder, private authService: AuthService) {}

  ngOnInit() {
    this.planForm = this.fb.group({
      calorias_totales: [''],
      suplementacion: [''],
      medicacion: [''],
      comidas: this.fb.array([]) 
    });
  }

  abrirExpediente(paciente: any) {
    this.pacienteSeleccionado = paciente;
    this.vistaActual = 'editor';
  }

  volverAlPanel() {
    this.vistaActual = 'lista';
    this.pacienteSeleccionado = null;
  }

  // ==========================================
  // 🟢 LA FUNCIÓN DE APROBAR/SUSPENDER
  // ==========================================
 // ==========================================
  // 🟢 LA FUNCIÓN DE APROBAR/SUSPENDER (VERSIÓN OPTIMISTA)
  // ==========================================
  async toggleEstado(paciente: any, event: Event) {
    event.preventDefault();  // 🟢 Bloquea cualquier comportamiento raro del navegador
    event.stopPropagation(); // Evita abrir la tarjeta

    // 1. Guardamos cómo estaba antes por si ocurre un error
    const estadoAnterior = paciente.estado_aprobacion;
    const nuevoEstado = estadoAnterior === 'aprobado' ? 'pendiente' : 'aprobado';

    // 2. 🟢 ACTUALIZACIÓN OPTIMISTA: Cambiamos la pantalla INMEDIATAMENTE
    paciente.estado_aprobacion = nuevoEstado;

    try {
      // 3. Le avisamos a Supabase en segundo plano
      await this.authService.actualizarEstadoPaciente(paciente.id, nuevoEstado);
      console.log(`📍 ${paciente.nombre} actualizado en BD a: ${nuevoEstado}`);
    } catch (error) {
      console.error("Aviso: Falló la conexión con Supabase. Revirtiendo cambio...", error);
      // 4. Si Supabase rechaza el cambio (ej. porque el ID es falso), regresamos el botón a la normalidad
      paciente.estado_aprobacion = estadoAnterior;
    }
  }

  get comidas() { return this.planForm.get('comidas') as FormArray; }
  alimentosDeComida(comidaIndex: number) { return this.comidas.at(comidaIndex).get('alimentos') as FormArray; }

  agregarComida() {
    const comidaForm = this.fb.group({ nombre: ['', Validators.required], nota_comida: [''], alimentos: this.fb.array([]) });
    this.comidas.push(comidaForm);
  }
  eliminarComida(index: number) { this.comidas.removeAt(index); }
  agregarAlimento(comidaIndex: number) {
    const alimentoForm = this.fb.group({ descripcion: ['', Validators.required], calorias: [0], proteinas: [0], carbos: [0], grasas: [0] });
    this.alimentosDeComida(comidaIndex).push(alimentoForm);
  }
  eliminarAlimento(comidaIndex: number, alimentoIndex: number) { this.alimentosDeComida(comidaIndex).removeAt(alimentoIndex); }

  guardarPlan() {
    if (this.planForm.valid) {
      console.log("📍 DATOS LISTOS PARA SUPABASE:", this.planForm.value);
      alert('¡Plan capturado en consola! Abre F12.');
      this.volverAlPanel();
    } else {
      console.error("🔥 FORMULARIO INVÁLIDO:", this.planForm);
      this.planForm.markAllAsTouched(); 
      alert('Faltan campos por llenar.');
    }
  }
}