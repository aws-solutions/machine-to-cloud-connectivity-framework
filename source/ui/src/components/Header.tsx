// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import Button from 'react-bootstrap/Button';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import { Link } from 'react-router-dom';
import { signOut } from '../util/utils';

/**
 * Renders the header of the UI.
 * @returns The header
 */
export default function Header(): React.JSX.Element {
  return (
    <header key="header">
      <Navbar bg="light" expand="sm">
        <Navbar.Brand href="/">{I18n.get('application')}</Navbar.Brand>
        <Navbar.Toggle />
        <Navbar.Collapse className="justify-content-between">
          <Nav>
            <Nav.Link as={Link} to="/">
              {I18n.get('connections')}
            </Nav.Link>
            <Nav.Link as={Link} to="/greengrass">
              {I18n.get('greengrass.core.devices')}
            </Nav.Link>
          </Nav>
          <Button variant="link" onClick={signOut}>
            {I18n.get('sign.out')}
          </Button>
        </Navbar.Collapse>
      </Navbar>
    </header>
  );
}
