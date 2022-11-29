import { Injectable } from '@angular/core';
import { NgxIndexedDBService } from 'ngx-indexed-db';
import { CompressionService } from '@igo2/core';
import { GeoDBService } from './geoDB.service';


@Injectable({
  providedIn: 'root'
})
export class TileDBService extends GeoDBService {
  readonly dbName: string = 'tileData';
  public collisionsMap: Map<number, string[]> = new Map();
  public _newData: number = 0;

  constructor(
    ngxIndexedDBService: NgxIndexedDBService,
    compression: CompressionService
  ) {
    super(ngxIndexedDBService,compression);
  }

}
