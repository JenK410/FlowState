import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const FLOWSTATE_BANNER = require('./assets/flowstate-banner.png');

const DEFAULT_URL =
  process.env.EXPO_PUBLIC_FLOWSTATE_URL ||
  Constants.expoConfig?.extra?.flowstateUrl ||
  'http://127.0.0.1:3001';

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_URL;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

function withMobileShellFlag(value: string) {
  const normalized = normalizeUrl(value);
  const separator = normalized.includes('?') ? '&' : '?';
  return normalized.includes('mobileShell=1') ? normalized : `${normalized}${separator}mobileShell=1`;
}

export default function App() {
  const [urlInput, setUrlInput] = useState(String(DEFAULT_URL));
  const [appUrl, setAppUrl] = useState(withMobileShellFlag(String(DEFAULT_URL)));
  const [loadFailed, setLoadFailed] = useState(false);

  const source = useMemo(() => ({ uri: appUrl }), [appUrl]);

  if (Platform.OS === 'web') {
    return <WebRedirect appUrl={appUrl} />;
  }

  return (
    <SafeAreaView style={styles.shell}>
      <StatusBar style="dark" />
      <WebView
        source={source}
        style={styles.webview}
        startInLoadingState
        sharedCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        allowsBackForwardNavigationGestures
        onLoadStart={() => setLoadFailed(false)}
        onError={() => setLoadFailed(true)}
        onHttpError={() => setLoadFailed(true)}
        renderLoading={() => (
          <View style={styles.loading}>
            <Image source={FLOWSTATE_BANNER} resizeMode="contain" style={styles.banner} />
            <ActivityIndicator color="#10b981" size="large" />
            <Text style={styles.loadingText}>Opening FlowState...</Text>
          </View>
        )}
      />

      {loadFailed && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <View style={styles.card}>
            <Image source={FLOWSTATE_BANNER} resizeMode="contain" style={styles.banner} />
            <Text style={styles.title}>Connect to FlowState</Text>
            <Text style={styles.copy}>
              Start the FlowState web server on your computer, then enter the address your phone can reach.
            </Text>
            <TextInput
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://192.168.1.25:3001"
              style={styles.input}
            />
            <Pressable
              style={styles.button}
              onPress={() => setAppUrl(withMobileShellFlag(urlInput))}
            >
              <Text style={styles.buttonText}>Open App</Text>
            </Pressable>
            <Text style={styles.hint}>
              Android emulator usually uses http://10.0.2.2:3001. A real phone usually needs your computer IP.
            </Text>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function WebRedirect({ appUrl }: { appUrl: string }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.replace(appUrl);
    }
  }, [appUrl]);

  return (
    <SafeAreaView style={styles.webRedirectShell}>
      <StatusBar style="dark" />
      <View style={styles.webRedirectCard}>
        <Image source={FLOWSTATE_BANNER} resizeMode="contain" style={styles.banner} />
        <ActivityIndicator color="#10b981" size="large" />
        <Text style={styles.title}>Opening FlowState</Text>
        <Text style={styles.copy}>
          Your browser is being sent directly to the FlowState web app.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            if (typeof window !== 'undefined') {
              window.location.href = appUrl;
            }
          }}
        >
          <Text style={styles.buttonText}>Open FlowState</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  webview: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    padding: 24,
  },
  banner: {
    height: 82,
    marginBottom: 8,
    maxWidth: 360,
    width: '100%',
  },
  loadingText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    gap: 14,
    maxWidth: 420,
    padding: 22,
    width: '100%',
  },
  title: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
  },
  copy: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 14,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 14,
  },
  buttonText: {
    color: '#052e16',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  hint: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
  },
  webRedirectShell: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  webRedirectCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    gap: 14,
    maxWidth: 420,
    padding: 24,
    width: '100%',
  },
});
