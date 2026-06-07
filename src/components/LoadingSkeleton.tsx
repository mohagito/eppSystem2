import React from 'react';

export function CardSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-4 w-28 bg-slate-800 rounded"></div>
        <div className="h-8 w-8 bg-slate-800 rounded-lg"></div>
      </div>
      <div className="space-y-2">
        <div className="h-8 w-16 bg-slate-800 rounded"></div>
        <div className="h-3 w-36 bg-slate-800 rounded"></div>
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 animate-pulse">
      <div className="flex justify-between items-center pb-4 border-b border-slate-800">
        <div className="h-6 w-32 bg-slate-800 rounded"></div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-slate-800 rounded-lg"></div>
          <div className="h-9 w-28 bg-slate-800 rounded-lg"></div>
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div key={idx} className="flex justify-between items-center py-2">
            <div className="h-5 w-1/4 bg-slate-800 rounded"></div>
            <div className="h-5 w-1/6 bg-slate-800 rounded"></div>
            <div className="h-5 w-1/5 bg-slate-800 rounded"></div>
            <div className="h-5 w-12 bg-slate-800 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlanListItemSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-4 items-center animate-pulse">
      <div className="h-10 w-10 bg-slate-800 rounded-lg shrink-0"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 bg-slate-800 rounded"></div>
        <div className="h-3 w-1/2 bg-slate-800 rounded"></div>
      </div>
      <div className="h-6 w-16 bg-slate-800 rounded-full"></div>
    </div>
  );
}
