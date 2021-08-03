import { Injectable } from '@angular/core';
import { Geometry } from '@turf/helpers';
import { Observable, Subscription, zip } from 'rxjs';
import { map, skip } from 'rxjs/operators';
import { Region, RegionDBData, RegionDBService, RegionStatus, TileDBData, TileDBService } from '../storage';
import { RegionDBAdminService } from '../storage/region-db/region-db-admin.service';
import { DownloadEstimator } from './download-estimator';
import { RegionUpdateParams, TileToDownload } from './download.interface';
import { TileDownloaderService } from './tile-downloader';
import { TileGenerationParams } from './tile-downloader/tile-generation-strategies';




@Injectable({
  providedIn: 'root'
})
export class DownloadRegionService {
  isDownloading$$: Subscription;

  private downloadEstimator = new DownloadEstimator();

  private currentDownloadRegionID: number;
  private cancel$$: Subscription;

  constructor(
    private tileDownloader: TileDownloaderService,
    private tileDB: TileDBService,
    private regionDB: RegionDBService,
    private regionDBAdmin: RegionDBAdminService
  ) {
    this.regionDBAdmin.hardUpdate();
  }

  public downloadSelectedRegion(
    tilesToDownload: TileToDownload[],
    regionName: string,
    generationParams: TileGenerationParams,
    tileGrid,
    templateUrl
  ) {
    if (this.isDownloading$$) {
      this.isDownloading$$.unsubscribe();
    }
    const parentUrls = tilesToDownload.map((item: TileToDownload) => {
      return item.url;
    });

    const parentFeatureText = tilesToDownload.map((item: TileToDownload) => {
      return item.featureText;
    });

    const numberOfTiles = this.downloadEstimator.estimateNumberOfTiles(
      tilesToDownload.length,
      generationParams
    );

    const region: Region = {
      name: regionName,
      status: RegionStatus.Downloading,
      parentUrls,
      generationParams,
      numberOfTiles,
      parentFeatureText
    };

    this.regionDB.add(region)
      .subscribe((regionID: number) => {
        this.currentDownloadRegionID = regionID;
        for (const tile of tilesToDownload) {
          this.tileDownloader.downloadFromCoord(
            tile.coord,
            regionID,
            generationParams,
            tileGrid,
            templateUrl
          );
        }
        this.isDownloading$$ = this.tileDownloader.isDownloading$
          .pipe(skip(1))
          .subscribe((isDownloading) => {
            if (!isDownloading) {
              const collisionMap = this.tileDB.collisionsMap;
              const validTile = this.tileDownloader.validDownloadCount;
              const date = new Date();
              const regionDBData: RegionDBData = {
                id: regionID,
                status: RegionStatus.OK,
                name: regionName,
                parentUrls,
                parentFeatureText,
                numberOfTiles: validTile,
                timestamp: date,
                generationParams
              };

              this.regionDB.update(regionDBData);
              this.regionDB.updateWithCollisions(collisionMap);
              this.tileDB.resetCollisionMap();
          }
        });
      });
  }

  downloadRegionFromFeatures(
    featuresText: string[],
    geometries: Geometry[],
    regionName: string,
    generationParams: TileGenerationParams,
    tileGrid,
    templateUrl: string
  ) {
    if (this.isDownloading$$) {
      this.isDownloading$$.unsubscribe();
    }
    const parentUrls = new Array();
    const parentFeatureText = featuresText;
    const numberOfTiles = undefined;

    const region: Region = {
      name: regionName,
      status: RegionStatus.Downloading,
      parentUrls,
      generationParams,
      numberOfTiles,
      parentFeatureText
    };

    this.regionDB.add(region).subscribe((regionID: number) => {
      const tiles = this.tileDownloader.downloadFromFeatures(
        geometries,
        regionID,
        generationParams,
        tileGrid,
        templateUrl
      );
      console.log('Generated tiles', tiles);
      this.isDownloading$$ = this.tileDownloader.isDownloading$.subscribe(
        (isDownloading) => {
          if (isDownloading) {
            return;
          }

          const collisionMap = this.tileDB.collisionsMap;
          const validTile = this.tileDownloader.validDownloadCount;
          const date = new Date();
          const regionDBData: RegionDBData = {
            id: regionID,
            status: RegionStatus.OK,
            name: regionName,
            parentUrls,
            parentFeatureText,
            numberOfTiles: validTile,
            timestamp: date,
            generationParams
          };
          console.log('done downloading regionDB', regionDBData);
          this.regionDB.update(regionDBData);
          this.regionDB.updateWithCollisions(collisionMap);
          this.tileDB.resetCollisionMap();
      });
    });
  }

  private updateRegionDBData(
    oldRegion: RegionDBData,
    updateParams: RegionUpdateParams
  ): RegionDBData {
    const region: RegionDBData = oldRegion;
    region.name = updateParams.name;

    const tileToDownload = updateParams.newTiles;
    const newParentUrls = tileToDownload.map((tile) => {
      return tile.url;
    });
    const parentUrls =  oldRegion.parentUrls.concat(newParentUrls);
    region.parentUrls = parentUrls;

    const newFeatureText = tileToDownload.map((tile) => {
      return tile.featureText;
    });
    region.parentFeatureText = oldRegion.parentFeatureText.concat(newFeatureText);

    const genParams = oldRegion.generationParams;
    const numberOfTiles = this.downloadEstimator.estimateNumberOfTiles(
      parentUrls.length,
      genParams
    );
    region.numberOfTiles = numberOfTiles;

    region.status = RegionStatus.Downloading;

    this.regionDB.update(region);
    return region;
  }

  public updateRegion(oldRegion: RegionDBData, updateParams: RegionUpdateParams) {
    const region = this.updateRegionDBData(oldRegion, updateParams);

    const regionID = oldRegion.id;
    const tileToDownload = updateParams.newTiles;
    const generationParams = region.generationParams;
    const templateUrl = updateParams.templateUrl;
    const tileGrid = updateParams.tileGrid;

    for (const tile of tileToDownload) {
      this.tileDownloader.downloadFromCoord(
        tile.coord,
        regionID,
        generationParams,
        tileGrid,
        templateUrl
      );
    }

    const dbRequest = this.tileDB.getRegionByID(regionID)
      .pipe(
        map((tiles: TileDBData[]) => {
          return tiles.map((tile) => tile.url );
        })
      );

    dbRequest.subscribe((urls: string[]) => {
      if (this.isDownloading$$) {
        this.isDownloading$$.unsubscribe();
      }

      this.tileDownloader.downloadFromUrls(urls, regionID);

      this.isDownloading$$ = this.tileDownloader.isDownloading$
        .pipe(skip(1))
        .subscribe((isDownloading) => {
          if (!isDownloading) {
            const collisionMap = this.tileDB.collisionsMap;
            const validTile = this.tileDownloader.validDownloadCount;

            region.numberOfTiles = validTile;
            region.timestamp = new Date();
            region.status = RegionStatus.OK;

            this.regionDB.update(region);
            this.regionDB.updateWithCollisions(collisionMap);
            this.tileDB.resetCollisionMap();
          }
        });
    });
  }

  public deleteRegionByID(regionID: number): Observable<[boolean, boolean]> {
    if (!regionID) {
      return;
    }

    const regionDBRequest = this.regionDB.deleteByRegionID(regionID);
    const tileDBRequest = this.tileDB.deleteByRegionID(regionID);
    return zip(regionDBRequest, tileDBRequest);
  }

  public cancelRegionDownload() {
    if (this.cancel$$) {
      this.cancel$$.unsubscribe();
    }
    console.log('cancel region download');
    const cancel$ = this.tileDownloader.cancelDownload();
    this.isDownloading$$.unsubscribe();
    this.cancel$$ = cancel$.subscribe(
      (canceled) => {
        if (canceled) {
          this.deleteRegionByID(this.currentDownloadRegionID);

          const collisionMap = this.tileDB.collisionsMap;
          this.regionDB.updateWithCollisions(collisionMap);
          this.tileDB.resetCollisionMap();
        }
      });
  }
}
