import { Directive, HostListener, EventEmitter, OnInit, OnDestroy, Input } from '@angular/core';

import { BehaviorSubject, Subscription } from 'rxjs';

import { MessageService, ConfigService } from '@igo2/core';
import { ConfirmDialogService, DragAndDropDirective } from '@igo2/common';

import { Feature } from '../../feature/shared/feature.interfaces';
import { IgoMap } from '../../map/shared/map';
import { MapBrowserComponent } from '../../map/map-browser/map-browser.component';
import { ImportService } from './import.service';
import { handleFileImportSuccess, handleFileImportError } from '../shared/import.utils';
import { StyleService } from '../../style/style-service/style.service';
import { StyleListService } from '../../style/style-list/style-list.service';
import { concatMap, first, skipWhile } from 'rxjs/operators';
import { LayerService } from '../../layer/shared/layer.service';
import { ImportExportServiceOptions } from './import.interface';

@Directive({
  selector: '[igoDropGeoFile]'
})
export class DropGeoFileDirective extends DragAndDropDirective implements OnInit, OnDestroy {

  protected filesDropped: EventEmitter<File[]> = new EventEmitter();
  protected filesInvalid: EventEmitter<File[]> = new EventEmitter();
  private epsgCode$: BehaviorSubject<string> = new BehaviorSubject(undefined);
  private epsgCode$$: Subscription[] = [];
  private filesDropped$$: Subscription;

  get map(): IgoMap {
    return this.component.map;
  }

  @Input() contextUri: string;

  constructor(
    private component: MapBrowserComponent,
    private importService: ImportService,
    private styleListService: StyleListService,
    private styleService: StyleService,
    private config: ConfigService,
    private messageService: MessageService,
    private layerService: LayerService,
    private confirmDialogService: ConfirmDialogService
  ) {
    super();
  }

  ngOnInit() {
    this.filesDropped$$ = this.filesDropped.subscribe((files: File[]) => {
      this.onFilesDropped(files);
    });
  }

  ngOnDestroy() {
    this.filesDropped$$.unsubscribe();
  }

  @HostListener('dragover', ['$event'])
  public onDragOver(evt) {
    super.onDragOver(evt);
  }

  @HostListener('dragleave', ['$event'])
  public onDragLeave(evt) {
    super.onDragLeave(evt);
  }

  @HostListener('drop', ['$event'])
  public onDrop(evt) {
    super.onDrop(evt);
  }

  private onFilesDropped(files: File[]) {
    for (const file of files) {
      this.detectEPSG(file);
      this.epsgCode$$.push(
        this.epsgCode$.pipe(
          skipWhile((code) => !code),
          first(),
          concatMap(epsgCode => {
            const epsg = epsgCode === 'epsgNotDefined' ? undefined : epsgCode;
            this.epsgCode$.next(undefined);
            return this.importService.import(file, epsg);
          }),
        ).subscribe(
          (features: Feature[]) => this.onFileImportSuccess(file, features),
          (error: Error) => this.onFileImportError(file, error)
        ));
    }
  }

  private detectEPSG(file: File, nbLines: number = 500) {
    if (!file.name.toLowerCase().endsWith('.geojson') && !file.name.toLowerCase().endsWith('.gml')) {
      this.epsgCode$.next('epsgNotDefined');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (file.name.toLowerCase().endsWith('.geojson')) {
        const geojson = JSON.parse(reader.result as string);
        if (geojson.crs?.properties?.name) {
          const epsg = geojson.crs.properties.name.match(/EPSG:{1,2}\d{0,6}/gm);
          if (epsg !== null && epsg.length) {
            this.epsgCode$.next(epsg[0].replace(/::/g, ':'));
            return;
          } else {
            this.epsgCode$.next('epsgNotDefined');
            return;
          }
        } else {
          this.epsgCode$.next('epsgNotDefined');
          return;
      }
      } else if (file.name.toLowerCase().endsWith('.gml')) {
        const text = (reader.result as string);
        const lines = (text as string).split('\n');
        for (let line = 0; line <= nbLines; line++) {
          const epsg = lines[line].match(/EPSG:\d{0,6}/gm);
          if (epsg !== null && epsg.length) {
              this.epsgCode$.next(epsg[0]);
              break;
          } else {
            this.epsgCode$.next(undefined);
            return;
          }
        }
      } else {
        this.epsgCode$.next('epsgNotDefined');
        return;
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  private onFileImportSuccess(file: File, features: Feature[]) {
    const importExportOptions = this.config.getConfig('importExport') as ImportExportServiceOptions;
    const importWithStyle =importExportOptions?.importWithStyle || this.config.getConfig('importWithStyle');
    if (this.config.getConfig('importWithStyle')) {
      console.warn(`
      The location of this config importWithStyle is deprecated.
      Please move this property within importExport configuration.
      Ex: importWithStyle: true/false must be transfered to importExport: { importWithStyle: true/false }
      Refer to environnement.ts OR config/config.json
      This legacy conversion will be deleted in 2024.
      `);
    }
    const confirmDialogService = importExportOptions?.allowToStoreLayer ? this.confirmDialogService : undefined;
    if (!importWithStyle) {
      handleFileImportSuccess(
        file,
        features,
        this.map,
        this.contextUri,
        this.messageService,
        this.layerService,
        confirmDialogService);
    } else {
      handleFileImportSuccess(file, features, this.map, this.contextUri, this.messageService,
        this.layerService, confirmDialogService, this.styleListService, this.styleService);
    }
  }

  private onFileImportError(file: File, error: Error) {
    handleFileImportError(
      file,
      error,
      this.messageService,
      this.config.getConfig('importExport.clientSideFileSizeMaxMb'));
  }
}
