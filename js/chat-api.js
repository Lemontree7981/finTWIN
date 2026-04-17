const ChatApi = (() => {
  function getConfig() {
    const source = window.FinSimConfig?.chatApi || {};
    return {
      enabled: Boolean(source.enabled),
      transport: source.transport || 'openai-chat-completions',
      apiUrl: (source.apiUrl || '').trim(),
      model: (source.model || '').trim(),
      apiKey: (source.apiKey || '').trim(),
      temperature: typeof source.temperature === 'number' ? source.temperature : 0.35,
      maxTokens: typeof source.maxTokens === 'number' ? source.maxTokens : 700,
      extraHeaders: source.extraHeaders && typeof source.extraHeaders === 'object' ? source.extraHeaders : {},
      systemPrompt: source.systemPrompt || ''
    };
  }

  function hasApiKey() {
    return Boolean(getConfig().apiKey);
  }

  function canUseRemote() {
    const config = getConfig();
    return Boolean(config.enabled && config.apiKey && config.apiUrl && config.model);
  }

  function getMissingFields() {
    const config = getConfig();
    return ['apiKey', 'apiUrl', 'model'].filter((field) => !config[field]);
  }

  function getMode() {
    if (canUseRemote()) return 'live';
    if (hasApiKey()) return 'setup';
    return 'local';
  }

  function getStatusText() {
    const mode = getMode();
    if (mode === 'live') return 'Live AI chat enabled';
    if (mode === 'setup') return 'API key loaded - add provider URL + model';
    return 'Local simulator mode';
  }

  function getSetupHintHtml() {
    const missing = getMissingFields();
    const missingText = missing.length ? missing.join(', ') : 'provider settings';

    return [
      '<p>Live AI is almost wired up, but the chat still needs the remaining provider details.</p>',
      `<p>Add <strong>${escapeHtml(missingText)}</strong> in <code>js/config.local.js</code> to turn on live model responses.</p>`,
      '<p>Until then, the built-in scenario simulator is still available for what-if questions.</p>'
    ].join('');
  }

  async function generateReply(context) {
    if (!canUseRemote()) {
      throw new Error('Live AI chat is not fully configured yet.');
    }

    const config = getConfig();
    const systemPrompt = buildSystemPrompt(config);
    const userPrompt = buildUserPrompt(context);

    switch (config.transport) {
      case 'openai-chat-completions':
        return formatAssistantText(await requestOpenAICompatible(config, systemPrompt, userPrompt));
      case 'anthropic-messages':
        return formatAssistantText(await requestAnthropic(config, systemPrompt, userPrompt));
      case 'gemini-generate-content':
        return formatAssistantText(await requestGemini(config, systemPrompt, userPrompt));
      default:
        throw new Error(`Unsupported chat transport: ${config.transport}`);
    }
  }

  async function requestOpenAICompatible(config, systemPrompt, userPrompt) {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: Object.assign(
        {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        config.extraHeaders
      ),
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    const data = await readJsonOrError(response);
    const content = data?.choices?.[0]?.message?.content;
    return extractText(content) || data?.output_text || '';
  }

  async function requestAnthropic(config, systemPrompt, userPrompt) {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: Object.assign(
        {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        config.extraHeaders
      ),
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })
    });

    const data = await readJsonOrError(response);
    return extractText(data?.content) || '';
  }

  async function requestGemini(config, systemPrompt, userPrompt) {
    const baseUrl = config.apiUrl.replace(/\/$/, '');
    const modelPath = config.model.startsWith('models/') ? config.model : `models/${config.model}`;
    const endpoint = `${baseUrl}/${modelPath}:generateContent`;
    const url = endpoint.includes('?')
      ? `${endpoint}&key=${encodeURIComponent(config.apiKey)}`
      : `${endpoint}?key=${encodeURIComponent(config.apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: Object.assign(
        {
          'Content-Type': 'application/json'
        },
        config.extraHeaders
      ),
      body: JSON.stringify({
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${systemPrompt}\n\n${userPrompt}`
              }
            ]
          }
        ]
      })
    });

    const data = await readJsonOrError(response);
    return extractText(data?.candidates?.[0]?.content?.parts) || '';
  }

  async function readJsonOrError(response) {
    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      const detail = data?.error?.message || data?.message || text || `HTTP ${response.status}`;
      throw new Error(detail.slice(0, 220));
    }

    return data;
  }

  function buildSystemPrompt(config) {
    return [
      config.systemPrompt,
      'Prefer short paragraphs.',
      'Use flat bullet lists only when they add clarity.',
      'If the scenario numbers are included, anchor your answer in them.',
      'Use session memory when it is provided and keep it internally consistent.',
      'If information is missing, say what is uncertain instead of guessing.',
      'Treat the reply as end-user UI copy, not developer output.'
    ].join(' ');
  }

  function buildUserPrompt(context) {
    const payload = {
      userQuestion: context.message,
      currentProfile: context.profile || null,
      activeScenario: context.activeScenario || null,
      scenarioAnalysis: context.scenarioAnalysis || null,
      latestDashboardState: context.latestDashboardState || null,
      sessionMemory: context.sessionMemory || null
    };

    return [
      'Answer the user based on the app context below.',
      'Keep it practical, financially literate, and easy to scan.',
      '',
      JSON.stringify(payload, null, 2)
    ].join('\n');
  }

  function extractText(content) {
    if (!content) return '';
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part?.type === 'text') return part.text || '';
          if (part?.text) return part.text;
          return '';
        })
        .join('\n')
        .trim();
    }
    if (typeof content === 'object' && content.text) {
      return String(content.text).trim();
    }
    return '';
  }

  function formatAssistantText(text) {
    if (!text || !text.trim()) {
      return '<p>I could not generate a reply from the configured AI provider.</p>';
    }

    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const html = [];
    let paragraph = [];
    let listItems = [];

    function flushParagraph() {
      if (!paragraph.length) return;
      html.push(`<p>${escapeHtml(paragraph.join(' '))}</p>`);
      paragraph = [];
    }

    function flushList() {
      if (!listItems.length) return;
      html.push(`<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
      listItems = [];
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        flushParagraph();
        flushList();
        continue;
      }

      if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
        flushParagraph();
        listItems.push(line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
        continue;
      }

      flushList();
      paragraph.push(line);
    }

    flushParagraph();
    flushList();

    return html.join('') || `<p>${escapeHtml(text.trim())}</p>`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return {
    canUseRemote,
    generateReply,
    getMode,
    getSetupHintHtml,
    getStatusText,
    hasApiKey
  };
})();
