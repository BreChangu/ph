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
    try {
      const session = await this.authService.completeOAuthCallback();
      if (!session?.user) {
        await this.router.navigate(['/auth'], {
          queryParams: { error: 'oauth_sin_sesion' },
          replaceUrl: true,
        });
        return;
      }

      const destination = await this.authService.getAuthenticatedDestination(session.user.id, session.user.email);
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
