import { Bell } from "lucide-react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useRecordContext,
  useUpdate,
} from "ra-core";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { NoteMention } from "../types";

interface InboxItem extends NoteMention {
  lead_name?: string;
  note_text?: string;
  sender_name?: string;
}

/**
 * Marks the current user's mentions on the open lead as read — so opening the
 * lead (by any path) counts as "read". Render inside a record context (the
 * contact ShowBase).
 */
export const MarkMentionsRead = () => {
  const record = useRecordContext();
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();

  useEffect(() => {
    if (!record?.id || !identity?.id) return;
    dataProvider
      .getList("note_mentions", {
        filter: { contact_id: record.id, recipient_id: identity.id },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "id", order: "ASC" },
      })
      .then(({ data }) => {
        const unreadIds = data
          .filter((m: NoteMention) => !m.read_at)
          .map((m: NoteMention) => m.id);
        if (unreadIds.length > 0) {
          dataProvider.updateMany("note_mentions", {
            ids: unreadIds,
            data: { read_at: new Date().toISOString() },
          });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id, identity?.id]);

  return null;
};

/**
 * Bell + dropdown of @mention notifications addressed to the current user.
 * RLS scopes `note_mentions_inbox` to the recipient. Opening an item navigates
 * to the lead and marks it read; "read" elsewhere is stamped when the lead opens.
 */
export const NotificationsBell = () => {
  const navigate = useNavigate();
  const [update] = useUpdate();
  const { data, refetch } = useGetList<InboxItem>(
    "note_mentions_inbox",
    {
      pagination: { page: 1, perPage: 30 },
      sort: { field: "created_at", order: "DESC" },
    },
    { refetchInterval: 30000 },
  );
  const items = data ?? [];
  const unread = items.filter((i) => !i.read_at);

  const open = (item: InboxItem) => {
    if (!item.read_at) {
      update(
        "note_mentions",
        {
          id: item.id,
          data: { read_at: new Date().toISOString() },
          previousData: item,
        },
        { onSuccess: () => refetch() },
      );
    }
    navigate(`/contacts/${item.contact_id}/show`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Avisos"
        >
          <Bell className="size-5" />
          {unread.length > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[0.6rem] font-medium rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
              {unread.length}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-h-96 overflow-auto p-0"
      >
        <div className="px-3 py-2 text-sm font-medium border-b">Avisos</div>
        {items.length === 0 ? (
          <div className="px-3 py-6 text-sm text-muted-foreground text-center">
            Sin avisos
          </div>
        ) : (
          items.map((item) => (
            <button
              key={String(item.id)}
              type="button"
              onClick={() => open(item)}
              className={cn(
                "w-full text-left px-3 py-2 hover:bg-muted border-b last:border-0",
                !item.read_at && "bg-blue-50/60",
              )}
            >
              <p className="text-xs">
                <span className="font-medium">{item.sender_name}</span> en{" "}
                <span className="font-medium">{item.lead_name}</span>
                {!item.read_at ? (
                  <span className="ml-1 text-[0.6rem] text-blue-600">
                    ● nuevo
                  </span>
                ) : null}
              </p>
              {item.note_text ? (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.note_text}
                </p>
              ) : null}
            </button>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
