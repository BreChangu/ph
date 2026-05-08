import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/supabase/auth';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './onboarding.html',
  styleUrls: ['./onboarding.scss'],
})
export class Onboarding implements OnInit {
  onboardingForm!: FormGroup;
  isLoading = false;
  isEditMode = false;
  linksFotosActuales: Record<string, string> = {};
  private pacienteId: string | null = null;

  archivosSeleccionados: {
    inbody: File | null;
    frente: File | null;
    perfil: File | null;
    espalda: File | null;
  } = {
    inbody: null,
    frente: null,
    perfil: null,
    espalda: null
  };

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    this.crearFormulario();

    try {
      const session = await this.authService.getSession();
      if (!session?.user) {
        await this.router.navigate(['/auth']);
        return;
      }

      const perfil = await this.authService.getUserProfileForAuth(session.user.id, session.user.email);
      const pacienteId = perfil?.id ?? session.user.id;
      this.pacienteId = pacienteId;
      this.isEditMode = this.route.snapshot.queryParamMap.get('editar') === 'true';

      const expediente = await this.authService.getExpedienteClinico(pacienteId);

      if (expediente) {
        this.linksFotosActuales = expediente.fotos_progreso ?? {};
        this.onboardingForm.patchValue(expediente.respuestas_completas ?? {});

        if (!this.isEditMode) {
          await this.router.navigate(['/panel']);
          return;
        }
      } else if (this.isEditMode) {
        this.isEditMode = false;
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al preparar onboarding:', error);
      alert('No pudimos cargar tu entrevista. Inténtalo de nuevo.');
      await this.router.navigate(['/panel']);
    }
  }

  private crearFormulario() {
    this.onboardingForm = this.fb.group({
      // 1. DATOS VITALES Y COMPOSICIÓN
      nombre_completo: ['', Validators.required],
      edad: ['', [Validators.required, Validators.min(10)]],
      peso_kg: ['', [Validators.required, Validators.min(30)]],
      altura_cm: ['', [Validators.required, Validators.min(100)]],
      genero: ['', Validators.required], 
      porcentaje_grasa: [''], // Opcional
      cintura_cm: ['', Validators.required],
      peso_objetivo: ['', Validators.required],

      // 2. OBJETIVOS
      objetivo: ['', Validators.required],
      dieta_previa: ['', Validators.required],
      creador_dieta: [''], 
      motivo_abandono: [''], // NUEVO

      // 3. ESTILO DE VIDA Y ENTRENAMIENTO
      ocupacion: ['', Validators.required],
      gym_actual: ['', Validators.required],
      dias_entreno: ['', Validators.required],
      lesiones: [''],
      tiempo_entrenando: ['', Validators.required],
      horario_entreno: [''], // NUEVO (AM/PM)
      enfoque_entrenamiento: ['', Validators.required],

      // 4. CLÍNICOS
      enfermedades: ['', Validators.required],
      medicamentos: ['', Validators.required],
      // NUEVO: Checkboxes para antecedentes
      antecedentes_familiares: this.fb.group({
        obesidad: [false],
        diabetes: [false],
        hipertension: [false],
        cancer: [false],
        trigliceridos: [false],
        renales: [false],
        hepaticos: [false],
        infartos: [false],
        otros: [''],
      }),

      // 5. ALIMENTACIÓN
      comidas_al_dia: ['', Validators.required],
      ejemplo_dia: ['', Validators.required],
      alimentos_favoritos: ['', Validators.required],
      alimentos_odiados: ['', Validators.required],
      ansiedad_comer: ['', Validators.required],
      conflicto_alimentacion: ['', Validators.required],
      comidas_mas_hambre: [''],
      colaciones: ['', Validators.required],
      suplementos: ['', Validators.required]
    });
  }

  onFileSelected(event: any, tipo: 'inbody' | 'frente' | 'perfil' | 'espalda') {
    const file: File = event.target.files[0];
    if (file) {
      this.archivosSeleccionados[tipo] = file;
    }
  }

  async enviarCuestionario() {
    if (this.onboardingForm.invalid) {
      this.onboardingForm.markAllAsTouched();
      alert('Por favor, revisa que todos los campos marcados con * estén completos.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const faltanFotosObligatorias =
      !this.tieneFoto('frente') || !this.tieneFoto('perfil') || !this.tieneFoto('espalda');

    if (faltanFotosObligatorias) {
      alert('Por favor, adjunta tus 3 fotografías de progreso (Frente, Perfil y Espalda).');
      return;
    }

    this.isLoading = true;

    try {
      if (!this.pacienteId) throw new Error("No hay sesión activa");

      const linksFotos: any = { ...this.linksFotosActuales };

      if (this.archivosSeleccionados.inbody) {
        linksFotos.inbody = await this.authService.subirFoto(this.pacienteId, 'inbody', this.archivosSeleccionados.inbody);
      }
      if (this.archivosSeleccionados.frente) {
        linksFotos.frente = await this.authService.subirFoto(this.pacienteId, 'frente', this.archivosSeleccionados.frente);
      }
      if (this.archivosSeleccionados.perfil) {
        linksFotos.perfil = await this.authService.subirFoto(this.pacienteId, 'perfil', this.archivosSeleccionados.perfil);
      }
      if (this.archivosSeleccionados.espalda) {
        linksFotos.espalda = await this.authService.subirFoto(this.pacienteId, 'espalda', this.archivosSeleccionados.espalda);
      }

      await this.authService.guardarExpedienteInicial(this.pacienteId, this.onboardingForm.value, linksFotos);

      alert(this.isEditMode ? '¡Tu información se actualizó correctamente!' : '¡Expediente enviado con éxito! Tu coach lo revisará a la brevedad.');
      this.router.navigate(['/panel']);

    } catch (error) {
      console.error("Error al procesar el expediente:", error);
      alert('Hubo un error al subir tus datos. Inténtalo de nuevo.');
    } finally {
      this.isLoading = false;
    }
  }

  private tieneFoto(tipo: 'frente' | 'perfil' | 'espalda') {
    return Boolean(this.archivosSeleccionados[tipo] || this.linksFotosActuales[tipo]);
  }
}
