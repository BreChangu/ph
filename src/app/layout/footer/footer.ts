import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WhatsappPipe } from '../../ui/whatsapp/whatsapp.pipe';
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, WhatsappPipe],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {

}
