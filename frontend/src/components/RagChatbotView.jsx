import React, { useState } from 'react';
import axios from 'axios';
import { Bot, Send, Sparkles, BookOpen, CheckCircle } from 'lucide-react';

export default function RagChatbotView({ year = 2026, roundNumber = 1 }) {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello! I am your 2026 F1 Pitwall AI Assistant powered by LangChain, ChromaDB, and Gemini. Ask me anything about race telemetry, active aerodynamics regulations, driver strategies, or session standings.',
      sources: ['FastF1 Telemetry Engine', '2026 FIA Technical Regulations']
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputQuery.trim() || loading) return;

    const userText = inputQuery.trim();
    setInputQuery('');
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:8000/api/chatbot/query', {
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
          confidence: res.data.confidence
        }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Unable to process query at this moment. Please check backend connection.',
          sources: ['Error Handler']
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl border border-gray-800 shadow-2xl flex flex-col h-[600px] overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gray-950/80 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Bot size={22} />
          </div>
          <div>
            <h3 className="text-md font-bold text-white tracking-wider flex items-center gap-2 font-mono">
              F1 RAG PITWALL AI ASSISTANT
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                LANGCHAIN + CHROMADB + GEMINI
              </span>
            </h3>
            <p className="text-xs text-gray-400 font-mono">
              Context-Aware F1 Regulations & Telemetry Intelligence
            </p>
          </div>
        </div>
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
                  : 'bg-gray-900/90 text-gray-100 border-cyan-500/30 rounded-bl-none shadow-lg'
              }`}
            >
              <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-800/80 flex flex-wrap items-center gap-2 text-[10px] text-cyan-400">
                  <BookOpen size={12} />
                  <span>SOURCES:</span>
                  {msg.sources.map((src, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-gray-950 border border-gray-800 text-gray-300">
                      {src}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-900/90 text-cyan-400 p-4 rounded-2xl border border-cyan-500/30 font-mono text-xs flex items-center gap-2">
              <Sparkles size={16} className="animate-spin" />
              <span>SEARCHING CHROMADB VECTOR STORE & GENERATING RESPONSE...</span>
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
          placeholder="Ask about 2026 regulations, driver telemetry, or pit stop tactics..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/60"
        />
        <button
          type="submit"
          disabled={loading || !inputQuery.trim()}
          className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs transition-all shadow-lg shadow-cyan-600/30 disabled:opacity-50 flex items-center gap-2"
        >
          <Send size={14} />
          <span>QUERY</span>
        </button>
      </form>
    </div>
  );
}
