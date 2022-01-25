import { Component, Input } from '@angular/core';
import { ToolComponent } from '@igo2/common';
import { MeasureLengthUnit } from '@igo2/geo';
import { BehaviorSubject } from 'rxjs';

@ToolComponent({
  name: 'oyl',
  title: 'igo.integration.tools.closestFeature',
  icon: 'radius'
})

/**
 * Tool to handle the advanced map tools
 */
@Component({
  selector: 'igo-oyl-map-tool',
  templateUrl: './oyl-map-tool.component.html',
  styleUrls: ['./oyl-map-tool.component.scss']
})

export class OylMapToolComponent {
  /**
   * Available measure units for the measure type given
   * @internal
   */
   get measureUnits(): string[] {
    return [MeasureLengthUnit.Meters, MeasureLengthUnit.Kilometers];
  }
  @Input()
  get maxDistance() {
    return this.maxDistance$.value;
  }
  set maxDistance(value: number) {
    this.maxDistance$.next(value);
  }

  public maxDistance$: BehaviorSubject<number> = new BehaviorSubject(30);

  public measureUnit$: BehaviorSubject<MeasureLengthUnit> = new BehaviorSubject(MeasureLengthUnit.Meters);

  onMeasureUnitChange(unit: MeasureLengthUnit) {
    this.measureUnit$.next(unit);
  }
}
