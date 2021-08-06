import { PrintOutputFormat, PrintPaperFormat, PrintOrientation, PrintResolution, PrintSaveImageFormat } from './print.type';
import { Feature } from '../../feature';
import { IgoMap } from '../../map/shared/map';

export interface PrintOptions {
    outputFormat: PrintOutputFormat;
    paperFormat: PrintPaperFormat;
    orientation: PrintOrientation;
    resolution: PrintResolution;
    title?: string;
    subtitle?: string;
    comment?: string;
    imageFormat?: PrintSaveImageFormat;
    showLegend?: boolean;
    showProjection?: boolean;
    showScale?: boolean;
    isPrintService: boolean;
    doZipFile: boolean;
    scale: string;
    scalePrint: boolean;
}
export interface FeatureWithLimit extends Feature<FeatureWithLimitProperties> {}

export interface FeatureWithLimitProperties {
    id: string;
    coordinates?: any;
    dimensions?: any;
}
export interface FeatureStorePrintStrategyOptions {
    map: IgoMap;
}
export interface LimitStyle {
    fill?: string;
    stroke?: string;
}
export interface Limit {
    coordinate?: number;
    coordinates?: number[];
    dimensions?: number[];
}
