"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  value?: string;
  onSubmit?: (cmd: string) => void;
  placeholder?: string;
};

export default function CommandBar({
  value = "",
  onSubmit,
  placeholder = "Command… (AAPL | sym TSLA | ws full | ws news | news off)",
}: Props) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setText(value), [value]);
  const cleaned = useMemo(() => text.trim(), [text]);

  function submit() {
    if (!cleaned) return;
    onSubmit?.(cleaned);
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 shadow-sm backdrop-blur">
        {/* BIG WORDMARK (D) */}
        <div className="flex items-center pr-4 border-r border-white/10">
          <img
            src="/brand/imynted-wordmark.png"
            alt="iMYNTED"
            width={160}
            height={36}
            className="object-contain"
          />
        </div>

        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") {
              setText("");
              inputRef.current?.blur();
            }
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-[14px] text-white placeholder:text-white/35 outline-none caret-white"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />

        <button
          type="button"
          onClick={submit}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
        >
          Set
        </button>
      </div>
    </div>
  );
}
