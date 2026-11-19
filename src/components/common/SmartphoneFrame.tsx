/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Wifi, Battery, Signal } from 'lucide-react';

interface SmartphoneFrameProps {
  children: React.ReactNode;
  activeScreenTitle?: string;
  stepIndicator?: string;
}

export const SmartphoneFrame: React.FC<SmartphoneFrameProps> = ({
  children,
  activeScreenTitle = 'AUTO SHOP',
  stepIndicator,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-4 sm:py-8">
      {/* Smartphone Outer Chassis */}
      <div className="w-full max-w-[420px] rounded-[48px] bg-slate-950 p-3 sm:p-4 shadow-2xl ring-12 ring-slate-800/80 border-4 border-slate-700/60 relative overflow-hidden">
        {/* Dynamic Island / Top Speaker Notch */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-30 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-slate-900 mr-2 ring-1 ring-slate-800" />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-950" />
        </div>

        {/* Screen Bezel Container */}
        <div className="w-full rounded-[38px] bg-slate-50 dark:bg-slate-900 overflow-hidden border border-slate-800 relative flex flex-col min-h-[720px] max-h-[820px]">
          {/* Top Mobile Status Bar (9:41, 5G, Battery) */}
          <div className="h-9 bg-slate-900 text-white px-6 pt-1 flex items-center justify-between text-[11px] font-bold z-20 select-none">
            <span className="font-mono">09:41</span>
            <div className="flex items-center gap-1.5 text-white/90">
              <Signal className="w-3 h-3" />
              <span className="text-[9px] font-mono">5G</span>
              <Battery className="w-4 h-4" />
            </div>
          </div>

          {/* AUTO SHOP In-App Mobile Top Bar */}
          <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between border-b border-slate-800/80 z-20 shadow-xs">
            <div className="flex items-center gap-2">
              <img
                src="/assets/aistudio/M1_AUTO_LOGO_3c381c58.jpg"
                alt="AUTO SHOP"
                className="h-8 w-auto rounded-md object-contain"
              />
              <span className="text-sm font-black tracking-wider text-white">
                {activeScreenTitle}
              </span>
            </div>

            {stepIndicator && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-800/60">
                {stepIndicator}
              </span>
            )}
          </div>

          {/* Smartphone Inner Viewport (Scrollable Screen) */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-4">
            {children}
          </div>

          {/* Mobile Bottom Home Bar Indicator */}
          <div className="h-5 bg-slate-900 flex items-center justify-center shrink-0">
            <div className="w-32 h-1 bg-white/40 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
