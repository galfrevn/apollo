import type { LandingMessages } from '@/landing/copy/messages';

export const LANDING_MESSAGES_EN: LandingMessages = {
  metadata: {
    documentTitle: 'Apollo | Your personal desk agent',
    documentDescription:
      'The open-source brain for physical agentic devices: voice, memory, schedules, and tools, running in your own Cloudflare account.',
  },
  nav: {
    docsLabel: 'Docs',
    githubLabel: 'GitHub',
    openConsoleLabel: 'Open console →',
  },
  hero: {
    lineOne: 'Your personal',
    lineTwo: 'desk agent',
    subhead:
      'The open-source brain for physical agentic devices. It lives in your Cloudflare account; the body sits on your desk.',
    gettingStartedLabel: 'Getting started →',
  },
  showcase: {
    actIndexLabel: '01 · Listen',
    actTitle: 'You talk. It talks back.',
    intro: {
      lead: 'No app, no keyboard. ',
      emphasis: 'You speak across the desk',
      trail: ' and the answer comes back out loud, from a face that listens along.',
    },
    exchangeCellLabel: 'The exchange',
    conversationTurnList: [
      {
        speakerLabel: 'Wake word',
        spokenText: '“Hey, Apollo.”',
        isReply: false,
      },
      {
        speakerLabel: 'You',
        spokenText: '“What’s left on my list for today?”',
        isReply: false,
      },
      {
        speakerLabel: 'Apollo',
        spokenText: '“Two things: the design review, and watering the plant behind you.”',
        isReply: true,
      },
    ],
    deskCellLabel: 'Desk',
    liveLabel: 'Live',
    faceCaption:
      'The face follows the turn: curious, focused, talking. It watches the cursor, too.',
    wakeWordCellLabel: 'The wake word',
    wakeWordCaption: 'It wakes on the phrase; only then does audio leave the desk.',
    replyCellLabel: 'The reply',
    replyHeadline: 'A sentence, spoken out loud.',
    replyCaption: 'Question to answer in one round trip, tuned for a desk.',
    memoryCellLabel: 'Memory',
    memoryCaption: 'Say it once; it recalls it when it matters.',
    remindersCellLabel: 'Reminders',
    remindersCaption: 'Timers that fire on the device itself.',
    liveAnswersCellLabel: 'Live answers',
    liveAnswersCaption: 'Web research condensed into a sentence.',
    codingCellLabel: 'Coding agent',
    codingTerminalText: 'apollo run · opening a pull request',
    codingCaption:
      'Real repository work, delegated with a sentence and reported back out loud.',
    toolsCellLabel: 'Your tools',
    toolsCaption: 'The services you already use, over MCP.',
  },
  architecture: {
    actIndexLabel: '02 · Think',
    actTitle: 'One brain, any body.',
    intro: {
      lead: 'Every turn travels one path: the body streams your voice to ',
      emphasis: 'a Durable Object in your Cloudflare account',
      trail:
        '. It remembers, decides, reaches for tools, and answers in a sentence. The brain doesn’t care what the body is.',
    },
    bodyNodeLabel: 'The body',
    bodyNodeHeadline: 'A mic, a speaker, a face.',
    bodyNodeDetail: 'Any device that speaks the protocol',
    voiceWireLabel: 'voice →',
    replyWireLabel: '← reply',
    brainNodeLabel: 'The brain',
    brainNodeHeadline: 'One Durable Object per device, on your account.',
    brainNodeMonoLine: 'turns · memory · persona · schedules',
    brainNodeDetail: 'Cloudflare Worker',
    toolNodeList: [
      { name: 'Tools', detail: 'MCP servers, search, a coding sandbox' },
      { name: 'R2', detail: 'media the agent records and serves' },
      { name: 'Vectorize', detail: 'memory, recalled by meaning' },
    ],
  },
  capabilities: {
    actIndexLabel: '03 · Act',
    actTitle: 'Small talk is not the point.',
    intro: {
      lead: 'Apollo exists to get things done: ',
      emphasis: 'remember, remind, research, and ship',
      trail: ', all from a sentence spoken across the desk.',
    },
    capabilityRowList: [
      {
        indexLabel: '3.1',
        name: 'Voice turns',
        description:
          'Short spoken replies, tuned for a device on a desk, not a chat window.',
        tag: 'Always on',
      },
      {
        indexLabel: '3.2',
        name: 'Memory',
        description: 'Remembers what you tell it, and recalls it when it matters.',
        tag: 'Vectorize',
      },
      {
        indexLabel: '3.3',
        name: 'Reminders',
        description: 'Timers and schedules that fire on the device itself.',
        tag: 'On device',
      },
      {
        indexLabel: '3.4',
        name: 'Live answers',
        description: 'Web research condensed into a sentence you can act on.',
        tag: 'Search',
      },
      {
        indexLabel: '3.5',
        name: 'Coding agent',
        description:
          'Delegates real repository work to a sandboxed engine, then reports back out loud.',
        tag: 'Sandbox',
      },
      {
        indexLabel: '3.6',
        name: 'Your tools',
        description:
          'Connects to the services you already use over MCP, managed from the console.',
        tag: 'MCP',
      },
    ],
  },
  yours: {
    actIndexLabel: '04 · Yours',
    actTitle: 'Runs on your account. Answers to no one else.',
    introLead: 'Open source, end to end: the memory, the media, the keys. ',
    introEmphasis: 'Deploy it once and it’s yours.',
    ownershipCardList: [
      {
        label: 'The brain',
        description: 'Voice turns, memory, tools, and schedules in one Durable Object.',
        action: 'One command to deploy.',
      },
      {
        label: 'The body',
        description: 'The firmware for the device on your desk.',
        action: 'Flash it. Set it down.',
      },
    ],
    docsCardLabel: 'The docs',
    docsCardDescription:
      'A handbook for every part: protocol, memory, persona, operations.',
    docsCardAction: 'Read the docs →',
    consoleCardLabel: 'The console',
    consoleCardDescription: 'Everything it knows and plans, live from your worker.',
    consoleCardAction: 'Open console →',
  },
  footer: {
    echoWordList: ['The', 'desk', 'is', 'listening'],
    wakePhrase: '“Hey, Apollo.”',
    builtByPrefix: 'Built by ',
  },
};
