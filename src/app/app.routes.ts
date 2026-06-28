import { Routes } from '@angular/router';

// 🟢 FIX: Importamos el cadenero (la FUNCIÓN), no el servicio.
// Asegúrate de que la ruta coincida con donde guardaste tu auth.guard.ts
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
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
        path: 'suplementos',
        loadComponent: () => import('./features/suplementos/suplementos').then((m) => m.Suplementos),
      },
      {
        path: 'blog/:id',
        loadComponent: () => import('./features/blog-detail/blog-detail').then((m) => m.BlogDetail),
      },

      {
        path: 'auth',
        loadComponent: () => import('./features/auth/auth').then((m) => m.AuthComponent),
      },
      {
        path: 'panel',
        canActivate: [authGuard], // <--- AHORA SÍ ES EL CADENERO CORRECTO
        loadComponent: () => import('./features/panel/panel').then((m) => m.PanelComponent),
      },
      {
        path: 'admin-panel',
        canActivate: [authGuard], // <--- AHORA SÍ ES EL CADENERO CORRECTO
        loadComponent: () => import('./features/admin/admin-panel/admin-panel').then((m) => m.AdminPanelComponent),
      },
      {
        path: 'onboarding',
        canActivate: [authGuard], // <--- AHORA SÍ ES EL CADENERO CORRECTO
        loadComponent: () =>
          import('./features/paciente/onboarding/onboarding').then((m) => m.Onboarding),
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
  {
    path: '**',
    redirectTo: ''
  }
];
