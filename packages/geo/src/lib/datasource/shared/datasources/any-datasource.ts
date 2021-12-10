import { DataSource } from './datasource';
import { OSMDataSource } from './osm-datasource';
import { XYZDataSource } from './xyz-datasource';
import { WMSDataSource } from './wms-datasource';
import { WMTSDataSource } from './wmts-datasource';
import { WFSDataSource } from './wfs-datasource';
import { FeatureDataSource } from './feature-datasource';
import { CartoDataSource } from './carto-datasource';
import { ArcGISRestDataSource } from './arcgisrest-datasource';
import { TileArcGISRestDataSource } from './tilearcgisrest-datasource';
import { WebSocketDataSource } from './websocket-datasource';
import { MVTDataSource } from './mvt-datasource';
import { ClusterDataSource } from './cluster-datasource';
import { TileDebugDataSource } from './tiledebug-datasource';
import { ImageArcGISRestDataSource } from './imagearcgisrest-datasource';
import { Qc511DataSource } from './qc511-datasource';

export type AnyDataSource =
  | DataSource
  | OSMDataSource
  | FeatureDataSource
  | Qc511DataSource
  | WFSDataSource
  | XYZDataSource
  | TileDebugDataSource
  | WMTSDataSource
  | WMSDataSource
  | CartoDataSource
  | ArcGISRestDataSource
  | ImageArcGISRestDataSource
  | TileArcGISRestDataSource
  | WebSocketDataSource
  | MVTDataSource
  | ClusterDataSource;
