import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import type {Project} from 'sentry/types/project';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import AwsLambdaProjectSelect from 'sentry/views/integrationPipeline/awsLambdaProjectSelect';

describe('AwsLambdaProjectSelect', () => {
  let projects: Project[];

  beforeEach(() => {
    projects = [
      ProjectFixture(),
      ProjectFixture({id: '53', name: 'My Proj', slug: 'my-proj'}),
    ];
  });

  it('submit project', async () => {
    render(<AwsLambdaProjectSelect projects={projects} />);

    await selectEvent.select(screen.getByRole('textbox'), 'my-proj');
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      `${window.location.origin}/extensions/aws_lambda/setup/?projectId=53`
    );
  });
});
