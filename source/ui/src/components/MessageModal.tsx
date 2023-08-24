// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { I18n } from '@aws-amplify/core';
import { useEffect } from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import { MessageModalProps, MessageModalType } from '../util/types';

/**
 * Renders the message modal.
 * @param props The message modal properties
 * @returns The message modal
 */
export default function MessageModal(props: MessageModalProps): JSX.Element {
  const { show, hide, message, modalType, confirmAction } = props;

  /**
   * React useEffect hook.
   */
  useEffect(() => {
    if (modalType === MessageModalType.CONFIRM && typeof confirmAction === 'undefined') {
      throw Error(I18n.get('error.message.missing.action'));
    }
  }, [modalType, confirmAction]);

  /**
   * For the confirm type, it already checks if confirmAction exists,
   * so there's no need to check again to throw an error.
   */
  async function handleConfirm() {
    if (typeof confirmAction !== 'undefined') {
      if (confirmAction.constructor.name === 'AsyncFunction') await confirmAction();
      else confirmAction();
    }
    hide();
  }

  return (
    <Modal show={show} onHide={() => hide()} id="message-modal" animation={false} centered={true}>
      <Modal.Body>{message}</Modal.Body>
      <Modal.Footer>
        {modalType === MessageModalType.MESSAGE && (
          <Button id="message-modal-close-button" onClick={() => handleConfirm()} className="uppercase-text" size="sm">
            {I18n.get('ok')}
          </Button>
        )}
        {modalType === MessageModalType.CONFIRM && (
          <>
            <Button
              id="message-modal-confirm-button"
              onClick={() => handleConfirm()}
              className="uppercase-text"
              size="sm"
              variant="primary">
              {I18n.get('confirm')}
            </Button>
            <Button
              id="message-modal-cancel-button"
              onClick={() => hide()}
              className="uppercase-text"
              size="sm"
              variant="secondary">
              {I18n.get('cancel')}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}
