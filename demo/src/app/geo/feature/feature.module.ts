import { NgModule } from '@angular/core';

import { IgoPanelModule, MspEntityTableModule } from '@igo2/common';
import { IgoFeatureModule, IgoMapModule } from '@igo2/geo';

import { SharedModule } from '../../shared/shared.module';
import { AppFeatureRoutingModule } from './feature-routing.module';
import { AppFeatureComponent } from './feature.component';

@NgModule({
  declarations: [AppFeatureComponent],
  imports: [
    SharedModule,
    AppFeatureRoutingModule,
    IgoPanelModule,
    MspEntityTableModule,
    IgoMapModule,
    IgoFeatureModule
  ],
  exports: [AppFeatureComponent]
})
export class AppFeatureModule {}
