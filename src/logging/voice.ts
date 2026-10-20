import Constants, { ExecutionEnvironment } from "expo-constants";
export async function startVoice(
  onText: (text: string) => void,
  onEnd: () => void,
  onError: (message: string) => void,
) {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    throw Error(
      "Voice log needs a native Sip build with speech recognition enabled. Type it works here.",
    );
  const { ExpoSpeechRecognitionModule: speech } =
    await import("expo-speech-recognition");
  const permission = await speech.requestPermissionsAsync();
  if (!permission.granted)
    throw Error(
      "Enable microphone and speech recognition permission in Settings.",
    );
  const result = speech.addListener("result", (event) => {
    if (event.isFinal && event.results[0]?.transcript)
      onText(event.results[0].transcript);
  });
  const error = speech.addListener("error", (event) => {
    onError(event.message || "Speech was not recognized. Try typing.");
  });
  const end = speech.addListener("end", onEnd);
  try {
    speech.start({
      lang: "en-US",
      interimResults: false,
      continuous: false,
      maxAlternatives: 1,
    });
  } catch (e) {
    result.remove();
    error.remove();
    end.remove();
    throw e;
  }
  return () => {
    speech.stop();
    result.remove();
    error.remove();
    end.remove();
  };
}
