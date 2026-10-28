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
  isLoadingGoogle = false;
  showPassword = false;
  isAccountReview = false;
  accountReviewTitle = '';
  message = '';
  isError = false;

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private ngZone: NgZone
  ) {}

  async ngOnInit() {
    const authError = this.route.snapshot.queryParamMap.get('error');
    if (authError) {
      this.showMessage(
        authError === 'perfil_no_encontrado'
          ? 'No encontramos un perfil asociado a esta cuenta. Contacta a tu coach.'
          : 'No pudimos completar el inicio de sesión. Inténtalo nuevamente.',
        true,
      );
      this.router.navigate(['/auth'], { replaceUrl: true });
      return;
    }

    // 1. 🔴 Revisamos si el Guardia nos expulsó por cuenta pendiente
    const approvalStatus = this.route.snapshot.queryParamMap.get('pendiente');
    const isPendiente = approvalStatus === '1' || approvalStatus === 'suspendido';
    
    if (isPendiente) {
      await this.authService.signOut();
      this.isAccountReview = true;
      this.accountReviewTitle = approvalStatus === 'suspendido'
        ? 'CUENTA SUSPENDIDA'
        : 'ESTAMOS REVISANDO TU CUENTA';
      this.showMessage(
        approvalStatus === 'suspendido'
          ? 'Tu cuenta está suspendida. Contacta a tu coach para recibir ayuda.'
          : 'Tu cuenta está en revisión. Te avisaremos cuando el Coach la apruebe.',
        true,
      );

      // 🟢 Limpiamos la URL para romper el bucle infinito al recargar o navegar
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { pendiente: null }, 
        queryParamsHandling: 'merge', 
        replaceUrl: true 
      });

      return;
    }

    // 2. Revisamos si fue un cierre de sesión manual
    if (this.route.snapshot.queryParamMap.get('signedOut') === '1') {
      await this.authService.signOut();
      
      // 🟢 Limpiamos el query param de la URL
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { signedOut: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
      return;
    }

    // 3. 🟢 Esperamos a que Supabase procese el token de Google si viene en el hash de la URL
    const hash = typeof window === 'undefined' ? '' : window.location.hash;
    if (hash && hash.includes('access_token')) {
      // Retraso de 500ms para asegurar que Supabase extrajo la sesión del OAuth
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 4. Flujo normal: Evaluamos sesión activa y redirigimos
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

  volverAlLogin(): void {
    this.isAccountReview = false;
    this.message = '';
    void this.router.navigate(['/auth'], { replaceUrl: true });
  }

  volverAlInicio(): void {
    void this.router.navigate(['/'], { replaceUrl: true });
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
    this.isLoadingGoogle = true;
    try {
      await this.authService.signInWithGoogle();
    } catch (error) {
      console.error('Error al iniciar sesión con Google:', error);
      this.isLoadingGoogle = false;
      this.showMessage('Hubo un error al conectar con Google.', true);
    }
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

 private async redirigirUsuarioAutenticado(
  userId: string,
  email?: string
): Promise<void> {
  this.isLoading = false;
  this.isLoadingGoogle = false;

  try {
    // Usar la misma lógica centralizada que utiliza Google.
    const destino =
      await this.authService.getAuthenticatedDestination(userId, email);

    const estadoPendiente = destino.queryParams?.['pendiente'];
    const errorAuth = destino.queryParams?.['error'];

    // Si la cuenta debe permanecer en revisión, mostrar el estado
    // directamente en el componente de autenticación.
    if (estadoPendiente) {
      const suspendida = estadoPendiente === 'suspendido';

      this.isAccountReview = true;
      this.accountReviewTitle = suspendida
        ? 'CUENTA SUSPENDIDA'
        : 'ESTAMOS REVISANDO TU CUENTA';

      this.showMessage(
        suspendida
          ? 'Tu cuenta está suspendida. Contacta a tu coach para recibir ayuda.'
          : 'Tu cuenta está en revisión. Te avisaremos cuando el Coach la apruebe.',
        true
      );

      return;
    }

    // Tratar los errores de autenticación sin intentar entrar al panel.
    if (errorAuth) {
      this.showMessage(
        errorAuth === 'perfil_no_encontrado'
          ? 'No encontramos un perfil asociado a esta cuenta. Contacta a tu coach.'
          : 'No pudimos verificar tu acceso. Inténtalo nuevamente.',
        true
      );

      return;
    }

    // Navegación centralizada para todos los demás casos.
    await this.router.navigate(destino.commands, {
      queryParams: destino.queryParams,
      replaceUrl: true
    });

  } catch (error) {
    console.error('Error al determinar el destino del usuario:', error);

    this.showMessage(
      'No pudimos verificar tu acceso. Inténtalo nuevamente.',
      true
    );
  } finally {
    this.isLoading = false;
    this.isLoadingGoogle = false;
    this.cdr.detectChanges();
  }
}
}
