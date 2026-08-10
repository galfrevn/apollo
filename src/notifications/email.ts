// Resend free tier: without a verified domain it can only deliver to the
// account owner's own address — exactly Apollo's use case (reports and notes
// to the user, never arbitrary recipients).
export async function sendEmailWithResend(input: {
  readonly resendApiKey: string;
  readonly toAddress: string;
  readonly subject: string;
  readonly textBody: string;
  readonly fetchImplementation?: typeof fetch;
}): Promise<void> {
  const fetchImplementation = input.fetchImplementation ?? globalThis.fetch;
  const response = await fetchImplementation('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Apollo <onboarding@resend.dev>',
      to: [input.toAddress],
      subject: input.subject,
      text: input.textBody,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email falló con status ${response.status}`);
  }
}
