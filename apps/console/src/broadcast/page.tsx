import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { Chip } from '@/blueprint/chip';
import { Heading } from '@/blueprint/heading';
import { Panel } from '@/blueprint/panel';
import { BROADCAST_MESSAGE_CATALOG } from '@/broadcast/copy';
import {
  BROADCAST_MAX_RECORDING_SECONDS,
  computeRecordingDurationSeconds,
  convertFloat32ToInt16Pcm,
  isRecordingSupported,
  resampleToTargetRate,
  startBroadcastRecording,
  wrapPcmInWavHeader,
} from '@/broadcast/recorder';
import { uploadBroadcastAudio } from '@/broadcast/upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMessages } from '@/locale/context';
import type { ConsoleRpc } from '@/agent/rpc';
import type { BroadcastResult } from '@/agent/schema';
import type { BroadcastRecorderHandle } from '@/broadcast/recorder';

type RecorderPhase = 'idle' | 'recording' | 'recorded' | 'uploading';

export function BroadcastPage({ consoleRpc }: { readonly consoleRpc: ConsoleRpc }) {
  const broadcastMessages = useMessages(BROADCAST_MESSAGE_CATALOG);
  const [isDeviceConnected, setIsDeviceConnected] = useState<boolean | null>(null);
  const [feedbackOutcome, setFeedbackOutcome] = useState<
    BroadcastResult['outcome'] | null
  >(null);

  const [textMessage, setTextMessage] = useState('');
  const [isSendingText, setIsSendingText] = useState(false);
  const [textErrorMessage, setTextErrorMessage] = useState<string | null>(null);

  const [recorderPhase, setRecorderPhase] = useState<RecorderPhase>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<readonly [number, number] | null>(
    null,
  );
  const [audioErrorMessage, setAudioErrorMessage] = useState<string | null>(null);
  const recorderHandleRef = useRef<BroadcastRecorderHandle | null>(null);
  const recordedPcmRef = useRef<Uint8Array | null>(null);
  const stopRecordingRef = useRef<() => void>(() => {});

  useEffect(() => {
    let isMounted = true;
    const probeDeviceConnectivity = async () => {
      try {
        const status = await consoleRpc.getStatus();
        if (isMounted) {
          setIsDeviceConnected(status.isDeviceConnected);
        }
      } catch {
        // The offline hint is best-effort; a failed probe just hides it.
      }
    };
    void probeDeviceConnectivity();
    return () => {
      isMounted = false;
    };
  }, [consoleRpc]);

  useEffect(() => {
    if (recorderPhase !== 'recording') {
      return;
    }
    const intervalId = window.setInterval(() => {
      setElapsedSeconds((previousSeconds) => previousSeconds + 1);
    }, 1_000);
    return () => window.clearInterval(intervalId);
  }, [recorderPhase]);

  useEffect(() => {
    if (
      recorderPhase === 'recording' &&
      elapsedSeconds >= BROADCAST_MAX_RECORDING_SECONDS
    ) {
      stopRecordingRef.current();
    }
  }, [elapsedSeconds, recorderPhase]);

  useEffect(
    () => () => {
      if (previewUrl !== null) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  async function handleSendText(event: FormEvent) {
    event.preventDefault();
    const trimmedMessage = textMessage.trim();
    if (trimmedMessage.length === 0) {
      setTextErrorMessage(broadcastMessages.textMissingError);
      return;
    }
    setIsSendingText(true);
    setTextErrorMessage(null);
    setFeedbackOutcome(null);
    try {
      const { outcome } = await consoleRpc.sendBroadcastText(trimmedMessage);
      setFeedbackOutcome(outcome);
      setTextMessage('');
    } catch (error) {
      setTextErrorMessage(
        error instanceof Error ? error.message : broadcastMessages.sendFallbackError,
      );
    } finally {
      setIsSendingText(false);
    }
  }

  async function handleStartRecording() {
    if (!isRecordingSupported()) {
      setAudioErrorMessage(broadcastMessages.micUnsupportedError);
      return;
    }
    setAudioErrorMessage(null);
    setFeedbackOutcome(null);
    try {
      recorderHandleRef.current = await startBroadcastRecording();
      setElapsedSeconds(0);
      setRecorderPhase('recording');
    } catch (error) {
      setAudioErrorMessage(
        error instanceof Error && error.name === 'NotAllowedError'
          ? broadcastMessages.micDeniedError
          : broadcastMessages.sendFallbackError,
      );
    }
  }

  async function handleStopRecording() {
    const recorderHandle = recorderHandleRef.current;
    if (recorderHandle === null) {
      return;
    }
    recorderHandleRef.current = null;
    const { sampleList, sourceSampleRateHz } = await recorderHandle.stop();
    const resampledSampleList = await resampleToTargetRate(
      sampleList,
      sourceSampleRateHz,
    );
    if (resampledSampleList.length === 0) {
      setRecorderPhase('idle');
      return;
    }
    const pcmSampleList = convertFloat32ToInt16Pcm(resampledSampleList);
    const pcmBytes = new Uint8Array(
      pcmSampleList.buffer,
      pcmSampleList.byteOffset,
      pcmSampleList.byteLength,
    );
    recordedPcmRef.current = pcmBytes;
    setPreviewUrl(URL.createObjectURL(wrapPcmInWavHeader(pcmBytes)));
    setRecorderPhase('recorded');
  }

  stopRecordingRef.current = () => void handleStopRecording();

  function handleDiscardRecording() {
    recordedPcmRef.current = null;
    if (previewUrl !== null) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setElapsedSeconds(0);
    setRecorderPhase('idle');
  }

  async function handleSendRecording() {
    const pcmBytes = recordedPcmRef.current;
    if (pcmBytes === null) {
      return;
    }
    setRecorderPhase('uploading');
    setAudioErrorMessage(null);
    setFeedbackOutcome(null);
    try {
      const outcome = await uploadBroadcastAudio(consoleRpc, pcmBytes, (sent, total) =>
        setUploadProgress([sent, total]),
      );
      setFeedbackOutcome(outcome);
      handleDiscardRecording();
    } catch (error) {
      setAudioErrorMessage(
        error instanceof Error ? error.message : broadcastMessages.sendFallbackError,
      );
      setRecorderPhase('recorded');
    } finally {
      setUploadProgress(null);
    }
  }

  const recordedDurationSeconds =
    recordedPcmRef.current === null
      ? 0
      : Math.round(computeRecordingDurationSeconds(recordedPcmRef.current.byteLength));

  return (
    <div className="settle space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading description={broadcastMessages.pageDescription}>
          {broadcastMessages.pageTitle}
        </Heading>
        {feedbackOutcome !== null && (
          <Chip tone={feedbackOutcome === 'delivered' ? 'live' : 'idle'}>
            {feedbackOutcome === 'delivered'
              ? broadcastMessages.deliveredFeedback
              : broadcastMessages.queuedFeedback}
          </Chip>
        )}
      </div>

      {isDeviceConnected === false && (
        <p className="border px-3 py-2 text-xs text-muted-foreground">
          {broadcastMessages.deviceOfflineHint}
        </p>
      )}

      <Panel title={broadcastMessages.textPanelTitle}>
        <form
          onSubmit={handleSendText}
          className="flex flex-wrap items-center gap-2 p-3"
          aria-busy={isSendingText}
        >
          <Input
            value={textMessage}
            onChange={(event) => setTextMessage(event.target.value)}
            placeholder={broadcastMessages.textPlaceholder}
            aria-label={broadcastMessages.textInputAriaLabel}
            maxLength={500}
            className="h-8 min-w-48 flex-1 text-sm"
          />
          <Button type="submit" size="sm" disabled={isSendingText}>
            {isSendingText
              ? broadcastMessages.sendingLabel
              : broadcastMessages.sendTextLabel}
          </Button>
        </form>
        {textErrorMessage !== null && (
          <p role="alert" className="px-3 pb-3 text-xs text-destructive">
            {textErrorMessage}
          </p>
        )}
      </Panel>

      <Panel
        title={broadcastMessages.audioPanelTitle}
        meta={
          <span className="text-xs text-dim">{broadcastMessages.maxDurationHint}</span>
        }
      >
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {recorderPhase === 'idle' && (
              <Button size="sm" onClick={() => void handleStartRecording()}>
                {broadcastMessages.recordLabel}
              </Button>
            )}
            {recorderPhase === 'recording' && (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void handleStopRecording()}
                >
                  {broadcastMessages.stopLabel}
                </Button>
                <span role="status" className="text-xs text-muted-foreground">
                  {broadcastMessages.recordingLabel(elapsedSeconds)}
                </span>
              </>
            )}
            {recorderPhase === 'recorded' && (
              <>
                <Button size="sm" onClick={() => void handleSendRecording()}>
                  {broadcastMessages.sendRecordingLabel}
                </Button>
                <Button size="sm" variant="outline" onClick={handleDiscardRecording}>
                  {broadcastMessages.discardLabel}
                </Button>
                <span className="text-xs text-dim">{recordedDurationSeconds}s</span>
              </>
            )}
            {recorderPhase === 'uploading' && uploadProgress !== null && (
              <span role="status" className="text-xs text-muted-foreground">
                {broadcastMessages.uploadProgressLabel(
                  uploadProgress[0],
                  uploadProgress[1],
                )}
              </span>
            )}
          </div>
          {previewUrl !== null && recorderPhase !== 'uploading' && (
            <audio
              controls
              src={previewUrl}
              aria-label={broadcastMessages.previewAriaLabel}
              className="h-9 w-full max-w-md"
            />
          )}
          {audioErrorMessage !== null && (
            <p role="alert" className="text-xs text-destructive">
              {audioErrorMessage}
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
