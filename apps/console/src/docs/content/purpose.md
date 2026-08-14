Apollo is the brain for a physical agent. It runs as a worker in an account you control and drives a device that has a mic, a speaker, and a face. It does not live in a chat window: you say its name out loud and the answer comes back spoken.

Apollo ships the brain, not the body. You bring the device, flash open firmware onto it, and choose the wake word it answers to. The reference build answers to "Apollo" because that is what its author named his; yours can be called anything the firmware can hear.

![The desk device resting on a desk, its round face glowing with two capsule eyes](/handbook/purpose.jpg)

## What Apollo is

- **A voice-first assistant.** Replies are written to be spoken — short, natural sentences rather than markdown essays. The whole pipeline, from transcription to synthesis, is tuned so a question gets a spoken answer in a couple of seconds.
- **A brain in your own account.** The agent is a worker with one durable session per body, deployed today to Cloudflare. That session keeps everything the desk is: conversation memory, preferences, pending confirmations, the focus timer. Your keys, your data, your infrastructure — there is no hosted middleman.
- **A tool-using agent.** Beyond talking, Apollo acts through a typed tool catalog: weather, memory, reminders and timers, lists, web search and deep research, translation, email reports, and an opt-in coding sandbox. The Capabilities chapter tours all of it.
- **A protocol server for a small device.** The wire contract assumes a constrained client: compact JSON control messages plus raw PCM audio, no decoder required. Anything that speaks it — the reference ESP32 firmware, a screenless speaker, a script in your terminal — is a valid body.

## What Apollo is not

- **Not a chat web app.** There is no message thread to scroll. The management console exists, but it is the instrument panel around the device, not the product — the body is where Apollo lives.
- **Not a hosted service.** heyapollo.dev serves this handbook and a stateless console; your worker never reports back to it. Apollo is MIT licensed, and the brain deploys from one command into an account you control.
- **Not the firmware.** The body lives in its own repository with its own handbook. The brain fixes the wire contract and every body adapts to it — the firmware adapts to Apollo, never the reverse.

## Who it is for

Someone who wants to own the whole stack, and who is willing to bring hardware. You deploy the worker with your own account and API keys, flash (or build) the device yourself, and every fact the agent knows lives in infrastructure you can inspect and delete. The starter ships speaking Rioplatense Spanish for a desk in Buenos Aires; changing the language, the voice, or the city is a guided edit, not a fork. If you would rather delegate, the scaffolded project carries its own manual as agent skills, so a coding agent can set it up, operate it, and extend it for you — the Skills chapter explains how.
