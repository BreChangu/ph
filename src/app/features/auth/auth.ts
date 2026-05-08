import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/supabase/auth';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.html',
  styleUrls: ['./auth.scss'],
})
export class AuthComponent implements OnInit {
  // Variables del formulario
  email = '';
  password = '';
  confirmPassword = '';

  // Variables de estado (UI)
  isLoginMode = true;
  isRecoveryMode = false;
  isEmailSent = false;
  isLoading = false;
  showPassword = false;
  message = '';
  isError = false;

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  async ngOnInit() {
    if (this.route.snapshot.queryParamMap.get('signedOut') === '1') {
      this.authService.clearLocalSession();
      return;
    }

    const session = await this.authService.getSession();
    if (session?.user) {
      await this.redirigirUsuarioAutenticado(session.user.id, session.user.email);
    }
  }

  // Cambiar entre Login y Registro
  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    this.isRecoveryMode = false;
    this.isEmailSent = false;
    this.resetForm();
  }

  // Alternar modo recuperación
  toggleRecoveryMode() {
    this.isRecoveryMode = !this.isRecoveryMode;
    this.isEmailSent = false;
    this.resetForm();
  }

  // Mostrar/Ocultar contraseña
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  // Limpiar formulario y mensajes
  private resetForm() {
    this.message = '';
    this.password = '';
    this.confirmPassword = '';
    this.cdr.detectChanges();
  }

  // Login con Google
  async handleGoogleLogin() {
    await this.authService.signInWithGoogle();
  }

  // Flujo principal de Correo/Contraseña
  async handleEmailAuth() {
    if (!this.email) {
      this.showMessage('Por favor, ingresa tu correo electrónico.', true);
      return;
    }

    // =====================================
    // 🟢 FLUJO 1: RECUPERACIÓN DE CONTRASEÑA (Blindado)
    // =====================================
    if (this.isRecoveryMode) {
      console.log('📍 INICIO: Solicitando correo de recuperación para', this.email);
      this.isLoading = true;
      this.message = '';
      this.cdr.detectChanges();

      // Cronómetro de seguridad: 10 segundos máximo
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                'El servidor tardó demasiado. Revisa tu conexión o la configuración de Supabase.',
              ),
            ),
          10000,
        ),
      );

      try {
        // Carrera entre Supabase y el cronómetro
        await Promise.race([this.authService.resetPassword(this.email), timeoutPromise]);

        console.log('📍 ÉXITO: Supabase procesó la petición.');

        this.isEmailSent = true;
        this.showMessage('¡Enlace enviado! Revisa tu bandeja de entrada o spam.', false);
        this.email = '';

        // Magia UX: Regreso suave al login después de 3.5s
        setTimeout(() => {
          this.isRecoveryMode = false;
          this.isLoginMode = true;
          this.isEmailSent = false;
          this.message = '';
          this.cdr.detectChanges();
        }, 3500);
      } catch (error: any) {
        console.error('🔥 ERROR CAPTURADO EN RECUPERACIÓN:', error);
        const errorReal = error?.message || 'Error de conexión con el servidor.';
        this.showMessage(`Aviso: ${errorReal}`, true);
      } finally {
        console.log('📍 FIN: Destrabando el botón obligatoriamente.');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
      return; // Terminamos aquí si es recuperación
    }

    // =====================================
    // 🔵 FLUJO 2: LOGIN Y REGISTRO
    // =====================================
    if (!this.password) {
      this.showMessage('Por favor, ingresa tu contraseña.', true);
      return;
    }

    if (!this.isLoginMode) {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
      if (!passwordRegex.test(this.password)) {
        this.showMessage('La contraseña no cumple con los requisitos de seguridad.', true);
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.showMessage('Las contraseñas no coinciden.', true);
        return;
      }
    }

    this.isLoading = true;
    this.message = '';
    this.cdr.detectChanges();

    try {
      if (this.isLoginMode) {
        // =====================================
        // MODO: INICIAR SESIÓN (CON AUDITORÍA Y APROBACIÓN)
        // =====================================
        const { data: authData, error } = await this.authService.signInWithEmail(
          this.email,
          this.password,
        );
        if (error) throw error;

        this.showMessage('¡Acceso concedido! Verificando credenciales...', false);

        if (authData.user?.id) {
          await this.redirigirUsuarioAutenticado(authData.user.id, authData.user.email);
        }
      } else {
        // =====================================
        // MODO: REGISTRO
        // =====================================
        const { data, error } = await this.authService.signUpWithEmail(this.email, this.password);
        if (error) throw error;

        // Detector de correos duplicados
        if (data?.user?.identities && data.user.identities.length === 0) {
          this.showMessage('Este correo ya está registrado. Por favor, inicia sesión.', true);
          return;
        }

        this.showMessage('¡Registro exitoso! Revisa tu bandeja de entrada.', false);
        this.resetForm();
        this.isLoginMode = true;
      }
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('Invalid login credentials')) {
        this.showMessage('Correo o contraseña incorrectos.', true);
      } else if (msg.includes('Email not confirmed')) {
        this.showMessage('Por favor, verifica tu correo antes de entrar.', true);
      } else if (msg.includes('User already registered')) {
        this.showMessage('Este correo ya está registrado. Por favor, inicia sesión.', true);
      } else {
        this.showMessage('Ocurrió un error inesperado. Intenta de nuevo.', true);
      }
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  // Utilidad para mostrar mensajes
  private showMessage(text: string, isError: boolean) {
    this.message = text;
    this.isError = isError;
    this.cdr.detectChanges();
  }

  private async redirigirUsuarioAutenticado(userId: string, email?: string) {
    const perfil = await this.authService.getUserProfileForAuth(userId, email);

    if (!perfil) {
      this.showMessage('Error de sistema: Perfil no encontrado.', true);
      await this.authService.signOut();
      return;
    }

    if (perfil.estado_aprobacion === 'pendiente' && perfil.rol !== 'admin') {
      this.showMessage('Tu cuenta está en revisión. Te avisaremos cuando sea aprobada.', true);
      await this.authService.signOut();
      return;
    }

    if (perfil.rol === 'admin') {
      await this.router.navigate(['/admin-panel']);
      return;
    }

    const expediente = await this.authService.getExpedienteClinico(perfil.id);
    await this.router.navigate([expediente ? '/panel' : '/onboarding']);
  }
}
