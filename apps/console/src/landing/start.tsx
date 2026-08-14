import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { useClipboard } from '@/components/clipboard';
import { Icons } from '@/components/icons';
import { LANDING_MESSAGE_CATALOG } from '@/landing/copy/catalog';
import { LANDING_COMMAND_MAP, LANDING_START_ANCHOR_ID } from '@/landing/metadata';
import { useMessages } from '@/locale/context';

type StartPane = 'terminal' | 'agent';
type CommandRuntime = keyof typeof LANDING_COMMAND_MAP;

function CopyButton({
  textToCopy,
  copyLabel,
  copiedLabel,
}: {
  readonly textToCopy: string;
  readonly copyLabel: string;
  readonly copiedLabel: string;
}) {
  const { isCopied, copyTextToClipboard } = useClipboard();
  return (
    <button
      type="button"
      onClick={() => copyTextToClipboard(textToCopy)}
      aria-label={copyLabel}
      className="flex items-center gap-2 font-mono text-xs text-dim transition-colors duration-150 hover:text-foreground"
    >
      {isCopied ? <Icons.Check size={14} /> : <Icons.Copy size={14} />}
      <span aria-live="polite">{isCopied ? copiedLabel : copyLabel}</span>
    </button>
  );
}

export function LandingStart() {
  const startMessages = useMessages(LANDING_MESSAGE_CATALOG).start;
  const [selectedPane, setSelectedPane] = useState<StartPane>('terminal');
  const [selectedRuntime, setSelectedRuntime] = useState<CommandRuntime>('bun');
  const terminalTabReference = useRef<HTMLButtonElement | null>(null);
  const agentTabReference = useRef<HTMLButtonElement | null>(null);

  const selectedCommand = LANDING_COMMAND_MAP[selectedRuntime];

  function activatePane(nextPane: StartPane): void {
    setSelectedPane(nextPane);
    const nextTabReference =
      nextPane === 'terminal' ? terminalTabReference : agentTabReference;
    nextTabReference.current?.focus();
  }

  function handleTablistKeyDown(keyboardEvent: KeyboardEvent<HTMLDivElement>): void {
    if (keyboardEvent.key === 'ArrowLeft' || keyboardEvent.key === 'ArrowRight') {
      keyboardEvent.preventDefault();
      activatePane(selectedPane === 'terminal' ? 'agent' : 'terminal');
      return;
    }
    if (keyboardEvent.key === 'Home') {
      keyboardEvent.preventDefault();
      activatePane('terminal');
      return;
    }
    if (keyboardEvent.key === 'End') {
      keyboardEvent.preventDefault();
      activatePane('agent');
    }
  }

  const tabDescriptorList = [
    {
      pane: 'terminal' as const,
      label: startMessages.terminalTabLabel,
      reference: terminalTabReference,
    },
    {
      pane: 'agent' as const,
      label: startMessages.agentTabLabel,
      reference: agentTabReference,
    },
  ];

  return (
    <div id={LANDING_START_ANCHOR_ID} data-reveal className="mt-14 md:ml-[220px]">
      <p className="text-xs text-dim">{startMessages.title}</p>
      <div className="mt-4 border bg-card">
        <div
          role="tablist"
          aria-label={startMessages.title}
          onKeyDown={handleTablistKeyDown}
          className="flex border-b"
        >
          {tabDescriptorList.map((tabDescriptor) => {
            const isSelected = selectedPane === tabDescriptor.pane;
            return (
              <button
                key={tabDescriptor.pane}
                ref={tabDescriptor.reference}
                type="button"
                role="tab"
                id={`start-tab-${tabDescriptor.pane}`}
                aria-selected={isSelected}
                aria-controls={`start-panel-${tabDescriptor.pane}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setSelectedPane(tabDescriptor.pane)}
                className={`border-r px-5 py-3 text-sm transition-colors duration-150 ${
                  isSelected
                    ? 'text-foreground'
                    : 'text-dim hover:bg-card-hover hover:text-muted-foreground'
                }`}
              >
                {tabDescriptor.label}
              </button>
            );
          })}
        </div>
        <div
          role="tabpanel"
          id="start-panel-terminal"
          aria-labelledby="start-tab-terminal"
          tabIndex={0}
          hidden={selectedPane !== 'terminal'}
          className="p-6"
        >
          <div className="flex gap-4 font-mono text-xs">
            {(Object.keys(LANDING_COMMAND_MAP) as readonly CommandRuntime[]).map(
              (commandRuntime) => (
                <button
                  key={commandRuntime}
                  type="button"
                  aria-pressed={selectedRuntime === commandRuntime}
                  onClick={() => setSelectedRuntime(commandRuntime)}
                  className={`transition-colors duration-150 ${
                    selectedRuntime === commandRuntime
                      ? 'text-foreground'
                      : 'text-dim hover:text-muted-foreground'
                  }`}
                >
                  {commandRuntime}
                </button>
              ),
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border bg-background px-4 py-3.5">
            <p className="font-mono text-sm">
              <span aria-hidden className="text-dim">
                $&nbsp;
              </span>
              {selectedCommand}
            </p>
            <CopyButton
              textToCopy={selectedCommand}
              copyLabel={startMessages.copyCommandLabel}
              copiedLabel={startMessages.copiedLabel}
            />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {startMessages.terminalCaption}
          </p>
        </div>
        <div
          role="tabpanel"
          id="start-panel-agent"
          aria-labelledby="start-tab-agent"
          tabIndex={0}
          hidden={selectedPane !== 'agent'}
          className="p-6"
        >
          <div className="border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-dim">{startMessages.agentPromptLabel}</p>
              <CopyButton
                textToCopy={startMessages.agentPrompt}
                copyLabel={startMessages.copyPromptLabel}
                copiedLabel={startMessages.copiedLabel}
              />
            </div>
            <p className="mt-3 max-w-[68ch] font-mono text-[13px] leading-[1.7] text-muted-foreground">
              {startMessages.agentPrompt}
            </p>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {startMessages.agentCaption}
          </p>
        </div>
      </div>
    </div>
  );
}
