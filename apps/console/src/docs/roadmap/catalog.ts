import {
  siApplemusic,
  siArduino,
  siAsana,
  siAnthropic,
  siCloudflare,
  siDeepgram,
  siDeno,
  siDiscord,
  siDocker,
  siElevenlabs,
  siEspressif,
  siFlydotio,
  siGithub,
  siGmail,
  siGooglecalendar,
  siGoogledrive,
  siGooglegemini,
  siHomeassistant,
  siHuggingface,
  siJira,
  siLinear,
  siNetlify,
  siNotion,
  siObsidian,
  siOllama,
  siOpenrouter,
  siPhilipshue,
  siRailway,
  siRaspberrypi,
  siRaycast,
  siSentry,
  siSpotify,
  siStripe,
  siTelegram,
  siTodoist,
  siTrello,
  siVercel,
  siWhatsapp,
  siZapier,
} from 'simple-icons';

export type RoadmapStatus = 'shipped' | 'building' | 'planned' | 'exploring';

export interface RoadmapBrand {
  readonly name: string;
  readonly iconPath: string;
  readonly isShipped: boolean;
}

export interface RoadmapTrack {
  readonly indexLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly status: RoadmapStatus;
  readonly brandList: readonly RoadmapBrand[];
  readonly itemList: readonly string[];
}

export const ROADMAP_COMPLETION_PERCENT = 10;

export const ROADMAP_STATUS_LABEL_MAP: Record<RoadmapStatus, string> = {
  shipped: 'Shipped',
  building: 'Building',
  planned: 'Planned',
  exploring: 'Exploring',
};

function brand(name: string, icon: { readonly path: string }, isShipped = false) {
  return { name, iconPath: icon.path, isShipped };
}

export const ROADMAP_TRACK_LIST: readonly RoadmapTrack[] = [
  {
    indexLabel: '01',
    title: 'The brain, anywhere',
    summary:
      'Today the starter deploys to one provider. The agent loop, the protocol, and the storage contracts are written to be portable, so the next step is a starter that asks where you want it and scaffolds for that target.',
    status: 'building',
    brandList: [
      brand('Cloudflare', siCloudflare, true),
      brand('Vercel', siVercel),
      brand('Netlify', siNetlify),
      brand('Fly.io', siFlydotio),
      brand('Railway', siRailway),
      brand('Deno', siDeno),
      brand('Docker', siDocker),
    ],
    itemList: [
      'One starter, many targets: pick the provider during `create heyapollo`',
      'A storage adapter so memory, media, and vectors are not tied to one vendor',
      'A self-hosted image for people who want the brain on their own hardware',
      'A migration path that moves a live agent between providers without losing its memory',
    ],
  },
  {
    indexLabel: '02',
    title: 'Any model, any voice',
    summary:
      'Every part of a turn is a swappable stage: transcription, reasoning, and speech. The goal is to make each one a choice you make in the console instead of a code change, including models that never leave your machine.',
    status: 'planned',
    brandList: [
      brand('OpenRouter', siOpenrouter, true),
      brand('ElevenLabs', siElevenlabs, true),
      brand('Anthropic', siAnthropic),
      brand('Gemini', siGooglegemini),
      brand('Ollama', siOllama),
      brand('Deepgram', siDeepgram),
      brand('Hugging Face', siHuggingface),
    ],
    itemList: [
      'Per-stage model selection: one model for quick turns, another for deep research',
      'Bring your own gateway, including a local endpoint on your network',
      'Voice cloning, so it can answer in a voice you chose or recorded',
      'Cost and latency shown per turn, so a slow model is visible rather than guessed at',
    ],
  },
  {
    indexLabel: '03',
    title: 'Make it yours',
    summary:
      'Right now the name, the voice, and the character are edits in a repository. All of it should be a surface in the console, and the agent should be able to change itself when you ask it to out loud.',
    status: 'planned',
    brandList: [],
    itemList: [
      'Set the wake word from the console and push it to the body over the air',
      'A persona editor: tone, verbosity, how often it interrupts, when it stays quiet',
      'A face designer, so the eyes and the accent color are yours instead of the default',
      'Sound packs for wake, confirm, and error, with a preview before you commit',
      'Moods on a schedule: focused during work hours, warmer in the evening',
      'Memory you can curate out loud: forget that, remember this instead, never bring that up',
      'Custom tools without writing code, described in a sentence and confirmed before they run',
    ],
  },
  {
    indexLabel: '04',
    title: 'Everything you already use',
    summary:
      'MCP already lets the agent reach any server you point it at. What is missing is the short path: a catalog where connecting your calendar takes one click and a consent screen, not a config file.',
    status: 'building',
    brandList: [
      brand('GitHub', siGithub, true),
      brand('Linear', siLinear, true),
      brand('Notion', siNotion, true),
      brand('Sentry', siSentry, true),
      brand('Stripe', siStripe, true),
      brand('Jira', siJira, true),
      brand('Google Calendar', siGooglecalendar),
      brand('Gmail', siGmail),
      brand('Google Drive', siGoogledrive),
      brand('Todoist', siTodoist),
      brand('Obsidian', siObsidian),
      brand('Trello', siTrello),
      brand('Asana', siAsana),
      brand('Zapier', siZapier),
      brand('Raycast', siRaycast),
      brand('Spotify', siSpotify),
      brand('Apple Music', siApplemusic),
      brand('Discord', siDiscord),
      brand('Telegram', siTelegram),
      brand('WhatsApp', siWhatsapp),
      brand('Home Assistant', siHomeassistant),
      brand('Philips Hue', siPhilipshue),
    ],
    itemList: [
      'A connector catalog with one-click install and a clear consent screen per scope',
      'Reach into the room: lights, music, and anything Home Assistant already controls',
      'Messaging bridges, so a reminder can also land on your phone when you are away',
      'Per-tool permissions you can revoke from the console without redeploying',
    ],
  },
  {
    indexLabel: '05',
    title: 'More bodies',
    summary:
      'The protocol is deliberately small so that the reference board is an example rather than a requirement. Every new body is a firmware that speaks the same contract and inherits the whole brain for free.',
    status: 'exploring',
    brandList: [
      brand('Espressif', siEspressif, true),
      brand('Raspberry Pi', siRaspberrypi),
      brand('Arduino', siArduino),
    ],
    itemList: [
      'A screenless build: a puck that is only a mic, a speaker, and a light ring',
      'A phone as a body, for the agent that has to leave the room with you',
      'Reference builds beyond one board, with a parts list and a printable shell',
      'A terminal body, so a laptop can be a body while you wait for hardware',
    ],
  },
  {
    indexLabel: '06',
    title: 'Beyond one room',
    summary:
      'One brain per body is the current model. The interesting version is one brain that follows you between bodies, knows which room you are in, and occasionally speaks first.',
    status: 'exploring',
    brandList: [],
    itemList: [
      'Several bodies, one brain: the same memory answers in the kitchen and at the desk',
      'Handoff, so a turn started in one room finishes in another',
      'Presence: it knows the room is empty and stops rendering a face for nobody',
      'Proactive nudges that are welcome rather than noisy, and easy to turn off',
      'An offline fallback for the answers that never needed the network',
    ],
  },
];
