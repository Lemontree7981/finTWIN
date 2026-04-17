window.finTWINConfig = window.finTWINConfig || {};

window.finTWINConfig.chatApi = Object.assign(
  {
    enabled: false,
    transport: 'openai-chat-completions',
    apiUrl: '',
    model: '',
    apiKey: '',
    temperature: 0.35,
    maxTokens: 700,
    extraHeaders: {},
    systemPrompt: [
      'You are finTWIN AI, a concise financial scenario assistant inside a Monte Carlo simulator.',
      'Use the simulation context when it is provided.',
      'Keep answers practical and clear.',
      'Do not invent calculations that are not present in the supplied context.',
      'Do not produce code blocks or markdown tables.'
    ].join(' ')
  },
  window.finTWINConfig.chatApi || {}
);
