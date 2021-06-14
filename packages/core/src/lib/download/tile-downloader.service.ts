import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GeoDataDBService } from '../storage';
import { first } from 'rxjs/operators';
import { createFromTemplate } from 'ol/tileurlfunction.js';
import { BehaviorSubject, forkJoin, Observable, Observer } from 'rxjs';
import { GeoNetworkService } from '../network';

interface Tile {
  X: number;
  Y: number;
  Z: number;
}

function zoom(tile: Tile): Tile[] {
  const x0 = 2 * tile.X;
  const y0 = 2 * tile.Y;
  const z = tile.Z + 1;
  const tiles: Tile[] = [];
  for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
          tiles.push({X: x0 + i, Y: y0 + j, Z: z} as Tile);
      }
  }
  return tiles;
}

function getTreeNodes(root: Tile, maxDepth: number) {
  if (root.Z === maxDepth) {
    return [root];
  }

  const children = zoom(root);
  let nextChildren: Tile[] = [];
  children.forEach((child) => {
    nextChildren = nextChildren.concat(getTreeNodes(child, maxDepth));
  });
  return [root].concat(nextChildren);
}

function getNumberOfTreeNodes(deltaHeigth: number) {
  return (Math.pow(4, deltaHeigth + 1) - 1) / 3;
}

@Injectable({
  providedIn: 'root'
})
export class TileDownloaderService {
  readonly maxHeigthDelta: number = 4;
  readonly simultaneousRequests: number = 20;
  readonly averageBytesPerTile = 13375;

  readonly progression$: BehaviorSubject<number> = new BehaviorSubject(undefined);
  readonly isDownloading$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  private urlQueue: string[] = [];
  private _isDownloading: boolean = false;

  private currentDownloads: number = 0;
  private downloadCount: number = 0;
  public urlGenerator: (coord: [number, number, number],
                        pixelRatio, projection) => string;

  constructor(
    private http: HttpClient,
    private network: GeoNetworkService,
    private geoDB: GeoDataDBService) { }

  private generateTiles(tile: Tile, depth: number): Tile[] {
    return getTreeNodes(tile, tile.Z + depth);
  }

  private generateTilesRegion(region: Tile[], depth: number) {
    let tiles = [];
    region.forEach((tile) => {
      tiles = tiles.concat(this.generateTiles(tile, depth));
    });
    return tiles;
  }

  private initURLGenerator(tileGrid, url) {
    this.urlGenerator = createFromTemplate(url, tileGrid);
  }

  private generateURL(tile: Tile) {
    try {
      return this.urlGenerator([tile.Z, tile.X, tile.Y], 0, 0);
    } catch (e) {
      return undefined;
    }
  }

  // need to create to refactor download service
  public downloadRegion(regionID: number, coords: [[number, number, number]], depth: number, tileGrids, srcs) {
    
  }

  public downloadFromCoord(
    coord3D: [number, number, number],
    regionID: number,
    depth: number,
    tileGrid, 
    src
  ) {
    
    if (!this.network.isOnline()) {
      return;
    }

    this.initURLGenerator(tileGrid, src);
    const rootTile: Tile = {X: coord3D[1], Y: coord3D[2], Z: coord3D[0]};
    const tiles = this.generateTiles(rootTile, depth);

    tiles.forEach((tile) => {
      const url = this.generateURL(tile);
      if (url) {
        this.urlQueue.push(url);
      }
    });

    console.log('Queue :', this.urlQueue.length);
    // if not already downloading start downloading
    if (!this.isDownloading) {
      this.downloadCount = 0;
      // put count here
      this.currentDownloads = tiles.length;
      console.log('starting download sequence!');
      this._isDownloading = true;
      this.isDownloading$.next(true);
      this.downloadSequence(regionID);
    }
    this.currentDownloads += tiles.length;
  }

  private downloadSequence(regionID: number) {
    const downloadTile = (url: string) => {
      return (observer: Observer<any>) => {
        const request = this.http.get(url, { responseType: 'blob' });
        request.subscribe((blob) => {
          this.geoDB.update(url, regionID, blob).subscribe(() => {
            observer.next('done downloading ' + url);
            observer.complete();
          });
        });
      };
    };

    const nextDownload = () => {
      const url =  this.urlQueue.shift();
      if (!url) {
        this._isDownloading = false;
        this.isDownloading$.next(false);
        console.log('downloading is done');
        return;
      }
      this.progression$.next(++this.downloadCount);
      const request = new Observable(downloadTile(url));
      request.subscribe(() => nextDownload());
    };

    const nWorkers = Math.min(this.simultaneousRequests, this.urlQueue.length);
    for (let i = 0; i < nWorkers; i++) {
      nextDownload();
    }
  }

  public getBufferProgression() {
    return 1 - this.urlQueue.length / this.currentDownloads;
  }

  public downloadEstimate(nTiles: number) {
    return nTiles * this.averageBytesPerTile;
  }

  public downloadEstimatePerDepth(depth: number) {
    const nTiles = getNumberOfTreeNodes(depth);
    return this.downloadEstimate(nTiles);
  }

  public numberOfTiles(depth: number) {
    return getNumberOfTreeNodes(depth);
  }

  get isDownloading() {
    return this._isDownloading;
  }
}
