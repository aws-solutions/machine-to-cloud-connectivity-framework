// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render } from '@testing-library/react';
import EmptyCol from '../EmptyCol';

test('renders the EmptyCol component', async () => {
  const emptyCol = render(<EmptyCol />);
  expect(emptyCol.container).toMatchSnapshot();
});
