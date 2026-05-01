// src/app/app.routes.server.ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
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