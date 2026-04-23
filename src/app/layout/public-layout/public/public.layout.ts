import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Navbar } from '../../navbar/navbar';
import { Footer } from '../../footer/footer';

@Component({
  selector: 'app-public',
  standalone: true,
  imports: [RouterOutlet, Navbar,Footer],
  templateUrl: './public.layout.html',
  styleUrl: './public.layout.scss',
})
export class PublicLayout {

}
