import { Routes } from '@angular/router';
import path from 'path';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    // Ruta exacta basada en tu configuración
    loadComponent: () =>
      import('./layout/public-layout/public/public.layout').then((m) => m.PublicLayout),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'servicios',
        loadComponent: () => import('./features/servicios/servicios').then((m) => m.Servicios),
      },
      {
        path: 'acerca',
        loadComponent: () => import('./features/acerca/acerca').then((m) => m.Acerca),
      },
      {
        path: 'blog',
        loadComponent: () => import('./features/blog/blog').then((m) => m.BlogComponent),
      },
      {
        path: 'blog/:id',
        // 🛑 FIX: Ajustado al nombre corto de archivo que usa tu proyecto
        loadComponent: () => import('./features/blog-detail/blog-detail').then((m) => m.BlogDetail),
      },

      {
        path: 'auth',
        loadComponent: () => import('./features/auth/auth').then((m) => m.AuthComponent),
      },
      {
        path: 'panel',
        canActivate: [authGuard], // <--- EL CADENERO: Solo pasa si Supabase dice que sí
        loadComponent: () => import('./features/panel/panel').then((m) => m.PanelComponent),
      },
      {
        path: 'admin-panel',
        canActivate: [authGuard],
    loadComponent: () => import('./features/admin/admin-panel/admin-panel').then((m) => m.AdminPanelComponent),
      },

      {
        path: 'actualizar-password',
        loadComponent: () =>
          import('./features/auth/update-password/update-password').then(
            (m) => m.UpdatePasswordComponent,
          ),
      },
    ],
  },
  // Redirección 404 (Siempre va al final)
  // {
  //   path: '**',
  //   redirectTo: ''
  // }
];
