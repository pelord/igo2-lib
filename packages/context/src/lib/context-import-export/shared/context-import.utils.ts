import type { default as OlGeometry } from 'ol/geom/Geometry';

import {
  FeatureDataSource,
  FeatureDataSourceOptions,
  IgoMap,
  VectorLayer,
  QueryableDataSourceOptions,
  StyleService,
  StyleListService,
  StyleByAttribute,
  ClusterParam,
  ClusterDataSourceOptions,
  ClusterDataSource,
  featureRandomStyle,
  featureRandomStyleFunction,
  LayerOptions
} from '@igo2/geo';
import { MessageService } from '@igo2/core';
import { DetailedContext, ExtraFeatures } from '../../context-manager/shared/context.interface';
import { ContextService } from '../../context-manager/shared/context.service';
import OlFeature from 'ol/Feature';
import * as olStyle from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';

export function handleFileImportSuccess(
  file: File,
  context: DetailedContext,
  messageService: MessageService,
  contextService: ContextService
) {
  if (Object.keys(context).length <= 0) {
    handleNothingToImportError(file, messageService);
    return;
  }

  const contextTitle = computeLayerTitleFromFile(file);

  addContextToContextList(context, contextTitle, contextService);

  messageService.success(
    'igo.context.contextImportExport.import.success.text',
    'igo.context.contextImportExport.import.success.title', undefined, {
      value: contextTitle
    });
}

export function handleFileImportError(
  file: File,
  error: Error,
  messageService: MessageService,
  sizeMb?: number
) {
  sizeMb = sizeMb ? sizeMb : 30;
  const errMapping = {
    'Invalid file': handleInvalidFileImportError,
    'File is too large': handleSizeFileImportError,
    'Failed to read file': handleUnreadbleFileImportError
  };
  errMapping[error.message](
    file,
    error,
    messageService,
    sizeMb
  );
}

export function handleInvalidFileImportError(
  file: File,
  error: Error,
  messageService: MessageService,
) {
  messageService.error(
    'igo.context.contextImportExport.import.invalid.text',
    'igo.context.contextImportExport.import.invalid.title',
    undefined,
    {
      value: file.name,
      mimeType: file.type
    }
  );
}

export function handleSizeFileImportError(
  file: File,
  error: Error,
  messageService: MessageService,
  sizeMb: number
) {
  messageService.error(
    'igo.context.contextImportExport.import.tooLarge.text',
    'igo.context.contextImportExport.import.tooLarge.title',
    undefined,
    {
      value: file.name,
      size: sizeMb
    });
}

export function handleUnreadbleFileImportError(
  file: File,
  error: Error,
  messageService: MessageService
) {
  messageService.error(
    'igo.context.contextImportExport.import.unreadable.text',
    'igo.context.contextImportExport.import.unreadable.title',
    undefined,
    {
      value: file.name
    });
}

export function handleNothingToImportError(
  file: File,
  messageService: MessageService
) {
  messageService.error(
    'igo.context.contextImportExport.import.empty.text',
    'igo.context.contextImportExport.import.empty.title',
    undefined,
    { value: file.name });
}

export function addContextToContextList(
  context: DetailedContext,
  contextTitle: string,
  contextService: ContextService
) {
  context.title = contextTitle;
  context.imported = true;
  contextService.contexts$.value.ours.unshift(context);
  contextService.contexts$.next(contextService.contexts$.value);
  contextService.importedContext.unshift(context);
  contextService.loadContext(context.uri);
}

export function getFileExtension(file: File): string {
  return file.name.split('.').pop().toLowerCase();
}

export function computeLayerTitleFromFile(file: File): string {
  return file.name.substr(0, file.name.lastIndexOf('.'));
}

export function addImportedFeaturesToMap(
  extraFeatures: ExtraFeatures,
  map: IgoMap
): VectorLayer {
  const sourceOptions: FeatureDataSourceOptions & QueryableDataSourceOptions = {
    type: 'vector',
    queryable: true
  };

  const olFeatures = collectFeaturesFromExtraFeatures(extraFeatures);
  console.log('olFeatures', olFeatures);


  const source = new FeatureDataSource(sourceOptions);

  source.ol.addFeatures(olFeatures);
  let randomStyle;
  let editable: boolean = false;
  const featureKeys = olFeatures[0]?.getKeys() ?? [];
  console.log('featureKeys', featureKeys);
  // if (featureKeys.includes('_style') || featureKeys.includes('_mapTitle')) {
    randomStyle = featureRandomStyleFunction();
  /*} else {
    randomStyle = featureRandomStyle();
    editable = true;
  }*/

 
  
  console.log('randomStyle', randomStyle);
  const layer = new VectorLayer({
    title: extraFeatures.name,
    isIgoInternalLayer: true,
    source,
    igoStyle: { editable },
    style: randomStyle,
    visible: extraFeatures.visible,
    opacity: extraFeatures.opacity
  });
  map.addLayer(layer);

  return layer;
}
/*export function addImportedFeaturesToMap(
  olFeatures: OlFeature<OlGeometry>[],
  map: IgoMap,
  layerOptions: LayerOptions
): VectorLayer {
  const sourceOptions: FeatureDataSourceOptions & QueryableDataSourceOptions = {
    type: 'vector',
    queryable: true
  };
  const source = new FeatureDataSource(sourceOptions);
  source.ol.addFeatures(olFeatures);
  let randomStyle;
  let editable: boolean = false;
  const featureKeys = olFeatures[0]?.getKeys() ?? [];
  if (featureKeys.includes('_style') || featureKeys.includes('_mapTitle')) {
    randomStyle = featureRandomStyleFunction();
  } else {
    randomStyle = featureRandomStyle();
    editable = true;
  }
  const layer = new VectorLayer({
    title: layerOptions.title,
    isIgoInternalLayer: true,
    source,
    igoStyle: { editable },
    style: randomStyle,
    visible: layerOptions.visible,
    opacity: layerOptions.opacity
  });
  map.addLayer(layer);

  return layer;
}*/

export function addImportedFeaturesStyledToMap(
  olFeatures: OlFeature<OlGeometry>[],
  map: IgoMap,
  layerOptions: LayerOptions,
  styleListService: StyleListService,
  styleService: StyleService
): VectorLayer {
  let style;
  let distance: number;

  if (
    styleListService.getStyleList(layerOptions.title + '.styleByAttribute')
  ) {
    const styleByAttribute: StyleByAttribute = styleListService.getStyleList(
      layerOptions.title + '.styleByAttribute'
    );

    style = (feature, resolution) => {
      return styleService.createStyleByAttribute(feature, styleByAttribute, resolution);
    };
  } else if (
    styleListService.getStyleList(layerOptions.title + '.clusterStyle')
  ) {
    const clusterParam: ClusterParam = styleListService.getStyleList(
      layerOptions.title + '.clusterParam'
    );
    distance = styleListService.getStyleList(
      layerOptions.title + '.distance'
    );

    style = (feature, resolution) => {
      const baseStyle = styleService.createStyle(
        styleListService.getStyleList(layerOptions.title + '.clusterStyle'), feature, resolution
      );
      return styleService.createClusterStyle(feature, resolution, clusterParam, baseStyle);
    };
  } else if (styleListService.getStyleList(layerOptions.title + '.style')) {
    style = (feature, resolution) => styleService.createStyle(
      styleListService.getStyleList(layerOptions.title + '.style'), feature, resolution
    );
  } else {
    style = (feature, resolution) => styleService.createStyle(
      styleListService.getStyleList('default.style'), feature, resolution
    );
  }
  let source;
  if (styleListService.getStyleList(layerOptions.title + '.clusterStyle')) {
    const sourceOptions: ClusterDataSourceOptions &
      QueryableDataSourceOptions = {
      distance,
      type: 'cluster',
      queryable: true
    };
    source = new ClusterDataSource(sourceOptions);
  } else {
    const sourceOptions: FeatureDataSourceOptions &
      QueryableDataSourceOptions = {
      type: 'vector',
      queryable: true
    };
    source = new FeatureDataSource(sourceOptions);
  }

  const newFeatures = setCustomFeaturesStyle(olFeatures);
  source.ol.addFeatures(newFeatures);

  const layer = new VectorLayer({
    title: layerOptions.title,
    isIgoInternalLayer: true,
    opacity: layerOptions.opacity,
    visible: layerOptions.visible,
    source,
    style
  });
  map.addLayer(layer);

  return layer;
}

function collectFeaturesFromExtraFeatures(featureCollection: ExtraFeatures): OlFeature<OlGeometry>[]{
  const format = new GeoJSON();
  const features = format.readFeatures(featureCollection, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857'
  });
  return features;
}

function setCustomFeaturesStyle(olFeatures: OlFeature<OlGeometry>[]): OlFeature<OlGeometry>[] {
  let features: OlFeature<OlGeometry>[] = [];
  for (let index = 0; index < olFeatures.length; index++) {
    const feature: OlFeature<OlGeometry> = olFeatures[index];
    feature.setStyle(
      new olStyle.Style({
          fill: new olStyle.Fill({ color: feature.getProperties().drawingStyle.fill }),
          stroke: new olStyle.Stroke({ color: feature.getProperties().drawingStyle.stroke }),
          text: new olStyle.Text({ text: feature.getProperties().draw, font: feature.getProperties().fontStyle })
      })
    );
    features.push(feature);
  }
  return features;
}
