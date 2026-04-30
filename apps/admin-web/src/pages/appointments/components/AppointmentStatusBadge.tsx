import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_COLOR, STATUS_DOT, type AppointmentStatus } from "@/lib/appointment-status";

interface AppointmentStatusBadgeProps {
  status: string;
  className?: string;
}

export function AppointmentStatusBadge({ status, className }: AppointmentStatusBadgeProps) {
  const s = status as AppointmentStatus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        STATUS_COLOR[s] ?? "bg-gray-100 text-gray-600 border-gray-200",
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[s] ?? "bg-gray-400")} />
      {STATUS_LABEL[s] ?? status}
    </span>
  );
}
