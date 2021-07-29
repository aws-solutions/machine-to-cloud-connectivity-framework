// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Amplify from '@aws-amplify/core';
import { withAuthenticator } from '@aws-amplify/ui-react';
import { BrowserRouter, Route, Switch } from 'react-router-dom';

import Header from './components/Header';
import { AmplifyConfigurationInput } from './util/Types';
import { getAmplifyConfiguration } from './util/Utils';
import Dashboard from './views/Dashboard';
import ConnectionForm from './views/ConnectionForm';
import PageNotFound from './components/PageNotFound';

// Amplify configuration
declare var config: AmplifyConfigurationInput;
Amplify.Logger.LOG_LEVEL = config.loggingLevel;
Amplify.configure(getAmplifyConfiguration(config));

/**
 * The default application
 * @returns Amplify Authenticator with Main and Footer
 */
function App(): JSX.Element {
  return (
    <div>
      <Header />
      <BrowserRouter>
        <Switch>
          <Route exact path="/" render={() => <Dashboard region={config.region} />} />
          <Route exact path="/connection" render={() => <ConnectionForm />} />
          <Route exact path="/connection/:connectionName" render={() => <ConnectionForm />} />
          <Route render={() => <PageNotFound />} />
        </Switch>
      </BrowserRouter>
    </div>
  );
}

export default withAuthenticator(App);