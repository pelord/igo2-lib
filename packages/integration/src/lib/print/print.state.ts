import { Injectable } from '@angular/core';

import { FeatureStore, PrintTest  } from '@igo2/geo';
import { MapState } from '../map/map.state';

/**
 * Service that holds the state of the measure module
 */
@Injectable({
  providedIn: 'root'
})
export class PrintState {

  /**
   * Store that holds the measures
   */
  public store: FeatureStore<PrintTest> = new FeatureStore<PrintTest>([], {
    map: this.mapState.map
  });

  constructor(private mapState: MapState) {}

}
