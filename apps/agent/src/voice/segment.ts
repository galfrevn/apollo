// A single tts_start advertises the whole clip up front and the device only
// buffers a few seconds of frames, so one giant clip is fragile — and batch
// synthesis means nothing plays until the entire reply is rendered. Speaking
// in sentence-sized segments keeps every clip short and lets the next
// segment's synthesis overlap the current one's playback.
export const SPEECH_SEGMENT_MAX_CHARACTER_COUNT = 280;

export function splitTextIntoSpeechSegmentList(
  text: string,
  maxCharacterCount = SPEECH_SEGMENT_MAX_CHARACTER_COUNT,
): string[] {
  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    return [];
  }
  if (trimmedText.length <= maxCharacterCount) {
    return [trimmedText];
  }

  const sentenceList = trimmedText.match(/[^.!?…\n]+[.!?…]*\s*/g) ?? [trimmedText];
  const segmentList: string[] = [];
  let currentSegment = '';
  for (const sentence of sentenceList) {
    for (const piece of splitOversizeSentence(sentence, maxCharacterCount)) {
      if (
        currentSegment.length > 0 &&
        currentSegment.length + piece.length > maxCharacterCount
      ) {
        segmentList.push(currentSegment.trim());
        currentSegment = '';
      }
      currentSegment += piece;
    }
  }
  if (currentSegment.trim().length > 0) {
    segmentList.push(currentSegment.trim());
  }
  return segmentList;
}

function splitOversizeSentence(sentence: string, maxCharacterCount: number): string[] {
  if (sentence.length <= maxCharacterCount) {
    return [sentence];
  }
  const pieceList: string[] = [];
  let remainingText = sentence;
  while (remainingText.length > maxCharacterCount) {
    const window = remainingText.slice(0, maxCharacterCount);
    // Prefer a comma boundary, fall back to a space, hard-cut as a last resort.
    const commaIndex = window.lastIndexOf(',');
    const spaceIndex = window.lastIndexOf(' ');
    const cutIndex =
      commaIndex > 0
        ? commaIndex + 1
        : spaceIndex > 0
          ? spaceIndex + 1
          : maxCharacterCount;
    pieceList.push(remainingText.slice(0, cutIndex));
    remainingText = remainingText.slice(cutIndex);
  }
  if (remainingText.length > 0) {
    pieceList.push(remainingText);
  }
  return pieceList;
}
