import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Home } from '../../features/home/home';
import { Servicios } from '../../features/servicios/servicios';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink,Home,Servicios],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {

  // Variable de estado para controlar el menú móvil
  isMenuOpen = false;

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
}

