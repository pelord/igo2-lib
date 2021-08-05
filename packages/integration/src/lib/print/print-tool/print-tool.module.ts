import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { IgoMeasurerModule } from '@igo2/geo';

import { PrintToolComponent } from './print-tool.component';

/**
 * @ignore
 */
@NgModule({
  imports: [
    IgoMeasurerModule
  ],
  declarations: [PrintToolComponent],
  exports: [PrintToolComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class IgoAppMeasurerToolModule {}
