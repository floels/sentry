import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import type {Polarity} from 'sentry/components/percentChange';
import {defined} from 'sentry/utils';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {AutoSizedText} from 'sentry/views/dashboards/widgetCard/autoSizedText';
import {DifferenceToPreviousPeriodValue} from 'sentry/views/dashboards/widgets/bigNumberWidget/differenceToPreviousPeriodValue';
import {NON_FINITE_NUMBER_MESSAGE} from 'sentry/views/dashboards/widgets/common/settings';
import type {
  TabularRow,
  TabularValueType,
  TabularValueUnit,
  Thresholds,
} from 'sentry/views/dashboards/widgets/common/types';

import {DEEMPHASIS_COLOR_NAME, LOADING_PLACEHOLDER} from './settings';
import {ThresholdsIndicator} from './thresholdsIndicator';

interface BigNumberWidgetVisualizationProps {
  field: string;
  value: number | string;
  maximumValue?: number;
  preferredPolarity?: Polarity;
  previousPeriodValue?: number | string;
  thresholds?: Thresholds;
  type?: TabularValueType;
  unit?: TabularValueUnit;
}

export function BigNumberWidgetVisualization(props: BigNumberWidgetVisualizationProps) {
  const {
    field,
    value,
    previousPeriodValue,
    maximumValue = Number.MAX_VALUE,
    preferredPolarity,
    type,
    unit,
  } = props;

  const theme = useTheme();

  if ((typeof value === 'number' && !Number.isFinite(value)) || Number.isNaN(value)) {
    throw new Error(NON_FINITE_NUMBER_MESSAGE);
  }

  const location = useLocation();
  const organization = useOrganization();

  // Create old-school renderer meta, so we can pass it to field renderers
  const rendererMeta: MetaType = {
    fields: {
      [field]: type ?? undefined,
    },
  };

  if (unit) {
    rendererMeta.units = {
      [field]: unit,
    };
  }

  const fieldRenderer = getFieldRenderer(field, rendererMeta, false);

  const baggage = {
    location,
    organization,
    unit: unit ?? undefined, // TODO: Field formatters think units can't be null but they can
  };

  // String values don't support differences, thresholds, max values, or anything else.
  if (typeof value === 'string') {
    return (
      <Wrapper>
        <NumberAndDifferenceContainer>
          {fieldRenderer(
            {
              [field]: value,
            },
            {...baggage, theme}
          )}
        </NumberAndDifferenceContainer>
      </Wrapper>
    );
  }

  const doesValueHitMaximum = maximumValue ? value >= maximumValue : false;
  const clampedValue = Math.min(value, maximumValue);

  return (
    <Wrapper>
      <NumberAndDifferenceContainer>
        {defined(props.thresholds?.max_values.max1) &&
          defined(props.thresholds?.max_values.max2) && (
            <ThresholdsIndicator
              preferredPolarity={props.preferredPolarity}
              thresholds={{
                unit: props.thresholds.unit ?? undefined,
                max_values: {
                  max1: props.thresholds.max_values.max1,
                  max2: props.thresholds.max_values.max2,
                },
              }}
              unit={unit ?? ''}
              value={clampedValue}
              type={type ?? 'integer'}
            />
          )}

        <NumberContainerOverride>
          <Tooltip
            title={value}
            isHoverable
            delay={0}
            disabled={doesValueHitMaximum}
            containerDisplayMode="inline-flex"
          >
            {doesValueHitMaximum ? '>' : ''}
            {fieldRenderer(
              {
                [field]: clampedValue,
              },
              {...baggage, theme}
            )}
          </Tooltip>
        </NumberContainerOverride>

        {defined(previousPeriodValue) &&
          typeof previousPeriodValue === 'number' &&
          Number.isFinite(previousPeriodValue) &&
          !Number.isNaN(previousPeriodValue) &&
          !doesValueHitMaximum && (
            <DifferenceToPreviousPeriodValue
              value={value}
              previousPeriodValue={previousPeriodValue}
              field={field}
              preferredPolarity={preferredPolarity}
              renderer={(previousDatum: TabularRow) =>
                fieldRenderer(previousDatum, {...baggage, theme})
              }
            />
          )}
      </NumberAndDifferenceContainer>
    </Wrapper>
  );
}

function Wrapper({children}: any) {
  return (
    <GrowingWrapper>
      <AutoResizeParent>
        <AutoSizedText>{children}</AutoSizedText>
      </AutoResizeParent>
    </GrowingWrapper>
  );
}

// Takes up 100% of the parent. If within flex context, grows to fill.
// Otherwise, takes up 100% horizontally and vertically
const GrowingWrapper = styled('div')`
  position: relative;
  flex-grow: 1;
  height: 100%;
  width: 100%;
`;

const AutoResizeParent = styled('div')`
  position: absolute;
  inset: 0;

  color: ${p => p.theme.headingColor};

  container-type: size;
  container-name: auto-resize-parent;

  * {
    line-height: 1;
    text-align: left !important;
  }
`;

const NumberAndDifferenceContainer = styled('div')`
  display: flex;
  align-items: flex-end;
  gap: min(8px, 3cqw);
`;

const NumberContainerOverride = styled('div')`
  display: inline-flex;

  * {
    text-overflow: clip !important;
    display: inline;
    white-space: nowrap;
  }
`;

const LoadingPlaceholder = styled('span')`
  color: ${p => p.theme[DEEMPHASIS_COLOR_NAME]};
  font-size: ${p => p.theme.fontSize.lg};
`;

BigNumberWidgetVisualization.LoadingPlaceholder = function () {
  return <LoadingPlaceholder>{LOADING_PLACEHOLDER}</LoadingPlaceholder>;
};
