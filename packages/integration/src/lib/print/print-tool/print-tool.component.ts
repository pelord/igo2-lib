import { Component } from '@angular/core';

import { ToolComponent } from '@igo2/common';
import { IgoMap, FeatureStore, PrintTest } from '@igo2/geo';
import { MapState } from '../../map/map.state';
import { PrintState } from '../print.state';
import { MeasureState } from '../../measure/measure.state';


@ToolComponent({
  name: 'print',
  title: 'igo.integration.tools.print',
  icon: 'printer'
})
@Component({
  selector: 'igo-print-tool',
  templateUrl: './print-tool.component.html'
})
export class PrintToolComponent {

  get store(): FeatureStore<PrintTest> { 
    return this.printState.store;
  }
  
  get map(): IgoMap {
    return this.mapState.map;
  }


  constructor(
    private mapState: MapState,
    private printState: PrintState
    ) {}
}
