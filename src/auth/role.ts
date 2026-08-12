import { isDeviceSharedSecretValid, readDeviceTokenFromRequestUrl } from '@/auth/token';

export type ApolloConnectionRole = 'device' | 'dashboard';

export const DEVICE_CONNECTION_TAG: ApolloConnectionRole = 'device';

export function hasDeviceConnectionTag(connectionTagList: readonly string[]): boolean {
  return connectionTagList.includes(DEVICE_CONNECTION_TAG);
}

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
