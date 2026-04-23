import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    // Ruta exacta basada en tu captura de pantalla
    loadComponent: () => import('./layout/public-layout/public/public.layout').then(m => m.PublicLayout),
    children: [
      {
        path: '', 
        // Asumiendo que home se generó siguiendo la misma regla limpia
        loadComponent: () => import('./features/home/home').then(m => m.Home)
      }
    ]
  },

  // Redirección 404
  {
    path: '**',
    redirectTo: ''
  }
];