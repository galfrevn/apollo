import type { LandingMessages } from '@/landing/copy/messages';

export const LANDING_MESSAGES: LandingMessages = {
  metadata: {
    documentTitle: 'Apollo | The brain for physical agents',
    documentDescription:
      'The open source brain for physical voice agents. It listens, remembers, and gets things done. You bring the body, you pick its name, and it runs on infrastructure you own.',
  },
  nav: {
    docsLabel: 'Docs',
    githubLabel: 'GitHub',
    openConsoleLabel: 'Open console →',
  },
  hero: {
    lineOne: 'The brain for',
    lineTwo: 'physical agents',
    subhead:
      'Not every agent belongs in a chat window. Apollo is the open source brain that gives one a voice, a memory, and a face. You bring the body it speaks through.',
  },
  showcase: {
    actIndexLabel: '01 · Listen',
    actTitle: 'Nothing to open.',
    intro: {
      lead: 'An agent in a tab waits for you to come to it. This one listens from across the room: you say its name and ',
      emphasis: 'it wakes, listens, and answers out loud',
      trail:
        '. The name is yours to pick. I called mine Apollo, and the face on its screen stays with me through the whole turn.',
    },
    exchangeCellLabel: 'A full turn',
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
        spokenText:
          '“Two things: the design review at four, and watering the plant behind you.”',
        isReply: true,
      },
    ],
    deskCellLabel: 'The body',
    liveLabel: 'Live',
    faceCaption:
      'Curious when it listens, focused when it thinks, lively when it speaks. And it follows your cursor.',
    wakeWordCellLabel: 'The wake word',
    wakeWordCaption:
      'You set the name in the firmware. Until the body hears it, nothing you say leaves the room.',
    replyCellLabel: 'The reply',
    replyHeadline: 'Short, spoken, no preamble.',
    replyCaption:
      'It answers like someone sitting next to you, not like a chat writing paragraphs.',
    memoryCellLabel: 'Memory',
    memoryCaption:
      'You mention something in passing and it comes back weeks later, when it matters.',
    remindersCellLabel: 'Reminders',
    remindersCaption:
      'The alert fires on the body itself, with nothing open on your computer.',
    liveAnswersCellLabel: 'Live answers',
    liveAnswersCaption:
      'It searches the web and tells you only the part you need to hear.',
    codingCellLabel: 'Coding agent',
    codingTerminalText: 'apollo run · opening a pull request',
    codingCaption:
      'You ask for a change, it works in a sandbox and tells you when the pull request is ready.',
    toolsCellLabel: 'Your tools',
    toolsCaption:
      'Your calendar, your notes, the services you already use: it touches them for you.',
  },
  architecture: {
    actIndexLabel: '02 · Think',
    actTitle: 'One brain, any body.',
    intro: {
      lead: 'The body only brings a mic, a speaker, and a face. It streams your voice to ',
      emphasis: 'a brain that runs on infrastructure you own',
      trail:
        '. Everything the agent knows lives there: the memory, the schedules, the character. Swap the body and none of it moves. Today the brain deploys to Cloudflare, and it is written to outlive that choice.',
    },
    bodyNodeLabel: 'The body',
    bodyNodeHeadline: 'A mic, a speaker, a face.',
    bodyNodeDetail: 'Any device that speaks the protocol',
    voiceWireLabel: 'voice →',
    replyWireLabel: '← reply',
    brainNodeLabel: 'The brain',
    brainNodeHeadline: 'One instance per body, on your account.',
    brainNodeMonoLine: 'turns · memory · persona · schedules',
    brainNodeDetail: 'Durable Object',
    toolNodeList: [
      { name: 'Tools', detail: 'MCP servers, search, a coding sandbox' },
      { name: 'Storage', detail: 'the audio it records and plays back' },
      { name: 'Vectors', detail: 'memory, searched by meaning' },
    ],
  },
  capabilities: {
    actIndexLabel: '03 · Act',
    actTitle: 'Talking is the means, not the point.',
    intro: {
      lead: 'Everything you ask for ends in something done: ',
      emphasis: 'remember, remind, research, and ship',
      trail: ', without you opening a single tab.',
    },
    capabilityRowList: [
      {
        indexLabel: '3.1',
        name: 'Voice turns',
        description:
          'It answers out loud, in short sentences. Nothing to read, nothing to type.',
        tag: 'Always on',
      },
      {
        indexLabel: '3.2',
        name: 'Memory',
        description:
          'Keeps what you tell it and brings it back when it fits, even weeks later.',
        tag: 'Vectors',
      },
      {
        indexLabel: '3.3',
        name: 'Reminders',
        description:
          'Timers and scheduled alerts that fire on the body, not on your phone.',
        tag: 'On device',
      },
      {
        indexLabel: '3.4',
        name: 'Live answers',
        description:
          'Searches the internet and gives you the answer, not ten links to sift through.',
        tag: 'Search',
      },
      {
        indexLabel: '3.5',
        name: 'Coding agent',
        description:
          'You describe the change, it works in a sandbox on your repository and tells you how it went.',
        tag: 'Sandbox',
      },
      {
        indexLabel: '3.6',
        name: 'Your tools',
        description:
          'Connect your calendar, your notes, or any service you already use over MCP, from the console.',
        tag: 'MCP',
      },
      {
        indexLabel: '3.7',
        name: 'Character',
        description:
          'Its name, its voice, and four speech modes that each carry their own face.',
        tag: 'Persona',
      },
    ],
  },
  yours: {
    actIndexLabel: '04 · Yours',
    actTitle: 'It runs on your account. It answers to no one else.',
    introLead:
      'You pick the name it wakes to, how it speaks, and what face it wears. The conversations, the memory, the audio, and the keys never leave your account. ',
    introEmphasis: 'No account to create, no subscription to pay.',
    ownershipCardList: [
      {
        label: 'The brain',
        description:
          'Voice, memory, tools, and schedules in one deployment you own. This part is one command away.',
        action: 'Deploy it with one command →',
        actionTargetId: 'start',
      },
      {
        label: 'The body',
        description:
          'This part you bring. Open firmware for the reference build, or any device that speaks the protocol.',
        action: 'Build it. Flash it. Name it.',
        actionTargetId: null,
      },
    ],
    docsCardLabel: 'The docs',
    docsCardDescription:
      'Nine chapters: how it works inside, how it is configured, and how it is operated.',
    docsCardAction: 'Read the docs →',
    consoleCardLabel: 'The console',
    consoleCardDescription:
      'See what it remembers, what it has scheduled, and every turn, live.',
    consoleCardAction: 'Open console →',
  },
  start: {
    title: 'Two ways in',
    terminalTabLabel: 'The terminal',
    agentTabLabel: 'Your coding agent',
    terminalCaption: 'About five minutes. Trial mode works with zero API keys.',
    agentPromptLabel: 'Paste into any agent that reads AGENTS.md',
    agentPrompt:
      'Run `bun create heyapollo`, open the new folder, read AGENTS.md, and follow the apollo-setup skill to provision my account and deploy. I will paste API keys into .dev.vars myself; never ask for them in chat.',
    agentCaption: 'Keys never enter the chat; they go straight into .dev.vars.',
    copyCommandLabel: 'Copy the command',
    copyPromptLabel: 'Copy the prompt',
    copiedLabel: 'Copied',
  },
  footer: {
    echoWordList: ['Give', 'it', 'a', 'body'],
    wakePhrase: '“Hey, Apollo.”',
    builtByPrefix: 'Built by ',
  },
};
