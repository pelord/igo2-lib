import olLayerTile from 'ol/layer/Tile';
import olSourceTile from 'ol/source/Tile';
import Tile from 'ol/Tile';
import TileState from 'ol/TileState';

import { TileWatcher } from '../../utils';
import { IgoMap } from '../../../map';

import { OSMDataSource } from '../../../datasource/shared/datasources/osm-datasource';
import { WMTSDataSource } from '../../../datasource/shared/datasources/wmts-datasource';
import { XYZDataSource } from '../../../datasource/shared/datasources/xyz-datasource';
import { CartoDataSource } from '../../../datasource/shared/datasources/carto-datasource';
import { TileArcGISRestDataSource } from '../../../datasource/shared/datasources/tilearcgisrest-datasource';
import { TileDebugDataSource } from '../../../datasource/shared/datasources/tiledebug-datasource';

import { Layer } from './layer';
import { TileLayerOptions } from './tile-layer.interface';

import { MessageService } from '@igo2/core';
import { AuthInterceptor } from '@igo2/auth';
import { GeoNetworkService, ResponseType } from '../../../offline/shared/geo-network.service';
import { first } from 'rxjs';
import { DbNameEnum } from '../../../offline/geoDB/geoDB.enums';
export class TileLayer extends Layer {
  public dataSource:
    | OSMDataSource
    | WMTSDataSource
    | XYZDataSource
    | TileDebugDataSource
    | CartoDataSource
    | TileArcGISRestDataSource;
  public options: TileLayerOptions;
  public ol: olLayerTile<olSourceTile>;

  private watcher: TileWatcher;

  get offlinable(): boolean {
    return this.options.offlinable || false;
  }

  constructor(
    options: TileLayerOptions,
    public messageService?: MessageService,
    public authInterceptor?: AuthInterceptor,
    private geoNetworkService?: GeoNetworkService) {
    super(options, messageService);

    this.watcher = new TileWatcher(this);
    this.status$ = this.watcher.status$;
  }

  protected createOlLayer(): olLayerTile<olSourceTile> {
    const olOptions = Object.assign({}, this.options, {
      source: this.options.source.ol
    });
    const tileLayer = new olLayerTile(olOptions);
    const tileSource = tileLayer.getSource();
    tileSource.setTileLoadFunction((tile: Tile, url: string) => {
      this.customLoader(tile, url, this.authInterceptor, this.offlinable);
    });

    return tileLayer;
  }

  /**
   * Custom loader for tile layer.
   * @internal
   * @param tile the current tile
   * @param url the url string or function to retrieve the data
   */
  customLoader(tile: Tile, url: string, interceptor: AuthInterceptor, offlinable: boolean) {
    const alteredUrlWithKeyAuth = interceptor.alterUrlWithKeyAuth(url);
    let modifiedUrl = url;
    if (alteredUrlWithKeyAuth) {
      modifiedUrl = alteredUrlWithKeyAuth;
    }
    if (!offlinable) {
      (tile as any).getImage().src = modifiedUrl;
      return;
    }
    const request = this.geoNetworkService.get(modifiedUrl, { responseType: ResponseType.Blob }, DbNameEnum.TileData);
    request.pipe(first())
      .subscribe((blob) => {
        if (blob) {
          const urlCreator = window.URL;
          const imageUrl = urlCreator.createObjectURL(blob);
          (tile as any).getImage().src = imageUrl;
          (tile as any).getImage().onload = function () {
            URL.revokeObjectURL(this.src);
          };
        } else {
          tile.setState(TileState.ERROR);
        }
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
