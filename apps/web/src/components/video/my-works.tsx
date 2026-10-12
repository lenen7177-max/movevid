import { buttonVariants } from "@repo/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@repo/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "@/i18n";
import { orpc } from "@/utils/orpc";
import { HistoryList, ResultPanel } from "./video-studio";

const POLL_MS = 4000;
const LIST_LIMIT = 50;

/** Dashboard view of the user's renders; each one opens in place with progress and download. */
export function MyWorks() {
  const t = useTranslations("video");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();

  const listQuery = useQuery({
    queryKey: ["video", "list", LIST_LIMIT],
    queryFn: () => orpc.video.list.call({ limit: LIST_LIMIT }),
  });

  // Fetching a single job also advances it with the provider, so poll while it renders.
  const jobQuery = useQuery({
    queryKey: ["video", "job", selectedId],
    queryFn: () => orpc.video.get.call({ id: selectedId ?? "" }),
    enabled: Boolean(selectedId),
    refetchInterval: (query) => (query.state.data?.status === "processing" ? POLL_MS : false),
  });
  const job = jobQuery.data;

  useEffect(() => {
    if (job && job.status !== "processing") {
      void queryClient.invalidateQueries({ queryKey: ["video", "list"] });
    }
  }, [job, queryClient]);

  return (
    <div className="relative">
      {/* Sits on the same line as the list's own "My works" heading. */}
      <div className="absolute top-0 right-0">
        <Link to="/studio" className={buttonVariants({ size: "sm" })}>
          <Wand2 aria-hidden="true" />
          {t("nav.studio")}
        </Link>
      </div>

      {listQuery.isPending ? (
        <Loader2 className="text-muted-foreground mx-auto size-6 animate-spin" aria-hidden="true" />
      ) : (
        <HistoryList
          jobs={listQuery.data?.jobs ?? []}
          activeId={selectedId}
          onSelect={setSelectedId}
          className=""
        />
      )}

      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(undefined);
        }}
      >
        {/* Top padding keeps the close button clear of the video. */}
        <DialogContent className="p-6 pt-14 sm:max-w-3xl sm:p-8 sm:pt-14">
          <DialogTitle className="sr-only">{t("studio.history.title")}</DialogTitle>
          {job ? (
            <ResultPanel
              job={job}
              autoPlay={false}
              onReset={() => {
                void navigate({ to: "/studio" });
              }}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center">
              <Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden="true" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
