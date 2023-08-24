// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import EmptyCol from './EmptyCol';

/**
 * EmptyRow returns an empty row.
 * @returns An empty row
 */
export default function EmptyRow(): React.JSX.Element {
  return (
    <Row>
      <Col>
        <EmptyCol />
      </Col>
    </Row>
  );
}
