import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router'; // Añadimos Router para la redirección al salir
import { AuthService } from '../../core/supabase/auth'; // 🟢 Ajusta esta ruta si es necesario

@Component({
  selector: 'app-navbar',
  imports: [RouterLink], // RouterLink se queda, es vital para no recargar la página
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnInit {
  // Variable de estado para controlar el menú móvil
  isMenuOpen = false;
  
  // 🟢 Variables de estado para la sesión
  isLoggedIn = false;
  isAdmin = false; 

  // Inyecciones de dependencias
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); // El despertador de Angular

  async ngOnInit() {
    // 1. Verificamos la sesión inicial
    await this.verificarEstadoSesion();

    // 2. Escuchamos cambios en tiempo real (por si inicias o cierras sesión en otra pestaña)
    this.authService['supabase'].auth.onAuthStateChange(async (event, session) => {
      await this.verificarEstadoSesion();
    });
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
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  closeMenu() {
    this.isMenuOpen = false;
    document.body.style.overflow = '';
  }

  // 🟢 Función para redirigir al usuario según su rol
  irAlPanel() {
    this.closeMenu(); // Cerramos el menú para que no estorbe
    if (this.isAdmin) {
      this.router.navigate(['/admin-panel']);
    } else {
      this.router.navigate(['/panel']);
    }
  }

  // 🟢 Función para cerrar sesión desde el menú
  async cerrarSesion() {
    await this.authService.signOut();
    this.closeMenu();
    this.router.navigate(['/']); // Te regresa a la página de inicio al salir
  }
}