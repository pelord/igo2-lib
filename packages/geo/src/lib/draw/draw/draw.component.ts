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
  featureToOl
} from '../../feature';

import { MessageService, LanguageService } from '@igo2/core';
import { MatDialog } from '@angular/material/dialog';
import { FontType, GeometryType } from '../shared/draw.enum';
import { IgoMap } from '../../map/shared/map';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Draw, FeatureWithDraw } from '../shared/draw.interface';
import { FormGroup, FormBuilder, FormControl } from '@angular/forms';
import { VectorSourceEvent as OlVectorSourceEvent } from 'ol/source/Vector';
import { VectorLayer } from '../../layer/shared/layers/vector-layer';
import { FeatureDataSource } from '../../datasource/shared/datasources/feature-datasource';
import { DrawControl } from '../../geometry/shared/controls/draw';
import { EntityRecord, EntityTableTemplate } from '@igo2/common';

import * as OlStyle from 'ol/style';
import * as olproj from 'ol/proj';
import OlVectorSource from 'ol/source/Vector';
import OlCircle from 'ol/geom/Circle';
import OlPoint from 'ol/geom/Point';
import OlFeature from 'ol/Feature';
import OlGeoJSON from 'ol/format/GeoJSON';
import OlOverlay from 'ol/Overlay';
import type { default as OlGeometryType } from 'ol/geom/GeometryType';
import { default as OlGeometry } from 'ol/geom/Geometry';
import { getDistance } from 'ol/sphere';
import { DrawStyleService } from '../shared/draw-style.service';
import { skip } from 'rxjs/operators';
import { DrawPopupComponent } from './draw-popup.component';
import { DrawShorcutsComponent } from './draw-shorcuts.component';
import { getTooltipsOfOlGeometry } from '../../measure/shared/measure.utils';
import { createInteractionStyle } from '../shared/draw.utils';
import { transform } from 'ol/proj';
import { DrawIconService } from '../shared/draw-icon.service';
import { MeasureLengthUnit } from './../../measure/shared/measure.enum';

interface form2 {"valrayon":number }

@Component({
  selector: 'igo-draw',
  templateUrl: './draw.component.html',
  styleUrls: ['./draw.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawComponent implements OnInit, OnDestroy {
  form2= {
    valrayon:"rad"
  }
  /**
   * Table template
   * @internal
   */
  public tableTemplate: EntityTableTemplate = {
    selection: true,
    selectMany: true,
    selectionCheckbox: true,
    sort: true,
    columns: [{
        name: 'Drawing',
        title: this.languageService.translate.instant('igo.geo.draw.labels'),
        valueAccessor: (feature: FeatureWithDraw) => {
          return feature.properties.draw;
        }
      }]
  };

  public geometryType = GeometryType; // Reference to the GeometryType enum

  @Output() fillColor: string;
  @Output() strokeColor: string;
  @Output() strokeWidth: number;

  @Output() fontSize: string;
  @Output() fontStyle: string;
  @Input() fontType: FontType;

  @Input() map: IgoMap; // Map to draw on

  @Input() store: FeatureStore<FeatureWithDraw>; // Drawing store


  public draw$: BehaviorSubject<Draw> = new BehaviorSubject({}); // Observable of draw

  private olDrawingLayerSource = new OlVectorSource();
  private drawControl: DrawControl;
  private drawEnd$$: Subscription;
  private drawSelect$$: Subscription;
  private olDrawingLayer: VectorLayer;
  public selectedFeatures$: BehaviorSubject<FeatureWithDraw[]> =
    new BehaviorSubject([]);
  public fillForm: string;
  public strokeForm: string;
  public drawControlIsDisabled: boolean = true;
  public drawControlIsActive: boolean = false;
  public labelsAreShown: boolean;
  public freehandMode = false;
  public usePredefinedRadius = false;
  private subscriptions$$: Subscription[] = [];

  public fontSizeForm: string;
  public fontStyleForm: string;
  public position: string = 'bottom';
  public form: FormGroup;
  public icons: Array<string>;
  public icon: string;

  public radiusFormControl = new FormControl();
  public measureUnit: MeasureLengthUnit = MeasureLengthUnit.Meters;
  public radiusStyle:number;
  public radiusCercle:number;
  public predefinedRadius$: BehaviorSubject<number> = new BehaviorSubject(undefined);
  public radiusDrawEnd$: BehaviorSubject<number>=new BehaviorSubject(undefined);
  public radiusMetersdef:number;
  /**
   * Available measure units for the measure type given
   * @internal
   */
   get measureUnits(): string[] {
    return [MeasureLengthUnit.Meters, MeasureLengthUnit.Kilometers];
  }

  constructor(
    private languageService: LanguageService,
    private formBuilder: FormBuilder,
    private drawStyleService: DrawStyleService,
    private dialog: MatDialog,
    private drawIconService: DrawIconService,
    private messageService: MessageService

  ) {
    this.buildForm();
    this.fillColor = this.drawStyleService.getFillColor();
    this.strokeColor = this.drawStyleService.getStrokeColor();
    this.strokeWidth = this.drawStyleService.getStrokeWidth();
    this.labelsAreShown = this.drawStyleService.getLabelsAreShown();
    this.icons = this.drawIconService.getIcons();
    this.icon = this.drawStyleService.getIcon();

    this.fontSize = this.drawStyleService.getFontSize();
    this.fontStyle = this.drawStyleService.getFontStyle();
  }

  // Initialize the store that will contain the entities and create the Draw control
  ngOnInit() {
    this.initStore();
    this.drawControl = this.createDrawControl(
      this.fillColor,
      this.strokeColor,
      this.strokeWidth
    );
    this.drawControl.setGeometryType(this.geometryType.Point as any);
    this.drawControl.freehand$.next(this.freehandMode);
    console.log("freehanddd mode init", this.freehandMode);
    this.drawControl.ispredefinedRadius$.next(this.usePredefinedRadius);
    /**this.drawControl.radiusVal.subscribe(this.predefinedRadius$);*/
    this.drawControl.radiusDrawEnd$.next(this.radiusCercle);
    this.toggleDrawControl();
  }

  /**
   * Remove the drawing layer and the interactions
   * @internal
   */
  ngOnDestroy() {
    this.drawControl.setOlMap(undefined);
    this.subscriptions$$.map((s) => s.unsubscribe());
  }

  /**
   * Create a Draw Control
   * @param fillColor the fill color
   * @param strokeColor the stroke color
   * @param strokeWidth the stroke width
   * @returns a Draw Control
   */
  createDrawControl(
    fillColor?: string,
    strokeColor?: string,
    strokeWidth?: number
  ) {
    const drawControl = new DrawControl({
      geometryType: undefined,
      drawingLayerSource: this.olDrawingLayerSource,
      drawingLayerStyle: new OlStyle.Style({}),
      interactionStyle: createInteractionStyle(
        fillColor,
        strokeColor,
        strokeWidth
      )
    });
    return drawControl;
  }

  /**
   * Called when the user selects a new geometry type
   * @param geometryType the geometry type selected by the user
   */
  onGeometryTypeChange(geometryType: typeof OlGeometryType) {
    this.drawControl.setGeometryType(geometryType);
    console.log("ongeometrytypechange on draw.component.ts 213",this.drawControl.getGeometryType());
    if (this.drawControl.getGeometryType() === this.geometryType.Circle) {
      this.freehandMode = true;
      this.drawControl.freehand$.next(this.freehandMode);
    } else {
      this.freehandMode=false;
      this.drawControl.freehand$.next(this.freehandMode);
      this.drawControl.setOlInteractionStyle(createInteractionStyle(this.fillColor,this.strokeColor,this.strokeWidth));
    }
    this.toggleDrawControl();
  }

  /**
   * Store initialization, including drawing layer creation
   */
  private initStore() {
    this.map.removeLayer(this.olDrawingLayer);
    this.olDrawingLayer = new VectorLayer({
      isIgoInternalLayer: true,
      id: 'igo-draw-layer',
      title: this.languageService.translate.instant('igo.geo.draw.drawing'),
      zIndex: 200,
      source: new FeatureDataSource(),
      style: (feature, resolution) => {
        return this.drawStyleService.createDrawingLayerStyle(
          feature,
          resolution,
          this.labelsAreShown,
          this.icon
        );
      },
      showInLayerList: true,
      exportable: true,
      browsable: false,
      workspace: {
        enabled: false
      }
    });
    tryBindStoreLayer(this.store, this.olDrawingLayer);
    tryAddLoadingStrategy(
      this.store,
      new FeatureStoreLoadingStrategy({
        motion: FeatureMotion.None
      })
    );
    tryAddSelectionStrategy(
      this.store,
      new FeatureStoreSelectionStrategy({
        map: this.map,
        motion: FeatureMotion.None,
        many: true
      })
    );
    this.store.layer.visible = true;
    this.store.source.ol.on(
      'removefeature',
      (event: OlVectorSourceEvent<OlGeometry>) => {
        const olGeometry = event.feature.getGeometry();
        this.clearLabelsOfOlGeometry(olGeometry);
      }
    );
    this.subscriptions$$.push(
      this.store.stateView
        .manyBy$((record: EntityRecord<FeatureWithDraw>) => {
          return record.state.selected === true;
        })
        .pipe(
          skip(1) // Skip initial emission
        )
        .subscribe((records: EntityRecord<FeatureWithDraw>[]) => {
          this.selectedFeatures$.next(records.map((record) => record.entity));
        })
    );
    this.subscriptions$$.push(
      this.store.count$.subscribe((cnt) => {
        cnt >= 1
          ? (this.store.layer.options.showInLayerList = true)
          : (this.store.layer.options.showInLayerList = false);
      })
    );
  }

  /**
   * Called when the user changes the color in a color picker
   * @param labelsAreShown wheter the labels are shown or not
   * @param isAnIcon wheter the feature is an icon or not
   */
  onColorChange(labelsAreShown: boolean, isAnIcon: boolean) {
    this.fillForm = this.fillColor;
    this.strokeForm = this.strokeColor;
    this.drawStyleService.setFillColor(this.fillColor);
    this.drawStyleService.setStrokeColor(this.strokeColor);

    if (isAnIcon) {
      this.store.layer.ol.setStyle((feature, resolution) => {
        return this.drawStyleService.createDrawingLayerStyle(
          feature,
          resolution,
          labelsAreShown,
          this.icon
        );
      });
      this.icon = undefined;
    } else {
      this.store.layer.ol.setStyle((feature, resolution) => {
        return this.drawStyleService.createDrawingLayerStyle(
          feature,
          resolution,
          labelsAreShown
        );
      });
    }
    this.createDrawControl();
  }

  /**
   * Called when the user toggles the Draw control is toggled
   * @internal
   */
  onToggleDrawControl(toggleIsChecked: boolean) {
    toggleIsChecked ? this.toggleDrawControl() : this.deactivateDrawControl();
  }

  onToggleFreehandMode(event: any) {
    if (this.isCircle()) {
      this.usePredefinedRadius = event.checked;
      this.drawControl.ispredefinedRadius$.next(this.usePredefinedRadius);

    } else {
      this.freehandMode = event.checked;
      this.drawControl.freehand$.next(this.freehandMode);
    }
    this.toggleDrawControl();
  }

  /**
   * Activate the correct control
   */
  private toggleDrawControl() {
    this.deactivateDrawControl();
    this.activateDrawControl();
  }

  /**
   * Open a dialog box to enter label and do something
   * @param olGeometry geometry at draw end or selected geometry
   * @param drawEnd event fired at drawEnd?
   */
  private openDialog(olGeometryFeature, isDrawEnd: boolean) {
    setTimeout(() => {
      // open the dialog box used to enter label
      const dialogRef = this.dialog.open(DrawPopupComponent, {
        disableClose: false,
        data: { currentLabel: olGeometryFeature.get('draw') }
      });

      // when dialog box is closed, get label and set it to geometry
      dialogRef.afterClosed().subscribe((label: string) => {
        // checks if the user clicked ok
        if (dialogRef.componentInstance.confirmFlag) {
          this.updateLabelOfOlGeometry(olGeometryFeature, label);
          // if event was fired at draw end
          if (isDrawEnd) {
            this.onDrawEnd(olGeometryFeature);
            // if event was fired at select
          } else {
            this.onSelectDraw(olGeometryFeature, label);
          }
        }
        // deletes the feature
        else {
          this.olDrawingLayerSource
            .getFeatures()
            .forEach((drawingLayerFeature) => {
              const geometry = drawingLayerFeature.getGeometry() as any;
              if (olGeometryFeature === geometry) {
                this.olDrawingLayerSource.removeFeature(drawingLayerFeature);
              }
            });
        }
      });
    }, 250);
  }

  /**
   * Activate a given control
   */
  private activateDrawControl() {
    this.drawControlIsDisabled = false;
    this.drawControlIsActive = true;
    this.drawEnd$$ = this.drawControl.end$.subscribe(
      (olGeometry: OlGeometry) => {
        this.openDialog(olGeometry, true);
      }
    );

    this.drawControl.modify$.subscribe((olGeometry: OlGeometry) => {
      this.onModifyDraw(olGeometry);
    });

    if (!this.drawSelect$$) {
      this.drawSelect$$ = this.drawControl.select$.subscribe(
        (olFeature: OlFeature<OlGeometry>) => {
          this.openDialog(olFeature, false);
        }
      );
    }

    this.drawControl.setOlMap(this.map.ol, true);
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

    this.drawControl.setOlMap(undefined);
    this.drawControlIsActive = false;
  }

  /**
   * Clear the draw source and track the geometry being draw
   * @param olGeometry Ol linestring or polygon
   */
  private onDrawEnd(olGeometry: OlGeometry, radius?: number) {
    console.log(olGeometry);
    console.log(radius);
    console.log("olGeometry from onDrawEnd from drawcomponent 442");


    this.addFeatureToStore(olGeometry, radius);
     console.log(radius);
     console.log ("radius onDrawEnd from drawcomponent 384");
    this.clearLabelsOfOlGeometry(olGeometry);
    console.log(olGeometry);

    this.store.layer.ol.getSource().refresh();
    console.log(this.store);
    console.log ("store.layer.ol onDrawEnd from drawcomponent 462");
  }

  private onModifyDraw(olGeometry) {
    const entities = this.store.all();

    entities.forEach((entity) => {
      const entityId = entity.properties.id;

      const olGeometryId = olGeometry.ol_uid;

      if (entityId === olGeometryId) {
        this.updateLabelOfOlGeometry(olGeometry, entity.properties.draw);
        this.replaceFeatureInStore(entity, olGeometry);
      }
    });
  }

  private onSelectDraw(olFeature: OlFeature<OlGeometry>, label: string) {
    const entities = this.store.all();

    const olGeometry = olFeature.getGeometry() as any;
    olGeometry.ol_uid = olFeature.get('id');

    const olGeometryCoordinates = JSON.stringify(
      olGeometry.getCoordinates()[0]
    );

    entities.forEach((entity) => {
      const entityCoordinates = JSON.stringify(entity.geometry.coordinates[0]);

      if (olGeometryCoordinates === entityCoordinates) {
        const rad: number = entity.properties.rad
          ? entity.properties.rad
          : undefined;
        this.updateLabelOfOlGeometry(olGeometry, label);
        this.replaceFeatureInStore(entity, olGeometry, rad);
      }
    });
  }

  /**
   * Add a feature with draw label to the store. The loading stragegy of the store
   * will trigger and add the feature to the map.
   * @internal
   */
  private addFeatureToStore(
    olGeometry,
    radius?: number,
    feature?: FeatureWithDraw
  ) {
    let rad: number;
    let center4326: Array<number>;
    let point4326: Array<number>;
    let lon4326: number;
    let lat4326: number;
    let radDef: number;
    let radiusMeters: number;


    const featureId = feature ? feature.properties.id : olGeometry.ol_uid;
    const projection = this.map.ol.getView().getProjection();

    const geometry = new OlGeoJSON().writeGeometryObject(olGeometry, {
      featureProjection: projection,
      dataProjection: projection
    }) as any;
    console.log(geometry);
    console.log("value of geometry dans addfeatureToStore 519 draw.component.ts");


    if (olGeometry instanceof OlCircle || radius) {
      if (radius ) {
        rad=radius;
      } else {
        geometry.type = 'Point';
        geometry.coordinates = olGeometry.getCenter();
        const extent4326 = transform(
          [
            olGeometry.getFlatCoordinates()[2],
            olGeometry.getFlatCoordinates()[3]
          ],
          projection,
          'EPSG:4326'
        );
        center4326 = transform(
          [
            olGeometry.getFlatCoordinates()[0],
            olGeometry.getFlatCoordinates()[1]
          ],
          projection,
          'EPSG:4326'
        );
        lon4326 = center4326[0];
        lat4326 = center4326[1];
        rad = getDistance(center4326, extent4326);
        console.log(rad);
        console.log("condition else 538 radius dans addfeatureToStore from draw.component.ts");
        /**this.formControl[radiusFormControl].setValue(rad);*/
        this.radiusFormControl.setValue(Math.round(rad));
        console.log("value of radius on draw.component.ts 596",rad);
      }

    }
    if (this.drawControl.radiusDrawEnd$.getValue()){
      rad=this.drawControl.radiusDrawEnd$.getValue();
      console.log("rayon ",this.drawControl.radiusDrawEnd$.getValue());
    }


    if (olGeometry instanceof OlPoint) {
      point4326 = transform(
        olGeometry.getFlatCoordinates(),
        projection,
        'EPSG:4326'
      );
      lon4326 = point4326[0];
      lat4326 = point4326[1];
      console.log("olgeometry instanceof OlPoint 473 draw.component.ts");
    }

    this.store.update({
      type: FEATURE,
      geometry,
      projection: projection.getCode(),
      properties: {
        id: featureId,
        draw: olGeometry.get('_label'),
        longitude: lon4326 ? lon4326 : null,
        latitude: lat4326 ? lat4326 : null,
        rad: rad ? rad : radDef
      },
      meta: {
        id: featureId
      }
    });
    this.drawControl.predefinedRadius$.next(undefined);
    this.drawControl.radiusDrawEnd$.next(undefined);

    console.log(this.store);
    console.log("store.update dans addfeatureToStore 478 draw.component.ts");
  }

  /**
   * Replace the feature in the store
   * @param entity the entity to replace
   * @param olGeometry the new geometry to insert in the store
   */
  private replaceFeatureInStore(
    entity,
    olGeometry: OlGeometry,
    radius?: number
  ) {
    this.store.delete(entity);
    console.log("this.store.delete in replaceFeatureInStore 601 draw.component.ts", entity);
    this.onDrawEnd(olGeometry, radius);
    console.log(" private replaceFeatureInStore(entity, olGeometry: OlGeometry, radius?: number) 504 draw.component.ts");
  }

  private buildForm() {
    this.form = this.formBuilder.group({
      fill: [''],
      stroke: ['']
    });
  }

  deleteDrawings() {
    this.store.deleteMany(this.selectedFeatures$.value);
    this.selectedFeatures$.value.forEach((selectedFeature) => {
      this.olDrawingLayerSource.getFeatures().forEach((drawingLayerFeature) => {
        const geometry = drawingLayerFeature.getGeometry() as any;
        if (selectedFeature.properties.id === geometry.ol_uid) {
          this.olDrawingLayerSource.removeFeature(drawingLayerFeature);
        }
      });
    });
  }

  /**
   * Clear the tooltips of an OL geometry
   * @param olGeometry OL geometry with tooltips
   */
  private clearLabelsOfOlGeometry(olGeometry) {
    getTooltipsOfOlGeometry(olGeometry).forEach(
      (olTooltip: OlOverlay | undefined) => {
        if (olTooltip && olTooltip.getMap()) {
          this.map.ol.removeOverlay(olTooltip);
        }
      }
    );
  }

  /**
   * Called when the user toggles the labels toggle
   */
  onToggleLabels() {
    this.drawStyleService.toggleLabelsAreShown();
    this.labelsAreShown = !this.labelsAreShown;
    this.icon
      ? this.onColorChange(this.labelsAreShown, true)
      : this.onColorChange(this.labelsAreShown, false);
  }

  /**
   * Update the label of a geometry when a label is entered in a dialog box
   * @param olGeometry the geometry
   * @param label the label
   */
  private updateLabelOfOlGeometry(olGeometry: OlGeometry, label: string) {
    olGeometry.setProperties(
      {
        _label: label
      },
      true
    );
  }

  onIconChange(event?) {
    this.icon = event;
    this.drawStyleService.setIcon(this.icon);
    this.store.layer.ol.setStyle((feature, resolution) => {
      return this.drawStyleService.createDrawingLayerStyle(
        feature,
        resolution,
        true,
        this.icon
      );
    });
  }

  openShorcutsDialog() {
    this.dialog.open(DrawShorcutsComponent);
  }

  /**
   * Called when the user double-clicks the selected drawing
   */
  editLabelDrawing() {
    const olGeometry = featureToOl(
      this.selectedFeatures$.value[0],
      this.map.ol.getView().getProjection().getCode()
    );
    this.openDialog(olGeometry, false);
  }

  /**
   * Called when the user changes the font size or/and style
   * @param labelsAreShown wheter the labels are shown or not
   * @param size the size of the font
   * @param style the style of the font
   */

  onFontChange(labelsAreShown: boolean, size: string, style: FontType) {
    this.drawStyleService.setFontSize(size);
    this.drawStyleService.setFontStyle(style);

    this.store.layer.ol.setStyle((feature, resolution) => {
      return this.drawStyleService.createDrawingLayerStyle(
        feature,
        resolution,
        labelsAreShown
      );
    });
    this.createDrawControl();
  }
  get allFontStyles(): string[] {
    return Object.values(FontType);
  }
  isPoint() {
    return this.drawControl.getGeometryType() === this.geometryType.Point;
  }

  isLineString() {
    return this.drawControl.getGeometryType() === this.geometryType.LineString;
  }

  isPolygon() {
    return this.drawControl.getGeometryType() === this.geometryType.Polygon;
  }

  isCircle() {
    return this.drawControl.getGeometryType() === this.geometryType.Circle;
  }

  changeRadius() {
    let radiusMeters: number;


    if (this.radiusFormControl.value) {
      this.measureUnit === MeasureLengthUnit.Meters ? radiusMeters = this.radiusFormControl.value :
      radiusMeters = this.radiusFormControl.value * 1000;
    } else {
      radiusMeters = undefined;
    }
    if (radiusMeters >= 100000 || radiusMeters < 0) {
      this.messageService.alert(this.languageService.translate.instant('igo.geo.spatialFilter.radiusAlert'),
      this.languageService.translate.instant('igo.geo.spatialFilter.warning'));
      //this.radiusFormControl.reset();
      this.radiusMetersdef = 1000;
      this.radiusFormControl.setValue(this.radiusMetersdef);
    } else {
      const pointStyle = (feature:OlFeature<OlGeometry>, resolution:number) => {
        const geom = feature.getGeometry() as OlPoint;
        const coordinates = olproj.transform(geom.getCoordinates(), this.map.projection, 'EPSG:4326');
        const radius = radiusMeters/(Math.cos((Math.PI/180) * coordinates[1])) / resolution;
        this.drawControl.predefinedRadius$.next(radiusMeters);
        return new OlStyle.Style({
          image: new OlStyle.Circle ({
            radius: radius,
            stroke: new OlStyle.Stroke({
              width: 1,
              color: 'rgba(143,7,7,1)'
            }),
            fill: new OlStyle.Fill({
              color: 'rgba(255,255,255,0.4)'
            })
          })
        });
      };

      this.drawControl.setOlInteractionStyle(pointStyle);
      this.toggleDrawControl();

      console.log(radiusMeters);
    }
  }

  onMeasureUnitChange(selectedMeasureUnit: MeasureLengthUnit) {
    if (selectedMeasureUnit === this.measureUnit) {
      return;
    } else {
      this.measureUnit = selectedMeasureUnit;
      this.measureUnit === MeasureLengthUnit.Meters ? this.radiusFormControl.setValue(this.radiusFormControl.value * 1000) :
      this.radiusFormControl.setValue(this.radiusFormControl.value / 1000);
    }
  }
}
