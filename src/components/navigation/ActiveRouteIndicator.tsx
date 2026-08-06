import { forwardRef } from "react";

type ActiveRouteIndicatorProps = {
  visible: boolean;
};

export const ActiveRouteIndicator = forwardRef<HTMLSpanElement, ActiveRouteIndicatorProps>(function ActiveRouteIndicator({ visible }, ref) {
  return (
    <span
      aria-hidden="true"
      className="active-route-indicator"
      data-visible={visible ? "true" : "false"}
      ref={ref}
      style={{ pointerEvents: "none" }}
    />
  );
});
