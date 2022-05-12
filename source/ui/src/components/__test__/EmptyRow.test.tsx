// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { render } from '@testing-library/react';
import EmptyRow from '../EmptyRow';

test('renders the EmptyRow component', async () => {
  const emptyRow = render(<EmptyRow />);
  expect(emptyRow.container).toMatchSnapshot();
});
