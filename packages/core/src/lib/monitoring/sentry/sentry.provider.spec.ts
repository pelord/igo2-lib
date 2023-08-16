import { APP_INITIALIZER, ErrorHandler, FactoryProvider } from '@angular/core';
import { Router } from '@angular/router';
import { TraceService } from '@sentry/angular-ivy';
import { provideSentryMonitoring } from './sentry.provider';
import { SentryMonitoringOptions } from './sentry.interface';
import { MOCK_SENTRY_OPTIONS } from '../__mocks__/monitoring-mock';

describe('Provide Sentry monitoring', () => {
  let options: SentryMonitoringOptions;

  beforeEach(() => {
    options = { ...MOCK_SENTRY_OPTIONS };
  });

  it('should return an empty array if options.enabled is false', () => {
    options.enabled = false;
    const isProd = true;
    const providers = provideSentryMonitoring(options, isProd);
    expect(providers).toEqual([]);
  });

  it('should return an array of providers if options.enabled is true', () => {
    const isProd = true;
    const providers = provideSentryMonitoring(options, isProd);
    expect(providers.length).toBeGreaterThan(0);
  });

  it('should provide ErrorHandler with createSentryErrorHandler factory', () => {
    const isProd = true;
    const providers = provideSentryMonitoring(options, isProd);
    const errorHandlerProvider = providers.find(
      (p) => p.provide === ErrorHandler
    ) as FactoryProvider;
    expect(errorHandlerProvider).toBeDefined();
    expect(errorHandlerProvider.useFactory).toBeDefined();
  });

  it('should provide TraceService if tracing is enabled', () => {
    options.enableTracing = true;
    const isProd = true;
    const providers = provideSentryMonitoring(options, isProd);
    const traceServiceProvider = providers.find(
      (p) => p.provide === TraceService
    );
    expect(traceServiceProvider).toBeDefined();
    expect(traceServiceProvider.deps).toContain(Router);
  });

  it('should provide APP_INITIALIZER to instantiate TraceService if tracing is enabled', () => {
    options.enableTracing = true;
    const isProd = true;
    const providers = provideSentryMonitoring(options, isProd);
    const appInitializerProvider = providers.find(
      (p) => p.provide === APP_INITIALIZER
    ) as FactoryProvider;
    expect(appInitializerProvider).toBeDefined();
    expect(appInitializerProvider.useFactory).toBeDefined();
    expect(appInitializerProvider.deps).toContain(TraceService);
    expect(appInitializerProvider.multi).toBe(true);
  });

  it('should not provide TraceService if tracing is not enabled', () => {
    options.enableTracing = false;
    const isProd = true;
    const providers = provideSentryMonitoring(options, isProd);
    const tracingProviders = providers.filter(
      (p) =>
        (p.provide === APP_INITIALIZER && p.deps.includes(TraceService)) ||
        p.provide === TraceService
    );
    expect(tracingProviders.length).toBe(0);
  });
});
