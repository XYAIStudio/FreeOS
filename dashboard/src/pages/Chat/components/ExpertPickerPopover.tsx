import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "antd";
import { GraduationCap, Users } from "lucide-react";
import SearchablePickerPanel, {
  pickerStyles,
} from "../../../components/ChatPicker/SearchablePickerPanel";
import { uniqueMemberIds } from "../../../utils/groupChats";
import ExpertAgentAvatar, { type ChatAgentOption } from "./ExpertAgentAvatar";
import styles from "../index.module.less";

export type { ChatAgentOption };

interface ExpertPickerPopoverProps {
  agents: ChatAgentOption[];
  selectedAgentIds: string[];
  onSelect: (agent: ChatAgentOption) => void;
  onNavigateAway?: () => void;
  hostAgent?: ChatAgentOption | null;
  onEnterGroupChat?: (members: ChatAgentOption[]) => void;
  groupStarting?: boolean;
}

export function resolveGroupMembers(
  checkedIds: string[],
  agents: ChatAgentOption[],
  hostAgent?: ChatAgentOption | null,
): ChatAgentOption[] {
  const byId = new Map(agents.map((agent) => [agent.agent_id, agent]));
  if (hostAgent) byId.set(hostAgent.agent_id, hostAgent);
  return uniqueMemberIds([hostAgent?.agent_id, ...checkedIds])
    .map((id) => byId.get(id))
    .filter((agent): agent is ChatAgentOption => Boolean(agent));
}

export default function ExpertPickerPopover({
  agents,
  selectedAgentIds,
  onSelect,
  onNavigateAway,
  hostAgent,
  onEnterGroupChat,
  groupStarting = false,
}: ExpertPickerPopoverProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  const filterFn = useCallback(
    (agent: ChatAgentOption, query: string) =>
      agent.name.toLowerCase().includes(query) ||
      agent.agent_id.toLowerCase().includes(query),
    [],
  );

  const groupMembers = useMemo(
    () => resolveGroupMembers(checkedIds, agents, hostAgent),
    [agents, checkedIds, hostAgent],
  );
  const canEnterGroup = Boolean(onEnterGroupChat) && groupMembers.length >= 2;

  const toggleChecked = (agentId: string, next: boolean) => {
    setCheckedIds((prev) => {
      if (next) return uniqueMemberIds([...prev, agentId]);
      return prev.filter((id) => id !== agentId);
    });
  };

  return (
    <SearchablePickerPanel
      items={agents}
      filterFn={filterFn}
      searchPlaceholder={t("chat.expertPickerSearch")}
      emptyMessage={t("chat.expertPickerEmpty")}
      width="compact"
      footerIcon={<GraduationCap size={15} aria-hidden />}
      footerLabel={t("chat.expertPickerManage")}
      onFooterClick={() => {
        onNavigateAway?.();
        navigate("/experts");
      }}
      listFooter={
        onEnterGroupChat ? (
          <div className={styles.expertPickerGroupBar}>
            <p className={styles.expertPickerGroupHint}>
              {t("chat.expertPickerGroupHint")}
            </p>
            <button
              type="button"
              className={styles.expertPickerGroupBtn}
              disabled={!canEnterGroup || groupStarting}
              aria-label={t("chat.expertPickerEnterGroupCount", {
                count: groupMembers.length,
              })}
              onClick={() => onEnterGroupChat(groupMembers)}
            >
              <Users size={15} aria-hidden />
              <span>
                {t("chat.expertPickerEnterGroupCount", {
                  count: groupMembers.length,
                })}
              </span>
            </button>
          </div>
        ) : null
      }
      renderItem={(agent) => {
        const active = selectedAgentIds.includes(agent.agent_id);
        const checked = checkedIds.includes(agent.agent_id);
        return (
          <div
            key={agent.agent_id}
            className={`${styles.expertPickerRow} ${
              active ? styles.expertPickerItemActive : ""
            }`}
          >
            <Checkbox
              checked={checked}
              onChange={(event) =>
                toggleChecked(agent.agent_id, event.target.checked)
              }
              aria-label={t("chat.expertPickerCheck", { name: agent.name })}
            />
            <button
              type="button"
              className={styles.expertPickerSelect}
              onClick={() => onSelect(agent)}
            >
              <ExpertAgentAvatar
                iconName={agent.icon_name}
                iconUrl={agent.icon_url}
                color={agent.color}
                size={32}
                iconSize={18}
              />
              <span className={styles.expertPickerItemText}>
                <span className={pickerStyles.itemName}>{agent.name}</span>
                {agent.is_shared && (
                  <span className={styles.expertSharedBadge}>
                    {t("chat.expertSharedBadge", "共享")}
                  </span>
                )}
              </span>
            </button>
          </div>
        );
      }}
    />
  );
}
