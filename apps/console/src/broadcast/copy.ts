interface BroadcastMessages {
  readonly pageTitle: string;
  readonly pageDescription: string;
  readonly textPanelTitle: string;
  readonly textPlaceholder: string;
  readonly textInputAriaLabel: string;
  readonly sendTextLabel: string;
  readonly sendingLabel: string;
  readonly textMissingError: string;
  readonly sendFallbackError: string;
  readonly audioPanelTitle: string;
  readonly recordLabel: string;
  readonly stopLabel: string;
  readonly recordingLabel: (elapsedSeconds: number) => string;
  readonly maxDurationHint: string;
  readonly previewAriaLabel: string;
  readonly discardLabel: string;
  readonly sendRecordingLabel: string;
  readonly uploadProgressLabel: (
    sentChunkCount: number,
    totalChunkCount: number,
  ) => string;
  readonly deliveredFeedback: string;
  readonly queuedFeedback: string;
  readonly deviceOfflineHint: string;
  readonly micDeniedError: string;
  readonly micUnsupportedError: string;
}

export const BROADCAST_MESSAGES: BroadcastMessages = {
  pageTitle: 'Broadcast',
  pageDescription: 'Leave a message playing on the desk, wherever you are',
  textPanelTitle: 'Written message',
  textPlaceholder: 'Back at eight…',
  textInputAriaLabel: 'Message to broadcast',
  sendTextLabel: 'Send',
  sendingLabel: 'Sending…',
  textMissingError: 'Write the message.',
  sendFallbackError: 'Sending failed — try again.',
  audioPanelTitle: 'Voice message',
  recordLabel: 'Record',
  stopLabel: 'Stop',
  recordingLabel: (elapsedSeconds) => `Recording… ${elapsedSeconds}s`,
  maxDurationHint: 'Up to 30 seconds',
  previewAriaLabel: 'Listen to the recording before sending it',
  discardLabel: 'Discard',
  sendRecordingLabel: 'Send recording',
  uploadProgressLabel: (sentChunkCount, totalChunkCount) =>
    `Uploading ${sentChunkCount}/${totalChunkCount}…`,
  deliveredFeedback: 'Playing on the desk',
  queuedFeedback: 'The desk is offline — it will play on reconnect',
  deviceOfflineHint:
    'The device is offline: whatever you send is stored and plays when it comes back.',
  micDeniedError: 'The browser blocked the microphone. Allow access and try again.',
  micUnsupportedError: 'This browser does not support audio recording.',
};
