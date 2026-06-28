import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ServicePackage } from '../../core/models/service-package.model';
import { ServicePackagesService } from '../../core/services/service-packages';

@Component({
  selector: 'app-servicios',
  imports: [CommonModule],
  templateUrl: './servicios.html',
  styleUrl: './servicios.scss',
})
export class Servicios implements OnInit {
  private packagesService = inject(ServicePackagesService);

  servicePackages: ServicePackage[] = [];

  ngOnInit() {
    this.packagesService.getPublishedPackages().subscribe((packages) => {
      this.servicePackages = packages;
    });
  }
}
