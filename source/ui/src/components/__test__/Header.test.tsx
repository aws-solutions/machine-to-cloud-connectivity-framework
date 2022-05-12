// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../Header';

I18n.setLanguage('en');

test('renders the Header component', async () => {
  const header = render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>
  );
  expect(header.container).toMatchSnapshot();
});
