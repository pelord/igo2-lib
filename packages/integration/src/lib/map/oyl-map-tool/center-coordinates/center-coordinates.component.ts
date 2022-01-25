import { ChangeDetectorRef, Component, OnDestroy, OnInit, Input, ViewChild } from '@angular/core';
import { FeatureStore, Feature,  FEATURE, formatScale, IgoMap, InputProjections, measureOlGeometryLength, ProjectionsLimitationsOptions, Layer, QueryableDataSourceOptions, featureFromOl } from '@igo2/geo';
import { MapState } from '../../map.state';
import { Clipboard } from '@igo2/utils';
import { MessageService, LanguageService, StorageService, StorageScope, ConfigService } from '@igo2/core';
import { BehaviorSubject, combineLatest, Subscription } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';
import { zoneMtm, zoneUtm, computeProjectionsConstraints } from '@igo2/geo';
import * as olproj from 'ol/proj';
import olVectorSource from 'ol/source/Vector';
import Geometry from 'ol/geom/Geometry';
import olLineString from 'ol/geom/LineString';
import lineChunk from '@turf/line-chunk';
import olFeature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import length from '@turf/length';
import { EntityTableComponent, EntityTableTemplate } from '@igo2/common';
import { uuid, NumberUtils } from '@igo2/utils';
import Point from 'ol/geom/Point';
/**
 * Tool to display the coordinates and a cursor of the center of the map
 */
@Component({
  selector: 'igo-oyl-center-coordinates',
  templateUrl: './center-coordinates.component.html',
  styleUrls: ['./center-coordinates.component.scss']
})
export class OylCenterCoordinatesComponent implements OnInit, OnDestroy {


  /**
   * Table template
   * @internal
   */
   public tableTemplate: EntityTableTemplate = {
    selection: true,
    selectMany: false,
    selectionCheckbox: false,
    sort: true,
    columns: [
      {
        name: 'element',
        title: 'Élément', // this.languageService.translate.instant('igo.geo.measure.lengthHeader'),
        valueAccessor: (localFeature: Feature) => {
          return localFeature.properties.element;
        }
      },
      {
        name: 'distance',
        title: 'Distance', // this.languageService.translate.instant('igo.geo.measure.areaHeader'),
        valueAccessor: (localFeature: Feature) => {
          return `${NumberUtils.roundToNDecimal(localFeature.properties.distance,1)}m`
        }
      }
    ]
  };

  public formattedScale$: BehaviorSubject<string> = new BehaviorSubject('');
  public projections$: BehaviorSubject<InputProjections[]> = new BehaviorSubject([]);
  public form: FormGroup;
  public coordinates: string[];
  private currentCenterDefaultProj: [number, number];
  public center: boolean = this.storageService.get('centerToggle') as boolean;
  private inMtmZone: boolean = true;
  private inLambert2 = {32198: true, 3798: true};
  private mapState$$: Subscription;
  private _projectionsLimitations: ProjectionsLimitationsOptions = {};
  private projectionsConstraints: ProjectionsLimitationsOptions;
  private defaultProj: InputProjections = {
    translatedValue: this.languageService.translate.instant('igo.geo.importExportForm.projections.wgs84', { code: 'EPSG:4326' }),
    translateKey: 'wgs84', alias: 'WGS84', code: 'EPSG:4326', zone: ''
  };
  private currentZones = { utm: undefined, mtm: undefined };
  public units: boolean = true;
  get map(): IgoMap {
    return this.mapState.map;
  }

  get inputProj(): InputProjections {
    return this.form.get('inputProj').value;
  }
  set inputProj(value: InputProjections) {
    this.form.patchValue({ inputProj: value });
  }
  get projectionsLimitations(): ProjectionsLimitationsOptions {
    return this._projectionsLimitations || {};
  }

  /**
 * The measures store
 */
  @Input() store: FeatureStore<Feature> = new FeatureStore<Feature>([], {map: this.map});
  @ViewChild('table', { static: true }) table: EntityTableComponent;

  @Input()
  get maxDistance() {
    return this.maxDistance$.value;
  }
  set maxDistance(value: number) {
    this.maxDistance$.next(value);
  }
  @Input() maxDistance$: BehaviorSubject<number> = new BehaviorSubject(30);

  @Input()
  set projectionsLimitations(value: ProjectionsLimitationsOptions) {
    this._projectionsLimitations = value;
  }

  constructor(
    public mapState: MapState,
    private languageService: LanguageService,
    private messageService: MessageService,
    private cdRef: ChangeDetectorRef,
    private storageService: StorageService,
    private config: ConfigService,
    private formBuilder: FormBuilder) {
      this.computeProjections();
      this.buildForm();
    }


  handleRTSSLayers(layer: Layer, feature: olFeature<Geometry>, olGeometry: olLineString, mapCenterInLayerProj) {
    const geojsonGeom = new GeoJSON().writeGeometryObject(olGeometry, {
      featureProjection: this.map.projection,
      dataProjection: 'EPSG:4326'
    }) as any;
    const splittedLines = lineChunk(geojsonGeom, (length(geojsonGeom) * 1000 / feature.getProperties().val_longr_) / 1000);
    let foundDistance = this.maxDistance;
    let closestChainage;
    let chainagePoint: Point;

    splittedLines.features.map((segment, chainageIdx) => {
      const segmentFirstCoordinate = segment.geometry.coordinates[0];
      const linebetween = new olLineString([mapCenterInLayerProj, olproj.transform(segmentFirstCoordinate, 'EPSG:4326', 'EPSG:3857')]);
      const lineLength = measureOlGeometryLength(linebetween, undefined);
      if (lineLength <= foundDistance) {
        foundDistance = lineLength;
        closestChainage = chainageIdx;
        chainagePoint = new Point(olproj.transform(segmentFirstCoordinate, 'EPSG:4326', 'EPSG:3857'));
        chainagePoint.setProperties({
          element: `${feature.getProperties().num_rts}+${closestChainage}` ,
          distance: lineLength
        }, true);
      }

    });
    this.addFeatureToStore(chainagePoint);

  }

  /**
   * Add a feature with measures to the store. The loading stragegy of the store
   * will trigger and add the feature to the map.
   * @internal
   */
   private addFeatureToStore(olGeometry) {
    const featureId = uuid();
    const projection = this.map.ol.getView().getProjection();
    const geometry = new GeoJSON().writeGeometryObject(olGeometry, {
      featureProjection: projection,
      dataProjection: projection
    }) as any;
    this.store.update({
      type: FEATURE,
      geometry,
      projection: projection.getCode(),
      properties: {
        id: featureId,
        element: olGeometry.getProperties().element,
        distance: olGeometry.getProperties().distance
      },
      meta: {
        id: featureId
      }
    });
  }

  getQueryTitle(feature: Feature, layer: Layer): string {
    let title;
    if (layer.options?.source?.options) {
      const dataSourceOptions = layer.options.source
        .options as QueryableDataSourceOptions;
      if (dataSourceOptions.queryTitle) {
        title = this.getLabelMatch(feature, dataSourceOptions.queryTitle);
      }
    }

    return title;
  }

  getLabelMatch(feature: Feature, labelMatch): string {
    let label = labelMatch;
    const labelToGet = Array.from(labelMatch.matchAll(/\$\{([^\{\}]+)\}/g));

    labelToGet.forEach(v => {
      label = label.replace(v[0], feature.properties[v[1]]);
    });

    // Nothing done? check feature's attribute
    if (labelToGet.length === 0 && label === labelMatch) {
      label = feature.properties[labelMatch] || labelMatch;
    }

    return label;
  }

  /**
   * Listen a state of the map, a state of a form, update the coordinates
   */
  ngOnInit(): void {
    combineLatest([this.map.viewController.state$.pipe(debounceTime(500)), this.map.layers$, this.maxDistance$]).subscribe((bunch) => {
      this.store.clear();
      const layers = bunch[1];
      const olVs = layers.filter((layer: Layer) => layer.ol.getSource() instanceof olVectorSource);
        olVs.map((layer) => {
          const layerSource = layer.ol.getSource() as olVectorSource<Geometry>;
          const mapCenterInLayerProj = this.map.viewController.getCenter(layerSource.getProjection());
          const closestOlFeature = layerSource.getClosestFeatureToCoordinate(mapCenterInLayerProj);
          if (closestOlFeature) {
            const closestFeature = featureFromOl(closestOlFeature, this.map.projection);

            const geometryClosestPoint = closestOlFeature.getGeometry().getClosestPoint(mapCenterInLayerProj);
            const linebetween = new olLineString([mapCenterInLayerProj, geometryClosestPoint]);
            const lineLength = measureOlGeometryLength(linebetween, undefined);
            if (lineLength <= this.maxDistance) {
              const closestFeatureProperties = closestOlFeature.getProperties();
              if (closestFeatureProperties.num_rts && closestFeatureProperties.val_longr_) {
                this.handleRTSSLayers(layer, closestOlFeature, closestOlFeature.getGeometry() as olLineString, mapCenterInLayerProj);
              } else {
                let title = this.getQueryTitle(closestFeature, layer);
                const closestOlFeatureGeometry = closestOlFeature.getGeometry();
                closestOlFeatureGeometry.setProperties({
                  element: `${layer.title} (${title})`,
                  distance: lineLength
                }, true);
                this.addFeatureToStore(closestOlFeatureGeometry);
              }

            }
          }
        });
    });

    this.mapState$$ = combineLatest([this.map.viewController.state$.pipe(debounceTime(50)), this.form.valueChanges])
        .subscribe(() => {
      this.setScaleValue(this.map);
      this.currentCenterDefaultProj = this.map.viewController.getCenter(this.defaultProj.code);
      const currentMtmZone = zoneMtm(this.currentCenterDefaultProj[0]);
      const currentUtmZone = zoneUtm(this.currentCenterDefaultProj[0]);
      if (!this.inMtmZone && currentMtmZone !== this.currentZones.mtm) {
        this.back2quebec();
      }
      let zoneChange = false;
      if (currentMtmZone !== this.currentZones.mtm) {
        this.currentZones.mtm = currentMtmZone;
        zoneChange = true;
      }
      if (currentUtmZone !== this.currentZones.utm) {
        this.currentZones.utm = currentUtmZone;
        zoneChange = true;
      }
      if (zoneChange) {
        this.updateProjectionsZoneChange();
      }
      this.checkLambert(this.currentCenterDefaultProj);
      this.coordinates = this.getCoordinates();
      this.cdRef.detectChanges();
      this.storageService.set('currentProjection', this.inputProj, StorageScope.SESSION);
    });

    const tempInputProj = this.storageService.get('currentProjection') as InputProjections;
    this.inputProj = this.projections$.value[0];
    if (tempInputProj !== null)
    {
      const pos = this.positionInList(tempInputProj);
      this.inputProj = this.projections$.value[pos];
      this.updateZoneMtmUtm();
    }
    this.map.mapCenter$.next(this.center);
    this.coordinates = this.getCoordinates();
    this.currentCenterDefaultProj = this.map.viewController.getCenter(this.defaultProj.code);
  }

  ngOnDestroy(): void {
    this.map.mapCenter$.next(false);
    this.mapState$$.unsubscribe();
  }

  setScaleValue(map: IgoMap) {
    this.formattedScale$.next(': ~ 1 / ' + formatScale(map.viewController.getScale()));
  }
  /**
   * Coordinates of the center of the map on the appropriate systeme of coordinates
   * @returns Array of two numbers
   */
  getCoordinates(): string[] {
    this.currentZones.mtm = zoneMtm(this.currentCenterDefaultProj[0]);
    this.currentZones.utm = zoneUtm(this.currentCenterDefaultProj[0]);
    let coord;
    const code = this.inputProj.code;
    let decimal = 2;
    if (code.includes('EPSG:4326') || code.includes('EPSG:4269')) {
      decimal = 5;
    }
    this.units = (code === 'EPSG:4326' || code === 'EPSG:4269');
    coord = this.map.viewController.getCenter(code).map(c => c.toFixed(decimal));
    return coord;
  }

  /**
   * Copy the coordinates to a clipboard
   */
  copyTextToClipboard(): void {
    const successful = Clipboard.copy(this.coordinates.toString());
    if (successful) {
      const translate = this.languageService.translate;
      const title = translate.instant(
        'igo.integration.advanced-map-tool.advanced-coordinates.copyTitle'
      );
      const msg = translate.instant('igo.integration.advanced-map-tool.advanced-coordinates.copyMsg');
      this.messageService.success(msg, title);
    }
  }

  /**
   * Display a cursor on the center of the map
   */
  displayCenter(toggle: boolean): void {
    this.center = toggle;
    this.map.mapCenter$.next(toggle);
    this.storageService.set('centerToggle', toggle, StorageScope.SESSION);
  }

  /**
   * Builder of the form
   */
  private buildForm(): void {
    this.form = this.formBuilder.group({
      inputProj: ['', [Validators.required]]
    });
  }

  /**
   * Update list of projections after changing of the state of the map
   */
  private updateProjectionsZoneChange(): void {
    let modifiedProj = this.projections$.value;
    const translate = this.languageService.translate;
    modifiedProj.map(p => {
      if (p.translateKey === 'mtm') {
        const zone = zoneMtm(this.currentCenterDefaultProj[0]);
        if (zone) {
          const code = zone < 10 ? `EPSG:3218${zone}` : `EPSG:321${80 + zone}`;
          p.alias = `MTM ${zone}`;
          p.code = code;
          p.zone = `${zone}`;
          p.translatedValue = translate.instant('igo.geo.importExportForm.projections.mtm', p);
        }
        else {
          p.alias = '';
          this.inMtmZone = false;
          if (this.inputProj.translateKey === 'mtm') {
            this.inputProj = this.projections$.value[0];
          }
        }
      }
      if (p.translateKey === 'utm') {
        const zone = zoneUtm(this.currentCenterDefaultProj[0]);
        const code = `EPSG:326${zone}`;
        p.alias = `UTM ${zone}`;
        p.code = code;
        p.zone = `${zone}`;
        p.translatedValue = translate.instant('igo.geo.importExportForm.projections.utm', p);
      }
    });
    modifiedProj = modifiedProj.filter(p => p.alias !== '');
    this.projections$.next(modifiedProj);
  }

  /**
   * Create a list of currents projections
   */
  private computeProjections(): void {
    this.projectionsConstraints = computeProjectionsConstraints(this.projectionsLimitations);
    const projections: InputProjections[] = [];

    if (!this.currentCenterDefaultProj) {
      this.currentCenterDefaultProj = this.map.viewController.getCenter(this.defaultProj.code);
    }

    const translate = this.languageService.translate;
    if (this.projectionsConstraints.wgs84) {
      projections.push({
        translatedValue: translate.instant('igo.geo.importExportForm.projections.wgs84', { code: 'EPSG:4326' }),
        translateKey: 'wgs84', alias: 'WGS84', code: 'EPSG:4326', zone: ''
      });
    }

    if (this.projectionsConstraints.nad83) {
      projections.push({
        translatedValue: translate.instant('igo.geo.importExportForm.projections.nad83', { code: 'EPSG:4269' }),
        translateKey: 'nad83', alias: 'NAD83', code: 'EPSG:4269', zone: ''
      });
    }

    if (this.projectionsConstraints.webMercator) {
      projections.push({
        translatedValue: translate.instant('igo.geo.importExportForm.projections.webMercator', { code: 'EPSG:3857' }),
        translateKey: 'webMercator', alias: 'Web Mercator', code: 'EPSG:3857', zone: ''
      });
    }
    if (this.projectionsConstraints.mtm) {
      // Quebec
      const zone = zoneMtm(this.currentCenterDefaultProj[0]);
      if (zone) {
        this.inMtmZone = true;
        const code = zone < 10 ? `EPSG:3218${zone}` : `EPSG:321${80 + zone}`;
        projections.splice(3, 0, {
          translatedValue: this.languageService.translate.instant('igo.geo.importExportForm.projections.mtm', { code, zone }),
          translateKey: 'mtm', alias: `MTM ${zone}`, code, zone: `${zone}`
        });
      }
      else {
        this.inMtmZone = false;
      }
    }
    if (this.projectionsConstraints.utm) {
      const order = this.inMtmZone ? 4 : 3;
      const zone = zoneUtm(this.currentCenterDefaultProj[0]);
      const code = zone < 10 ? `EPSG:3260${zone}` : `EPSG:326${zone}`;
      projections.splice(order, 0, {
        translatedValue: this.languageService.translate.instant('igo.geo.importExportForm.projections.utm', { code, zone }),
        translateKey: 'utm', alias: `UTM ${zone}`, code, zone: `${zone}`
      });
    }
    let configProjection = [];
    if (this.projectionsConstraints.projFromConfig) {
      configProjection = this.config.getConfig('projections') || [];
    }
    this.projections$.next(projections.concat(configProjection));
  }

  /**
   * Push the MTM in the array of systeme of coordinates
   * @param projections Array of the InputProjections
   */
  private pushMtm(projections: Array<InputProjections>): void {
    if (this.projectionsConstraints.mtm) {
      const zone = zoneMtm(this.currentCenterDefaultProj[0]);
      const code = zone < 10 ? `EPSG:3218${zone}` : `EPSG:321${80 + zone}`;
      projections.splice(3, 0, {
          translatedValue: this.languageService.translate.instant('igo.geo.importExportForm.projections.mtm', { code, zone }),
          translateKey: 'mtm', alias: `MTM ${zone}`, code, zone: `${zone}`});
    }
  }

  /**
   * Updates the list of systems of coordinates for territory of Quebec
   * push MTM and UTM in the Array
   */
  private back2quebec(): void {
    const projections = this.projections$.value;
    this.pushMtm(projections);
    this.inMtmZone = true;
  }

  /**
   * Update the numbers of the zones when application is restarted
   */
  private updateZoneMtmUtm() {
    if (this.inputProj.translateKey === 'mtm') {
      const zone = zoneMtm(this.currentCenterDefaultProj[0]);
      this.inputProj.alias = `MTM ${zone}`;
      const code = zone < 10 ? `EPSG:3218${zone}` : `EPSG:321${80 + zone}`;
      this.inputProj.code = code;
      this.inputProj.zone = `${zone}`;
      this.inputProj.translatedValue = this.languageService.translate.instant('igo.geo.importExportForm.projections.mtm', { code, zone });
    }
    if (this.inputProj.translateKey === 'utm') {
      const zone = zoneUtm(this.currentCenterDefaultProj[0]);
      this.inputProj.alias = `UTM ${zone}`;
      const code = zone < 10 ? `EPSG:3260${zone}` : `EPSG:326${zone}`;
      this.inputProj.code = code;
      this.inputProj.zone = `${zone}`;
      this.inputProj.translatedValue = this.languageService.translate.instant('igo.geo.importExportForm.projections.utm', { code, zone });
    }
  }

  /**
   * Compute the position of a current projection in a list. 0 if the projection is not in the list
   * @param translateKey string, translate key of a projection
   * @returns numeric, position of an element in the array
   */
  positionInList(tempInputProj: InputProjections): number {
    const tk = tempInputProj.translateKey;
    const alias = tempInputProj.alias;
    let position; // = undefined;
    let iter = 0;
    this.projections$.value.map((projection) => {
      if (tk) {
        if (tk === projection.translateKey) {
          position = iter;
        }
      }
      else if (alias === projection.alias) {
        position = iter;
      }
      iter++;
    });
    position = position ? position : 0;
    return position;
  }

  /**
   * Change the list of projections depending on the projections of Lambert
   * @param coordinates An array of numbers, longitude and latitude
   */
  checkLambert(coordinates: [number, number]) {
    const lambertProjections = this.config.getConfig('projections');
    lambertProjections.forEach(projection => {
        let modifiedProj = this.projections$.value;
        const extent = projection.extent;
        const code = projection.code.match(/\d+/);
        const currentExtentWGS = olproj.transformExtent(extent, projection.code, this.defaultProj.code);
        if (coordinates[0] < currentExtentWGS[0] || coordinates[0] > currentExtentWGS[2] ||
            coordinates[1] < currentExtentWGS[1] || coordinates[1] > currentExtentWGS[3]) {
            this.inLambert2[code] = false;
            if (this.inputProj.alias === projection.alias) {
              this.inputProj = this.projections$.value[0];
            }
            modifiedProj = modifiedProj.filter(p => p.alias !== projection.alias);
            this.projections$.next(modifiedProj);
        }
        else {
            if (!this.inLambert2[code]) {
                this.projections$.next(modifiedProj.concat(projection));
                this.inLambert2[code] = true;
            }
        }
    });
  }
}
