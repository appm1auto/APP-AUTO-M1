/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Smartphone, CheckCircle, RefreshCw, X, MessageSquare } from 'lucide-react';
import { auth } from '../../services/auth';

interface SmsVerificationModalProps {
  phone: string;
  channel: 'SMS' | 'WhatsApp';
  initialCode: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const SmsVerificationModal: React.FC<SmsVerificationModalProps> = ({
  phone,
  channel,
  initialCode,
  onSuccess,
  onClose,
}) => {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [currentChannel, setCurrentChannel] = useState<'SMS' | 'WhatsApp'>(channel);
  const [showSimulatedBanner, setShowSimulatedBanner] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = auth.verifyCode(phone, code);
    if (result.success) {
      onSuccess();
    } else {
      setError(result.message);
    }
  };

  const handleResend = (newChannel: 'SMS' | 'WhatsApp') => {
    if (resendCooldown > 0) return;
    setCurrentChannel(newChannel);
    const res = auth.requestVerificationCode(phone);
    setCode(res.code);
    setShowSimulatedBanner(true);
    setResendCooldown(30);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Validação por {currentChannel}
            </h3>
            <p className="text-xs text-slate-500">
              Enviamos um código de 6 dígitos para <strong>{phone}</strong>
            </p>
          </div>
        </div>

        {/* Real Simulation Banner (so user doesn't get stuck) */}
        {showSimulatedBanner && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3 animate-in slide-in-from-top-2">
            <MessageSquare className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-emerald-900 dark:text-emerald-200">
                Notificação AUTO SHOP ({currentChannel}):
              </span>
              <p className="text-emerald-800 dark:text-emerald-300 mt-0.5">
                Seu código de segurança é <strong className="font-mono text-sm underline">{initialCode}</strong>.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleVerify} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Código de Confirmação (6 dígitos)
            </label>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full text-center tracking-[0.5em] font-mono text-2xl font-bold py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              placeholder="000000"
              autoFocus
              required
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 p-2.5 rounded-lg border border-red-200 dark:border-red-900">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition active:scale-98"
          >
            Confirmar e Acessar
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Não recebeu o código?</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleResend('WhatsApp')}
              disabled={resendCooldown > 0}
              className={`font-semibold text-blue-600 hover:underline ${
                resendCooldown > 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              WhatsApp {resendCooldown > 0 && `(${resendCooldown}s)`}
            </button>
            <span>·</span>
            <button
              onClick={() => handleResend('SMS')}
              disabled={resendCooldown > 0}
              className={`font-semibold text-blue-600 hover:underline ${
                resendCooldown > 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              SMS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
