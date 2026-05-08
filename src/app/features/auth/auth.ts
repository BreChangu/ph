import { Component, ChangeDetectorRef, OnInit, NgZone } from '@angular/core';
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
  email = '';
  password = '';
  confirmPassword = '';

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
    private ngZone: NgZone // 🟢 Necesario para que Angular actualice la vista al entrar
  ) {}

  async ngOnInit() {
    // 🟢 FIX: Usamos el método signOut reactivo
    if (this.route.snapshot.queryParamMap.get('signedOut') === '1') {
      await this.authService.signOut();
      return;
    }

    const session = await this.authService.getSession();
    if (session?.user) {
      await this.redirigirUsuarioAutenticado(session.user.id, session.user.email);
    }
  }

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    this.isRecoveryMode = false;
    this.isEmailSent = false;
    this.resetForm();
  }

  toggleRecoveryMode() {
    this.isRecoveryMode = !this.isRecoveryMode;
    this.isEmailSent = false;
    this.resetForm();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  private resetForm() {
    this.message = '';
    this.password = '';
    this.confirmPassword = '';
    this.cdr.detectChanges();
  }

  async handleGoogleLogin() {
    await this.authService.signInWithGoogle();
  }

  async handleEmailAuth() {
    if (!this.email) {
      this.showMessage('Por favor, ingresa tu correo electrónico.', true);
      return;
    }

    if (this.isRecoveryMode) {
      this.isLoading = true;
      this.message = '';
      this.cdr.detectChanges();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('El servidor tardó demasiado.')), 10000)
      );

      try {
        await Promise.race([this.authService.resetPassword(this.email), timeoutPromise]);
        this.isEmailSent = true;
        this.showMessage('¡Enlace enviado! Revisa tu bandeja.', false);
        this.email = '';
        setTimeout(() => {
          this.isRecoveryMode = false;
          this.isLoginMode = true;
          this.isEmailSent = false;
          this.message = '';
          this.cdr.detectChanges();
        }, 3500);
      } catch (error: any) {
        this.showMessage(`Aviso: ${error?.message || 'Error de conexión'}`, true);
      } finally {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
      return;
    }

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
        const { data: authData, error } = await this.authService.signInWithEmail(this.email, this.password);
        if (error) throw error;
        this.showMessage('¡Acceso concedido! Verificando...', false);
        if (authData.user?.id) {
          await this.redirigirUsuarioAutenticado(authData.user.id, authData.user.email);
        }
      } else {
        const { data, error } = await this.authService.signUpWithEmail(this.email, this.password);
        if (error) throw error;
        if (data?.user?.identities && data.user.identities.length === 0) {
          this.showMessage('Este correo ya está registrado. Inicia sesión.', true);
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
        this.showMessage('Este correo ya está registrado. Inicia sesión.', true);
      } else {
        this.showMessage('Ocurrió un error inesperado.', true);
      }
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

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

    // 🟢 Hacemos que Angular salte a la vista deseada instantáneamente
    this.ngZone.run(async () => {
      if (perfil.rol === 'admin') {
        await this.router.navigate(['/admin-panel']);
      } else {
        const expediente = await this.authService.getExpedienteClinico(perfil.id);
        await this.router.navigate([expediente ? '/panel' : '/onboarding']);
      }
    });
  }
}