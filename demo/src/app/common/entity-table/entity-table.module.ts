import { NgModule } from '@angular/core';

import {
  IgoEntityTablePaginatorModule,
  MspEntityTableModule
} from '@igo2/common';

import { SharedModule } from '../../shared/shared.module';
import { AppEntityTableRoutingModule } from './entity-table-routing.module';
import { AppEntityTableComponent } from './entity-table.component';

@NgModule({
  declarations: [AppEntityTableComponent],
  imports: [
    AppEntityTableRoutingModule,
    SharedModule,
    MspEntityTableModule,
    IgoEntityTablePaginatorModule
  ],
  exports: [AppEntityTableComponent]
})
export class AppEntityTableModule {}
