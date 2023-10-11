import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { IgoStopPropagationModule } from '../../stop-propagation/stop-propagation.module';
import { IgoCustomHtmlModule } from '../../custom-html/custom-html.module';
import { MspEntityTableComponent } from './msp-entity-table.component';
import { MatPaginatorModule } from '@angular/material/paginator';
import { IgoEntityTablePaginatorModule } from '../entity-table-paginator/entity-table-paginator.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { IgoEntityTableCellsModule } from '../entity-table-cells/entity-table-cells.module';
import { IgoEntityFieldsModule } from '../entity-fields/entity-fields.module';
import { EntityTableRowDirective } from '../entity-table/entity-table-row.directive';

/**
 * @ignore
 */
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IgoCustomHtmlModule,
    IgoEntityFieldsModule,
    IgoEntityTablePaginatorModule,
    IgoEntityTableCellsModule,
    IgoStopPropagationModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    ReactiveFormsModule
  ],
  exports: [MspEntityTableComponent],
  declarations: [MspEntityTableComponent, EntityTableRowDirective]
})
export class MspEntityTableModule {}
