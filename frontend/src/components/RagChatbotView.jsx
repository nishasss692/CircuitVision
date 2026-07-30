import React, { useState } from 'react';
import axios from 'axios';
import { Bot, Send, Sparkles, BookOpen, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

export default function RagChatbotView({ year = 2026, roundNumber = 1 }) {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello! I am your 2026 F1 Pitwall AI Assistant powered by LangChain, ChromaDB, and Gemini. Ask me anything about race results, standings, active aerodynamics regulations, or F1 terminology.',
      sources: ['FastF1 Telemetry Engine', 'ChromaDB F1 Vector Store', '2026 FIA Technical Regulations'],
      unable_to_answer: false
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const suggestedQueries = [
    "Who's leading the Drivers' Championship?",
    "Who won the Australian GP?",
    "What is Active Aero X-Mode?",
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
      const res = await axios.post('http://localhost:8000/chat', {
        query: userText,
        year,
        round_number: roundNumber
      });

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
    <div className="glass-panel rounded-2xl border border-gray-800 shadow-2xl flex flex-col h-[650px] overflow-hidden bg-gray-950/80">
      {/* Header */}
      <div className="p-4 bg-gray-950/90 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Bot size={24} />
          </div>
          <div>
            <h3 className="text-md font-bold text-white tracking-wider flex items-center gap-2 font-mono">
              F1 RAG PITWALL AI ASSISTANT
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">
                LANGCHAIN + CHROMADB + GEMINI
              </span>
            </h3>
            <p className="text-xs text-gray-400 font-mono">
              Grounded F1 2026 Season Data & Regulation Knowledge Retrieval
            </p>
          </div>
        </div>
      </div>

      {/* Suggested Query Pills */}
      <div className="p-3 bg-gray-900/60 border-b border-gray-800/80 flex items-center gap-2 overflow-x-auto text-[11px] font-mono">
        <span className="text-gray-400 shrink-0 font-bold flex items-center gap-1">
          <HelpCircle size={13} className="text-cyan-400" /> Suggested:
        </span>
        {suggestedQueries.map((sq, i) => (
          <button
            key={i}
            onClick={() => sendQuery(sq)}
            disabled={loading}
            className="px-3 py-1 rounded-full bg-gray-950 hover:bg-cyan-950 hover:text-cyan-300 text-gray-300 border border-gray-800 hover:border-cyan-500/40 transition-all shrink-0 cursor-pointer disabled:opacity-50"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Messages List */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 font-mono text-xs">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-2xl border ${
                msg.sender === 'user'
                  ? 'bg-red-600/90 text-white border-red-500/50 rounded-br-none shadow-lg shadow-red-600/20'
                  : msg.unable_to_answer
                  ? 'bg-amber-950/40 text-amber-200 border-amber-600/40 rounded-bl-none shadow-lg'
                  : 'bg-gray-900/90 text-gray-100 border-cyan-500/30 rounded-bl-none shadow-lg'
              }`}
            >
              {/* Badge for Unable to Answer */}
              {msg.unable_to_answer && (
                <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-[10px]">
                  <AlertTriangle size={12} />
                  <span>DATA UNCONTAINED / UNABLE TO ANSWER</span>
                </div>
              )}

              <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

              {/* Source attribution & confidence badge */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px] text-cyan-400">
                  <div className="flex items-center gap-1.5">
                    <BookOpen size={12} />
                    <span className="font-bold">SOURCES:</span>
                    {msg.sources.map((src, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-gray-950 border border-gray-800 text-gray-300">
                        {src}
                      </span>
                    ))}
                  </div>

                  {msg.confidence !== undefined && (
                    <span className="text-gray-400">
                      Confidence: <strong className="text-emerald-400">{(msg.confidence * 100).toFixed(0)}%</strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-900/90 text-cyan-400 p-4 rounded-2xl border border-cyan-500/30 font-mono text-xs flex items-center gap-2">
              <Sparkles size={16} className="animate-spin" />
              <span>SEARCHING CHROMADB VECTOR STORE & GROUNDING RESPONSE...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-4 bg-gray-950/90 border-t border-gray-800 flex items-center gap-3">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask about 2026 race results, standings, active aero rules, or F1 glossary..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/60"
        />
        <button
          type="submit"
          disabled={loading || !inputQuery.trim()}
          className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs transition-all shadow-lg shadow-cyan-600/30 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
        >
          <Send size={14} />
          <span>QUERY</span>
        </button>
      </form>
    </div>
  );
}

