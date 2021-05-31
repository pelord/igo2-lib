import olLayerImage from 'ol/layer/Image';
import olSourceImage from 'ol/source/Image';
import TileState from 'ol/TileState';

import { AuthInterceptor } from '@igo2/auth';

import { ImageWatcher } from '../../utils';
import { IgoMap } from '../../../map';

import { WMSDataSource } from '../../../datasource/shared/datasources/wms-datasource';

import { Layer } from './layer';
import { ImageLayerOptions } from './image-layer.interface';
import { ImageArcGISRestDataSource } from '../../../datasource/shared/datasources/imagearcgisrest-datasource';
import { GeoNetworkService } from '@igo2/core';
import { first } from 'rxjs/operators';

export class ImageLayer extends Layer {
  public dataSource: WMSDataSource | ImageArcGISRestDataSource;
  public options: ImageLayerOptions;
  public ol: olLayerImage;

  private watcher: ImageWatcher;

  constructor(
    options: ImageLayerOptions,
    public geoNetwork: GeoNetworkService,
    public authInterceptor?: AuthInterceptor,
  ) {
    super(options, authInterceptor);
    // this.geoNetwork = new GeoNetworkService();
    this.watcher = new ImageWatcher(this);
    this.status$ = this.watcher.status$;
  }

  protected createOlLayer(): olLayerImage {
    const olOptions = Object.assign({}, this.options, {
      source: this.options.source.ol as olSourceImage
    });

    const image = new olLayerImage(olOptions);
    if (this.authInterceptor) {
      (image.getSource() as any).setImageLoadFunction((tile, src) => {
        this.customLoader(tile, src, this.authInterceptor);
      });
    }

    return image;
  }

  public setMap(map: IgoMap | undefined) {
    if (map === undefined) {
      this.watcher.unsubscribe();
    } else {
      this.watcher.subscribe(() => {});
    }
    super.setMap(map);
  }

  private customLoader(tile, src, interceptor) {
    // const xhr = new XMLHttpRequest();
    // xhr.open('GET', src);

    // const intercepted = interceptor.interceptXhr(xhr, src);
    // if (!intercepted) {
    //   xhr.abort();
    //   tile.getImage().src = src;
    //   return;
    // }

    // xhr.responseType = 'arraybuffer';

    // xhr.onload = function() {
    //   const arrayBufferView = new Uint8Array((this as any).response);
    //   const blob = new Blob([arrayBufferView], { type: 'image/png' });
    //   const urlCreator = window.URL;
    //   const imageUrl = urlCreator.createObjectURL(blob);
    //   tile.getImage().src = imageUrl;
    // };
    // xhr.send();
    
    // const intercepted = interceptor.intercept(request.clone(), src)
    // if (!intercepted) {
      //   //sub.unsubscribe();
      //   tile.getImage().src = src;
      //   return;
      // }
      
    const request = this.geoNetwork.get(src)
    request.pipe(first()).subscribe((blob) => {
      if (blob) {
        const urlCreator = window.URL;
        const imageUrl = urlCreator.createObjectURL(blob);
        tile.getImage().src = imageUrl;
        tile.getImage().onload = function() {
          URL.revokeObjectURL(this.src);
        }
      }
      // } else {
      //   console.log("image tile state changed to error")
      //   //tile.setState(TileState.ERROR);
      // }
    });
  }
}
