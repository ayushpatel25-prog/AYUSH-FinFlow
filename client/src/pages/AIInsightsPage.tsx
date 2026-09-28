import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Send,
  Bot,
  User as UserIcon,
  X,
  Lightbulb,
  CheckCircle,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { api } from '../api/client.js';
import { Button } from '../components/common/Button.js';
import { Card } from '../components/common/Card.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';
import type { AIInsight } from '../types/index.js';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  proposal?: any;
}

export const AIInsightsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [inputQuery, setInputQuery] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'assistant',
      text: 'Hello! I am FinFlow AI, your private financial intelligence assistant. I analyze your actual database records to answer questions without hallucinating. You can ask about your food spending, trip progress, upcoming bills, or who owes you money.',
    },
  ]);

  const { data: insights = [], isLoading: isLoadingInsights } = useQuery({
    queryKey: ['ai-insights'],
    queryFn: api.ai.getInsights,
  });

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isSending) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsSending(true);

    try {
      const response = await api.ai.chat(textToSend);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: response.reply,
        proposal: response.proposal,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: `Unable to process query: ${err.message || 'Service unavailable'}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleApplyProposal = async (proposal: any) => {
    try {
      if (proposal.action === 'CREATE_BUDGET') {
        await api.budgets.create({
          amountPaise: proposal.amountPaise,
          period: proposal.period,
        });
        queryClient.invalidateQueries({ queryKey: ['budgets'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        alert('Budget successfully created!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismissInsight = async (id: string) => {
    try {
      await api.ai.dismissInsight(id);
      queryClient.invalidateQueries({ queryKey: ['ai-insights'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      console.error(err);
    }
  };

  const sampleQuestions = [
    'How much did I spend on food this month?',
    'Who owes me money?',
    'Where am I spending the most?',
    'What is my current trip progress?',
    'What bills are coming up?',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
            Explainable AI
          </span>
          <span className="text-xs text-slate-400">• Database grounded, zero hallucination</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">AI Financial Assistant & Insights</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: AI Assistant Chat */}
        <Card className="lg:col-span-2 flex flex-col h-[650px] p-0 overflow-hidden border-purple-500/30">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">FinFlow Intelligence Agent</h3>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected to your personal relational ledger
                </p>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                      : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/80'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {/* Action Proposal Widget */}
                  {msg.proposal && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-purple-500/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-300">{msg.proposal.title}</span>
                        <span className="font-bold text-white">{msg.proposal.amount}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Category: {msg.proposal.category} ({msg.proposal.period})
                      </p>
                      <Button
                        size="sm"
                        variant="purple"
                        onClick={() => handleApplyProposal(msg.proposal)}
                        className="w-full text-xs"
                      >
                        Confirm & Create Budget
                      </Button>
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                    U
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="flex gap-3 items-center text-xs text-purple-400 italic">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                </div>
                <span>Analyzing your recent transactions and database records...</span>
              </div>
            )}
          </div>

          {/* Suggested Prompts */}
          <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none">
            {sampleQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(q)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask about spending, debts, budgets, trips..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <Button type="submit" variant="purple" size="md" disabled={isSending}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>

        {/* Right Column: Active Anomaly & Risk Insights Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Proactive Signals & Anomalies</span>
            </h3>
            <span className="text-[10px] text-slate-400">{insights.length} active</span>
          </div>

          {isLoadingInsights ? (
            <LoadingSkeleton rows={3} height="h-32" />
          ) : insights.length === 0 ? (
            <Card className="text-center py-12">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-white">All clear!</p>
              <p className="text-[11px] text-slate-400 mt-1">No spending anomalies or overdue loan risks detected.</p>
            </Card>
          ) : (
            insights.map((insight: AIInsight) => (
              <Card
                key={insight.id}
                className="p-4 border-purple-500/20 bg-slate-900/90 relative group hover:border-purple-500/40 transition-all"
              >
                <button
                  onClick={() => handleDismissInsight(insight.id)}
                  className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 p-1"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1.5 mb-1 text-[10px] uppercase font-bold text-purple-400 tracking-wider">
                  <span>{insight.type.replace('_', ' ')}</span>
                  <span>•</span>
                  <span>{insight.period}</span>
                </div>

                <h4 className="text-xs font-bold text-white pr-5">{insight.title}</h4>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{insight.explanation}</p>

                <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-indigo-300 font-medium">
                  💡 {insight.suggestedAction}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
