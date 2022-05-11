// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render } from '@testing-library/react';
import PageNotFound from '../PageNotFound';

test('renders the PageNotFound component', async () => {
  const pageNotFound = render(<PageNotFound />);
  expect(pageNotFound.container).toMatchSnapshot();
});
