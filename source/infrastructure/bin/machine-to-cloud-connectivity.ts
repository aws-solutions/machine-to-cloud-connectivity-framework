// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App } from '@aws-cdk/core';
import { M2C2Stack } from '../lib/machine-to-cloud-connectivity-stack';

const app = new App();
new M2C2Stack(app, 'M2C2Stack', {
  description: '(SO0070) - The AWS cloud formation template for the deployment of SOLUTION_NAME_PLACEHOLDER. Version VERSION_PLACEHOLDER.'
});