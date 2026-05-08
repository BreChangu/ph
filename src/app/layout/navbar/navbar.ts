import { Component, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../core/supabase/auth';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  isMenuOpen = false;

  public authService = inject(AuthService);
  private router = inject(Router);

  // 🟢 Angular lee directamente el Signal del servicio. Sin hacks.
  get isLoggedIn() { return this.authService.isLoggedIn(); }
  get isAdmin() { return this.authService.isAdmin(); }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
    document.body.style.overflow = this.isMenuOpen ? 'hidden' : '';
  }

  closeMenu() {
    this.isMenuOpen = false;
    document.body.style.overflow = '';
  }

  irAlPanel() {
    this.closeMenu();
    this.router.navigate([this.isAdmin ? '/admin-panel' : '/panel']);
  }

  async cerrarSesion() {
    this.closeMenu();
    // 🟢 Solo llamamos a signOut(). Supabase y Signals hacen el resto automáticamente.
    await this.authService.signOut();
    this.router.navigate(['/auth']);
  }
}