import { Modality, type LiveConnectConfig } from '@google/genai';

export const MODEL = 'gemini-3.5-live-translate-preview';
export const TOKEN_LIFETIME_MS = 30 * 60 * 1000;

/** Shared by the browser and the token broker so translation settings are locked. */
export function liveConfig(): LiveConnectConfig {
    return {
        responseModalities: [Modality.AUDIO],
        translationConfig: {
            targetLanguageCode: 'vi',
            // Return audio even if the source is already Vietnamese.
            echoTargetLanguage: true
        }
    };
}
