// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Amplify } from 'aws-amplify';
import { withAuthenticator } from '@aws-amplify/ui-react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import PageNotFound from './components/PageNotFound';
import { AmplifyConfigurationInput } from './util/types';
import { getAmplifyConfiguration } from './util/utils';
import Dashboard from './views/connection/Dashboard';
import ConnectionForm from './views/connection/ConnectionForm';
import GreengrassCoreDevicesDashboard from './views/greengrass/GreengrassCoreDevicesDashboard';
import GreengrassCoreDeviceForm from './views/greengrass/GreengrassCoreDeviceForm';

// Amplify configuration
type UiWindow = Window & typeof globalThis & { config: AmplifyConfigurationInput };
const config: AmplifyConfigurationInput = (window as UiWindow).config;
Amplify.Logger.LOG_LEVEL = config.loggingLevel;
Amplify.configure(getAmplifyConfiguration(config));

/**
 * The default application
 * @returns Amplify Authenticator with Main and Footer
 */
function App(): JSX.Element {
  return (
    <div>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<Dashboard region={config.region} />} />
          <Route path="/connection" element={<ConnectionForm />} />
          <Route path="/connection/:connectionName" element={<ConnectionForm />} />
          <Route path="/greengrass" element={<GreengrassCoreDevicesDashboard />} />
          <Route path="/greengrass/register" element={<GreengrassCoreDeviceForm />} />
          <Route element={<PageNotFound />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default withAuthenticator(App);
