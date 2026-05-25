import { TestBed } from '@angular/core/testing';

import { PlanNutricionalService } from './plan-nutricional.service';

describe('PlanNutricionalService', () => {
  let service: PlanNutricionalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlanNutricionalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
