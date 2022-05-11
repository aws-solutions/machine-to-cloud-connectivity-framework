// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AmplifyConfigurationInput } from '../types';
import { getAmplifyConfiguration } from '../utils';

test('Test getAmplifyConfiguration() function', async () => {
  const config: AmplifyConfigurationInput = {
    apiEndpoint: 'https://mock-url',
    identityPoolId: 'mock-identity-pool-id',
    loggingLevel: 'ERROR',
    region: 'mock-aws-region',
    s3Bucket: 'mock-s3-bucket',
    userPoolId: 'mock-user-pool-id',
    webClientId: 'mock-web-client-id'
  };

  expect(getAmplifyConfiguration(config)).toEqual({
    API: {
      endpoints: [{ name: 'M2C2Api', endpoint: config.apiEndpoint, region: config.region }]
    },
    Auth: {
      region: config.region,
      userPoolId: config.userPoolId,
      userPoolWebClientId: config.webClientId,
      identityPoolId: config.identityPoolId
    },
    Storage: {
      AWSS3: {
        bucket: config.s3Bucket,
        region: config.region
      }
    }
  });
});
