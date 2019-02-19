import OlFeature from 'ol/Feature';

import { EntityStore } from '@igo2/common';
import { FeatureDataSource, VectorLayer } from '@igo2/geo';

import { IgoMap } from '../../map';

import { FeatureMotion } from './feature.enum';
import { Feature, FeatureStoreOptions } from './feature.interfaces';
import { featureToOl, moveToFeatures } from './feature.utils';
import { FeatureStoreStrategy } from './strategies/strategy';

/**
 * The class is a specialized version of an EntityStore that stores
 * features and the map layer to display them on. Synchronization
 * between the store and the layer is handled by strategies.
 */
export class FeatureStore<T extends Feature = Feature> extends EntityStore<T> {

  /**
   * Feature store strategies responsible of synchronizing the store
   * and the layer
   */
  strategies: FeatureStoreStrategy[] = [];

  /**
   * Vector layer to display the features on
   */
  layer: VectorLayer;

  /**
   * The map the layer is bound to
   */
  readonly map: IgoMap;

  /**
   * The layer's data source
   */
  get source(): FeatureDataSource {
    return this.layer ? this.layer.dataSource as FeatureDataSource : undefined;
  }

  constructor(entities: T[], options: FeatureStoreOptions) {
    super(entities, options);
    this.map = options.map;
  }

  /**
   * Bind this store to a vector layer
   * @param layer Vector layer
   * @returns Feature store
   */
  bindLayer(layer: VectorLayer): FeatureStore {
    this.layer = layer;
    return this;
  }

  /**
   * Add a strategy to this store
   * @param strategy Feature store strategy
   * @returns Feature store
   */
  addStrategy(strategy: FeatureStoreStrategy): FeatureStore {
    const existingStrategy = this.strategies.find((_strategy: FeatureStoreStrategy) => {
      return strategy.constructor === _strategy.constructor;
    });
    if (existingStrategy !== undefined) {
      throw new Error('A strategy of this type already exists on that FeatureStore.');
    }

    this.strategies.push(strategy);
    strategy.bindStore(this);
    return this;
  }

  /**
   * Remove a strategy from this store
   * @param strategy Feature store strategy
   * @returns Feature store
   */
  removeStrategy(strategy: FeatureStoreStrategy): FeatureStore {
    const index = this.strategies.indexOf(strategy);
    if (index >= 0) {
      this.strategies.splice(index, 1);
      strategy.unbindStore(this);
    }
    return this;
  }

  /**
   * Return strategies of a given type
   * @param type Feature store strategy class
   * @returns Strategies
   */
  getStrategyOfType(type: typeof FeatureStoreStrategy): FeatureStoreStrategy {
    return this.strategies.find((strategy: FeatureStoreStrategy) => {
      return strategy instanceof type;
    });
  }

  /**
   * Activate strategies of a given type
   * @param type Feature store strategy class
   */
  activateStrategyOfType(type: typeof FeatureStoreStrategy) {
    const strategy = this.getStrategyOfType(type);
    if (strategy !== undefined) {
      strategy.activate();
    }
  }

  /**
   * Deactivate strategies of a given type
   * @param type Feature store strategy class
   */
  deactivateStrategyOfType(type: typeof FeatureStoreStrategy) {
    const strategy = this.getStrategyOfType(type);
    if (strategy !== undefined) {
      strategy.deactivate();
    }
  }

  /**
   * Set the layer's features and perform a motion to make them visible. Strategies
   * make extensive use of that method.
   * @param features Features
   * @param motion Optional: The type of motion to perform
   */
  setLayerFeatures(features: Feature[], motion: FeatureMotion = FeatureMotion.Default) {
    if (this.layer === undefined) {
      throw new Error('This FeatureStore is not bound to a layer.');
    }

    const olFeatures = features
      .map((feature: Feature) => featureToOl(feature, this.map.projection));
    this.setLayerOlFeatures(olFeatures, motion);
  }

  /**
   * Remove all features from the layer
   */
  clearLayer() {
    if (this.layer === undefined) {
      throw new Error('This FeatureStore is not bound to a layer.');
    }
    this.source.ol.clear();
  }

  /**
   * Set the layer's features and perform a motion to make them visible.
   * @param features Openlayers feature objects
   * @param motion Optional: The type of motion to perform
   */
  private setLayerOlFeatures(olFeatures: OlFeature[], motion: FeatureMotion = FeatureMotion.Default) {
    const olFeaturesMap = new Map();
    olFeatures.forEach((olFeature: OlFeature) => {
      olFeaturesMap.set(olFeature.getId(), olFeature);
    });

    const olFeaturesToRemove = [];
    this.source.ol.forEachFeature((olFeature: OlFeature) => {
      const newOlFeature = olFeaturesMap.get(olFeature.getId());
      if (newOlFeature === undefined) {
        olFeaturesToRemove.push(olFeature);
      } else if (newOlFeature.get('entityRevision') !== olFeature.get('entityRevision')) {
        olFeaturesToRemove.push(olFeature);
      } else {
        olFeaturesMap.delete(newOlFeature.getId());
      }
    });

    const olFeaturesToAddIds = Array.from(olFeaturesMap.keys());
    const olFeaturesToAdd = olFeatures.filter((olFeature: OlFeature) => {
      return olFeaturesToAddIds.indexOf(olFeature.getId()) >= 0;
    });

    if (olFeaturesToRemove.length > 0) {
      this.removeOlFeaturesFromLayer(olFeaturesToRemove);
    }
    if (olFeaturesToAdd.length > 0) {
      this.addOlFeaturesToLayer(olFeaturesToAdd);
    }

    // Determine the move action to take
    if (olFeaturesToAdd.length > 0) {
      moveToFeatures(this.map, olFeaturesToAdd, motion);
    } else if (olFeaturesToRemove.length > 0) {
      // Do nothing
    } else if (olFeatures.length > 0) {
      moveToFeatures(this.map, olFeatures, motion);
    }
  }

  /**
   * Add features to the the layer
   * @param features Openlayers feature objects
   */
  private addOlFeaturesToLayer(olFeatures: OlFeature[]) {
    olFeatures.forEach((olFeature: OlFeature) => {
      olFeature.set('featureStore', this);
    });
    this.source.ol.addFeatures(olFeatures);
  }

  /**
   * Remove features from the the layer
   * @param features Openlayers feature objects
   */
  private removeOlFeaturesFromLayer(olFeatures: OlFeature[]) {
    olFeatures.forEach((olFeature: OlFeature) => {
      this.source.ol.removeFeature(olFeature);
    });
  }

}
