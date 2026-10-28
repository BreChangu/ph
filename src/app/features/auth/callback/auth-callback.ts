import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/supabase/auth';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './auth-callback.html',
  styleUrls: ['./auth-callback.scss'],
})
export class AuthCallbackComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  error = '';

  async ngOnInit() {

console.log('[OAuth callback] Inicio', {
    ruta: window.location.pathname,
    tieneCode: new URLSearchParams(window.location.search).has('code'),
    tieneAccessToken: new URLSearchParams(
      window.location.hash.slice(1)
    ).has('access_token'),
    tieneError: new URLSearchParams(window.location.search).has('error'),
  });


    try {
      const session = await this.authService.completeOAuthCallback();
      if (!session?.user) {
        await this.router.navigate(['/auth'], {
          queryParams: { error: 'oauth_sin_sesion' },
          replaceUrl: true,
        });
        return;
      }

      const destination = await this.authService.getAuthenticatedDestination(
        session.user.id,
        session.user.email,
      );

      console.log('[OAuth] Ruta del callback:', window.location.pathname);
      console.log('[OAuth] Destino calculado:', destination.commands);
      console.log('[OAuth] Parámetros de destino:', destination.queryParams ?? {});

      await this.router.navigate(destination.commands, {
        queryParams: destination.queryParams,
        replaceUrl: true,
      });
    } catch (error) {
      console.error('Error resolviendo el callback de Google:', error);
      this.error = 'No pudimos verificar tu acceso. Intenta iniciar sesión nuevamente.';
      this.cdr.detectChanges();
    }
  }
}
