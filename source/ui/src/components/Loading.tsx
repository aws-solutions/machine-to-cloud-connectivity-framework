// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import ProgressBar from 'react-bootstrap/ProgressBar';
import Spinner from 'react-bootstrap/Spinner';
import EmptyCol from './EmptyCol';

type LoadingProp = {
  loading: boolean;
};

/**
 * Renders loading bar.
 * @param props The loading property
 * @returns Loading bar
 */
export function LoadingProgressBar(props: LoadingProp): JSX.Element {
  if (props.loading) return <ProgressBar animated now={100} />;
  else return <></>;
}

/**
 * Renders loading spinner.
 * @param props The loading property
 * @returns Loading spinner
 */
export function LoadingSpinner(props: LoadingProp): JSX.Element {
  if (props.loading) {
    return (
      <>
        <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
        <EmptyCol />
      </>
    );
  } else return <></>;
}
