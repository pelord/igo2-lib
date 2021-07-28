import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  Output,
  ChangeDetectorRef
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

import { olColor as OlColor } from 'ol/color';
import OlVectorSource from 'ol/source/Vector';
import OlGeometryType from 'ol/geom/GeometryType'
import OlCollection from 'ol/Collection'
import OlCircle from 'ol/geom/Circle';
import OlGeoJSON from 'ol/format/GeoJSON';
import OlOverlay from 'ol/Overlay';
import { getDistance } from 'ol/sphere';
import { uuid } from '@igo2/utils';
import { DrawStyleService } from '../shared/draw-style.service';
import { skip } from 'rxjs/operators';
import { DrawPopupComponent } from './draw-popup.component';
import { getTooltipsOfOlGeometry } from '../../measure/shared/measure.utils';
import { createInteractionStyle } from '../shared/draw.utils';
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
  };

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
   * The draws store
   */
  @Input() store: FeatureStore<FeatureWithDraw>;

  /**
   * Observable of draw
   * @internal
   */
  public draw$: BehaviorSubject<Draw> = new BehaviorSubject({});

  private activeGeometryType: GeometryType;
  private drawControl: DrawControl;
  private drawEnd$$: Subscription;
  private modify$$: Subscription;
  private layer: VectorLayer;
  public selectedFeatures$: BehaviorSubject<FeatureWithDraw[]> = new BehaviorSubject([]);
  public showLabels: boolean;
  public drawControlToggleDisabled: boolean = true;
  public drawControlToggleToggled: boolean;
  public fillForm: string;
  public strokeForm: string;
  public drawsPresence: boolean = false;

  public form: FormGroup;
  public icons: Array<string>;
  public icon: string;

  constructor(
    private languageService: LanguageService,
    private formBuilder: FormBuilder,
    private drawStyleService: DrawStyleService,
    private dialog: MatDialog,
    private drawIconService: DrawIconService,
    private cdRef: ChangeDetectorRef
  ) {
    this.buildForm();
    this.fillColor = this.drawStyleService.getFillColor();
    this.strokeColor = this.drawStyleService.getStrokeColor();
    this.showLabels = this.drawStyleService.getLabelsToggleToggled();
    this.icons = this.drawIconService.getIcons();
    this.icon = this.drawStyleService.getIcon();
  }

  /**
   * Initialize the con
   */
  ngOnInit() {
    this.initStore();
    this.drawControl = this.createDrawControl(this.fillColor, this.strokeColor);
    this.checkStoreCount();
  }

  /**
   * Clear the overlay layer and any interaction added by this component.
   * @internal
   */
  ngOnDestroy() {
    this.deactivateDrawControl();
  }

  /**
   * Create an OL Draw Control
   * @param fillColor the fill color of the geometry (ex. 'rgba(255,0,0,1)')
   * @param strokeColor the stroke color of the geometry (ex. 'rgba(255,0,0,1)')
   * @param label the label of the geometry
   * @returns an OL Draw Control
   */
  createDrawControl(fillColor?: OlColor, strokeColor?: OlColor, label?: string) {
    const drawControl: DrawControl = new DrawControl({
      geometryType: undefined,
      drawingLayerSource: new OlVectorSource(),
      interactionStyle: createInteractionStyle(fillColor, strokeColor, label),
    });

    return drawControl;
  }

  /**
   * Called when the user selects a new geometry type
   * @param geometryType geometry type selected by the user
   */
  onGeometryTypeChange(geometryType: GeometryType) {
    this.drawControlToggleDisabled = false;
    this.activeGeometryType = geometryType;
    this.toggleDrawControl();
  }

  /**
   * Initialize layer (store) that will store the drawings
   */
  private initStore() {
    this.map.removeLayer(this.layer);

    // Create a layer that will be displayed in Map
    this.layer = new VectorLayer({
      title: this.languageService.translate.instant('igo.geo.draw.drawing'),
      zIndex: 200,
      source: new FeatureDataSource(),
      style: (feature, resolution) => {
        return this.drawStyleService.createDrawingLayerStyle(feature, resolution, this.showLabels, this.icon);
      },
      showInLayerList: true,
      exportable: true,
      browsable: false,
      workspace: {
        enabled: false
      },
    });
    tryBindStoreLayer(this.store, this.layer);

    tryAddLoadingStrategy(this.store, new FeatureStoreLoadingStrategy({
      motion: FeatureMotion.None
    }));

    tryAddSelectionStrategy(this.store, new FeatureStoreSelectionStrategy({
      map: this.map,
      motion: FeatureMotion.None,
      many: true
    }));

    this.store.source.ol.on('removefeature', (event: OlVectorSourceEvent) => {
      const olGeometry = event.feature.getGeometry();
      this.clearLabelsOfOlGeometry(olGeometry);
    });

    this.store.stateView.manyBy$((record: EntityRecord<FeatureWithDraw>) => {
      return record.state.selected === true;
    }).pipe(
    skip(1)  // Skip initial emission
    )
    .subscribe((records: EntityRecord<FeatureWithDraw>[]) => {
      this.selectedFeatures$.next(records.map(record => record.entity));
    });
  }

  /**
   * Called when the user selects a new fill color or stroke color or toggles the Labels toggle
   * @param showLabels wheter to show the labels or not
   * @param icon an sstring representing an icon
   */
  changeStoreLayerStyle(showLabels: boolean, icon: boolean) {
    // Set new colors
    this.drawStyleService.setFillColor(this.fillColor);
    this.drawStyleService.setStrokeColor(this.strokeColor);

    // Set labels visibility and icon
    if (showLabels && !icon) {
      this.store.layer.ol.setStyle((feature, resolution) => {
        return this.drawStyleService.createDrawingLayerStyle(feature, resolution, true);
      });
      this.icon = undefined;

    } else if (!showLabels && !icon) {
      this.store.layer.ol.setStyle((feature, resolution) => {
        return this.drawStyleService.createDrawingLayerStyle(feature, resolution, false);
      });
      this.icon = undefined;

    } else if (showLabels && icon) {
      this.store.layer.ol.setStyle((feature, resolution) => {
        return this.drawStyleService.createDrawingLayerStyle(feature, resolution, true, this.icon);
      });

    } else if (!showLabels && icon) {
      this.store.layer.ol.setStyle((feature, resolution) => {
        return this.drawStyleService.createDrawingLayerStyle(feature, resolution, false, this.icon);
      });
    }
  }

  /**
   * Called when the user toggles the Draw control toggle
   * @internal
   */
  onToggleDrawControl() {
    this.drawControlToggleToggled = !this.drawControlToggleToggled;
    this.drawControlToggleToggled ? this.toggleDrawControl() : this.deactivateDrawControl();
  }

  /**
   * Activate the right control
   */
  private toggleDrawControl() {
    this.deactivateDrawControl();
    this.activateDrawControl();
  }

  private openDialog(olGeometry: OlGeometryType): void {
    setTimeout(() => {
      const dialogRef = this.dialog.open(DrawPopupComponent, {
        disableClose: false
      });

      dialogRef.afterClosed().subscribe((label: string) => {
        this.updateLabelOfOlGeometry(olGeometry, label);
        this.onDrawEnd(olGeometry);
        this.checkStoreCount();
      });
    }, 250);
  }

  /**
   * Activate a given control
   * @param drawControl Draw control
   */
  private activateDrawControl() {
    this.drawControl.setGeometryType(this.activeGeometryType);
    this.drawEnd$$ = this.drawControl.end$.subscribe((olGeometry: OlGeometryType) => {
      this.openDialog(olGeometry);
    });
    this.modify$$ = this.drawControl.modifyChanges$.subscribe((olCollection: OlCollection) => {
      this.modifyFeature(olCollection);
    })

    this.drawControlToggleToggled = true;
    this.drawControl.setOlMap(this.map.ol);
  }

  /**
   * Deactivate the active draw control
   */
  private deactivateDrawControl() {
    if (!this.drawControl) {
      return;
    }

    if (this.drawEnd$$) {
      this.drawEnd$$.unsubscribe();
    }

    if (this.modify$$) {
      this.modify$$.unsubscribe();
    }

    this.drawControlToggleToggled = false;
    this.drawControl.unsetOlMap();
  }

  /**
   * Clear the draw source and track the geometry being draw
   * @param olGeometry Ol linestring or polygon
   */
  private onDrawEnd(olGeometry: OlGeometryType) {
    this.addFeatureToStore(olGeometry, true);
    this.clearLabelsOfOlGeometry(olGeometry);
  }

  /**
   * Add a feature with draw label to the store. The loading strategy of the store
   * will trigger and add the feature to the map.
   * @internal
   */
  private addFeatureToStore(olGeometry: OlGeometryType, newFeature: boolean, feature?: FeatureWithDraw) {
    let rad;
    const featureId = feature ? feature.properties.id : olGeometry.ol_uid;
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
    console.log(this.store)
    if (newFeature) {
      this.drawStyleService.incrementDrawCount();
    }
  }

  private modifyFeature(olCollection: OlCollection) {
    olCollection.forEach(feature => {
      console.log(feature.getGeometry())
      this.addFeatureToStore(feature.getGeometry(), false);
      this.cdRef.detectChanges();
    })
  }

  private buildForm() {
    this.form = this.formBuilder.group({
      fill: [''],
      stroke: ['']
    });
  }

  deleteDrawings() {
    this.store.deleteMany(this.selectedFeatures$.value);
    this.checkStoreCount();
  }

  /**
   * Clear the tooltips of an OL geometrys
   * @param olGeometry OL geometry with tooltips
   */
  private clearLabelsOfOlGeometry(olGeometry: OlGeometryType) {
    getTooltipsOfOlGeometry(olGeometry).forEach((label: OlOverlay | undefined) => {
      if (label && label.getMap()) {
        this.map.ol.removeOverlay(label);
      }
    });
  }

  onToggleLabels() {
    this.drawStyleService.toggleLabelsToggle();
    this.showLabels = !this.showLabels;

    this.icon ? this.changeStoreLayerStyle(this.showLabels, true) : this.changeStoreLayerStyle(this.showLabels, false);
  }

  private updateLabelOfOlGeometry(olGeometry: OlGeometryType, label: string) {
    olGeometry.setProperties({_label: label}, true);
  }

  onIconChange(event?) {
    this.icon = event;
    this.drawStyleService.setIcon(this.icon);
    this.store.layer.ol.setStyle((feature, resolution) => {
      return this.drawStyleService.createDrawingLayerStyle(feature, resolution, true, this.icon);
    });
  }

  private checkStoreCount() {
    this.store.count$.getValue() !== 0 ? this.drawsPresence = true : this.drawsPresence = false;
  }
}
