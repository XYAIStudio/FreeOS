import { useState, useRef, useEffect, useCallback } from "react";
import Avatar from "./Avatar";
import { useLocale } from "../i18n";

export interface MentionMember {
  id: number;
  name: string;
  employee_name?: string;
  user_name?: string;
  avatar_emoji?: string;
  employee_role?: string;
  agent_type?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  members: MentionMember[];
}

export default function MentionInput({
  value,
  onChange,
  onSend,
  placeholder = "输入消息...",
  disabled = false,
  members,
}: MentionInputProps) {
  const { t, isEnglish } = useLocale();
  const allMentionName = isEnglish ? "all" : "全体成员";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIdx, setMentionIdx] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(-1);

  const getDisplayName = (m: MentionMember) => m.name || m.employee_name || m.user_name || "";

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart ?? newValue.length;
    const textBefore = newValue.slice(0, cursorPos);

    const lastAtIndex = textBefore.lastIndexOf("@");
    if (lastAtIndex === -1) {
      setShowMentions(false);
      setMentionQuery("");
      setMentionIdx(-1);
      setMentionStartPos(-1);
      return;
    }

    // Only trigger if @ is at word boundary (start of line, space, or after another mention)
    const charBefore = lastAtIndex > 0 ? textBefore[lastAtIndex - 1] : " ";
    if (charBefore !== " " && charBefore !== "\n") {
      setShowMentions(false);
      setMentionQuery("");
      setMentionIdx(-1);
      setMentionStartPos(-1);
      return;
    }

    const query = textBefore.slice(lastAtIndex + 1);
    // Don't trigger if there's a space after @
    if (query.includes(" ")) {
      setShowMentions(false);
      setMentionQuery("");
      setMentionIdx(-1);
      setMentionStartPos(-1);
      return;
    }

    setMentionQuery(query);
    setMentionIdx(-1); // default select @全体成员
    setMentionStartPos(lastAtIndex);
    // Always show dropdown when @ is at word boundary (at least @全体成员 is available)
    setShowMentions(true);
  };

  const filtermembers = () => {
    return members.filter((m) => {
      const name = getDisplayName(m);
      return name.toLowerCase().includes(mentionQuery.toLowerCase());
    });
  };

  const computedFiltered = filtermembers();

  const insertMention = useCallback(
    (member: MentionMember) => {
      if (mentionStartPos < 0) return;
      const displayName = getDisplayName(member);
      const newValue =
        value.slice(0, mentionStartPos) +
        `@${displayName} ` +
        value.slice(mentionStartPos + 1 + mentionQuery.length);
      onChange(newValue);
      setShowMentions(false);
      setMentionQuery("");
      setMentionIdx(-1);
      setMentionStartPos(-1);
      // Focus textarea and put cursor after inserted mention
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          const newCursorPos = mentionStartPos + `@${displayName} `.length;
          ta.focus();
          ta.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    },
    [value, mentionStartPos, mentionQuery, onChange]
  );

  const selectCurrentMention = useCallback(() => {
    if (mentionIdx === -1) {
      // @全体成员
      insertMention({ id: -1, name: allMentionName } as MentionMember);
    } else if (computedFiltered.length > 0 && mentionIdx < computedFiltered.length) {
      insertMention(computedFiltered[mentionIdx]);
    }
  }, [computedFiltered, mentionIdx, insertMention, allMentionName]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions) {
      const totalItems = 1 + computedFiltered.length; // @全体成员 + filtered members
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((prev) => {
          const next = prev + 1;
          return next >= computedFiltered.length ? -1 : next;
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((prev) => {
          const next = prev - 1;
          return next < -1 ? computedFiltered.length - 1 : next;
        });
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        selectCurrentMention();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentions(false);
        setMentionIdx(-1);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        selectCurrentMention();
        return;
      }
    }

    // Normal send on Enter (without shift)
    if (e.key === "Enter" && !e.shiftKey && !showMentions) {
      e.preventDefault();
      onSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 150) + "px";
    }
  }, [value]);

  // Close mentions on blur (delayed to allow click on mention item)
  const handleBlur = () => {
    setTimeout(() => {
      setShowMentions(false);
      setMentionIdx(-1);
    }, 200);
  };

  // Recalc filtered members when mentionQuery or members change
  useEffect(() => {
    if (showMentions) {
      setMentionIdx(-1); // default to @全体成员
    }
  }, [mentionQuery]);

  // When members arrive (async load), re-trigger @ detection
  useEffect(() => {
    if (members.length > 0) {
      const ta = textareaRef.current;
      if (!ta) return;
      const cursorPos = ta.selectionStart ?? ta.value.length;
      const textBefore = ta.value.slice(0, cursorPos);
      const lastAtIndex = textBefore.lastIndexOf("@");
      if (lastAtIndex === -1) return;
      const charBefore = lastAtIndex > 0 ? textBefore[lastAtIndex - 1] : " ";
      if (charBefore !== " " && charBefore !== "\n") return;
      const query = textBefore.slice(lastAtIndex + 1);
      if (query.includes(" ")) return;
      setMentionQuery(query);
      setMentionStartPos(lastAtIndex);
      setShowMentions(true);
      setMentionIdx(-1);
    }
  }, [members]);

  return (
    <div className="relative flex-1">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={() => {
          // Re-trigger mention detection on focus
          const ta = textareaRef.current;
          if (ta) {
            handleInputChange({
              target: ta,
              currentTarget: ta,
            } as React.ChangeEvent<HTMLTextAreaElement>);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="w-full resize-none px-3.5 py-2.5 rounded border border-border bg-bg text-sm text-text outline-none focus:border-primary placeholder:text-text-muted"
      />

      {/* Mention dropdown */}
      {showMentions && (
        <div className="absolute bottom-full left-0 right-0 mb-2 max-h-48 overflow-y-auto bg-white border border-border rounded-lg shadow-xl z-50">
          {/* @全体成员 固定在顶部 */}
          <button
            key="at-all"
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertMention({ id: -1, name: allMentionName } as MentionMember);
            }}
            onMouseEnter={() => setMentionIdx(-1)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
              mentionIdx === -1 ? "bg-orange-500/10" : "hover:bg-orange-50"
            }`}
          >
            <div className="w-7 h-7 rounded bg-orange-500/15 text-orange-600 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><line x1="22" y1="2" x2="16.65" y2="8.4"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-orange-600 truncate">@{allMentionName}</span>
              </div>
              <p className="text-[10px] text-orange-400 truncate">{t("通知所有群成员", "Notify all group members")}</p>
            </div>
          </button>
          {/* 分隔线 */}
          {computedFiltered.length > 0 && (
            <div className="px-3 py-0.5 border-t border-border" />
          )}
          {computedFiltered.map((member, idx) => {
            const displayName = getDisplayName(member);
            const isActive = idx === mentionIdx;
            return (
              <button
                key={member.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(member);
                }}
                onMouseEnter={() => setMentionIdx(idx)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  isActive ? "bg-primary/10" : "hover:bg-bg"
                }`}
              >
                <Avatar
                  id={member.id}
                  name={displayName}
                  size={28}
                  className="rounded shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-text truncate">
                      {displayName}
                    </span>
                    {member.agent_type && (
                      <span className="text-[8px] font-bold px-1 py-0.5 bg-emerald-500/10 text-emerald-500 rounded shrink-0">
                        AI
                      </span>
                    )}
                  </div>
                  {(member.employee_role || member.agent_type) && (
                    <p className="text-[10px] text-text-muted truncate">
                      {member.employee_role || member.agent_type}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
