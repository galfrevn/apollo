export interface ConversationTurn {
  readonly speakerLabel: string;
  readonly spokenText: string;
  readonly isReply: boolean;
}

export interface CapabilityRow {
  readonly indexLabel: string;
  readonly name: string;
  readonly description: string;
  readonly tag: string;
}

export interface ToolNode {
  readonly name: string;
  readonly detail: string;
}

export interface OwnershipCard {
  readonly label: string;
  readonly description: string;
  readonly action: string;
}

export interface EmphasizedParagraph {
  readonly lead: string;
  readonly emphasis: string;
  readonly trail: string;
}

export interface LandingMessages {
  readonly metadata: {
    readonly documentTitle: string;
    readonly documentDescription: string;
  };
  readonly nav: {
    readonly docsLabel: string;
    readonly githubLabel: string;
    readonly openConsoleLabel: string;
  };
  readonly hero: {
    readonly lineOne: string;
    readonly lineTwo: string;
    readonly subhead: string;
    readonly gettingStartedLabel: string;
  };
  readonly showcase: {
    readonly actIndexLabel: string;
    readonly actTitle: string;
    readonly intro: EmphasizedParagraph;
    readonly exchangeCellLabel: string;
    readonly conversationTurnList: readonly ConversationTurn[];
    readonly deskCellLabel: string;
    readonly liveLabel: string;
    readonly faceCaption: string;
    readonly wakeWordCellLabel: string;
    readonly wakeWordCaption: string;
    readonly replyCellLabel: string;
    readonly replyHeadline: string;
    readonly replyCaption: string;
    readonly memoryCellLabel: string;
    readonly memoryCaption: string;
    readonly remindersCellLabel: string;
    readonly remindersCaption: string;
    readonly liveAnswersCellLabel: string;
    readonly liveAnswersCaption: string;
    readonly codingCellLabel: string;
    readonly codingTerminalText: string;
    readonly codingCaption: string;
    readonly toolsCellLabel: string;
    readonly toolsCaption: string;
  };
  readonly architecture: {
    readonly actIndexLabel: string;
    readonly actTitle: string;
    readonly intro: EmphasizedParagraph;
    readonly bodyNodeLabel: string;
    readonly bodyNodeHeadline: string;
    readonly bodyNodeDetail: string;
    readonly voiceWireLabel: string;
    readonly replyWireLabel: string;
    readonly brainNodeLabel: string;
    readonly brainNodeHeadline: string;
    readonly brainNodeMonoLine: string;
    readonly brainNodeDetail: string;
    readonly toolNodeList: readonly ToolNode[];
  };
  readonly capabilities: {
    readonly actIndexLabel: string;
    readonly actTitle: string;
    readonly intro: EmphasizedParagraph;
    readonly capabilityRowList: readonly CapabilityRow[];
  };
  readonly yours: {
    readonly actIndexLabel: string;
    readonly actTitle: string;
    readonly introLead: string;
    readonly introEmphasis: string;
    readonly ownershipCardList: readonly OwnershipCard[];
    readonly docsCardLabel: string;
    readonly docsCardDescription: string;
    readonly docsCardAction: string;
    readonly consoleCardLabel: string;
    readonly consoleCardDescription: string;
    readonly consoleCardAction: string;
  };
  readonly footer: {
    readonly echoWordList: readonly string[];
    readonly wakePhrase: string;
    readonly builtByPrefix: string;
  };
}
