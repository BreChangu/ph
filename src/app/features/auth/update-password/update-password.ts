import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/supabase/auth'; // Revisa tu ruta

@Component({
  selector: 'app-update-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './update-password.html',
  styleUrls: ['./update-password.scss'] // Reutilizaremos estilos del login
})
export class UpdatePasswordComponent {
  password = '';
  confirmPassword = '';
  showPassword = false;
  isLoading = false;
  message = '';
  isError = false;

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async handleUpdatePassword() {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!passwordRegex.test(this.password)) {
      this.showMessage('La contraseña no cumple con los requisitos de seguridad.', true);
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.showMessage('Las contraseñas no coinciden.', true);
      return;
    }

    this.isLoading = true;
    this.message = '';
    this.cdr.detectChanges();

    try {
      await this.authService.updatePassword(this.password);
      this.showMessage('¡Contraseña actualizada exitosamente! Redirigiendo...', false);
      
      // Esperamos 2 segundos para que el usuario lea el éxito y lo mandamos al login
      setTimeout(() => {
        this.router.navigate(['/auth']);
      }, 2000);

    } catch (error: any) {
      this.showMessage('Hubo un error al actualizar la contraseña. El enlace puede haber expirado.', true);
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
}