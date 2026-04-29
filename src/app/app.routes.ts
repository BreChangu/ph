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
      },

      {
        path: 'servicios', // Nueva ruta (pabloherrera.com/servicios)
        loadComponent: () => import('./features/servicios/servicios').then(m => m.Servicios)
      },
      {
        path: 'acerca', // Nueva ruta (pabloherrera.com/acerca)
        loadComponent: () => import('./features/acerca/acerca').then(m => m.Acerca)
      }
    ]
  },

  // Redirección 404
  {
    path: '**',
    redirectTo: ''
  }
];