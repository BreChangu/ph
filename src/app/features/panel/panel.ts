import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/supabase/auth'; // Revisa que la ruta sea correcta

@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './panel.html',
  styleUrls: ['./panel.scss']
})
export class PanelComponent {
  
  // Variables de demostración (Luego las traeremos de Supabase)
  userName = 'Fernando'; 
  fechaHoy = new Date().toLocaleDateString('es-ES', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  constructor(
    private authService: AuthService, 
    private router: Router
  ) {}

  // Nuestra función oficial para salir
  async logout() {
    try {
      await this.authService.signOut();
      this.router.navigate(['/auth']); 
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }
}