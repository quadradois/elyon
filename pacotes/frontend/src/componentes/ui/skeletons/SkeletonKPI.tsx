import { Card, CardContent } from "../card";
import { Skeleton } from "../skeleton";

export function SkeletonKPI() {
  return (
    <Card>
      <CardContent className="p-6">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

