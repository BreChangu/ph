import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ServicePackage } from '../../core/models/service-package.model';
import { ServicePackagesService } from '../../core/services/service-packages';
import { WhatsappPipe } from '../../ui/whatsapp/whatsapp.pipe';

@Component({
  selector: 'app-servicios',
  imports: [CommonModule, WhatsappPipe],
  templateUrl: './servicios.html',
  styleUrl: './servicios.scss',
})
export class Servicios implements OnInit {
  private packagesService = inject(ServicePackagesService);

  servicePackages: ServicePackage[] = [];
  selectedPackage: ServicePackage | null = null;

  ngOnInit() {
    this.packagesService.getPublishedPackages().subscribe((packages) => {
      this.servicePackages = packages;
    });
  }

  openPackage(servicePackage: ServicePackage) {
    this.selectedPackage = servicePackage;
  }

  closePackage() {
    this.selectedPackage = null;
  }
}
