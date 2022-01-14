import { Injectable } from '@angular/core';
import {
    FeatureDataSource, FeatureMotion, FeatureStore,
    FeatureStoreLoadingStrategy, featureToOl, StyleService,
    tryAddLoadingStrategy, tryBindStoreLayer, VectorLayer, Feature,
    RegionDBService, RegionDBData, VectorTileLayer, TileLayer, DrawFeatureStore
} from '@igo2/geo';
import { fromExtent } from 'ol/geom/Polygon';
import pointOnFeature from '@turf/point-on-feature';
import intersect from '@turf/intersect';
import { BehaviorSubject, Subject } from 'rxjs';
import { MapState } from '../map';
import { TransferedTile } from './TransferedTile';
import * as olstyle from 'ol/style';
import olFeature from 'ol/Feature';
import OlGeoJSON from 'ol/format/GeoJSON';
import { Polygon } from 'geojson';
import buffer from '@turf/buffer';
import { Geometry } from 'ol/geom';
import { first } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class DownloadState {
    readonly selectedOfflinableLayers$: BehaviorSubject<(VectorTileLayer | TileLayer)[]> = new BehaviorSubject([]);
    readonly addNewTile$: BehaviorSubject<TransferedTile> = new BehaviorSubject(undefined);
    private _openedWithMouse: boolean = false;
    public regionStore: DrawFeatureStore = new DrawFeatureStore([], { map: this.map });
    public offlineRegionsStore: FeatureStore = new FeatureStore([], { map: this.map });
    readonly rightMouseClick$: Subject<boolean> = new Subject();


    get map() {
        return this.mapState.map;
    }

    constructor(
        private regionDB: RegionDBService,
        private styleService: StyleService,
        private mapState: MapState) {

        this.map.ol.once('rendercomplete', () => {
            const offlineRegionLayer = new VectorLayer({
                title: 'offlineRegionLayer',
                zIndex: 2000,
                source: new FeatureDataSource(),
                showInLayerList: true,
                workspace: {
                    enabled: true,
                },
                exportable: true,
                browsable: false,
                style: this.styleService.createStyle({
                    stroke: {
                        color: "blue",
                    },
                    width: 5
                }
                )
            });
            tryBindStoreLayer(this.regionStore, offlineRegionLayer);
            tryAddLoadingStrategy(this.regionStore, new FeatureStoreLoadingStrategy({
                motion: FeatureMotion.None
            }));
            const offlineRegionsLayer = new VectorLayer({
                title: 'offlineRegionsLayer',
                zIndex: 2000,
                source: new FeatureDataSource(),
                showInLayerList: true,
                workspace: {
                    enabled: true,
                },
                exportable: true,
                browsable: false,
                style: (feature: olFeature<Geometry>, resolution) => {
                    const currentZoom = this.map.viewController.getZoom();
                    const endLevel = feature.getProperties().endLevel;
                    const startLevel = feature.getProperties().startLevel;
                    let textContent = '';
                    if (currentZoom < startLevel && currentZoom < endLevel) {
                        textContent = 'Zoom +';
                    }
                    if (currentZoom > startLevel && currentZoom > endLevel) {
                        textContent = 'Zoom -';
                    }

                    const text = {
                        text: textContent,
                        stroke: { color: 'white', width: 0.75 },
                        fill: { color: 'black' },
                        font: '20px sans-serif',
                        overflow: true
                    };
                    const fill = {color: 'rgba(0, 0, 255, 0.1)'};
                    const stroke = {color: 'orange'};

                    const style: olstyle.Style = this.styleService.createStyle({
                        stroke,
                        fill,
                        text
                    });
                    const pointStyle: olstyle.Style = this.styleService.createStyle({
                        circle: {
                            radius: 5,
                            fill,
                            stroke
                        },
                        text
                    });

                    if (feature.getGeometry().getType() === 'Point') {
                        return pointStyle;
                    };
                    const clonedStyle = style.clone();
                    style.getText().setText('');
                    let featureGeojson = JSON.parse(new OlGeoJSON().writeGeometry(feature.getGeometry()));
                    let intersection;
                    if (feature.getGeometry().getType() === 'LineString') {
                        let turfFeatureGeojson = JSON.parse(new OlGeoJSON()
                            .writeGeometry(feature.getGeometry(),{
                                dataProjection: 'EPSG:4326',
                                featureProjection: this.map.projection
                              }));
                        const myBufferedFeature: Feature = buffer(turfFeatureGeojson, 10, { units: 'meters' });
                        myBufferedFeature.projection = 'EPSG:4326';
                        const myBufferedOlFeature = featureToOl(myBufferedFeature, this.map.projection);
                        featureGeojson = JSON.parse(new OlGeoJSON().writeGeometry(myBufferedOlFeature.getGeometry(),{
                            dataProjection: this.map.projection,
                            featureProjection: this.map.projection
                          }));
                    }
                    if (
                        feature.getGeometry().getType() === 'Polygon' ||
                        feature.getGeometry().getType() === 'LineString') {
                        const extentPolygon = fromExtent(this.map.viewController.getExtent());
                        const extentPolygonGeojson: Polygon = JSON.parse(new OlGeoJSON().writeGeometry(extentPolygon));
                        intersection = intersect(featureGeojson, extentPolygonGeojson);
                    }
                    const pointOnFeatureFeature = pointOnFeature(intersection ? intersection.geometry : featureGeojson);
                    const pointOnFeatureGeometry = new OlGeoJSON().readGeometry(pointOnFeatureFeature.geometry,{
                        dataProjection: this.map.projection,
                        featureProjection: this.map.projection
                      });
                    clonedStyle.setGeometry(pointOnFeatureGeometry);
                    style.getText().setText('');
                    return [style,clonedStyle];
                  }
            });

/*
      this.store.layer.ol.setStyle((feature, resolution) => {
        return this.drawStyleService.createDrawingLayerStyle(feature, resolution, labelsAreShown, this.icon);
      }); */

            tryBindStoreLayer(this.offlineRegionsStore, offlineRegionsLayer);
            tryAddLoadingStrategy(this.offlineRegionsStore, new FeatureStoreLoadingStrategy({
                motion: FeatureMotion.None
            }));
        });

        this.regionDB.getAll().pipe(first())
        .subscribe((RegionDBDatas: RegionDBData[]) => {
          RegionDBDatas.map((RegionDBData: RegionDBData) => {
            this.offlineRegionsStore.updateMany(RegionDBData.parentFeatureText.map(f => {
              const offlineFeature = JSON.parse(f);
              delete offlineFeature.ol;
              offlineFeature.properties = {...offlineFeature.properties, ...RegionDBData.generationParams };
              return offlineFeature;
            }));
            });
        });
    }
    addNewTileToDownload(tile: TransferedTile) {
        if (!tile) {
            return;
        }
        this.addNewTile$.next(tile);
    }

    set openedWithMouse(value: boolean) {
        this._openedWithMouse = value;
    }

    get openedWithMouse(): boolean {
        return this._openedWithMouse;
    }

    set rightMouseClick(value: boolean) {
        this.rightMouseClick$.next(value);
    }
}
