import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useFocusEffect } from 'expo-router';
import type { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

const nativeRecognition = Platform.OS === 'web'
  ? null
  : requireOptionalNativeModule<typeof ExpoSpeechRecognitionModule>('ExpoSpeechRecognition');

type VoiceSession = {
  draft: string;
  finalTranscript: string;
  browser?: BrowserSpeechRecognition;
  nativeStarted?: boolean;
};

function speechErrorMessage(code: string) {
  switch (code) {
    case 'aborted': return null;
    case 'not-allowed': return Platform.OS === 'web' ? 'micBrowserPermission' : 'micSettingsPermission';
    case 'service-not-allowed': return Platform.OS === 'web' ? 'voiceBrowserUnavailable' : 'voiceUnavailable';
    case 'audio-capture': return 'voiceAudioUnavailable';
    case 'language-not-supported':
    case 'language-unavailable': return 'voiceLanguageUnavailable';
    case 'network': return 'voiceConnection';
    case 'no-speech': return 'voiceNoSpeech';
    default: return 'voiceRetry';
  }
}

export function useVoiceInput(setInput: (text: string) => void) {
  const [state, setState] = useState<'idle' | 'starting' | 'listening' | 'stopping'>('idle');
  const [issue, setIssue] = useState<string | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);

  const finish = useCallback((message: string | null = null) => {
    sessionRef.current = null;
    setState('idle');
    setIssue(message);
  }, []);

  const abortSession = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    session?.browser?.abort();
    if (session?.nativeStarted) nativeRecognition?.abort();
  }, []);

  const cancel = useCallback(() => {
    abortSession();
    finish();
  }, [abortSession, finish]);

  useFocusEffect(useCallback(() => {
    finish();
    if (!nativeRecognition) return abortSession;

    const subscriptions = [
      nativeRecognition.addListener('start', () => {
        if (sessionRef.current?.nativeStarted) setState('listening');
      }),
      nativeRecognition.addListener('result', ({ results, isFinal }) => {
        const session = sessionRef.current;
        const transcript = results[0]?.transcript.trim();
        if (!session?.nativeStarted || !transcript) return;
        const recognized = [session.finalTranscript, transcript].filter(Boolean).join(' ');
        if (isFinal) session.finalTranscript = recognized;
        setInput([session.draft, recognized].filter(Boolean).join(' '));
      }),
      nativeRecognition.addListener('error', ({ error }) => {
        if (sessionRef.current?.nativeStarted) finish(speechErrorMessage(error));
      }),
      nativeRecognition.addListener('end', () => {
        if (sessionRef.current?.nativeStarted) finish();
      }),
    ];

    return () => {
      for (const subscription of subscriptions) subscription.remove();
      abortSession();
    };
  }, [abortSession, finish, setInput]));

  const toggle = async (draft: string, lang: string) => {
    const active = sessionRef.current;
    if (active) {
      if (state !== 'listening') return;
      setState('stopping');
      try {
        if (active.browser) active.browser.stop();
        else nativeRecognition?.stop();
      } catch {
        abortSession();
        finish('voiceRetry');
      }
      return;
    }

    const session: VoiceSession = { draft: draft.trim(), finalTranscript: '' };
    sessionRef.current = session;
    setState('starting');
    setIssue(null);

    try {
      if (Platform.OS === 'web') {
        if (!window.isSecureContext) return finish('voiceSecureConnection');
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) return finish('voiceBrowserUnavailable');

        const recognition = new Recognition();
        session.browser = recognition;
        recognition.lang = lang;
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.onstart = () => {
          if (sessionRef.current === session) setState('listening');
        };
        recognition.onresult = ({ results }) => {
          if (sessionRef.current !== session) return;
          const transcript = Array.from(results, result => result[0]?.transcript.trim()).filter(Boolean).join(' ');
          if (transcript) setInput([session.draft, transcript].filter(Boolean).join(' '));
        };
        recognition.onerror = ({ error }) => {
          if (sessionRef.current === session) finish(speechErrorMessage(error));
        };
        recognition.onend = () => {
          if (sessionRef.current === session) finish();
        };
        // Start directly in the tap handler so the browser can ask for microphone access.
        recognition.start();
        return;
      }

      if (!nativeRecognition || (Platform.OS === 'android' && !nativeRecognition.isRecognitionAvailable())) {
        return finish('voiceUnavailable');
      }
      const permission = await nativeRecognition.requestPermissionsAsync();
      if (sessionRef.current !== session) return;
      if (!permission.granted) {
        return finish(permission.canAskAgain ? 'micAccessDesc' : 'micSettingsPermission');
      }

      session.nativeStarted = true;
      nativeRecognition.start({
        lang,
        interimResults: true,
        continuous: Platform.OS === 'ios' || Number(Platform.Version) >= 33,
        maxAlternatives: 1,
        addsPunctuation: true,
      });
    } catch {
      if (sessionRef.current === session) finish('voiceRetry');
    }
  };

  return { state, issue, toggle, cancel };
}
