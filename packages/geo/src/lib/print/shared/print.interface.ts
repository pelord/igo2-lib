import { PrintOutputFormat, PrintPaperFormat, PrintOrientation, PrintResolution, PrintSaveImageFormat } from './print.type';
import { Feature } from '../../feature';

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
export interface PrintTest extends Feature<FeatureWithTest> {}

export interface FeatureWithTest {
    id: string;
}
export interface Limit {
    coordinates?: number[];
    dimensions?: number[];
}
