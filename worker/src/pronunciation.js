const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5MB, du cho vai giay ghi am

export async function handlePronunciation(request, env, corsHeaders) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonError("invalid-form-data", 400, corsHeaders);
  }

  const audio = form.get("audio");
  const expectedText = String(form.get("expectedText") || "").trim();

  if (!audio || typeof audio === "string") {
    return jsonError("missing-audio", 400, corsHeaders);
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return jsonError("audio-too-large", 413, corsHeaders);
  }

  const audioBuffer = await audio.arrayBuffer();

  const pronunciationConfig = btoa(
    JSON.stringify({
      ReferenceText: expectedText,
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      Dimension: "Comprehensive",
      EnableMiscue: true,
    })
  );

  const azureUrl = `https://${env.AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`;

  let azureRes;
  try {
    azureRes = await fetch(azureUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
        "Content-Type": audio.type || "audio/webm; codecs=opus",
        "Pronunciation-Assessment": pronunciationConfig,
        Accept: "application/json",
      },
      body: audioBuffer,
    });
  } catch {
    return jsonError("azure-request-failed", 502, corsHeaders);
  }

  if (!azureRes.ok) {
    return jsonError(`azure-error-${azureRes.status}`, 502, corsHeaders);
  }

  const azureData = await azureRes.json();
  const best = azureData.NBest && azureData.NBest[0];

  return new Response(
    JSON.stringify({
      text: azureData.DisplayText || (best && best.Display) || "",
      accuracyScore: best?.PronunciationAssessment?.AccuracyScore ?? null,
      fluencyScore: best?.PronunciationAssessment?.FluencyScore ?? null,
      completenessScore: best?.PronunciationAssessment?.CompletenessScore ?? null,
      pronScore: best?.PronunciationAssessment?.PronScore ?? null,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function jsonError(message, status, corsHeaders) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
