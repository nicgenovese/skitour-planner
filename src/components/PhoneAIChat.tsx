'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, RouteData, TourLogEntry, WeatherDay } from '@/types';
import type { ParsedBulletin } from '@/lib/avalanche-parser';

interface Props {
  onRouteGenerated: (route: RouteData) => void;
  bulletin: ParsedBulletin | null;
  weatherDays: WeatherDay[];
  tourLog: TourLogEntry[];
}

function parseRouteFromResponse(text: string): RouteData | null {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) return null;
  try {
    const data = JSON.parse(jsonMatch[1]);
    if (data.waypoints && Array.isArray(data.waypoints)) {
      return {
        name: data.name || 'Unnamed Route',
        waypoints: data.waypoints,
        dangerZones: data.dangerZones || [],
        totalElevation: data.totalElevation || 0,
        distance: data.distance || 0,
        estimatedTime: data.estimatedTime || '',
        difficulty: data.difficulty || '',
        keyInfo: data.keyInfo || '',
      };
    }
  } catch { /* ignore parse errors */ }
  return null;
}

function stripJsonBlock(text: string): string {
  return text.replace(/```json\s*[\s\S]*?```/g, '').trim();
}

export default function PhoneAIChat({ onRouteGenerated, bulletin, weatherDays, tourLog }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Grüezi! I\'m your ski tour planning assistant. Ask me to plan a tour, suggest routes based on conditions, or answer any questions about Swiss ski mountaineering.\n\nTry: "Plan a weekend tour near Zermatt" or "What\'s safe given the current avalanche conditions?"',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build context summaries
      let avalancheSummary = '';
      if (bulletin && bulletin.regions.length > 0) {
        avalancheSummary = bulletin.regions.slice(0, 5).map(r => {
          const maxLevel = Math.max(...r.dangerRatings.map(d => d.level));
          const problems = r.problems.map(p => p.type.replace(/_/g, ' ')).join(', ');
          return `${r.regionName}: Level ${maxLevel}${problems ? `, problems: ${problems}` : ''}`;
        }).join('\n');
      }

      let weatherSummary = '';
      if (weatherDays.length > 0) {
        weatherSummary = weatherDays.slice(0, 3).map(d =>
          `${d.date}: ${d.tempMin}°/${d.tempMax}°C, snow ${d.snowfall}cm, wind ${d.windSpeedMax}km/h`
        ).join('\n');
      }

      // Build message history (last 10 messages)
      const apiMessages = [...messages.filter(m => m.id !== 'welcome'), userMsg]
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          avalancheSummary,
          weatherSummary,
          tourLog: tourLog.map(t => ({
            name: t.name,
            date: t.date,
            difficulty: t.route.difficulty,
            rating: t.rating,
            elevation: t.route.totalElevation,
            participants: t.participants.join(', '),
            conditions: t.conditions,
            notes: t.notes,
          })),
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const content = data.content || 'Sorry, I could not generate a response.';
      const route = parseRouteFromResponse(content);

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: stripJsonBlock(content),
        route: route || undefined,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (route) {
        onRouteGenerated(route);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err.message || 'Failed to get response'}. Check your API key is set in .env.local.`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, bulletin, weatherDays, tourLog, onRouteGenerated]);

  const quickActions = [
    'Plan a tour near Davos',
    'What\'s safe this weekend?',
    'Easy tour for beginners',
    'Suggest a glacier tour',
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-[2rem] border-2 border-slate-700 overflow-hidden shadow-2xl">
      {/* Phone notch */}
      <div className="bg-black pt-2 pb-1 px-4">
        <div className="phone-notch" />
        <div className="flex items-center justify-between mt-2 mb-1">
          <h2 className="text-sm font-semibold text-white">Skitour AI</h2>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400' : 'bg-green-400'}`} />
            <span className="text-[10px] text-slate-400">{loading ? 'thinking...' : 'online'}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-3 py-2 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-slate-800 text-slate-200 rounded-bl-md'
              }`}
            >
              <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{msg.content}</p>

              {/* Route card */}
              {msg.route && (
                <div className="mt-2 bg-slate-700/50 rounded-xl p-2.5 border border-slate-600/50">
                  <p className="font-bold text-sm text-white">{msg.route.name}</p>
                  <div className="grid grid-cols-2 gap-1 mt-1.5 text-[11px]">
                    <span className="text-slate-400">Elevation: <span className="text-slate-200">{msg.route.totalElevation}m</span></span>
                    <span className="text-slate-400">Distance: <span className="text-slate-200">{msg.route.distance}km</span></span>
                    <span className="text-slate-400">Time: <span className="text-slate-200">{msg.route.estimatedTime}</span></span>
                    <span className="text-slate-400">Grade: <span className="text-slate-200">{msg.route.difficulty}</span></span>
                  </div>
                  <p className="text-[10px] text-blue-300 mt-1.5">Route shown on map</p>
                  {msg.route.dangerZones.length > 0 && (
                    <p className="text-[10px] text-orange-300 mt-0.5">
                      {msg.route.dangerZones.length} danger zone(s) flagged
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions (only when few messages) */}
      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => { setInput(action); }}
              className="text-[11px] bg-slate-800 text-blue-300 px-2.5 py-1 rounded-full border border-slate-700 hover:border-blue-500 hover:bg-slate-700 transition-colors"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 bg-black/50">
        <div className="flex items-center gap-2 bg-slate-800 rounded-full px-4 py-1">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about a tour..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none py-2"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="p-1.5 rounded-full bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Home indicator */}
      <div className="bg-black pb-2 flex justify-center">
        <div className="w-32 h-1 bg-slate-600 rounded-full" />
      </div>
    </div>
  );
}
