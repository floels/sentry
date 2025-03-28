import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {usePrefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {LogsTabContent} from 'sentry/views/explore/logs/logsTab';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';

export default function LogsPage() {
  const organization = useOrganization();
  const {defaultPeriod, maxPickableDays, relativeOptions} =
    limitMaxPickableDays(organization);

  const prefersStackedNav = usePrefersStackedNav();

  return (
    <SentryDocumentTitle title={t('Logs')} orgSlug={organization?.slug}>
      <PageFiltersContainer maxPickableDays={maxPickableDays}>
        <Layout.Page>
          <Layout.Header unified={prefersStackedNav}>
            <Layout.HeaderContent unified={prefersStackedNav}>
              <Layout.Title>
                {t('Logs')}
                <FeatureBadge type="experimental" />
              </Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>
          <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
            <LogsPageParamsProvider>
              <LogsTabContent
                defaultPeriod={defaultPeriod}
                maxPickableDays={maxPickableDays}
                relativeOptions={relativeOptions}
              />
            </LogsPageParamsProvider>
          </TraceItemAttributeProvider>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}
