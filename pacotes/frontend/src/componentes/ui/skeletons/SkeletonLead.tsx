import { Skeleton } from "../skeleton";

export function SkeletonLead() {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-slate-100">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-40 mb-2" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

