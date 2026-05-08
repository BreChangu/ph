import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router'; // Añadimos Router para la redirección al salir
import { AuthService } from '../../core/supabase/auth'; // 🟢 Ajusta esta ruta si es necesario

@Component({
  selector: 'app-navbar',
  imports: [RouterLink], // RouterLink se queda, es vital para no recargar la página
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnInit, OnDestroy {
  // Variable de estado para controlar el menú móvil
  isMenuOpen = false;

  // 🟢 Variables de estado para la sesión
  isLoggedIn = false;
  isAdmin = false;

  // Inyecciones de dependencias
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); // El despertador de Angular
  private authSubscription: { unsubscribe: () => void } | null = null;

  async ngOnInit() {
    // 1. Verificamos la sesión inicial
    await this.verificarEstadoSesion();

    // 2. Escuchamos cambios en tiempo real (por si inicias o cierras sesión en otra pestaña)
    const { data } = this.authService.onAuthStateChange(async () => {
      await this.verificarEstadoSesion();
    });
    this.authSubscription = data.subscription;
  }

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
    this.setBodyOverflow('');
  }

  // 🟢 Función maestra para saber quién está navegando
  async verificarEstadoSesion() {
    const session = await this.authService.getSession();

    if (session) {
      this.isLoggedIn = true;
      // Consultamos el rol para saber a qué panel mandarlo
      const perfil = await this.authService.getUserProfile(session.user.id);
      this.isAdmin = perfil?.rol === 'admin';
    } else {
      this.isLoggedIn = false;
      this.isAdmin = false;
    }

    // Le avisamos a Angular que actualice los botones visualmente
    this.cdr.detectChanges();
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
    // Detalle de UX Premium: Bloquear el scroll del fondo cuando el menú está abierto
    if (this.isMenuOpen) {
      this.setBodyOverflow('hidden');
    } else {
      this.setBodyOverflow('');
    }
  }

  closeMenu() {
    this.isMenuOpen = false;
    this.setBodyOverflow('');
  }

  // 🟢 Función para cerrar sesión desde el menú
  async cerrarSesion() {
    this.authService.clearLocalSession();
    this.isLoggedIn = false;
    this.isAdmin = false;
    this.closeMenu();
    await this.router.navigate(['/auth'], { queryParams: { signedOut: '1' } });
    this.cdr.detectChanges();
    this.authService.signOut().catch((error) => console.error('Error al cerrar sesión:', error));
  }

  async irAlPanel() {
    this.closeMenu();
    if (!this.isLoggedIn) {
      await this.router.navigate(['/auth']);
      return;
    }

    await this.router.navigate([this.isAdmin ? '/admin-panel' : '/panel']);
  }

  private setBodyOverflow(value: '' | 'hidden') {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = value;
    }
  }
}
