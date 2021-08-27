import { AuthInterceptor } from '@igo2/auth';
import { GeoNetworkService, MessageService } from '@igo2/core';
import olLayerVectorTile from 'ol/layer/VectorTile';
import olSourceVectorTile from 'ol/source/VectorTile';
import { first } from 'rxjs/operators';
import { MVTDataSource } from '../../../datasource/shared/datasources/mvt-datasource';
import { IgoMap } from '../../../map';
import { TileWatcher } from '../../utils';
import { Layer } from './layer';
import { VectorTileLayerOptions } from './vectortile-layer.interface';



export class VectorTileLayer extends Layer {
  public dataSource: MVTDataSource;
  public options: VectorTileLayerOptions;
  public ol: olLayerVectorTile;

  private watcher: TileWatcher;

  constructor(
    options: VectorTileLayerOptions,
    private geoNetwork: GeoNetworkService,
    public messageService?: MessageService,
    public authInterceptor?: AuthInterceptor,
  ) {
    super(options, messageService, authInterceptor);
    this.watcher = new TileWatcher(this);
    this.status$ = this.watcher.status$;
  }

  protected createOlLayer(): olLayerVectorTile {
    const olOptions = Object.assign({}, this.options, {
      source: this.options.source.ol as olSourceVectorTile
    });

    const vectorTile = new olLayerVectorTile(olOptions);
    const vectorTileSource = vectorTile.getSource() as olSourceVectorTile;

    vectorTileSource.setTileLoadFunction((tile, url) => {
      tile.setLoader((extent, resolution, projection) => {
          this.customLoader(tile, url, extent, resolution, projection);
        }
      );
    }
    );

    return vectorTile;
  }

  /**
   * Custom loader for vector tile layer. Modified from the loadFeaturesXhr function in ol\featureloader.js
   * @internal
   * @param url the url string or function to retrieve the data
   * @param format the format of the tile
   * @param interceptor the interceptor of the data
   * @param success On success event action to trigger
   * @param failure On failure event action to trigger TODO
   */
  customLoader(tile, url, extent, resolution, projection) {
    const request = this.geoNetwork.get(url);
    request.pipe(first()).subscribe((blob) => {
      if (!blob) {
        return;
      }
      const arrayBuffer = blob.arrayBuffer();
      arrayBuffer.then((data) => {
        const format = tile.getFormat();
        const features = format.readFeatures(data, {
          extent: extent,
          featureProjection: projection
        });
        tile.setFeatures(features);
      });
    });
  }

  public setMap(map: IgoMap | undefined) {
    if (map === undefined) {
      this.watcher.unsubscribe();
    } else {
      this.watcher.subscribe(() => {});
    }
    super.setMap(map);
  }
}
