import Loader from "./loader";

export function FullScreenLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <Loader />
    </div>
  );
}

export function ContentLoading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <Loader />
    </div>
  );
}
