import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {TabbedCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {
  useMetrics,
  useSpanMetrics,
} from 'sentry/views/insights/common/queries/useDiscover';
import {useMobileVitalsDrawer} from 'sentry/views/insights/common/utils/useMobileVitalsDrawer';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';
import {SETUP_CONTENT as TTFD_SETUP} from 'sentry/views/insights/mobile/screenload/data/setupContent';
import {ScreensOverview} from 'sentry/views/insights/mobile/screens/components/screensOverview';
import VitalCard from 'sentry/views/insights/mobile/screens/components/vitalCard';
import {VitalDetailPanel} from 'sentry/views/insights/mobile/screens/components/vitalDetailPanel';
import {Referrer} from 'sentry/views/insights/mobile/screens/referrers';
import {
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
} from 'sentry/views/insights/mobile/screens/settings';
import {
  getColdAppStartPerformance,
  getDefaultMetricPerformance,
  getWarmAppStartPerformance,
  type MetricValue,
  STATUS_UNKNOWN,
  type VitalItem,
  type VitalStatus,
} from 'sentry/views/insights/mobile/screens/utils';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {ModuleName} from 'sentry/views/insights/types';

function ScreensLandingPage() {
  const moduleName = ModuleName.MOBILE_VITALS;
  const navigate = useNavigate();
  const location = useLocation();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();

  const handleProjectChange = useCallback(() => {
    navigate(
      {
        ...location,
        query: {
          ...omit(location.query, ['primaryRelease', 'secondaryRelease']),
        },
      },
      {replace: true}
    );
  }, [location, navigate]);

  const vitalItems = [
    {
      title: t('Avg. Cold App Start'),
      description: t('Average Cold App Start duration'),
      docs: t(
        'The average cold app start duration. A cold start usually occurs when the app launched for the first time, after a reboot or an app update.'
      ),
      setup: undefined,
      platformDocLinks: {
        Android:
          'https://developer.android.com/topic/performance/vitals/launch-time#cold',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#app-start-instrumentation',
        iOS: 'https://docs.sentry.io/platforms/apple/guides/ios/tracing/instrumentation/automatic-instrumentation/#app-start-tracing',
      },
      field: 'avg(measurements.app_start_cold)' as const,
      dataset: DiscoverDatasets.METRICS,
      getStatus: getColdAppStartPerformance,
    },
    {
      title: t('Avg. Warm App Start'),
      description: t('Average Warm App Start duration'),
      docs: t(
        'The average warm app start duration. A warm start usually occurs occurs when the app was already launched previously or the process was created beforehand.'
      ),
      setup: undefined,
      platformDocLinks: {
        Android:
          'https://developer.android.com/topic/performance/vitals/launch-time#warm',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#app-start-instrumentation',
        iOS: 'https://docs.sentry.io/platforms/apple/guides/ios/tracing/instrumentation/automatic-instrumentation/#app-start-tracing',
      },
      field: 'avg(measurements.app_start_warm)' as const,
      dataset: DiscoverDatasets.METRICS,
      getStatus: getWarmAppStartPerformance,
    },
    {
      title: t('Slow Frame Rate'),
      description: t('The percentage of frames that were slow.'),
      docs: t('The percentage of slow frames out of all frames rendered.'),
      setup: undefined,
      platformDocLinks: {
        Android: 'https://developer.android.com/topic/performance/vitals/render',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#slow-and-frozen-frames',
        iOS: 'https://docs.sentry.io/platforms/apple/guides/ios/tracing/instrumentation/automatic-instrumentation/#slow-and-frozen-frames',
      },
      field: `division(mobile.slow_frames,mobile.total_frames)` as const,
      dataset: DiscoverDatasets.SPANS_METRICS,
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('Frozen Frame Rate'),
      description: t('The percentage of frames that were frozen.'),
      docs: t('The percentage of frozen frames out of all frames rendered.'),
      setup: undefined,
      platformDocLinks: {
        Android: 'https://developer.android.com/topic/performance/vitals/render',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#slow-and-frozen-frames',
        iOS: 'https://docs.sentry.io/platforms/apple/guides/ios/tracing/instrumentation/automatic-instrumentation/#slow-and-frozen-frames',
      },
      field: `division(mobile.frozen_frames,mobile.total_frames)` as const,
      dataset: DiscoverDatasets.SPANS_METRICS,
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('Avg. Frame Delay'),
      description: t('Average frame delay'),
      docs: t(
        'The average total time of delay caused by frames which were not rendered on time.'
      ),
      setup: undefined,
      platformDocLinks: {
        Android: 'https://developer.android.com/topic/performance/vitals/render',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#slow-and-frozen-frames',
        iOS: 'https://docs.sentry.io/platforms/apple/guides/ios/tracing/instrumentation/automatic-instrumentation/#slow-and-frozen-frames',
      },
      field: `avg(mobile.frames_delay)` as const,
      dataset: DiscoverDatasets.SPANS_METRICS,
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('Avg. TTID'),
      description: t('Average time to initial display.'),
      docs: t('The average time it takes until your app is drawing the first frame.'),
      setup: undefined,
      platformDocLinks: {
        Android:
          'https://developer.android.com/topic/performance/vitals/launch-time#time-initial',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#time-to-initial-display',
        iOS: 'https://docs.sentry.io/platforms/apple/features/experimental-features/',
      },
      field: `avg(measurements.time_to_initial_display)` as const,
      dataset: DiscoverDatasets.METRICS,
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('Avg. TTFD'),
      description: t('Average time to full display.'),
      docs: t('The average time it takes until your app is drawing the full content.'),
      setup: <TabbedCodeSnippet tabs={TTFD_SETUP} />,
      platformDocLinks: {
        Android:
          'https://developer.android.com/topic/performance/vitals/launch-time#time-full',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#time-to-full-display',
        iOS: 'https://docs.sentry.io/platforms/apple/features/experimental-features/',
      },
      field: `avg(measurements.time_to_full_display)` as const,
      dataset: DiscoverDatasets.METRICS,
      getStatus: getDefaultMetricPerformance,
    },
  ] satisfies VitalItem[];

  const metricsFields = vitalItems
    .filter(item => item.dataset === DiscoverDatasets.METRICS)
    .map(item => item.field);

  const spanMetricsFields = vitalItems
    .filter(item => item.dataset === DiscoverDatasets.SPANS_METRICS)
    .map(item => item.field);

  const [state, setState] = useState<{
    status: VitalStatus | undefined;
    vital: VitalItem | undefined;
  }>({status: undefined, vital: undefined});

  const query = new MutableSearch(['transaction.op:[ui.load,navigation]']);
  if (isProjectCrossPlatform) {
    query.addFilterValue('os.name', selectedPlatform);
  }

  const metricsResult = useMetrics(
    {
      search: query,
      limit: 25,
      fields: metricsFields,
    },
    Referrer.SCREENS_METRICS
  );

  const spanMetricsResult = useSpanMetrics(
    {
      search: query,
      limit: 25,
      fields: spanMetricsFields,
    },
    Referrer.SCREENS_METRICS
  );

  const metricsData = {...metricsResult.data[0], ...spanMetricsResult.data[0]};
  const metaUnits = {...metricsResult.meta?.units, ...spanMetricsResult.meta?.units};
  const metaFields = {...metricsResult.meta?.fields, ...spanMetricsResult.meta?.fields};

  const {openVitalsDrawer} = useMobileVitalsDrawer({
    Component: <VitalDetailPanel vital={state.vital} status={state.status} />,
    vital: state.vital,
    onClose: () => {
      setState({vital: undefined, status: undefined});
    },
  });

  useEffect(() => {
    if (state.vital) {
      openVitalsDrawer();
    }
  });

  return (
    <ModulePageProviders moduleName={ModuleName.MOBILE_VITALS}>
      <Layout.Page>
        <PageAlertProvider>
          <MobileHeader
            headerTitle={
              <Fragment>
                {MODULE_TITLE}
                <PageHeadingQuestionTooltip
                  docsUrl={MODULE_DOC_LINK}
                  title={MODULE_DESCRIPTION}
                />
              </Fragment>
            }
            headerActions={isProjectCrossPlatform && <PlatformSelector />}
            module={moduleName}
          />
          <ModuleBodyUpsellHook moduleName={moduleName}>
            <Layout.Body>
              <Layout.Main fullWidth>
                <Container>
                  <PageFilterBar condensed>
                    <InsightsProjectSelector onChange={handleProjectChange} />
                    <EnvironmentPageFilter />
                    <DatePageFilter />
                  </PageFilterBar>
                </Container>
                <PageAlert />
                <ModulesOnboarding moduleName={moduleName}>
                  <ErrorBoundary mini>
                    <Container>
                      <Flex data-test-id="mobile-vitals-top-metrics">
                        {vitalItems.map(item => {
                          const metricValue: MetricValue = {
                            type: metaFields?.[item.field],
                            value: metricsData?.[item.field],
                            unit: metaUnits?.[item.field],
                          };

                          const status =
                            (metricValue && item.getStatus(metricValue, item.field)) ??
                            STATUS_UNKNOWN;

                          return (
                            <VitalCard
                              onClick={() => {
                                setState({
                                  vital: item,
                                  status,
                                });
                              }}
                              key={item.field}
                              title={item.title}
                              description={item.description}
                              statusLabel={status.description}
                              status={status.score}
                              formattedValue={status.formattedValue}
                            />
                          );
                        })}
                      </Flex>
                      <ScreensOverview />
                    </Container>
                  </ErrorBoundary>
                </ModulesOnboarding>
              </Layout.Main>
            </Layout.Body>
          </ModuleBodyUpsellHook>
        </PageAlertProvider>
      </Layout.Page>
    </ModulePageProviders>
  );
}

const Container = styled('div')`
  margin-bottom: ${space(1)};
`;

const Flex = styled('div')<{gap?: number}>`
  display: flex;
  flex-direction: row;
  justify-content: center;
  width: 100%;
  gap: ${p => (p.gap ? `${p.gap}px` : space(1))};
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: ${space(1)};
`;

export default ScreensLandingPage;
