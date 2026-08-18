import React, { useState } from 'react';
import axios from 'axios';
import { Bot, Send, Sparkles, BookOpen, AlertTriangle, HelpCircle, User, Cpu } from 'lucide-react';

export default function RagChatbotView({ year = 2026, roundNumber = 1 }) {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Welcome to the CircuitVision AI Intelligence Assistant. I am connected to the FastF1 telemetry engine, ChromaDB regulation database, and 2026 technical specifications. Ask me anything about race results, championship standings, active aerodynamic rules, tire degradation, or track analysis.',
      sources: ['FastF1 Telemetry Engine', 'ChromaDB F1 Vector Store', '2026 FIA Technical Regulations'],
      unable_to_answer: false
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastWasGrounded, setLastWasGrounded] = useState(true);

  const suggestedQueries = [
    "Who won the Australian GP?",
    "Who leads the championship?",
    "What is active aerodynamics in 2026?",
    "What is an undercut strategy?",
    "Explain tire degradation factors",
    "What is Parc Fermé?",
    "Who won the 2026 Hungarian GP?"
  ];

  const sendQuery = async (queryText) => {
    if (!queryText.trim() || loading) return;

    const userText = queryText.trim();
    setInputQuery('');
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:8005/chat', {
        query: userText,
        year,
        round_number: roundNumber
      });

      setLastWasGrounded(res.data.is_grounded !== false);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: res.data.answer,
          sources: res.data.sources,
          confidence: res.data.confidence,
          is_grounded: res.data.is_grounded,
          unable_to_answer: res.data.unable_to_answer
        }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Unable to process query at this moment. Please check backend connection.',
          sources: ['Error Handler'],
          unable_to_answer: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    sendQuery(inputQuery);
  };

  return (
    <div className="bg-surface-container border border-surface-container-high rounded-xl shadow-2xl flex flex-col h-[720px] overflow-hidden">
      {/* Header */}
      <div className="p-5 bg-surface-container-lowest border-b border-surface-container-high flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-racing-red/10 border border-racing-red/30 flex items-center justify-center text-racing-red shadow-sm">
            <Cpu size={20} />
          </div>
          <div>
            <h3 className="font-display-lg text-base md:text-lg text-pure-white font-extrabold tracking-tight uppercase flex items-center gap-2">
              <span>CircuitVision AI Strategist</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-racing-red/10 text-racing-red border border-racing-red/30 font-label-bold uppercase tracking-wider">
                FastF1 + RAG
              </span>
            </h3>
            <p className="font-body-base text-xs text-aero-slate mt-0.5">
              Grounded 2026 telemetry data, Grand Prix results, and FIA technical regulations.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-high border border-surface-container-highest text-xs font-telemetry-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-f1-pulse"></span>
          <span className="text-tertiary text-[11px] uppercase tracking-wider font-bold">CHROMADB READY</span>
        </div>
      </div>

      {/* Suggested Query Pills */}
      <div className="px-4 py-3 bg-surface-container-low border-b border-surface-container-high flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-aero-slate shrink-0 font-label-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <HelpCircle size={13} className="text-racing-red" /> Suggested:
        </span>
        {suggestedQueries.map((sq, i) => (
          <button
            key={i}
            onClick={() => sendQuery(sq)}
            disabled={loading}
            className="px-3 py-1.5 rounded-full bg-surface-container-lowest hover:bg-surface-container-highest text-tertiary hover:text-pure-white border border-surface-container-high hover:border-racing-red/40 transition-all shrink-0 cursor-pointer disabled:opacity-50 font-body-base text-xs"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Messages List */}
      <div className="flex-1 p-5 md:p-6 overflow-y-auto space-y-4 font-body-base text-sm">
        {messages.map((msg, idx) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={idx}
              className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-racing-red/10 border border-racing-red/30 flex items-center justify-center text-racing-red shrink-0 mt-1">
                  <Bot size={16} />
                </div>
              )}

              <div
                className={`max-w-[85%] md:max-w-[75%] p-4 rounded-xl border ${
                  isUser
                    ? 'bg-racing-red text-white border-racing-red/40 rounded-tr-none shadow-lg shadow-racing-red/20 font-medium'
                    : msg.unable_to_answer
                    ? 'bg-surface-container-high text-amber-200 border-amber-600/40 rounded-tl-none shadow-lg'
                    : 'bg-surface-container-lowest text-on-surface border-surface-container-high rounded-tl-none shadow-md'
                }`}
              >
                {/* Badge for Unable to Answer */}
                {msg.unable_to_answer && (
                  <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-label-bold text-[10px] uppercase tracking-wider">
                    <AlertTriangle size={12} />
                    <span>Out of Vector Scope / Uncontained</span>
                  </div>
                )}

                <p className="leading-relaxed whitespace-pre-wrap font-body-base text-sm">{msg.text}</p>

                {/* Source attribution & confidence badge */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-surface-container-high flex flex-wrap items-center justify-between gap-2 text-[11px] font-telemetry-mono text-tertiary">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <BookOpen size={12} className="text-racing-red" />
                      <span className="font-bold text-aero-slate">SOURCES:</span>
                      {msg.sources.map((src, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-surface-container-high border border-surface-container-highest text-tertiary">
                          {src}
                        </span>
                      ))}
                    </div>

                    {msg.confidence !== undefined && (
                      <span className="text-aero-slate">
                        Confidence: <strong className="text-emerald-400">{(msg.confidence * 100).toFixed(0)}%</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-surface-container-highest flex items-center justify-center text-pure-white shrink-0 mt-1">
                  <User size={16} />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-racing-red/10 border border-racing-red/30 flex items-center justify-center text-racing-red shrink-0 mt-1">
              <Bot size={16} />
            </div>
            <div className="bg-surface-container-lowest text-tertiary p-4 rounded-xl border border-surface-container-high font-telemetry-mono text-xs flex items-center gap-2.5">
              <Sparkles size={16} className="animate-spin text-racing-red" />
              <span>
                {lastWasGrounded
                  ? 'SEARCHING CHROMADB VECTOR STORE & SYNTHESIZING TELEMETRY...'
                  : 'THINKING...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-4 bg-surface-container-lowest border-t border-surface-container-high flex items-center gap-3">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask about 2026 race results, standings, telemetry, active aero rules, or F1 glossary..."
          className="flex-1 bg-surface-container border border-surface-container-high rounded-lg px-4 py-3 text-sm font-body-base text-white placeholder-aero-slate focus:outline-none focus:border-racing-red transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !inputQuery.trim()}
          className="px-5 py-3 rounded-lg bg-racing-red hover:bg-inverse-primary text-white font-label-bold text-xs uppercase tracking-wider transition-all border-t border-white/20 shadow-md shadow-racing-red/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer active:scale-95"
        >
          <Send size={14} />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
}
