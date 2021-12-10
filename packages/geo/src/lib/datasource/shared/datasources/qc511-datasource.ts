import olSourceVector from 'ol/source/Vector';
import * as olformat from 'ol/format';
import type { default as OlGeometry } from 'ol/geom/Geometry';
import * as olproj from 'ol/proj';
import * as OlLoadingStrategy from 'ol/loadingstrategy';
import olProjection from 'ol/proj/Projection';
import olFeature from 'ol/Feature';
import * as olGeom from 'ol/geom';
import * as olstyle from 'ol/style';

import { DataSource } from './datasource';
import { FeatureDataSourceOptions } from './feature-datasource.interface';


export class Qc511DataSource extends DataSource {
  public options: FeatureDataSourceOptions;
  public ol: olSourceVector<OlGeometry>;
  protected createOlSource(): olSourceVector<OlGeometry> {
    const vectorSource = new olSourceVector({
      format: new olformat.GeoJSON(),
      loader: function(extent, resolution, projection, success, failure) {
        var proj = projection.getCode();
        const currentExtent = olproj.transformExtent(extent, proj, 'EPSG:4326');
        console.log(currentExtent);
        // const zoom = this.map.viewController.olView.getZoomForResolution(resolution);
        const url = `https://www.quebec511.info/fr/Carte/Element.ashx?action=ChantierMunicipal&xMin=${currentExtent[0]}&yMin=${currentExtent[1]}&xMax=${currentExtent[2]}&yMax=${currentExtent[3]}&lang=fr&zoom=${6}`;
        console.log(url);
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        var onError = function () {
          vectorSource.removeLoadedExtent(extent);
          failure();
        };
        xhr.onerror = onError;
        xhr.onload = function () {
          if (xhr.status === 200) {
            const qc511Response = JSON.parse(xhr.responseText);
            const features = [];
            qc511Response.map(f => {
              const geometry = new olGeom.Point(
                olproj.transform([f.lng, f.lat], 'EPSG:4326', proj)
              );
              const feature = new olFeature({ geometry });
              feature.setId(f.id);
              feature.setProperties(f);

              const iconStyle = new olstyle.Style({
                image: new olstyle.Icon({
                  anchor: [0.5, 0],
                  anchorOrigin: 'bottom-left',
                  anchorXUnits: 'fraction',
                  anchorYUnits: 'pixels',
                  src: '/Carte/Images/gm/'+f.ico,
                }),
              });
              //    TODO Demander trottier getinfo par id.
              feature.setStyle(iconStyle);
              features.push(feature);
            });
            vectorSource.addFeatures(features);
            success(features);
          } else {
            onError();
          }
        };
        xhr.send();
      },
      strategy: OlLoadingStrategy.bbox
    });
    return vectorSource;
  }

  public onUnwatch() {}

  get queryTitle(): string {
    return (this.options as any).queryTitle
      ? (this.options as any).queryTitle
      : 'title';
  }
}
