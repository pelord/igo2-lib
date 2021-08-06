import { Component, OnInit, Input, AfterViewInit } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { debounceTime, skip } from 'rxjs/operators';
import { IgoMap } from '../../map/shared/map';
import { createFrameLayerStyle } from '../shared/print.util'
import { FeatureWithLimit, Limit } from '../shared/print.interface';
import { OlVectorSourceEvent } from 'ol/source/Vector';
import { OlPolygon } from 'ol/geom/polygon';
import { FeatureDataSource } from '../../datasource';

import OlVectorSource from 'ol/source/Vector';
import { FeatureStore,
  FeatureStoreSelectionStrategy,
  tryAddLoadingStrategy,
  tryAddSelectionStrategy,
  tryBindStoreLayer,
  FeatureStoreLoadingStrategy, 
  Feature,
  FeatureMotion} from '../../feature';
import { VectorLayer } from '../../layer';
import { EntityRecord } from '@igo2/common/igo2-common';
import { unByKey } from 'ol/Observable';

import { DrawControl, ModifyControl } from '../../geometry/shared';
import { PrintScale } from '../shared';
import { LimitType } from '../shared/print.enum';
import { PrintFormComponent } from '../print-form';


@Component({
  selector: 'igo-print-limit',
  templateUrl: './print-limit.component.html',
  styleUrls: ['./print-limit.component.scss']
})
export class PrintLimitComponent implements OnInit {


  private _activeLimitType: LimitType = LimitType.CentMilles;
  private activeLimitControl: DrawControl; // je ne comprends pas pourquiu draw control
  // private activeDrawControl: DrawControl;
  private olDrawSource = new OlVectorSource();
  private drawPolygonControl: DrawControl;
  private layer: VectorLayer;
  // private onFeatureAddedKey: string;
  // private onFeatureRemovedKey: string;
  public height = '250px';  
  private modifyControl: ModifyControl;
  public selectedFeatures$$: Subscription;
  public selectedFeatures$: BehaviorSubject<FeatureWithLimit[]> = new BehaviorSubject([]);
  public coordOfCentre: number[];
  @Input() map: IgoMap;
  @Input() store: FeatureStore<FeatureWithLimit>;
  // @Input() scalePrint: boolean;
  @Input()
    set activeLimitType(value: LimitType) { this.setActiveLimitType(value); }
    get activeLimitType(): LimitType { return this._activeLimitType; }
  
  
    get drawControlIsActive(): boolean {
    return this.activeLimitControl !== undefined;
  }
  private format: string = '';
  private scale: string = '';
  public selectedScale$$: Subscription;
  public selectedFormat$$: Subscription;


  constructor() {}

  ngOnInit() {
    
    this.listenScaleFormat();
    this.initStore();
    this.afficherLimit();

  }

  ngOnDestroy() {
    this.setActiveLimitType(undefined);
    this.delLimit();
    this.selectedFormat$$.unsubscribe();
    this.selectedScale$$.unsubscribe();
  }

  private initStore() {
    
    const store = this.store;
    this.map.removeLayer(this.layer);

    this.layer = new VectorLayer({
      title: 'Limit',
      zIndex: 200,
      source: new FeatureDataSource(),
      style: createFrameLayerStyle('gold',0.2),
      showInLayerList: true,
      exportable: true,
      browsable: false
    });
    tryBindStoreLayer(store, this.layer);
    tryAddLoadingStrategy(store, new FeatureStoreLoadingStrategy({
      motion: FeatureMotion.None
    }));
    tryAddSelectionStrategy(store, new FeatureStoreSelectionStrategy({
      map:this.map,
      motion: FeatureMotion.None,
      many:true
    }));


    store.source.ol.on('removefeature', (event: OlVectorSourceEvent) => {
      const olGeometry = event.feature.getGeometry();
      // this.clearTooltipsOfOlGeometry(olGeometry);
    });

    store.stateView.manyBy$((record: EntityRecord<FeatureWithLimit>) => {
        return record.state.selected === true;
    }).pipe(
        skip(1)  // Skip initial emission
    )
    .subscribe((records: EntityRecord<FeatureWithLimit>[]) => {
        this.selectedFeatures$.next(records.map(record => record.entity));
    });
    
  }

  private setActiveLimitType(drawType: LimitType) {
    this._activeLimitType = drawType;
    // this.toggleDrawControl();
  }

  limitOfPrint(format:string, scale:string): Array<number> {
    let coord = [];
    const center2 = this.map.viewController.getCenter('EPSG:32187').map(coord => coord.toFixed(5));
    const delta = this.calculDelta(format, scale);
    const dN = delta[0];
    const dE = delta[1];
    const center = [parseFloat(center2[0]), parseFloat(center2[1])];
    const NE = [center[0] + dE, center[1] + dN];
    const NO = [center[0] - dE, center[1] + dN];
    const SO = [center[0] - dE, center[1] - dN];
    const SE = [center[0] + dE, center[1] - dN];
    coord.push(NE,NO,SO,SE);
    return coord;
  }

  calculDelta(format:string, scale:string): Array<number>{
    if (format === 'Letter') {
      const dimHor = 27.9;
      const dimVert = 21.6;
      if(scale === '1:2000') {
        const coef = 20;
        return [dimHor*coef, dimVert*coef];
      }
      else {return [800,1000]}
    }
    else {return [800,1000]}
  }

  afficherLimit() {
    const coord = this.limitOfPrint(this.format, this.scale);
    this.createLimit(coord);
  }


  createLimit(coordinates: Array<number>) {
    this.delLimit();
    const lonlat = this.map.viewController.getCenter('EPSG:4326');
    const zoneMtm = this.zoneMtm(lonlat[0]);

    // console.log('creation d\'une limite');
    this.store.load([
      {
        meta: { id: 3 },
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        },
        projection: `EPSG:3218${zoneMtm}`,
        properties: {
          id: '1'
        }
      }
    ]);
  }

  delLimit() {
    // console.log('efface limite')
    this.store.clear();
  }

  listenScaleFormat() {   // je n'aime pas le façon dont je l'ai fait (en passant par this.map...)
    // il n'écoute pas. il est souscrit, mais quand je change selectedScale$, $$ ne reagit pas. 
    this.selectedScale$$ = this.map.selectedScale$.subscribe((scale)=> {
      this.scale = scale;
      console.log(scale, 'scale');
      this.afficherLimit();}
      );
    this.selectedFormat$$  = this.map.selectedFormat$.subscribe((format)=> {
      this.format = format;
      console.log(format, 'format');
      this.afficherLimit()}
      );
  }

  zoneMtm(lon: number): number {
    let lonMin = -54;
    const deltaLon = 3;
    let zone = 2;
    while (Math.abs(lon - lonMin) > deltaLon){
      lonMin = lonMin - deltaLon;
      zone ++;
    }
    return zone;
  }
}
