// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0


import { I18n } from '@aws-amplify/core';
import Button from 'react-bootstrap/Button';
import Navbar from 'react-bootstrap/Navbar';
import { signOut } from '../util/Utils';

/**
 * Renders the header of the UI.
 * @returns The header
 */
export default function Header(): JSX.Element {
  return (
    <header key="header">
      <Navbar bg="light" expand="sm">
        <Navbar.Brand href="/">{I18n.get('application')}</Navbar.Brand>
        <Navbar.Toggle />
        <Navbar.Collapse className="justify-content-end">
          <Button variant="link" onClick={signOut}>{I18n.get('sign.out')}</Button>
        </Navbar.Collapse>
      </Navbar>
    </header>
  );
}