// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render } from '@testing-library/react';
import { LoadingProgressBar, LoadingSpinner } from '../Loading';

test('renders the loading bar component', async () => {
  expect(render(<LoadingProgressBar loading={true} />).container).toMatchSnapshot();
});

test('renders no loading bar component', async () => {
  expect(render(<LoadingProgressBar loading={false} />).container).toMatchSnapshot();
});

test('renders the loading spinner component', async () => {
  expect(render(<LoadingSpinner loading={true} />).container).toMatchSnapshot();
});

test('renders no loading spinner component', async () => {
  expect(render(<LoadingSpinner loading={false} />).container).toMatchSnapshot();
});
