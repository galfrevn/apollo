import { isDeviceSharedSecretValid, readDeviceTokenFromRequestUrl } from '@/auth/token';

export type ApolloConnectionRole = 'device' | 'dashboard';

export async function resolveApolloConnectionRole(
  requestUrl: URL,
  environment: Env,
): Promise<ApolloConnectionRole | null> {
  const presentedToken = readDeviceTokenFromRequestUrl(requestUrl);
  if (await isDeviceSharedSecretValid(presentedToken, environment.DEVICE_SHARED_SECRET)) {
    return 'device';
  }
  if (
    await isDeviceSharedSecretValid(presentedToken, environment.DASHBOARD_SHARED_SECRET)
  ) {
    return 'dashboard';
  }
  return null;
}
