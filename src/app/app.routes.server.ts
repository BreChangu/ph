// src/app/app.routes.server.ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Rutas privadas: la sesión de Supabase solo existe en el navegador. Si se
  // renderizan en el servidor, el guard no ve la sesión y manda a /auth al recargar.
  { path: 'panel', renderMode: RenderMode.Client },
  { path: 'admin-panel', renderMode: RenderMode.Client },
  { path: 'onboarding', renderMode: RenderMode.Client },
  { path: 'auth/callback', renderMode: RenderMode.Client },
  { path: 'actualizar-password', renderMode: RenderMode.Client },
  {
    // Le decimos que NO pre-renderice las notas del blog individualmente
    path: 'blog/:id',
    renderMode: RenderMode.Server
  },
  {
    // Pero que el resto de la página (Home, Acerca, etc.) sí lo haga para que sea ultra rápida
    path: '**',
    renderMode: RenderMode.Prerender
  }
];