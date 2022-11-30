import { Component } from '@angular/core';

import { LanguageService, MediaService } from '@igo2/core';
import { IgoMap, DataSourceService, LayerService, WFSDataSourceOptions, VectorLayerOptions, WFSDataSource } from '@igo2/geo';

@Component({
  selector: 'app-hover',
  templateUrl: './hover.component.html',
  styleUrls: ['./hover.component.scss']
})
export class AppHoverComponent {
  public selected;
  public pointerCoord;
  public pointerCoordDelay: number = 0;
  public pointerHoverFeatureDelay: number = 0;
  public map = new IgoMap({
    controls: {
      attribution: {
        collapsed: true
      },
      scaleLine: true
    }
  });

  public view = {
    center: [-73, 47.2],
    zoom: 8,
    projection: 'EPSG:3857'
  };


  get media() {
    return this.mediaService.getMedia();
  }

  get isTouchScreen() {
    return this.mediaService.isTouchScreen();
  }

  constructor(
    private languageService: LanguageService,
    private dataSourceService: DataSourceService,
    private layerService: LayerService,
    private mediaService: MediaService
  ) {

    this.dataSourceService
    .createAsyncDataSource({
      type: 'wmts',
      url: 'https://geoegl.msp.gouv.qc.ca/apis/carto/wmts/1.0.0/wmts',
      layer: 'carte_gouv_qc_public',
      matrixSet: 'EPSG_3857',
      version: '1.3.0'
    })
    .subscribe(dataSource => {
      this.map.addLayer(
        this.layerService.createLayer({
          title: 'Quebec',
          visible: true,
          baseLayer: true,
          source: dataSource
        })
      );
    });

    interface WFSDataOptions
      extends WFSDataSourceOptions {}

    const wfsDatasourcePolygon: WFSDataOptions = {
      type: 'wfs',
      url: 'https://geoegl.msp.gouv.qc.ca/apis/ws/igo_gouvouvert.fcgi',
      params: {
        featureTypes: 'adn_bassin_n1_public_v',
        fieldNameGeometry: 'geometry',
        maxFeatures: 10000,
        version: '3.0.0',
        outputFormat: undefined,
        outputFormatDownload: 'shp'
      }
    };
/*
    this.dataSourceService
      .createAsyncDataSource(wfsDatasourcePolygon)
      .subscribe((dataSource: WFSDataSource) => {
        const layer: VectorLayerOptions = {
          title: 'WFS (polygon)',
          visible: true,
          source: dataSource
        };
        this.map.addLayer(this.layerService.createLayer(layer));
      });

    const wfsDatasourcePoint: WFSDataOptions = {
      type: 'wfs',
      url: 'https://geoegl.msp.gouv.qc.ca/apis/wss/all.fcgi',
      params: {
        featureTypes: 'MSP_CASERNE_PUBLIC',
        fieldNameGeometry: 'geometry',
        maxFeatures: 10000,
        version: '2.0.0',
        outputFormat: undefined,
        outputFormatDownload: 'shp'
      }
    };
/*
    this.dataSourceService
      .createAsyncDataSource(wfsDatasourcePoint)
      .subscribe((dataSource: WFSDataSource) => {
        const layer: VectorLayerOptions = {
          title: 'WFS (point)',
          visible: true,
          source: dataSource,
          styleByAttribute: {
            attribute: 'en_caserne',
            data: ['true', 'false'],
            stroke: ['red', 'blue'],
            fill: ['#ffffff', '#ffffff'],
            radius: [7, 7],
            width: [2, 2]
          },
          hoverStyle: {
            label: {
              attribute: 'Caserne: ${no_caserne} \n Mun: ${nom_ssi}',
              style: {
                textAlign: 'left',
                textBaseline: 'top',
                font: '12px Calibri,sans-serif',
                fill: { color: '#000' },
                backgroundFill: { color: 'rgba(255, 255, 255, 0.5)' },
                backgroundStroke: { color: 'rgba(200, 200, 200, 0.75)', width: 2 },
                stroke: { color: '#fff', width: 3 },
                overflow: true,
                offsetX: 20,
                offsetY: 10,
                padding: [2.5, 2.5, 2.5, 2.5]
              }
            },
            baseStyle: {
              circle: {
                stroke: {
                  color: 'orange',
                  width: 5
                },
                width: [5],
                radius: 15
              }
            }
          }
        };
        this.map.addLayer(this.layerService.createLayer(layer));
      });*/

      this.layerService
      .createAsyncLayer({
        title: 'Vector tile with custom getfeatureinfo url',
        visible: true,
        sourceOptions: {
          type: 'mvt',
          url: 'https://tiles.arcgis.com/tiles/0lL78GhXbg1Po7WO/arcgis/rest/services/VT_INFOCRUE_DEV_Median_Jour2/VectorTileServer/tile/{z}/{y}/{x}.pbf',
            //'https://ahocevar.com/geoserver/gwc/service/tms/1.0.0/ne:ne_10m_admin_0_countries@EPSG:900913@pbf/{z}/{x}/{-y}.pbf',
          queryable: true,
          queryUrl: 'https://geoegl.msp.gouv.qc.ca/apis/wss/amenagement.fcgi?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&FORMAT=image%2Fpng&TRANSPARENT=true&QUERY_LAYERS=wms_mern_reg_admin&LAYERS=wms_mern_reg_admin&DPI=96&MAP_RESOLUTION=96&FORMAT_OPTIONS=dpi%3A96&INFO_FORMAT=geojson&FEATURE_COUNT=5&I=50&J=50&CRS=EPSG:{srid}&STYLES=&WIDTH=101&HEIGHT=101&BBOX={xmin},{ymin},{xmax},{ymax}',
          queryLayerFeatures: true,
          queryFormat: 'esrijson',
          sourceFields : [
            {"name" : "Troncon", "alias" : "Tronçon"},
            {"name" : "Prevision", "alias" : "Prévision"},
            {"name" : "DateHeureMAJPrevision", "alias" : "Dernière mise à jour"},
            {"name" : "DateHeurePrevision", "alias" : "Date heure crue max"},
            {"name" : "planEau", "alias" : "Plan d'eau"},
            {"name" : "nomBassin", "alias" : "Bassin"},
            {"name" : "messageParticulier", "alias" : "Message"},
            {"name" : "typePrevision", "alias" : "prévision"}
          ]
        },
        "hoverStyle": {
          "visible": false,
          "attribute":[""],
          "data": [""],
          "stroke": ["rgba(51,153,204)"],
          "fill":["rgba(51,153,204,0.4)"],
          "radius":[25],
          "width": [10],
          "label": {
            "attribute": "Sélectionner le tronçon",
            "style": {
              "textAlign": "left",
              "textBaseline": "top",
              "font": "13px Open Sans SemiBold, roboto",
              "fill": { "color": "#fff" },
              "backgroundFill": { "color": "rgba(91, 91,91, 0.7)" },
              "backgroundStroke": { "color": "rgba(200, 200, 200, 0.75)", "width": 0 },
              "overflow": true,
              "offsetX": 30,
              "offsetY": 10,
              "padding": [2.8, 2.8, 2.8, 2.8]
            }
          }
        },
        mapboxStyle: {
          url: 'https://tiles.arcgis.com/tiles/0lL78GhXbg1Po7WO/arcgis/rest/services/VT_INFOCRUE_DEV_Median_Jour2/VectorTileServer/resources/styles', //'assets/mapboxStyleExample-vectortile.json',
          source: 'esri'
        },
      } as any)
      .subscribe(l => this.map.addLayer(l));


  }
}
