// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './assets/css/style.scss';

// For the internationalization
import { I18n } from '@aws-amplify/core';
import en from './util/lang/en.json'; // English

const dict = { en };
I18n.putVocabularies(dict);
I18n.setLanguage('en');

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);