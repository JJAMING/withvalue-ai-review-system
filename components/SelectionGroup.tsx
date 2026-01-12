
import React from 'react';

interface SelectionGroupProps<T extends string> {
  label: string;
  options: T[];
  selected: T;
  onChange: (value: T) => void;
}

export function SelectionGroup<T extends string>({ label, options, selected, onChange }: SelectionGroupProps<T>) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">{label}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`py-2 px-5 rounded-xl text-sm font-bold transition-all duration-200 border-2 active:scale-95 ${
              selected === option
                ? 'border-[#5d4037] bg-[#5d4037] text-white shadow-md shadow-amber-100'
                : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-slate-100'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
