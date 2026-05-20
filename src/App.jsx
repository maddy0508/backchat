import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DETECT_INSTRUCTIONS = `
PART 1 — PSYCHOLOGICAL THREAT ANALYSIS:
Carefully scan the conversation. Only flag what is clearly evidenced by specific words or behaviours in the transcript. Do not hallucinate.

MANIPULATION: Gaslighting, DARVO, love bombing, triangulation, moving goalposts, guilt tripping, projection, blame shifting, minimisation, stonewalling, future faking, coercive control.
DECEPTION SIGNALS: Excessive qualifiers, unprompted over-explanation, deflection, timeline inconsistencies, distancing language, minimising significant events.
LOGICAL FALLACIES: Straw man, ad hominem, false dichotomy, appeal to authority, circular reasoning, red herring, slippery slope, gish gallop.
PERSUASION ABUSE: Artificial scarcity, false social proof, reciprocity traps, foot-in-door, authority impersonation, anchoring.
NEGOTIATION TRAPS: Nibbling, good cop / bad cop, bogey tactic, highball/lowball, ultimatum, false deadline.
`;

const MODES = {
  argument: {
    label: 'ARGUMENT',
    icon: '⚡',
    accent: 'text-red-400',
    bgAccent: 'bg-red-500/10',
    borderAccent: 'border-red-500/30',
    system: `You are a strategic debate coach and forensic conversation analyst. ${DETECT_INSTRUCTIONS}\nPART 2 — TACTICAL RESPONSES: Generate exactly 3 sharp but safe responses the user can deliver right now. Use Socratic questioning, accusation audit, strategic reframing, tactical concession, fallacy naming, mirroring, calibrated questions, strategic silence, emotion labelling, and turning contradictions back carefully.`
  },
  meeting: {
    label: 'MEETING',
    icon: '📊',
    accent: 'text-blue-400',
    bgAccent: 'bg-blue-500/10',
    borderAccent: 'border-blue-500/30',
    system: `You are an executive communication strategist and organisational psychologist. ${DETECT_INSTRUCTIONS}\nPART 2 — TACTICAL RESPONSES: Generate exactly 3 professional responses for this meeting. Use agenda control, high-value questions, strategic bridging, pre-empting objections, coalition language, concise interruption, and controlled authority.`
  },
  negotiation: {
    label: 'NEGOTIATE',
    icon: '🎯',
    accent: 'text-orange-400',
    bgAccent: 'bg-orange-500/10',
    borderAccent: 'border-orange-500/30',
    system: `You are a negotiation coach combining tactical empathy, principled negotiation, and behavioural economics. ${DETECT_INSTRUCTIONS}\nPART 2 — TACTICAL RESPONSES: Generate exactly 3 strategic responses. Use labelling, mirroring, calibrated questions, accusation audit, BATNA-aware positioning, reanchoring, and calm walkaway leverage.`
  },
  interview: {
    label: 'INTERVIEW',
    icon: '🎓',
    accent: 'text-teal-300',
    bgAccent: 'bg-teal-400/10',
    borderAccent: 'border-teal-400/30',
    system: `You are an executive recruiter and interview coach. ${DETECT_INSTRUCTIONS}\nPART 2 — TACTICAL RESPONSES: Generate exactly 3 confident interview responses. Use STAR framing, bridging to strengths, reframing gaps, strategic/system thinking, values mirroring, and strong counter-questions.`
  },
  sales: {
    label: 'SALES',
    icon: '💰',
    accent: 'text-yellow-300',
    bgAccent: 'bg-yellow-400/10',
    borderAccent: 'border-yellow-400/30',
    system: `You are a sales conversation strategist. ${DETECT_INSTRUCTIONS}\nPART 2 — TACTICAL RESPONSES: Generate exactly 3 responses to advance the sales conversation or handle objections. Use SPIN questions, ROI reframing, trial closes, objection handling, pattern interrupts, and ethical urgency.`
  },
  casual: {
    label: 'CASUAL',
    icon: '💬',
    accent: 'text-green-300',
    bgAccent: 'bg-green-400/10',
    borderAccent: 'border-green-400/30',
    system: `You are a socially intelligent conversation coach. ${DETECT_INSTRUCTIONS}\nPART 2 — TACTICAL RESPONSES: Generate exactly 3 natural, useful replies. Use active listening, curiosity, light humour, reciprocity, reframing, common ground, tone matching, and graceful topic transitions.`
  }
};

const THREAT_LEVELS = {
  none: { label: 'CLEAR', color: 'text-slate-400', bg: 'bg-slate-900/60', border: 'border-slate-800', dot: 'bg-slate-500' },
  low: { label: 'LOW RISK', color: 'text-yellow-300', bg: 'bg-yellow-900/20', border: 'border-yellow-900/50', dot: 'bg-yellow-300' },
  medium: { label: 'MEDIUM THREAT', color: 'text-orange-400', bg: 'bg-orange-900/20', border: 'border-orange-900/50', dot: 'bg-orange-400' },
  high: { label: 'HIGH THREAT', color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-900/50', dot: 'bg-red-400' }
};

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function buildContext(entries, interim) {
  const base = entries.map((entry) => `[${entry.ts}] ${entry.text}`).join('\n');
  if (interim?.trim()) {
    return `${base}\n[interim] ${interim.trim()}`.trim();
  }
  return base.trim();
}

function createEntry(text) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: text.trim(),
    ts: new Date().toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  };
}

function normaliseThreat(value) {
  const clean = String(value || 'none').toLowerCase();
  return ['none', 'low', 'medium', 'high'].includes(clean) ? clean : 'none';
}

function Waveform({ active, accent }) {
  const bars = [5, 9, 6, 12, 8, 14, 7, 10, 5, 8];
  return (
    <div className="flex h-5 items-end gap-[3px]">
      {bars.map((height, index) => (
        <span
          key={index}
          className={`w-[3px] rounded-full ${active ? accent.replace('text-', 'bg-') : 'bg-slate-700'}`}
          style={{
            height: `${height}px`,
            animation: active ? `soft-pulse ${0.7 + (index % 4) * 0.16}s infinite ease-in-out` : 'none'
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState('argument');
  const [isListening, setIsListening] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [entries, setEntries] = useState([]);
  const [interim, setInterim] = useState('');
  const [manual, setManual] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const latestContextHashRef = useRef('');
  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  const modeConfig = MODES[mode];
  const threatKey = normaliseThreat(analysis?.threat_level);
  const threat = THREAT_LEVELS[threatKey];

  const context = useMemo(() => buildContext(entries, interim), [entries, interim]);
  const hasContext = context.trim().length > 0;

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setMicOk(Boolean(SpeechRecognition));

    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.stop();
        } catch {
          // ignored cleanup
        }
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
      clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isListening) {
      return undefined;
    }

    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isListening]);

  const pushEntry = useCallback((text) => {
    const clean = text.trim();
    if (!clean) return;
    setEntries((current) => [...current, createEntry(clean)]);
  }, []);

  const runAnalysis = useCallback(async (currentContext, currentMode) => {
    const clean = currentContext.trim();
    if (clean.length < 8) return;

    const hash = `${currentMode}:${clean}`;
    if (latestContextHashRef.current === hash) return;
    latestContextHashRef.current = hash;

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsAnalysing(true);
    setError('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          mode: currentMode,
          system: MODES[currentMode].system,
          context: clean
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Analysis failed.');
      }

      setAnalysis(payload.analysis || null);
      setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setError(requestError.message || 'Could not analyse the conversation.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsAnalysing(false);
      }
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);

    if (!hasContext) return undefined;

    debounceRef.current = window.setTimeout(() => {
      runAnalysis(context, mode);
    }, entries.length <= 1 ? 900 : 1800);

    return () => window.clearTimeout(debounceRef.current);
  }, [context, entries.length, hasContext, mode, runAnalysis]);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    setError('');

    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Use manual input.');
      return;
    }

    shouldListenRef.current = true;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-AU';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const transcript = event.results[index][0]?.transcript || '';
          if (event.results[index].isFinal) {
            finalText += transcript;
          } else {
            interimText += transcript;
          }
        }

        if (finalText.trim()) {
          pushEntry(finalText);
          setInterim('');
        } else {
          setInterim(interimText);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          shouldListenRef.current = false;
          setError('Microphone access was blocked. Allow mic access or use manual input.');
          setIsListening(false);
        } else if (event.error !== 'no-speech') {
          setError(`Microphone error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (!shouldListenRef.current) return;
        window.setTimeout(() => {
          if (!shouldListenRef.current || !recognitionRef.current) return;
          try {
            recognitionRef.current.start();
          } catch {
            // mobile browsers can briefly reject restart; next manual start is safe
          }
        }, 350);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      shouldListenRef.current = false;
      setIsListening(false);
      setError('Could not start microphone. It may already be in use.');
    }
  }, [pushEntry]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch {
        // ignored
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterim('');
  }, []);

  const addManual = useCallback(() => {
    const clean = manual.trim();
    if (!clean) return;
    pushEntry(clean);
    setManual('');
  }, [manual, pushEntry]);

  const copyText = useCallback(async (text, id) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setError('Clipboard copy failed. Select and copy manually.');
    }
  }, []);

  const clearSession = useCallback(() => {
    stopListening();
    setEntries([]);
    setInterim('');
    setManual('');
    setAnalysis(null);
    setSuggestions([]);
    setElapsed(0);
    setError('');
    latestContextHashRef.current = '';
  }, [stopListening]);

  const exportSession = useCallback(() => {
    const lines = [
      'BACKCHAT SESSION LOG',
      '====================',
      `Mode: ${modeConfig.label}`,
      `Date: ${new Date().toLocaleString('en-AU')}`,
      `Duration: ${formatTime(elapsed)}`,
      '',
      'THREAT INTEL',
      '------------',
      `Threat: ${threat.label}`,
      `Assessment: ${analysis?.assessment || 'No analysis recorded.'}`,
      '',
      'TACTICS DETECTED',
      '----------------',
      ...(analysis?.tactics_detected?.length
        ? analysis.tactics_detected.map((item) => `[${String(item.severity).toUpperCase()}] ${item.name}: ${item.evidence}`)
        : ['None recorded.']),
      '',
      'SUGGESTIONS',
      '-----------',
      ...(suggestions.length
        ? suggestions.map((item, index) => `${index + 1}. [${item.tactic}] ${item.text}\n   ${item.subtext}`)
        : ['None recorded.']),
      '',
      'TRANSCRIPT',
      '----------',
      ...(entries.length ? entries.map((entry) => `[${entry.ts}] ${entry.text}`) : ['No transcript entries.'])
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backchat-log-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }, [analysis, elapsed, entries, modeConfig.label, suggestions, threat.label]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col overflow-hidden bg-[#07070e] text-slate-200 shadow-2xl shadow-black/60">
      <section className="border-b border-slate-800/70 bg-[#07070e]/95 px-4 pb-3 pt-5 backdrop-blur">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-[0.18em] text-white">
              BACK<span className={modeConfig.accent}>CHAT</span>
            </h1>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.24em] text-slate-500">Tactical Response Engine</p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              {isListening ? <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" /></span> : <span className="h-2 w-2 rounded-full bg-slate-700" />}
              <span className={`font-mono text-xs font-bold ${isListening ? 'text-red-400' : 'text-slate-500'}`}>{formatTime(elapsed)}</span>
            </div>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">{entries.length} entries</p>
          </div>
        </div>

        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {Object.entries(MODES).map(([key, item]) => (
            <button
              type="button"
              key={key}
              onClick={() => {
                setMode(key);
                latestContextHashRef.current = '';
                if (hasContext) runAnalysis(context, key);
              }}
              className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${mode === key ? `${item.accent} ${item.bgAccent} ${item.borderAccent}` : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="border-b border-slate-800/70 bg-[#0a0a14] px-4 py-2">
        <div className="flex min-h-9 items-center gap-3">
          <Waveform active={isListening || isAnalysing} accent={modeConfig.accent} />
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isListening ? modeConfig.accent : 'text-slate-500'}`}>
            {isListening ? 'Listening' : micOk ? 'System armed' : 'Manual mode'}
          </span>
          <span className="ml-auto truncate font-mono text-[10px] italic text-slate-500">
            {isAnalysing ? 'Live analysis…' : interim ? `“${interim}”` : 'Transcript hidden'}
          </span>
        </div>
      </section>

      {error && (
        <section className="flex items-center justify-between border-b border-red-900/50 bg-red-950/40 px-4 py-2">
          <span className="font-mono text-[11px] text-red-300">⚠ {error}</span>
          <button type="button" onClick={() => setError('')} className="px-2 text-lg leading-none text-red-300">×</button>
        </section>
      )}

      <section className={`m-4 mb-2 rounded-2xl border ${threat.border} ${threat.bg} shadow-glow`}>
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">👁️‍🗨️</span>
            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${threat.color}`}>Live Detections</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-black/30 px-2 py-1">
            <span className={`h-1.5 w-1.5 rounded-full ${threat.dot}`} />
            <span className={`text-[9px] font-black uppercase tracking-wider ${threat.color}`}>{threat.label}</span>
          </div>
        </div>

        <div className="max-h-[28vh] overflow-y-auto px-4 py-3 custom-scrollbar">
          <p className="mb-3 border-b border-white/5 pb-3 font-mono text-[11px] leading-relaxed text-slate-300">
            {analysis?.assessment || 'Listening for clear evidence of pressure tactics, manipulation patterns, fallacies, or negotiation traps.'}
          </p>

          {analysis?.tactics_detected?.length ? (
            <div className="space-y-2">
              {analysis.tactics_detected.map((item, index) => (
                <article key={`${item.name}-${index}`} className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-100">{item.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${item.severity === 'high' ? 'border-red-400/30 bg-red-400/10 text-red-300' : item.severity === 'medium' ? 'border-orange-400/30 bg-orange-400/10 text-orange-300' : 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300'}`}>{item.severity}</span>
                  </div>
                  <p className="font-mono text-[10px] leading-relaxed text-slate-400">{item.evidence}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-600">No supported tactics detected yet.</p>
          )}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col px-4 pb-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Responses to say now</h2>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isAnalysing ? modeConfig.accent : 'text-slate-600'}`}>{isAnalysing ? 'Updating' : `${suggestions.length} ready`}</span>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2 custom-scrollbar">
          {suggestions.length ? suggestions.map((suggestion, index) => (
            <article key={`${suggestion.tactic}-${index}`} className="rounded-2xl border border-slate-800 bg-[#0f0f1a] p-4 shadow-xl shadow-black/20">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className={`rounded-full border border-white/5 bg-black/30 px-2 py-1 text-[9px] font-black uppercase tracking-wider ${modeConfig.accent}`}>{suggestion.tactic}</span>
                <button type="button" onClick={() => copyText(suggestion.text, index)} className={`rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-wider transition ${copiedId === index ? 'border-green-400/40 bg-green-400/10 text-green-300' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>{copiedId === index ? 'Copied' : 'Copy'}</button>
              </div>
              <p className="mb-3 text-[15px] font-semibold leading-snug text-slate-50">“{suggestion.text}”</p>
              <p className="border-t border-slate-800/80 pt-3 font-mono text-[10px] leading-relaxed text-slate-400">↳ {suggestion.subtext}</p>
            </article>
          )) : (
            <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-6 text-center">
              <div className="mb-3 text-5xl grayscale">{modeConfig.icon}</div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-slate-400">Awaiting signal</p>
              <p className="max-w-[240px] font-mono text-[10px] leading-relaxed text-slate-500">Start recording or type a line. Backchat will generate detections and response suggestions automatically.</p>
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-slate-800 bg-[#0a0a14] px-4 py-3">
        <div className="flex gap-2">
          <input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addManual();
            }}
            placeholder="Type conversation manually…"
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-[#151522] px-4 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-slate-500"
          />
          <button type="button" onClick={addManual} disabled={!manual.trim()} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 font-black text-slate-300 transition hover:bg-slate-800 disabled:opacity-40">+</button>
        </div>
      </section>

      <section className="safe-bottom flex gap-2 bg-[#07070e] px-4 pt-3">
        {!isListening ? (
          <button type="button" onClick={startListening} disabled={!micOk} className={`rounded-2xl border px-4 py-3.5 text-xs font-black uppercase tracking-wider transition active:scale-95 ${micOk ? `border-slate-700 bg-slate-900 text-white ${modeConfig.borderAccent}` : 'border-slate-900 bg-slate-950 text-slate-700'}`}><span className={modeConfig.accent}>●</span> Rec</button>
        ) : (
          <button type="button" onClick={stopListening} className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3.5 text-xs font-black uppercase tracking-wider text-red-300 transition active:scale-95">■ Stop</button>
        )}

        <button type="button" onClick={() => runAnalysis(context, mode)} disabled={!hasContext || isAnalysing} className="flex-1 rounded-2xl border border-slate-800 bg-[#131320] px-4 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#1a1a2e] disabled:cursor-not-allowed disabled:opacity-40">{isAnalysing ? 'Analysing…' : 'Refresh Intel'}</button>

        <button type="button" onClick={() => setDrawerOpen(true)} className="rounded-2xl border border-slate-800 bg-slate-900 px-3.5 py-3.5 text-xs font-black text-slate-300">TX</button>
        <button type="button" onClick={exportSession} className="rounded-2xl border border-slate-800 bg-slate-900 px-3.5 py-3.5 text-xs font-black text-slate-300">↓</button>
        <button type="button" onClick={clearSession} className="rounded-2xl border border-slate-800 bg-slate-900 px-3.5 py-3.5 text-xs font-black text-slate-500 hover:text-red-300">×</button>
      </section>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-0 backdrop-blur-sm" onClick={() => setDrawerOpen(false)}>
          <section className="mx-auto max-h-[72vh] w-full max-w-md rounded-t-3xl border border-slate-800 bg-[#0b0b14] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.22em] text-slate-300">Hidden transcript buffer</h3>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg bg-slate-900 px-3 py-1 text-sm text-slate-400">Close</button>
            </div>
            <div className="max-h-[56vh] overflow-y-auto pr-1 custom-scrollbar">
              {entries.length ? entries.map((entry) => (
                <div key={entry.id} className="border-b border-white/5 py-2">
                  <p className="mb-1 font-mono text-[9px] text-slate-600">{entry.ts}</p>
                  <p className="text-[13px] leading-relaxed text-slate-300">{entry.text}</p>
                </div>
              )) : <p className="py-8 text-center font-mono text-[10px] uppercase tracking-wider text-slate-600">No transcript yet.</p>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
