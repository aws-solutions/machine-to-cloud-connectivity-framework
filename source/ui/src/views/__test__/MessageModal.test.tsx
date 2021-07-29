// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import '@testing-library/jest-dom/extend-expect';
import { queryByAttribute, render, screen, waitFor } from '@testing-library/react';
import MessageModal from '../MessageModal';
import { MessageModalProps, MessageModalType } from '../../util/Types';
import { I18n } from '@aws-amplify/core';

const getById = queryByAttribute.bind(null, 'id');

test('renders the message type MessageModal component', async () => {
  const props: MessageModalProps = {
    show: true,
    hide: () => console.log('hide'),
    message: 'Test message',
    modalType: MessageModalType.MESSAGE
  };
  const messageModal = render(<MessageModal {...props} />);

  await waitFor(() => {
    getById(messageModal.container, 'message-modal');
  });
  expect(screen.getByText(props.message as string)).toBeInTheDocument();
  expect(messageModal.baseElement).toMatchSnapshot();
});

test('renders the message type MessageModal component with confirm action', async () => {
  const props: MessageModalProps = {
    show: true,
    hide: () => console.log('hide'),
    message: 'Test message',
    modalType: MessageModalType.MESSAGE,
    confirmAction: () => console.log('confirm action')
  };
  const messageModal = render(<MessageModal {...props} />);

  await waitFor(() => {
    getById(messageModal.container, 'message-modal');
  });
  expect(screen.getByText(props.message as string)).toBeInTheDocument();
  expect(messageModal.baseElement).toMatchSnapshot();
});

test('renders the confirm type MessageModal component', async () => {
  const props: MessageModalProps = {
    show: true,
    hide: () => console.log('hide'),
    message: 'Test message',
    modalType: MessageModalType.CONFIRM,
    confirmAction: () => console.log('confirm action')
  };
  const messageModal = render(<MessageModal {...props} />);

  await waitFor(() => {
    getById(messageModal.container, 'message-modal');
  });
  expect(screen.getByText(props.message as string)).toBeInTheDocument();
  expect(messageModal.baseElement).toMatchSnapshot();
});

test('throws an error when confirm action is missing for the confirm type MessageModal component', async () => {
  const props: MessageModalProps = {
    show: true,
    hide: () => console.log('hide'),
    message: 'Test message',
    modalType: MessageModalType.CONFIRM
  };

  expect(() => render(<MessageModal {...props} />)).toThrowError(Error(I18n.get('error.message.missing.action')));
});