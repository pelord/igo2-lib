import { Injectable } from '@angular/core';
import { DBMode } from 'ngx-indexed-db';
import { interval } from 'rxjs';
import { TileDBService } from '../tile-db/tile-db.service';
import { TileDBData } from '../tile-db/TileDBData.interface';
import { RegionDBService } from './region-db.service';
import { RegionDBData, RegionStatus } from './Region.interface';


@Injectable({
  providedIn: 'root'
})
export class RegionDBAdminService {
  private static readonly ONE_SECOND = 1000;
  private static readonly ONE_MINUTE = RegionDBAdminService.ONE_SECOND * 60;
  private static readonly ONE_HOUR = RegionDBAdminService.ONE_MINUTE * 60;
  private static readonly ONE_DAY = RegionDBAdminService.ONE_HOUR * 24;
  private static readonly ONE_MONTH = RegionDBAdminService.ONE_DAY * 30;
  private readonly expirationInterval = RegionDBAdminService.ONE_MONTH;

  constructor(
    private regionDB: RegionDBService,
    private tileDB: TileDBService
  ) {
    interval(RegionDBAdminService.ONE_MINUTE * 5).subscribe(() => {
      this.checkExpirations();
    });
  }

  updateStatus(region: RegionDBData, newStatus: RegionStatus) {
    const updatedRegion: RegionDBData = region;
    updatedRegion.status = newStatus;
    this.regionDB.update(updatedRegion);
  }

  public updateAllRegionTileCount() {
    const tileCountPerRegion: Map<number, number> = new Map();
    this.tileDB.openCursor().subscribe((event) => {
      if (!event) {
        return;
      }

      const cursor = (event.target as IDBOpenDBRequest).result;
      if (cursor) {
        const value: TileDBData = (cursor as any).value;
        const regionID = value.regionID;
        let tileCount = tileCountPerRegion.get(regionID);
        if (tileCount) {
          tileCountPerRegion.set(regionID, ++tileCount);
        } else {
          tileCountPerRegion.set(regionID, 1);
        }
        (cursor as any).continue();
      } else {
        this.updateRegionTileCountWithMap(tileCountPerRegion);
      }
    });
  }

  public hardUpdate() {
    this.cancelRegionDownloadStatus();
    this.updateAllRegionTileCount();
  }

  private cancelRegionDownloadStatus() {
    this.regionDB.openCursor(undefined, DBMode.readwrite).subscribe((event) => {
      if (!event) {
        return;
      }

      const cursor = (event.target as IDBOpenDBRequest).result;
      if (cursor) {
        const region: RegionDBData = (cursor as any).value;
        const status = region.status;
        if (status === RegionStatus.Downloading) {
          region.status = RegionStatus.OK;
          (cursor as any).update(region);
        }
        (cursor as any).continue();
      } else {
        this.regionDB.needUpdate();
      }
    });
  }

  private updateRegionTileCountWithMap(tileCountPerRegion: Map<number, number>) {
    if (!tileCountPerRegion) {
      return;
    }

    this.regionDB.openCursor(undefined, DBMode.readwrite).subscribe((event) => {
      if (!event) {
        return;
      }

      const cursor = (event.target as IDBOpenDBRequest).result;
      if (cursor) {
        const region: RegionDBData = (cursor as any).value;
        const tileCount = tileCountPerRegion.get(region.id);
        if (tileCount !== undefined && tileCount !== 0) {
          region.numberOfTiles = tileCount;
          (cursor as any).update(region);
        } else {
          (cursor as any).delete();
        }
        (cursor as any).continue();
      } else {
        this.regionDB.needUpdate();
      }
    });
  }

  checkExpirations() {
    let needUpdate = false;
    this.regionDB.openCursor(undefined, DBMode.readwrite).subscribe((event) => {
      if (!event) {
        return;
      }
      const cursor = (event.target as IDBOpenDBRequest).result;
      if (!cursor) {
        if (needUpdate) {
          this.regionDB.needUpdate();
        }
        return;
      }
      const region: RegionDBData = (cursor as any).value;
      if (region.status === RegionStatus.Downloading) {
        return;
      }

      const downloadDate: Date = region.timestamp;
      const currentDate = new Date();
      if (currentDate.getTime() - downloadDate.getTime() >= this.expirationInterval) {
        if (region.status !== RegionStatus.Expired) {
          region.status = RegionStatus.Expired;
          (cursor as any).update(region);
          needUpdate = true;
        }
      }
      (cursor as any).continue();
    });
  }

  public updateRegionTileCount(region: RegionDBData) {
    if (!region) {
      return;
    }

    this.tileDB.getRegionTileCountByID(region.id).subscribe((count: number) => {
      const newRegion = region;
      newRegion.numberOfTiles = count;
      this.regionDB.update(newRegion);
    });
  }
}
