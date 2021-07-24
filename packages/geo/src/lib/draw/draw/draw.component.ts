import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  Output
} from '@angular/core';

import {
  FEATURE,
  FeatureStore,
  FeatureStoreSelectionStrategy,
  tryBindStoreLayer,
  tryAddLoadingStrategy,
  tryAddSelectionStrategy,
  FeatureMotion,
  FeatureStoreLoadingStrategy,
} from '../../feature';

import { LanguageService } from '@igo2/core';
import { MatDialog } from '@angular/material/dialog';
import { GeometryType } from '../shared/draw.enum';
import { IgoMap } from '../../map/shared/map';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Draw, FeatureWithDraw } from '../shared/draw.interface';
import { FormGroup, FormBuilder } from '@angular/forms';
import { VectorSourceEvent as OlVectorSourceEvent } from 'ol/source/Vector';
import { VectorLayer } from '../../layer/shared/layers/vector-layer';
import { FeatureDataSource } from '../../datasource/shared/datasources/feature-datasource';
import { DrawControl } from '../../geometry/shared/controls/draw';
import { EntityRecord, EntityTableTemplate } from '@igo2/common';

import * as OlStyle from 'ol/style';
import OlVectorSource from 'ol/source/Vector';
import OlGeometryType from 'ol/geom/GeometryType';
import OlPoint from 'ol/geom/Point';
import OlLineString from 'ol/geom/LineString';
import OlPolygon from 'ol/geom/Polygon';
import OlCircle from 'ol/geom/Circle';
import OlGeoJSON from 'ol/format/GeoJSON';
import OlOverlay from 'ol/Overlay';

import { getDistance } from 'ol/sphere';
import { uuid } from '@igo2/utils';
import { DrawStyleService } from '../shared/draw-style.service';
import { skip } from 'rxjs/operators';
import { DrawPopupComponent } from './draw-popup.component';
import { getTooltipsOfOlGeometry } from '../../measure/shared/measure.utils';
import { createDrawingInteractionStyle } from '../shared/draw.utils';
import { transform } from 'ol/proj';
import { DrawIconService } from '../shared/draw-icon.service';

@Component ({
  selector: 'igo-draw',
  templateUrl: './draw.component.html',
  styleUrls: ['./draw.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class DrawComponent implements OnInit, OnDestroy {

  /**
    * Table template
    * @internal
    */
  public tableTemplate: EntityTableTemplate = {
    selection: true,
    selectMany: true,
    selectionCheckbox: true,
    sort: true,
    columns: [
      {
        name: 'Drawing',
        title: this.languageService.translate.instant('igo.geo.draw.labels'),
        valueAccessor: (feature: FeatureWithDraw) => {
          return feature.properties.draw;
        }
      }
    ]
  }

  /**
    * Reference to the DrawType enum
    * @internal
    */
  public geometryType = GeometryType;

  @Output() fillColor: any;
  @Output() strokeColor: any;

  /**
    * The map to draw on
    */
  @Input() map: IgoMap;

  /**
    * The drawings store
    */
  @Input() store: FeatureStore<FeatureWithDraw>;

  /**
    * Observable of draw
    * @internal
    */
  public draw$: BehaviorSubject<Draw> = new BehaviorSubject({});

  /**
    * Wheter one of the draw control is active
    * @internal
    */
  get drawControlIsActive(): boolean {
    return this.drawControl !== undefined;
  }

  private drawControl: DrawControl;
  private olDrawSource = new OlVectorSource();
  private drawEnd$$: Subscription;
  private layer: VectorLayer;
  public selectedFeatures$: BehaviorSubject<FeatureWithDraw[]> = new BehaviorSubject([]);
  public showLabels: boolean;
  public drawsPresence: boolean = false;

  public position: string = 'bottom';
  public form: FormGroup;
  public icons: Array<string>;
  public icon: string;

  constructor(
    private languageService: LanguageService,
    private formBuilder: FormBuilder,
    private drawStyleService: DrawStyleService,
    private dialog: MatDialog,
    private drawIconService: DrawIconService
  ) {
    this.buildForm();
    this.fillColor = this.drawStyleService.getFillColor();
    this.strokeColor = this.drawStyleService.getStrokeColor();
    this.icons = this.drawIconService.getIcons();
    this.icon = this.drawStyleService.getIcon();
  }

  ngOnInit() {
    this.initStore();
    this.drawControl = this.createDrawControl(this.fillColor, this.strokeColor);
    console.log(this.drawControl)
    this.checkStoreCount();
  }

  /**
    * Clear the drawing layer and any interaction added by this component.
    * @internal
    */
  ngOnDestroy() {
    this.drawControl = undefined;
  }

  private initStore() {
    console.log('initStore')
    const store = this.store;
    this.map.removeLayer(this.layer);

    this.layer = new VectorLayer({
      title: this.languageService.translate.instant('igo.geo.draw.drawing'),
      zIndex: 200,
      source: new FeatureDataSource(),
      style: (feature, resolution) => {
        return this.drawStyleService.createDrawLayerStyle(feature, resolution, true, this.icon);
      },
      showInLayerList: true,
      exportable: true,
      browsable: false,
      workspace: {
        enabled: false
      },
    });
    tryBindStoreLayer(store, this.layer);

    tryAddLoadingStrategy(store, new FeatureStoreLoadingStrategy({
      motion: FeatureMotion.None
    }));

    tryAddSelectionStrategy(store, new FeatureStoreSelectionStrategy({
      map: this.map,
      motion: FeatureMotion.None,
      many: true
    }));

    store.source.ol.on('removefeature', (event: OlVectorSourceEvent) => {
      const olGeometry = event.feature.getGeometry();
      this.clearTooltipsOfOlGeometry(olGeometry);
    });

    store.stateView.manyBy$((record: EntityRecord<FeatureWithDraw>) => {
      return record.state.selected === true;
    }).pipe(
      skip(1)  // Skip initial emission
    ).subscribe(
      (records: EntityRecord<FeatureWithDraw>[]) => {
        this.selectedFeatures$.next(records.map(record => record.entity));
    });
  }


  /**
  * Create a OL control to draw on map
  * @param fillColor the fill color of the geometry (ex. 'rgba(255,0,0,1)')
  * @param strokeColor the stroke color of the geometry (ex. 'rgba(255,0,0,1)')
  * @param label the label of the geometry
  * @returns a OL Draw control
  */
  createDrawControl(fillColor?: string, strokeColor?: string) {
    const drawControl: DrawControl = new DrawControl({
      geometryType: undefined,
      layerSource: this.olDrawSource,
      layerStyle: new OlStyle.Style(),
      interactionStyle: createDrawingInteractionStyle(fillColor, strokeColor)
    });

    return drawControl;
  }

  /**
    * Called when the user selects a new geometry type
    * @param geometryType the geometry type selected by the user
    */
  onGeometryTypeChange(geometryType: OlGeometryType) {
    console.log('onGeometryTypeChange')
    this.drawControl.setDrawingGeometryType(geometryType);
    console.log(this.drawControl);
    this.activateDrawControl();
  }

  changeStoreLayerStyle(showLabels: boolean, icon: string) {
    console.log('changeStoreLayerStyle')
    this.drawStyleService.setFillColor(this.fillColor);
    this.drawStyleService.setStrokeColor(this.strokeColor);

    this.store.layer.ol.setStyle((feature, resolution) => {
      return this.drawStyleService.createDrawLayerStyle(feature, resolution, showLabels, icon);
    });
  }

  /**
   * Open dialog box for label and save it after closing
   * @param olGeometry
   */
  private openDialog(olGeometry: OlPoint | OlLineString | OlPolygon | OlCircle): void {
    console.log('openDialog')
    const dialogRef = this.dialog.open(DrawPopupComponent, {
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe(label => {
      this.updateLabelOfOlGeometry(olGeometry, label);
      this.onDrawEnd(olGeometry);
      this.checkStoreCount();
    });
  }

  /**
    * Activate a given control
    * @param drawControl Draw control
    */
  private activateDrawControl() {
    console.log('activateDrawControl')
    if (this.drawEnd$$) {
      this.drawEnd$$.unsubscribe();
    }

    this.drawEnd$$ = this.drawControl.end$
      .subscribe((OlGeometry: OlPoint | OlLineString | OlPolygon | OlCircle) => {
        this.openDialog(OlGeometry);
      });

      this.drawControl.setInteractions();
  }

  /**
    * Deactivate the active draw control
    */
  private deactivateDrawControl() {
    console.log('deactivateDrawControl')
    this.olDrawSource.clear();

    this.drawControl.unsetOlMap();
    this.drawControl = undefined;
  }

  /**
    * Clear the draw source and track the geometry being draw
    * @param olGeometry Ol linestring or polygon
    */
  private onDrawEnd(olGeometry: OlPoint | OlLineString | OlPolygon | OlCircle) {
    console.log('onDrawEnd')
    this.addFeatureToStore(olGeometry);
    this.clearTooltipsOfOlGeometry(olGeometry);
    this.olDrawSource.clear(true);
  }

  /**
    * Add a feature with draw label to the store. The loading stragegy of the store
    * will trigger and add the feature to the map.
    * @internal
    */
  private addFeatureToStore(olGeometry: OlPoint | OlLineString | OlPolygon | OlCircle, feature?: FeatureWithDraw) {
    console.log('addFeatureToStore')
    let rad;
    const featureId = feature ? feature.properties.id : uuid();
    const projection = this.map.ol.getView().getProjection();

    const geometry = new OlGeoJSON().writeGeometryObject(olGeometry, {
      featureProjection: projection,
      dataProjection: projection
    });

    if (olGeometry instanceof OlCircle) {
      geometry.type = 'Point';
      geometry.coordinates = olGeometry.getCenter();
      const extend4326 = transform([olGeometry.flatCoordinates[2], olGeometry.flatCoordinates[3]], projection, 'EPSG:4326');
      const center4326 = transform([olGeometry.flatCoordinates[0], olGeometry.flatCoordinates[1]], projection, 'EPSG:4326');
      rad = getDistance(center4326, extend4326);
    }

    this.store.update({
      type: FEATURE,
      geometry,
      projection: projection.getCode(),
      properties: {
        id: featureId,
        draw: olGeometry.get('_label'),
        radius: rad ? rad : undefined
      },
      meta: {
        id: featureId
      }
    });

    this.drawStyleService.incrementDrawCount();
  }

  private buildForm() {
    console.log('buildForm')
    this.form = this.formBuilder.group({
      fill: [''],
      stroke: ['']
    });
  }

  deleteDrawings() {
    console.log('deleteDrawings')
    this.store.deleteMany(this.selectedFeatures$.value);
    this.checkStoreCount();
  }

  /**
    * Clear the tooltips of an OL geometrys
    * @param olGeometry OL geometry with tooltips
    */
  private clearTooltipsOfOlGeometry(olGeometry: OlPoint | OlLineString | OlPolygon | OlCircle) {
    console.log('clearTooltipsOfOlGeometry')
    getTooltipsOfOlGeometry(olGeometry).forEach((olTooltip: OlOverlay | undefined) => {
      if (olTooltip !== undefined && olTooltip.getMap() !== undefined) {
        this.map.ol.removeOverlay(olTooltip);
      }
    });
  }

  onToggleLabels() {
    console.log('onToggleLabels')
    this.showLabels = !this.showLabels;

    this.changeStoreLayerStyle(this.showLabels, this.icon);
  }

  private updateLabelOfOlGeometry(olGeometry: OlPoint | OlLineString | OlPolygon | OlCircle, label: string) {
    console.log('updateLabelOfOlGeometry')
    olGeometry.setProperties({_label: label}, true);
  }

  onIconChange(event?) {
    console.log('onIconChange')
    this.icon = event;
    this.drawStyleService.setIcon(this.icon);
    this.store.layer.ol.setStyle((feature, resolution) => {
      return this.drawStyleService.createDrawLayerStyle(feature, resolution, true, this.icon);
    });
  }

  private checkStoreCount() {
    console.log('checkStoreCount')
    this.store.count$.getValue() !== 0 ? this.drawsPresence = true : this.drawsPresence = false;
  }
}
