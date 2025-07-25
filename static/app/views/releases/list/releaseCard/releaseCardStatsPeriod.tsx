import styled from '@emotion/styled';
import type {Location} from 'history';

import {Link} from 'sentry/components/core/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import {HealthStatsPeriodOption} from 'sentry/types/release';
import withPageFilters from 'sentry/utils/withPageFilters';

type Props = {
  location: Location;
  selection: PageFilters;
};

function ReleaseCardStatsPeriod({location, selection}: Props) {
  const activePeriod =
    location.query.healthStatsPeriod || HealthStatsPeriodOption.TWENTY_FOUR_HOURS;
  const {pathname, query} = location;

  return (
    <Wrapper>
      {selection.datetime.period !== HealthStatsPeriodOption.TWENTY_FOUR_HOURS && (
        <Period
          to={{
            pathname,
            query: {
              ...query,
              healthStatsPeriod: HealthStatsPeriodOption.TWENTY_FOUR_HOURS,
            },
          }}
          selected={activePeriod === HealthStatsPeriodOption.TWENTY_FOUR_HOURS}
        >
          {t('24h')}
        </Period>
      )}

      <Period
        to={{
          pathname,
          query: {...query, healthStatsPeriod: HealthStatsPeriodOption.AUTO},
        }}
        selected={activePeriod === HealthStatsPeriodOption.AUTO}
      >
        {selection.datetime.start ? t('Custom') : (selection.datetime.period ?? t('14d'))}
      </Period>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${space(0.75)};
  flex: 1;
  justify-content: flex-end;
  text-align: right;
  margin-left: ${space(0.5)};
`;

const Period = styled(Link)<{selected: boolean}>`
  color: ${p => (p.selected ? p.theme.textColor : p.theme.subText)};

  &:hover,
  &:focus {
    color: ${p => (p.selected ? p.theme.textColor : p.theme.subText)};
  }
`;

export default withPageFilters(ReleaseCardStatsPeriod);
