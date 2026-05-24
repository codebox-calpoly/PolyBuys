import { getUserFlowErrorMessage } from '../user-flow-errors';

describe('getUserFlowErrorMessage', () => {
  it('handles string rejections', () => {
    expect(getUserFlowErrorMessage('listing not found', 'save-listing')).toBe(
      'This listing is no longer available.'
    );
  });

  it('handles error-like objects with a message property', () => {
    expect(getUserFlowErrorMessage({ message: 'conversation not found' }, 'send-message')).toBe(
      'This conversation is no longer available.'
    );
  });

  it('maps support report rate-limit errors to retryable support copy', () => {
    expect(
      getUserFlowErrorMessage(
        new Error('Support report limit reached. Please try again later.'),
        'submit-support-report'
      )
    ).toBe('You have reached the support report limit for now. Try again later.');
  });
});
