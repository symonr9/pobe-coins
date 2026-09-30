import * as AppleAuthentication from 'expo-apple-authentication';
import { AuthRequest, CodeChallengeMethod, ResponseType, exchangeCodeAsync, makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { API_URL, COGNITO_CLIENT_ID, COGNITO_DOMAIN } from '@/config';
import { exchangeAndStore, useSession } from './session';
import { useCallback, useState } from 'react';
import { ApiError } from '@/api/client';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: `${COGNITO_DOMAIN}/oauth2/authorize`,
  tokenEndpoint: `${COGNITO_DOMAIN}/oauth2/token`,
  revocationEndpoint: `${COGNITO_DOMAIN}/oauth2/revoke`,
};

export const redirectUri = makeRedirectUri({ scheme: 'pobecoins', path: 'auth/callback' });

/** Runs the Cognito Hosted UI for one provider and returns the Cognito ID token. */
async function hostedSignIn(provider: 'Google' | 'SignInWithApple'): Promise<string | null> {
  const request = new AuthRequest({
    clientId: COGNITO_CLIENT_ID,
    redirectUri,
    scopes: ['openid', 'email', 'profile'],
    responseType: ResponseType.Code,
    usePKCE: true,
    codeChallengeMethod: CodeChallengeMethod.S256,
    extraParams: { identity_provider: provider },
  });
  await request.makeAuthUrlAsync(discovery);
  const result = await request.promptAsync(discovery);
  if (result.type !== 'success' || !result.params.code) return null;
  const tokens = await exchangeCodeAsync(
    { clientId: COGNITO_CLIENT_ID, code: result.params.code, redirectUri, extraParams: { code_verifier: request.codeVerifier ?? '' } },
    discovery,
  );
  return tokens.idToken ?? null;
}

/** Gets a provider ID token without creating a profile (used to link an account). */
export async function providerIdToken(provider: 'google' | 'apple'): Promise<string | null> {
  if (provider === 'apple' && Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync())) {
    const cred = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL] });
    return cred.identityToken;
  }
  return hostedSignIn(provider === 'google' ? 'Google' : 'SignInWithApple');
}

export function useSignIn() {
  const session = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (label: string, getToken: () => Promise<string | null>) => {
      setBusy(label);
      setError(null);
      try {
        const idToken = await getToken();
        if (!idToken) return null;
        return await exchangeAndStore(session, idToken);
      } catch (err) {
        if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
        setError(err instanceof ApiError ? err.message : "Sign-in didn't finish. Please try again.");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [session],
  );

  return {
    busy,
    error,
    google: () => run('google', () => hostedSignIn('Google')),
    apple: () =>
      run('apple', async () => {
        if (Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync())) {
          const cred = await AppleAuthentication.signInAsync({
            requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
          });
          return cred.identityToken;
        }
        return hostedSignIn('SignInWithApple');
      }),
    dev: (name: string) =>
      run('dev', async () => {
        const sub =
          name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-') || 'dev';
        const res = await fetch(`${API_URL}/dev-token`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sub, name: name.trim() || 'Dev' }),
        });
        if (!res.ok) throw new ApiError('DEV', "The dev API isn't running. Start it with npm run dev:api.", res.status);
        return ((await res.json()) as { token: string }).token;
      }),
  };
}
